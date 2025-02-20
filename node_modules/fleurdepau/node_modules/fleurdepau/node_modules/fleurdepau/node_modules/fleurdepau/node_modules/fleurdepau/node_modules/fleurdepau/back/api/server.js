require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mailjet = require("node-mailjet");
const admin = require("firebase-admin");
const path = require("path");
const axios = require("axios");

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
app.post("/send-email", async (req, res) => {
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
                    ReplyTo: { Email: email }, // Permet à l'admin de répondre directement
                    Subject: subject,
                    TextPart: `Nom: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
                    HTMLPart: `<h3>Nouveau message de ${name}</h3><p>Email: ${email}</p><p>${message}</p>`
                }
            ]
        });

        console.log("Résultat Mailjet:", result.body);  // Ajout pour logs détaillés

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
