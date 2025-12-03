const express=require("express");
const authRouter=express.Router();

const bcrypt=require("bcrypt");
const User=require("../models/User");
const {validateSignUpData}=require("../utils/validation");




authRouter.post("/signup",async (req,res)=>{

    try {
    // validation of the data
        validateSignUpData(req);

    // encypt the password
    const {firstName,lastName,email,password}=req.body;

    const userExists=await User.findOne({email:email});
    if (userExists)
        {
            throw new Error("User already exists")
        }
    
    const hashedPassword=await bcrypt.hash(password,10);

    // creating a new instance of user model
    const user=new User({
        firstName,
        lastName,
        email,
        password:hashedPassword,
    });

    await user.save();  

    res.status(201).send({message:"User registered successfully"},{data:req.body});
        
    } catch (error) {
        res.status(400).send({message:error.message});
    }
    
})

authRouter.post("/login",async(req,res)=>{

    try {
        const {email,password}=req.body;

        const user=await User.findOne({email:email});
        if (!user)
        {
            throw new Error("Invalid Credentials")
        }

        const isValidPassword=await user.validatePassword(password);
        if(isValidPassword){

            // create a jwt token
            const token=await user.getJWT();

            // add the jwt token to cookies and send response back to the user
            res.cookie("token",token);

            res.status(200).send({message:"Login successful"});
            
        }
        else {
            throw new Error("Invalid Credentials");
        }
        
    } catch (error) {
        res.status(400).send({message:error.message});
    }
})

authRouter.post("/logout",async(req,res)=>{
    try {
        res.clearCookie("token");
        res.status(200).send({message:"Logout successful"});
    } catch (error) {
        res.status(500).send({message:"Internal Server Error"});
    }
})

module.exports=authRouter;