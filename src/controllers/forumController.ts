import { catchAsync } from "../utils/catchAsync";
import type { NextFunction } from "express";

const Forum = require("../models/Forum");
const ForumPost = require("../models/ForumPost");
const User = require("../models/User");
const mongoose = require("mongoose");

import type { Request, Response } from "express";


// Get the user's profile details used when displaying posts/comments.
// Profile images can be stored either in User or in the role-specific profile.
const getUserInfo = async (userId: string) => {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return { avatar: "", role: "", name: "" };
  }

  try {
    const GeneralUserProfile = require("../models/GeneralUserProfile");
    const VolunteerProfile = require("../models/VolunteerProfile");
    const VetProfile = require("../models/VetProfile");
    const NGOProfile = require("../models/NGOProfile");

    const u = await User.findById(userId)
      .select("profileImage avatar role name")
      .lean();

    if (!u) return { avatar: "", role: "", name: "" };

    // First check the main User document for a profile image.
    let avatar = u.profileImage || u.avatar || "";

    // If no image is found, check the profile belonging to the user's role.
    if (!avatar) {
      if (u.role === "general_user") {
        const p = await GeneralUserProfile.findOne({ userId })
          .select("profileImage")
          .lean();

        if (p?.profileImage) avatar = p.profileImage;
      } else if (u.role === "volunteer") {
        const p = await VolunteerProfile.findOne({ userId })
          .select("profileImage")
          .lean();

        if (p?.profileImage) avatar = p.profileImage;
      } else if (u.role === "vet") {
        const p = await VetProfile.findOne({ userId })
          .select("profileImage")
          .lean();

        if (p?.profileImage) avatar = p.profileImage;
      } else if (u.role === "ngo") {
        const p = await NGOProfile.findOne({ userId })
          .select("profileImage")
          .lean();

        if (p?.profileImage) avatar = p.profileImage;
      }
    }

    return {
      avatar: avatar || "",
      role: u.role || "",
      name: u.name || "",
    };
  } catch (err) {
    // Don't stop the request just because profile information couldn't be loaded.
    return { avatar: "", role: "", name: "" };
  }
};


// GET all forum posts
exports.listPosts = catchAsync(
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {

    // Get the current user so we can show things like
    // "liked by me", "my post", and blocked users.
    let userId = req.query.userId
      ? String(req.query.userId)
      : null;

    if (userId === "forum-guest") {
      userId = null;
    }

    // If a login token is available, use the user ID from the token.
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      const token = req.headers.authorization.split(" ")[1];

      try {
        const jwt = require("jsonwebtoken");

        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET as string
        ) as any;

        userId = decoded.id;
      } catch (err) {
        // Ignore invalid tokens and continue as a guest.
      }
    }

    let blockedIds: string[] = [];

    if (userId) {

      // Get the users that I have blocked.
      const me = await User.findById(userId)
        .select("blockedUsers")
        .lean();

      if (me && me.blockedUsers) {
        blockedIds = [
          ...blockedIds,
          ...me.blockedUsers.map((id: any) => String(id)),
        ];
      }

      // Also find users who have blocked me.
      const usersWhoBlockedMe = await User.find({
        blockedUsers: userId,
      })
        .select("_id")
        .lean();

      const usersWhoBlockedMeIds = usersWhoBlockedMe.map(
        (u: any) => String(u._id)
      );

      blockedIds = [
        ...blockedIds,
        ...usersWhoBlockedMeIds,
      ];
    }

    // Don't show posts from users involved in a block relationship.
    const query =
      blockedIds.length > 0
        ? { userId: { $nin: blockedIds } }
        : {};

    // Get newest posts first.
    const posts = await ForumPost.find(query).sort({
      createdAt: -1,
    });

    // Add the author's profile information before sending posts
    // to the frontend.
    const response = await Promise.all(
      posts.map(async (post: any) => {

        let authorAvatar = "";
        let authorName = post.author;

        // Anonymous posts don't show the user's profile information.
        if (!post.anonymous && post.userId) {
          const info = await getUserInfo(String(post.userId));

          authorAvatar = info.avatar;

          // Use the actual name if the saved author name is just a placeholder.
          if (
            !authorName ||
            authorName === "You" ||
            authorName === "User"
          ) {
            authorName = info.name || authorName;
          }
        }

        return {
          id: String(post._id),
          title: post.title,
          tag: post.tag,
          author: authorName,
          authorAvatar: post.anonymous ? "" : authorAvatar,
          likes: post.likes,

          // Check whether the current user has already liked this post.
          likedByMe: userId
            ? post.likedByUsers.includes(userId)
            : false,

          // Used by the frontend to identify the user's own post.
          isMine:
            post.userId && userId
              ? String(post.userId) === String(userId)
              : false,

          commentCount: post.commentCount || 0,
          createdAt: post.createdAt,
          imageUrl: post.imageUrl || "",
        };
      })
    );

    res.json(response);
  }
);


