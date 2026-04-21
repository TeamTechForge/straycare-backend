// src/routes/forumRoutes.js
const express = require("express");
const router = express.Router();
const forumController = require("../controllers/forumController");

// List all posts
router.get("/posts", forumController.listPosts);

// Create a post
router.post("/posts", forumController.createPost);

// Like / unlike a post
router.patch("/posts/:postId/like", forumController.togglePostLike);

// Get thread for a rescue
router.get("/:rescueId", forumController.getThread);

// Add comment
router.post("/:rescueId/comment", forumController.addComment);

module.exports = router;
