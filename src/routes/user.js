const express = require('express');
const { userAuth } = require('../middlewares/auth');
const userRouter = express.Router();
const ConnectionRequest = require('../models/connectionRequest');

userRouter.get("/user/request/received",userAuth, async (req, res) => {
    try {
        const loggedInUserId=req.user.userId;

        const connectionRequests=await ConnectionRequest.find({
            toUserId:loggedInUserId,
            status:"interested"
        }).populate(
            "fromUserId","firstName lastName age gender about skills photoUrl"
        )
        //.populate("fromUserId",["firstName","lastName","age","gender","photoUrl","about","skills"])

        res.status(200).send({ message: "Connection requests retrieved successfully", data: connectionRequests });
        
    } catch (error) {
        res.status(400).send({ message: error.message });
    }
});


userRouter.get("/user/connections",userAuth, async (req, res) => {
    try {
        const loggedInUserId=req.user.userId;

        const connections=await ConnectionRequest.find({
            $or:[
                {fromUserId:loggedInUserId,status:"accepted"},
                {toUserId:loggedInUserId,status:"accepted"}
            ]
        }).populate(
            "fromUserId toUserId","firstName lastName age gender about skills photoUrl"
        )

        const data=connections.map((row)=> 
        {
            if (row.fromUserId._id.toString()===loggedInUserId.toString()){
                return row.toUserId;
            }
            return row.fromUserId;
        })

        res.status(200).send({ message: "Connections retrieved successfully", data: data });
    } catch (error) {
        res.status(400).send({ message: error.message });
    }

});

module.exports=userRouter;