// CREATE new post
exports.createPost = catchAsync(
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {

    const {
      title,
      tag = "GENERAL",
      author,
      imageUrl,
    } = req.body;

    console.log(
      "[FORUM][POST] /api/forum/posts from",
      req.ip,
      "title:",
      title
    );

    // A post must have a title.
    if (!title || !String(title).trim()) {
      res.status(400).json({
        message: "Post title is required",
      });
      return;
    }

    let authorName = author || "You";

    // Get the logged-in user from the authentication middleware.
    const userId = req.user ? req.user.id : null;

    if (userId) {
      const user = await User.findById(userId);

      if (user) {
        authorName = user.name;
      }
    }

    // Save the new discussion post.
    const post = await ForumPost.create({
      title: String(title).trim(),
      tag,
      author: authorName,
      userId,
      imageUrl: imageUrl || "",
    });

    // Every discussion post gets its own comment thread.
    // The post ID is used to identify that thread.
    await Forum.findOneAndUpdate(
      { rescueId: String(post._id) },
      {
        $setOnInsert: {
          rescueId: String(post._id),
          comments: [],
        },
      },
      {
        new: true,
        upsert: true,
      }
    );

    // Tell other registered users that a new discussion was created.
    // The person who created the post doesn't receive this notification.
    try {
      const {
        NotificationService,
      } = require("../services/notificationService");

      const allUsers = await User.find({
        role: {
          $in: [
            "general_user",
            "volunteer",
            "ngo",
            "vet",
          ],
        },
        _id: { $ne: userId },
      });

      console.log(
        `[FORUM] Dispatching new post notifications to ${allUsers.length} users`
      );

      for (const u of allUsers) {
        await NotificationService.sendNotification(
          String(u._id),
          "New Discussion Thread",
          `${authorName} started a new discussion: "${post.title}"`,
          "info"
        );
      }
    } catch (err: any) {
      console.error(
        "[FORUM] Failed to dispatch new discussion notifications:",
        err.message || err
      );
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
  }
);


// LIKE / UNLIKE post
exports.togglePostLike = catchAsync(
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {

    const { postId } = req.params;

    // Get the user who is liking/unliking the post.
    const userId = req.body?.userId || "demo-user";

    const post = await ForumPost.findById(postId);

    if (!post) {
      res.status(404).json({
        message: "Post not found",
      });
      return;
    }

    // Check if this user already liked the post.
    const alreadyLiked = post.likedByUsers.includes(userId);

    if (alreadyLiked) {

      // Remove the user's like.
      post.likedByUsers = post.likedByUsers.filter(
        (id: string) => id !== userId
      );

      post.likes = Math.max(0, post.likes - 1);

    } else {

      // Add the user's like.
      post.likedByUsers.push(userId);
      post.likes += 1;
    }

    await post.save();

    res.json({
      message: alreadyLiked
        ? "Post unliked"
        : "Post liked",
      post,
      likedByMe: !alreadyLiked,
    });
  }
);


// GET comments for a discussion post
exports.getThread = catchAsync(
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {

    const { rescueId } = req.params;

    // Get the logged-in user's ID from the token.
    // This is used to mark which comments belong to the current user.
    let tokenUserId: string | null = null;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      try {
        const jwt = require("jsonwebtoken");

        const decoded = jwt.verify(
          req.headers.authorization.split(" ")[1],
          process.env.JWT_SECRET as string
        ) as any;

        tokenUserId = decoded.id;
      } catch (err) { }
    }

    // Find the comment thread for this discussion post.
    let thread = await Forum.findOne({ rescueId });

    // Create the thread if this is the first time
    // someone opens the comments.
    if (!thread) {
      thread = await Forum.create({
        rescueId,
        comments: [],
      });
    }

    // Format comments before sending them to the frontend.
    const commentsFormatted = await Promise.all(
      thread.comments.map(
        async (comment: any, index: number) => {

          let commenterName = comment.userName || "";
          let commenterAvatar = "";
          let commenterRole = "";

          // Get profile information for registered users.
          if (
            comment.userId &&
            comment.userId !== "guest" &&
            comment.userId !== "forum-guest"
          ) {
            const info = await getUserInfo(
              String(comment.userId)
            );

            if (!commenterName && info.name) {
              commenterName = info.name;
            }

            commenterAvatar = info.avatar || "";

            // Only show these roles in the current forum UI.
            if (info.role === "vet") {
              commenterRole = "Vet";
            } else if (info.role === "ngo") {
              commenterRole = "NGO";
            }
          }

          if (!commenterName) {
            commenterName = "User";
          }

          return {
            // Create an ID that identifies the comment
            // using the discussion post ID and comment position.
            id: `${thread.rescueId}-${index}`,

            userId: comment.userId || "guest",
            userName: commenterName,
            userAvatar: commenterAvatar,
            role: commenterRole,

            // Used to identify the current user's own comment.
            isMine:
              tokenUserId && comment.userId
                ? String(comment.userId) ===
                String(tokenUserId)
                : false,

            text: comment.text,
            timestamp: comment.timestamp,
          };
        }
      )
    );

    res.json({
      rescueId: thread.rescueId,
      comments: commentsFormatted,
    });
  }
);


