# Workshop: Distributed Log Aggregation System

## Quick Start

```bash
docker-compose up --build
```

That's it. All 7 services will start automatically.

---

## Services & Ports

| Service         | Port  | Description                          |
|----------------|-------|--------------------------------------|
| RabbitMQ        | 5672  | Message broker                       |
| RabbitMQ UI     | 15672 | Management dashboard (guest/guest)   |
| service-a       | 3001  | Producer — auth service simulation   |
| service-b       | 3002  | Producer — orders service simulation |
| consumer-error  | 4001  | Subscribes to logs.error             |
| consumer-warn   | 4002  | Subscribes to logs.warn              |
| consumer-info   | 4003  | Subscribes to logs.info              |
| dashboard       | 5000  | Aggregated stats                     |

---

## Test It

```bash
# Manually publish a log
curl -X POST http://localhost:3001/log \
  -H "Content-Type: application/json" \
  -d '{"level": "error", "message": "Payment gateway timeout"}'

# View error consumer logs
curl http://localhost:4001/logs

# View dashboard stats
curl http://localhost:5000/stats
```

---

## RabbitMQ Management UI

Open http://localhost:15672 in your browser.
- Username: `guest`
- Password: `guest`

Navigate to **Exchanges → logs.topic** to see message rates and bindings.

---

## Tear Down

```bash
docker-compose down
```
