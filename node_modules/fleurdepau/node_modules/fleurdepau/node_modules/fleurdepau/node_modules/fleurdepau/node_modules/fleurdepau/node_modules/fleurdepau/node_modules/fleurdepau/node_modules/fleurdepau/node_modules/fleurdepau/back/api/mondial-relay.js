// 📌 API Proxy pour Mondial Relay sur Vercel
import axios from "axios";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, message: "Méthode non autorisée" });
    }

    const { ville, codePostal } = req.body;

    if (!ville || !codePostal) {
        return res.status(400).json({ success: false, message: "Ville et code postal requis" });
    }

    try {
        const response = await axios.post(process.env.MONDIAL_RELAY_API_URL, {
            Enseigne: process.env.MONDIAL_RELAY_ENS_CODE,
            Clé: process.env.MONDIAL_RELAY_PRIVATE_KEY,
            Ville: ville,
            CP: codePostal,
        });

        res.status(200).json(response.data);
    } catch (error) {
        console.error("❌ Erreur API Mondial Relay :", error);
        res.status(500).json({ success: false, message: "Erreur serveur Mondial Relay" });
    }
}
