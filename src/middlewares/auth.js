// const jwt = require("jsonwebtoken");

// const userAuth = async (req, res, next) => {
//   try {
//     const { token } = req.cookies;
//     if (!token) return res.status(401).send("Unauthorized Access");

//     const decoded = jwt.verify(token, "your_jwt_secret_key");

//     req.user = decoded;
//     next();
//   } catch (error) {
//     console.log(error);
//     res.status(401).send({ message: "Something went wrong! Please trya again" });
//   }
// };

// module.exports = { userAuth };

const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * 🔐 Authentication middleware
 * - Verifies JWT from cookies
 * - Attaches authenticated user to req object
 */
const userAuth = async (req, res, next) => {
  try {
    // 🍪 Extract token from HTTP-only cookies
    const { token } = req.cookies;

    // 🚫 If token is missing, user is not authenticated
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access. Token missing.",
      });
    }

    /**
     * 🔍 Verify JWT signature & expiration
     * - Throws error if token is invalid or expired
     */
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    /**
     * 👤 Fetch user from DB
     * - Ensures user still exists (important for deleted/blocked users)
     * - select("+password") is NOT used → password remains hidden
     */
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User no longer exists",
      });
    }

    /**
     * 📎 Attach user to request object
     * - Makes user data available in next controllers
     */
    req.user = user;
    console.log(req.user);
    next();
  } catch (error) {
    console.error("Auth middleware error:", error.message);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

module.exports = { userAuth };
