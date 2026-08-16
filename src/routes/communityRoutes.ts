import { Router } from "express";
import {
    createCommunityPost,
    getAllCommunityPosts,
    getCommunityPostById,
    reportCommunityPost,
    getCommunityReports,
    updateCommunityReportStatus,
    likeCommunityPost,
    unlikeCommunityPost,
    getCommunityComments,
    createCommunityComment,
    getMyCommunityPosts,
    getSavedCommunityPosts,
    saveCommunityPost,
    unsaveCommunityPost,
} from "../controllers/communityController";

const { verifyToken, optionalToken } = require("../middleware/authMiddleware");
const { upload } = require("../config/gridfs");

const router = Router();

// Admin endpoints (MUST be defined before /:id parameter route)
router.get("/admin/reports", verifyToken, getCommunityReports);         // GET   /api/community/admin/reports
router.get("/reports", verifyToken, getCommunityReports);               // GET   /api/community/reports
router.patch("/admin/reports/:reportId", verifyToken, updateCommunityReportStatus); // PATCH /api/community/admin/reports/:reportId

router.post("/", verifyToken, upload.any(), createCommunityPost);           // POST   /api/community
router.post("/create", verifyToken, upload.any(), createCommunityPost);     // POST   /api/community/create
router.get("/", optionalToken, getAllCommunityPosts);            // GET    /api/community
router.get("/mine", verifyToken, getMyCommunityPosts);           // GET    /api/community/mine
router.get("/saved", verifyToken, getSavedCommunityPosts);       // GET    /api/community/saved
router.post("/:id/like", verifyToken, likeCommunityPost);        // POST   /api/community/:id/like
router.delete("/:id/like", verifyToken, unlikeCommunityPost);    // DELETE /api/community/:id/like
router.get("/:id/comments", optionalToken, getCommunityComments); // GET    /api/community/:id/comments
router.post("/:id/comments", verifyToken, createCommunityComment); // POST  /api/community/:id/comments
router.post("/:id/save", verifyToken, saveCommunityPost);        // POST   /api/community/:id/save
router.delete("/:id/save", verifyToken, unsaveCommunityPost);    // DELETE /api/community/:id/save
router.get("/:id", optionalToken, getCommunityPostById);         // GET    /api/community/:id
router.post("/:id/report", verifyToken, reportCommunityPost);  // POST   /api/community/:id/report
router.patch("/:id/report", verifyToken, reportCommunityPost); // PATCH  /api/community/:id/report

// Community Routes for StrayCare API
module.exports = router;
export default router;
