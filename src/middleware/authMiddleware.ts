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

  // Admins and mobile users are stored in separate collections. Check the
  // collection that matches the JWT role while preserving deleted-user token
  // invalidation for mobile accounts.
  const accountExists = decoded.role === "admin"
    ? Boolean(await require("../models/Admin").exists({ _id: decoded.id }))
    : Boolean(await require("../models/User").exists({ _id: decoded.id, isDeleted: { $ne: true } }));

  if (!accountExists) {
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
      // Mirror the account check from verifyToken for optional-auth routes.
      const accountExists = decoded.role === "admin"
        ? Boolean(await require("../models/Admin").exists({ _id: decoded.id }))
        : Boolean(await require("../models/User").exists({ _id: decoded.id, isDeleted: { $ne: true } }));

      if (accountExists) {
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
