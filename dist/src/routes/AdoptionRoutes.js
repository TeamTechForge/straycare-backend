"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adoptionController_1 = require("../controllers/adoptionController");
// @ts-ignore - Tells TypeScript to bypass checking this mixed-syntax export
const authMiddleware_1 = __importDefault(require("../middleware/authMiddleware"));
const router = (0, express_1.Router)();
router.get("/", adoptionController_1.getAllPosts);
router.get("/my", authMiddleware_1.default, adoptionController_1.getMyPosts);
router.get("/:postId", adoptionController_1.getPostById);
router.post("/", authMiddleware_1.default, adoptionController_1.createPost);
router.put("/:postId", authMiddleware_1.default, adoptionController_1.updatePost);
router.delete("/:postId", authMiddleware_1.default, adoptionController_1.deletePost);
module.exports = router;
//# sourceMappingURL=adoptionRoutes.js.map