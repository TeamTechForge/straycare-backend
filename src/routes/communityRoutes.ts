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
    deleteCommunityComment,
    getMyCommunityPosts,
    getSavedCommunityPosts,
    saveCommunityPost,
    unsaveCommunityPost,
    updateCommunityPost,
    deleteCommunityPost,
} from "../controllers/communityController";

const { verifyToken, optionalToken } = require("../middleware/authMiddleware");
const { upload } = require("../config/gridfs");

const router = Router();

// Admin endpoints (MUST be defined before /:id parameter route)
router.get("/admin/reports", verifyToken, getCommunityReports);         // GET   /api/community/admin/reports
router.get("/reports", verifyToken, getCommunityReports);               // GET   /api/community/reports
router.patch("/admin/reports/:reportId", verifyToken, updateCommunityReportStatus); // PATCH /api/community/admin/reports/:reportId

// Both creation paths are retained for compatibility with old and current clients.
router.post("/", verifyToken, upload.any(), createCommunityPost);           // POST   /api/community
router.post("/create", verifyToken, upload.any(), createCommunityPost);     // POST   /api/community/create
// Optional authentication lets public readers browse while signed-in users receive viewer flags.
router.get("/", optionalToken, getAllCommunityPosts);            // GET    /api/community
router.get("/mine", verifyToken, getMyCommunityPosts);           // GET    /api/community/mine
router.get("/saved", verifyToken, getSavedCommunityPosts);       // GET    /api/community/saved
router.post("/:id/like", verifyToken, likeCommunityPost);        // POST   /api/community/:id/like
router.delete("/:id/like", verifyToken, unlikeCommunityPost);    // DELETE /api/community/:id/like
router.get("/:id/comments", optionalToken, getCommunityComments); // GET    /api/community/:id/comments
router.post("/:id/comments", verifyToken, createCommunityComment); // POST  /api/community/:id/comments
router.delete("/:id/comments/:commentId", verifyToken, deleteCommunityComment); // DELETE /api/community/:id/comments/:commentId
router.post("/:id/save", verifyToken, saveCommunityPost);        // POST   /api/community/:id/save
router.delete("/:id/save", verifyToken, unsaveCommunityPost);    // DELETE /api/community/:id/save
router.put("/:id", verifyToken, upload.any(), updateCommunityPost); // PUT /api/community/:id
router.delete("/:id", verifyToken, deleteCommunityPost);         // DELETE /api/community/:id
// Keep parameterized routes last so they cannot capture fixed paths such as /mine or /saved.
router.get("/:id", optionalToken, getCommunityPostById);         // GET    /api/community/:id
router.post("/:id/report", verifyToken, reportCommunityPost);  // POST   /api/community/:id/report
router.patch("/:id/report", verifyToken, reportCommunityPost); // PATCH  /api/community/:id/report

// Community Routes for StrayCare API
module.exports = router;
export default router;
