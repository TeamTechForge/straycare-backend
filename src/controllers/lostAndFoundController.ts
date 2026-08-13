import { Request, Response } from "express";
import mongoose from "mongoose";
import LostFoundPost, { ILostFoundPost } from "../models/LostFoundPost";

const { uploadFileToCloudinary } = require("../utils/cloudinaryUpload");

// ─── Interfaces ───────────────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  file?: Express.Multer.File;
  files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
}

export interface GetPostsFilterOptions {
  status?: string;
  type?: string;
  search?: string;
  userId?: string;
  ids?: string[];
}

// ─── Data Access / Service Layer (OOP) ────────────────────────────────────────
export class LostFoundService {
  /**
   * Find all posts matching optional filters (status, type, search, userId, specific IDs).
   */
  static async getPosts(filterOptions: GetPostsFilterOptions): Promise<ILostFoundPost[]> {
    const query: Record<string, any> = {};

    if (filterOptions.status && ["lost", "found"].includes(filterOptions.status)) {
      query.status = filterOptions.status;
    }

    if (filterOptions.type && ["dog", "cat", "other"].includes(filterOptions.type)) {
      query.type = filterOptions.type;
    }

    if (filterOptions.userId && mongoose.Types.ObjectId.isValid(filterOptions.userId)) {
      query.userId = filterOptions.userId;
    }

    if (filterOptions.ids && filterOptions.ids.length > 0) {
      const validIds = filterOptions.ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
      if (validIds.length > 0) {
        query._id = { $in: validIds };
      }
    }

    if (filterOptions.search && filterOptions.search.trim() !== "") {
      const searchRegex = new RegExp(filterOptions.search.trim(), "i");
      query.$or = [
        { name: searchRegex },
        { breed: searchRegex },
        { description: searchRegex },
        { location: searchRegex },
        { customType: searchRegex },
      ];
    }

    return LostFoundPost.find(query)
      .populate("userId", "name phone avatar email")
      .sort({ createdAt: -1 });
  }

  /**
   * Find a single post by ID.
   */
  static async getPostById(id: string): Promise<ILostFoundPost | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    return LostFoundPost.findById(id).populate("userId", "name phone avatar email");
  }

  /**
   * Create a new lost/found animal post.
   */
  static async createPost(userId: string, data: Partial<ILostFoundPost>): Promise<ILostFoundPost> {
    const postData = {
      ...data,
      userId,
    };

    // Synchronize imageUrl and images array
    if (!postData.images && postData.imageUrl) {
      postData.images = [postData.imageUrl];
    } else if (postData.images && postData.images.length > 0 && !postData.imageUrl) {
      postData.imageUrl = postData.images[0];
    }

    const post = new LostFoundPost(postData);
    const savedPost = await post.save();
    return savedPost.populate("userId", "name phone avatar email");
  }

  /**
   * Update an existing post after validating user authorization.
   */
  static async updatePost(
    id: string,
    user: AuthUser,
    updateData: Partial<ILostFoundPost>
  ): Promise<{ post: ILostFoundPost | null; status: "NOT_FOUND" | "UNAUTHORIZED" | "SUCCESS" }> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return { post: null, status: "NOT_FOUND" };
    }

    const post = await LostFoundPost.findById(id);
    if (!post) {
      return { post: null, status: "NOT_FOUND" };
    }

    // Safely extract owner ID string whether post.userId is ObjectId or populated object
    const ownerId = (post.userId as any)?._id
      ? (post.userId as any)._id.toString()
      : post.userId
      ? post.userId.toString()
      : null;

    const isOwner = ownerId === user.id;
    const isAdmin = user.role === "admin";

    if (!isOwner && !isAdmin) {
      return { post: null, status: "UNAUTHORIZED" };
    }

    // Synchronize imageUrl and images array on update
    if (updateData.images && updateData.images.length > 0 && !updateData.imageUrl) {
      updateData.imageUrl = updateData.images[0];
    } else if (updateData.imageUrl && (!updateData.images || updateData.images.length === 0)) {
      updateData.images = [updateData.imageUrl];
    }

    Object.assign(post, updateData);
    await post.save();
    await post.populate("userId", "name phone avatar email");

    return { post, status: "SUCCESS" };
  }

  /**
   * Delete a post after validating user authorization.
   */
  static async deletePost(
    id: string,
    user: AuthUser
  ): Promise<"NOT_FOUND" | "UNAUTHORIZED" | "SUCCESS"> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return "NOT_FOUND";
    }

    const post = await LostFoundPost.findById(id);
    if (!post) {
      return "NOT_FOUND";
    }

    const ownerId = (post.userId as any)?._id
      ? (post.userId as any)._id.toString()
      : post.userId
      ? post.userId.toString()
      : null;

    const isOwner = ownerId === user.id;
    const isAdmin = user.role === "admin";

    if (!isOwner && !isAdmin) {
      return "UNAUTHORIZED";
    }

    await post.deleteOne();
    return "SUCCESS";
  }

  /**
   * Increment report count for a post.
   */
  static async reportPost(id: string): Promise<ILostFoundPost | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }

    const post = await LostFoundPost.findById(id);
    if (!post) return null;

    post.reportCount = (post.reportCount || 0) + 1;
    await post.save();
    return post.populate("userId", "name phone avatar email");
  }
}

