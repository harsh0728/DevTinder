// src/utils/cacheBust.js
const { redisClient } = require("../config/redis");

const bustFeedCache = async (userId) => {
  try {
    const limits = [10, 20, 50];
    const pages = Array.from({ length: 15 }, (_, i) => i + 1);
    const keys = limits.flatMap((limit) =>
      pages.map((page) => `feed:${userId}:page:${page}:limit:${limit}`)
    );
    await redisClient.del(keys);
  } catch (err) {
    console.error(`Feed cache bust failed [${userId}]:`, err.message);
  }
};

const bustConnectionsCache = async (userId) => {
  try {
    await redisClient.del(`user:${userId}:connections`);
  } catch (err) {
    console.error(`Connections cache bust failed [${userId}]:`, err.message);
  }
};

const bustReceivedRequestsCache = async (userId) => {
  try {
    await redisClient.del(`user:${userId}:requests:received`);
  } catch (err) {
    console.error(`Received requests cache bust failed [${userId}]:`, err.message);
  }
};

const bustProfileCache = async (userId) => {
  try {
    await redisClient.del(`user:${userId}:profile`);
  } catch (err) {
    console.error(`Profile cache bust failed [${userId}]:`, err.message);
  }
};

module.exports = {
  bustFeedCache,
  bustConnectionsCache,
  bustReceivedRequestsCache,
  bustProfileCache,
};