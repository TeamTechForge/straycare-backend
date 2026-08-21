import { Request, Response } from "express";
import AdoptionPost from "../models/AdoptionPost";

const normalizePostPayload = (body: any) => {
  const payload = { ...body };
  const hasLatitude = body.latitude !== undefined && body.latitude !== null && body.latitude !== "";
  const hasLongitude = body.longitude !== undefined && body.longitude !== null && body.longitude !== "";
  if (hasLatitude !== hasLongitude) {
    throw new Error("Latitude and longitude must be provided together");
  }
  if (hasLatitude && hasLongitude) {
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new Error("Latitude must be between -90 and 90");
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new Error("Longitude must be between -180 and 180");
    }
    payload.latitude = latitude;
    payload.longitude = longitude;
  }
  if (body.images !== undefined && !Array.isArray(body.images)) {
    throw new Error("Images must be an array");
  }
  return payload;
};

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
    const post = await AdoptionPost.create({ ...normalizePostPayload(req.body), userId: typeofReq.user.id });
    res.status(201).json(post);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || "Invalid data" });
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
    const updated = await AdoptionPost.findByIdAndUpdate(req.params.postId, normalizePostPayload(req.body), {
      new: true,
      runValidators: true,
    });
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || "Invalid data" });
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
