const express = require('express')
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

io.listen(SOCKET_PORT, () => console.log(`Socket server on ${SOCKET_PORT}`))
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
    SUBNETS: (process.env.ECS_SUBNETS || '').split(',').filter(Boolean),
    SECURITY_GROUPS: (process.env.ECS_SECURITY_GROUPS || '').split(',').filter(Boolean)
}

app.use(cors(corsOptions))
app.options('*', cors(corsOptions))
app.use(express.json())

app.post('/project', async (req, res) => {
    const { gitURL, slug } = req.body
    const projectSlug = slug ? slug : generateSlug()

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
                    name: 'build-server',
                    environment: [
                        { name: 'GIT_REPOSITORY__URL', value: gitURL },
                        { name: 'PROJECT_ID', value: projectSlug },
                        { name: 'REDIS_URL', value: redisUrlForBuild }
                    ]
                }
            ]
        }
    })

    await ecsClient.send(command)

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

app.listen(PORT, () => console.log(`API server on ${PORT}`))
