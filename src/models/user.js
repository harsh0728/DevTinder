const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const validator = require("validator");

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: validator.isEmail,
        message: "Invalid email address",
      },
      index: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false, // 🔒 Hide password by default
    },
    age: {
      type: Number,
      min: 10,
      max: 100,
    },
    gender: {
      type: String,
      //enum: ["male", "female", "other"],
      lowercase: true,
      //default:""
    },
    isPremium:{
      type:Boolean,
      default:false
    },
    memberShipType:{
      type:String,
    },
    skills: {
      type: [String],
      set: skills =>
        [...new Set(skills.map(s => s.trim().toLowerCase()))],
    },
    about: {
      type: String,
      maxlength: 500,
    },
    photoUrl: {
      type: String,
      default:"https://res.cloudinary.com/dd7rkwaua/image/upload/v1765744880/avatar_km3w7y.jpg",
      validate: {
        validator: value =>
          !value || validator.isURL(value),
        message: "Invalid photo URL",
      },
    },
  },
  {
    timestamps: true,
  }
);

/* ================= Indexes ================= */
userSchema.index({ firstName: 1, lastName: 1 });

/* ================= Hooks ================= */
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});


/* ================= Methods ================= */
userSchema.methods.getJWT = function () {
  return jwt.sign(
    { userId: this._id },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
};

userSchema.methods.validatePassword = function (password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model.User || mongoose.model("User", userSchema);
