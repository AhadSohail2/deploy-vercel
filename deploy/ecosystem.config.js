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
            env
        },
        {
            name: 's3-reverse-proxy',
            cwd: path.join(root, 's3-reverse-proxy'),
            script: 'index.js',
            env: {
                ...env,
                PORT: env.S3_REVERSE_PROXY_PORT || 8000
            }
        },
        {
            name: 'frontend',
            cwd: path.join(root, 'frontend-nextjs'),
            script: 'npm',
            args: 'start',
            env: {
                ...env,
                PORT: 3000
            }
        }
    ]
}
