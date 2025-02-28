require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mailjet = require("node-mailjet");
const admin = require("firebase-admin");
const path = require("path");
const axios = require("axios");
const xml2js = require("xml2js");
const crypto = require('crypto');

// Initialisation de Firestore via Firebase Admin SDK (ajout d'une condition pour l'initialisation)
const app = express();

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../../front')));

// Vérification des variables d'environnement
const requiredEnvVars = [
    "FIREBASE_PRIVATE_KEY",
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "MAILJET_API_KEY",
    "MAILJET_API_SECRET",
    "MONDIAL_RELAY_ENS_CODE",
    "MONDIAL_RELAY_PRIVATE_KEY"
];

requiredEnvVars.forEach((envVar) => {
    if (!process.env[envVar]) {
        console.error(`\u274c Error: Missing environment variable: ${envVar}`);
        process.exit(1);
    }
});

// Initialisation Firebase Admin SDK uniquement si non déjà initialisé
if (admin.apps.length === 0) {
    const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    };

    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
        });
        console.log("Firebase Admin SDK initialisé avec succès.");
    } catch (error) {
        console.error("Erreur lors de l'initialisation de Firebase Admin SDK :", error);
        process.exit(1);
    }
} else {
    console.log("Firebase déjà initialisé.");
}

// Active la persistance pour Firestore
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });  // Ajout pour éviter certains problèmes

// Collection Firestore
const pointsRelaisCollection = db.collection('nom_de_la_collection');


// Fonction pour générer la clé de sécurité
const generateSecurityKey = (enseigne, pays, ville, cp, poids, action, delai, privateKey) => {
    const securityString = `${enseigne}${pays}${ville}${cp}${poids}${action}${delai}${privateKey}`;
    return crypto.createHash("md5").update(securityString).digest("hex").toUpperCase();
};

// Route pour récupérer les points relais Mondial Relay
app.post("/api/mondial-relay/points-relais", async (req, res) => {
    console.log("Requête reçue pour /api/mondial-relay/points-relais");
    const { ville, codePostal } = req.body;

    if (!ville || !codePostal) {
        return res.status(400).json({ success: false, message: "Ville et code postal requis" });
    }

    const securityKey = generateSecurityKey(
        process.env.MONDIAL_RELAY_ENS_CODE,
        "FR",
        ville,
        codePostal,
        5000,
        "REL",
        "24R",
        process.env.MONDIAL_RELAY_PRIVATE_KEY
    );

    const pointsRef = db.doc(`${ville}_${codePostal}`);
    const doc = await pointsRef.get();

    if (doc.exists) {
        console.log("✅ Points relais trouvés dans Firestore");
        return res.json({
            success: true,
            message: "Points relais récupérés depuis Firestore",
            data: doc.data().points_relais
        });
    }

    const xmlRequest = `<?xml version="1.0" encoding="utf-8"?>
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                      xmlns:web="http://www.mondialrelay.fr/webservice/">
        <soapenv:Header/>
        <soapenv:Body>
            <web:WSI3_PointRelais_Recherche>
                <web:Enseigne>${process.env.MONDIAL_RELAY_ENS_CODE}</web:Enseigne>
                <web:Pays>FR</web:Pays>
                <web:Ville>${ville}</web:Ville>
                <web:CP>${codePostal}</web:CP>
                <web:NbResult>10</web:NbResult>
                <web:Poids>5000</web:Poids>
                <web:Action>REL</web:Action>
                <web:Delai>24R</web:Delai>
                <web:Security>${securityKey}</web:Security>
            </web:WSI3_PointRelais_Recherche>
        </soapenv:Body>
    </soapenv:Envelope>`;

    try {
        const response = await axios.post("https://api.mondialrelay.com/WebService.asmx", xmlRequest, {
            headers: { 'Content-Type': 'text/xml; charset=utf-8' }
        });

        console.log("Réponse Mondial Relay :", response.data);  // Log de la réponse brute

        xml2js.parseString(response.data, { explicitArray: false }, async (err, result) => {
            if (err) {
                console.error("Erreur XML:", err);
                return res.status(500).json({ success: false, message: "Erreur XML", error: err });
            }

            try {
                const pointsRelais = result?.['soap:Envelope']?.['soap:Body']?.['WSI3_PointRelais_RechercheResponse']?.['WSI3_PointRelais_RechercheResult']?.['LST_PointRelais'];
                if (pointsRelais) {
                    await pointsRef.set({ points_relais: pointsRelais, lastUpdated: admin.firestore.FieldValue.serverTimestamp() });
                    return res.json({ success: true, message: "Points relais trouvés", data: pointsRelais });
                } else {
                    return res.status(404).json({ success: false, message: "Aucun point relais trouvé" });
                }
            } catch (e) {
                console.error("Erreur traitement Mondial Relay:", e);
                return res.status(500).json({ success: false, message: "Erreur interne", error: e });
            }
        });

    } catch (error) {
        console.error("Erreur API Mondial Relay:", error.response ? error.response.data : error.message);
        return res.status(500).json({ success: false, message: "Erreur serveur Mondial Relay", error: error.message });
    }
});

// Lancement du serveur
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`));

module.exports = app;
