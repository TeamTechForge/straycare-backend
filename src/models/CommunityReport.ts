import mongoose, {
    Document,
    Schema,
} from "mongoose";

export interface ICommunityReport extends Document {
    postId: mongoose.Types.ObjectId | string;

    reporterUserId: mongoose.Types.ObjectId | string;

    reason: string;

    postSnapshot: {
        title: string;
        content: string;
        category: string;
        imageUrl: string | null;
        authorName: string;
        submittedAt: Date;
    };

    status:
    | "pending"
    | "dismissed"
    | "action_taken";

    reviewedBy?: mongoose.Types.ObjectId | string | null;

    reviewedAt?: Date | null;

    createdAt: Date;

    updatedAt: Date;
}

const communityReportSchema =
    new Schema<ICommunityReport>(
        {
            // Community post being reported
            postId: {
                type: Schema.Types.ObjectId,
                ref: "CommunityPost",
                required: true,
            },

            // User who submitted the report
            reporterUserId: {
                type: Schema.Types.ObjectId,
                ref: "User",
                required: true,
            },

            // Selected report reason
            reason: {
                type: String,
                required: true,
                trim: true,
                maxlength: 300,
            },

            // Keep the evidence an admin needs even if the original post is
            // later edited or deleted. The image remains in external storage;
            // only its URL is duplicated here.
            postSnapshot: {
                title: {
                    type: String,
                    required: true,
                    trim: true,
                },
                content: {
                    type: String,
                    required: true,
                },
                category: {
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
                    required: true,
                    trim: true,
                },
                submittedAt: {
                    type: Date,
                    required: true,
                },
            },

            // Admin review status
            status: {
                type: String,

                enum: [
                    "pending",
                    "dismissed",
                    "action_taken",
                ],

                default: "pending",
            },

            // Admin who reviewed report
            reviewedBy: {
                type: Schema.Types.ObjectId,
                ref: "User",
                default: null,
            },

            // Date report was reviewed
            reviewedAt: {
                type: Date,
                default: null,
            },
        },
        {
            timestamps: true,
        }
    );

// Prevent same user reporting
// same post multiple times
communityReportSchema.index(
    {
        postId: 1,
        reporterUserId: 1,
    },
    {
        unique: true,
    }
);

export default mongoose.model<ICommunityReport>(
    "CommunityReport",
    communityReportSchema
);
