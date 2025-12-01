const jwt=require("jsonwebtoken");

const userAuth=async (err,req,res,next)=>{
    // get the token from cookies
    const {token}=req.cookies;
    if (!token)
    {
        throw new Error("Unauthorized Access");
    }

    // verify the token
    const decodedData=jwt.verify(token,"your_jwt_secret_key");

    // if valid, attach user info to req object and call next()
    req.userId=decodedData.userId;
    next();
    

}