// const express=require("express");
// const authRouter=express.Router();

// const bcrypt=require("bcrypt");
// const User=require("../models/User");
// const {validateSignUpData}=require("../utils/validation");




// authRouter.post("/signup",async (req,res)=>{

//     try {
//     // validation of the data
//         validateSignUpData(req);

//     // encypt the password
//     const {firstName,lastName,email,password}=req.body;

//     const userExists=await User.findOne({email:email});
//     if (userExists)
//         {
//             throw new Error("User already exists")
//         }
    
//     const hashedPassword=await bcrypt.hash(password,10);

//     // creating a new instance of user model
//     const user=new User({
//         firstName,
//         lastName,
//         email,
//         password:hashedPassword,
//     });

//     await user.save();  

//     res.status(201).send({message:"User registered successfully"},{data:req.body});
        
//     } catch (error) {
//         res.status(400).send({message:error.message});
//     }
    
// })

// authRouter.post("/login",async(req,res)=>{

//     try {
//         const {email,password}=req.body;

//         const user=await User.findOne({email:email});
//         if (!user)
//         {
//             throw new Error("Invalid Credentials")
//         }

//         const isValidPassword=await user.validatePassword(password);
//         if(isValidPassword){

//             // create a jwt token
//             const token=await user.getJWT();

//             // add the jwt token to cookies and send response back to the user
//             res.cookie("token",token);
//             res.status(200).send(user)
//             // res.status(200).json({message:"Login successful", data: user});
            
//         }
//         else {
//             throw new Error("Invalid Credentials");
//         }
        
//     } catch (error) {
//         res.status(400).send({message:error.message});
//     }
// })

// authRouter.post("/logout",async(req,res)=>{
//     try {
//         res.clearCookie("token");
//         res.status(200).send({message:"Logout successful"});
//     } catch (error) {
//         res.status(500).send({message:"Internal Server Error"});
//     }
// })

// module.exports=authRouter;

const express = require("express");
const authRouter = express.Router();
const passport =require("passport");
const jwt=require("jsonwebtoken");
const User = require("../models/user"); // Changed models/user.js to models/User.js
const { validateSignUpData } = require("../utils/validation");

/**
 * ============================
 * 📝 SIGNUP ROUTE
 * ============================
 */
authRouter.post("/signup", async (req, res) => {
  try {
    // 🧪 Validate incoming request body
    validateSignUpData(req);

    const { firstName, lastName, email, password, age, gender } = req.body;

    // 🔍 Check if user already exists (email must be unique)
    const userExists = await User.findOne({ email: email.toLowerCase() });
    if (userExists) {
      return res.status(409).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    /**
     * 🧠 IMPORTANT:
     * - DO NOT hash password here
     * - Password hashing is handled in User model (pre-save hook)
     */
    const user = new User({
      firstName,
      lastName,
      email,
      password,
      age, 
      gender
    });

    await user.save();

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * ============================
 * 🔐 LOGIN ROUTE
 * ============================
 */
authRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // 🚫 Basic validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    /**
     * 🔍 Explicitly select password
     * - password is hidden by default in User schema
     */
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password"
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // 🔐 Validate password
    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // 🎟️ Generate JWT token
    const token = user.getJWT();

    /**
     * 🍪 Store JWT in HTTP-only cookie
     * - httpOnly → prevents XSS
     * - secure → HTTPS only (production)
     * - sameSite → CSRF protection
     */
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // CHANGED THIS LINE
      maxAge: 7 * 24* 60 * 60 * 1000, // 7 days
    });

    // 🧹 Remove password before sending user data
    user.password = undefined;

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

/**
 * ============================
 * 🚪 LOGOUT ROUTE
 * ============================
 */
authRouter.post("/logout", async (req, res) => {
  try {
    // 🍪 Clear authentication cookie
    res.clearCookie("token");

    return res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

/* ===================== GOOGLE OAUTH ===================== */
const crypto = require("crypto");

authRouter.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"], session: false })
);

authRouter.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "http://localhost:5173/login", session: false }),
  async (req, res) => {
    const profile = req.user;

    const email = profile.emails[0].value.toLowerCase();

    let user = await User.findOne({ email });

    if (!user) {
      const randomPassword = crypto.randomBytes(20).toString("hex");

      user = await User.create({
        firstName: profile.displayName.split(" ")[0] || "",
        lastName: profile.displayName.split(" ")[1] || "",
        email,
        password: randomPassword,
        age: 20,            // default age
        gender: "other"     // default gender
      });
    }


    const token = user.getJWT();

    // Redirect to frontend with token
    res.redirect(`http://localhost:5173/oauth-success?token=${token}`);
  }
);



module.exports = authRouter;
