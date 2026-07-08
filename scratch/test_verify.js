const jwt = require("jsonwebtoken");

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
      throw new Error(`Failed to fetch public keys: ${response.statusText}`);
    }
    const keys = await response.json();
    
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
    console.error("Error fetching Google public keys:", error);
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

  const projectId = process.env.FIREBASE_PROJECT_ID || "straycareweb";

  return new Promise((resolve, reject) => {
    jwt.verify(
      idToken,
      cert,
      {
        algorithms: ["RS256"],
        audience: projectId,
        issuer: `https://securetoken.google.com/${projectId}`,
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

async function run() {
  try {
    // Try to verify a junk token and see if it fails correctly with a clean signature/format validation error
    await verifyIdTokenManually("junk.token.here");
  } catch (error) {
    console.log("Expected validation error:", error.message);
  }
}

run();
