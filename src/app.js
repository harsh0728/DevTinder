const express=require('express');
const connectDB=require("./config/database")
const app=express();
const User=require("./models/User");

app.use(express.json());


app.get("/user",async (req,res)=>{
    
    const userEmail=req.body.email;
    try {
        const users=await User.find({email:userEmail});
        if(users.length===0){
            res.status(404).send({message:"User not found"});
        }else{
            //res.status(200).send({message:"User found"},{data:users});
            res.send(users);
        }
    } catch (error) {
        res.status(500).send({message:"Internal Server Error"});
    }
})

app.get("/feed",async (req,res)=>{
    try {
        const users=await User.find({});
        res.send(users)
        //res.status(200).send({message:"Users fetched successfully"},{"data":users});
    } catch (error) {
        res.status(500).send({message:"Internal Server Error"});
    }   
})

app.post("/signup",async (req,res)=>{
    const user=new User(req.body);
    await user.save();  

    res.status(201).send({message:"User registered successfully"},{data:req.body});
})

connectDB().then(()=>{
    console.log("Database connected successfully");
    app.listen(3000,()=>{
        console.log('Server is running on port 3000');
    });
}).catch((error) => {
      console.log("DB Connection Failed");
      console.error(error);
});
