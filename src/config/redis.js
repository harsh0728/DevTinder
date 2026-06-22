//const createClient=require("redis");
import {createClient} from "redis";

export const redisClient=createClient({
    url:process.env.REDIS_URL,
});

redisClient.on("error",(err)=>{
    console.error("Redis Error:",err);
})

export const connectRedis=async ()=>{
    try {
        await redisClient.connect();
        console.log("Redis connected!")
    } catch (error) {
        console.error("Redis connection failer",error)
    }
}