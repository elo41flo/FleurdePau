import { initializeApp } from "https://www.gstatic.com/firebasejs/9.20.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.20.0/firebase-firestore.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/9.20.0/firebase-auth.js";

// Configuration Firebase
const firebaseConfig = {
    apiKey: "AIzaSyA-NyzpyeUgA8ElI9-isZJNMBiCP76BYhs",
    authDomain: "fleurdepau-1ce7d.firebaseapp.com",
    projectId: "fleurdepau-1ce7d",
    storageBucket: "fleurdepau-1ce7d.appspot.com",
    messagingSenderId: "394738141831",
    appId: "1:394738141831:web:a0cd5b9d0227267b248622",
    measurementId: "G-D1J6X7BH9S"
};

// Initialisation Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function chargerProduits() {
    console.log("📦 Chargement des produits...");
    const produitsContainer = document.getElementById("produits");
    produitsContainer.innerHTML = "";
    const produitsSnapshot = await getDocs(collection(db, "produits"));

    produitsSnapshot.forEach((doc) => {
        const produit = doc.data();
        console.log("🛍 Produit récupéré :", produit);

        const produitCard = document.createElement("div");
        produitCard.classList.add("produit-card");
        produitCard.innerHTML = `
            <img src="${produit.imageUrl}" alt="${produit.nom}">
            <h3>${produit.nom}</h3>
            <p>${produit.description}</p>
            <span class="price">${produit.prix}€</span>
            <button class="ajouter-panier" data-nom="${produit.nom}" data-prix="${produit.prix}">Ajouter au panier</button>
        `;
        produitsContainer.appendChild(produitCard);
    });

    // Ajout des événements sur les boutons après l'affichage des produits
    setTimeout(() => {
        console.log("🛠 Ajout des événements sur les boutons...");
        document.querySelectorAll(".ajouter-panier").forEach(bouton => {
            console.log("➡️ Bouton détecté :", bouton);
            bouton.addEventListener("click", (event) => {
                const nom = event.target.getAttribute("data-nom");
                const prix = parseFloat(event.target.getAttribute("data-prix"));
                console.log("🎯 Clic sur Ajouter au panier :", nom, prix);
                window.ajouterPanier(nom, prix); // Appel de la fonction depuis panier.js
            });
        });
    }, 100);
}

// Chargement des produits après le chargement du DOM
window.addEventListener("DOMContentLoaded", chargerProduits);
