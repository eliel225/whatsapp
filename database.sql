-- Créer la base de données
CREATE DATABASE IF NOT EXISTS signup_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE signup_db;

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    country_code VARCHAR(10) NOT NULL COMMENT 'Code pays (+225, +33, etc.)',
    phone_number VARCHAR(20) NOT NULL COMMENT 'Numéro sans le code pays',
    full_phone VARCHAR(30) UNIQUE NOT NULL COMMENT 'Numéro complet avec code pays',
    full_name VARCHAR(100) DEFAULT NULL COMMENT 'Nom complet de l\'utilisateur',
    password_hash VARCHAR(255) DEFAULT NULL COMMENT 'Mot de passe hashé avec bcrypt',
    verified BOOLEAN DEFAULT FALSE COMMENT 'Indique si le numéro est vérifié',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Date de création',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Date de mise à jour',
    INDEX idx_phone (full_phone),
    INDEX idx_verified (verified)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des codes de vérification
CREATE TABLE IF NOT EXISTS verification_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone VARCHAR(30) NOT NULL COMMENT 'Numéro de téléphone',
    code VARCHAR(6) NOT NULL COMMENT 'Code de vérification à 6 chiffres',
    expires_at TIMESTAMP NOT NULL COMMENT 'Date d\'expiration du code',
    used BOOLEAN DEFAULT FALSE COMMENT 'Indique si le code a été utilisé',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Date de génération',
    INDEX idx_phone_code (phone, code),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des logs d'activité
CREATE TABLE IF NOT EXISTS signup_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone VARCHAR(30) NOT NULL COMMENT 'Numéro de téléphone',
    action VARCHAR(50) NOT NULL COMMENT 'Action effectuée',
    data JSON DEFAULT NULL COMMENT 'Données supplémentaires en JSON',
    ip_address VARCHAR(45) DEFAULT NULL COMMENT 'Adresse IP de l\'utilisateur',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Date de l\'action',
    INDEX idx_phone (phone),
    INDEX idx_action (action),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Créer un utilisateur pour l'application (optionnel mais recommandé)
-- CREATE USER 'signup_user'@'localhost' IDENTIFIED BY 'votre_mot_de_passe_fort';
-- GRANT ALL PRIVILEGES ON signup_db.* TO 'signup_user'@'localhost';
-- FLUSH PRIVILEGES;

-- Exemples de requêtes utiles:

-- Voir tous les utilisateurs
-- SELECT * FROM users ORDER BY created_at DESC;

-- Voir les utilisateurs vérifiés
-- SELECT * FROM users WHERE verified = TRUE;

-- Voir tous les codes générés
-- SELECT * FROM verification_codes ORDER BY created_at DESC;

-- Voir les logs d'un numéro spécifique
-- SELECT * FROM signup_logs WHERE phone = '+22512345678' ORDER BY created_at DESC;

-- Voir les inscriptions complètes du jour
-- SELECT * FROM users WHERE DATE(created_at) = CURDATE() AND verified = TRUE;

-- Nettoyer les codes expirés (à exécuter périodiquement)
-- DELETE FROM verification_codes WHERE expires_at < NOW() AND used = FALSE;