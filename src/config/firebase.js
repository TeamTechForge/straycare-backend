const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

// Prevent re-initialization when nodemon restarts
if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

module.exports = admin;
