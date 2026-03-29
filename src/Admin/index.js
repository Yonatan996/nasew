const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

// Initialize Firebase Admin SDK
admin.initializeApp();

// Set up Nodemailer transporter using your email credentials
const transporter = nodemailer.createTransport({
  service: "gmail", // You can also use another email service like Outlook
  auth: {
    user: "yourcompanyemail@gmail.com",  // Your company email
    pass: "yourpassword",  // Your email password or App password if 2FA enabled
  },
});

// Firebase Function to send an email when a new team member is created
exports.sendWelcomeEmail = functions.firestore
  .document("teamMembers/{userId}")
  .onCreate(async (snap, context) => {
    const newUser = snap.data();
    const userEmail = newUser.email;
    const userName = newUser.name;

    const mailOptions = {
      from: "yourcompanyemail@gmail.com", // Sender address
      to: userEmail, // Recipient address
      subject: "Welcome to the Company!", // Subject
      text: `Hello ${userName},\n\nYour account has been created. Welcome aboard!`, // Email body
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log("Email sent to", userEmail);
    } catch (error) {
      console.error("Error sending email", error);
    }
  });

// Firebase Function to list users (restricted to admins)



exports.listUsers = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }
  
  try {
    const listUsersResult = await admin.auth().listUsers();
    return { users: listUsersResult.users };
  } catch (error) {
    throw new functions.https.HttpsError('internal', 'Error listing users', error);
  }
});