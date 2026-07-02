/**
 * Handles image uploads using Multer (local disk storage).
 * This route, Accepts a single image file under the field name "image", Saves it to /uploads folder, Returns a public URL for the uploaded file
 */
const express = require("express");
const mongoose = require("mongoose");

const {
  upload,
  uploadToGridFs,
} = require("../config/gridfs");

const {
  upload: cloudinaryUpload,
} = require("../config/cloudinary");

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
// CLOUDINARY UPLOAD
// =========================

router.post(
  "/cloudinary",
  cloudinaryUpload.single("file"),
  (req, res) => {

    if (!req.file) {
      return res.status(400).json({
        message: "No file uploaded",
      });
    }

    return res.json({
      url: req.file.path,
    });

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

  const fileIds = req.files.map((file) => String(file.id));
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

});

module.exports = router;
