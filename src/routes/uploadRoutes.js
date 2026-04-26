const express = require("express");
const mongoose = require("mongoose");
const { upload: gridfsUpload } = require("../config/gridfs");
const { upload: cloudinaryUpload } = require("../config/cloudinary");
const router = express.Router();

// UPLOAD IMAGES (GridFS)
router.post("/", gridfsUpload.array("photos", 5), (req, res) => {
  const fileIds = req.files.map((file) => file.id);
  res.json({ fileIds });
});

// UPLOAD TO CLOUDINARY
router.post("/cloudinary", cloudinaryUpload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }
  res.json({ url: req.file.path });
});

// GET IMAGE BY ID
router.get("/files/:id", async (req, res) => {
  try {
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: "uploads",
    });

    const fileId = new mongoose.Types.ObjectId(req.params.id);

    bucket.openDownloadStream(fileId).pipe(res);
  } catch (err) {
    res.status(404).json({ error: "File not found" });
  }
});

module.exports = router;
