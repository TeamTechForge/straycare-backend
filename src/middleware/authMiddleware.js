// src/middleware/authMiddleware.js
// Verifies the JWT sent in the Authorization: Bearer <token> header.
// On success, attaches req.user = { id, role } so downstream controllers
// can identify the caller without trusting anything from the request body.

const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

module.exports = verifyToken;
module.exports.verifyToken = verifyToken;