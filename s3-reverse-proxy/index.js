const express = require('express')
const httpProxy = require('http-proxy')

const app = express()
const PORT = process.env.PORT || 8000

const S3_BUCKET = process.env.S3_BUCKET || 'vercel-deploy-clone-23'
const AWS_REGION = process.env.AWS_REGION || 'us-east-1'
const BASE_PATH = process.env.S3_BASE_PATH || `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/__outputs`

const proxy = httpProxy.createProxy()

app.use((req, res) => {
    const hostname = req.hostname
    const subdomain = hostname.split('.')[0]

    const resolvesTo = `${BASE_PATH}/${subdomain}`

    return proxy.web(req, res, { target: resolvesTo, changeOrigin: true })
})

proxy.on('proxyReq', (proxyReq, req, res) => {
    const url = req.url
    if (url === '/')
        proxyReq.path += 'index.html'
})

app.listen(PORT, () => console.log(`Reverse Proxy Running..${PORT}`))
