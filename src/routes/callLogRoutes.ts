import { Router } from "express";
import CallLogController from "../controllers/CallLogController";
const { verifyToken } = require("../middleware/authMiddleware");

const router = Router();

// All call log routes require authentication
router.use(verifyToken);

router.get("/", CallLogController.getHistory);
router.put("/seen", CallLogController.markSeen);
router.delete("/", CallLogController.clearHistory);
router.delete("/:id", CallLogController.deleteLog);

module.exports = router;
