const mongoose = require("mongoose");

const forumSchema = new mongoose.Schema({
  rescueId: String,
  comments: [
    {
      userId: String,
      text: String,
      timestamp: { type: Date, default: Date.now }
    }
  ]
});

module.exports = mongoose.model("Forum", forumSchema);
