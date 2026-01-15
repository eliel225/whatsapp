require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

const app = express();
// Render fournit le port via process.env.PORT
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// ============================================
// CONFIGURATION CONNEXION (SÉCURISÉE POUR LE CLOUD)
// ============================================
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    // SSL est obligatoire pour la plupart des bases de données cloud comme Aiven
    ssl: { rejectUnauthorized: false } 
};

let db;

async function initDatabase() {
    try {
        db = await mysql.createConnection(dbConfig);
        console.log(`✅ Connecté à MySQL : ${process.env.DB_NAME}`);
    } catch (error) {
        console.error('❌ Erreur de connexion DB :', error.message);
        process.exit(1);
    }
}

// Fonction pour enregistrer les logs
async function logAction(phone, action, data = {}, ip = '127.0.0.1') {
    try {
        await db.execute(
            'INSERT INTO signup_logs (phone, action, data, ip_address) VALUES (?, ?, ?, ?)',
            [phone, action, JSON.stringify(data), ip]
        );
    } catch (err) { console.error('Erreur log:', err.message); }
}

// ============================================
// ROUTES API
// ============================================

// 1. Reception du numéro
app.post('/save-phone', async (req, res) => {
    try {
        const { phone, countryCode, phoneNumber } = req.body;
        console.log(`\n--- 📱 NUMÉRO REÇU : ${phone} ---`);

        const [existing] = await db.execute('SELECT * FROM users WHERE full_phone = ?', [phone]);
        
        if (existing.length === 0) {
            await db.execute(
                'INSERT INTO users (country_code, phone_number, full_phone) VALUES (?, ?, ?)',
                [countryCode, phoneNumber, phone]
            );
            console.log("✅ Nouveau numéro enregistré.");
            await logAction(phone, 'PHONE_REGISTERED', { step: 1 });
        } else {
            console.log("ℹ️ Numéro déjà existant.");
        }

        res.json({ success: true });
    } catch (error) {
        console.error('❌ Erreur /save-phone:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. Génération du code
app.post('/generate-code', async (req, res) => {
    try {
        const { phone } = req.body;
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await db.execute(
            'INSERT INTO verification_codes (phone, code, expires_at) VALUES (?, ?, ?)',
            [phone, code, expiresAt]
        );

        console.log(`🔐 CODE GÉNÉRÉ [${phone}] -> ${code}`);
        await logAction(phone, 'CODE_SENT', { code_val: code });

        res.json({ success: true, devCode: code });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// 3. Vérification du code
app.post('/verify-code', async (req, res) => {
    try {
        const { phone, code } = req.body;
        console.log(`\n--- 🔑 TENTATIVE : ${phone} a saisi ${code} ---`);

        const [rows] = await db.execute(
            'SELECT * FROM verification_codes WHERE phone = ? AND code = ? AND used = FALSE AND expires_at > NOW()',
            [phone, code]
        );

        if (rows.length > 0) {
            await db.execute('UPDATE verification_codes SET used = TRUE WHERE id = ?', [rows[0].id]);
            await db.execute('UPDATE users SET verified = TRUE WHERE full_phone = ?', [phone]);
            console.log(`✅ CORRECT`);
            await logAction(phone, 'PHONE_VERIFIED', { code_entered: code });
            return res.json({ success: true });
        } else {
            console.log(`❌ INCORRECT`);
            await logAction(phone, 'INVALID_CODE_ATTEMPT', { code_entered: code });
            return res.json({ success: false, message: 'Code incorrect' });
        }
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// 4. Inscription complète
app.post('/complete-registration', async (req, res) => {
    try {
        const { phone, fullName, password } = req.body;
        const hash = await bcrypt.hash(password, 10);

        await db.execute(
            'UPDATE users SET full_name = ?, password_hash = ? WHERE full_phone = ?',
            [fullName, hash, phone]
        );

        console.log(`🎉 SUCCÈS : ${fullName} (${phone})`);
        await logAction(phone, 'REGISTRATION_COMPLETE', { name: fullName });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// Lancement
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Serveur en ligne sur le port ${PORT}`);
    });
});
