const nodemailer = require("nodemailer");

module.exports = async function sendDashboardEmail(pdfBuffer, participants) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "YOUR_EMAIL@gmail.com",
      pass: "YOUR_APP_PASSWORD",
    },
  });

  await transporter.sendMail({
    from: '"IntelliMeet" <YOUR_EMAIL@gmail.com>',
    to: participants.join(","),
    subject: "Your IntelliMeet Dashboard",
    text: "Please find attached the meeting dashboard.",
    attachments: [
      {
        filename: "meeting-dashboard.pdf",
        content: pdfBuffer,
      },
    ],
  });

  console.log("📧 Dashboard emailed successfully!");
};
