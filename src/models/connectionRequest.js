const mongoose=require('mongoose');

const connectionRequestSchema=mongoose.Schema({
    fromUserId:
    {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    toUserId:
    {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    status:
    {
        type: String,
        required: true,
        enum:
        {
            values: ["ignored","interested","accepted","rejected"],
            message: `{VALUE} is not valid status`,
        }
    }
},
{
    timestamps:true,
})

// To ensure that there is only one connection request between two users at any time
//  Compound Unique Index => fromUserId + toUserId should be unique together
// TODO: Learn more about Indexes in Mongoose
connectionRequestSchema.index({fromUserId:1,toUserId:1},{unique:true});


// Schema Level Validation
connectionRequestSchema.pre('save', function(next)
{
    const connectionRequest=this;

    if (connectionRequest.fromUserId.equals(connectionRequest.toUserId))
    {
        throw new Error("You cannot send request to yourself");
    }
    next();
})

module.exports=mongoose.model("ConnectionRequest",connectionRequestSchema);