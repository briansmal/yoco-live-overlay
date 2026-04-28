// =========================
// server.js (with SSE for real-time push)
// =========================
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
let total = 0;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// Store connected clients (for live updates)
let clients = [];

app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  res.write(`data: ${JSON.stringify({ total })}\n\n`);

  clients.push(res);

  req.on('close', () => {
    clients = clients.filter(c => c !== res);
  });
});

function broadcast() {
  const data = `data: ${JSON.stringify({ total })}\n\n`;
  clients.forEach(c => c.write(data));
}

// Webhook endpoint
app.post('/webhook', (req, res) => {
  try {
    const payment = req.body;

    if (payment?.data?.amount) {
      total += payment.data.amount / 100;
      console.log('Payment received:', payment.data.amount);
      broadcast();
    }

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));