const { redisClient } = require("../config/redis");

const rateLimiter = (maxRequests, windowSeconds, keyPrefix = "rate") => {
  return async (req, res, next) => {
    try {
      const ip = req.ip;
      const key = `${keyPrefix}:${ip}`;

      const requests = await redisClient.incr(key);
      if (requests === 1) await redisClient.expire(key, windowSeconds);

      if (requests > maxRequests) {
        const ttl = await redisClient.ttl(key);
        return res.status(429).json({
          success: false,
          message: "Too many requests. Please try again later.",
          retryAfter: `${Math.ceil(ttl/60)} minutes`, // tells client exactly when to retry
        });
      }

      next();
    } catch (error) {
      console.error("Rate limiter error:", error.message);
      next(); // never block requests on Redis failure
    }
  };
};

module.exports = rateLimiter;