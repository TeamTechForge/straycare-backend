import { catchAsync } from "../utils/catchAsync";
import type { NextFunction } from "express";
const Forum = require("../models/Forum");
const ForumPost = require("../models/ForumPost");
const User = require("../models/User");

import type { Request, Response } from "express";

import { AppError } from "../utils/AppError";

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

    // format response
    const response = posts.map((post: any) => ({
      id: String(post._id),
      title: post.title,
      tag: post.tag,
      author: post.author,
      likes: post.likes,
      // check if this user already liked
      likedByMe: userId ? post.likedByUsers.includes(userId) : false,
      commentCount: post.commentCount || 0,
      createdAt: post.createdAt,
    }));

    res.json(response);
});

// CREATE new post
exports.createPost = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { title, tag = "GENERAL", author } = req.body;
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
    });

    // create empty thread for comments (if not exist)
    await Forum.findOneAndUpdate(
      { rescueId: String(post._id) },
      { $setOnInsert: { rescueId: String(post._id), comments: [] } },
      { new: true, upsert: true }
    );

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

    // find thread
    let thread = await Forum.findOne({ rescueId });

    // if not exist, create new one
    if (!thread) {
      thread = await Forum.create({ rescueId, comments: [] });
    }

    res.json({
      rescueId: thread.rescueId,
      comments: thread.comments.map((comment: any, index: number) => ({
        id: `${thread.rescueId}-${index}`,
        userId: comment.userId || "guest",
        text: comment.text,
        timestamp: comment.timestamp,
      })),
    });
});

// ADD comment
exports.addComment = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { rescueId } = req.params;
    const { text, userId = "guest" } = req.body;

    // check empty comment
    if (!text || !String(text).trim()) {
      res.status(400).json({ message: "Comment text is required" });
      return;
    }

    let thread = await Forum.findOne({ rescueId });

    // create thread if not found
    if (!thread) {
      thread = await Forum.create({ rescueId, comments: [] });
    }

    // push new comment
    thread.comments.push({
      userId,
      text,
      timestamp: new Date(),
    });

    await thread.save();

    // update comment count in post (ignore error if post missing)
    await ForumPost.findByIdAndUpdate(rescueId, {
      commentCount: thread.comments.length,
    }).catch(() => { });

    res.json({
      message: "Comment added",
      thread: {
        rescueId: thread.rescueId,
        comments: thread.comments.map((comment: any, index: number) => ({
          id: `${thread.rescueId}-${index}`,
          userId: comment.userId || "guest",
          text: comment.text,
          timestamp: comment.timestamp,
        })),
      },
    });
});
