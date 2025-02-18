// back/api/cartRoutes.js
const express = require('express');
const router = express.Router();
const { getCartForUser } = require('./services/cartService'); // Importer le service du panier

// Route pour récupérer le panier de l'utilisateur
router.get('/get-cart', async (req, res) => {
  const { userEmail } = req.query; // Récupère l'email de l'utilisateur depuis la requête
  if (!userEmail) {
    return res.status(400).send("Email de l'utilisateur manquant");
  }

  try {
    const panier = await getCartForUser(userEmail); // Appel au service pour récupérer le panier
    if (panier) {
      res.status(200).json(panier); // Si panier trouvé, renvoyer les données
    } else {
      res.status(404).send("Panier introuvable"); // Si panier inexistant
    }
  } catch (error) {
    console.error('Erreur serveur:', error);
    res.status(500).send("Erreur interne du serveur"); // Erreur serveur
  }
});

module.exports = router;
