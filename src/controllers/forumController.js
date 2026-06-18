const Forum = require("../models/Forum");
const ForumPost = require("../models/ForumPost");

// common error handler
const fail = (res, error, fallbackStatus = 500) => {
  const errorMsg = error?.message || String(error);
  console.error("[FORUM][ERROR]:", errorMsg);
  return res.status(fallbackStatus).json({ error: "Something went wrong", details: errorMsg });
};

// GET all posts
exports.listPosts = async (req, res) => {
  try {
    // get user id if sent 
    const userId = req.query.userId ? String(req.query.userId) : null;

    // get posts from DB 
    const posts = await ForumPost.find().sort({ createdAt: -1 });

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
    }));

    return res.json(response);
  } catch (error) {
    return fail(res, error);
  }
};

// CREATE new post
exports.createPost = async (req, res) => {
  try {
    const { title, tag = "GENERAL", author = "You" } = req.body;

    // simple validation
    if (!title || !String(title).trim()) {
      return res.status(400).json({ message: "Post title is required" });
    }

    // save post
    const post = await ForumPost.create({
      title: String(title).trim(),
      tag,
      author,
    });

    // create empty thread for comments (if not exist)
    await Forum.findOneAndUpdate(
      { rescueId: String(post._id) },
      { $setOnInsert: { rescueId: String(post._id), comments: [] } },
      { new: true, upsert: true }
    );

    return res.status(201).json({
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
  } catch (error) {
    return fail(res, error);
  }
};

// LIKE / UNLIKE post
exports.togglePostLike = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.body?.userId || "demo-user";

    const post = await ForumPost.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // check already liked or not
    const alreadyLiked = post.likedByUsers.includes(userId);

    if (alreadyLiked) {
      // remove like
      post.likedByUsers = post.likedByUsers.filter((id) => id !== userId);
      post.likes = Math.max(0, post.likes - 1);
    } else {
      // add like
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
    return fail(res, error);
  }
};

// GET comments for a post
exports.getThread = async (req, res) => {
  try {
    const { rescueId } = req.params;

    // find thread
    let thread = await Forum.findOne({ rescueId });

    // if not exist, create new one
    if (!thread) {
      thread = await Forum.create({ rescueId, comments: [] });
    }

    return res.json({
      rescueId: thread.rescueId,
      comments: thread.comments.map((comment, index) => ({
        id: `${thread.rescueId}-${index}`,
        userId: comment.userId || "guest",
        text: comment.text,
        timestamp: comment.timestamp,
      })),
    });
  } catch (error) {
    return fail(res, error);
  }
};

// ADD comment
exports.addComment = async (req, res) => {
  try {
    const { rescueId } = req.params;
    const { text, userId = "guest" } = req.body;

    // check empty comment
    if (!text || !String(text).trim()) {
      return res.status(400).json({ message: "Comment text is required" });
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

    return res.json({
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
  } catch (error) {
    return fail(res, error);
  }
};