const express=require("express");
const chatRouter=express.Router();
const {userAuth}  = require("../middlewares/auth");
const Chat=require("../models/chat")

// Example chat route
chatRouter.get("/:targetUserId",userAuth, async(req, res) => {
  const userId=req.user._id;
  const targetUserId=req.params.targetUserId;

  try {
    const chat=await Chat.findOne({
      // participants:[userId,targetUserId]
      participants: { $all: [userId, targetUserId] }
    }).populate("messages.senderId","firstName");
    if (!chat) {
      return res.json([]);
    }
    res.status(200).json(chat.messages);

  } catch (error) {
    console.error("Error fetching chat:", error);
  }
});

module.exports=chatRouter;