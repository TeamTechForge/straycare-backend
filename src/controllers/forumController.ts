import { catchAsync } from "../utils/catchAsync";
import type { NextFunction } from "express";
const Forum = require("../models/Forum");
const ForumPost = require("../models/ForumPost");
const User = require("../models/User");
const mongoose = require("mongoose");

import type { Request, Response } from "express";

import { AppError } from "../utils/appError";

// Helper to retrieve user profile photo and role
const getUserInfo = async (userId: string) => {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return { avatar: "", role: "", name: "", exists: false };
  }
  try {
    const GeneralUserProfile = require("../models/GeneralUserProfile");
    const VolunteerProfile = require("../models/VolunteerProfile");
    const VetProfile = require("../models/VetProfile");
    const NGOProfile = require("../models/NGOProfile");

    const u = await User.findById(userId).select("profileImage avatar role name").lean();
    if (!u) return { avatar: "", role: "", name: "", exists: false };

    let avatar = u.profileImage || u.avatar || "";
    if (!avatar) {
      if (u.role === "general_user") {
        const p = await GeneralUserProfile.findOne({ userId }).select("profileImage").lean();
        if (p?.profileImage) avatar = p.profileImage;
      } else if (u.role === "volunteer") {
        const p = await VolunteerProfile.findOne({ userId }).select("profileImage").lean();
        if (p?.profileImage) avatar = p.profileImage;
      } else if (u.role === "vet") {
        const p = await VetProfile.findOne({ userId }).select("profileImage").lean();
        if (p?.profileImage) avatar = p.profileImage;
      } else if (u.role === "ngo") {
        const p = await NGOProfile.findOne({ userId }).select("profileImage").lean();
        if (p?.profileImage) avatar = p.profileImage;
      }
    }
    return { avatar: avatar || "", role: u.role || "", name: u.name || "", exists: true };
  } catch (err) {
    return { avatar: "", role: "", name: "", exists: false };
  }
};

// GET all posts
exports.listPosts = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // get user id if sent 
    let userId = req.query.userId ? String(req.query.userId) : null;
    
    if (userId === "forum-guest") {
      userId = null;
    }

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      const token = req.headers.authorization.split(" ")[1];
      try {
        const jwt = require("jsonwebtoken");
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
        userId = decoded.id;
      } catch (err) {
        // ignore invalid token
      }
    }

    let blockedIds: string[] = [];

    if (userId) {
      // 1. Users I have blocked
      const me = await User.findById(userId).select("blockedUsers").lean();
      if (me && me.blockedUsers) {
        blockedIds = [...blockedIds, ...me.blockedUsers.map((id: any) => String(id))];
      }
      
      // 2. Users who have blocked me
      const usersWhoBlockedMe = await User.find({ blockedUsers: userId }).select("_id").lean();
      const usersWhoBlockedMeIds = usersWhoBlockedMe.map((u: any) => String(u._id));
      
      blockedIds = [...blockedIds, ...usersWhoBlockedMeIds];
    }

    // get posts from DB 
    const query = blockedIds.length > 0 ? { userId: { $nin: blockedIds } } : {};
    const posts = await ForumPost.find(query).sort({ createdAt: -1 });

    // format response with author avatars
    const response = await Promise.all(
      posts.map(async (post: any) => {
        let authorAvatar = "";
        let authorName = post.author;

        if (!post.anonymous && post.userId) {
          const info = await getUserInfo(String(post.userId));
          if (!info.exists) {
            authorName = "Deleted User";
            authorAvatar = "";
          } else {
            authorAvatar = info.avatar;
            if (!authorName || authorName === "You" || authorName === "User") {
              authorName = info.name || authorName;
            }
          }
        }

        return {
          id: String(post._id),
          title: post.title,
          tag: post.tag,
          author: authorName,
          authorAvatar: post.anonymous ? "" : authorAvatar,
          likes: post.likes,
          // check if this user already liked
          likedByMe: userId ? post.likedByUsers.includes(userId) : false,
          isMine: post.userId && userId ? String(post.userId) === String(userId) : false,
          commentCount: post.commentCount || 0,
          createdAt: post.createdAt,
          imageUrl: post.imageUrl || "",
        };
      })
    );

    res.json(response);
});

