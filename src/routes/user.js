// const express = require('express');
// const { userAuth } = require('../middlewares/auth');
// const userRouter = express.Router();
// const ConnectionRequest = require('../models/connectionRequest');
// const User = require('../models/User');


// userRouter.get("/user/request/received",userAuth, async (req, res) => {
//     try {
//         const loggedInUserId=req.user.userId;

//         const connectionRequests=await ConnectionRequest.find({
//             toUserId:loggedInUserId,
//             status:"interested"
//         }).populate(
//             "fromUserId","firstName lastName age gender about skills photoUrl"
//         )
//         //.populate("fromUserId",["firstName","lastName","age","gender","photoUrl","about","skills"])

//         res.status(200).send({ message: "Connection requests retrieved successfully", data: connectionRequests });
        
//     } catch (error) {
//         res.status(400).send({ message: error.message });
//     }
// });


// userRouter.get("/user/connections",userAuth, async (req, res) => {
//     try {
//         const loggedInUserId=req.user.userId;

//         const connections=await ConnectionRequest.find({
//             $or:[
//                 {fromUserId:loggedInUserId,status:"accepted"},
//                 {toUserId:loggedInUserId,status:"accepted"}
//             ]
//         }).populate(
//             "fromUserId toUserId","firstName lastName age gender about skills photoUrl"
//         )

//         const data=connections.map((row)=> 
//         {
//             if (row.fromUserId._id.toString()===loggedInUserId.toString()){
//                 return row.toUserId;
//             }
//             return row.fromUserId;
//         })

//         res.status(200).send({ message: "Connections retrieved successfully", data: data });
//     } catch (error) {
//         res.status(400).send({ message: error.message });
//     }

// });

// module.exports=userRouter;

const express = require("express");
const { userAuth } = require("../middlewares/auth");
const userRouter = express.Router();
const ConnectionRequest = require("../models/connectionRequest");

/**
 * @route   GET /user/request/received
 * @desc    Get all pending connection requests received by logged-in user
 * @access  Private
 */
userRouter.get("/request/received", userAuth, async (req, res) => {
  try {
    // Extract logged-in user's ID from auth middleware
    const loggedInUserId = req.user._id;

    /**
     * Fetch only "interested" requests sent TO the logged-in user
     * Populate sender details (fromUserId)
     * ⚠ Do NOT populate unnecessary fields (security + performance)
     */
    const connectionRequests = await ConnectionRequest.find({
      toUserId: loggedInUserId,
      status: "interested",
    }).populate(
      "fromUserId",
      "firstName lastName age gender about skills photoUrl"
    );

    res.status(200).json({
      success: true,
      message: "Connection requests retrieved successfully",
      data: connectionRequests,
    });
  } catch (error) {
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
 */
userRouter.get("/connections", userAuth, async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    /**
     * Fetch accepted connections where the user is either:
     * - sender OR
     * - receiver
     */
    const connections = await ConnectionRequest.find({
      status: "accepted",
      $or: [
        { fromUserId: loggedInUserId },
        { toUserId: loggedInUserId },
      ],
    }).populate(
      "fromUserId toUserId",
      "firstName lastName age gender about skills photoUrl"
    );

    /**
     * Normalize response:
     * Return ONLY the "other user"
     * (frontend should not care who sent/received)
     */
    const data = connections.map((connection) => {
      return connection.fromUserId._id.toString() === loggedInUserId
        ? connection.toUserId
        : connection.fromUserId;
    });

    res.status(200).json({
      success: true,
      message: "Connections retrieved successfully",
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch connections",
    });
  }
});

module.exports = userRouter;
