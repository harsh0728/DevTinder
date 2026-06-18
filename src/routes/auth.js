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
const { userAuth } = require("../middlewares/auth");
const mailSender=require("../utils/mailSender")
const crypto = require("crypto");

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

// Change password route
authRouter.patch("/change-password", userAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New Password and Confirm New Password do not match",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    
    const isValidPassword = await user.validatePassword(currentPassword);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    user.password = newPassword; // pre-save hook hashes it

    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// forgot-password route
authRouter.post("/forgot-password", async (req, res) => {
  // Always return the same generic response — never reveal if email exists
  const SAFE_RESPONSE={
    success:true,
    message:"If that email is registered, you'll receive a reset link shortly."
  }

  try {
    const {email}=req.body;

    if(!email || typeof email!="string")
    {
      return res.status(400).json({success:false,message:"Email is required."})
    }

    const user=await User.findOne({email:email.toLowerCase().trim()});
    
    // Exit silently if not found — don't leak whether the email exists
    if (!user) return res.status(200).json(SAFE_RESPONSE);

    // Generate a cryptographically random one-time token (raw = sent in email)
    const rawToken=crypto.randomBytes(32).toString("hex");  // 64-char hex
    const tokenHash=crypto.createHash("sha256").update(rawToken).digest("hex");
    const tokenExpiry=new Date(Date.now()+15*60*1000);  // 15 minutes from now

    // Persist only the hash — never store the raw token in DB
    user.resetPasswordToken=tokenHash;
    user.resetPasswordExpiry=tokenExpiry
    await user.save();

    const frontEndURL=process.env.NODE_ENV==="production"?process.env.CLIENT_URL:"http://localhost:3000";

    // Raw token goes in the URL — DB only ever sees the hash
    const resetURL=`${frontEndURL}/reset-password/${rawToken}`;

    await mailSender(
      user.email,
      "Reset your password",
      `<p>Click to reset your password (expires in 15 minutes):</p>
       <a href="${resetURL}">${resetURL}</a>
       <p>If you didn't request this, ignore this email — your password won't change.</p>`,
      `Reset your password (expires in 15 minutes): ${resetURL}`
    )

    return res.status(200).json(SAFE_RESPONSE);
  } catch (error) {
    console.error("forgot-password error:", error);
    // Still return generic response — don't expose internal errors
    return res.status(200).json(SAFE_RESPONSE);
  }
  
})


// Change password route
authRouter.patch("/reset-password/:token", async (req, res) => {
  try {
    const {newPassword, confirmPassword } = req.body;
    const {token:rawToken}=req.params;

    // ── Input validation ──
    if (!rawToken) {
      return res.status(400).json({ success: false, message: "Reset token is missing." });
    }
    if (!newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Passwords do not match." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });
    }

    // ── Find user by hashed token + check expiry ──
    const tokenHash=crypto.createHash("sha256").update(rawToken).digest("hex");

    const user=await User.findOne({
      resetPasswordToken:tokenHash,
      resetPasswordExpiry:{$gt:Date.now()}
    })

    if (!user) {
      // Covers: wrong token, already used, expired
      return res.status(400).json({
        success: false,
        message: "This reset link is invalid or has expired. Please request a new one.",
      });
    }

    // ── Update password — your pre-save hook hashes it ──
    user.password=newPassword;
    user.resetPasswordToken=undefined;
    user.resetPasswordExpiry=undefined;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successfully. You can now log in.",
    });
    
  } catch (error) {
    console.error("reset-password error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
  }
});



/* ===================== GOOGLE OAUTH ===================== */

authRouter.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"], session: false })
);

authRouter.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: process.env.NODE_ENV === "production"?"https://devtinder-web-kpdx.onrender.com/login":"http://localhost:3000/login", session: false }),
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

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Dynamic redirect 
    const frontendURL= process.env.NODE_ENV === "production"?process.env.CLIENT_URL:"http://localhost:5173";
    return res.redirect(`${frontendURL}/oauth-success`);
  }
);



module.exports = authRouter;
