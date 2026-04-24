const Rescuer = require("../models/Rescuer");

exports.findNearbyRescuers = async (req, res) => {
  const { lat, lng } = req.query;

  const rescuers = await Rescuer.find({
    location: {
      $near: {
        $geometry: { type: "Point", coordinates: [lng, lat] },
        $maxDistance: 5000
      }
    }
  });

  res.json(rescuers);
};
