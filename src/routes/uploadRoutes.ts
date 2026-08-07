/**
 * Handles image uploads using Multer (local disk storage).
 * This route, Accepts a single image file under the field name "image", Saves it to /uploads folder, Returns a public URL for the uploaded file
 */
const express = require("express");
const mongoose = require("mongoose");

import type { Request, Response } from "express";

const {
  upload,
  uploadToGridFs,
} = require("../config/gridfs");

const { uploadFileToCloudinary } = require("../utils/cloudinaryUpload");

const router = express.Router();

// =========================
// CLOUDINARY UPLOAD (ARRAY OF PHOTOS)
// =========================

router.post(
  "/",
  upload.array("photos", 5),
  async (req: Request, res: Response) => {
    try {
      if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
        return res.status(400).json({
          message: "No files uploaded",
        });
      }

      const uploadPromises = (req.files as Express.Multer.File[]).map((file: Express.Multer.File) => uploadFileToCloudinary(file));
      const urls: string[] = await Promise.all(uploadPromises);

      const fileIds = urls;
      const files = urls.map((url: string, index: number) => ({
        id: url,
        filename: (req.files as Express.Multer.File[])[index].originalname,
        url: url,
      }));

      return res.status(201).json({
        fileIds,
        photos: fileIds,
        files,
      });
    } catch (error: any) {
      console.error("[Upload Error] Failed to process uploads:", error);
      return res.status(500).json({
        message: "Failed to upload files",
        error: error.message,
      });
    }
  }
);


// =========================
// CLOUDINARY UPLOAD (SINGLE FILE)
// =========================

router.post(
  "/cloudinary",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: "No file uploaded",
        });
      }

      const url = await uploadFileToCloudinary(req.file);
      return res.json({ url });
    } catch (error: any) {
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

router.get("/files/:id", async (req: Request, res: Response) => {

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

  } catch (error: any) {

    console.error(error);

    return res.status(500).json({
      message: "Error retrieving file",
      error: error.message,
    });

  }
});

module.exports = router;
