import { catchAsync } from "../utils/catchAsync";
import type { NextFunction } from "express";
// commentController.ts
// Handles all comment-related API logic for rescue cases.
// Supports: listing threaded comments, adding comments, and replying.

const RescueComment = require("../models/RescueComment");

import type { Request, Response } from "express";

/**
 * GET /api/rescues/:id/comments
 * Returns all comments for a rescue, threaded:
 *   - Top-level comments (parentCommentId === null)
 *   - Each top-level comment has a `replies` array of child comments
 */
exports.getComments = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;
    console.log(`[COMMENTS] Fetching comments for rescue: ${id}`);

    // Fetch all comments for this rescue, oldest first
    const allComments = await RescueComment.find({ rescueRequestId: id }).sort({
      createdAt: 1,
    });

    // Separate top-level and replies
    const topLevel: any[] = [];
    const replyMap: Record<string, any[]> = {}; // parentId -> [replies]

    for (const comment of allComments) {
      const obj = comment.toObject();
      obj.replies = [];

      if (!obj.parentCommentId) {
        topLevel.push(obj);
      } else {
        const parentId = String(obj.parentCommentId);
        if (!replyMap[parentId]) replyMap[parentId] = [];
        replyMap[parentId].push(obj);
      }
    }

    // Attach replies to their parent comment
    for (const parent of topLevel) {
      const parentId = String(parent._id);
      parent.replies = replyMap[parentId] || [];
    }

    console.log(
      `[COMMENTS] Found ${topLevel.length} top-level comments, ${allComments.length} total`
    );
    res.json(topLevel);
  });;

/**
 * POST /api/rescues/:id/comments
 * Creates a new top-level comment for a rescue case.
 * Body: { text, userId?, userName?, userAvatar? }
 */
exports.addComment = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const { text, userId, userName, userAvatar } = req.body;

    if (!text || !text.trim()) {
      res.status(400).json({ error: "Comment text is required" });
      return;
    }

    console.log(`[COMMENTS] Adding comment to rescue: ${id}`);

    const comment = await RescueComment.create({
      rescueRequestId: id,
      userId: userId || "guest-user",
      userName: userName || "You",
      userAvatar: userAvatar || "",
      text: text.trim(),
      parentCommentId: null,
    });

    const result = comment.toObject();
    result.replies = [];

    console.log(`[COMMENTS] Created comment ${result._id}`);
    res.status(201).json(result);
  });;

/**
 * POST /api/rescues/:id/comments/:commentId/reply
 * Creates a reply to an existing comment.
 * Body: { text, userId?, userName?, userAvatar? }
 */
exports.addReply = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id, commentId } = req.params;
    const { text, userId, userName, userAvatar } = req.body;

    if (!text || !text.trim()) {
      res.status(400).json({ error: "Reply text is required" });
      return;
    }

    // Verify parent comment exists
    const parentComment = await RescueComment.findById(commentId);
    if (!parentComment) {
      res.status(404).json({ error: "Parent comment not found" });
      return;
    }

    console.log(
      `[COMMENTS] Adding reply to comment ${commentId} on rescue: ${id}`
    );

    const reply = await RescueComment.create({
      rescueRequestId: id,
      userId: userId || "guest-user",
      userName: userName || "You",
      userAvatar: userAvatar || "",
      text: text.trim(),
      parentCommentId: commentId,
    });

    console.log(`[COMMENTS] Created reply ${reply._id}`);
    res.status(201).json(reply.toObject());
  });;
