// src/middlewares/limiters.js
const rateLimiter = require("./rateLimiter");

// 5 attempts per 5 minutes — brute force protection
const authLimiter = rateLimiter(5, 120, "rate:auth");

// 3 attempts per 10 minutes — prevent email spam
const passwordResetLimiter = rateLimiter(3, 600, "rate:reset");

// 30 swipes per minute — prevent bot swiping
const swipeLimiter = rateLimiter(30, 60, "rate:swipe");

// 100 requests per minute — general read protection  
const readLimiter = rateLimiter(100, 60, "rate:read");

// 10 payment attempts per hour — fraud prevention
const paymentLimiter = rateLimiter(10, 3600, "rate:payment");

module.exports = {
  authLimiter,
  passwordResetLimiter,
  swipeLimiter,
  readLimiter,
  paymentLimiter,
};