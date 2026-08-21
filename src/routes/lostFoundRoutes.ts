import express from "express";

import {
    getAnimalPosts,
    getAnimalPostById,
    createAnimalPost,
    updateAnimalPost,
    deleteAnimalPost,
    reportAnimalPost,
} from "../controllers/lostAndFoundController";

const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

// Browsing reports and opening their details does not require an account.
router.get("/", getAnimalPosts);

router.get("/:id", getAnimalPostById);

// Creation, ownership-sensitive changes, and reporting require a verified identity.
router.post("/", verifyToken, createAnimalPost);

router.put("/:id", verifyToken, updateAnimalPost);

router.delete("/:id", verifyToken, deleteAnimalPost);

router.post("/:id/report", verifyToken, reportAnimalPost);

module.exports = router;
