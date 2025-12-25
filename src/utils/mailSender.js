const nodemailer = require("nodemailer");


const mailSender=async(email,title,body,text)=>{

    try {
        const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PASS, // The 16-character App Password
        },
        });

        // Send an email using async/await
        const info = await transporter.sendMail({
            from: `"DevTinder" <${process.env.MAIL_USER}>`,
            to: `${email}`,
            subject: `${title}`,
            text: `${text}`, // Plain-text version of the message
            html: `${body}`, // HTML version of the message
        });

        //console.log("Message sent:", info.messageId);
        return info;
       
    } catch (error) {
        console.error("Error in mailSender:", error);
    }

}

module.exports=mailSender;