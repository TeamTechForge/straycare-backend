"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const CallLogController_1 = __importDefault(require("../controllers/CallLogController"));
const { verifyToken } = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// All call log routes require authentication
router.use(verifyToken);
router.get("/", CallLogController_1.default.getHistory);
router.put("/seen", CallLogController_1.default.markSeen);
router.delete("/", CallLogController_1.default.clearHistory);
router.delete("/:id", CallLogController_1.default.deleteLog);
module.exports = router;
//# sourceMappingURL=callLogRoutes.js.map