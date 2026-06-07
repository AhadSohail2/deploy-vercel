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
    CONTAINER: process.env.ECS_CONTAINER_NAME || 'builder-image',
    SUBNETS: (process.env.ECS_SUBNETS || '').split(',').map(s => s.trim()).filter(Boolean),
    SECURITY_GROUPS: (process.env.ECS_SECURITY_GROUPS || '').split(',').map(s => s.trim()).filter(Boolean)
}

const SUBNET_PATTERN = /^subnet-[0-9a-f]+$/
const SECURITY_GROUP_PATTERN = /^sg-[0-9a-f]+$/

function validateEcsConfig() {
    const missing = []
    const invalid = []

    if (!config.CLUSTER) missing.push('ECS_CLUSTER_ARN')
    if (!config.TASK) missing.push('ECS_TASK_ARN')
    if (config.SUBNETS.length === 0) missing.push('ECS_SUBNETS')
    if (config.SECURITY_GROUPS.length === 0) missing.push('ECS_SECURITY_GROUPS')

    for (const subnet of config.SUBNETS) {
        if (!SUBNET_PATTERN.test(subnet)) {
            invalid.push(`invalid subnet "${subnet}" (must look like subnet-0abc123def456)`)
        }
    }

    for (const sg of config.SECURITY_GROUPS) {
        if (!SECURITY_GROUP_PATTERN.test(sg)) {
            invalid.push(`invalid security group "${sg}" (must look like sg-0abc123def456)`)
        }
    }

    return { missing, invalid }
}

function validateBuildEnv() {
    const missing = []
    if (!process.env.AWS_ACCESS_KEY_ID) missing.push('AWS_ACCESS_KEY_ID')
    if (!process.env.AWS_SECRET_ACCESS_KEY) missing.push('AWS_SECRET_ACCESS_KEY')
    if (!process.env.S3_BUCKET) missing.push('S3_BUCKET')
    if (!process.env.REDIS_URL_FOR_ECS) missing.push('REDIS_URL_FOR_ECS')
    return missing
}

function getRedisUrlForBuild() {
    const url = process.env.REDIS_URL_FOR_ECS || ''
    if (!url) {
        return { error: 'REDIS_URL_FOR_ECS is not set. Run: sudo bash deploy/configure-redis-ecs.sh' }
    }
    if (url.includes('127.0.0.1') || url.includes('localhost')) {
        return {
            error: 'REDIS_URL_FOR_ECS must use EC2 private IP (not localhost). Run: sudo bash deploy/configure-redis-ecs.sh',
        }
    }
    return { url }
}

function buildContainerEnvironment(gitURL, projectSlug) {
    const { url: redisUrlForBuild, error } = getRedisUrlForBuild()
    if (error) throw new Error(error)

    const vars = {
        GIT_REPOSITORY__URL: gitURL,
        PROJECT_ID: projectSlug,
        REDIS_URL: redisUrlForBuild,
        AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
        AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
        AWS_REGION: process.env.AWS_REGION || 'us-east-1',
        S3_BUCKET: process.env.S3_BUCKET,
    }

    return Object.entries(vars)
        .filter(([, value]) => value != null && value !== '')
        .map(([name, value]) => ({ name, value: String(value) }))
}

function logBuildEnv(env) {
    const safe = env.map(({ name, value }) => ({
        name,
        value: name.includes('SECRET') ? '***' : value,
    }))
    console.log('ECS container override:', config.CONTAINER, safe)
}

app.use(cors(corsOptions))
app.options('*', cors(corsOptions))
app.use(express.json())

app.get('/ecs-check', (req, res) => {
    const { missing, invalid } = validateEcsConfig()
    const buildMissing = validateBuildEnv()
    const redisCheck = getRedisUrlForBuild()
    res.json({
        ok: missing.length === 0 && invalid.length === 0 && buildMissing.length === 0 && !redisCheck.error,
        missing: [...missing, ...buildMissing],
        invalid,
        redisError: redisCheck.error || null,
        config: {
            cluster: config.CLUSTER,
            task: config.TASK,
            container: config.CONTAINER,
            subnets: config.SUBNETS,
            securityGroups: config.SECURITY_GROUPS,
            region: process.env.AWS_REGION || 'us-east-1',
            s3Bucket: process.env.S3_BUCKET,
            redisUrlLocal: REDIS_URL,
            redisUrlForEcs: process.env.REDIS_URL_FOR_ECS || null,
            redisUrlPassedToBuild: redisCheck.url || null,
            hasAwsCredentials: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
        },
    })
})

app.post('/project', async (req, res) => {
    const { gitURL, slug } = req.body
    const projectSlug = slug ? slug : generateSlug()

    const { missing, invalid } = validateEcsConfig()
    const buildMissing = validateBuildEnv()
    if (missing.length > 0 || buildMissing.length > 0) {
        return res.status(500).json({
            status: 'error',
            message: `Missing config: ${[...missing, ...buildMissing].join(', ')}`
        })
    }
    if (invalid.length > 0) {
        return res.status(500).json({
            status: 'error',
            message: invalid.join('; '),
            hint: 'Fix ECS_SUBNETS and ECS_SECURITY_GROUPS in .env — copy exact IDs from AWS VPC console'
        })
    }

    const redisCheck = getRedisUrlForBuild()
    if (redisCheck.error) {
        return res.status(500).json({ status: 'error', message: redisCheck.error })
    }

    let containerEnvironment
    try {
        containerEnvironment = buildContainerEnvironment(gitURL, projectSlug)
    } catch (err) {
        return res.status(500).json({ status: 'error', message: err.message })
    }

    logBuildEnv(containerEnvironment)

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
                    environment: containerEnvironment
                }
            ]
        }
    })

    try {
        await ecsClient.send(command)
    } catch (err) {
        console.error('ECS RunTask failed:', err.message)
        console.error('ECS config used:', {
            cluster: config.CLUSTER,
            task: config.TASK,
            container: config.CONTAINER,
            subnets: config.SUBNETS,
            securityGroups: config.SECURITY_GROUPS,
        })
        return res.status(500).json({
            status: 'error',
            message: err.message || 'Failed to start ECS build task',
            hint: 'Run: curl http://127.0.0.1:9000/ecs-check — fix invalid values in .env then pm2 restart api-server'
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
