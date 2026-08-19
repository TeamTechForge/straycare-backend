import type { Request, Response, NextFunction } from "express";

const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (req.user?.role !== "admin") {
    res.status(403).json({ message: "Administrator access required." });
    return;
  }
  next();
};

module.exports = requireAdmin;
export { requireAdmin };
