"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const uploadFileToCloudinary = async (file) => {
    const isCloudinaryConfigured = process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET;
    if (isCloudinaryConfigured) {
        const { cloudinary } = require("../config/cloudinary");
        return new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream({
                folder: "StrayCare_Profiles",
                resource_type: "auto",
            }, (error, result) => {
                if (error)
                    return reject(error);
                resolve(result.secure_url || result.url);
            });
            const { Readable } = require("stream");
            Readable.from(file.buffer).pipe(stream);
        });
    }
    else {
        // Perform unsigned upload fallback to Cloudinary
        console.log("[Cloudinary Unsigned Fallback] Uploading:", file.originalname);
        const formData = new FormData();
        const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mimetype });
        formData.append("file", blob, file.originalname);
        formData.append("upload_preset", "straycare_report_images");
        const response = await fetch("https://api.cloudinary.com/v1_1/dljp2yzpb/auto/upload", {
            method: "POST",
            body: formData,
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Cloudinary fallback upload failed: ${errText}`);
        }
        const result = (await response.json());
        return result.secure_url || result.url;
    }
};
module.exports = { uploadFileToCloudinary };
//# sourceMappingURL=cloudinaryUpload.js.map