// ADD comment to a discussion thread
exports.addComment = catchAsync(
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {

    const { rescueId } = req.params;
    const { text } = req.body;

    // Don't allow empty comments.
    if (!text || !String(text).trim()) {
      res.status(400).json({
        message: "Comment text is required",
      });
      return;
    }

    // Use the logged-in user if available.
    // Otherwise use the user information sent by the frontend.
    let commenterId = req.user
      ? req.user.id
      : (req.body.userId || "guest");

    let commenterName = (req.user as any)?.name ||
      (req.body.userName || "");

    // If there is a token, get the user directly from it.
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      try {
        const jwt = require("jsonwebtoken");

        const decoded = jwt.verify(
          req.headers.authorization.split(" ")[1],
          process.env.JWT_SECRET as string
        ) as any;

        if (decoded && decoded.id) {
          commenterId = decoded.id;

          const u = await User.findById(commenterId)
            .select("name")
            .lean();

          if (u && u.name) {
            commenterName = u.name;
          }
        }
      } catch (err) { }
    }

    // Try to get the user's name if it wasn't available above.
    if (
      !commenterName &&
      commenterId &&
      commenterId !== "guest" &&
      commenterId !== "forum-guest"
    ) {
      const info = await getUserInfo(
        String(commenterId)
      );

      if (info.name) {
        commenterName = info.name;
      }
    }

    if (!commenterName) {
      commenterName = "User";
    }

    // Find the discussion's comment thread.
    let thread = await Forum.findOne({ rescueId });

    // Create the thread if it doesn't exist yet.
    if (!thread) {
      thread = await Forum.create({
        rescueId,
        comments: [],
      });
    }

    // Add the new comment to the discussion thread.
    thread.comments.push({
      userId: commenterId,
      userName: commenterName,
      text,
      timestamp: new Date(),
    });

    await thread.save();

    // Keep the comment count on the discussion post updated.
    const post = await ForumPost.findByIdAndUpdate(
      rescueId,
      {
        commentCount: thread.comments.length,
      }
    );

    // Only notify the author when another user comments
    // on their discussion.
    const postAuthorId =
      post && post.userId
        ? String(post.userId).trim()
        : "";

    const currentCommenterId =
      commenterId
        ? String(commenterId).trim()
        : "";

    const isOwnPost = Boolean(
      postAuthorId &&
      currentCommenterId &&
      postAuthorId === currentCommenterId
    );

    if (postAuthorId && !isOwnPost) {
      try {
        const {
          NotificationService,
        } = require("../services/notificationService");

        const newCommentIndex =
          thread.comments.length - 1;

        const targetCommentId =
          `${rescueId}-${newCommentIndex}`;

        await NotificationService.sendNotification(
          postAuthorId,
          "Reply to your Discussion",
          `${commenterName} replied to your thread "${post.title}": "${text.substring(0, 40)}${text.length > 40 ? "..." : ""}"`,
          "info",
          targetCommentId,
          String(post._id)
        );

      } catch (err: any) {
        console.error(
          "[FORUM] Failed to send reply notification to post author:",
          err.message || err
        );
      }
    }

    // Format the updated comments for the frontend.
    const commentsFormatted = await Promise.all(
      thread.comments.map(
        async (comment: any, index: number) => {

          let cName = comment.userName || "";
          let cAvatar = "";
          let cRole = "";

          if (
            comment.userId &&
            comment.userId !== "guest" &&
            comment.userId !== "forum-guest"
          ) {
            const info = await getUserInfo(
              String(comment.userId)
            );

            if (!cName && info.name) {
              cName = info.name;
            }

            cAvatar = info.avatar || "";

            if (info.role === "vet") {
              cRole = "Vet";
            } else if (info.role === "ngo") {
              cRole = "NGO";
            }
          }

          if (!cName) {
            cName = "User";
          }

          return {
            id: `${thread.rescueId}-${index}`,
            userId: comment.userId || "guest",
            userName: cName,
            userAvatar: cAvatar,
            role: cRole,

            // Check whether this comment belongs to
            // the user who just added the comment.
            isMine:
              String(comment.userId) ===
              String(commenterId),

            text: comment.text,
            timestamp: comment.timestamp,
          };
        }
      )
    );

    res.json({
      message: "Comment added",

      thread: {
        rescueId: thread.rescueId,
        comments: commentsFormatted,
      },
    });
  }
);