// CREATE new post
exports.createPost = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { title, tag = "GENERAL", author, imageUrl } = req.body;
    console.log("[FORUM][POST] /api/forum/posts from", req.ip, "title:", title);


    // simple validation
    if (!title || !String(title).trim()) {
      res.status(400).json({ message: "Post title is required" });
      return;
    }

    let authorName = author || "You";
    const userId = req.user ? req.user.id : null;

    if (userId) {
      const user = await User.findById(userId);
      if (user) {
        authorName = user.name;
      }
    }

    const post = await ForumPost.create({
      title: String(title).trim(),
      tag,
      author: authorName,
      userId,
      imageUrl: imageUrl || "",
    });

    // create empty thread for comments (if not exist)
    await Forum.findOneAndUpdate(
      { rescueId: String(post._id) },
      { $setOnInsert: { rescueId: String(post._id), comments: [] } },
      { new: true, upsert: true }
    );

    // Dispatch in-app notifications to all registered users (except the author)
    try {
      const { NotificationService } = require("../services/notificationService");
      const allUsers = await User.find({
        role: { $in: ["general_user", "volunteer", "ngo", "vet"] },
        _id: { $ne: userId }
      });

      console.log(`[FORUM] Dispatching new post notifications to ${allUsers.length} users`);
      for (const u of allUsers) {
        await NotificationService.sendNotification(
          String(u._id),
          "New Discussion Thread",
          `${authorName} started a new discussion: "${post.title}"`,
          "info"
        );
      }
    } catch (err: any) {
      console.error("[FORUM] Failed to dispatch new discussion notifications:", err.message || err);
    }

    res.status(201).json({
      message: "Post created",
      post: {
        id: String(post._id),
        title: post.title,
        tag: post.tag,
        author: post.author,
        likes: post.likes,
        likedByMe: false,
        commentCount: post.commentCount || 0,
        imageUrl: post.imageUrl || "",
        createdAt: post.createdAt,
      },
    });
});

// LIKE / UNLIKE post
exports.togglePostLike = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { postId } = req.params;
    const userId = req.body?.userId || "demo-user";

    const post = await ForumPost.findById(postId);
    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    // check already liked or not
    const alreadyLiked = post.likedByUsers.includes(userId);

    if (alreadyLiked) {
      // remove like
      post.likedByUsers = post.likedByUsers.filter((id: string) => id !== userId);
      post.likes = Math.max(0, post.likes - 1);
    } else {
      // add like
      post.likedByUsers.push(userId);
      post.likes += 1;
    }

    await post.save();

    res.json({
      message: alreadyLiked ? "Post unliked" : "Post liked",
      post,
      likedByMe: !alreadyLiked,
    });
});

// GET comments for a post
exports.getThread = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { rescueId } = req.params;

    // extract logged in userId if token present
    let tokenUserId: string | null = null;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      try {
        const jwt = require("jsonwebtoken");
        const decoded = jwt.verify(req.headers.authorization.split(" ")[1], process.env.JWT_SECRET as string) as any;
        tokenUserId = decoded.id;
      } catch (err) {}
    }

    // find thread
    let thread = await Forum.findOne({ rescueId });

    // if not exist, create new one
    if (!thread) {
      thread = await Forum.create({ rescueId, comments: [] });
    }

    const commentsFormatted = await Promise.all(
      thread.comments.map(async (comment: any, index: number) => {
        let commenterName = comment.userName || "";
        let commenterAvatar = "";
        let commenterRole = "";

        if (comment.userId && comment.userId !== "guest" && comment.userId !== "forum-guest") {
          const info = await getUserInfo(String(comment.userId));
          if (!info.exists) {
            commenterName = "Deleted User";
            commenterAvatar = "";
            commenterRole = "";
          } else {
            if (!commenterName && info.name) commenterName = info.name;
            commenterAvatar = info.avatar || "";
            if (info.role === "vet") commenterRole = "Vet";
            else if (info.role === "ngo") commenterRole = "NGO";
          }
        }
        if (!commenterName) commenterName = "User";

        return {
          id: `${thread.rescueId}-${index}`,
          userId: comment.userId || "guest",
          userName: commenterName,
          userAvatar: commenterAvatar,
          role: commenterRole,
          isMine: tokenUserId && comment.userId ? String(comment.userId) === String(tokenUserId) : false,
          text: comment.text,
          timestamp: comment.timestamp,
        };
      })
    );

    res.json({
      rescueId: thread.rescueId,
      comments: commentsFormatted,
    });
});

