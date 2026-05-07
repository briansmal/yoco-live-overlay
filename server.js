const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const axios = require('axios');
const cors = require('cors');

const app = express();

// --- CONFIGURATION ---
// Ensure this is your Live Secret Key
const YOCO_KEY = "Bearer yoco_live_0c1bf7dac43d7097_94c0f0cfb7599fe8b587af91d98bdffa";
const PORT = process.env.PORT || 3000;

let total = 0;
let clients = [];

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

/**
 * 1. INITIAL LOAD (Filtered for TODAY only)
 * Fetches payments where 'created_at' is >= Today at 00:00:00 SAST
 */
async function fetchHistory() {
  try {
    console.log("Checking Yoco for payments received TODAY...");

    // Get today's date at 00:00:00 in South African Time
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const response = await axios.get('https://api.yoco.com/v1/payments/', {
      headers: { 'Authorization': YOCO_KEY }
    });

    if (response.data && response.data.data) {
      // Filter for payments that are 'approved' AND happened after midnight today
      const dailyTotal = response.data.data
        .filter(tx => {
          return tx.status === "approved" && tx.created_at >= startOfToday;
        })
        .reduce((sum, tx) => sum + (tx.total_amount.amount / 100), 0);
      
      total = dailyTotal;
      console.log(`Success! Today's starting total: R${total.toFixed(2)}`);
      broadcast(); 
    }
  } catch (err) {
    console.error("Error fetching history:", err.message);
  }
}

/**
 * 2. LIVE UPDATES (SSE)
 */
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.write(`data: ${JSON.stringify({ total })}\n\n`);
  clients.push(res);
  req.on('close', () => { clients = clients.filter(c => c !== res); });
});

function broadcast() {
  const data = `data: ${JSON.stringify({ total })}\n\n`;
  clients.forEach(c => c.write(data));
}

/**
 * 3. WEBHOOK (Capture live payments)
 */
app.post('/webhook', (req, res) => {
  try {
    const payment = req.body;
    
    // Yoco Webhooks send 'payment.succeeded' events
    // We check if the payload status is 'approved'
    if (payment && payment.payload && payment.payload.status === "approved") {
      const amount = payment.payload.total_amount.amount / 100;
      total += amount;
      console.log(`Live Payment Added: R${amount}. New Total: R${total}`);
      broadcast();
    }
    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook processing error:", err.message);
    res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  fetchHistory(); 
});
