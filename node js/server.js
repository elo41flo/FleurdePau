// Importation des dépendances
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bodyParser = require('body-parser');

// Initialisation de l'application Express
const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json()); // Pour parser les requêtes JSON

// Configuration de Nodemailer pour envoyer des emails
const transporter = nodemailer.createTransport({
  service: 'gmail', // Exemple avec Gmail
  auth: {
    user: 'votre-email@gmail.com', // Remplacez par votre email
    pass: 'votre-mot-de-passe' // Remplacez par votre mot de passe
  }
});

// Route pour envoyer un email après une commande
app.post('/send-order-email', (req, res) => {
  const { userEmail, orderDetails } = req.body;

  // Paramètres de l'email
  const mailOptions = {
    from: 'votre-email@gmail.com', // Remplacez par votre email
    to: userEmail,
    subject: 'Confirmation de commande',
    text: `Merci pour votre commande ! Voici les détails : ${JSON.stringify(orderDetails)}`
  };

  // Envoi de l'email à l'utilisateur
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return res.status(500).send('Erreur lors de l\'envoi de l\'email');
    }
    res.status(200).send('Email envoyé avec succès');
  });
});

// Démarrer le serveur
app.listen(port, () => {
  console.log(`Serveur démarré sur http://localhost:${port}`);
});
