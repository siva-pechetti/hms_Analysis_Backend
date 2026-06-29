const nodemailer=require("nodemailer");
 const transporter=nodemailer.createTransport({
    service:"gmail",
    auth:{
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD,
    }
 });

 const sendResetEmail=async(email,resetLink)=>{
    await transporter.sendMail({
        from: process.env.EMAIL,
        to:email,
        subject: "Password Reset",
        html:`
        <h3>Password Reset</h3>
        <a href="${resetLink}">Reset password</a>
        `
    });
 };
 module.exports={sendResetEmail}