/* eslint-disable max-len */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({origin: true}); // Enable CORS

admin.initializeApp();

exports.listUsers = functions.https.onCall(async (data, context) => {
  // Wrap with CORS middleware
  return cors(async (req, res) => {
    console.log("listUsers function called with data:", data);

    if (!context.auth) {
      console.error("Unauthenticated request");
      throw new functions.https.HttpsError("unauthenticated", "Authentication required");
    }

    try {
      const listUsersResult = await admin.auth().listUsers();
      console.log("Successfully listed users:", listUsersResult.users.length);
      const users = listUsersResult.users.map((user) => ({
        uid: user.uid,
        email: user.email || null,
        displayName: user.displayName || null,
        lastSignInTime: user.metadata.lastSignInTime || null,
        creationTime: user.metadata.creationTime || null,
        emailVerified: user.emailVerified || false,
        providerData: user.providerData || [],
      }));
      return {users};
    } catch (error) {
      // eslint-disable-next-line quotes
      console.error('Error listing users:', error);
      throw new functions.https.HttpsError("internal", "Error listing users", error.message);
    }
  })(null, null); // Pass dummy req, res for onCall compatibility
});
