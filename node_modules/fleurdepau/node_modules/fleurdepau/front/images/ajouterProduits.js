import { db } from './firebase-config.js';
import { collection, addDoc } from 'https://www.gstatic.com/firebasejs/9.20.0/firebase-firestore.js';

async function ajouterProduit() {
    try {
        const docRef = await addDoc(collection(db, 'produits'), {
            nom: "Rose en crochet",
            categorie: "Rose",
            description: "Une belle rose faite à la main avec du fil de coton",
            prix: 15.99,
            imageUrl: "URL_de_l'image"  // Remplacer par l'URL de l'image si tu l'as uploadée dans Firebase Storage
        });
        console.log("Produit ajouté avec ID: ", docRef.id);
    } catch (e) {
        console.error("Erreur lors de l'ajout du produit: ", e);
    }
}

// Appel de la fonction pour ajouter le produit
ajouterProduit();
