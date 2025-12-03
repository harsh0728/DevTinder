const express = require('express');
const feedRouter=express.Router();
const User=require("../models/User");
const {userAuth}=require("../middlewares/auth");

feedRouter.get("/feed",userAuth,async (req,res)=>{
    try {
        const users=await User.find({});
        res.send(users);
        //res.status(200).send({message:"Users fetched successfully"},{"data":users});
    } catch (error) {
        res.status(500).send({message:"Internal Server Error"});
    }   
})

module.exports=feedRouter;