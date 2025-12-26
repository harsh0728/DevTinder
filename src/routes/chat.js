const express=require("express");
const chatRouter=express.Router();

// Example chat route
chatRouter.get("/", (req, res) => {
  res.json({ message: "Welcome to the chat API!" });
});

module.exports=chatRouter;