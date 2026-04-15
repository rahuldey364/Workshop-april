# Auth Service

## Endpoints

### POST /login
- Accepts: `{ "username": string, "password": string }`
- Returns: `{ token: string }` (JWT, 1-hour expiry, payload: `{ username, role }`)
- On invalid credentials: 401 with `{ error: "Invalid credentials" }`

### POST /verify
- Accepts: `{ "token": string }`
- Returns: `{ valid: true, payload }` or `{ valid: false }`

## Users
- Hardcoded:
  - admin / adminpass (role: admin)
  - viewer / viewerpass (role: viewer)

## JWT
- Signed with secret from `JWT_SECRET` environment variable

## Usage

```
npm install
JWT_SECRET=your_secret npm start
```
