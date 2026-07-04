const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const keyPath = path.join(__dirname, "serviceAccountKey.json");
let serviceAccount = null;

if (fs.existsSync(keyPath)) {
  serviceAccount = require(keyPath);
}

if (serviceAccount) {
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("[Firebase] Admin SDK initialized successfully.");
  }
} else {
  console.warn("\x1b[33m%s\x1b[0m", "[Firebase] WARNING: src/config/serviceAccountKey.json not found. Firebase Admin features (like Google Authentication token verification) will fail if invoked.");
}

module.exports = admin;
