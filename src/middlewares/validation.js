/**
 * Validation middleware for common query parameters
 */

// Cursor-based pagination validation
const validatePagination = (req, res, next) => {
  const { cursor, limit } = req.query;

  // Validate limit
  if (limit !== undefined) {
    const parsedLimit = parseInt(limit, 10);
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return res.status(400).json({
        success: false,
        message: "Limit must be a number between 1 and 100"
      });
    }
    req.query.limit = parsedLimit;
  } else {
    req.query.limit = 50; // Default limit
  }

  // Validate cursor (should be a valid MongoDB ObjectId if provided)
  if (cursor !== undefined) {
    if (typeof cursor !== "string" || cursor.length !== 24) {
      return res.status(400).json({
        success: false,
        message: "Invalid cursor format"
      });
    }
    // Additional check for valid hex
    if (!/^[0-9a-fA-F]{24}$/.test(cursor)) {
      return res.status(400).json({
        success: false,
        message: "Invalid cursor format"
      });
    }
  }

  next();
};

// Rate limiting configuration
const RATE_LIMITS = {
  // API rate limits (per IP per minute)
  api: {
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: "Too many requests, please try again later"
  },
  // Auth rate limits (more reasonable)
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 attempts per 15 minutes (was 10)
    message: "Too many authentication attempts, please try again later"
  },
  // Login rate limits (stricter)
  login: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 attempts per 15 minutes
    message: "Too many login attempts, please try again later"
  },
  // Logout rate limits (very lenient)
  logout: {
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 attempts per minute
    message: "Too many logout attempts, please try again later"
  },
  // Message sending rate limits (per user per second)
  message: {
    windowMs: 1000, // 1 second
    max: 30, // 30 messages per second
    message: "Rate limit exceeded. Please slow down."
  }
};

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore = new Map();

// Generic rate limiter factory
const createRateLimiter = (config) => {
  return (req, res, next) => {
    const key = req.ip + (req.user ? `:${req.user._id}` : "");
    const now = Date.now();
    const windowStart = now - config.windowMs;

    let userLimit = rateLimitStore.get(key);

    if (!userLimit) {
      userLimit = { count: 0, windowStart: now };
      rateLimitStore.set(key, userLimit);
    }

    // Reset window if expired
    if (userLimit.windowStart < windowStart) {
      userLimit.count = 0;
      userLimit.windowStart = now;
    }

    userLimit.count++;

    // Set rate limit headers
    res.set({
      "X-RateLimit-Limit": config.max,
      "X-RateLimit-Remaining": Math.max(0, config.max - userLimit.count),
      "X-RateLimit-Reset": new Date(userLimit.windowStart + config.windowMs).toISOString()
    });

    if (userLimit.count > config.max) {
      return res.status(429).json({
        success: false,
        message: config.message,
        retryAfter: Math.ceil((userLimit.windowStart + config.windowMs - now) / 1000)
      });
    }

    next();
  };
};

// Export rate limiters
const apiRateLimiter = createRateLimiter(RATE_LIMITS.api);
const authRateLimiter = createRateLimiter(RATE_LIMITS.auth);
const loginRateLimiter = createRateLimiter(RATE_LIMITS.login);
const logoutRateLimiter = createRateLimiter(RATE_LIMITS.logout);

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, limit] of rateLimitStore.entries()) {
    if (limit.windowStart < now - 60000) { // Older than 1 minute
      rateLimitStore.delete(key);
    }
  }
}, 60000);

module.exports = {
  validatePagination,
  apiRateLimiter,
  authRateLimiter,
  loginRateLimiter,
  logoutRateLimiter,
  createRateLimiter,
  RATE_LIMITS
};