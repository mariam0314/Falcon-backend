const { createClient } = require("redis");

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
  disableOfflineQueue: true,
});

let isConnecting = false;

redisClient.on("connect", () => console.log("✅ Redis Connected"));
redisClient.on("error", (err) => {
  // Log once or throttle to avoid flood if Redis is not running
  if (!redisClient.hasWarned) {
    console.warn("⚠️ Redis not reachable (using memory fallback):", err.message);
    redisClient.hasWarned = true;
  }
});

// Connect safely on startup
(async () => {
  if (isConnecting) return;
  isConnecting = true;
  try {
    await redisClient.connect();
  } catch (err) {
    console.warn("⚠️ Redis connection deferred/unavailable:", err.message);
  }
})();

module.exports = redisClient;