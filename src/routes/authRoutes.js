// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();

// Placeholder route to stop the crash
router.get('/', (req, res) => {
    res.send('Auth route working');
});

// IMPORTANT: This line was likely missing or broken!
module.exports = router;