const express = require('express');
const amqp = require('amqplib');

const app = express();
app.use(express.json());

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const SERVICE_NAME = process.env.SERVICE_NAME || 'service-a';
const PORT = process.env.PORT || 3001;
const EXCHANGE = 'logs.topic';

let channel;

async function connectWithRetry(retries = 10, delay = 3000) {
  for (let i = 0; i < retries; i++) {
    try {
      const conn = await amqp.connect(RABBITMQ_URL);
      channel = await conn.createChannel();
      await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
      console.log(`[${SERVICE_NAME}] Connected to RabbitMQ`);
      return;
    } catch (err) {
      console.log(`[${SERVICE_NAME}] RabbitMQ not ready, retrying in ${delay}ms... (${i + 1}/${retries})`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
  throw new Error('Could not connect to RabbitMQ after retries');
}

function publishLog(level, message) {
  if (!channel) return;
  const routingKey = `logs.${level}`;
  const payload = JSON.stringify({
    level,
    message,
    service: SERVICE_NAME,
    timestamp: new Date().toISOString()
  });
  channel.publish(EXCHANGE, routingKey, Buffer.from(payload));
  console.log(`[${SERVICE_NAME}] Published [${routingKey}]: ${message}`);
}

app.post('/log', (req, res) => {
  const { level, message } = req.body;
  if (!['info', 'warn', 'error'].includes(level)) {
    return res.status(400).json({ error: 'level must be info, warn, or error' });
  }
  publishLog(level, message || 'Manual log entry');
  res.json({ status: 'published', level, service: SERVICE_NAME });
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: SERVICE_NAME }));

const SAMPLE_MESSAGES = {
  info:  ['User logged in', 'Request completed', 'Cache refreshed', 'Config loaded', 'Token validated'],
  warn:  ['High memory usage', 'Slow DB query', 'Rate limit approaching', 'Retry attempt', 'Disk space low'],
  error: ['Unhandled exception', 'DB connection lost', 'Auth token expired', 'Service timeout', 'Null pointer error']
};

function simulateLogs() {
  const levels = ['info', 'info', 'info', 'warn', 'warn', 'error'];
  const level = levels[Math.floor(Math.random() * levels.length)];
  const messages = SAMPLE_MESSAGES[level];
  const message = messages[Math.floor(Math.random() * messages.length)];
  publishLog(level, message);
}

connectWithRetry().then(() => {
  app.listen(PORT, () => {
    console.log(`[${SERVICE_NAME}] Running on port ${PORT}`);
    setInterval(simulateLogs, 5000);
  });
}).catch(console.error);
