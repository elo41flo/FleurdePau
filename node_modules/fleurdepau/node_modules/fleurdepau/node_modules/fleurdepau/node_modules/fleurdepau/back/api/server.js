const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const mailjet = require('node-mailjet');
const path = require('path');
const axios = require('axios');  // Pour les requêtes vers PayPal
require('dotenv').config();

// 🔍 Vérification des variables d'environnement
console.log("FIREBASE_PRIVATE_KEY:", process.env.FIREBASE_PRIVATE_KEY ? "LOADED" : "NOT LOADED");
console.log("MAILJET_API_KEY_PUBLIC:", process.env.MAILJET_API_KEY_PUBLIC ? "LOADED" : "NOT LOADED");
console.log("PAYPAL_CLIENT_ID:", process.env.PAYPAL_CLIENT_ID ? "LOADED" : "NOT LOADED");

// 🔥 Initialisation Firebase Admin SDK
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
const mailjetClient = mailjet.apiConnect(
  process.env.MAILJET_API_KEY_PUBLIC,
  process.env.MAILJET_API_KEY_PRIVATE
);

// 🚀 Création de l'application Express
const app = express();

// 🛠️ Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../../front'))); // Servir les fichiers statiques

console.log("Chemin de login.html :", path.resolve(__dirname, '../front/login.html'));
// 🏠 Route principale
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../front/login.html'));
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
    console.error('Erreur lors de l\'enregistrement de la commande :', error);
    res.status(500).send('Erreur lors de l\'enregistrement de la commande');
  }
});

// Serveur - Ajout au panier (nouvelle route)
app.post('/api/add-to-cart', async (req, res) => {
  const { produit, quantité, userEmail } = req.body;

  if (!produit || !quantité || !userEmail) {
    return res.status(400).send('Détails du panier incomplets');
  }

  try {
    const cartRef = db.collection('carts').doc(userEmail);
    const cartDoc = await cartRef.get();

    let cart = cartDoc.exists ? cartDoc.data().cart : [];
    cart.push({ produit, quantité });  // Ajouter le produit au panier

    await cartRef.set({ cart });  // Enregistrer le panier mis à jour dans Firestore

    res.status(200).send('Produit ajouté au panier');
  } catch (error) {
    console.error('Erreur lors de l\'ajout au panier :', error);
    res.status(500).send('Erreur lors de l\'ajout au panier');
  }
});


// ✉️ Route pour envoyer un email après une commande
app.post('/api/send-order-email', async (req, res) => {
  const { orderId, userEmail } = req.body;

  if (!orderId || !userEmail) {
    return res.status(400).send('ID de commande ou email manquant');
  }

  try {
    const orderDoc = await db.collection('orders').doc(orderId).get();
    if (!orderDoc.exists) {
      return res.status(404).send('Commande non trouvée');
    }

    const clientMessage = {
      From: { Email: "elo.robert41@gmail.com", Name: "FleurdePau" },
      To: [{ Email: userEmail, Name: "Client" }],
      Subject: "Confirmation de commande",
      TextPart: "Merci pour votre commande !",
      HTMLPart: "<h3>Merci pour votre commande !</h3><p>Votre commande a été bien enregistrée.</p>"
    };

    const managerMessage = {
      From: { Email: "elo.robert41@gmail.com", Name: "FleurdePau" },
      To: [{ Email: "eloiser41@gmail.com", Name: "Gérant" }],
      Subject: "Nouvelle commande reçue",
      TextPart: "Une nouvelle commande a été passée.",
      HTMLPart: "<h3>Nouvelle commande reçue !</h3><p>Vérifiez l'espace admin.</p>"
    };

    await Promise.all([
      mailjetClient.post('send', { version: '3.1' }).request({ Messages: [clientMessage] }),
      mailjetClient.post('send', { version: '3.1' }).request({ Messages: [managerMessage] })
    ]);

    res.status(200).send('Emails envoyés avec succès');
  } catch (error) {
    console.error('Erreur lors de l\'envoi des emails :', error);
    res.status(500).send('Erreur lors de l\'envoi des emails');
  }
});

// 🏦 **Intégration de PayPal**

// ✅ Route pour créer une commande PayPal
app.post('/api/paypal/create-order', async (req, res) => {
  const { prix, devise = 'EUR' } = req.body;

  try {
    // 🔑 Obtenir le token d'accès PayPal
    const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
    const tokenResponse = await axios.post(`${process.env.PAYPAL_API}/v1/oauth2/token`, 'grant_type=client_credentials', {
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const accessToken = tokenResponse.data.access_token;

    // 📦 Créer une commande PayPal
    const orderResponse = await axios.post(`${process.env.PAYPAL_API}/v2/checkout/orders`, {
      intent: 'CAPTURE',
      purchase_units: [{ amount: { currency_code: devise, value: prix } }]
    }, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
    });

    res.json({ id: orderResponse.data.id }); // Retourne l'ID de commande PayPal
  } catch (error) {
    console.error('Erreur PayPal:', error.response?.data || error.message);
    res.status(500).json({ error: 'Erreur lors de la création de la commande PayPal' });
  }
});

// ✅ Route pour capturer le paiement
app.post('/api/paypal/capture-order', async (req, res) => {
  const { orderID } = req.body;

  try {
    // 🔑 Obtenir le token d'accès PayPal
    const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
    const tokenResponse = await axios.post(`${process.env.PAYPAL_API}/v1/oauth2/token`, 'grant_type=client_credentials', {
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const accessToken = tokenResponse.data.access_token;

    // 🎯 Capturer le paiement
    const captureResponse = await axios.post(`${process.env.PAYPAL_API}/v2/checkout/orders/${orderID}/capture`, {}, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
    });

    res.json(captureResponse.data);
  } catch (error) {
    console.error('Erreur PayPal:', error.response?.data || error.message);
    res.status(500).json({ error: 'Erreur lors de la capture du paiement PayPal' });
  }
});

// 🎯 Démarrer le serveur en local (si nécessaire)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`));

// ✅ Exporter l'application pour Vercel
module.exports = app;
