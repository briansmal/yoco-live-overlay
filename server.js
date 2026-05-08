const express = require('express');
const axios = require('axios');
const path = require('path');
const cors = require('cors');

const app = express();
const YOCO_KEY = "Bearer yoco_live_0c1bf7dac43d7097_94c0f0cfb7599fe8b587af91d98bdffa";
const PORT = process.env.PORT || 10000;

let cachedTotal = 0;
let lastFetchTime = 0;
const CACHE_DURATION = 45000; // 45 seconds

app.use(cors());
app.use(express.static(path.join(__dirname)));

async function getTodayTotal() {
    const now = Date.now();
    
    // If we fetched very recently, return the cached value to avoid 429
    if (now - lastFetchTime < CACHE_DURATION) {
        console.log("Returning cached total to prevent Yoco rate-limiting.");
        return cachedTotal;
    }

    try {
        const dateObj = new Date();
        const startOfToday = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()).toISOString();

        const response = await axios.get('https://api.yoco.com/v1/payments/', {
            headers: { 'Authorization': YOCO_KEY },
            timeout: 10000
        });

        if (response.data && response.data.data) {
            const total = response.data.data
                .filter(tx => tx.status === "approved" && tx.created_at >= startOfToday)
                .reduce((sum, tx) => sum + (tx.total_amount.amount / 100), 0);
            
            cachedTotal = total;
            lastFetchTime = now;
            console.log(`Fresh data from Yoco: R${total}`);
            return total;
        }
    } catch (err) {
        console.error("Yoco Error:", err.response ? err.response.status : err.message);
        return cachedTotal; // Return last known good value if Yoco blocks us
    }
    return cachedTotal;
}

app.get('/api/total', async (req, res) => {
    const total = await getTodayTotal();
    res.json({ total });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
