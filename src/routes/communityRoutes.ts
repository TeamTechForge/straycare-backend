import { Router } from "express";
import {
    createCommunityPost,
    getAllCommunityPosts,
    getCommunityPostById,
    reportCommunityPost,
} from "../controllers/communityController";

const { verifyToken } = require("../middleware/authMiddleware");
const { upload } = require("../config/gridfs");

const router = Router();

router.post("/", upload.single("image"), createCommunityPost);           // POST   /api/community
router.post("/create", upload.single("image"), createCommunityPost);     // POST   /api/community/create
router.get("/", getAllCommunityPosts);            // GET    /api/community
router.get("/:id", getCommunityPostById);         // GET    /api/community/:id
router.post("/:id/report", verifyToken, reportCommunityPost);  // POST   /api/community/:id/report
router.patch("/:id/report", verifyToken, reportCommunityPost); // PATCH  /api/community/:id/report

module.exports = router;
export default router;