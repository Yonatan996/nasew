const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

// Initialize Firebase Admin SDK
admin.initializeApp();

// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail', // Or use other SMTP services
  auth: {
    user: 'yourcompanyemail@gmail.com',  // Replace with your email
    pass: 'yourpassword',  // App password recommended if 2FA is enabled
  },
});

// Sends a welcome email when a new team member document is created
exports.sendWelcomeEmail = functions.firestore
  .document('teamMembers/{userId}')
  .onCreate(async (snap, context) => {
    const newUser = snap.data();
    const { email: userEmail, name: userName } = newUser;

    const mailOptions = {
      from: '"Company Name" <yourcompanyemail@gmail.com>', // Better to include a name
      to: userEmail,
      subject: 'Welcome to the Company!',
      text: `Hello ${userName},\n\nYour account has been created. Welcome aboard!\n\nBest regards,\nCompany Team`,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log('Welcome email sent to:', userEmail);
    } catch (error) {
      console.error('Failed to send welcome email:', error);
    }
  });

// Updates last sign-in timestamp when user signs in
exports.updateLastSignIn = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const userRef = admin.firestore().collection('teamMembers').doc(context.auth.uid);

  try {
    await userRef.set(
      { lastSignIn: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
    return { success: true };
  } catch (error) {
    console.error('Error updating last sign-in:', error);
    throw new functions.https.HttpsError('internal', 'Failed to update last sign-in.');
  }
});

// Lists all users - accessible only by admins
exports.listUsers = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.token.isAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can list users.');
  }

  try {
    const listUsersResult = await admin.auth().listUsers();
    const users = listUsersResult.users.map(user => ({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      lastSignInTime: user.metadata.lastSignInTime,
    }));

    return { users };
  } catch (error) {
    console.error('Error listing users:', error);
    throw new functions.https.HttpsError('internal', 'Unable to list users.');
  }
});
