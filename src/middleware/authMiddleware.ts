// This middleware checks if a request has a valid login token (JWT).
// It is used on any route that requires the user to be logged in.
// If the token is valid, it adds `req.user = { id, role }` and lets the request continue.
// If no token is found or it's invalid, it returns 401 Unauthorized.

const jwt = require("jsonwebtoken");
import type { Request, Response, NextFunction } from "express";

interface JwtPayload {
  id: string;
  role: string;
}

const verifyToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ message: "Access denied. No token provided." });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid or expired token" });
    return;
  }
};

// Support both `require("...middleware")` (returns verifyToken directly)
// and `const { verifyToken } = require("...middleware")` (destructured import)
module.exports = verifyToken;
module.exports.verifyToken = verifyToken;
