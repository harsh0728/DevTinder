const { createClient } = require("redis");

const redisClient = createClient({
  url: process.env.REDIS_URL,
  // Use RESP2 protocol for compatibility with older Redis versions (< 7.0)
  // The default RESP3 uses HELLO command which is not supported in Redis < 7.0
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error("Redis max reconnection attempts reached");
        return new Error("Max reconnection attempts reached");
      }
      return Math.min(retries * 100, 3000);
    },
  },
});

redisClient.on("error", (err) => {
  console.error("Redis Error:", err);
});

redisClient.on("connect", () => {
  console.log("Redis connecting...");
});

redisClient.on("ready", () => {
  console.log("Redis ready!");
});

redisClient.on("reconnecting", () => {
  console.log("Redis reconnecting...");
});

redisClient.on("end", () => {
  console.log("Redis connection closed");
});

const connectRedis = async () => {
  try {
    await redisClient.connect();
    console.log("Redis connected!");
  } catch (error) {
    console.error("Redis connection failed:", error.message);
    // Don't throw - let the app continue without Redis
  }
};

module.exports = { redisClient, connectRedis };