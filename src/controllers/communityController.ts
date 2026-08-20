import { Request, Response } from "express";
import mongoose from "mongoose";

import CommunityPost from "../models/CommunityPost";
import CommunityReport from "../models/CommunityReport";
import CommunityLike from "../models/CommunityLike";
import CommunityComment from "../models/CommunityComment";
import SavedCommunityPost from "../models/SavedCommunityPost";
import User from "../models/User";
const Notification = require("../models/Notification");
const GeneralUserProfile = require("../models/GeneralUserProfile");
const VolunteerProfile = require("../models/VolunteerProfile");
const VetProfile = require("../models/VetProfile");
const NGOProfile = require("../models/NGOProfile");
const { uploadFileToCloudinary } = require("../utils/cloudinaryUpload");

interface UploadedFile {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    filename?: string;
}

type UploadRequest = Request & {
    file?: UploadedFile;
    files?: UploadedFile[] | Record<string, UploadedFile[]>;
};

const profileModels: Record<string, any> = {
    general_user: GeneralUserProfile,
    volunteer: VolunteerProfile,
    vet: VetProfile,
    ngo: NGOProfile,
};

const getAuthorDetails = async (authorUserId?: unknown) => {
    if (!authorUserId || !mongoose.Types.ObjectId.isValid(String(authorUserId))) {
        return null;
    }

    const user: any = await User.findById(authorUserId)
        .select("name profileImage avatar role")
        .lean();
    if (!user) return null;

    let profileImage = user.profileImage || user.avatar || "";
    const ProfileModel = profileModels[user.role];
    if (ProfileModel) {
        const profile: any = await ProfileModel.findOne({ userId: user._id })
            .select("profileImage")
            .lean();
        profileImage = profile?.profileImage || profileImage;
    }

    return { username: user.name, profileImage };
};

const serializePost = async (post: any, currentUserId?: string) => {
    const plain = typeof post.toObject === "function" ? post.toObject() : post;
    const authorId = plain.authorUserId ? String(plain.authorUserId) : null;
    const author = await getAuthorDetails(plain.authorUserId);

    const [likeCount, commentCount, isLiked, isSaved] = await Promise.all([
        CommunityLike.countDocuments({ postId: plain._id }),
        CommunityComment.countDocuments({ postId: plain._id }),
        currentUserId
            ? CommunityLike.exists({ postId: plain._id, userId: currentUserId })
            : Promise.resolve(null),
        currentUserId
            ? SavedCommunityPost.exists({ postId: plain._id, userId: currentUserId })
            : Promise.resolve(null),
    ]);

    return {
        ...plain,
        authorUserId: authorId,
        authorId,
        username: author?.username || plain.authorName || "Community User",
        profileImage: author?.profileImage || "",
        date: plain.submittedAt || plain.createdAt,
        likeCount,
        commentCount,
        isLiked: Boolean(isLiked),
        isSaved: Boolean(isSaved),
        isOwner: Boolean(currentUserId && authorId === currentUserId),
    };
};

const getAuthenticatedUserId = (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        res.status(401).json({ success: false, message: "Authentication required" });
        return null;
    }
    return userId;
};

export const getMyCommunityPosts = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = getAuthenticatedUserId(req, res);
        if (!userId) return;
        const posts = await CommunityPost.find({ authorUserId: userId }).sort({ submittedAt: -1 });
        res.status(200).json({ success: true, data: await Promise.all(posts.map((post) => serializePost(post, userId))) });
    } catch (error) {
        console.error("Get my community posts error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch your posts" });
    }
};

export const getSavedCommunityPosts = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = getAuthenticatedUserId(req, res);
        if (!userId) return;
        const saved = await SavedCommunityPost.find({ userId }).sort({ createdAt: -1 }).lean();
        const postIds = saved.map((item: any) => item.postId);
        const posts = await CommunityPost.find({ _id: { $in: postIds } });
        const byId = new Map(posts.map((post) => [String(post._id), post]));
        const orderedPosts = postIds.map((postId: any) => byId.get(String(postId))).filter(Boolean);
        res.status(200).json({ success: true, data: await Promise.all(orderedPosts.map((post) => serializePost(post, userId))) });
    } catch (error) {
        console.error("Get saved community posts error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch saved posts" });
    }
};

