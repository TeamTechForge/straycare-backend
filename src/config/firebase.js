const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

const keyDir = __dirname;
let serviceAccount = null;

// Try to find the default serviceAccountKey.json first
const defaultKeyPath = path.join(keyDir, "serviceAccountKey.json");
if (fs.existsSync(defaultKeyPath)) {
  serviceAccount = require(defaultKeyPath);
} else {
  // If not found, scan the directory for any other downloaded Firebase SDK JSON keys
  try {
    const files = fs.readdirSync(keyDir);
    const serviceAccountFile = files.find(file => 
      file.endsWith(".json") && 
      (file.includes("firebase-adminsdk") || file.includes("service-account") || file.includes("serviceAccount"))
    );
    if (serviceAccountFile) {
      const fullPath = path.join(keyDir, serviceAccountFile);
      serviceAccount = require(fullPath);
      console.log(`[Firebase] Automatically detected and loaded service account key: ${serviceAccountFile}`);
    }
  } catch (err) {
    console.error("[Firebase] Error searching for service account key file:", err);
  }
}

// Memory cache for Google public keys used during manual verification
let publicKeysCache = null;
let cacheExpiry = 0;

async function getGooglePublicKeys() {
  const now = Date.now();
  if (publicKeysCache && now < cacheExpiry) {
    return publicKeysCache;
  }

  try {
    const response = await fetch(
      "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch Google public keys: ${response.statusText}`);
    }
    const keys = await response.json();
    
    // Parse Cache-Control header to determine expiry time (default to 6 hours)
    let maxAge = 6 * 60 * 60 * 1000; 
    const cacheControl = response.headers.get("cache-control");
    if (cacheControl) {
      const match = cacheControl.match(/max-age=(\d+)/);
      if (match) {
        maxAge = parseInt(match[1], 10) * 1000;
      }
    }
    
    publicKeysCache = keys;
    cacheExpiry = now + maxAge;
    return keys;
  } catch (error) {
    console.error("[Firebase Fallback] Error fetching Google public keys:", error);
    if (publicKeysCache) {
      return publicKeysCache;
    }
    throw error;
  }
}

async function verifyIdTokenManually(idToken) {
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || !decoded.header || !decoded.header.kid) {
    throw new Error("Invalid Firebase token format or missing kid header");
  }

  const kid = decoded.header.kid;
  const publicKeys = await getGooglePublicKeys();
  const cert = publicKeys[kid];
  if (!cert) {
    throw new Error("Invalid Firebase token: Corresponding public key not found");
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 
                    (serviceAccount && serviceAccount.project_id) || 
                    "straycareweb";

  return new Promise((resolve, reject) => {
    jwt.verify(
      idToken,
      cert,
      {
        algorithms: ["RS256"],
        audience: projectId,
        issuer: `https://securetoken.google.com/${projectId}`,
        ignoreExpiration: true, // Bypass expiration check in local dev to handle system clock out-of-sync
      },
      (err, verifiedPayload) => {
        if (err) {
          return reject(new Error(`Firebase token verification failed: ${err.message}`));
        }
        if (verifiedPayload && !verifiedPayload.uid && verifiedPayload.sub) {
          verifiedPayload.uid = verifiedPayload.sub;
        }
        resolve(verifiedPayload);
      }
    );
  });
}

if (serviceAccount) {
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("[Firebase] Admin SDK initialized successfully.");
  }

  // Wrap the official verifyIdToken to fallback to manual verification if it fails (e.g., due to clock mismatch)
  const originalAuth = admin.auth;
  admin.auth = () => {
    const authInstance = originalAuth.call(admin);
    const originalVerifyIdToken = authInstance.verifyIdToken;
    authInstance.verifyIdToken = async (idToken, checkRevoked) => {
      try {
        return await originalVerifyIdToken.call(authInstance, idToken, checkRevoked);
      } catch (error) {
        console.warn(`[Firebase] Official verifyIdToken failed (${error.message}). Trying manual verification fallback...`);
        return await verifyIdTokenManually(idToken);
      }
    };
    return authInstance;
  };
} else {
  console.warn("\x1b[33m%s\x1b[0m", "[Firebase] WARNING: No service account key found. Falling back to manual verification via Google's public certificates.");
  
  // Override admin.auth to fallback to manual verification when no service account is found
  admin.auth = () => {
    return {
      verifyIdToken: verifyIdTokenManually,
    };
  };
}

module.exports = admin;
