import mongoose, {
    Document,
    Schema,
} from "mongoose";

// ─────────────────────────────────────────────
// COMMUNITY POST TYPE
// ─────────────────────────────────────────────

export interface ICommunityPost
    extends Document {
    authorUserId?: mongoose.Types.ObjectId;

    title: string;

    category: string;

    content: string;

    imageUrl: string | null;

    authorName?: string;

    submittedAt: Date;

    createdAt: Date;

    updatedAt: Date;
}

// ─────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────

const communityPostSchema =
    new Schema<ICommunityPost>(
        {
            authorUserId: {
                type: Schema.Types.ObjectId,
                ref: "User",
                index: true,
            },

            title: {
                type: String,
                required: true,
                trim: true,
            },

            category: {
                type: String,
                required: true,
                default: "Pet Care Tips",
                trim: true,
            },

            content: {
                type: String,
                required: true,
                trim: true,
            },

            imageUrl: {
                type: String,
                default: null,
            },

            authorName: {
                type: String,
                trim: true,
            },

            submittedAt: {
                type: Date,
                required: true,
                default: Date.now,
            },
        },
        {
            timestamps: true,
        }
    );

// ─────────────────────────────────────────────
// MODEL
// ─────────────────────────────────────────────

const CommunityPost =
    mongoose.model<ICommunityPost>(
        "CommunityPost",
        communityPostSchema
    );

export default CommunityPost;
