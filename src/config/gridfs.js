// Handles image uploads using MongoDB GridFS.
const mongoose = require("mongoose");
const { GridFsStorage } = require("multer-gridfs-storage");
const multer = require("multer");

// MongoDB connection string from environment variables
const mongoURI = process.env.MONGO_URI;

// GridFS Storage Engine configuration for Multer
const storage = new GridFsStorage({
  url: mongoURI,

  // Configure how each file is stored
  file: (req, file) => {
    return {
      bucketName: "uploads", // GridFS bucket name (creates uploads.files + uploads.chunks)
      filename: `${Date.now()}-${file.originalname}`, // Unique filename
    };
  },
});

// Multer middleware using GridFS storage
const upload = multer({ storage });

// Export upload middleware for use in routes
module.exports = { upload };
