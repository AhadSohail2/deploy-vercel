const { exec } = require('child_process')
const path = require('path')
const fs = require('fs')
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const mime = require('mime-types')
const Redis = require('ioredis')

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
const S3_BUCKET = process.env.S3_BUCKET || 'vercel-deploy-clone-23'
const PROJECT_ID = process.env.PROJECT_ID

console.log('Build config:', {
    redisUrl: REDIS_URL,
    projectId: PROJECT_ID,
    s3Bucket: S3_BUCKET,
    awsRegion: process.env.AWS_REGION || 'us-east-1',
})

const publisher = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => (times > 8 ? null : Math.min(times * 500, 5000)),
    lazyConnect: true,
})

publisher.on('error', (err) => {
    console.error('Redis error:', err.message)
})

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
        }
        : {}),
})

function publishLog(log) {
    const line = String(log).trim()
    if (!line) return
    console.log(line)
    if (PROJECT_ID) {
        publisher.publish(`logs:${PROJECT_ID}`, JSON.stringify({ log: line })).catch(() => {})
    }
}

async function init() {
    console.log('Executing script.js')

    try {
        await publisher.connect()
        publishLog('Build Started...')
    } catch (err) {
        console.error('Redis unavailable (build continues, logs only in CloudWatch):', err.message)
    }

    const outDirPath = path.join(__dirname, 'output')
    if (!fs.existsSync(outDirPath)) {
        console.error('ERROR: output folder missing — git clone may have failed')
        process.exit(1)
    }

    const p = exec(`cd ${outDirPath} && npm install && npm run build`, {
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=2048' },
    })

    p.stdout.on('data', (data) => publishLog(data.toString()))
    p.stderr.on('data', (data) => publishLog(`stderr: ${data.toString()}`))

    p.on('close', async (code) => {
        if (code !== 0) {
            publishLog(`Build failed with exit code ${code}`)
            process.exit(code || 1)
        }

        publishLog('Build Complete')

        const distFolderPath = path.join(outDirPath, 'dist')
        if (!fs.existsSync(distFolderPath)) {
            publishLog(`ERROR: dist folder not found at ${distFolderPath}`)
            process.exit(1)
        }

        const distFolderContents = fs.readdirSync(distFolderPath, { recursive: true })
        publishLog('Starting to upload')

        for (const file of distFolderContents) {
            const filePath = path.join(distFolderPath, file)
            if (fs.lstatSync(filePath).isDirectory()) continue

            publishLog(`uploading ${file}`)

            try {
                await s3Client.send(
                    new PutObjectCommand({
                        Bucket: S3_BUCKET,
                        Key: `__outputs/${PROJECT_ID}/${file}`,
                        Body: fs.createReadStream(filePath),
                        ContentType: mime.lookup(filePath) || 'application/octet-stream',
                    })
                )
                publishLog(`uploaded ${file}`)
            } catch (err) {
                publishLog(`upload failed ${file}: ${err.message}`)
                process.exit(1)
            }
        }

        publishLog('Done')
        process.exit(0)
    })
}

init().catch((err) => {
    console.error('Fatal error:', err)
    process.exit(1)
})
