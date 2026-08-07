import type { Request, Response, NextFunction } from "express";

interface AppError extends Error {
  statusCode?: number;
  status?: string;
}

const errorHandler = (err: AppError, req: Request, res: Response, next: NextFunction): void => {
  console.error(err.stack);
  
  const statusCode = err.statusCode || 500;
  const status = err.status || "error";
  
  res.status(statusCode).json({
    status,
    message: err.message || "Something went wrong",
  });
};

module.exports = errorHandler;
