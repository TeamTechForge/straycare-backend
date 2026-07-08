const jwt = require("jsonwebtoken");

async function testFetch() {
  try {
    const response = await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com");
    console.log("Status:", response.status);
    const keys = await response.json();
    console.log("Fetched keys successfully. Number of keys:", Object.keys(keys).length);
    console.log("Keys:", Object.keys(keys));
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

testFetch();