export const saveCommunityPost = async (req: Request, res: Response): Promise<void> => {
    try {
        const context = await getValidatedPostAndUser(req, res);
        if (!context) return;
        const { postId, userId } = context;
        await SavedCommunityPost.updateOne(
            { postId, userId },
            { $setOnInsert: { postId, userId } },
            { upsert: true }
        );
        res.status(200).json({ success: true, data: { postId, isSaved: true } });
    } catch (error) {
        console.error("Save community post error:", error);
        res.status(500).json({ success: false, message: "Failed to save community post" });
    }
};

export const unsaveCommunityPost = async (req: Request, res: Response): Promise<void> => {
    try {
        const context = await getValidatedPostAndUser(req, res);
        if (!context) return;
        const { postId, userId } = context;
        await SavedCommunityPost.deleteOne({ postId, userId });
        res.status(200).json({ success: true, data: { postId, isSaved: false } });
    } catch (error) {
        console.error("Unsave community post error:", error);
        res.status(500).json({ success: false, message: "Failed to remove saved post" });
    }
};

export const updateCommunityPost = async (req: Request, res: Response): Promise<void> => {
    try {
        const context = await getValidatedPostAndUser(req, res);
        if (!context) return;
        const { post, userId } = context;
        if (!post.authorUserId || String(post.authorUserId) !== userId) {
            res.status(403).json({ success: false, message: "Only the post owner may edit this post" });
            return;
        }

        const title = typeof req.body.title === "string" ? req.body.title.trim() : "";
        const category = typeof req.body.category === "string" ? req.body.category.trim() : "";
        const content = typeof req.body.content === "string" ? req.body.content.trim() : "";
        if (!title || !category || !content) {
            res.status(400).json({ success: false, message: "Title, category and content are required" });
            return;
        }

        const uploadRequest = req as UploadRequest;
        const file = uploadRequest.file ||
            (uploadRequest.files && Array.isArray(uploadRequest.files) ? uploadRequest.files[0] : null);
        const removeImage = req.body.removeImage === true || req.body.removeImage === "true";
        if (file) {
            post.imageUrl = await uploadFileToCloudinary(file);
        } else if (removeImage) {
            post.imageUrl = null;
        }
        post.title = title;
        post.category = category;
        post.content = content;
        await post.save();
        res.status(200).json({ success: true, data: await serializePost(post, userId) });
    } catch (error) {
        console.error("Update community post error:", error);
        res.status(500).json({ success: false, message: "Failed to update community post" });
    }
};

export const deleteCommunityPost = async (req: Request, res: Response): Promise<void> => {
    try {
        const context = await getValidatedPostAndUser(req, res);
        if (!context) return;
        const { post, postId, userId } = context;
        if (!post.authorUserId || String(post.authorUserId) !== userId) {
            res.status(403).json({ success: false, message: "Only the post owner may delete this post" });
            return;
        }

        await Promise.all([
            CommunityLike.deleteMany({ postId }),
            CommunityComment.deleteMany({ postId }),
            SavedCommunityPost.deleteMany({ postId }),
            Notification.deleteMany({ postId }),
            post.deleteOne(),
        ]);
        res.status(200).json({ success: true, message: "Community post deleted", data: { postId } });
    } catch (error) {
        console.error("Delete community post error:", error);
        res.status(500).json({ success: false, message: "Failed to delete community post" });
    }
};

const serializeComment = async (comment: any, currentUserId?: string, postAuthorId?: string) => {
    const plain = typeof comment.toObject === "function" ? comment.toObject() : comment;
    const commenter = await getAuthorDetails(plain.userId);
    const isCommentOwner = currentUserId ? String(plain.userId) === String(currentUserId) : false;
    const isPostOwner = postAuthorId && currentUserId ? String(postAuthorId) === String(currentUserId) : false;

    return {
        _id: String(plain._id),
        postId: String(plain.postId),
        userId: String(plain.userId),
        parentCommentId: plain.parentCommentId ? String(plain.parentCommentId) : null,
        username: commenter?.username || "Community User",
        profileImage: commenter?.profileImage || "",
        content: plain.content,
        canDelete: isCommentOwner || isPostOwner,
        createdAt: plain.createdAt,
        updatedAt: plain.updatedAt,
    };
};

