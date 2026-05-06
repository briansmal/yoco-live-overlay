const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const axios = require('axios');
const cors = require('cors');

const app = express();

// --- CONFIGURATION ---
// Replace with your actual Live Secret Key from Yoco
const YOCO_KEY = "Bearer yoco_live_0c1bf7dac43d7097_94c0f0cfb7599fe8b587af91d98bdffa";
const PORT = process.env.PORT || 3000;

let total = 0;
let clients = [];

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

/**
 * 1. INITIAL LOAD (The Bearer Token Method)
 * Fetches all past successful payments to set the starting total.
 */
async function fetchHistory() {
  try {
    console.log("Fetching historical data from Yoco...");
    const response = await axios.get('https://api.yoco.com/v1/payments/', {
      headers: { 'Authorization': YOCO_KEY }
    });

    if (response.data && response.data.data) {
      const historicalTotal = response.data.data
        .filter(tx => tx.status === "approved")
        .reduce((sum, tx) => sum + (tx.total_amount.amount / 100), 0);
      
      total = historicalTotal;
      console.log(`Success! Starting Total: R${total}`);
      broadcast(); // Push the initial total to any connected browsers
    }
  } catch (err) {
    console.error("Error fetching history:", err.message);
    if (err.response && err.response.status === 401) {
      console.error("Check your YOCO_KEY - it appears to be unauthorized.");
    }
  }
}

/**
 * 2. LIVE UPDATES (The SSE Method)
 * Keeps a connection open to your index.html to push updates instantly.
 */
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send current total immediately upon connection
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

/**
 * 3. WEBHOOK ENDPOINT (The "Push" Method)
 * This is the URL you must paste into the Yoco Portal: 
 * https://your-app-name.onrender.com/webhook
 */
app.post('/webhook', (req, res) => {
  try {
    const payment = req.body;
    console.log("Webhook received:", JSON.stringify(payment));

    // Yoco Webhook payload structure usually has payment status in payload.status
    if (payment && payment.payload && payment.payload.status === "approved") {
      const amount = payment.payload.total_amount.amount / 100;
      total += amount;
      console.log(`Live Payment Added: R${amount}. New Total: R${total}`);
      broadcast();
    }
    
    res.sendStatus(200); // Tell Yoco we got the message
  } catch (err) {
    console.error("Webhook Error:", err.message);
    res.sendStatus(500);
  }
});

// START THE SERVER
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  fetchHistory(); // Run the historical fetch once when server starts
});
