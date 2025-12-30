// src/controllers/strayController.js

// 1. Report a Stray Animal
exports.reportStray = async (req, res) => {
    try {
        const { type, description, latitude, longitude, imageUrl } = req.body;

        if (!latitude || !longitude) {
            return res.status(400).json({ message: "Location (lat/lng) is required." });
        }

        // TODO: Replace this with your actual MongoDB model later
        const newReport = {
            id: Date.now(),
            type,
            description,
            location: { latitude, longitude },
            imageUrl,
            status: "Reported",
            date: new Date()
        };

        res.status(201).json({
            message: "Stray reported successfully",
            data: newReport
        });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// 2. Get Map Locations
exports.getStrayLocations = async (req, res) => {
    try {
        // Dummy data for testing map integration
        const locations = [
            { id: 1, type: "Dog", lat: 6.9271, lng: 79.8612, status: "Injured" },
            { id: 2, type: "Cat", lat: 6.7106, lng: 79.9074, status: "Safe" }
        ];
        res.status(200).json(locations);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};