// ADD comment
exports.addComment = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { rescueId } = req.params;
    const { text } = req.body;

    // check empty comment
    if (!text || !String(text).trim()) {
      res.status(400).json({ message: "Comment text is required" });
      return;
    }

    let commenterId = req.user ? req.user.id : (req.body.userId || "guest");
    let commenterName = (req.user as any)?.name || (req.body.userName || "");

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      try {
        const jwt = require("jsonwebtoken");
        const decoded = jwt.verify(req.headers.authorization.split(" ")[1], process.env.JWT_SECRET as string) as any;
        if (decoded && decoded.id) {
          commenterId = decoded.id;
          const u = await User.findById(commenterId).select("name").lean();
          if (u && u.name) commenterName = u.name;
        }
      } catch (err) {}
    }

    if (!commenterName && commenterId && commenterId !== "guest" && commenterId !== "forum-guest") {
      const info = await getUserInfo(String(commenterId));
      if (info.name) commenterName = info.name;
    }
    if (!commenterName) commenterName = "User";

    let thread = await Forum.findOne({ rescueId });

    // create thread if not found
    if (!thread) {
      thread = await Forum.create({ rescueId, comments: [] });
    }

    // push new comment
    thread.comments.push({
      userId: commenterId,
      userName: commenterName,
      text,
      timestamp: new Date(),
    });

    await thread.save();

    // update comment count in post (ignore error if post missing)
    const post = await ForumPost.findByIdAndUpdate(rescueId, {
      commentCount: thread.comments.length,
    });

    // Notify the post author ONLY if someone else replies to their thread (never for own comments)
    const postAuthorId = post && post.userId ? String(post.userId).trim() : "";
    const currentCommenterId = commenterId ? String(commenterId).trim() : "";
    const isOwnPost = Boolean(postAuthorId && currentCommenterId && postAuthorId === currentCommenterId);

    if (postAuthorId && !isOwnPost) {
      try {
        const { NotificationService } = require("../services/notificationService");
        const newCommentIndex = thread.comments.length - 1;
        const targetCommentId = `${rescueId}-${newCommentIndex}`;

        await NotificationService.sendNotification(
          postAuthorId,
          "Reply to your Discussion",
          `${commenterName} replied to your thread "${post.title}": "${text.substring(0, 40)}${text.length > 40 ? "..." : ""}"`,
          "info",
          targetCommentId,
          String(post._id)
        );
      } catch (err: any) {
        console.error("[FORUM] Failed to send reply notification to post author:", err.message || err);
      }
    }

    const commentsFormatted = await Promise.all(
      thread.comments.map(async (comment: any, index: number) => {
        let cName = comment.userName || "";
        let cAvatar = "";
        let cRole = "";
        if (comment.userId && comment.userId !== "guest" && comment.userId !== "forum-guest") {
          const info = await getUserInfo(String(comment.userId));
          if (!info.exists) {
            cName = "Deleted User";
            cAvatar = "";
            cRole = "";
          } else {
            if (!cName && info.name) cName = info.name;
            cAvatar = info.avatar || "";
            if (info.role === "vet") cRole = "Vet";
            else if (info.role === "ngo") cRole = "NGO";
          }
        }
        if (!cName) cName = "User";

        return {
          id: `${thread.rescueId}-${index}`,
          userId: comment.userId || "guest",
          userName: cName,
          userAvatar: cAvatar,
          role: cRole,
          isMine: String(comment.userId) === String(commenterId),
          text: comment.text,
          timestamp: comment.timestamp,
        };
      })
    );

    res.json({
      message: "Comment added",
      thread: {
        rescueId: thread.rescueId,
        comments: commentsFormatted,
      },
    });
});

exports.deletePost = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { postId } = req.params;
  const userId = req.user ? req.user.id : null;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const post = await ForumPost.findById(postId);
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  if (post.userId && String(post.userId) !== String(userId)) {
    res.status(403).json({ error: "You can only delete your own posts" });
    return;
  }

  await ForumPost.findByIdAndDelete(postId);
  // Also delete the associated thread
  await Forum.findOneAndDelete({ rescueId: postId });

  console.log(`[FORUM] Post ${postId} deleted by user ${userId}`);
  res.json({ message: "Post deleted successfully" });
});

// DELETE a comment in a thread — only the author who posted that comment can delete it
exports.deleteComment = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const rescueIdStr = String(req.params.rescueId);
  const commentIdStr = String(req.params.commentId);
  let userId = req.user ? req.user.id : null;

  if (!userId && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    try {
      const jwt = require("jsonwebtoken");
      const decoded = jwt.verify(req.headers.authorization.split(" ")[1], process.env.JWT_SECRET as string) as any;
      if (decoded && decoded.id) {
        userId = decoded.id;
      }
    } catch (err) {}
  }

  if (!userId) {
    res.status(401).json({ error: "Unauthorized. Please log in to delete comments." });
    return;
  }

  const thread = await Forum.findOne({ rescueId: rescueIdStr });
  if (!thread) {
    res.status(404).json({ error: "Thread not found" });
    return;
  }

  // Locate the comment by index or by subdocument _id
  let commentIndex = -1;

  // 1. Try parsing formatted ID: ${rescueId}-${index}
  if (commentIdStr.includes("-")) {
    const parts = commentIdStr.split("-");
    const idx = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(idx) && idx >= 0 && idx < thread.comments.length) {
      commentIndex = idx;
    }
  }

  // 2. Try parsing numeric index directly
  if (commentIndex === -1 && !isNaN(Number(commentIdStr))) {
    const idx = Number(commentIdStr);
    if (idx >= 0 && idx < thread.comments.length) {
      commentIndex = idx;
    }
  }

  // 3. Try finding by subdocument _id
  if (commentIndex === -1) {
    commentIndex = thread.comments.findIndex(
      (c: any) => c._id && String(c._id) === commentIdStr
    );
  }

  if (commentIndex === -1) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }

  const targetComment = thread.comments[commentIndex];

  // Enforce ownership: only the user who posted the comment can delete it
  if (!targetComment.userId || String(targetComment.userId) !== String(userId)) {
    res.status(403).json({ error: "You can only delete your own comments" });
    return;
  }

  // Remove comment from thread
  thread.comments.splice(commentIndex, 1);
  await thread.save();

  // Update total comment count on the forum post
  await ForumPost.findByIdAndUpdate(rescueIdStr, {
    commentCount: thread.comments.length,
  });

  console.log(`[FORUM] Comment ${commentIdStr} in thread ${rescueIdStr} deleted by user ${userId}`);
  res.json({ message: "Comment deleted successfully" });
});
