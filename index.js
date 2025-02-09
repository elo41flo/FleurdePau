// Exemple pour mettre à jour le compteur
function updateCartCount() {
    // Récupérer le panier depuis le localStorage
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    // Mettre à jour le compteur
    const cartCount = document.querySelector('.cart-count');
    cartCount.textContent = cart.length;
}

// Appeler la fonction au chargement de la page
updateCartCount();
