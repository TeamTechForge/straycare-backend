import { Response } from "express";
import { AuthRequest } from "../middleware/authMiddleware";
export declare const getAllPosts: (_req: AuthRequest, res: Response) => Promise<void>;
export declare const getPostById: (req: AuthRequest, res: Response) => Promise<void>;
export declare const createPost: (req: AuthRequest, res: Response) => Promise<void>;
export declare const updatePost: (req: AuthRequest, res: Response) => Promise<void>;
export declare const deletePost: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getMyPosts: (req: AuthRequest, res: Response) => Promise<void>;
//# sourceMappingURL=AdoptionController.d.ts.map