const express=require('express');
const paymentRouter=express.Router();
const RazorpayInstance=require("../utils/razorpay");
const Payment=require("../models/payment");
const {userAuth}=require("../middlewares/auth")
const memberShipAmount=require("../utils/constants");
const {validateWebhookSignature} = require('razorpay/dist/utils/razorpay-utils');
const User = require('../models/user');

// Route to create a new payment order
paymentRouter.post("/create-order",userAuth,async(req,res)=>{
    try {
        const {memberShipType}=req.body;
        const {firstName,lastName,email}=req.user;

        const order=await RazorpayInstance.orders.create({
            amount: memberShipAmount[memberShipType],
            currency: "INR",
            receipt: `receipt_${Date.now()}`,
            notes: {
                firstName,
                lastName,
                email,
                memberShipType
            }
        })

        console.log(order);

        // Save order details to the database
        const payment=new Payment({
            userId:req.user._id,
            orderId:order.id,
            status:order.status,
            amount:order.amount,
            currency:order.currency,
            receipt:order.receipt,
            notes:order.notes
        })
        const savedPayment=await payment.save();

        // Return back my order details to frontend
        res.status(201).json({
            success:true,
            message:"Order created successfully",
            data:{
                paymentId:savedPayment._id,
                orderId:order.id,
                amount:order.amount,
                currency:order.currency,
                keyId:process.env.RAZORPAY_KEY_ID
            }
        })
 

    } catch (error) {
        console.error("Error creating order:", error);
        res.status(500).json({success:false,message:"Server Error"});
    }
})

paymentRouter.post("/payment/webhook",async(req,res)=>{
    try {
        const webhookSignature = req.headers('X-Razorpay-Signature');

        const isWebHookValid=validateWebhookSignature(JSON.stringify(req.body),
        webhookSignature, 
        process.env.RAZORPAY_WEBHOOK_SECRET);

        if(!isWebHookValid){
            return res.status(400).json({success:false,message:"Invalid webhook signature"});
        }

        if (req.body.event === 'payment.failed') {
            return res.status(200).json({ success: false, message: 'Payment failed' });
        }
        if (req.body.event !== 'payment.captured') {
            return res.status(200).json({ success: false, message: 'Payment Captured' });
        }


        // Update my payment status in DB
        const paymentDetails=req.body.payload.payment.entity;
        const payment=await Payment.findOne({orderId:paymentDetails.order_id});

        if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });

        payment.status=paymentDetails.status;
        await payment.save();

        // Update the user as premium member
        const user=await User.findOne({_id:payment.userId});
        user.isPremium=true;
        user.memberShipType=payment.notes.memberShipType;
        await user.save();

        // return success response to razorpay
        return res.status(200).json({success:true,message:"Webhook received successfully"});
        
    } catch (error) {
        console.error("Error verifying payment:", error);
        res.status(500).json({success:false,message:"Server Error"});
    }
})


paymentRouter.get("/premium/verify",userAuth,async(req,res)=>{
    const user=req.user.toJSON();
    if (user.isPremium){
        return res.status(200).json({
            success:true,
            message:"User is a premium member",
            isPremium:true,
            memberShipType:user.memberShipType
        });} 
    else{
        return res.status(200).json({
            success:true,
            message:"User is not a premium member",
            isPremium:false
        });
    }

});

module.exports=paymentRouter;