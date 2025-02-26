const { LocalStorage } = require('node-localstorage');
const localStorage = new LocalStorage('./scratch'); // Dossier pour stocker les données

// Fonction pour mettre à jour le compteur
const updateCartCount = () => {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    console.log(`Le panier contient ${cart.length} articles.`);
};

// Ajouter un exemple d'article dans le panier
localStorage.setItem('cart', JSON.stringify([{ id: 1, name: 'Article 1' }]));

// Mettre à jour le compteur du panier
updateCartCount();
