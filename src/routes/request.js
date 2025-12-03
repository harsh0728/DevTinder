const express=require("express");
const { userAuth } = require("../middlewares/auth");
const requestRouter=express.Router();
const User=require("../models/User");
const ConnectionRequest = require("../models/connectionRequest");


requestRouter.post("/request/send/:status/:toUserId",userAuth, async (req,res)=>{
    try {
        const fromUserId=req.user.userId;
        const toUserId=req.params.toUserId;
        const status=req.params.status; // 'ignored' or 'interested'

        // Status Validation
        const allowedStatuses=["ignored","interested"];

        if (!allowedStatuses.includes(status)){
            return res.status(400).json({
                message:"Invalid request status: "+status
            })
        }

        // toUserId and fromUserId should not be the same
        // API Level Validation
        // if (fromUserId===toUserId){
        //     return res.status(400).json({
        //         message:"You cannot send request to yourself"
        //     })
        // }

        // validation of toUserId whether it exists in the database
        const toUser=await User.findById(toUserId);
        if (!toUser){
            return res.status(400).json({message:"The user you are trying to connect with does not exist"})}

        // Check if a request already exists between the two users
        const existingConnectionRequest=await ConnectionRequest.findOne({
            $or:[
                {fromUserId,toUserId},
                {fromUserId:toUserId,toUserId:fromUserId}
            ]
        })

        if (existingConnectionRequest){
            return res.status(400).json({message:"A connection request already exists between you and this user"});
        }
        

        const connectionRequest=new ConnectionRequest({
            fromUserId,toUserId,status
        })

        const data=await connectionRequest.save();

        res.status(200).send({message:"Request sent successfully",data:data});        
    } catch (error) {
        res.status(400).send({message:error.message});
    }
})

module.exports=requestRouter