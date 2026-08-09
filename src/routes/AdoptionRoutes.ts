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
import verifyToken from "../middleware/authMiddleware"; 

const router = Router(); 

router.get("/", getAllPosts);
router.get("/my", verifyToken, getMyPosts);
router.get("/:postId", getPostById);
router.post("/", verifyToken, createPost);
router.put("/:postId", verifyToken, updatePost);
router.delete("/:postId", verifyToken, deletePost); 

module.exports = router;  