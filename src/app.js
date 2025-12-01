const express=require('express');
const connectDB=require("./config/database")
const app=express();
const User=require("./models/User");
const {validateSignUpData}=require("./utils/validation");
const bcrypt=require("bcrypt");
const jwt=require("jsonwebtoken");
const cookieParser=require("cookie-parser");

app.use(express.json());
app.use(cookieParser());



app.get("/user",async (req,res)=>{
    
    const userEmail=req.body.email;
    try {
        const users=await User.find({email:userEmail});
        if(users.length===0){
            res.status(404).send({message:"User not found"});
        }else{
            //res.status(200).send({message:"User found"},{data:users});
            res.send(users);
        }
    } catch (error) {
        res.status(500).send({message:"Internal Server Error"});
    }
})

app.get("/feed",async (req,res)=>{
    try {
        const users=await User.find({});
        res.send(users)
        //res.status(200).send({message:"Users fetched successfully"},{"data":users});
    } catch (error) {
        res.status(500).send({message:"Internal Server Error"});
    }   
})

app.post("/signup",async (req,res)=>{

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

app.post("/login",async(req,res)=>{

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

app.get("/profile",async(req,res)=>{
    try {
        const token=req.cookies.token;
        if (!token)
        {
            throw new Error("Unauthorized Access");
        }
        const decoded=jwt.verify(token,"your_jwt_secret_key");
        const userId=decoded.userId;
        const user=await User.findById(userId).select("-password");
        if (!user)
        {
            throw new Error("User not found");
        }
        res.status(200).send({data:user});

    } catch (error) {
        res.status(400).send({message:error.message});
    }
});

connectDB().then(()=>{
    console.log("Database connected successfully");
    app.listen(3000,()=>{
        console.log('Server is running on port 3000');
    });
}).catch((error) => {
      console.log("DB Connection Failed");
      console.error(error);
});
