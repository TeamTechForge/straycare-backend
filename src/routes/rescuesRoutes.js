const express = require("express");

const {
  listPendingRescues,
  listCompletedRescues,
  listAllRescues,
  listUserRescues,
  getRescueById,
} = require("../controllers/rescueController");

const {
  getComments,
  addComment,
  addReply,
} = require("../controllers/commentController");

const router = express.Router();

router.get("/pending", listPendingRescues);
router.get("/completed", listCompletedRescues);
router.get("/all", listAllRescues);
router.get("/my-rescues", listUserRescues);
router.get("/user/:userId", listUserRescues);

// ── Comment endpoints (must come before the generic /:id route) ──
router.get("/:id/comments", getComments);
router.post("/:id/comments", addComment);
router.post("/:id/comments/:commentId/reply", addReply);

router.get("/:id", getRescueById);

module.exports = router;