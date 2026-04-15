const express = require('express')
const jwt = require('jsonwebtoken')
require('dotenv').config()

const app = express()
app.use(express.json())

const users = [
  { username: 'rahul', password: 'rahulpass', role: 'admin' },
  { username: 'sohail', password: 'sohailpass', role: 'user' },
  { username: 'varsha', password: 'varshapass', role: 'superadmin' },
  { username: 'yadhu', password: 'yadhupass', role: 'viewer' },
]

const JWT_SECRET = process.env.JWT_SECRET

app.post('/login', (req, res) => {
  const { username, password } = req.body
  const user = users.find(u => u.username === username && u.password === password)
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }
  const payload = { username: user.username, role: user.role }
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' })
  res.json({ token })
})

app.post('/verify', (req, res) => {
  const { token } = req.body
  if (!token) return res.json({ valid: false })
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    res.json({ valid: true, payload })
  } catch (err) {
    res.json({ valid: false })
  }
})

const PORT = process.env.PORT || 4500
app.listen(PORT, () => {
  console.log(`Auth service running on port ${PORT}`)
})
