import { Request, Response } from "express";
import AdoptionPost from "../models/AdoptionPost";

// Public list responses include only the profile fields needed by adoption cards.
// GET /api/adoption
export const getAllPosts = async (_req: Request, res: Response): Promise<void> => {
  try {
    const posts = await AdoptionPost.find()
      .sort({ createdAt: -1 })
      .populate("userId", "name phone avatar organisation");
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

// GET /api/adoption/:postId
export const getPostById = async (req: Request, res: Response): Promise<void> => {
  try {
    const post = await AdoptionPost.findById(req.params.postId).populate(
      "userId",
      "name phone avatar organisation"
    );
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    res.json(post);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

// POST /api/adoption
export const createPost = async (req: Request, res: Response): Promise<void> => {
  try {
    // Authentication middleware adds `user` at runtime, but Express's base Request type does not include it.
    const typeofReq = req as any;
    if (!typeofReq.user || !typeofReq.user.id) {
      res.status(401).json({ error: "User authentication required" });
      return;
    }
    const post = await AdoptionPost.create({ ...req.body, userId: typeofReq.user.id });
    res.status(201).json(post);
  } catch (err) {
    res.status(400).json({ error: "Invalid data", details: err });
  }
};

// PUT /api/adoption/:postId
export const updatePost = async (req: Request, res: Response): Promise<void> => {
  try {
    const typeofReq = req as any;
    if (!typeofReq.user || !typeofReq.user.id) {
      res.status(401).json({ error: "User authentication required" });
      return;
    }
    const post = await AdoptionPost.findById(req.params.postId);
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    // Owners manage their own listings; administrators can moderate any listing.
    const ownerId = post.userId ? post.userId.toString() : null;
    const isOwner = ownerId && ownerId === typeofReq.user.id;
    const isAdmin = typeofReq.user?.role === "admin";
    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: "Not authorised" });
      return;
    }

    // Never allow an update payload to transfer ownership to another user.
    delete req.body.userId;
    const updated = await AdoptionPost.findByIdAndUpdate(req.params.postId, req.body, {
      new: true,
      runValidators: true,
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

// DELETE /api/adoption/:postId
export const deletePost = async (req: Request, res: Response): Promise<void> => {
  try {
    const typeofReq = req as any;
    if (!typeofReq.user || !typeofReq.user.id) {
      res.status(401).json({ error: "User authentication required" });
      return;
    }
    const post = await AdoptionPost.findById(req.params.postId);
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    // Apply the same ownership policy used by updates before deleting the document.
    const ownerId = post.userId ? post.userId.toString() : null;
    const isOwner = ownerId && ownerId === typeofReq.user.id;
    const isAdmin = typeofReq.user?.role === "admin";
    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: "Not authorised" });
      return;
    }

    await post.deleteOne();
    res.json({ message: "Post deleted" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

// GET /api/adoption/my
export const getMyPosts = async (req: Request, res: Response): Promise<void> => {
  try {
    const typeofReq = req as any;
    if (!typeofReq.user || !typeofReq.user.id) {
      res.status(401).json({ error: "User authentication required" });
      return;
    }
    const posts = await AdoptionPost.find({ userId: typeofReq.user.id }).sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

// POST /api/adoption/:postId/like
export const toggleLikePost = async (req: Request, res: Response): Promise<void> => {
  try {
    const typeofReq = req as any;
    if (!typeofReq.user || !typeofReq.user.id) {
      res.status(401).json({ error: "User authentication required" });
      return;
    }
    const userId = typeofReq.user.id;
    const post = await AdoptionPost.findById(req.params.postId);
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    // Treat the endpoint as a toggle so repeated taps produce the expected UI state.
    const likesArray = post.likes || [];
    const isLiked = likesArray.some((id: any) => id.toString() === userId);

    if (isLiked) {
      post.likes = likesArray.filter((id: any) => id.toString() !== userId);
    } else {
      post.likes.push(userId as any);
    }

    await post.save();
    res.json({ liked: !isLiked, likeCount: post.likes.length });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};
