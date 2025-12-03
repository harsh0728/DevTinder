const express=require('express');
const connectDB=require("./config/database")
const cookieParser=require("cookie-parser");

const app=express();
app.use(express.json());
app.use(cookieParser());

const authRouter=require("./routes/auth");
const profileRouter=require("./routes/profile");
const feedRouter=require("./routes/feed");

app.use("/",authRouter);
app.use("/",profileRouter);
app.use("/",feedRouter);




connectDB().then(()=>{
    console.log("Database connected successfully");
    app.listen(3000,()=>{
        console.log('Server is running on port 3000');
    });
}).catch((error) => {
      console.log("DB Connection Failed");
      console.error(error);
});