export const getCommunityComments = async (req: Request, res: Response): Promise<void> => {
    try {
        const postId = req.params.id;
        const currentUserId = req.user?.id;
        if (typeof postId !== "string" || !mongoose.Types.ObjectId.isValid(postId)) {
            res.status(400).json({ success: false, message: "Invalid post ID" });
            return;
        }
        const post = await CommunityPost.findById(postId);
        if (!post) {
            res.status(404).json({ success: false, message: "Post not found" });
            return;
        }

        const comments = await CommunityComment.find({ postId }).sort({ createdAt: 1 });
        res.status(200).json({
            success: true,
            data: await Promise.all(
                comments.map((c) =>
                    serializeComment(
                        c,
                        currentUserId,
                        post.authorUserId ? String(post.authorUserId) : undefined
                    )
                )
            ),
            commentCount: comments.length,
        });
    } catch (error) {
        console.error("Get community comments error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch comments" });
    }
};

export const createCommunityComment = async (req: Request, res: Response): Promise<void> => {
    try {
        const context = await getValidatedPostAndUser(req, res);
        if (!context) return;

        const content = typeof req.body.content === "string" ? req.body.content.trim() : "";
        const parentCommentId =
            typeof req.body.parentCommentId === "string" &&
                mongoose.Types.ObjectId.isValid(req.body.parentCommentId)
                ? new mongoose.Types.ObjectId(req.body.parentCommentId)
                : null;

        if (!content) {
            res.status(400).json({ success: false, message: "Comment content is required" });
            return;
        }
        if (content.length > 1000) {
            res.status(400).json({ success: false, message: "Comment cannot exceed 1000 characters" });
            return;
        }

        const { postId, userId, post, user } = context;
        const comment = await CommunityComment.create({ postId, userId, parentCommentId, content });
        const ownerId = post.authorUserId ? String(post.authorUserId) : null;

        if (ownerId && ownerId !== userId) {
            const preview = content.length > 60 ? `${content.slice(0, 60)}…` : content;
            try {
                await Notification.updateOne(
                    { type: "post_comment", commentId: comment._id },
                    {
                        $setOnInsert: {
                            userId: ownerId,
                            actorUserId: userId,
                            type: "post_comment",
                            postId,
                            commentId: comment._id,
                            title: "New post comment",
                            message: `${user.name} commented on your post: ${preview}`,
                            event: "post_comment",
                            read: false,
                        },
                    },
                    { upsert: true }
                );
            } catch (notificationError) {
                console.error("Create comment notification error:", notificationError);
            }
        }

        const commentCount = await CommunityComment.countDocuments({ postId });
        res.status(201).json({
            success: true,
            data: await serializeComment(comment, userId, ownerId || undefined),
            commentCount,
        });
    } catch (error) {
        console.error("Create community comment error:", error);
        res.status(500).json({ success: false, message: "Failed to create comment" });
    }
};

export const deleteCommunityComment = async (req: Request, res: Response): Promise<void> => {
    try {
        const postId = req.params.id;
        const commentId = req.params.commentId;
        const userId = req.user?.id;

        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            res.status(401).json({ success: false, message: "Authentication required" });
            return;
        }
        if (
            typeof postId !== "string" ||
            typeof commentId !== "string" ||
            !mongoose.Types.ObjectId.isValid(postId as string) ||
            !mongoose.Types.ObjectId.isValid(commentId as string)
        ) {
            res.status(400).json({ success: false, message: "Invalid post or comment ID" });
            return;
        }

        const [post, comment] = await Promise.all([
            CommunityPost.findById(postId),
            CommunityComment.findById(commentId),
        ]);

        if (!post) {
            res.status(404).json({ success: false, message: "Post not found" });
            return;
        }
        if (!comment) {
            res.status(404).json({ success: false, message: "Comment not found" });
            return;
        }

        const isCommentAuthor = String(comment.userId) === String(userId);
        const isPostOwner = post.authorUserId && String(post.authorUserId) === String(userId);

        if (!isCommentAuthor && !isPostOwner) {
            res.status(403).json({ success: false, message: "You are not authorized to delete this comment" });
            return;
        }

        // Delete comment and any nested replies
        await Promise.all([
            comment.deleteOne(),
            CommunityComment.deleteMany({ parentCommentId: commentId }),
            Notification.deleteMany({ commentId }),
        ]);

        const commentCount = await CommunityComment.countDocuments({ postId });
        res.status(200).json({
            success: true,
            message: "Comment deleted successfully",
            data: { commentId, commentCount },
        });
    } catch (error) {
        console.error("Delete community comment error:", error);
        res.status(500).json({ success: false, message: "Failed to delete comment" });
    }
};

