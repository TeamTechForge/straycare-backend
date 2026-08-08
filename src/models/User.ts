import mongoose from "mongoose";

interface IUser extends mongoose.Document {
  name: string;
  email: string;
  phone?: string;
  password?: string;
  role: "general_user" | "volunteer" | "ngo" | "vet" | "admin";
  authProvider: "local" | "google";
  googleId?: string;
  avatar?: string;
  profileCompleted: boolean;
  roleSelected: boolean;
  isApproved: boolean;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  messagingPrivacy: "everyone" | "contacts" | "relatedOnly" | "none";
  callingPrivacy: "everyone" | "contacts" | "relatedOnly" | "none";
  profileImage: string;
  pushToken?: string;
  organizationName?: string; // Added dynamically in getMe
  blockedUsers?: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      required: function (this: IUser) {
        return this.authProvider !== "google";
      },
    },

    password: {
      type: String,
      required: function (this: IUser) {
        return this.authProvider !== "google";
      },
    },

    role: {
      type: String,
      enum: ["general_user", "volunteer", "ngo", "vet", "admin"],
      default: "general_user",
    },

    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },

    googleId: {
      type: String,
      sparse: true,
    },

    avatar: {
      type: String,
    },

    profileCompleted: {
      type: Boolean,
      default: false,
    },

    roleSelected: {
      type: Boolean,
      default: false,
    },

    isApproved: {
      type: Boolean,
      default: false,
    },

    resetPasswordToken: String,
    resetPasswordExpires: Date,

    // ── Chat & Call privacy ─────────────────────────────────────
    // Controls who can initiate a message or voice call with this user.
    // "everyone"     — any authenticated user
    // "contacts"     — only users they've chatted with before
    // "relatedOnly"  — only users with a shared rescue/adoption/consult
    // "none"         — nobody (messages/calls blocked)
    messagingPrivacy: {
      type: String,
      enum: ["everyone", "contacts", "relatedOnly", "none"],
      default: "everyone",
    },
    callingPrivacy: {
      type: String,
      enum: ["everyone", "contacts", "relatedOnly", "none"],
      default: "contacts",
    },
    profileImage: {
      type: String,
      default: "",
    },
    pushToken: {
      type: String,
    },

    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
  }
);

export = mongoose.model<IUser>("User", userSchema);
