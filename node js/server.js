// Importation des dépendances
const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const mailjet = require('node-mailjet');
require('dotenv').config(); // Pour charger les variables d'environnement

// Initialisation de Firebase Admin SDK
const serviceAccount = require('./config/serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://fleurdepau-1ce7d.firebaseio.com" // Remplace par ton URL Firebase
});
const db = admin.firestore(); // Accès à Firestore

// Initialisation de Mailjet avec les clés API
const mailjetClient = mailjet.apiConnect(
  process.env.MAILJET_API_KEY_PUBLIC,
  process.env.MAILJET_API_KEY_PRIVATE
);

// Initialisation de l'application Express
const app = express();
const port = 3000;

// Middleware pour parser les données JSON
app.use(bodyParser.json());

// Route de test pour vérifier le serveur
app.get('/', (req, res) => {
  res.send('Serveur FleurdePau en cours d\'exécution !');
});

// Fonction pour enregistrer une commande dans Firestore
const saveOrderToFirestore = async (orderDetails) => {
  try {
    // Ajoute la commande dans Firestore dans la collection 'orders'
    await db.collection('orders').add(orderDetails);
    console.log('Commande enregistrée avec succès');
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement de la commande :', error);
  }
};

// Route pour recevoir une commande
app.post('/create-order', async (req, res) => {
  const { produit, quantité, prix, orderId, userEmail } = req.body;

  // Vérification des données
  if (!produit || !quantité || !prix || !orderId || !userEmail) {
    return res.status(400).send('Détails de la commande incomplets');
  }

  // Détails de la commande
  const orderDetails = {
    produit,
    quantité,
    prix,
    orderId,
    userEmail
  };

  // Enregistrement dans Firestore
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
    throw error;
  }
};

// Route pour envoyer un e-mail après la création de la commande
app.post('/send-order-email', async (req, res) => {
  const { orderId, userEmail } = req.body;

  // Vérification des données fournies
  if (!orderId || !userEmail) {
    return res.status(400).send('ID de commande ou email manquant');
  }

  try {
    // Récupérer les détails de la commande depuis Firestore
    const orderDetails = await getOrderFromFirestore(orderId);

    // Préparer le texte de l'email pour le client (sans les détails)
    const clientTextPart = "Merci pour votre commande ! Votre commande a été bien enregistrée.";
    const clientHtmlPart = `
      <h3>Merci pour votre commande !</h3>
      <p>Votre commande a été bien enregistrée. Vous recevrez bientôt un email avec les détails.</p>
    `;

    // Création du message pour le client
    const clientMessage = {
      From: {
        Email: "elo.robert41@gmail.com", // Ton email
        Name: "FleurdePau"
      },
      To: [
        {
          Email: userEmail, // Email du client
          Name: "Client"
        }
      ],
      Subject: "Confirmation de commande",
      TextPart: clientTextPart,
      HTMLPart: clientHtmlPart
    };

    // Création du message pour le gérant (ton amie)
    const managerTextPart = "Une nouvelle commande a été passée. Les détails de la commande sont enregistrés dans l'espace admin.";
    const managerHtmlPart = `
      <h3>Nouvelle commande reçue !</h3>
      <p>Une nouvelle commande a été passée. Les détails de la commande sont enregistrés dans l'espace admin.</p>
    `;

    const managerMessage = {
      From: {
        Email: "elo.robert41@gmail.com", // Ton email
        Name: "FleurdePau"
      },
      To: [
        {
          Email: "eloiser41@gmail.com", // Email de ton amie
          Name: "Gérant"
        }
      ],
      Subject: "Nouvelle commande reçue",
      TextPart: managerTextPart,
      HTMLPart: managerHtmlPart
    };

    // Envoi des emails
    const clientRequest = mailjetClient
      .post('send', { version: '3.1' })
      .request({ Messages: [clientMessage] });

    const managerRequest = mailjetClient
      .post('send', { version: '3.1' })
      .request({ Messages: [managerMessage] });

    // Attendre que les deux emails soient envoyés
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

// Lancer le serveur
app.listen(port, () => {
  console.log(`Serveur démarré sur http://localhost:${port}`);
});
