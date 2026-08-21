import { catchAsync } from "../utils/catchAsync";
import type { NextFunction } from "express";

// commentController.ts
//
// This controller handles comments inside a main discussion thread.
//
// Users can:
// 1. View comments in a discussion thread
// 2. Add a new comment
// 3. Reply to an existing comment

const RescueComment = require("../models/RescueComment");

import type { Request, Response } from "express";

/**
 * GET /api/rescues/:id/comments
 *
 * Gets all comments for a discussion thread.
 *
 * Comments are organized like:
 *
 * Comment 1
 *   ├── Reply 1
 *   └── Reply 2
 *
 * Comment 2
 *   └── Reply 1
 *
 * The replies are placed inside the "replies" array
 * of their parent comment.
 */
exports.getComments = catchAsync(
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {

    // Get the discussion thread ID from the URL.
    // Example:
    // /api/rescues/123/comments
    //
    // targetId = "123"
    const targetId = String(req.params.id);

    console.log(
      `[COMMENTS] Fetching comments for discussion thread: ${targetId}`
    );

    const mongoose = require("mongoose");
    const RescueRequest = require("../models/RescueRequest");

    // Store possible IDs that can identify the discussion.
    //
    // The system may use either:
    // - MongoDB rescue request ID
    // - caseId
    //
    // We keep both so comments can be found correctly.
    let matchIds: string[] = [targetId];

    try {

      // Check whether the target ID is a valid MongoDB ObjectId.
      const isObjId = mongoose.Types.ObjectId.isValid(targetId);

      // Find the related rescue request.
      const reqDoc = await RescueRequest.findOne({
        $or: [
          {
            _id: isObjId ? targetId : null
          },
          {
            caseId: targetId
          }
        ]
      });

      if (reqDoc) {

        // Add the MongoDB document ID.
        if (reqDoc._id) {
          matchIds.push(String(reqDoc._id));
        }

        // Add the case ID if it exists.
        if (reqDoc.caseId) {
          matchIds.push(reqDoc.caseId);
        }
      }

    } catch (err: any) {

      // Log an error if the discussion/rescue ID
      // cannot be resolved.
      console.error(
        "[COMMENTS] Error matching discussion thread ID:",
        err.message
      );
    }

    // Get all comments that belong to this discussion.
    //
    // We check both rescueRequestId and caseId because
    // the existing comment records may contain either ID.
    //
    // createdAt: 1 means comments are returned
    // from oldest to newest.
    const allComments = await RescueComment.find({
      $or: [
        {
          rescueRequestId: {
            $in: matchIds
          }
        },
        {
          caseId: {
            $in: matchIds
          }
        }
      ]
    }).sort({
      createdAt: 1,
    });

    // This array will contain only the main comments.
    //
    // Example:
    //
    // [
    //   Comment 1,
    //   Comment 2
    // ]
    const topLevel: any[] = [];

    // This object temporarily stores replies.
    //
    // The parent comment ID is used as the key.
    //
    // Example:
    //
    // {
    //   "comment123": [reply1, reply2],
    //   "comment456": [reply3]
    // }
    const replyMap: Record<string, any[]> = {};

    // Go through every comment.
    for (const comment of allComments) {

      // Convert the MongoDB document into a normal JavaScript object.
      const obj = comment.toObject();

      // Give every comment an empty replies array.
      obj.replies = [];

      // If parentCommentId is empty/null,
      // this is a main discussion comment.
      if (!obj.parentCommentId) {

        topLevel.push(obj);

      } else {

        // If parentCommentId exists,
        // this comment is a reply.
        const parentId = String(obj.parentCommentId);

        // Create an empty reply list if this parent
        // doesn't have one yet.
        if (!replyMap[parentId]) {
          replyMap[parentId] = [];
        }

        // Add the reply to its parent's reply list.
        replyMap[parentId].push(obj);
      }
    }

    // Now attach the replies to their main comments.
    for (const parent of topLevel) {

      // Get the ID of the main comment.
      const parentId = String(parent._id);

      // Find replies belonging to this comment.
      //
      // If there are no replies, use an empty array.
      parent.replies = replyMap[parentId] || [];
    }

    console.log(
      `[COMMENTS] Found ${topLevel.length} main comments, ` +
      `${allComments.length} total comments`
    );

    // Send the threaded comments to the frontend.
    res.json(topLevel);
  }
);


/**
 * POST /api/rescues/:id/comments
 *
 * Creates a new main comment in the discussion thread.
 *
 * Example:
 *
 * {
 *   text: "This is a useful discussion."
 * }
 *
 * Because parentCommentId is null,
 * this becomes a main comment instead of a reply.
 */
