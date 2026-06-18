

const express = require("express");
const router = express.Router();
const forumController = require("../controllers/forumController");

// Get all forum posts (newest first)
router.get("/", forumController.listPosts);

// Create a new forum post
router.post("/", forumController.createPost);

// Like or unlike a post — must be defined BEFORE /:rescueId so it doesn't get confused
router.post("/:postId/like", forumController.togglePostLike);
router.patch("/:postId/like", forumController.togglePostLike); // some apps use PATCH for updates

// Add a comment to a post's discussion thread
router.post("/:rescueId/comment", forumController.addComment);

// Get a specific post's discussion thread with all comments
// This is last because /:rescueId is a "catch-all" for any ID
router.get("/:rescueId", forumController.getThread);

module.exports = router;
