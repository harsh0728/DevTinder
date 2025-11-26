
const mongoose=require('mongoose')
require('dotenv').config();

const connectDB=async ()=>{
    await mongoose.connect(process.env.Database_URL);
}

module.exports=connectDB;