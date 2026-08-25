import express from "express";

import {
    getAnimalPosts,
    getLostAnimals,
    getFoundAnimals,
    getAnimalPostById,
    createAnimalPost,
    updateAnimalPost,
    deleteAnimalPost,
    reportAnimalPost,
} from "../controllers/lostAndFoundController";

const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", getAnimalPosts);
router.get("/lost", getLostAnimals);
router.get("/found", getFoundAnimals);

router.get("/:id", getAnimalPostById);

router.post("/", verifyToken, createAnimalPost);

router.put("/:id", verifyToken, updateAnimalPost);

router.delete("/:id", verifyToken, deleteAnimalPost);

router.post("/:id/report", verifyToken, reportAnimalPost);

module.exports = router;