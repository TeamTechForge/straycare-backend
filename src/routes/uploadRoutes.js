const express = require("express");
const mongoose = require("mongoose");
const { upload } = require("../config/gridfs");
const router = express.Router();

// UPLOAD IMAGES (GridFS)
router.post("/", upload.array("photos", 5), (req, res) => {
  const fileIds = req.files.map((file) => file.id);
  res.json({ fileIds });
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
