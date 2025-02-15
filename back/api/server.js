const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const mailjet = require('node-mailjet');
const path = require('path');
require('dotenv').config();

// Vérification des variables d'environnement
console.log("FIREBASE_PRIVATE_KEY:", process.env.FIREBASE_PRIVATE_KEY ? "LOADED" : "NOT LOADED"); // Debug
console.log(process.env.MAILJET_API_KEY_PUBLIC);

// Initialisation de Firebase Admin SDK avec des variables d'environnement
console.log(process.env.FIREBASE_PRIVATE_KEY); // Vérifie que la clé privée est lue correctement
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Remplacer les \n par des sauts de ligne
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
});

const db = admin.firestore();

// Initialisation de Mailjet avec les clés API
const mailjetClient = mailjet.apiConnect(
  process.env.MAILJET_API_KEY_PUBLIC,
  process.env.MAILJET_API_KEY_PRIVATE
);

// Initialisation de l'application Express
const app = express();

// Middleware pour parser les données JSON
app.use(bodyParser.json());

// Servir le fichier favicon.ico à partir du dossier public
app.use('/favicon.ico', express.static(path.join(__dirname, 'public', 'favicon.ico')));

// Route de test pour vérifier le serveur
app.get('/', (req, res) => {
  res.send('Serveur FleurdePau en cours d\'exécution !');
});

// Fonction pour enregistrer une commande dans Firestore
const saveOrderToFirestore = async (orderDetails) => {
  try {
    await db.collection('orders').add(orderDetails);
    console.log('Commande enregistrée avec succès');
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement de la commande :', error);
    throw error; // Propager l'erreur pour pouvoir la capturer dans la route
  }
};

// Route pour recevoir une commande
app.post('/create-order', async (req, res) => {
  const { produit, quantité, prix, orderId, userEmail } = req.body;

  if (!produit || !quantité || !prix || !orderId || !userEmail) {
    return res.status(400).send('Détails de la commande incomplets');
  }

  const orderDetails = { produit, quantité, prix, orderId, userEmail };

  try {
    await saveOrderToFirestore(orderDetails);
    res.status(200).send('Commande enregistrée avec succès');
  } catch (error) {
    res.status(500).send('Erreur lors de l\'enregistrement de la commande');
  }
});

// Fonction pour récupérer une commande depuis Firestore
const getOrderFromFirestore = async (orderId) => {
  try {
    const orderDoc = await db.collection('orders').doc(orderId).get();
    if (!orderDoc.exists) {
      throw new Error('Commande non trouvée');
    }
    return orderDoc.data();
  } catch (error) {
    console.error("Erreur lors de la récupération de la commande :", error);
    throw error; // Propager l'erreur
  }
};

// Route pour envoyer un e-mail après la création de la commande
app.post('/send-order-email', async (req, res) => {
  const { orderId, userEmail } = req.body;

  if (!orderId || !userEmail) {
    return res.status(400).send('ID de commande ou email manquant');
  }

  try {
    const orderDetails = await getOrderFromFirestore(orderId);

    const clientTextPart = "Merci pour votre commande ! Votre commande a été bien enregistrée.";
    const clientHtmlPart = ` <h3>Merci pour votre commande !</h3> <p>Votre commande a été bien enregistrée. Vous recevrez bientôt un email avec les détails.</p> `;

    const clientMessage = {
      From: { Email: "elo.robert41@gmail.com", Name: "FleurdePau" },
      To: [{ Email: userEmail, Name: "Client" }],
      Subject: "Confirmation de commande",
      TextPart: clientTextPart,
      HTMLPart: clientHtmlPart
    };

    const managerTextPart = "Une nouvelle commande a été passée. Les détails de la commande sont enregistrés dans l'espace admin.";
    const managerHtmlPart = ` <h3>Nouvelle commande reçue !</h3> <p>Une nouvelle commande a été passée. Les détails de la commande sont enregistrés dans l'espace admin.</p> `;

    const managerMessage = {
      From: { Email: "elo.robert41@gmail.com", Name: "FleurdePau" },
      To: [{ Email: "eloiser41@gmail.com", Name: "Gérant" }],
      Subject: "Nouvelle commande reçue",
      TextPart: managerTextPart,
      HTMLPart: managerHtmlPart
    };

    const clientRequest = mailjetClient.post('send', { version: '3.1' }).request({ Messages: [clientMessage] });
    const managerRequest = mailjetClient.post('send', { version: '3.1' }).request({ Messages: [managerMessage] });

    await Promise.all([clientRequest, managerRequest]);

    console.log("Emails envoyés avec succès");
    res.status(200).send('Emails envoyés avec succès');
  } catch (error) {
    console.error('Erreur lors de l\'envoi des emails :', error);
    res.status(500).json({
      message: 'Erreur lors de l\'envoi des emails',
      errorDetails: error.message || 'Aucune information supplémentaire'
    });
  }
});

// Démarrer le serveur localement
const PORT = process.env.PORT || 3000; // Utilise le port 3000 ou celui défini dans les variables d'environnement
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});

