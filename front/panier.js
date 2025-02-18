let panier = JSON.parse(localStorage.getItem('panier')) || [];

function ajouterPanier(nom, prix) {
    console.log("🛒 Fonction ajouterPanier appelée avec :", nom, prix);
    
    // Ajouter le produit au panier local
    panier.push({ nom, prix });
    localStorage.setItem('panier', JSON.stringify(panier));
    
    // Optionnel : synchronisation avec Firebase (si tu veux garder une copie en ligne)
    enregistrerPanierFirebase(nom, prix);

    mettreAJourCompteurPanier();
}

async function enregistrerPanierFirebase(nom, prix) {
    try {
        const userEmail = "example@example.com"; // Utiliser l'email connecté si possible
        const panierRef = db.collection('carts').doc(userEmail);  // Utilise un identifiant unique comme l'email
        const panierDoc = await panierRef.get();

        // Si le panier existe déjà, on l'ajoute
        let panierData = panierDoc.exists ? panierDoc.data().cart : [];
        panierData.push({ nom, prix });
        
        // Sauvegarder le panier mis à jour dans Firestore
        await panierRef.set({ cart: panierData });
        console.log("Panier enregistré dans Firestore.");
    } catch (error) {
        console.error("Erreur lors de l'enregistrement du panier dans Firestore:", error);
    }
}

function mettreAJourCompteurPanier() {
    console.log("🔄 Mise à jour du compteur panier. Taille actuelle :", panier.length);
    document.querySelector(".cart-count").textContent = panier.length;
}

// Expose la fonction à `window` pour qu'elle soit accessible dans firebase.js
window.ajouterPanier = ajouterPanier;

console.log("ajouterPanier dans window:", window.ajouterPanier);  // Ajoute ce log pour déboguer

// Mise à jour du compteur panier au chargement de la page
window.addEventListener("DOMContentLoaded", () => {
    console.log("📌 Page chargée, mise à jour du panier...");
    mettreAJourCompteurPanier();
});
