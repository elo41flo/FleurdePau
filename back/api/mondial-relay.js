import fetch from 'node-fetch';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Méthode non autorisée' });
    }

    const { ville, codePostal } = req.body;
    if (!ville || !codePostal) {
        return res.status(400).json({ error: 'Ville et code postal requis' });
    }

    try {
        const response = await fetch('https://api.mondialrelay.com/webservice/point-relais', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.MONDRIAL_RELAY_API_KEY}`
            },
            body: JSON.stringify({
                postal_code: codePostal,
                city: ville
            })
        });

        if (!response.ok) {
            throw new Error(`Erreur API Mondial Relay: ${response.status}`);
        }

        const data = await response.json();
        res.status(200).json({ success: true, points: data.points });
    } catch (error) {
        console.error('Erreur Mondial Relay:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
}
