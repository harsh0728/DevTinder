// const express=require("express");
// const { userAuth } = require("../middlewares/auth");
// const requestRouter=express.Router();
// const User=require("../models/User");
// const ConnectionRequest = require("../models/connectionRequest");


// requestRouter.post("/request/send/:status/:toUserId",userAuth, async (req,res)=>{
//     try {
//         const fromUserId=req.user.userId;
//         const toUserId=req.params.toUserId;
//         const status=req.params.status; // 'ignored' or 'interested'

//         // Status Validation
//         const allowedStatuses=["ignored","interested"];

//         if (!allowedStatuses.includes(status)){
//             return res.status(400).json({
//                 message:"Invalid request status: "+status
//             })
//         }

//         // toUserId and fromUserId should not be the same
//         // API Level Validation
//         if (fromUserId===toUserId){
//             return res.status(400).json({
//                 message:"You cannot send request to yourself"
//             })
//         }

//         // validation of toUserId whether it exists in the database
//         const toUser=await User.findById(toUserId);
//         if (!toUser){
//             return res.status(400).json({message:"The user you are trying to connect with does not exist"})}

//         // Check if a request already exists between the two users
//         const existingConnectionRequest=await ConnectionRequest.findOne({
//             $or:[
//                 {fromUserId,toUserId},
//                 {fromUserId:toUserId,toUserId:fromUserId}
//             ]
//         })

//         if (existingConnectionRequest){
//             return res.status(400).json({message:"A connection request already exists between you and this user"});
//         }
        

//         const connectionRequest=new ConnectionRequest({
//             fromUserId,toUserId,status
//         })

//         const data=await connectionRequest.save();

//         res.status(200).send({message:"Request sent successfully",data:data});        
//     } catch (error) {
//         res.status(400).send({message:error.message});
//     }
// })

// requestRouter.post("/request/review/:status/:requestId",userAuth, async (req,res)=>{
//     try {
//         const {status,requestId}=req.params;
//         const loggedInUserId=req.user.userId;

//         // Status Validation
//         const allowedStatuses=["accepted","rejected"];
        
//         if (!allowedStatuses.includes(status)){
//             return res.status(400).json({
//                 message:"Invalid review status: "+status
//             })
//         }
        
//         const connectionRequest=await ConnectionRequest.findOne({
//             _id:requestId,
//             toUserId:loggedInUserId,
//             status:"interested"
//         })

//         if (!connectionRequest){
//             return res.status(400).json({message:"Connection request not found"});
//         }
        
//         connectionRequest.status=status;
//         const data=await connectionRequest.save();

//         res.status(200).json({message:"Connection request " + status+ " successfully",data:data});

//     } catch (error) {
//         res.status(400).send({message:error.message});
//     }
// });
// module.exports=requestRouter

const express = require("express");
const requestRouter = express.Router();
const { userAuth } = require("../middlewares/auth");
const User = require("../models/user");
const ConnectionRequest = require("../models/connectionRequest");
const { bustFeedCache, bustConnectionsCache, bustReceivedRequestsCache } = require("../utils/cachebust");
const  {redisClient}  = require("../config/redis"); // ✅ import redis
const { swipeLimiter } = require("../middlewares/limiters");

// // ✅ Helper: delete all cached feed pages for a user
// // We cache keys like feed:{userId}:page:{n}:limit:{l}
// // Since we can't do pattern delete on Upstash, we wipe pages 1–15 for common limits
// const bustFeedCache = async (userId) => {
//   try {
//     const limits = [10, 20, 50];
//     const pages = Array.from({ length: 15 }, (_, i) => i + 1);

//     const keys = [];
//     for (const limit of limits) {
//       for (const page of pages) {
//         keys.push(`feed:${userId}:page:${page}:limit:${limit}`);
//       }
//     }

//     // redisClient.del() accepts multiple keys at once
//     await redisClient.del(keys);
//   } catch (err) {
//     // Never crash the request over a cache bust failure
//     console.error("Feed cache bust failed for user:", userId, err.message);
//   }
// };

/**
 * ============================
 * 📩 SEND CONNECTION REQUEST
 * ============================
 * status → interested | ignored
 */
