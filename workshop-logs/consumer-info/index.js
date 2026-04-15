const express = require('express');
const amqp = require('amqplib');

const app = express();

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const ROUTING_KEY  = process.env.ROUTING_KEY  || 'logs.error';
const PORT         = process.env.PORT         || 4001;
const EXCHANGE     = 'logs.topic';
const QUEUE_NAME   = `queue.${ROUTING_KEY}`;
const MAX_LOGS     = 50;

let receivedLogs = [];

async function connectWithRetry(retries = 10, delay = 3000) {
  for (let i = 0; i < retries; i++) {
    try {
      const conn = await amqp.connect(RABBITMQ_URL);
      const channel = await conn.createChannel();

      await channel.assertExchange(EXCHANGE, 'topic', { durable: true });

      const q = await channel.assertQueue(QUEUE_NAME, { durable: true });
      await channel.bindQueue(q.queue, EXCHANGE, ROUTING_KEY);

      console.log(`[Consumer:${ROUTING_KEY}] Bound to queue "${QUEUE_NAME}", waiting for messages...`);

      channel.consume(q.queue, (msg) => {
        if (!msg) return;
        const log = JSON.parse(msg.content.toString());
        const entry = { ...log, receivedAt: new Date().toISOString() };
        receivedLogs.unshift(entry);
        if (receivedLogs.length > MAX_LOGS) receivedLogs.pop();
        console.log(`[Consumer:${ROUTING_KEY}]`, JSON.stringify(entry));
        channel.ack(msg);
      });

      return;
    } catch (err) {
      console.log(`[Consumer:${ROUTING_KEY}] RabbitMQ not ready, retrying... (${i + 1}/10)`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
  throw new Error('Could not connect to RabbitMQ after retries');
}

app.get('/logs', (req, res) => {
  res.json({
    routingKey: ROUTING_KEY,
    count: receivedLogs.length,
    logs: receivedLogs
  });
});

app.get('/health', (req, res) => res.json({ status: 'ok', queue: QUEUE_NAME }));

connectWithRetry().then(() => {
  app.listen(PORT, () => console.log(`[Consumer:${ROUTING_KEY}] HTTP server on port ${PORT}`));
}).catch(console.error);
