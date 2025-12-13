// const express = require("express");
// const profileRouter = express.Router();
// const User = require("../models/User");
// const { userAuth } = require("../middlewares/auth");

// profileRouter.get("/profile/view", userAuth, async (req, res) => {
//   try {
//     const user = await User.findById(req.user.userId).select("-password");
//     if (!user) throw new Error("User not found");

//     res.status(200).send({ data: user });
//   } catch (error) {
//     res.status(400).send({ message: error.message });
//   }
// });

// profileRouter.patch("/profile/edit", userAuth, async (req, res) => {
//   try {
//     const allowedUpdates = [
//       "firstName",
//       "lastName",
//       "age",
//       "gender",
//       "skills",
//       "about",
//       "photoUrl"
//     ];

//     const updates = Object.keys(req.body);
//     const isValidOperation = updates.every(update =>
//       allowedUpdates.includes(update)
//     );

//     if (!isValidOperation) {
//       throw new Error("Invalid updates!");
//     }

//     const user = await User.findById(req.user.userId);
//     if (!user) throw new Error("User not found");

//     updates.forEach(update => {
//       user[update] = req.body[update];
//     });

//     await user.save();

//     res.status(200).send({
//       message: "Profile updated successfully",
//       data: user
//     });
//   } catch (error) {
//     res.status(400).send({ message: error.message });
//   }
// });

// // TODO: Add route for forgot password
// profileRouter.patch("/profile/password", async (req, res) => {
//         try {
//             const { email, newPassword } = req.body;

//             const user = await User.findOne({ email: email });
//             if (!user) {
//                 throw new Error("User not found");
//             }
//             const hashedPassword = await bcrypt.hash(newPassword, 10);
//             user.password = hashedPassword;
//             await user.save();
//             res.status(200).send({ message: "Password updated successfully" });

            
//         } catch (error) {
//             res.status(500).send({message:"Internal Server Error"});
//         }
// });

// module.exports = profileRouter;

const express = require("express");
const profileRouter = express.Router();
const User = require("../models/User");
const { userAuth } = require("../middlewares/auth");

/**
 * ============================
 * 👤 VIEW PROFILE
 * ============================
 */
profileRouter.get("/view", userAuth, async (req, res) => {
  try {
    /**
     * 🧠 req.user is already populated by auth middleware
     * - No need to fetch userId again
     * - Password is already excluded by schema
     */
    const user = req.user;

    return res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
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
 * ✏️ EDIT PROFILE
 * ============================
 */
profileRouter.patch("/edit", userAuth, async (req, res) => {
  try {
    /**
     * 🛑 Whitelist allowed fields
     * - Prevents mass assignment vulnerability
     */
    const allowedUpdates = [
      "firstName",
      "lastName",
      "age",
      "gender",
      "skills",
      "about",
      "photoUrl",
    ];

    const updates = Object.keys(req.body);

    // 🚫 Reject request if any field is not allowed
    const isValidOperation = updates.every((field) =>
      allowedUpdates.includes(field)
    );

    if (!isValidOperation) {
      return res.status(400).json({
        success: false,
        message: "Invalid profile update fields",
      });
    }

    /**
     * 🧠 req.user comes from auth middleware
     * - Changes tracked by mongoose
     */
    updates.forEach((field) => {
      req.user[field] = req.body[field];
    });

    // 💾 Triggers schema validations & hooks
    await req.user.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: req.user,
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
 * 🔐 CHANGE PASSWORD (Authenticated)
 * ============================
 * ⚠️ This is NOT forgot-password
 * This requires the user to be logged in
 */
profileRouter.patch("/password", userAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    /**
     * 🔍 Fetch password explicitly
     * - Password is hidden by default in schema
     */
    const user = await User.findById(req.user._id).select("+password");

    // 🔐 Verify existing password
    const isValid = await user.validatePassword(currentPassword);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    /**
     * 🧠 DO NOT hash manually
     * - pre('save') hook handles hashing
     */
    user.password = newPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

module.exports = profileRouter;
