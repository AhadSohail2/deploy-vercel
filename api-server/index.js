const express = require('express')
const http = require('http')
const cors = require('cors')
const { generateSlug } = require('random-word-slugs')
const { ECSClient, RunTaskCommand } = require('@aws-sdk/client-ecs')
const { Server } = require('socket.io')
const Redis = require('ioredis')

const app = express()
const PORT = process.env.PORT || 9000
const SOCKET_PORT = process.env.SOCKET_PORT || 9002

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
const DEPLOY_HOST = process.env.DEPLOY_HOST || 'localhost:8000'

const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}

const subscriber = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    retryStrategy: (times) => Math.min(times * 500, 10000),
})

subscriber.on('error', (err) => {
    console.error('Redis error:', err.message)
})

const io = new Server({
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
    path: '/socket.io/',
})

io.on('connection', socket => {
    socket.on('subscribe', channel => {
        socket.join(channel)
        socket.emit('message', JSON.stringify({ log: `Subscribed to ${channel}` }))
    })
})

const socketServer = http.createServer()
io.attach(socketServer)
socketServer.listen(SOCKET_PORT, '127.0.0.1', () => {
    console.log(`Socket server on 127.0.0.1:${SOCKET_PORT}`)
})
io.engine.on('connection_error', (err) => {
    console.error('Socket connection error:', err.message)
})

const ecsClient = new ECSClient({
    region: process.env.AWS_REGION || 'us-east-1',
    ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            }
        }
        : {})
})

const config = {
    CLUSTER: process.env.ECS_CLUSTER_ARN,
    TASK: process.env.ECS_TASK_ARN,
    CONTAINER: process.env.ECS_CONTAINER_NAME || 'build-server',
    SUBNETS: (process.env.ECS_SUBNETS || '').split(',').map(s => s.trim()).filter(Boolean),
    SECURITY_GROUPS: (process.env.ECS_SECURITY_GROUPS || '').split(',').map(s => s.trim()).filter(Boolean)
}

function validateEcsConfig() {
    const missing = []
    if (!config.CLUSTER) missing.push('ECS_CLUSTER_ARN')
    if (!config.TASK) missing.push('ECS_TASK_ARN')
    if (config.SUBNETS.length === 0) missing.push('ECS_SUBNETS')
    if (config.SECURITY_GROUPS.length === 0) missing.push('ECS_SECURITY_GROUPS')
    return missing
}

app.use(cors(corsOptions))
app.options('*', cors(corsOptions))
app.use(express.json())

app.post('/project', async (req, res) => {
    const { gitURL, slug } = req.body
    const projectSlug = slug ? slug : generateSlug()

    const missing = validateEcsConfig()
    if (missing.length > 0) {
        return res.status(500).json({
            status: 'error',
            message: `Missing ECS config: ${missing.join(', ')}`
        })
    }

    const redisUrlForBuild = process.env.REDIS_URL_FOR_ECS || REDIS_URL

    const command = new RunTaskCommand({
        cluster: config.CLUSTER,
        taskDefinition: config.TASK,
        launchType: 'FARGATE',
        count: 1,
        networkConfiguration: {
            awsvpcConfiguration: {
                assignPublicIp: 'ENABLED',
                subnets: config.SUBNETS,
                securityGroups: config.SECURITY_GROUPS
            }
        },
        overrides: {
            containerOverrides: [
                {
                    name: config.CONTAINER,
                    environment: [
                        { name: 'GIT_REPOSITORY__URL', value: gitURL },
                        { name: 'PROJECT_ID', value: projectSlug },
                        { name: 'REDIS_URL', value: redisUrlForBuild }
                    ]
                }
            ]
        }
    })

    try {
        await ecsClient.send(command)
    } catch (err) {
        console.error('ECS RunTask failed:', err)
        return res.status(500).json({
            status: 'error',
            message: err.message || 'Failed to start ECS build task',
            hint: 'Check ECS_CLUSTER_ARN, ECS_TASK_ARN, ECS_SUBNETS, ECS_SECURITY_GROUPS, and ECS_CONTAINER_NAME in .env'
        })
    }

    return res.json({
        status: 'queued',
        data: { projectSlug, url: `http://${projectSlug}.${DEPLOY_HOST}` }
    })
})

async function initRedisSubscribe() {
    console.log('Subscribed to logs....')
    subscriber.psubscribe('logs:*')
    subscriber.on('pmessage', (pattern, channel, message) => {
        io.to(channel).emit('message', message)
    })
}

initRedisSubscribe()

app.listen(PORT, '127.0.0.1', () => console.log(`API server on 127.0.0.1:${PORT}`))
