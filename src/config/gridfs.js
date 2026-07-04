const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

console.log("MONGO_URI exists:", !!process.env.MONGO_URI);

const { Readable } = require("stream");

const mongoose = require("mongoose");
const multer = require("multer");

// MongoDB connection string from environment variables
const mongoURI = process.env.MONGO_URI;

if (!mongoURI) {
  console.error(
    "[GridFS] MONGO_URI is undefined. File uploads require a valid MongoDB URL."
  );
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 5,
    fileSize: 10 * 1024 * 1024,
  },
});

const createUploadFilename = (originalName = "file") => {
  const sanitized = String(originalName).replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}-${sanitized}`;
};

const uploadSingleFileToGridFs = (bucket, file) =>
  new Promise((resolve, reject) => {
    const filename = createUploadFilename(file.originalname);
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: file.mimetype,
      metadata: {
        originalName: file.originalname,
      },
    });

    uploadStream.on("error", reject);
    uploadStream.on("finish", () => {
      resolve({
        id: String(uploadStream.id),
        filename,
      });
    });

    Readable.from(file.buffer).pipe(uploadStream);
  });

const uploadToGridFs = async (req, res, next) => {
  try {
    if (!mongoURI) {
      return res.status(500).json({
        message: "File upload is unavailable because MONGO_URI is missing.",
      });
    }

    if (!req.files || req.files.length === 0) {
      return next();
    }

    if (!mongoose.connection?.db) {
      return res.status(500).json({
        message: "Database connection is not ready for file upload.",
      });
    }

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: "uploads",
    });

    const persistedFiles = [];
    for (const file of req.files) {
      persistedFiles.push(await uploadSingleFileToGridFs(bucket, file));
    }

    req.storedFiles = persistedFiles;

    // Preserve compatibility with existing controller logic expecting file.id.
    req.files = req.files.map((file, index) => ({
      ...file,
      id: persistedFiles[index].id,
      filename: persistedFiles[index].filename,
    }));

    return next();
  } catch (error) {
    console.error("[GridFS] Failed to persist files:", error.message);
    return res.status(500).json({
      message: "Failed to upload files",
      error: error.message,
    });
  }
};

module.exports = { upload, uploadToGridFs, uploadSingleFileToGridFs };
