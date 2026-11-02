require("dotenv").config();
const express = require("express");
const connectDB = require("./config/database");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const passport = require("passport");
require("./config/passport.js");


const authRouter = require("./routes/auth");
const profileRouter = require("./routes/profile");
const feedRouter = require("./routes/feed");
const requestRouter = require("./routes/request");
const userRouter = require("./routes/user");
const paymentRouter = require("./routes/payment");
const chatRouter = require("./routes/chat");
const initializeSocket = require("./utils/socket");
const { apiRateLimiter } = require("./middlewares/validation");

const app = express();  
const http = require('http');
require("./utils/cronjob");


//Redis
const { connectRedis } = require("./config/redis.js");
const startServer=async()=>{
  await connectRedis();
}
startServer();

/* ================= Middleware ================= */
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.CLIENT_URL
        : "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());
app.use(passport.initialize());

/* ================= Routes ================= */
// Apply rate limiting
app.use("/api/auth", authRouter);
app.use("/api/profile", apiRateLimiter, profileRouter);
app.use("/api/feed", apiRateLimiter, feedRouter);
app.use("/api/request", apiRateLimiter, requestRouter);
app.use("/api/user", apiRateLimiter, userRouter);
app.use("/api/payment", apiRateLimiter, paymentRouter);
app.use("/api/chat", apiRateLimiter, chatRouter);

const server=http.createServer(app);
initializeSocket(server); // Socket Initialization

/* ================= 404 Handler ================= */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
  });
});

/* ================= Global Error Handler ================= */
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

/* ================= Server ================= */
const PORT = process.env.PORT || 3000;

connectDB().then(() => {  
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
