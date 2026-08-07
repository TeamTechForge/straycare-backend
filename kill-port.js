

"use strict";

const { execSync } = require("child_process");
const PORT = process.env.PORT || 5000;

console.log(`[kill-port] Looking for process using port ${PORT}...`);

try {
  if (process.platform === "win32") {
    // Windows: use netstat to find the PID, then kill it
    const result = execSync(
      `netstat -ano | findstr :${PORT}`,
      { encoding: "utf8" }
    );

    // Extract unique PIDs from the netstat output
    const pids = [...new Set(
      result
        .split("\n")
        .map((line) => line.trim().split(/\s+/).pop()) // last column is PID
        .filter((pid) => pid && /^\d+$/.test(pid) && pid !== "0")
    )];

    if (!pids.length) {
      console.log(`[kill-port] ✅ No process is using port ${PORT}.`);
    } else {
      pids.forEach((pid) => {
        try {
          execSync(`taskkill /PID ${pid} /F`, { encoding: "utf8" });
          console.log(`[kill-port] ✅ Killed PID ${pid}`);
        } catch {
          console.warn(`[kill-port] ⚠️  Could not kill PID ${pid} (may already be gone)`);
        }
      });
    }
  } else {
    // Mac / Linux: use lsof to find and kill the PID
    const result = execSync(
      `lsof -ti tcp:${PORT}`,
      { encoding: "utf8" }
    ).trim();

    if (!result) {
      console.log(`[kill-port] ✅ No process is using port ${PORT}.`);
    } else {
      const pids = result.split("\n").filter(Boolean);
      pids.forEach((pid) => {
        execSync(`kill -9 ${pid}`);
        console.log(`[kill-port] ✅ Killed PID ${pid}`);
      });
    }
  }

  console.log(`[kill-port] Done. You can now run: npm start`);
} catch (err) {
  // If nothing is on the port, that's fine
  if (err.message.includes("No such process") || err.status === 1) {
    console.log(`[kill-port] ✅ Port ${PORT} is already free.`);
  } else {
    console.error("[kill-port] Error:", err.message);
  }
}
