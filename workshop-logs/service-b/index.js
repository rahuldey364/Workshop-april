const express = require('express');
const amqp = require('amqplib');

const app = express();
app.use(express.json());

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const SERVICE_NAME = process.env.SERVICE_NAME || 'service-b';
const PORT = process.env.PORT || 3002;
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
      console.log(`[${SERVICE_NAME}] RabbitMQ not ready, retrying in ${delay}ms... (${i + 1}/10)`);
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
  info:  ['Order placed', 'Payment processed', 'Shipment dispatched', 'Invoice generated', 'Order updated'],
  warn:  ['Payment gateway slow', 'Stock running low', 'Order queue backing up', 'Shipping delay detected'],
  error: ['Payment failed', 'Order not found', 'Inventory sync error', 'Checkout timeout', 'Duplicate order detected']
};

function simulateLogs() {
  const levels = ['info', 'info', 'info', 'warn', 'warn', 'error'];
  const level = levels[Math.floor(Math.random() * levels.length)];
  const msgs = SAMPLE_MESSAGES[level];
  publishLog(level, msgs[Math.floor(Math.random() * msgs.length)]);
}

connectWithRetry().then(() => {
  app.listen(PORT, () => {
    console.log(`[${SERVICE_NAME}] Running on port ${PORT}`);
    setInterval(simulateLogs, 5000);
  });
}).catch(console.error);