requestRouter.post(
  "/send/:toUserId",
  swipeLimiter,
  userAuth,
  async (req, res) => {
    try {
      const fromUserId = req.user._id;
      const { toUserId } = req.params;
      const { status } = req.body;

      // ✅ Allowed statuses for sending request
      const allowedStatuses = ["ignored", "interested"];

      // 🚫 Validate request status
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid request status",
        });
      }

      // 🚫 Prevent self-connection
      if (fromUserId.equals(toUserId)) {
        return res.status(400).json({
          success: false,
          message: "You cannot send a request to yourself",
        });
      }

      // 🔍 Check if target user exists
      const toUserExists = await User.exists({ _id: toUserId });
      if (!toUserExists) {
        return res.status(404).json({
          success: false,
          message: "User you are trying to connect with does not exist",
        });
      }

      /**
       * 🧠 Check if a request already exists in either direction
       * - Prevents duplicate & reverse duplicate requests
       */
      // const existingRequest = await ConnectionRequest.findOne({
      //   $or: [
      //     { fromUserId, toUserId },
      //     { fromUserId: toUserId, toUserId: fromUserId },
      //   ]
      // });

      // if (existingRequest) {
      //   return res.status(409).json({
      //     success: false,
      //     message: "Connection request already exists",
      //   });
      // }

      
      /**
       * 🔄 REVERSE DIRECTION CHECK: Look for a request they sent to me (toUserId → fromUserId)
       */
      const reverseRequest = await ConnectionRequest.findOne({
        fromUserId: toUserId,
        toUserId: fromUserId, // loggedInUserId
      });

      if (reverseRequest) {
        const theirStatus = reverseRequest.status;

        // CASE 1: Already Connected
        if (theirStatus === "accepted") {
          return res.status(409).json({
            success: false,
            message: "You are already connected with this user.",
          });
        }

        // CASE 2: INSTANT MATCH! (They are 'interested' AND I am swiping 'interested')
        if (theirStatus === "interested" && status === "interested") {
          // Update their existing request to 'accepted'
          reverseRequest.status = "accepted";
          await reverseRequest.save();

          return res.status(200).json({
            success: true,
            message: "🎉 It's a match! Connection established.",
            data: reverseRequest,
          });
        }
        
        
        // CASE 3: BLOCK (All other cases where a reverse request exists)
        // e.g., They 'ignored' me, or they are 'interested' but I'm not using the special 'ignored' match logic above.
        // return res.status(409).json({
        //   success: false,
        //   message: "A request from this user is pending or was previously acted upon. Cannot initiate a new swipe action.",
        // });
      }
      
      // ... (If no reverse request, continue to the SAME DIRECTION CHECK and then CREATE NEW REQUEST)

      /**
       * 🔍 SAME DIRECTION CHECK
       * Only allow: ignored → interested
       */
      const sameDirectionRequest = await ConnectionRequest.findOne({
        fromUserId,
        toUserId,
      });

      if (sameDirectionRequest) {
        const currentStatus = sameDirectionRequest.status;

        // Already connected - immutable
        if (currentStatus === "accepted") {
          return res.status(409).json({
            success: false,
            message: "Already connected",
          });
        }

        // Allow ONLY: ignored → interested
        if (currentStatus === "ignored" && status === "interested") {
          sameDirectionRequest.status = status;
          await sameDirectionRequest.save();

        // ✅ Only fromUser's feed changes — they now have a pending request out
        await bustFeedCache(fromUserId.toString());

          return res.status(200).json({
            success: true,
            message: "Connection request updated",
            data: sameDirectionRequest,
          });
        }

        // Block all other cases
        return res.status(409).json({
          success: false,
          message:
            currentStatus === "interested"
              ? "Request already sent"
              : "Request already exists",
        });
      }


      // 📌 Create new connection request
      const connectionRequest = new ConnectionRequest({
        fromUserId,
        toUserId,
        status,
      });

      const data = await connectionRequest.save();

    // ✅ Bust feed for both users:
    // - fromUser sent a request, so toUser should disappear from their feed
    // - toUser received a request, so fromUser should disappear from their feed
    await bustFeedCache(fromUserId.toString());
    await bustFeedCache(toUserId.toString());

      return res.status(201).json({
        success: true,
        message: "Connection request sent successfully",
        data,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

/**
 * ============================
 * ✅ REVIEW CONNECTION REQUEST
 * ============================
 * status → accepted | rejected
 */
requestRouter.post(
  "/review/:requestId",
  swipeLimiter,
  userAuth,
  async (req, res) => {
    try {
      const { requestId } = req.params;
      const { status } = req.body;
      const loggedInUserId = req.user._id;

      // ✅ Allowed review statuses
      const allowedStatuses = ["accepted", "rejected"];

      // 🚫 Validate review status
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid review status",
        });
      }

      /**
       * 🔍 Fetch request
       * - Only receiver can review
       * - Only pending ('interested') requests allowed
       */
      const connectionRequest = await ConnectionRequest.findOne({
        _id: requestId,
        toUserId: loggedInUserId,
        status: "interested",
      });

      if (!connectionRequest) {
        return res.status(404).json({
          success: false,
          message: "Connection request not found or already reviewed",
        });
      }

      // 🔁 Update request status
      connectionRequest.status = status;
      const data = await connectionRequest.save();

    // ✅ Bust feed for both users on review:
    // - accepted: both are now matched, neither should see each other in feed
    // - rejected: fromUser can potentially reappear in toUser's feed
    //             (depending on your feed logic for 'rejected' status)
    await bustFeedCache(connectionRequest.fromUserId.toString());
    await bustFeedCache(loggedInUserId.toString());

      return res.status(200).json({
        success: true,
        message: `Connection request ${status} successfully`,
        data,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

module.exports = requestRouter;