// DELETE a discussion post
exports.deletePost = catchAsync(
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {

    const { postId } = req.params;

    // Only logged-in users can delete posts.
    const userId = req.user
      ? req.user.id
      : null;

    if (!userId) {
      res.status(401).json({
        error: "Unauthorized",
      });
      return;
    }

    const post = await ForumPost.findById(postId);

    if (!post) {
      res.status(404).json({
        error: "Post not found",
      });
      return;
    }

    // A user can delete only their own discussion post.
    if (
      post.userId &&
      String(post.userId) !== String(userId)
    ) {
      res.status(403).json({
        error: "You can only delete your own posts",
      });
      return;
    }

    // Delete the discussion post.
    await ForumPost.findByIdAndDelete(postId);

    // Delete the comments/thread belonging to that post as well.
    await Forum.findOneAndDelete({
      rescueId: postId,
    });

    console.log(
      `[FORUM] Post ${postId} deleted by user ${userId}`
    );

    res.json({
      message: "Post deleted successfully",
    });
  }
);


// DELETE a comment from a discussion thread
// Only the person who wrote the comment can delete it.
exports.deleteComment = catchAsync(
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {

    const rescueIdStr = String(
      req.params.rescueId
    );

    const commentIdStr = String(
      req.params.commentId
    );

    let userId = req.user
      ? req.user.id
      : null;

    // If the authentication middleware didn't provide the user,
    // try getting the user from the token.
    if (
      !userId &&
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      try {
        const jwt = require("jsonwebtoken");

        const decoded = jwt.verify(
          req.headers.authorization.split(" ")[1],
          process.env.JWT_SECRET as string
        ) as any;

        if (decoded && decoded.id) {
          userId = decoded.id;
        }
      } catch (err) { }
    }

    // A user must be logged in to delete a comment.
    if (!userId) {
      res.status(401).json({
        error:
          "Unauthorized. Please log in to delete comments.",
      });
      return;
    }

    // Find the discussion thread.
    const thread = await Forum.findOne({
      rescueId: rescueIdStr,
    });

    if (!thread) {
      res.status(404).json({
        error: "Thread not found",
      });
      return;
    }

    // Find the comment inside the thread.
    let commentIndex = -1;

    // The frontend normally sends IDs like:
    // postId-commentIndex
    //
    // Example:
    // 12345-2
    //
    // Here we take the last part as the comment index.
    if (commentIdStr.includes("-")) {

      const parts = commentIdStr.split("-");

      const idx = parseInt(
        parts[parts.length - 1],
        10
      );

      if (
        !isNaN(idx) &&
        idx >= 0 &&
        idx < thread.comments.length
      ) {
        commentIndex = idx;
      }
    }

    // Also support receiving just the comment index.
    if (
      commentIndex === -1 &&
      !isNaN(Number(commentIdStr))
    ) {
      const idx = Number(commentIdStr);

      if (
        idx >= 0 &&
        idx < thread.comments.length
      ) {
        commentIndex = idx;
      }
    }

    // If the previous methods didn't find it,
    // try the MongoDB subdocument ID.
    if (commentIndex === -1) {
      commentIndex = thread.comments.findIndex(
        (c: any) =>
          c._id &&
          String(c._id) === commentIdStr
      );
    }

    // The comment doesn't exist.
    if (commentIndex === -1) {
      res.status(404).json({
        error: "Comment not found",
      });
      return;
    }

    const targetComment =
      thread.comments[commentIndex];

    // Only the person who created the comment
    // is allowed to delete it.
    if (
      !targetComment.userId ||
      String(targetComment.userId) !== String(userId)
    ) {
      res.status(403).json({
        error:
          "You can only delete your own comments",
      });
      return;
    }

    // Remove the comment from the discussion thread.
    thread.comments.splice(commentIndex, 1);

    await thread.save();

    // Update the comment count on the discussion post.
    await ForumPost.findByIdAndUpdate(
      rescueIdStr,
      {
        commentCount: thread.comments.length,
      }
    );

    console.log(
      `[FORUM] Comment ${commentIdStr} in thread ${rescueIdStr} deleted by user ${userId}`
    );

    res.json({
      message: "Comment deleted successfully",
    });
  }
);