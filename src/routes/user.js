const express = require("express");
const { userAuth } = require("../middlewares/auth");
const userRouter = express.Router();
const ConnectionRequest = require("../models/connectionRequest");
const User = require("../models/user");
const { redisClient } = require("../config/redis");
const { validatePagination } = require("../middlewares/validation");

// ─────────────────────────────────────────────
// 🔧 Cache Helpers
// ─────────────────────────────────────────────

// Cache keys — centralised so they're consistent across files
const CACHE_KEYS = {
  receivedRequests: (userId, cursor, limit) => `user:${userId}:requests:received:cursor:${cursor || "start"}:limit:${limit}`,
  connections: (userId, cursor, limit) => `user:${userId}:connections:cursor:${cursor || "start"}:limit:${limit}`,
  profile: (userId) => `user:${userId}:profile`,
};

const CACHE_TTL = {
  receivedRequests: 60,   // 1 minute — changes when someone sends/reviews a request
  connections: 300,       // 5 minutes — changes only on accept/reject
  profile: 600,           // 10 minutes — changes only on profile update
};

// Generic safe getter — returns null on Redis failure (falls back to DB)
const cacheGet = async (key) => {
  try {
    const cached = await redisClient.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    console.error(`Redis GET failed [${key}]:`, err.message);
    return null;
  }
};

// Generic safe setter — never throws
const cacheSet = async (key, data, ttl) => {
  try {
    await redisClient.setEx(key, ttl, JSON.stringify(data));
  } catch (err) {
    console.error(`Redis SET failed [${key}]:`, err.message);
  }
};

/**
 * @route   GET /user/request/received
 * @desc    Get all pending connection requests received by logged-in user
 * @access  Private
 * @query   cursor (ObjectId), limit (default 20, max 50)
 */
userRouter.get("/request/received", userAuth, validatePagination, async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const { cursor, limit = 20 } = req.query;
    const parsedLimit = Math.min(parseInt(limit, 10), 50);
    const cacheKey = CACHE_KEYS.receivedRequests(loggedInUserId, cursor, parsedLimit);

    // 1️⃣ Check cache
    const cached = await cacheGet(cacheKey);
    if (cached) {
      console.log("Received requests served from cache ✅");
      return res.status(200).json(cached);
    }

    // 2️⃣ Cache miss — hit DB
    const query = {
      toUserId: loggedInUserId,
      status: "interested",
    };

    // Apply cursor-based pagination
    if (cursor) {
      query._id = { ...query._id, $lt: cursor };
    }

    // Fetch one extra to determine if there's more
    const connectionRequests = await ConnectionRequest.find(query)
      .populate("fromUserId", "firstName lastName age gender about skills photoUrl")
      .sort({ _id: -1 })
      .limit(parsedLimit + 1);

    const hasMore = connectionRequests.length > parsedLimit;
    if (hasMore) {
      connectionRequests.pop();
    }

    const nextCursor = hasMore && connectionRequests.length > 0
      ? connectionRequests[connectionRequests.length - 1]._id.toString()
      : null;

    const responsePayload = {
      success: true,
      message: "Connection requests retrieved successfully",
      data: connectionRequests,
      pagination: {
        nextCursor,
        hasMore,
        count: connectionRequests.length
      },
    };

    // 3️⃣ Store in cache
    await cacheSet(cacheKey, responsePayload, CACHE_TTL.receivedRequests);

    return res.status(200).json(responsePayload);
  } catch (error) {
    console.error("Received requests error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch connection requests",
    });
  }
});

/**
 * @route   GET /user/connections
 * @desc    Get all accepted connections of logged-in user
 * @access  Private
 * @query   cursor (ObjectId), limit (default 20, max 50)
 */
userRouter.get("/connections", userAuth, validatePagination, async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const { cursor, limit = 20 } = req.query;
    const parsedLimit = Math.min(parseInt(limit, 10), 50);
    const cacheKey = CACHE_KEYS.connections(loggedInUserId, cursor, parsedLimit);

    // 1️⃣ Check cache
    const cached = await cacheGet(cacheKey);
    if (cached) {
      console.log("Connections served from cache ✅");
      return res.status(200).json(cached);
    }

    // 2️⃣ Cache miss — hit DB
    // 1. Fetch accepted connections
    const baseQuery = {
      status: "accepted",
      $or: [
        { fromUserId: loggedInUserId },
        { toUserId: loggedInUserId },
      ],
    };

    if (cursor) {
      baseQuery._id = { ...baseQuery._id, $lt: cursor };
    }

    const connections = await ConnectionRequest.find(baseQuery)
      .populate("fromUserId toUserId", "firstName lastName age gender about skills photoUrl")
      .sort({ _id: -1 })
      .limit(parsedLimit + 1);

    // 2. Normalize and Deduplicate the response
    const uniqueConnectedUserIds = new Set();
    const uniqueConnections = [];

    for (const connection of connections) {
      // Determine the profile of the OTHER user
      const otherUser = connection.fromUserId.equals(loggedInUserId)
        ? connection.toUserId
        : connection.fromUserId;

      // Ensure the user object exists and has an ID
      if (otherUser && otherUser._id) {
        const otherUserIdString = otherUser._id.toString();

        // Check if we have already added this user
        if (!uniqueConnectedUserIds.has(otherUserIdString)) {
          uniqueConnectedUserIds.add(otherUserIdString);
          uniqueConnections.push(otherUser);
        }
      }
    }

    const hasMore = connections.length > parsedLimit;
    const nextCursor = hasMore && connections.length > 0
      ? connections[connections.length - 1]._id.toString()
      : null;

    const responsePayload = {
      success: true,
      message: "Connections retrieved successfully",
      data: uniqueConnections,
      pagination: {
        nextCursor,
        hasMore,
        count: uniqueConnections.length,
      },
    };

    // 3️⃣ Store in cache
    await cacheSet(cacheKey, responsePayload, CACHE_TTL.connections);

    return res.status(200).json(responsePayload);
  } catch (error) {
    console.error("Connections error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch connections",
    });
  }
});

userRouter.get("/:id", userAuth, async (req, res) => {
  const userId = req.params.id;
  const cacheKey = CACHE_KEYS.profile(userId);

  try {
    // 1️⃣ Check cache
    const cached = await cacheGet(cacheKey);
    if (cached) {
      console.log(`Profile [${userId}] served from cache ✅`);
      return res.status(200).json(cached);
    }

    // 2️⃣ Cache miss — hit DB
    const user = await User.findById(userId).select("firstName lastName age skills about");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const responsePayload = {
      success: true,
      message: "User fetched successfully",
      data: user,
    };

    // 3️⃣ Store in cache
    await cacheSet(cacheKey, responsePayload, CACHE_TTL.profile);

    return res.status(200).json(responsePayload);

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

module.exports = userRouter;