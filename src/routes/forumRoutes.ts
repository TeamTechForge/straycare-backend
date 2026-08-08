

const express = require("express");
const router = express.Router();
const forumController = require("../controllers/forumController");

const { verifyToken, optionalToken } = require("../middleware/authMiddleware");

// List all posts
router.get("/", optionalToken, forumController.listPosts);
router.get("/posts", optionalToken, forumController.listPosts);

// Create a post
router.post("/", optionalToken, forumController.createPost);
router.post("/posts", optionalToken, forumController.createPost);


// Like or unlike a post — must be defined BEFORE /:rescueId so it doesn't get confused
router.post("/:postId/like", verifyToken, forumController.togglePostLike);
router.patch("/:postId/like", verifyToken, forumController.togglePostLike); // some apps use PATCH for updates

// Delete a post
router.delete("/:postId", optionalToken, forumController.deletePost);

// Add a comment to a post's discussion thread
router.post("/:rescueId/comment", forumController.addComment);

// Get a specific post's discussion thread with all comments
// This is last because /:rescueId is a "catch-all" for any ID
router.get("/:rescueId", forumController.getThread);

module.exports = router;
