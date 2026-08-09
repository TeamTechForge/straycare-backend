import { Request, Response } from "express";
import Post from "../models/AdoptionPost"; 

// GET /api/posts
export const getAllPosts = async (_req: Request, res: Response): Promise<void> => {
try {
const posts = await Post.find().sort({ createdAt: -1 }).populate("userId", "name phone avatar organisation");
res.json(posts);
} catch (error) {
res.status(500).json({ error: "Server error" });
}
};

// GET /api/posts/:postId
export const getPostById = async (req: Request, res: Response): Promise<void> => {
try {
const post = await Post.findById(req.params.postId).populate("userId", "name phone avatar organisation");
if (!post) { res.status(404).json({ error: "Post not found" }); return; }
res.json(post);
} catch (error) {
res.status(500).json({ error: "Server error" });
}
};

// POST /api/posts
export const createPost = async (req: Request, res: Response): Promise<void> => {
try {
const typeofReq = req as any; // Cast to 'any' to cleanly read their req.user.id structure
const post = await Post.create({ ...req.body, userId: typeofReq.user.id });
res.status(201).json(post);
} catch (err) { res.status(400).json({ error: "Invalid data", details: err }); }
}; 

// PUT /api/posts/:postId
export const updatePost = async (req: Request, res: Response): Promise<void> => {
try {
const typeofReq = req as any;
const post = await Post.findById(req.params.postId);
if (!post) { res.status(404).json({ error: "Post not found" }); return; }
if (post.userId.toString() !== typeofReq.user.id) { res.status(403).json({ error: "Not authorised" }); return; }
delete req.body.userId;
const updated = await Post.findByIdAndUpdate(req.params.postId, req.body, { new: true, runValidators: true });
res.json(updated);
} catch (error) {
res.status(500).json({ error: "Server error" });
}
};

// DELETE /api/posts/:postId
export const deletePost = async (req: Request, res: Response): Promise<void> => {
try {
const typeofReq = req as any;
const post = await Post.findById(req.params.postId);
if (!post) { res.status(404).json({ error: "Post not found" }); return; }
const isOwner = post.userId.toString() === typeofReq.user.id;
const isAdmin = typeofReq.user.role === "admin";
if (!isOwner && !isAdmin) { res.status(403).json({ error: "Not authorised" }); return; }
await post.deleteOne();
res.json({ message: "Post deleted" });
} catch (error) {
res.status(500).json({ error: "Server error" });
}
}; 

// GET /api/posts/my
export const getMyPosts = async (req: Request, res: Response): Promise<void> => {
try {
const typeofReq = req as any;
const posts = await Post.find({ userId: typeofReq.user.id }).sort({ createdAt: -1 });
res.json(posts);
} catch (error) {
res.status(500).json({ error: "Server error" });
}
};