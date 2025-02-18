import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // Importer Firestore

// Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyA-NyzpyeUgA8ElI9-isZJNMBiCP76BYhs",
  authDomain: "fleurdepau-1ce7d.firebaseapp.com",
  projectId: "fleurdepau-1ce7d",
  storageBucket: "fleurdepau-1ce7d.firebasestorage.app",
  messagingSenderId: "394738141831",
  appId: "1:394738141831:web:a0cd5b9d0227267b248622",
  measurementId: "G-D1J6X7BH9S"
};

// Initialisation Firebase
const app = initializeApp(firebaseConfig);

// Initialisation Firestore
const db = getFirestore(app);

// Exporter la base de données
export { db };
