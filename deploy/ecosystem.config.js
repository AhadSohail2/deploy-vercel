const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')

function loadEnv(filePath) {
    const env = {}
    if (!fs.existsSync(filePath)) return env
    for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eq = trimmed.indexOf('=')
        if (eq === -1) continue
        env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
    }
    return env
}

const env = {
    NODE_ENV: 'production',
    ...loadEnv(path.join(root, '.env'))
}

module.exports = {
    apps: [
        {
            name: 'api-server',
            cwd: path.join(root, 'api-server'),
            script: 'index.js',
            env: {
                ...env,
                PORT: env.PORT || '9000',
                SOCKET_PORT: env.SOCKET_PORT || '9002',
            },
            max_restarts: 10,
            min_uptime: '10s',
        },
        {
            name: 's3-reverse-proxy',
            cwd: path.join(root, 's3-reverse-proxy'),
            script: 'index.js',
            env: {
                NODE_ENV: 'production',
                AWS_REGION: env.AWS_REGION,
                S3_BUCKET: env.S3_BUCKET,
                S3_BASE_PATH: env.S3_BASE_PATH,
                PORT: env.S3_REVERSE_PROXY_PORT || '8000',
            },
            max_restarts: 10,
            min_uptime: '10s',
        },
        {
            name: 'frontend',
            cwd: path.join(root, 'frontend-nextjs'),
            script: 'node_modules/next/dist/bin/next',
            args: 'start -p 3000',
            env: {
                NODE_ENV: 'production',
            },
            max_restarts: 10,
            min_uptime: '10s',
        },
    ],
}
