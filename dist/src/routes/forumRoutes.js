"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const router = express.Router();
const forumController = require("../controllers/forumController");
const { verifyToken } = require("../middleware/authMiddleware");
// List all posts
router.get("/", forumController.listPosts);
router.get("/posts", forumController.listPosts);
// Create a post
router.post("/", verifyToken, forumController.createPost);
router.post("/posts", verifyToken, forumController.createPost);
// Like or unlike a post — must be defined BEFORE /:rescueId so it doesn't get confused
router.post("/:postId/like", forumController.togglePostLike);
router.patch("/:postId/like", forumController.togglePostLike); // some apps use PATCH for updates
// Add a comment to a post's discussion thread
router.post("/:rescueId/comment", forumController.addComment);
// Get a specific post's discussion thread with all comments
// This is last because /:rescueId is a "catch-all" for any ID
router.get("/:rescueId", forumController.getThread);
module.exports = router;
//# sourceMappingURL=forumRoutes.js.map