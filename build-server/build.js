const { spawn, execSync } = require('child_process')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const mime = require('mime-types')
const Redis = require('ioredis')

const GIT_URL = process.env.GIT_REPOSITORY__URL
const PROJECT_ID = process.env.PROJECT_ID
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
const S3_BUCKET = process.env.S3_BUCKET || 'vercel-deploy-clone-23'

const WORK_ROOT = process.env.BUILD_WORK_DIR || path.join(os.tmpdir(), 'deploy-vercel-builds')
const workDir = path.join(WORK_ROOT, PROJECT_ID || 'unknown')

const publisher = new Redis(REDIS_URL)
publisher.on('error', () => {})

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

function cleanup() {
    if (fs.existsSync(workDir)) {
        fs.rmSync(workDir, { recursive: true, force: true })
        publishLog('Cleaned up build files')
    }
}

function findOutputDir(projectRoot) {
    for (const dir of ['dist', 'build', 'out']) {
        const candidate = path.join(projectRoot, dir)
        if (fs.existsSync(candidate)) return candidate
    }
    return null
}

function runBuild(projectRoot) {
    return new Promise((resolve, reject) => {
        const p = spawn('bash', ['-lc', 'npm install && npm run build'], {
            cwd: projectRoot,
            env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=2048' },
        })

        p.stdout.on('data', (d) => publishLog(d.toString()))
        p.stderr.on('data', (d) => publishLog(d.toString()))

        p.on('close', (code) => {
            if (code !== 0) reject(new Error(`Build failed with exit code ${code}`))
            else resolve()
        })
    })
}

async function uploadDir(outputDir) {
    const files = fs.readdirSync(outputDir, { recursive: true })
    publishLog('Starting upload to S3')

    for (const file of files) {
        const filePath = path.join(outputDir, file)
        if (fs.lstatSync(filePath).isDirectory()) continue

        const key = `__outputs/${PROJECT_ID}/${file}`
        publishLog(`uploading ${file}`)

        await s3Client.send(
            new PutObjectCommand({
                Bucket: S3_BUCKET,
                Key: key.replace(/\\/g, '/'),
                Body: fs.createReadStream(filePath),
                ContentType: mime.lookup(filePath) || 'application/octet-stream',
            })
        )
        publishLog(`uploaded ${file}`)
    }
}

async function main() {
    if (!GIT_URL || !PROJECT_ID) {
        console.error('GIT_REPOSITORY__URL and PROJECT_ID are required')
        process.exit(1)
    }

    publishLog('Build started')

    if (fs.existsSync(workDir)) {
        fs.rmSync(workDir, { recursive: true, force: true })
    }
    fs.mkdirSync(workDir, { recursive: true })

    try {
        publishLog(`Cloning ${GIT_URL}`)
        execSync(`git clone --depth 1 "${GIT_URL}" "${workDir}"`, {
            stdio: ['ignore', 'pipe', 'pipe'],
        })
        publishLog('Clone complete')

        await runBuild(workDir)
        publishLog('Build complete')

        const outputDir = findOutputDir(workDir)
        if (!outputDir) {
            throw new Error('No dist/, build/, or out/ folder found after build')
        }

        await uploadDir(outputDir)
        publishLog('Done')
    } catch (err) {
        publishLog(`ERROR: ${err.message}`)
        process.exitCode = 1
    } finally {
        cleanup()
        publisher.disconnect()
        process.exit(process.exitCode || 0)
    }
}

main()
