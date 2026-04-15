const express = require('express')
const rateLimit = require('express-rate-limit')
const { createProxyMiddleware } = require('http-proxy-middleware')
const jwt = require('jsonwebtoken')
const axios = require('axios')

const app = express()
app.use(express.json())

const JWT_SECRET = process.env.JWT_SECRET
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:4500'

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many requests, please try again later.' },
  statusCode: 429,
  standardHeaders: true,
  legacyHeaders: false,
})
app.use(limiter)

app.post('/auth/login', async (req, res) => {
  try {
    const response = await axios.post(`${AUTH_SERVICE_URL}/login`, req.body)
    res.status(response.status).json(response.data)
  } catch (err) {
    if (err.response) {
      res.status(err.response.status).json(err.response.data)
    } else {
      res.status(500).json({ error: 'Auth service unavailable' })
    }
  }
})

app.use(async (req, res, next) => {
  if (req.path === '/auth/login') return next()
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Missing or invalid token' })
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.user = payload
    next()
  } catch (err) {
    res.status(401).json({ error: 'Missing or invalid token' })
  }
})

app.use('/', (req, res, next) => {
  if (req.path.startsWith('/service-a')) {
    createProxyMiddleware({ target: 'http://service-a:3001', changeOrigin: true })(req, res, next)
  } else if (req.path.startsWith('/service-b')) {
    createProxyMiddleware({ target: 'http://service-b:3002', changeOrigin: true })(req, res, next)
  } else if (req.path.startsWith('/dashboard')) {
    createProxyMiddleware({ target: 'http://dashboard:5000', changeOrigin: true })(req, res, next)
  } else {
    res.status(404).json({ error: 'Not found' })
  }
})

const PORT = process.env.PORT || 8080
app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`)
})
