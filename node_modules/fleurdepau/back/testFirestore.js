const admin = require('firebase-admin');

console.log("Chemin de la clé Firebase :", process.env.GOOGLE_APPLICATION_CREDENTIALS);

// Initialisation Firebase
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();

async function testAccess() {
  try {
    const snapshot = await db.collection('test').limit(1).get();
    console.log("🔥 Connexion Firestore réussie !");
  } catch (error) {
    console.error("❌ Erreur d'accès Firestore :", error);
  }
}

testAccess();
