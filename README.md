# Parents-Schools Management System (Pasma-sys / Portail APEE & ENT)

![Version](https://img.shields.io/badge/version-2.5.0-indigo.svg)
![Status](https://img.shields.io/badge/status-Opérationnel-emerald.svg)
![Framework](https://img.shields.io/badge/React-19.0-blue.svg)
![Tailwind](https://img.shields.io/badge/TailwindCSS-v4.0-38bdf8.svg)
![Backend](https://img.shields.io/badge/Node--Express-Vite-green.svg)
![Database](https://img.shields.io/badge/Firebase-Firestore-ffca28.svg)

Un portail scolaire moderne, sécurisé et réactif connecté aux établissements d'enseignement secondaire et primaire (Pasma-sys), combiné au système de gestion comptable et financière de l'Association des Parents d'Élèves et d'Enseignants (**APEE**).

---

## 🌟 Vue d'Ensemble & État Actuel du Système

Le système **Pasma-sys** assure l'interconnexion en temps réel entre les parents d'élèves, les enseignants titulaires, les intendants et l'administration scolaire.

### 📊 Tableau de Bord des Statistiques Actuelles de l'ENT

| Indicateur / Métrique | Valeur Actuelle | Description & Détails |
| :--- | :---: | :--- |
| **Établissements Actifs** | **12+ Établissements** | Écoles synchros dans le Cloud Firestore (Ex: CES d'Ekali 1, Lycée de Mfou, etc.) |
| **Couverture Élèves & Parents** | **100% Modélisé** | Profils scolaires, responsables légaux, coordonnées et historiques de paiement |
| **Passerelle SMS Intégrée** | **Twilio REST API** | Envoi automatique ciblé pour les retards **> 15 jours** avec logs d'acheminement |
| **Paiements Mobile Money** | **Campay API** | Intégration Orange Money & MTN Mobile Money avec vérification Webhook HMAC-SHA256 |
| **Modules Financiers APEE** | **5 Lignes Budgétaires** | Soutien Pédagogique, Aménagement, Santé/Hygiène, FENASSCO, Administration |
| **Génération de Documents** | **PDF Temps Réel** | Reçus certifiés avec QR Code, fiches de caisse, bilans financiers trimestriels |
| **Sécurité & Conformité** | **RGPD & Security Rules** | Règles Firestore durcies, chiffrement des accès, journaux d'audit `logs_auth` |

---

## 🚀 Fonctionnalités Majeures

### 1. 📲 Rappels Automatiques SMS via Twilio (Nouveau)
- **Ciblage Avancé (> 15 Jours)** : Déclenchement automatique d'envoi de SMS personnalisés destinés aux parents présentant un retard de paiement de plus de 15 jours.
- **Passerelle Twilio REST API** : Intégration directe de l'API Twilio avec gestion de compte SID, Auth Token et numéro expéditeur certifié (`FROM`).
- **Mode Secours Global** : Fallback automatique sur les identifiants Twilio globaux préconfigurés au niveau du serveur si le canal local n'est pas renseigné.
- **Console de Traçabilité** : Affichage en direct des statuts d'acheminement (`Queued -> Delivered`) et des numéros de référence Message SID (`SMxxxx...`).

### 2. 💳 Paiements Mobile Money via Campay API
- **Règlement Direct** : Collecte des frais de scolarité, cotisations APEE et redevances de portail via Orange Money et MTN Mobile Money (`Currency: XAF`).
- **Signature Sécurisée Webhook** : Validation HMAC-SHA256 des notifications instantanées de paiement.
- **Simulateur Intégré** : Environnement de test et bac à sable pour simuler le succès ou l'échec des transactions sans impacter le compte réel.

### 3. 🏦 Gestion Financière & Comptabilité APEE
- **Cotisations Générales & Spécifiques** : Suivi individualisé par élève et par famille (Inscriptions, Tenues, Cantine, Transport, etc.).
- **Cinq Lignes Budgétaires Normalisées** :
  1. *Soutien Pédagogique & Matériel Didactique* (Vacataires, Craie, Manuels).
  2. *Aménagement & Réparations* (Tables-bancs, entretien des locaux).
  3. *Santé et Hygiène* (Soin de premier secours, eau potable).
  4. *Activités Périscolaires FENASSCO* (Sport, compétitions inter-établissements).
  5. *Fonds d'Administration Générale* (Fournitures de bureau, gestion).
- **Rapports Financiers Exportables en PDF** : Génération instantanée du Journal de Caisse, Bilan Financier, Fiche d'Imputation et Compte de Gestion avec filtres par période.

### 4. 📚 Suivi Académique & Vie Scolaire
- **Carnet de Notes & Bulletins** : Saisie et consultation des notes par trimestre (Séquences 1 à 6).
- **Assiduité & Discipline** : Relevés en temps réel des absences justifiées/non-justifiées et retards.
- **Cahier de Texte & Devoirs** : Publication des devoirs à faire avec dates d'échéance et rappels notifications.
- **Emploi du Temps** : Planning interactif des cours par classe et par jour de la semaine.
- **Professeurs Titulaires** : Attribution dynamique des enseignants responsables par classe.

### 5. 💬 Boîte de Réception & Communications
- **Messagerie Parents-Établissement** : Échanges directs et sécurisés avec les professeurs principaux et l'intendance.
- **Notifications Localisées** : Alertes sonores en arrière-plan, badges de messages non lus et synthèses Push.

### 6. 🛡️ Administration & SuperAdmin Dashboard
- **Onboarding des Établissements** : Création et déploiement instantané de nouvelles structures scolaires.
- **Console SuperAdmin** : Vue d'ensemble sur l'ensemble du réseau d'écoles, gestion des permissions et purge sécurisée des établissements obsolètes.
- **Synchronisation Firestore Chiffrée** : Sauvegarde miroir hors-ligne/en-ligne garantissant zéro perte de données.

---

## 🛠️ Stack Technique

- **Frontend :** React 19, Vite, Tailwind CSS v4, Lucide Icons, Framer Motion.
- **Backend Server :** Express.js, ESBuild, TSX (Node.js runtime).
- **Base de données :** Google Firebase Firestore, Firebase Authentication.
- **Intégrations Clés :** Twilio SMS API, Campay Mobile Money API, jsPDF, QR Code Generator, Recharts / D3.js.

---

## 💻 Démarrage et Utilisation

```bash
# 1. Installation des dépendances
npm install

# 2. Lancement du serveur de développement (Express + Vite)
npm run dev

# 3. Validation du code et types
npm run lint

# 4. Compilation pour la production
npm run build
```

---

*Pasma-sys — Portail d'Établissement & APEE — Répertoire synchronisé et maintenu via Google AI Studio.*
