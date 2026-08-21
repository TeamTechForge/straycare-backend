import { Router } from "express";
import {
    getAllPosts,
    getPostById,
    createPost,
    updatePost,
    deletePost,
    getMyPosts,
    toggleLikePost
} from "../controllers/adoptionController";
// @ts-ignore - Tells TypeScript to bypass checking this mixed-syntax export
import authMiddleware from "../middleware/authMiddleware";

const router = Router();

// Read-only discovery endpoints remain public.
router.get("/", getAllPosts);
// Register fixed paths before /:postId so "my" is not interpreted as an ID.
router.get("/my", authMiddleware, getMyPosts);
router.get("/:postId", getPostById);
// Mutations require a verified user; ownership is enforced in the controller.
router.post("/", authMiddleware, createPost);
router.post("/:postId/like", authMiddleware, toggleLikePost);
router.put("/:postId", authMiddleware, updatePost);
router.delete("/:postId", authMiddleware, deletePost);

module.exports = router;  
