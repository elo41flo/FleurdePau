// back/api/services/cartService.js
const { db } = require('../../firebaseConfig'); // Importer la configuration Firebase

// Fonction pour récupérer le panier d'un utilisateur depuis Firestore
const getCartForUser = async (userEmail) => {
  const panierRef = db.collection('panier').doc(userEmail);
  const panierDoc = await panierRef.get();
  return panierDoc.exists ? panierDoc.data() : null; // Retourner les données du panier ou null si inexistant
};

module.exports = { getCartForUser };
