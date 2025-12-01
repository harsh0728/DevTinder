const mongoose=require('mongoose')
const bcrypt=require('bcrypt');
const jwt=require('jsonwebtoken');

const userSchema=mongoose.Schema({
    firstName:{
        type:String,
        required:true,
    },
    lastName:{
        type:String,
    },
    email:{
        type:String,
        required:true,
        unique:true,
        trim:true,
        lowercase:true,
        
    },
    password:{
        type:String,
        required:true,
    },
    age:{
        type:Number,
    },
    gender:
    {
        type:String,
        enum:["Male","Female","Other"],
        validate: function (value)
            {
                if (!["male","female","other"].includes(value.toLowerCase()))
                {
                    throw new Error("Gender must be Male, Female or Other");
                }
                
            }
        
    },
    
},
{
    timestamps:true,
})

userSchema.methods.getJWT=async function(){
    const user=this;
    const token=jwt.sign(
                    {
                        userId:user._id,
                    },
                    "your_jwt_secret_key",
                    {
                        expiresIn:"1h",
                    }
                );
    return token;
}

userSchema.methods.validatePassword=async function(passwordInputByUser){
    const user=this;
    const hashedPassword=user.password;
    const isValidPassword=await bcrypt.compare(passwordInputByUser,hashedPassword);
    return isValidPassword;
}

module.exports=mongoose.model("User",userSchema);