import express from "express";
import {
    getAnimalPosts,
    getAnimalPostById,
    getAnimalPostsByUser,
    createAnimalPost,
    updateAnimalPost,
    deleteAnimalPost,
    reportAnimalPost,
    getLostAnimals,
    createLostAnimal,
    getFoundAnimals,
    createFoundAnimal,
} from "../controllers/lostAndFoundController";

const { verifyToken } = require("../middleware/authMiddleware");
const { upload } = require("../config/gridfs");

const router = express.Router();

// GET all lost/found animal posts (supports ?status=lost|found, ?type=dog|cat|other, ?search=query, ?userId=id)
router.get("/", getAnimalPosts);

// Explicit status routes (placed BEFORE parametric /:id route)
router.get("/lost", getLostAnimals);
router.get("/found", getFoundAnimals);
router.post("/lost", verifyToken, upload.single("image"), createLostAnimal);
router.post("/found", verifyToken, upload.single("image"), createFoundAnimal);

// GET posts created by a specific user (placed BEFORE parametric /:id route)
router.get("/user/:userId", getAnimalPostsByUser);

// GET single lost/found animal post by ID
router.get("/:id", getAnimalPostById);

// POST create new animal post (authenticated)
router.post("/", verifyToken, upload.single("image"), createAnimalPost);

// PUT update animal post (authenticated)
router.put("/:id", verifyToken, upload.single("image"), updateAnimalPost);

// DELETE animal post (authenticated)
router.delete("/:id", verifyToken, deleteAnimalPost);

// POST report animal post
router.post("/:id/report", reportAnimalPost);

module.exports = router;
