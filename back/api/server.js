require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mailjet = require("node-mailjet");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const axios = require("axios");
const xml2js = require("xml2js");
const crypto = require("crypto");

// Initialisation du serveur Express
const app = express();

// 🔥 Configuration CORS avancée
const corsOptions = {
  origin: "http://localhost:5000", // Autorise les requêtes depuis ton frontend
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true, // Autorise les cookies si besoin
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // Gère les requêtes preflight OPTIONS

app.use(express.json());
app.use(express.static(path.join(__dirname, "../../front")));

// 🔥 Configuration de Mailjet
const mailjetClient = mailjet.apiConnect(
  process.env.MAILJET_API_KEY,
  process.env.MAILJET_API_SECRET
);

// 🔥 Vérification des variables d'environnement requises
const requiredEnvVars = [
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "MAILJET_API_KEY",
  "MAILJET_API_SECRET",
  "SENDER_EMAIL",
  "MONDIAL_RELAY_ENS_CODE",
  "MONDIAL_RELAY_PRIVATE_KEY",
];

requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    console.error(`❌ Erreur : Variable d'environnement manquante : ${envVar}`);
    process.exit(1);
  }
});

// 🔥 Initialisation Firebase
if (admin.apps.length === 0) {
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  };

  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
    });
    console.log("✅ Firebase Admin SDK initialisé.");
  } catch (error) {
    console.error("❌ Erreur Firebase :", error);
    process.exit(1);
  }
}

// Active Firestore
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

// 🖼️ Configuration du stockage des fichiers (multer)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// 📩 Route d'envoi d'email avec pièce jointe (SAV)
app.post("/send-sav-email", upload.single("image"), async (req, res) => {
    const { name, email, subject, message } = req.body;
    const image = req.file;
  
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ success: false, message: "Tous les champs sont requis." });
    }
  
    try {
      let attachments = [];
      if (image) {
        attachments.push({
          ContentType: image.mimetype,
          Filename: image.originalname,
          Base64Content: fs.readFileSync(image.path, "base64"),
        });
      }
  
      const result = await mailjetClient.post("send", { version: "v3.1" }).request({
        Messages: [
          {
            From: { Email: process.env.SENDER_EMAIL, Name: "Fleur De Pau" },
            To: [{ Email: process.env.RECEIVER_EMAIL, Name: "Admin" }],
            ReplyTo: { Email: email },
            Subject: subject,
            TextPart: `Nom: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
            HTMLPart: `<h3>Nouveau message de ${name}</h3><p>Email: ${email}</p><p>${message}</p>`,
            Attachments: attachments,
          },
        ],
      });
  
      if (result.body.Messages[0].Status === "success") {
        res.redirect('/contact.html'); // Redirection vers contact.html
      } else {
        res.status(500).json({ success: false, message: "Erreur d'envoi d'email." });
      }
    } catch (error) {
      console.error("❌ Erreur d'email :", error.message);
      res.status(500).json({ success: false, message: "Erreur serveur." });
    }
  });
  

// 📩 Route d'envoi d'email simple (Contact)
app.post("/send-contact-email", async (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ success: false, message: "Tous les champs sont requis." });
  }

  try {
    const result = await mailjetClient.post("send", { version: "v3.1" }).request({
      Messages: [
        {
          From: { Email: process.env.SENDER_EMAIL, Name: "Fleur De Pau" },
          To: [{ Email: process.env.RECEIVER_EMAIL, Name: "Admin" }],
          ReplyTo: { Email: email },
          Subject: subject,
          TextPart: `Nom: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
          HTMLPart: `<h3>Nouveau message de ${name}</h3><p>Email: ${email}</p><p>${message}</p>`,
        },
      ],
    });

    if (result.body.Messages[0].Status === "success") {
      res.json({ success: true, message: "Email envoyé avec succès !" });
    } else {
      res.status(500).json({ success: false, message: "Erreur d'envoi d'email." });
    }
  } catch (error) {
    console.error("❌ Erreur d'email :", error.message);
    res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

// Route POST pour sauvegarder la commande dans Firebase
app.post('/save-order', async (req, res) => {
  try {
    const commandeData = req.body;  // Récupérer les données envoyées par le client
    if (!commandeData || !commandeData.nom || !commandeData.email || !commandeData.produit) {
      return res.status(400).json({ success: false, message: "Données de commande manquantes" });
    }

    const ordersCollection = db.collection('commande');  // Nom de ta collection dans Firestore
    const docRef = await ordersCollection.add(commandeData);  // Ajouter la commande à Firestore

    res.status(200).json({ success: true, docId: docRef.id });
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement de la commande:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ Démarrage du serveur
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`));

module.exports = app;