// ─── Helper Functions ─────────────────────────────────────────────────────────
const requireAuth = (req: AuthenticatedRequest, res: Response): AuthUser | null => {
  if (!req.user || !req.user.id) {
    res.status(401).json({ message: "User authentication required" });
    return null;
  }
  return req.user;
};

/**
  Uploads file(s) attached to request via Multer (req.file or req.files) or extracts URLs from payload.
 */
const processUploadedImages = async (
  req: AuthenticatedRequest
): Promise<{ imageUrl?: string; images?: string[] }> => {
  const uploadedUrls: string[] = [];

  if (req.file) {
    const url = await uploadFileToCloudinary(req.file);
    if (url) uploadedUrls.push(url);
  }

  if (req.files) {
    const fileArray: Express.Multer.File[] = Array.isArray(req.files)
      ? req.files
      : Object.values(req.files).flat();

    for (const file of fileArray) {
      const url = await uploadFileToCloudinary(file);
      if (url) uploadedUrls.push(url);
    }
  }

  // Handle explicit image URLs passed in body JSON/form
  if (Array.isArray(req.body.images) && req.body.images.length > 0) {
    req.body.images.forEach((img: string) => {
      if (typeof img === "string" && img.trim() !== "" && !uploadedUrls.includes(img)) {
        uploadedUrls.push(img);
      }
    });
  } else if (typeof req.body.imageUrl === "string" && req.body.imageUrl.trim() !== "") {
    if (!uploadedUrls.includes(req.body.imageUrl)) {
      uploadedUrls.push(req.body.imageUrl);
    }
  }

  const primaryUrl = uploadedUrls.length > 0 ? uploadedUrls[0] : req.body.imageUrl;

  return {
    imageUrl: primaryUrl,
    images: uploadedUrls.length > 0 ? uploadedUrls : undefined,
  };
};

// ─── Controller Handlers ──────────────────────────────────────────────────────

/**
 * GET /api/animals
 * Fetch all posts, optionally filtered by ?status=lost|found, ?type=dog|cat|other, ?search=query, ?userId=id, ?ids=id1,id2
 */
export const getAnimalPosts = async (req: Request, res: Response): Promise<void> => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
    const idsParam = typeof req.query.ids === "string" ? req.query.ids : undefined;
    const idArray = idsParam ? idsParam.split(",") : undefined;

    const posts = await LostFoundService.getPosts({ status, type, search, userId, ids: idArray });
    res.status(200).json(posts);
  } catch (error: any) {
    console.error("[getAnimalPosts error]:", error);
    res.status(500).json({ message: error.message || "Failed to retrieve posts" });
  }
};

/**
 * GET /api/animals/user/:userId
 * Fetch posts created by a specific user
 */
export const getAnimalPostsByUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.params.userId as string;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({ message: "Invalid user ID format" });
      return;
    }

    const posts = await LostFoundService.getPosts({ userId });
    res.status(200).json(posts);
  } catch (error: any) {
    console.error("[getAnimalPostsByUser error]:", error);
    res.status(500).json({ message: error.message || "Failed to retrieve user posts" });
  }
};

/**
 * GET /api/animals/:id
 * Fetch single post by ID
 */
export const getAnimalPostById = async (req: Request, res: Response): Promise<void> => {
  try {
    const postId = req.params.id as string;
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      res.status(400).json({ message: "Invalid post ID format" });
      return;
    }

    const post = await LostFoundService.getPostById(postId);
    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }
    res.status(200).json(post);
  } catch (error: any) {
    console.error("[getAnimalPostById error]:", error);
    res.status(500).json({ message: error.message || "Failed to retrieve post" });
  }
};

/**
 * POST /api/animals
 * Create new post with image handling and strict input validation
 */
export const createAnimalPost = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = requireAuth(req, res);
    if (!user) return;

    if (!req.body || Object.keys(req.body).length === 0) {
      res.status(400).json({ message: "No data received from client" });
      return;
    }

    const {
      status = "lost",
      type = "dog",
      customType,
      breed,
      name,
      description,
      location,
      date,
      contactName,
      contactNumber,
    } = req.body;

    // Validation checks
    if (!status || !["lost", "found"].includes(status)) {
      res.status(400).json({ message: "Status must be either 'lost' or 'found'" });
      return;
    }

    if (type && !["dog", "cat", "other"].includes(type)) {
      res.status(400).json({ message: "Type must be 'dog', 'cat', or 'other'" });
      return;
    }

    if (!description || typeof description !== "string" || description.trim() === "") {
      res.status(400).json({ message: "Description is required" });
      return;
    }

    if (!location || typeof location !== "string" || location.trim() === "") {
      res.status(400).json({ message: "Location is required" });
      return;
    }

    // Process image uploads
    const { imageUrl, images } = await processUploadedImages(req);

    const newPost = await LostFoundService.createPost(user.id, {
      status,
      type,
      customType: customType ? String(customType).trim() : undefined,
      breed: breed ? String(breed).trim() : undefined,
      name: name ? String(name).trim() : undefined,
      description: description.trim(),
      location: location.trim(),
      date: date ? String(date).trim() : undefined,
      contactName: contactName ? String(contactName).trim() : undefined,
      contactNumber: contactNumber ? String(contactNumber).trim() : undefined,
      imageUrl,
      images,
    });

    const postObj = newPost.toObject();
    res.status(201).json({
      message: "Post created successfully",
      data: newPost,
      ...postObj,
    });
  } catch (error: any) {
    console.error("[createAnimalPost error]:", error);
    res.status(500).json({ message: error.message || "Failed to create post" });
  }
};

