import { Request, Response } from "express";
import AdoptionPost from "../models/AdoptionPost";

const normalizePostPayload = (body: any, partial = false) => {
  const payload = { ...body };
  if (!partial || body.age !== undefined || body.ageValue !== undefined || body.ageUnit !== undefined) {
    const legacyMatch = typeof body.age === "string"
      ? body.age.trim().match(/^(\d+(?:\.\d+)?)\s*(months?|years?)$/i)
      : null;
    const ageValue = Number(body.ageValue ?? legacyMatch?.[1]);
    const rawUnit = String(body.ageUnit ?? legacyMatch?.[2] ?? "").toLowerCase();
    const ageUnit = rawUnit.startsWith("month") ? "Months" : rawUnit.startsWith("year") ? "Years" : "";
    if (!Number.isFinite(ageValue) || ageValue <= 0 || !ageUnit) {
      throw new Error("Age must be a positive number with Months or Years selected");
    }
    payload.ageValue = ageValue;
    payload.ageUnit = ageUnit;
    payload.age = `${ageValue} ${ageUnit}`;
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

    const ownerId = post.userId ? post.userId.toString() : null;
    const isOwner = ownerId && ownerId === typeofReq.user.id;
    const isAdmin = typeofReq.user?.role === "admin";
    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: "Not authorised" });
      return;
    }

    delete req.body.userId;
    const updated = await AdoptionPost.findByIdAndUpdate(req.params.postId, normalizePostPayload(req.body, true), {
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
