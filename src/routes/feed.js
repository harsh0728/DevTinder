// const express = require('express');
// const { userAuth } = require('../middlewares/auth');
// const feedRouter = express.Router();
// const ConnectionRequest = require('../models/connectionRequest');
// const User = require('../models/User');

// feedRouter.get("/feed",userAuth, async (req,res)=>{
//     try {
//         const page=parseInt(req.query.page) || 1;
//         let limit=parseInt(req.query.limit) || 10;
//         limit=limit>50?50:limit;
        
//         const skip=(page-1)*limit;

//         const loggedInUserId=req.user._id;
//         const connections=await ConnectionRequest.find({
//             $or:[
//                 {fromUserId:loggedInUserId},
//                 {toUserId:loggedInUserId}
//             ]   
//         }).select("fromUserId toUserId");

//         const hideUsersFromFeed=new Set();

//         connections.forEach((connection)=>{
//             hideUsersFromFeed.add(connection.fromUserId.toString());
//             hideUsersFromFeed.add(connection.toUserId.toString());
//         });

//         hideUsersFromFeed.add(loggedInUserId.toString());  

//         const usersInFeed=await User.find({
//             _id:{$nin:Array.from(hideUsersFromFeed)}
//         }).select("firstName lastName age gender about skills photoUrl").skip(skip).limit(limit);

//         res.status(200).send({message:"Users fetched successfully",data:usersInFeed});

//     } catch (error) {   
//         res.status(400).send({message:error.message});
//     }

// });

// module.exports=feedRouter;

const express = require("express");
const { userAuth } = require("../middlewares/auth");
const feedRouter = express.Router();
const ConnectionRequest = require("../models/connectionRequest");
const User = require("../models/user");
const {redisClient}=require("../config/redis")
const { readLimiter } = require("../middlewares/limiters");

/**
 * 📰 GET USER FEED
 * - Shows users excluding:
 *   - already connected users
 *   - users with pending requests
 *   - self user
 * - Supports pagination
 */
feedRouter.get("/",readLimiter, userAuth, async (req, res) => {

  try {
    // 📄 Pagination handling
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    let limit = parseInt(req.query.limit) || 10;
    limit = limit > 50 ? 50 : limit;

    const skip = (page - 1) * limit;

    // 👤 Logged-in user ID (from auth middleware)
    const loggedInUserId = req.user._id;

    // /**
    //  * 🔍 Fetch all relevant connection requests
    //  * - Only interested & accepted users should be hidden
    //  */
    // const connections = await ConnectionRequest.find({
    //   $or: [
    //     { fromUserId: loggedInUserId },
    //     { toUserId: loggedInUserId },
    //   ],
    //   status: { $in: ["interested", "accepted"] },
    // }).select("fromUserId toUserId");

    // /**
    //  * 🚫 Build a set of users to exclude from feed
    //  * - Set ensures uniqueness & faster lookup
    //  */
    // const hideUsersFromFeed = new Set();

    // connections.forEach((connection) => {
    //   hideUsersFromFeed.add(connection.fromUserId.toString());
    //   hideUsersFromFeed.add(connection.toUserId.toString());
    // });

    // // 🚫 Also exclude self from feed
    // hideUsersFromFeed.add(loggedInUserId.toString());


    /**
 * 🔍 Fetch relevant connection requests
 * - Only hide when request exists in EITHER direction
 * - Hide both users only for "accepted" status
 */

    // ✅ Cache key includes userId + page + limit so each page is cached separately
    const cacheKey = `feed:${loggedInUserId}:page:${page}:limit:${limit}`;

    // 1️⃣ Check Redis first
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        console.log("Feed served from Redis cache ✅");
        return res.status(200).json(JSON.parse(cached));
      }
    } catch (redisErr) {
      // Redis failure should NOT crash the request — fall through to MongoDB
      console.error("Redis get failed, falling back to DB:", redisErr.message);
    }

    // 2️⃣ Cache miss — query MongoDB
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
  // (so we don't show duplicate swipe cards)
  if (connection.status === "interested") {
    // If I sent the request, hide the other person
    if (connection.fromUserId.toString() === loggedInUserId.toString()) {
      hideUsersFromFeed.add(connection.toUserId.toString());
    }
    // If they sent the request to me, hide them from my feed
    else if (connection.toUserId.toString() === loggedInUserId.toString()) {
      hideUsersFromFeed.add(connection.fromUserId.toString());
    }
  }
});

  hideUsersFromFeed.add(loggedInUserId.toString());

    /**
     * 🧑 Fetch feed users
     * - Exclude hidden users
     * - Apply pagination
     */
    const usersInFeed = await User.find({
      _id: { $nin: Array.from(hideUsersFromFeed) },
    })
      .select("firstName lastName age gender about skills photoUrl")
      .skip(skip)
      .limit(limit);

      const responsePayload = {
      success: true,
      message: "Users fetched successfully",
      data: usersInFeed,
      pagination: { page, limit, count: usersInFeed.length },};

     // 3️⃣ Save to Redis — 10 minute TTL
    try {
      await redisClient.setEx(cacheKey, 600, JSON.stringify(responsePayload));
    } catch (redisErr) {
      console.error("Redis set failed:", redisErr.message);
    }

    return res.status(200).json(responsePayload);

    // return res.status(200).json({
    //   success: true,
    //   message: "Users fetched successfully",
    //   data: usersInFeed,
    //   pagination: {
    //     page,
    //     limit,
    //     count: usersInFeed.length,
    //   },
    // });
  } catch (error) {
    console.error("Feed error:", error.message);
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = feedRouter;