exports.addComment = catchAsync(
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {

    // Get the discussion thread ID from the URL.
    const targetId = String(req.params.id);

    // Get comment information sent from the frontend.
    const {
      text,
      userId,
      userName,
      userAvatar
    } = req.body;

    // Check whether the user entered some text.
    if (!text || !text.trim()) {

      res.status(400).json({
        error: "Comment text is required"
      });

      return;
    }

    console.log(
      `[COMMENTS] Adding comment to discussion thread: ${targetId}`
    );

    const mongoose = require("mongoose");
    const RescueRequest = require("../models/RescueRequest");

    // These values will be stored with the comment.
    let caseIdVal = "";
    let requestIdVal = targetId;

    try {

      // Check if targetId is a MongoDB ObjectId.
      const isObjId = mongoose.Types.ObjectId.isValid(targetId);

      // Find the related record.
      const reqDoc = await RescueRequest.findOne({
        $or: [
          {
            _id: isObjId ? targetId : null
          },
          {
            caseId: targetId
          }
        ]
      });

      if (reqDoc) {

        // Store the MongoDB ID.
        requestIdVal = String(reqDoc._id);

        // Store the case ID.
        caseIdVal = reqDoc.caseId || "";
      }

    } catch (err: any) {

      console.error(
        "[COMMENTS] Error resolving discussion information:",
        err.message
      );
    }

    // Get the logged-in user.
    //
    // This is available if authentication middleware
    // has added the user to the request.
    const authUser = (req as any).user;

    // Create the main discussion comment.
    const comment = await RescueComment.create({

      // ID used to connect the comment to the discussion.
      rescueRequestId: requestIdVal,

      // Case ID connected to the discussion.
      caseId: caseIdVal,

      // Use the user ID sent by the frontend.
      //
      // If it isn't available, use the authenticated user's ID.
      // If that isn't available either, use "guest-user".
      userId: userId || authUser?.id || "guest-user",

      // User's display name.
      userName: userName || authUser?.name || "User",

      // User's profile image.
      userAvatar: userAvatar || "",

      // Save the comment text after removing
      // unnecessary spaces at the beginning/end.
      text: text.trim(),

      // null means this is a main comment.
      //
      // It does not belong to another comment.
      parentCommentId: null,
    });

    // Convert the MongoDB document into a normal object.
    const result = comment.toObject();

    // Main comments start with an empty replies list.
    result.replies = [];

    console.log(
      `[COMMENTS] Created discussion comment ${result._id}`
    );

    // Send the newly created comment to the frontend.
    res.status(201).json(result);
  }
);


/**
 * POST /api/rescues/:id/comments/:commentId/reply
 *
 * Creates a reply to an existing discussion comment.
 *
 * Example:
 *
 * Main comment:
 * "This is a useful discussion."
 *
 * Reply:
 * "Yes, I agree with this."
 *
 * The reply uses parentCommentId to connect
 * itself to the main comment.
 */
exports.addReply = catchAsync(
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {

    // Get the discussion thread ID.
    const targetId = String(req.params.id);

    // Get the ID of the comment being replied to.
    const commentId = String(req.params.commentId);

    // Get reply information from the frontend.
    const {
      text,
      userId,
      userName,
      userAvatar
    } = req.body;

    // Make sure the reply contains text.
    if (!text || !text.trim()) {

      res.status(400).json({
        error: "Reply text is required"
      });

      return;
    }

    // Find the comment that the user wants to reply to.
    const parentComment = await RescueComment.findById(commentId);

    // If the parent comment doesn't exist,
    // we cannot create the reply.
    if (!parentComment) {

      res.status(404).json({
        error: "Parent comment not found"
      });

      return;
    }

    console.log(
      `[COMMENTS] Adding reply to comment ${commentId} ` +
      `in discussion thread: ${targetId}`
    );

    const mongoose = require("mongoose");
    const RescueRequest = require("../models/RescueRequest");

    // Try to get the discussion information
    // from the parent comment.
    let caseIdVal = parentComment.caseId || "";

    let requestIdVal =
      parentComment.rescueRequestId || targetId;

    try {

      // If the parent comment doesn't have a case ID,
      // find the related record using the discussion ID.
      if (!caseIdVal) {

        const isObjId =
          mongoose.Types.ObjectId.isValid(targetId);

        const reqDoc = await RescueRequest.findOne({
          $or: [
            {
              _id: isObjId ? targetId : null
            },
            {
              caseId: targetId
            }
          ]
        });

        if (reqDoc) {

          // Get the MongoDB ID.
          requestIdVal = String(reqDoc._id);

          // Get the case ID.
          caseIdVal = reqDoc.caseId || "";
        }
      }

    } catch (err: any) {

      console.error(
        "[COMMENTS] Error resolving discussion information for reply:",
        err.message
      );
    }

    // Get the logged-in user.
    const authUser = (req as any).user;

    // Create the reply.
    const reply = await RescueComment.create({

      // Connect the reply to the discussion thread.
      rescueRequestId: requestIdVal,

      // Store the related case ID.
      caseId: caseIdVal,

      // ID of the user who wrote the reply.
      userId: userId || authUser?.id || "guest-user",

      // Name of the user.
      userName: userName || authUser?.name || "User",

      // User's profile image.
      userAvatar: userAvatar || "",

      // Save the reply text.
      text: text.trim(),

      // IMPORTANT:
      //
      // This connects the reply to the original comment.
      //
      // Example:
      //
      // parentCommentId = "ABC123"
      //
      // This means:
      // "This reply belongs to comment ABC123."
      parentCommentId: commentId,
    });

    console.log(
      `[COMMENTS] Created reply ${reply._id}`
    );

    // Send the new reply back to the frontend.
    res.status(201).json(reply.toObject());
  }
);