const getValidatedPostAndUser = async (req: Request, res: Response) => {
    const postId = req.params.id;
    const userId = req.user?.id;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        res.status(401).json({ success: false, message: "Authentication required" });
        return null;
    }
    if (typeof postId !== "string" || !mongoose.Types.ObjectId.isValid(postId)) {
        res.status(400).json({ success: false, message: "Invalid post ID" });
        return null;
    }

    const [post, user] = await Promise.all([
        CommunityPost.findById(postId),
        User.findById(userId).select("name"),
    ]);
    if (!user) {
        res.status(401).json({ success: false, message: "Authenticated user not found" });
        return null;
    }
    if (!post) {
        res.status(404).json({ success: false, message: "Post not found" });
        return null;
    }

    return { postId, userId, post, user };
};

export const likeCommunityPost = async (req: Request, res: Response): Promise<void> => {
    try {
        const context = await getValidatedPostAndUser(req, res);
        if (!context) return;

        const { postId, userId, post, user } = context;
        const likeResult = await CommunityLike.updateOne(
            { postId, userId },
            { $setOnInsert: { postId, userId } },
            { upsert: true }
        );
        const created = likeResult.upsertedCount === 1;

        const ownerId = post.authorUserId ? String(post.authorUserId) : null;
        if (created && ownerId && ownerId !== userId) {
            await Notification.updateOne(
                { userId: ownerId, actorUserId: userId, type: "post_like", postId },
                {
                    $setOnInsert: {
                        userId: ownerId,
                        actorUserId: userId,
                        type: "post_like",
                        postId,
                        title: "New post like",
                        message: `${user.name} liked your post.`,
                        event: "post_like",
                        read: false,
                    },
                },
                { upsert: true }
            );
        }

        const likeCount = await CommunityLike.countDocuments({ postId });
        res.status(created ? 201 : 200).json({
            success: true,
            data: { postId, isLiked: true, likeCount },
        });
    } catch (error) {
        console.error("Like community post error:", error);
        res.status(500).json({ success: false, message: "Failed to like community post" });
    }
};

export const unlikeCommunityPost = async (req: Request, res: Response): Promise<void> => {
    try {
        const context = await getValidatedPostAndUser(req, res);
        if (!context) return;

        const { postId, userId } = context;
        await CommunityLike.deleteOne({ postId, userId });
        const likeCount = await CommunityLike.countDocuments({ postId });

        res.status(200).json({
            success: true,
            data: { postId, isLiked: false, likeCount },
        });
    } catch (error) {
        console.error("Unlike community post error:", error);
        res.status(500).json({ success: false, message: "Failed to unlike community post" });
    }
};

// ─────────────────────────────────────────────
// POST /api/community/create
// Create a new community post
// ─────────────────────────────────────────────

