require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mailjet = require("node-mailjet");
const admin = require("firebase-admin");
const path = require("path");
const axios = require("axios");
const multer = require("multer");
const fs = require("fs");

const app = express();

// ⚒️ Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../../front')));

// 🔥 Initialisation Firebase Admin SDK
if (!process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL) {
    console.error("\u274c Erreur : variables d'environnement Firebase manquantes !");
    process.exit(1);
}

const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
});

const db = admin.firestore();

// 📦 Configuration Multer pour l'upload d'images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// 🌐 Initialisation de Mailjet
if (!process.env.MAILJET_API_KEY || !process.env.MAILJET_API_SECRET) {
  console.error("\u274c Erreur : Clé API Mailjet manquante !");
  process.exit(1);
}
const mailjetClient = mailjet.apiConnect(
    process.env.MAILJET_API_KEY,
    process.env.MAILJET_API_SECRET
);

// 📥 Route pour récupérer les points relais Mondial Relay
// 📥 Route pour récupérer les points relais Mondial Relay
app.post("/api/mondial-relay/points-relais", async (req, res) => {
  const { ville, codePostal } = req.body;
  
  if (!ville || !codePostal) {
      return res.status(400).json({ success: false, message: "Ville et code postal requis" });
  }

  try {
      const response = await axios.post(process.env.MONDIAL_RELAY_API_URL, new URLSearchParams({
          enseigne: process.env.MONDIAL_RELAY_ENS_CODE,
          cle: process.env.MONDIAL_RELAY_PRIVATE_KEY,
          ville: ville,
          cp: codePostal,
          option: "points_relais"  // Paramètre exemple, à ajuster selon l'API de Mondial Relay
      }).toString(), {
          headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
          },
      });

      res.json(response.data);
  } catch (error) {
      console.error("❌ Erreur API Mondial Relay:", error);
      res.status(500).json({ success: false, message: "Erreur serveur Mondial Relay" });
  }
});

// 📦 Route pour créer une expédition Mondial Relay
app.post("/api/mondial-relay/expedition", async (req, res) => {
  const { expediteur, destinataire, poids } = req.body;
  
  if (!expediteur || !destinataire || !poids) {
      return res.status(400).json({ success: false, message: "Tous les champs sont requis" });
  }

  try {
      const response = await axios.post(process.env.MONDIAL_RELAY_API_URL, new URLSearchParams({
          enseigne: process.env.MONDIAL_RELAY_ENS_CODE,
          cle: process.env.MONDIAL_RELAY_PRIVATE_KEY,
          expediteur: expediteur,
          destinataire: destinataire,
          poids: poids,
          option: "expedition"  // Paramètre exemple, à ajuster selon l'API de Mondial Relay
      }).toString(), {
          headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
          },
      });

      res.json(response.data);
  } catch (error) {
      console.error("❌ Erreur API Mondial Relay (expédition):", error);
      res.status(500).json({ success: false, message: "Erreur serveur Mondial Relay (expédition)" });
  }
});


// ✅ Démarrage du serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("\ud83d\ude80 Serveur lancé sur http://localhost:" + PORT));

module.exports = app;
