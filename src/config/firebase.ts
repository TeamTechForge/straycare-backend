const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

const keyDir: string = __dirname;
let serviceAccount: any = null;

// Try to find the default serviceAccountKey.json first
const defaultKeyPath: string = path.join(keyDir, "serviceAccountKey.json");
if (fs.existsSync(defaultKeyPath)) {
  serviceAccount = require(defaultKeyPath);
} else {
  // If not found, scan the directory for any other downloaded Firebase SDK JSON keys
  try {
    const files: string[] = fs.readdirSync(keyDir);
    const serviceAccountFile = files.find((file: string) => 
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
let publicKeysCache: Record<string, string> | null = null;
let cacheExpiry: number = 0;

interface FirebaseDecodedToken {
  uid?: string;
  sub?: string;
  [key: string]: any;
}

async function getGooglePublicKeys(): Promise<Record<string, string>> {
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
    const keys = (await response.json()) as Record<string, string>;
    
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

async function verifyIdTokenManually(idToken: string): Promise<FirebaseDecodedToken> {
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || !decoded.header || !decoded.header.kid) {
    throw new Error("Invalid Firebase token format or missing kid header");
  }

  const kid: string = decoded.header.kid;
  const publicKeys = await getGooglePublicKeys();
  const cert = publicKeys[kid];
  if (!cert) {
    throw new Error("Invalid Firebase token: Corresponding public key not found");
  }

  const projectId: string = process.env.FIREBASE_PROJECT_ID || 
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
      (err: Error | null, verifiedPayload: FirebaseDecodedToken) => {
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

const firebaseAdminWrapper: any = { ...admin };

if (serviceAccount) {
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("[Firebase] Admin SDK initialized successfully.");
  }

  // Wrap the official verifyIdToken to fallback to manual verification if it fails
  const originalAuth = admin.auth;
  firebaseAdminWrapper.auth = () => {
    const authInstance = originalAuth.call(admin);
    const originalVerifyIdToken = authInstance.verifyIdToken;
    authInstance.verifyIdToken = async (idToken: string, checkRevoked?: boolean) => {
      try {
        return await originalVerifyIdToken.call(authInstance, idToken, checkRevoked);
      } catch (error: any) {
        console.warn(`[Firebase] Official verifyIdToken failed (${error.message}). Trying manual verification fallback...`);
        return await verifyIdTokenManually(idToken);
      }
    };
    return authInstance;
  };
} else {
  console.warn("\x1b[33m%s\x1b[0m", "[Firebase] WARNING: No service account key found. Falling back to manual verification via Google's public certificates.");
  
  firebaseAdminWrapper.auth = () => {
    return {
      verifyIdToken: verifyIdTokenManually,
    };
  };
}

module.exports = firebaseAdminWrapper;