export const createCommunityPost = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const authorUserId = req.user?.id;
        if (!authorUserId || !mongoose.Types.ObjectId.isValid(authorUserId)) {
            res.status(401).json({ success: false, message: "Authentication required to create a post" });
            return;
        }

        const author = await User.findById(authorUserId).select("_id");
        if (!author) {
            res.status(401).json({ success: false, message: "Authenticated user not found" });
            return;
        }

        let imageUrl: string | null =
            req.body.imageUrl ||
            req.body.image ||
            null;

        const uploadRequest = req as UploadRequest;
        const file =
            uploadRequest.file ||
            (uploadRequest.files && Array.isArray(uploadRequest.files) && uploadRequest.files.length > 0
                ? uploadRequest.files[0]
                : null);

        if (file) {
            try {
                imageUrl = await uploadFileToCloudinary(file);
            } catch (fileErr) {
                console.error("Cloudinary upload error:", fileErr);
                res.status(502).json({
                    success: false,
                    message: "The post image could not be uploaded. Please try again.",
                });
                return;
            }
        }

        const {
            title,
            category,
            content,
        } = req.body;

        const trimmedTitle = typeof title === "string" ? title.trim() : "";
        const trimmedCategory = typeof category === "string" ? category.trim() : "";
        const trimmedContent = typeof content === "string" ? content.trim() : "";

        // Basic validation
        if (!trimmedTitle || !trimmedCategory || !trimmedContent) {
            res.status(400).json({
                success: false,
                message:
                    "Title, category and content are required",
            });
            return;
        }

        const post = new CommunityPost({
            authorUserId,
            title: trimmedTitle,
            category: trimmedCategory,
            content: trimmedContent,
            imageUrl,
            submittedAt: new Date(),
        });

        const savedPost = await post.save();

        res.status(201).json({
            success: true,
            data: await serializePost(savedPost, authorUserId),
        });
    } catch (error) {
        console.error(
            "Create community post error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to create community post",
        });
    }
};

// ─────────────────────────────────────────────
// GET /api/community
// Get all community posts
// ─────────────────────────────────────────────

export const getAllCommunityPosts = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const posts =
            await CommunityPost.find().sort({
                submittedAt: -1,
            });

        const data = await Promise.all(posts.map((post) => serializePost(post, req.user?.id)));

        res.status(200).json({
            success: true,
            data,
        });
    } catch (error) {
        console.error(
            "Get community posts error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to fetch community posts",
        });
    }
};

// ─────────────────────────────────────────────
// GET /api/community/:id
// Get one community post
// ─────────────────────────────────────────────

export const getCommunityPostById = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const id = req.params.id;

        if (typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
            res.status(400).json({ success: false, message: "Invalid post ID" });
            return;
        }

        const post =
            await CommunityPost.findById(id);

        if (!post) {
            res.status(404).json({
                success: false,
                message: "Post not found",
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: await serializePost(post, req.user?.id),
        });
    } catch (error) {
        console.error(
            "Get community post error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to fetch community post",
        });
    }
};

// ─────────────────────────────────────────────
// POST /api/community/:id/report
// Report a community post
//
// Requires verifyToken middleware.
//
// User sends:
// {
//     "reason": "Spam or irrelevant"
// }
//
// Backend gets:
// postId        -> req.params.id
// reporter ID   -> req.user.id
// reason        -> req.body.reason
// ─────────────────────────────────────────────

