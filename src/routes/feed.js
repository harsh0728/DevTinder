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
const User = require("../models/User");

/**
 * 📰 GET USER FEED
 * - Shows users excluding:
 *   - already connected users
 *   - users with pending requests
 *   - self user
 * - Supports pagination
 */
feedRouter.get("/", userAuth, async (req, res) => {
  try {
    // 📄 Pagination handling
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    let limit = parseInt(req.query.limit) || 10;
    limit = limit > 50 ? 50 : limit;

    const skip = (page - 1) * limit;

    // 👤 Logged-in user ID (from auth middleware)
    const loggedInUserId = req.user._id;

    /**
     * 🔍 Fetch all relevant connection requests
     * - Only interested & accepted users should be hidden
     */
    const connections = await ConnectionRequest.find({
      $or: [
        { fromUserId: loggedInUserId },
        { toUserId: loggedInUserId },
      ],
      status: { $in: ["interested", "accepted"] },
    }).select("fromUserId toUserId");

    /**
     * 🚫 Build a set of users to exclude from feed
     * - Set ensures uniqueness & faster lookup
     */
    const hideUsersFromFeed = new Set();

    connections.forEach((connection) => {
      hideUsersFromFeed.add(connection.fromUserId.toString());
      hideUsersFromFeed.add(connection.toUserId.toString());
    });

    // 🚫 Also exclude self from feed
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

    return res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      data: usersInFeed,
      pagination: {
        page,
        limit,
        count: usersInFeed.length,
      },
    });
  } catch (error) {
    console.error("Feed error:", error.message);
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = feedRouter;
