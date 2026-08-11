"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyPosts = exports.deletePost = exports.updatePost = exports.createPost = exports.getPostById = exports.getAllPosts = void 0;
const AdoptionPost_1 = __importDefault(require("../models/AdoptionPost"));
// GET /api/posts
const getAllPosts = async (_req, res) => {
    try {
        const posts = await AdoptionPost_1.default.find().sort({ createdAt: -1 }).populate("userId", "name phone avatar organisation");
        res.json(posts);
    }
    catch (error) {
        res.status(500).json({ error: "Server error" });
    }
};
exports.getAllPosts = getAllPosts;
// GET /api/posts/:postId
const getPostById = async (req, res) => {
    try {
        const post = await AdoptionPost_1.default.findById(req.params.postId).populate("userId", "name phone avatar organisation");
        if (!post) {
            res.status(404).json({ error: "Post not found" });
            return;
        }
        res.json(post);
    }
    catch (error) {
        res.status(500).json({ error: "Server error" });
    }
};
exports.getPostById = getPostById;
// POST /api/posts
const createPost = async (req, res) => {
    try {
        const typeofReq = req; // Cast to 'any' to cleanly read their req.user.id structure
        const post = await AdoptionPost_1.default.create({ ...req.body, userId: typeofReq.user.id });
        res.status(201).json(post);
    }
    catch (err) {
        res.status(400).json({ error: "Invalid data", details: err });
    }
};
exports.createPost = createPost;
// PUT /api/posts/:postId
const updatePost = async (req, res) => {
    try {
        const typeofReq = req;
        const post = await AdoptionPost_1.default.findById(req.params.postId);
        if (!post) {
            res.status(404).json({ error: "Post not found" });
            return;
        }
        if (post.userId.toString() !== typeofReq.user.id) {
            res.status(403).json({ error: "Not authorised" });
            return;
        }
        delete req.body.userId;
        const updated = await AdoptionPost_1.default.findByIdAndUpdate(req.params.postId, req.body, { new: true, runValidators: true });
        res.json(updated);
    }
    catch (error) {
        res.status(500).json({ error: "Server error" });
    }
};
exports.updatePost = updatePost;
// DELETE /api/posts/:postId
const deletePost = async (req, res) => {
    try {
        const typeofReq = req;
        const post = await AdoptionPost_1.default.findById(req.params.postId);
        if (!post) {
            res.status(404).json({ error: "Post not found" });
            return;
        }
        const isOwner = post.userId.toString() === typeofReq.user.id;
        const isAdmin = typeofReq.user.role === "admin";
        if (!isOwner && !isAdmin) {
            res.status(403).json({ error: "Not authorised" });
            return;
        }
        await post.deleteOne();
        res.json({ message: "Post deleted" });
    }
    catch (error) {
        res.status(500).json({ error: "Server error" });
    }
};
exports.deletePost = deletePost;
// GET /api/posts/my
const getMyPosts = async (req, res) => {
    try {
        const typeofReq = req;
        const posts = await AdoptionPost_1.default.find({ userId: typeofReq.user.id }).sort({ createdAt: -1 });
        res.json(posts);
    }
    catch (error) {
        res.status(500).json({ error: "Server error" });
    }
};
exports.getMyPosts = getMyPosts;
//# sourceMappingURL=adoptionController.js.map