const Forum = require("../models/Forum");
const ForumPost = require("../models/ForumPost");
const User = require("../models/User");

exports.listPosts = async (req, res) => {
  try {
    console.log("[FORUM][GET] /api/forum/posts from", req.ip);
    const posts = await ForumPost.find().sort({ createdAt: -1 });
    return res.json(posts);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching posts", error: error.message });
  }
};

exports.createPost = async (req, res) => {
  try {
    const { title, tag = "GENERAL", author } = req.body;
    console.log("[FORUM][POST] /api/forum/posts from", req.ip, "title:", title);

    if (!title || !String(title).trim()) {
      return res.status(400).json({ message: "Post title is required" });
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

    // Keep a thread document ready for comments so GET/POST thread endpoints stay simple.
    await Forum.findOneAndUpdate(
      { rescueId: String(post._id) },
      { $setOnInsert: { rescueId: String(post._id), comments: [] } },
      { new: true, upsert: true }
    );

    return res.status(201).json({ message: "Post created", post });
  } catch (error) {
    return res.status(500).json({ message: "Error creating post", error: error.message });
  }
};

exports.togglePostLike = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.body?.userId || "demo-user";
    console.log("[FORUM][PATCH] /api/forum/posts/" + postId + "/like from", req.ip, "userId:", userId);

    const post = await ForumPost.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const alreadyLiked = post.likedByUsers.includes(userId);
    if (alreadyLiked) {
      post.likedByUsers = post.likedByUsers.filter((id) => id !== userId);
      post.likes = Math.max(0, post.likes - 1);
    } else {
      post.likedByUsers.push(userId);
      post.likes += 1;
    }

    await post.save();

    return res.json({
      message: alreadyLiked ? "Post unliked" : "Post liked",
      post,
      likedByMe: !alreadyLiked,
    });
  } catch (error) {
    return res.status(500).json({ message: "Error toggling like", error: error.message });
  }
};

exports.getThread = async (req, res) => {
  try {
    const { rescueId } = req.params;
    console.log("[FORUM][GET] /api/forum/" + rescueId, "from", req.ip);

    let thread = await Forum.findOne({ rescueId });
    if (!thread) {
      thread = await Forum.create({ rescueId, comments: [] });
      console.log("[FORUM][GET] Created new thread for rescueId:", rescueId);
    }

    res.json(thread);
  } catch (error) {
    res.status(500).json({ message: "Error fetching thread", error: error.message });
  }
};

exports.addComment = async (req, res) => {
  try {
    const { rescueId } = req.params;
    const { text } = req.body;
    console.log("[FORUM][POST] /api/forum/" + rescueId + "/comment", "from", req.ip, "text:", text);

    if (!text || !String(text).trim()) {
      return res.status(400).json({ message: "Comment text is required" });
    }

    let thread = await Forum.findOne({ rescueId });
    if (!thread) {
      thread = await Forum.create({ rescueId, comments: [] });
      console.log("[FORUM][POST] Created new thread for rescueId:", rescueId);
    }

    thread.comments.push({
      userId: "test-user",
      text,
      timestamp: new Date()
    });

    await thread.save();
    await ForumPost.findByIdAndUpdate(rescueId, { commentCount: thread.comments.length }).catch(() => null);
    console.log("[FORUM][POST] Comment saved. Total comments:", thread.comments.length);

    res.json({ message: "Comment added", thread });
  } catch (error) {
    res.status(500).json({ message: "Error adding comment", error: error.message });
  }
};
