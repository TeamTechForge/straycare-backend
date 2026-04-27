const express = require("express");
<<<<<<< HEAD
const multer = require("multer");
const path = require("path");

const router = express.Router();

// Local disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname)),
=======
const mongoose = require("mongoose");
const { upload, uploadToGridFs } = require("../config/gridfs");
const router = express.Router();

// UPLOAD IMAGES (GridFS)
router.post("/", upload.array("photos", 5), uploadToGridFs, (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: "No files uploaded" });
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
>>>>>>> 0af9fd1 (Merge nearby and image uploading part)
});

const upload = multer({ storage });

// Upload single image
router.post("/", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

module.exports = router;
