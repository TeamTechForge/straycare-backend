import { Router } from "express";
import {
getAllPosts,
getPostById,
createPost,
updatePost,
deletePost,
getMyPosts
} from "../controllers/AdoptionController";  
// @ts-ignore - Tells TypeScript to bypass checking this mixed-syntax export
import authMiddleware from "../middleware/authMiddleware"; 

const router = Router(); 

router.get("/", getAllPosts);
router.get("/my", authMiddleware, getMyPosts);
router.get("/:postId", getPostById);
router.post("/", authMiddleware, createPost);
router.put("/:postId", authMiddleware, updatePost);
router.delete("/:postId", authMiddleware, deletePost); 

module.exports = router;  