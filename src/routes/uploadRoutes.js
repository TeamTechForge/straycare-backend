const express = require("express");
const mongoose = require("mongoose");

const {
  upload,
  uploadToGridFs,
} = require("../config/gridfs");

// Cloudinary config will be imported dynamically inside the handler when needed

const router = express.Router();


// =========================
// GRIDFS UPLOAD
// =========================

router.post(
  "/",
  upload.array("photos", 5),
  uploadToGridFs,
  (req, res) => {

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        message: "No files uploaded",
      });
    }

    const fileIds = req.files.map(
      (file) => String(file.id)
    );

    const files = req.files.map((file) => ({
      id: String(file.id),
      filename: file.filename,
      url: `/api/upload/files/${file.id}`,
    }));

    return res.status(201).json({
      fileIds,
      photos: fileIds,
      files,
    });
  }
);


// =========================
// CLOUDINARY UPLOAD (WITH GRIDFS FALLBACK)
// =========================

router.post(
  "/cloudinary",
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: "No file uploaded",
        });
      }

      const isCloudinaryConfigured =
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET;

      if (isCloudinaryConfigured) {
        const { cloudinary } = require("../config/cloudinary");

        const uploadStream = () => {
          return new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              {
                folder: "StrayCare_Profiles",
              },
              (error, result) => {
                if (error) return reject(error);
                resolve(result);
              }
            );
            const { Readable } = require("stream");
            Readable.from(req.file.buffer).pipe(stream);
          });
        };

        const result = await uploadStream();
        return res.json({
          url: result.secure_url || result.url,
        });
      } else {
        console.warn(
          "[Upload Warning] Cloudinary credentials not configured. Falling back to GridFS storage for /api/upload/cloudinary"
        );

        const { uploadSingleFileToGridFs } = require("../config/gridfs");
        const mongoose = require("mongoose");

        if (!mongoose.connection?.db) {
          return res.status(500).json({
            message: "Database connection not ready for fallback upload.",
          });
        }

        const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
          bucketName: "uploads",
        });

        const fileData = await uploadSingleFileToGridFs(bucket, req.file);
        const fileUrl = `${req.protocol}://${req.get("host")}/api/upload/files/${fileData.id}`;

        return res.json({
          url: fileUrl,
        });
      }
    } catch (error) {
      console.error("[Upload Error] Failed to process upload:", error);
      return res.status(500).json({
        message: "Failed to upload file",
        error: error.message,
      });
    }
  }
);


// =========================
// GET GRIDFS IMAGE BY ID
// =========================

router.get("/files/:id", async (req, res) => {

  try {

    const bucket = new mongoose.mongo.GridFSBucket(
      mongoose.connection.db,
      {
        bucketName: "uploads",
      }
    );

    const fileId = new mongoose.Types.ObjectId(
      req.params.id
    );

    const downloadStream =
      bucket.openDownloadStream(fileId);

    downloadStream.on("error", () => {
      return res
        .status(404)
        .json({
          message: "File not found",
        });
    });

    downloadStream.pipe(res);

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      message: "Error retrieving file",
      error: error.message,
    });

  }

});

module.exports = router;