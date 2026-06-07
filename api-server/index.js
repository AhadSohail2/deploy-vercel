const express = require('express')
const http = require('http')
const path = require('path')
const { spawn } = require('child_process')
const cors = require('cors')
const { generateSlug } = require('random-word-slugs')
const { Server } = require('socket.io')
const Redis = require('ioredis')

const app = express()
const PORT = process.env.PORT || 9000
const SOCKET_PORT = process.env.SOCKET_PORT || 9002

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
const DEPLOY_HOST = process.env.DEPLOY_HOST || 'localhost:8000'
const BUILD_SCRIPT = path.join(__dirname, '..', 'build-server', 'build.js')

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
    cors: { origin: '*', methods: ['GET', 'POST'] },
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

function validateBuildConfig() {
    const missing = []
    if (!process.env.AWS_ACCESS_KEY_ID) missing.push('AWS_ACCESS_KEY_ID')
    if (!process.env.AWS_SECRET_ACCESS_KEY) missing.push('AWS_SECRET_ACCESS_KEY')
    if (!process.env.S3_BUCKET) missing.push('S3_BUCKET')
    return missing
}

function startLocalBuild(gitURL, projectSlug) {
    const env = {
        ...process.env,
        GIT_REPOSITORY__URL: gitURL,
        PROJECT_ID: projectSlug,
        REDIS_URL,
    }

    const child = spawn(process.execPath, [BUILD_SCRIPT], {
        env,
        detached: true,
        stdio: 'ignore',
    })
    child.unref()
}

app.use(cors(corsOptions))
app.options('*', cors(corsOptions))
app.use(express.json())

app.get('/build-check', (req, res) => {
    const missing = validateBuildConfig()
    res.json({
        ok: missing.length === 0,
        missing,
        mode: 'local',
        s3Bucket: process.env.S3_BUCKET,
        redisUrl: REDIS_URL,
        deployHost: DEPLOY_HOST,
    })
})

app.post('/project', async (req, res) => {
    const { gitURL, slug } = req.body
    const projectSlug = slug || generateSlug()

    const missing = validateBuildConfig()
    if (missing.length > 0) {
        return res.status(500).json({
            status: 'error',
            message: `Missing config: ${missing.join(', ')}`,
        })
    }

    if (!gitURL) {
        return res.status(400).json({ status: 'error', message: 'gitURL is required' })
    }

    startLocalBuild(gitURL, projectSlug)

    return res.json({
        status: 'queued',
        data: { projectSlug, url: `http://${projectSlug}.${DEPLOY_HOST}` },
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
