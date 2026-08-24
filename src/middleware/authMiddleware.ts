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

const verifyToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ message: "Access denied. No token provided." });
    return;
  }

  const token = authHeader.split(" ")[1];

  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
  } catch (err) {
    res.status(401).json({ message: "Invalid or expired token" });
    return;
  }

  // Verify the user still exists and has not been anonymized/deleted.
  // This is the only mechanism that invalidates JWTs issued before account
  // anonymization without requiring a server-side token blacklist.
  const User = require("../models/User");
  const liveUser = await User.findById(decoded.id).select("isDeleted").lean();
  if (!liveUser || liveUser.isDeleted === true) {
    res.status(401).json({ message: "This account is no longer available." });
    return;
  }

  req.user = { id: decoded.id, role: decoded.role };
  next();
};

const optionalToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers["authorization"];

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
      // Mirror the deleted-account check from verifyToken so that anonymized
      // accounts cannot leak their identity through optional-auth routes.
      const User = require("../models/User");
      const liveUser = await User.findById(decoded.id).select("isDeleted").lean();
      if (liveUser && liveUser.isDeleted !== true) {
        req.user = { id: decoded.id, role: decoded.role };
      }
    } catch (err) {
      // Ignore invalid token for optional routes
    }
  }
  next();
};

// Support both `require("...middleware")` (returns verifyToken directly)
// and `const { verifyToken, optionalToken } = require("...middleware")`
module.exports = verifyToken;
module.exports.verifyToken = verifyToken;
module.exports.optionalToken = optionalToken;
