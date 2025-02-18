// Récupérer le panier du localStorage ou initialiser un tableau vide
let panier = JSON.parse(localStorage.getItem('panier')) || [];

// Fonction pour ajouter un produit au panier
function ajouterPanier(nom, prix) {
    console.log("🛒 Produit ajouté au panier :", nom, prix);
    
    // Ajouter le produit au panier local
    panier.push({ nom, prix });
    localStorage.setItem('panier', JSON.stringify(panier));  // Mettre à jour le localStorage

    // Optionnel : synchronisation avec Firebase (si tu veux garder une copie en ligne)
    enregistrerPanierFirebase(nom, prix);

    // Mettre à jour le compteur
    mettreAJourCompteurPanier();
}

// Fonction pour enregistrer le panier dans Firestore (si nécessaire)
async function enregistrerPanierFirebase(nom, prix) {
    try {
        const userEmail = "example@example.com"; // Utiliser l'email connecté si possible
        const panierRef = db.collection('carts').doc(userEmail);  // Utiliser un identifiant unique comme l'email
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

// Fonction pour mettre à jour le compteur du panier
function mettreAJourCompteurPanier() {
    const compteur = document.querySelector(".cart-count");
    console.log("Nombre d'articles dans le panier:", panier.length); // Affiche le nombre d'articles
    compteur.textContent = panier.length; // Met à jour le compteur
}

// Mettre à jour le compteur lors du chargement de la page
window.addEventListener("DOMContentLoaded", mettreAJourCompteurPanier);
