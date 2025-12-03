const jwt = require("jsonwebtoken");

const userAuth = async (req, res, next) => {
  try {
    const { token } = req.cookies;
    if (!token) throw new Error("Unauthorized Access");

    const decoded = jwt.verify(token, "your_jwt_secret_key");

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).send({ message: "Unauthorized Access" });
  }
};

module.exports = { userAuth };
