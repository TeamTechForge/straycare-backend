// src/middleware/errorHandler.js

/**
 * Express error handling middleware.
 * Logs the full error details to the console using console.error
 * and returns a structured JSON error response to the client.
 */
const errorHandler = (err, req, res, next) => {
  // Log the full error to the console
  console.error("Unhandled Error Caught by Middleware:", err);

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || "An unexpected error occurred on the server";

  res.status(statusCode).json({
    message,
    error: process.env.NODE_ENV === "production" ? undefined : err.stack || err.message || err,
  });
};

module.exports = errorHandler;
