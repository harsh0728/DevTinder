const cron =require('node-cron');
const {subDays,startOfDay,endOfDay}=require("date-fns");
const connectionRequest = require('../models/connectionRequest');
const mailSender=require("./mailSender")


cron.schedule('0 8 * * *', async() => {
  try {

    const yesterday=subDays(new Date(), 1);
    const yesterdayStart=startOfDay(yesterday);
    const yesterdayEnd=endOfDay(yesterday);

    const pendingRequests=await connectionRequest.find({
        status:"interested",
        createdAt:{
            $gte:yesterdayStart,
            $lt:yesterdayEnd
        }
    }).populate("fromUserId toUserId")

    const listOfEmails=[...new Set(pendingRequests.map(request=>request.toUserId?.email).filter(Boolean))];
    console.log(listOfEmails);

    // Here you can implement the logic to send emails to the users
    // For example, using nodemailer or any email service provider
    for(const email of listOfEmails){
        try 
        {
            const subject = "New Connection Requests";
            const body = `You have new connection requests.`;
            const text = `You have new connection requests.`;
            const res=await mailSender(email, subject, body, text);

        } catch (error) {
            console.error(`Error sending email to ${email}:`, error);
        }

    }

  } catch (error) {
    console.error('Error executing scheduled task:', error);
  }
});
