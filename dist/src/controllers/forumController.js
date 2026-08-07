"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const catchAsync_1 = require("../utils/catchAsync");
const Forum = require("../models/Forum");
const ForumPost = require("../models/ForumPost");
const User = require("../models/User");
// GET all posts
exports.listPosts = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    // get user id if sent 
    let userId = req.query.userId ? String(req.query.userId) : null;
    if (userId === "forum-guest") {
        userId = null;
    }
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
        const token = req.headers.authorization.split(" ")[1];
        try {
            const jwt = require("jsonwebtoken");
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId = decoded.id;
        }
        catch (err) {
            // ignore invalid token
        }
    }
    let blockedIds = [];
    if (userId) {
        // 1. Users I have blocked
        const me = await User.findById(userId).select("blockedUsers").lean();
        if (me && me.blockedUsers) {
            blockedIds = [...blockedIds, ...me.blockedUsers.map((id) => String(id))];
        }
        // 2. Users who have blocked me
        const usersWhoBlockedMe = await User.find({ blockedUsers: userId }).select("_id").lean();
        const usersWhoBlockedMeIds = usersWhoBlockedMe.map((u) => String(u._id));
        blockedIds = [...blockedIds, ...usersWhoBlockedMeIds];
    }
    // get posts from DB 
    const query = blockedIds.length > 0 ? { userId: { $nin: blockedIds } } : {};
    const posts = await ForumPost.find(query).sort({ createdAt: -1 });
    // format response
    const response = posts.map((post) => ({
        id: String(post._id),
        title: post.title,
        tag: post.tag,
        author: post.author,
        likes: post.likes,
        // check if this user already liked
        likedByMe: userId ? post.likedByUsers.includes(userId) : false,
        commentCount: post.commentCount || 0,
        createdAt: post.createdAt,
        imageUrl: post.imageUrl || "",
    }));
    res.json(response);
});
// CREATE new post
exports.createPost = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
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
    await Forum.findOneAndUpdate({ rescueId: String(post._id) }, { $setOnInsert: { rescueId: String(post._id), comments: [] } }, { new: true, upsert: true });
    // Dispatch in-app notifications to all registered users (except the author)
    try {
        const { NotificationService } = require("../services/notificationService");
        const allUsers = await User.find({
            role: { $in: ["general_user", "volunteer", "ngo", "vet"] },
            _id: { $ne: userId }
        });
        console.log(`[FORUM] Dispatching new post notifications to ${allUsers.length} users`);
        for (const u of allUsers) {
            await NotificationService.sendNotification(String(u._id), "New Discussion Thread", `${authorName} started a new discussion: "${post.title}"`, "info");
        }
    }
    catch (err) {
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
exports.togglePostLike = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
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
        post.likedByUsers = post.likedByUsers.filter((id) => id !== userId);
        post.likes = Math.max(0, post.likes - 1);
    }
    else {
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
exports.getThread = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const { rescueId } = req.params;
    // find thread
    let thread = await Forum.findOne({ rescueId });
    // if not exist, create new one
    if (!thread) {
        thread = await Forum.create({ rescueId, comments: [] });
    }
    res.json({
        rescueId: thread.rescueId,
        comments: thread.comments.map((comment, index) => ({
            id: `${thread.rescueId}-${index}`,
            userId: comment.userId || "guest",
            text: comment.text,
            timestamp: comment.timestamp,
        })),
    });
});
// ADD comment
exports.addComment = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
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
    const post = await ForumPost.findByIdAndUpdate(rescueId, {
        commentCount: thread.comments.length,
    });
    // Notify the post author if someone else replies to their thread
    if (post && post.userId && String(post.userId) !== String(userId)) {
        try {
            const mongoose = require("mongoose");
            const { NotificationService } = require("../services/notificationService");
            const User = require("../models/User");
            let replierName = "Someone";
            if (mongoose.Types.ObjectId.isValid(userId)) {
                const replier = await User.findById(userId);
                if (replier)
                    replierName = replier.name;
            }
            await NotificationService.sendNotification(String(post.userId), "Reply to your Discussion", `${replierName} replied to your thread "${post.title}": "${text.substring(0, 40)}${text.length > 40 ? "..." : ""}"`, "info");
        }
        catch (err) {
            console.error("[FORUM] Failed to send reply notification to post author:", err.message || err);
        }
    }
    res.json({
        message: "Comment added",
        thread: {
            rescueId: thread.rescueId,
            comments: thread.comments.map((comment, index) => ({
                id: `${thread.rescueId}-${index}`,
                userId: comment.userId || "guest",
                text: comment.text,
                timestamp: comment.timestamp,
            })),
        },
    });
});
//# sourceMappingURL=forumController.js.map