const express = require("express");
const { userAuth } = require("../middlewares/auth");
const feedRouter = express.Router();
const ConnectionRequest = require("../models/connectionRequest");
const User = require("../models/user");
const { redisClient } = require("../config/redis");
const { validatePagination } = require("../middlewares/validation");

/**
 * 📰 GET USER FEED
 * - Shows users excluding:
 *   - already connected users
 *   - users with pending requests
 *   - self user
 * - Supports cursor-based pagination
 */
feedRouter.get("/", userAuth, validatePagination, async (req, res) => {
  try {
    const { cursor, limit = 10 } = req.query;
    const parsedLimit = Math.min(parseInt(limit, 10), 50);

    // 👤 Logged-in user ID (from auth middleware)
    const loggedInUserId = req.user._id;

    // ✅ Cache key includes userId + cursor + limit
    const cacheKey = `feed:${loggedInUserId}:cursor:${cursor || "start"}:limit:${parsedLimit}`;

    // 1️⃣ Check Redis first
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        console.log("Feed served from Redis cache ✅");
        return res.status(200).json(JSON.parse(cached));
      }
    } catch (redisErr) {
      console.error("Redis get failed, falling back to DB:", redisErr.message);
    }

    // 2️⃣ Cache miss — query MongoDB
    // Get all relevant connection requests
    const connections = await ConnectionRequest.find({
      $or: [
        { fromUserId: loggedInUserId },
        { toUserId: loggedInUserId },
      ],
    }).select("fromUserId toUserId status");

    const hideUsersFromFeed = new Set();

    connections.forEach((connection) => {
      // Always exclude matched connections
      if (connection.status === "accepted") {
        hideUsersFromFeed.add(connection.fromUserId.toString());
        hideUsersFromFeed.add(connection.toUserId.toString());
      }

      // Only exclude the OTHER person if "interested"
      if (connection.status === "interested") {
        if (connection.fromUserId.toString() === loggedInUserId.toString()) {
          hideUsersFromFeed.add(connection.toUserId.toString());
        } else if (connection.toUserId.toString() === loggedInUserId.toString()) {
          hideUsersFromFeed.add(connection.fromUserId.toString());
        }
      }
    });

    hideUsersFromFeed.add(loggedInUserId.toString());

    // Build query for feed users
    const query = {
      _id: { $nin: Array.from(hideUsersFromFeed) },
    };

    // Apply cursor-based pagination
    if (cursor) {
      query._id = { ...query._id, $lt: cursor };
    }

    // Fetch one extra to determine if there's more
    const usersInFeed = await User.find(query)
      .select("firstName lastName age gender about skills photoUrl")
      .sort({ _id: -1 }) // Sort by _id descending for cursor pagination
      .limit(parsedLimit + 1);

    // Check if there are more results
    const hasMore = usersInFeed.length > parsedLimit;
    if (hasMore) {
      usersInFeed.pop(); // Remove the extra item
    }

    const nextCursor = hasMore && usersInFeed.length > 0
      ? usersInFeed[usersInFeed.length - 1]._id.toString()
      : null;

    const responsePayload = {
      success: true,
      message: "Users fetched successfully",
      data: usersInFeed,
      pagination: {
        nextCursor,
        hasMore,
        count: usersInFeed.length
      },
    };

    // 3️⃣ Save to Redis — 10 minute TTL
    try {
      await redisClient.setEx(cacheKey, 600, JSON.stringify(responsePayload));
    } catch (redisErr) {
      console.error("Redis set failed:", redisErr.message);
    }

    return res.status(200).json(responsePayload);

  } catch (error) {
    console.error("Feed error:", error.message);
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = feedRouter;