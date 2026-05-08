const express = require('express');
const axios = require('axios');
const path = require('path');
const cors = require('cors');

const app = express();
const YOCO_KEY = "Bearer yoco_live_0c1bf7dac43d7097_94c0f0cfb7599fe8b587af91d98bdffa";
const PORT = process.env.PORT || 15000;

app.use(cors());
app.use(express.static(path.join(__dirname)));

/**
 * CORE LOGIC: Fetches TODAY'S total from Yoco
 */
async function getTodayTotal() {
    try {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

        const response = await axios.get('https://api.yoco.com/v1/payments/', {
            headers: { 'Authorization': YOCO_KEY }
        });

        if (response.data && response.data.data) {
            return response.data.data
                .filter(tx => tx.status === "approved" && tx.created_at >= startOfToday)
                .reduce((sum, tx) => sum + (tx.total_amount.amount / 100), 0);
        }
        return 0;
    } catch (err) {
        console.error("Yoco Fetch Error:", err.message);
        return null; // Return null to indicate a failure
    }
}

/**
 * ENDPOINT: The browser calls this every 30 seconds
 */
app.get('/api/total', async (req, res) => {
    const freshTotal = await getTodayTotal();
    if (freshTotal !== null) {
        res.json({ total: freshTotal });
    } else {
        res.status(500).json({ error: "Could not fetch from Yoco" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}. Webhook-free mode active.`);
});
