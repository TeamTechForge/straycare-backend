const express = require("express");
const cors = require("cors");

// --- IMPORTS ---
 const authRoutes = require('./routes/authRoutes'); // <-- Temporarily disabled
const strayRoutes = require('./routes/strayRoutes');  // <-- Your feature

const app = express();

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// --- REGISTER ROUTES ---
 app.use('/api/auth', authRoutes); // <-- Temporarily disabled


// Base Route
app.get("/", (req, res) => {
  res.send("StrayCare Backend API Running");
});

module.exports = app;