"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const catchAsync_1 = require("../utils/catchAsync");
// commentController.ts
// Handles all comment-related API logic for rescue cases.
// Supports: listing threaded comments, adding comments, and replying.
const RescueComment = require("../models/RescueComment");
/**
 * GET /api/rescues/:id/comments
 * Returns all comments for a rescue, threaded:
 *   - Top-level comments (parentCommentId === null)
 *   - Each top-level comment has a `replies` array of child comments
 */
exports.getComments = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const targetId = String(req.params.id);
    console.log(`[COMMENTS] Fetching comments for rescue: ${targetId}`);
    const mongoose = require("mongoose");
    const RescueRequest = require("../models/RescueRequest");
    let matchIds = [targetId];
    try {
        const isObjId = mongoose.Types.ObjectId.isValid(targetId);
        const reqDoc = await RescueRequest.findOne({
            $or: [
                { _id: isObjId ? targetId : null },
                { caseId: targetId }
            ]
        });
        if (reqDoc) {
            if (reqDoc._id)
                matchIds.push(String(reqDoc._id));
            if (reqDoc.caseId)
                matchIds.push(reqDoc.caseId);
        }
    }
    catch (err) {
        console.error("[COMMENTS] Error matching rescue request ID:", err.message);
    }
    // Fetch all comments matching either rescueRequestId or caseId, oldest first
    const allComments = await RescueComment.find({
        $or: [
            { rescueRequestId: { $in: matchIds } },
            { caseId: { $in: matchIds } }
        ]
    }).sort({
        createdAt: 1,
    });
    // Separate top-level and replies
    const topLevel = [];
    const replyMap = {}; // parentId -> [replies]
    for (const comment of allComments) {
        const obj = comment.toObject();
        obj.replies = [];
        if (!obj.parentCommentId) {
            topLevel.push(obj);
        }
        else {
            const parentId = String(obj.parentCommentId);
            if (!replyMap[parentId])
                replyMap[parentId] = [];
            replyMap[parentId].push(obj);
        }
    }
    // Attach replies to their parent comment
    for (const parent of topLevel) {
        const parentId = String(parent._id);
        parent.replies = replyMap[parentId] || [];
    }
    console.log(`[COMMENTS] Found ${topLevel.length} top-level comments, ${allComments.length} total`);
    res.json(topLevel);
});
;
/**
 * POST /api/rescues/:id/comments
 * Creates a new top-level comment for a rescue case.
 * Body: { text, userId?, userName?, userAvatar? }
 */
exports.addComment = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const targetId = String(req.params.id);
    const { text, userId, userName, userAvatar } = req.body;
    if (!text || !text.trim()) {
        res.status(400).json({ error: "Comment text is required" });
        return;
    }
    console.log(`[COMMENTS] Adding comment to rescue: ${targetId}`);
    const mongoose = require("mongoose");
    const RescueRequest = require("../models/RescueRequest");
    let caseIdVal = "";
    let requestIdVal = targetId;
    try {
        const isObjId = mongoose.Types.ObjectId.isValid(targetId);
        const reqDoc = await RescueRequest.findOne({
            $or: [
                { _id: isObjId ? targetId : null },
                { caseId: targetId }
            ]
        });
        if (reqDoc) {
            requestIdVal = String(reqDoc._id);
            caseIdVal = reqDoc.caseId || "";
        }
    }
    catch (err) {
        console.error("[COMMENTS] Error resolving case info for comment:", err.message);
    }
    const authUser = req.user;
    const comment = await RescueComment.create({
        rescueRequestId: requestIdVal,
        caseId: caseIdVal,
        userId: userId || authUser?.id || "guest-user",
        userName: userName || authUser?.name || "User",
        userAvatar: userAvatar || "",
        text: text.trim(),
        parentCommentId: null,
    });
    const result = comment.toObject();
    result.replies = [];
    console.log(`[COMMENTS] Created comment ${result._id}`);
    res.status(201).json(result);
});
;
/**
 * POST /api/rescues/:id/comments/:commentId/reply
 * Creates a reply to an existing comment.
 * Body: { text, userId?, userName?, userAvatar? }
 */
exports.addReply = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const targetId = String(req.params.id);
    const commentId = String(req.params.commentId);
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
    console.log(`[COMMENTS] Adding reply to comment ${commentId} on rescue: ${targetId}`);
    const mongoose = require("mongoose");
    const RescueRequest = require("../models/RescueRequest");
    let caseIdVal = parentComment.caseId || "";
    let requestIdVal = parentComment.rescueRequestId || targetId;
    try {
        if (!caseIdVal) {
            const isObjId = mongoose.Types.ObjectId.isValid(targetId);
            const reqDoc = await RescueRequest.findOne({
                $or: [
                    { _id: isObjId ? targetId : null },
                    { caseId: targetId }
                ]
            });
            if (reqDoc) {
                requestIdVal = String(reqDoc._id);
                caseIdVal = reqDoc.caseId || "";
            }
        }
    }
    catch (err) {
        console.error("[COMMENTS] Error resolving case info for reply:", err.message);
    }
    const authUser = req.user;
    const reply = await RescueComment.create({
        rescueRequestId: requestIdVal,
        caseId: caseIdVal,
        userId: userId || authUser?.id || "guest-user",
        userName: userName || authUser?.name || "User",
        userAvatar: userAvatar || "",
        text: text.trim(),
        parentCommentId: commentId,
    });
    console.log(`[COMMENTS] Created reply ${reply._id}`);
    res.status(201).json(reply.toObject());
});
;
//# sourceMappingURL=commentController.js.map