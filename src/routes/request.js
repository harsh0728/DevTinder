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
const User = require("../models/User");
const ConnectionRequest = require("../models/connectionRequest");

/**
 * ============================
 * 📩 SEND CONNECTION REQUEST
 * ============================
 * status → interested | ignored
 */
requestRouter.post(
  "/send/:toUserId",
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
      const existingRequest = await ConnectionRequest.findOne({
        $or: [
          { fromUserId, toUserId },
          { fromUserId: toUserId, toUserId: fromUserId },
        ],
      });

      if (existingRequest) {
        return res.status(409).json({
          success: false,
          message: "Connection request already exists",
        });
      }

      // 📌 Create new connection request
      const connectionRequest = new ConnectionRequest({
        fromUserId,
        toUserId,
        status,
      });

      const data = await connectionRequest.save();

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
