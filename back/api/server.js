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

const app = express();

// 🔥 Configuration avancée CORS
const corsOptions = {
  origin: "http://localhost:5000", // Autoriser l'origine frontend
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true, // Important si utilisation de cookies
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json());
app.use(express.static(path.join(__dirname, "../../front")));

// 🔥 Configuration Mailjet
const mailjetClient = mailjet.apiConnect(
  process.env.MAILJET_API_KEY,
  process.env.MAILJET_API_SECRET
);

// 🔥 Vérification des variables d'environnement
const requiredEnvVars = [
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "MAILJET_API_KEY",
  "MAILJET_API_SECRET",
  "SENDER_EMAIL",
  "MONDIAL_RELAY_ENS_CODE",
  "MONDIAL_RELAY_PRIVATE_KEY",
  "MONDIAL_RELAY_MARK_CODE",
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

// 📩 Route d'envoi d'email avec pièce jointe
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
      res.redirect("/contact.html");
    } else {
      res.status(500).json({ success: false, message: "Erreur d'envoi d'email." });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

// Fonction pour générer la clé de sécurité
function generateSecurityKey(data, privateKey) {
  const concatenatedString = Object.values(data).join("") + privateKey;
  return crypto.createHash("md5").update(concatenatedString).digest("hex").toUpperCase();
}

// Middleware pour parser le corps de la requête en JSON
app.use(bodyParser.json());

// Route pour générer l'étiquette Mondial Relay
// Route pour rechercher des points relais
app.post("/search-relays", async (req, res) => {
  const { postalCode, city } = req.body;

  if (!postalCode && !city) {
    return res.status(400).json({ error: "Le code postal ou la ville est requis." });
  }

  try {
    // Construction de la requête XML pour récupérer les points relais
    const xmlRequestBody = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="http://www.mondialrelay.fr/webservice/">
        <soapenv:Header/>
        <soapenv:Body>
          <web:WSI2_ListePointsRelais>
            <web:Enseigne>${process.env.MONDIAL_RELAY_ENS_CODE}</web:Enseigne>
            <web:PrivateKey>${process.env.MONDIAL_RELAY_PRIVATE_KEY}</web:PrivateKey>
            <web:CPDestinataire>${postalCode}</web:CPDestinataire>
            <web:VilleDestinataire>${city}</web:VilleDestinataire>
          </web:WSI2_ListePointsRelais>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    // Appel à l'API Mondial Relay
    const response = await axios.post('https://api.mondialrelay.com/webservice/ListePointsRelais', xmlRequestBody, {
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        'Accept': 'application/xml'
      }
    });

    // Traitement de la réponse XML
    xml2js.parseString(response.data, { explicitArray: false }, (err, result) => {
      if (err) {
        return res.status(500).json({ error: "Erreur lors du traitement de la réponse de l'API." });
      }

      const relays = result["soapenv:Envelope"]["soapenv:Body"]["web:WSI2_ListePointsRelaisResponse"]["web:ListePointsRelais"]["PointRelais"];

      if (relays) {
        return res.json({ success: true, relays });
      } else {
        return res.status(404).json({ error: "Aucun point relais trouvé pour cette zone." });
      }
    });

  } catch (error) {
    console.error("Erreur lors de la recherche des points relais :", error);
    res.status(500).json({ error: "Erreur serveur lors de la recherche des points relais." });
  }
});


// ✅ Démarrage du serveur
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`));

module.exports = app;