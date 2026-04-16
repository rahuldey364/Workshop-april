const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:4500';

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many requests, please try again later.' });
  }
});

app.use(limiter);

const validateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.substring(7);

  try {
    const response = await axios.post(`${AUTH_SERVICE_URL}/verify`, { token }, { timeout: 5000 });
    
    if (response.data.valid) {
      req.user = response.data.payload;
      next();
    } else {
      res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
  } catch (error) {
    console.error('Token verification error:', error.message);
    res.status(401).json({ error: 'Unauthorized: Token verification failed' });
  }
};

const proxyOptions = {
  changeOrigin: true
};

app.post('/auth/login', async (req, res) => {
  try {
    const response = await axios.post(`${AUTH_SERVICE_URL}/login`, req.body);
    res.json(response.data);
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: 'Service unavailable' });
    }
  }
});

app.post('/verify', async (req, res) => {
  try {
    const response = await axios.post(`${AUTH_SERVICE_URL}/verify`, req.body);
    res.json(response.data);
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: 'Service unavailable' });
    }
  }
});

app.use('/service-a', validateToken, createProxyMiddleware({
  target: 'http://service-a:3001',
  ...proxyOptions,
  pathRewrite: {
    '^/service-a': ''
  },
  onProxyReq: (proxyReq, req, res) => {
    if (req.user && req.user.username) {
      proxyReq.setHeader('X-User', req.user.username);
    }
    if (req.body) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }
  }
}));

app.use('/service-b', validateToken, createProxyMiddleware({
  target: 'http://service-b:3002',
  ...proxyOptions,
  pathRewrite: {
    '^/service-b': ''
  },
  onProxyReq: (proxyReq, req, res) => {
    if (req.user && req.user.username) {
      proxyReq.setHeader('X-User', req.user.username);
    }
    if (req.body) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }
  }
}));

app.use('/dashboard', validateToken, createProxyMiddleware({
  target: 'http://dashboard:5000',
  ...proxyOptions,
  pathRewrite: {
    '^/dashboard': ''
  },
  onProxyReq: (proxyReq, req, res) => {
    // Add authenticated username to header
    if (req.user && req.user.username) {
      proxyReq.setHeader('X-User', req.user.username);
    }
    // Forward body for POST/PUT requests
    if (req.body) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }
  }
}));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'gateway' });
});

app.listen(PORT, () => {
  console.log(`Gateway running on port ${PORT}`);
  console.log('Rate limit: 30 requests per minute per IP');
});
