const app = require("./src/app");
const connectDB = require("./src/config/db");
require("dotenv").config();

connectDB();

const PORT = process.env.PORT || 5000;

//  Mount routes BEFORE listen
const uploadRoutes = require("./src/routes/uploadRoutes");
const strayRoutes = require("./src/routes/strayRoutes");

app.use("/api/upload", uploadRoutes);
app.use("/api/stray", strayRoutes);

//  Expose server to LAN
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
