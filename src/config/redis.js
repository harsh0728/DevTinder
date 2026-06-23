const { createClient } = require("redis"); // ✅ destructure

const redisClient = createClient({
  url: process.env.REDIS_URL_UPSTASH,
});

redisClient.on("error", (err) => {
  console.error("Redis Error:", err);
});

const connectRedis = async () => {
  try {
    await redisClient.connect();
    console.log("Redis connected!");
  } catch (error) {
    console.error("Redis connection failed", error);
  }
};

module.exports = { redisClient, connectRedis }; // ✅ CommonJS export