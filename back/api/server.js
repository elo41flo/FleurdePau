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

// 🛠️ Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../../front')));

// 🔥 Initialisation Firebase Admin SDK
if (!process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL) {
    console.error("❌ Erreur : variables d'environnement Firebase manquantes !");
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

// Configuration du stockage des fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Dossier où seront stockées les images téléchargées
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Middleware Multer pour gérer l'upload des fichiers
const upload = multer({ storage: storage });

// 📩 Route pour envoyer un email via le formulaire de contact avec une image
app.post("/send-sav-email", upload.single('image'), async (req, res) => {
  const { name, email, subject, message } = req.body;
  const image = req.file; // L'image téléchargée

  if (!name || !email || !subject || !message) {
      return res.status(400).json({ success: false, message: "Tous les champs sont requis." });
  }

  try {
      // Créer la pièce jointe
      let attachments = [];
      if (image) {
          attachments.push({
              ContentType: image.mimetype,
              Filename: image.originalname,
              Base64Content: fs.readFileSync(image.path, 'base64')
          });
          console.log("Image téléchargée :", image.filename);
      }

      // Envoi de l'email via Mailjet avec l'image en pièce jointe
      const result = await mailjetClient.post("send", { version: "v3.1" }).request({
          Messages: [
              {
                  From: { Email: process.env.SENDER_EMAIL, Name: "Fleur De Pau" },
                  To: [{ Email: process.env.RECEIVER_EMAIL, Name: "Admin" }],
                  ReplyTo: { Email: email },
                  Subject: subject,
                  TextPart: `Nom: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
                  HTMLPart: `<h3>Nouveau message de ${name}</h3><p>Email: ${email}</p><p>${message}</p>`,
                  Attachments: attachments // Attacher l'image
              }
          ]
      });

      console.log("Résultat Mailjet:", result.body);

      if (result.body.Messages[0].Status === "success") {
          res.json({ success: true, message: "Email envoyé avec succès !" });
      } else {
          res.status(500).json({ success: false, message: "Erreur d'envoi d'email." });
      }
  } catch (error) {
      console.error("❌ Erreur lors de l'envoi d'email :", error.message);
      res.status(500).json({ success: false, message: "Erreur serveur. Détails : " + error.message });
  }
});


// ✉️ Initialisation Mailjet
if (!process.env.MAILJET_API_KEY || !process.env.MAILJET_API_SECRET) {
  console.error("❌ Erreur : Clé API Mailjet manquante !");
  process.exit(1);
}

// Utilisation de apiConnect() pour initialiser correctement Mailjet
const mailjetClient = mailjet.apiConnect(
process.env.MAILJET_API_KEY,
process.env.MAILJET_API_SECRET
);



console.log('MAILJET_API_KEY_PUBLIC:', process.env.MAILJET_API_KEY_PUBLIC);
console.log('MAILJET_API_KEY_PRIVATE:', process.env.MAILJET_API_KEY_PRIVATE);


// 📩 Route pour envoyer un email via le formulaire de contact
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
                  HTMLPart: `<h3>Nouveau message de ${name}</h3><p>Email: ${email}</p><p>${message}</p>`
              }
          ]
      });

      console.log("Résultat Mailjet:", result.body);

      if (result.body.Messages[0].Status === "success") {
          res.json({ success: true, message: "Email envoyé avec succès !" });
      } else {
          res.status(500).json({ success: false, message: "Erreur d'envoi d'email." });
      }
  } catch (error) {
      console.error("❌ Erreur lors de l'envoi d'email :", error.message);
      res.status(500).json({ success: false, message: "Erreur serveur. Détails : " + error.message });
  }
});

// 📦 Route pour enregistrer une commande
app.post('/api/create-order', async (req, res) => {
    const { produit, quantité, prix, orderId, userEmail } = req.body;

    if (!produit || !quantité || !prix || !orderId || !userEmail) {
        return res.status(400).send('Détails de la commande incomplets');
    }

    try {
        await db.collection('orders').add({ produit, quantité, prix, orderId, userEmail });
        res.status(200).send('Commande enregistrée avec succès');
    } catch (error) {
        console.error('❌ Erreur lors de l\'enregistrement de la commande :', error);
        res.status(500).send('Erreur lors de l\'enregistrement de la commande');
    }
});

// 📦 Route pour récupérer le nombre d'articles dans le panier
app.get('/api/get-cart-count', async (req, res) => {
    try {
        const userEmail = req.query.userEmail;
        if (!userEmail) {
            return res.status(400).json({ message: "Email manquant" });
        }

        const userCartRef = db.collection('carts').doc(userEmail);
        const userCartDoc = await userCartRef.get();

        if (!userCartDoc.exists) {
            return res.json({ count: 0 });
        }

        const panier = userCartDoc.data().items || [];
        return res.json({ count: panier.length });
    } catch (error) {
        console.error("❌ Erreur lors de la récupération du panier :", error);
        return res.status(500).json({ message: "Erreur serveur" });
    }
});

// ✅ Démarrage du serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`));

module.exports = app;