export const reportCommunityPost = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const postId = req.params.id;

        const { reason } = req.body;

        // verifyToken middleware creates:
        //
        // req.user = {
        //     id: decoded.id,
        //     role: decoded.role
        // }
        //
        // Therefore, NEVER trust a userId sent
        // from the frontend for reporting.
        const reporterUserId =
            req.user?.id;

        // ─────────────────────────────────────
        // 1. CHECK AUTHENTICATION
        // ─────────────────────────────────────

        if (!reporterUserId) {
            res.status(401).json({
                success: false,
                message:
                    "Authentication required to report a post",
            });
            return;
        }

        if (typeof postId !== "string" || !mongoose.Types.ObjectId.isValid(postId)) {
            res.status(400).json({ success: false, message: "Invalid post ID" });
            return;
        }

        // ─────────────────────────────────────
        // 2. VALIDATE REPORT REASON
        // ─────────────────────────────────────

        if (
            !reason ||
            typeof reason !== "string" ||
            reason.trim().length === 0
        ) {
            res.status(400).json({
                success: false,
                message:
                    "Report reason is required",
            });
            return;
        }

        if (reason.trim().length > 300) {
            res.status(400).json({
                success: false,
                message:
                    "Report reason cannot exceed 300 characters",
            });
            return;
        }

        // ─────────────────────────────────────
        // 3. CHECK THAT POST EXISTS
        // ─────────────────────────────────────

        const post =
            await CommunityPost.findById(
                postId
            );

        if (!post) {
            res.status(404).json({
                success: false,
                message: "Post not found",
            });
            return;
        }

        if (post.authorUserId && String(post.authorUserId) === reporterUserId) {
            res.status(403).json({ success: false, message: "You cannot report your own post" });
            return;
        }

        // ─────────────────────────────────────
        // 4. CHECK FOR DUPLICATE REPORT
        // ─────────────────────────────────────
        //
        // Same user should not be able to
        // report the same post repeatedly.

        const existingReport =
            await CommunityReport.findOne({
                postId,
                reporterUserId,
            });

        if (existingReport) {
            res.status(409).json({
                success: false,
                message:
                    "You have already reported this post",
            });
            return;
        }

        // ─────────────────────────────────────
        // 5. CREATE REPORT
        // ─────────────────────────────────────

        const reportedAuthor = await getAuthorDetails(post.authorUserId);
        const report =
            await CommunityReport.create({
                postId,
                reporterUserId,

                reason: reason.trim(),

                // Store a moderation snapshot so the reported evidence is
                // still available if the community post changes or is removed.
                postSnapshot: {
                    title: post.title,
                    content: post.content,
                    category: post.category,
                    imageUrl: post.imageUrl,
                    authorName: reportedAuthor?.username || post.authorName || "Community User",
                    submittedAt: post.submittedAt,
                },

                // Admin will review this later
                status: "pending",
            });

        // ─────────────────────────────────────
        // 6. RETURN SUCCESS RESPONSE
        // ─────────────────────────────────────

        res.status(201).json({
            success: true,

            message:
                "Post reported successfully",

            data: {
                // MongoDB automatically creates
                // the unique report ID.
                reportId: report._id,

                postId:
                    report.postId,

                reporterUserId:
                    report.reporterUserId,

                reason:
                    report.reason,

                postSnapshot:
                    report.postSnapshot,

                status:
                    report.status,

                createdAt:
                    report.createdAt,
            },
        });
    } catch (error: any) {
        // Extra protection for the unique
        // postId + reporterUserId database index.
        if (error?.code === 11000) {
            res.status(409).json({
                success: false,
                message:
                    "You have already reported this post",
            });
            return;
        }

        console.error(
            "Report community post error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to report community post",
        });
    }
};

// ─────────────────────────────────────────────
// GET /api/community/admin/reports
// Admin endpoint: Get all community post reports with populated post details
// ─────────────────────────────────────────────

export const getCommunityReports = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { status } = req.query;

        const filter: any = {};
        if (status && typeof status === "string") {
            filter.status = status;
        }

        const reports = await CommunityReport.find(filter)
            .populate("postId")
            .populate("reporterUserId", "name email username role")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: reports,
        });
    } catch (error) {
        console.error("Get community reports error:", error);
        res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to fetch community reports",
        });
    }
};

// ─────────────────────────────────────────────
// PATCH /api/community/admin/reports/:reportId
// Admin endpoint: Update community report review status
// ─────────────────────────────────────────────

export const updateCommunityReportStatus = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { reportId } = req.params;
        const { status } = req.body;
        const reviewerId = req.user?.id;

        if (!status || !["pending", "dismissed", "action_taken"].includes(status)) {
            res.status(400).json({
                success: false,
                message: "Valid status ('pending', 'dismissed', 'action_taken') is required",
            });
            return;
        }

        if (typeof reportId !== "string" || !mongoose.Types.ObjectId.isValid(reportId)) {
            res.status(400).json({ success: false, message: "Invalid report ID" });
            return;
        }

        const report = await CommunityReport.findByIdAndUpdate(
            reportId,
            {
                status,
                reviewedBy: reviewerId || null,
                reviewedAt: new Date(),
            },
            { new: true }
        ).populate("postId");

        if (!report) {
            res.status(404).json({
                success: false,
                message: "Community report not found",
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: `Report status updated to ${status}`,
            data: report,
        });
    } catch (error) {
        console.error("Update community report error:", error);
        res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to update community report",
        });
    }
};
// End of Community Controller
