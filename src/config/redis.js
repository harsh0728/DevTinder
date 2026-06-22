//const createClient=require("redis");
import {createClient} from "redis";

export const redisClient=createClient({
    url:"redis://localhost:6379",
   // protocolVersion: 2 // Explicitly forces RESP2
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