/**
 * PUT /api/animals/:id
 * Update an existing post
 */
export const updateAnimalPost = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = requireAuth(req, res);
    if (!user) return;

    const postId = req.params.id as string;
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      res.status(400).json({ message: "Invalid post ID format" });
      return;
    }

    // Validation checks on update parameters if present
    if (req.body.status && !["lost", "found"].includes(req.body.status)) {
      res.status(400).json({ message: "Status must be either 'lost' or 'found'" });
      return;
    }

    if (req.body.type && !["dog", "cat", "other"].includes(req.body.type)) {
      res.status(400).json({ message: "Type must be 'dog', 'cat', or 'other'" });
      return;
    }

    if (req.body.description !== undefined && (typeof req.body.description !== "string" || req.body.description.trim() === "")) {
      res.status(400).json({ message: "Description cannot be empty" });
      return;
    }

    if (req.body.location !== undefined && (typeof req.body.location !== "string" || req.body.location.trim() === "")) {
      res.status(400).json({ message: "Location cannot be empty" });
      return;
    }

    const updateData: Partial<ILostFoundPost> = {};
    const allowedFields = [
      "status",
      "type",
      "customType",
      "breed",
      "name",
      "description",
      "location",
      "date",
      "contactName",
      "contactNumber",
    ] as const;

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        (updateData as any)[field] = typeof req.body[field] === "string" ? req.body[field].trim() : req.body[field];
      }
    });

    // Image handling for update
    if (req.body.removeImage === "true" || req.body.removeImage === true) {
      updateData.imageUrl = "";
      updateData.images = [];
    } else {
      const { imageUrl, images } = await processUploadedImages(req);
      if (imageUrl !== undefined) {
        updateData.imageUrl = imageUrl;
      }
      if (images !== undefined) {
        updateData.images = images;
      }
    }

    const result = await LostFoundService.updatePost(postId, user, updateData);

    if (result.status === "NOT_FOUND") {
      res.status(404).json({ message: "Post not found" });
      return;
    }
    if (result.status === "UNAUTHORIZED") {
      res.status(403).json({ message: "Not authorised to update this post" });
      return;
    }

    const updatedObj = result.post ? result.post.toObject() : {};
    res.status(200).json({
      message: "Post updated successfully",
      data: result.post,
      ...updatedObj,
    });
  } catch (error: any) {
    console.error("[updateAnimalPost error]:", error);
    res.status(500).json({ message: error.message || "Failed to update post" });
  }
};

/**
 * DELETE /api/animals/:id
 * Delete a post
 */
export const deleteAnimalPost = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = requireAuth(req, res);
    if (!user) return;

    const postId = req.params.id as string;
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      res.status(400).json({ message: "Invalid post ID format" });
      return;
    }

    const result = await LostFoundService.deletePost(postId, user);

    if (result === "NOT_FOUND") {
      res.status(404).json({ message: "Post not found" });
      return;
    }
    if (result === "UNAUTHORIZED") {
      res.status(403).json({ message: "Not authorised to delete this post" });
      return;
    }

    res.status(200).json({ message: "Post deleted successfully" });
  } catch (error: any) {
    console.error("[deleteAnimalPost error]:", error);
    res.status(500).json({ message: error.message || "Failed to delete post" });
  }
};

/**
 * POST /api/animals/:id/report
 * Report a post
 */
export const reportAnimalPost = async (req: Request, res: Response): Promise<void> => {
  try {
    const postId = req.params.id as string;
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      res.status(400).json({ message: "Invalid post ID format" });
      return;
    }

    const post = await LostFoundService.reportPost(postId);
    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    res.status(200).json({
      message: "Post reported successfully",
      reportCount: post.reportCount,
      data: post,
    });
  } catch (error: any) {
    console.error("[reportAnimalPost error]:", error);
    res.status(500).json({ message: error.message || "Failed to report post" });
  }
};

// ─── Legacy / Compatibility Exports ──────────────────────────────────────────
export const getLostAnimals = async (req: Request, res: Response): Promise<void> => {
  req.query.status = "lost";
  return getAnimalPosts(req, res);
};

export const createLostAnimal = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  req.body.status = "lost";
  return createAnimalPost(req, res);
};

export const getFoundAnimals = async (req: Request, res: Response): Promise<void> => {
  req.query.status = "found";
  return getAnimalPosts(req, res);
};

export const createFoundAnimal = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  req.body.status = "found";
  return createAnimalPost(req, res);
};