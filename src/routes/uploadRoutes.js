const express = require("express");
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
});

module.exports = router;
