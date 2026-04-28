/**
 * Handles image uploads using Multer (local disk storage).
 * This route, Accepts a single image file under the field name "image", Saves it to /uploads folder, Returns a public URL for the uploaded file
 */
const express = require("express");
const multer = require("multer");
const path = require("path");

const router = express.Router();

//Multer Storage Configuration , specify the destination folder and how to name the files
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),

  filename: (req, file, cb) => {     // unique filename using Date.now()+Random number+Original file extension
    const uniqueName =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9) +
      path.extname(file.originalname);

    cb(null, uniqueName);
  },
});

// Initialize Multer with disk storage
const upload = multer({ storage });

//upload a single image file, filed name must be "image", and return the public URL to access the uploaded file
router.post("/", upload.single("image"), (req, res) => {
  // If no file was uploaded
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  // Build full URL to access the uploaded file
  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

  res.json({ url: fileUrl });
});

module.exports = router;
