const express = require("express");
const profileRouter = express.Router();
const User = require("../models/User");
const { userAuth } = require("../middlewares/auth");

profileRouter.get("/profile/view", userAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");
    if (!user) throw new Error("User not found");

    res.status(200).send({ data: user });
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

profileRouter.patch("/profile/edit", userAuth, async (req, res) => {
  try {
    const allowedUpdates = [
      "firstName",
      "lastName",
      "age",
      "gender",
      "skills",
      "about"
    ];

    const updates = Object.keys(req.body);
    const isValidOperation = updates.every(update =>
      allowedUpdates.includes(update)
    );

    if (!isValidOperation) {
      throw new Error("Invalid updates!");
    }

    const user = await User.findById(req.user.userId);
    if (!user) throw new Error("User not found");

    updates.forEach(update => {
      user[update] = req.body[update];
    });

    await user.save();

    res.status(200).send({
      message: "Profile updated successfully",
      data: user
    });
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

// TODO: Add route for forgot password
profileRouter.post("/profile/password", async (req, res) => {
        try {
            const { email, newPassword } = req.body;

            const user = await User.findOne({ email: email });
            if (!user) {
                throw new Error("User not found");
            }
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            user.password = hashedPassword;
            await user.save();
            res.status(200).send({ message: "Password updated successfully" });
            
            
        } catch (error) {
            res.status(500).send({message:"Internal Server Error"});
        }
});

module.exports = profileRouter;
