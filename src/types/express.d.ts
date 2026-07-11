import { Request } from "express";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
      };
      storedFiles?: Array<{ id: string; filename: string }>;
    }
  }
}

export {};
