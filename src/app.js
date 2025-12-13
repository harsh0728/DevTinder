require("dotenv").config();
const express = require("express");
const connectDB = require("./config/database");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const authRouter = require("./routes/auth");
const profileRouter = require("./routes/profile");
const feedRouter = require("./routes/feed");
const requestRouter = require("./routes/request");
const userRouter = require("./routes/user");

const app = express();  

/* ================= Middleware ================= */
app.use(
  cors({
     origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

/* ================= Routes ================= */
app.use("/api/auth", authRouter);
app.use("/api/profile", profileRouter);
app.use("/api/feed", feedRouter);
app.use("/api/request", requestRouter);
app.use("/api/user", userRouter);

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
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
