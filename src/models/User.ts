import mongoose from "mongoose";

/**
 * Interface representing a User document in the database.
 * Supports local and OAuth authentication, role management, and privacy controls.
 */
export interface IUser extends mongoose.Document {
  /** Full display name of the user */
  name: string;
  /** Unique email address (lowercased) */
  email: string;
  /** Phone number (required for local auth users, optional for Google auth) */
  phone?: string;
  /** Hashed password string (required for local auth users) */
  password?: string;
  /** User account role */
  role: "general_user" | "volunteer" | "ngo" | "vet" | "admin";
  /** Auth provider used to register/log in */
  authProvider: "local" | "google";
  /** Google OAuth subject ID if registered via Google Sign-In */
  googleId?: string;
  /** Optional legacy avatar image URL */
  avatar?: string;
  /** Flag indicating whether the user completed their profile setup */
  profileCompleted: boolean;
  /** Flag indicating whether the user selected their initial role */
  roleSelected: boolean;
  /** Approval status for privileged roles (e.g. volunteer, ngo, vet) */
  isApproved: boolean;
  /** Token for password reset requests */
  resetPasswordToken?: string;
  /** Expiration timestamp for resetPasswordToken */
  resetPasswordExpires?: Date;
  /** Privacy filter for direct messaging */
  messagingPrivacy: "everyone" | "contacts" | "relatedOnly" | "none";
  /** Privacy filter for voice calls */
  callingPrivacy: "everyone" | "contacts" | "relatedOnly" | "none";
  /** Profile picture URL */
  profileImage: string;
  /** Push notification device token (Expo push token) */
  pushToken?: string;
  /** Status flag for account standing (e.g. "active", "suspended") */
  accountStatus?: string;
  /** Associated organization name (populated dynamically) */
  organizationName?: string;
  /** Array of blocked user ObjectIds */
  blockedUsers?: mongoose.Types.ObjectId[];
  /** Document creation timestamp */
  createdAt: Date;
  /** Document last update timestamp */
  updatedAt: Date;
}

/**
 * Mongoose Schema definition for User documents.
 */
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

    // ── Chat & Call Privacy Controls ─────────────────────────────
    // Controls who can initiate a message or voice call with this user:
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
    accountStatus: {
      type: String,
      default: null,
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

// Compile or retrieve existing Mongoose model for User
const User = mongoose.models.User || mongoose.model<IUser>("User", userSchema);

// Export model directly for CommonJS require compatibility
module.exports = User;