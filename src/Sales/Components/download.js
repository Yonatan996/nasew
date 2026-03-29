const admin = require("firebase-admin");
const json2xls = require("json2xls");
const fs = require("fs");

// Initialize Firebase Admin SDK
const serviceAccount = require("./path-to-service-account.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const firestore = admin.firestore();

// Function to fetch data and export to Excel
async function exportFirestoreData() {
  const collectionName = "your-collection-name"; // Replace with your collection name
  const snapshot = await firestore.collection(collectionName).get();

  const data = [];
  snapshot.forEach((doc) => {
    data.push({ id: doc.id, ...doc.data() });
  });

  const xls = json2xls(data);
  fs.writeFileSync("firestore_data.xlsx", xls, "binary");

  console.log("Data exported to firestore_data.xlsx successfully!");
}

exportFirestoreData().catch((error) => console.error("Error exporting data:", error));
