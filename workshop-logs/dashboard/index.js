const express = require('express');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 5000;

const CONSUMERS = {
  error: process.env.CONSUMER_ERROR_URL || 'http://consumer-error:4001',
  warn:  process.env.CONSUMER_WARN_URL  || 'http://consumer-warn:4002',
  info:  process.env.CONSUMER_INFO_URL  || 'http://consumer-info:4003',
};

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(`${url}/logs`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

app.get('/stats', async (req, res) => {
  try {
    const [errorData, warnData, infoData] = await Promise.allSettled([
      fetchJson(CONSUMERS.error),
      fetchJson(CONSUMERS.warn),
      fetchJson(CONSUMERS.info),
    ]);

    const errorLogs = errorData.status === 'fulfilled' ? errorData.value.logs : [];
    const warnLogs  = warnData.status  === 'fulfilled' ? warnData.value.logs  : [];
    const infoLogs  = infoData.status  === 'fulfilled' ? infoData.value.logs  : [];

    const allLogs = [...errorLogs, ...warnLogs, ...infoLogs]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const byService = allLogs.reduce((acc, log) => {
      acc[log.service] = (acc[log.service] || 0) + 1;
      return acc;
    }, {});

    res.json({
      total: allLogs.length,
      by_level: {
        error: errorLogs.length,
        warn:  warnLogs.length,
        info:  infoLogs.length,
      },
      by_service: byService,
      recent: allLogs.slice(0, 10),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'dashboard' }));

app.listen(PORT, () => console.log(`[Dashboard] Running on port ${PORT}`));
