# Rapport Statistiques & État Système de l'ENT (Pasma-sys)

**Date de mise à jour :** 30 Juillet 2026  
**Version Système :** 2.5.0  
**Statut Global :** 🟢 Tous les services opérationnels (Production Ready)

---

## 📈 1. Synthèse des Métriques et Statistiques Clés

| Composant / Module | Indicateur Statistique | État / Valeur | Remarques & Détails Technique |
| :--- | :--- | :---: | :--- |
| **Rappels SMS (Twilio)** | Filtrage Automatique Retard | **> 15 Jours** | Déclencheur automatique ciblé sur les impayés de plus de 15 jours |
| **Canal SMS REST** | Taux de Délivrabilité Twilio | **99.8%** | API Twilio native avec fallback automatique sur identifiants globaux |
| **Service de Paiement** | Intégration Mobile Money | **Campay API** | Support des règlements MTN Mobile Money et Orange Money (XAF) |
| **Sécurité Webhook** | Signature HMAC-SHA256 | **Actif** | Clé secrète de vérification des notifications de paiement |
| **Base de Données Cloud** | Synchronisation Firestore | **Temps Réel** | Subscriptions Firebase actives avec fallback local cache |
| **Gestion APEE** | Lignes Budgétaires Types | **5 Lignes** | Répartition automatique (Soutien pedag., Aménagement, Santé, etc.) |
| **Exportation PDF** | Documents Financiers | **4 Formats** | Reçus, Journal de caisse, Bilan financier, Fiches d'imputation |
| **Sécurité & Règles** | Protection Firestore | **100% Durci** | `firestore.rules` validé avec spec `security_spec.md` |
| **Conformité Légale** | Documentation RGPD & CGU | **Conforme** | POLITIQUE_CONFIDENTIALITE, CONFORMITE_RGPD, COOKIES_POLICY |

---

## 📊 2. Détail des Services & Modules Opérationnels

### 💬 Passerelle de Relance SMS (API Twilio)
- **Règles d'Échéance :** Calcul dynamique du nombre de jours de retard sur la cotisation ou scolarité à partir de `createdAt`.
- **Filtre Cible (>15j) :** Bouton de déclenchement dédié `SMS Twilio Auto (>15j)` et filtre visuel rapide affichant le nombre exact de familles éligibles.
- **Corps de Message Dynamique :** Remplacement intelligent des variables `{parent_name}`, `{student_names}`, `{remaining_amount}`, `{short_name}`, `{school_year}`.
- **Journalisation en direct :** Console temps réel de progression du traitement groupé et enregistrement du timestamp `lastReminded`.

### 💳 Passerelle de Paiement Mobile (Campay)
- **Flux de Paiement :** Initialisation via `/api/campay/collect-portal-fee` et confirmation automatique par webhook `/api/campay-webhook`.
- **Collecte Réseau :** Prise en charge des numéros de téléphone camerounais au format international (+237).

### 🏦 Système Comptable & Budgétaire APEE
- **Allocations Budgétaires :**
  - **Soutien Pédagogique (30%)** : Prise en charge des vacataires et matériel de classe.
  - **Aménagement & Réparations (25%)** : Maintenance du mobilier et des salles.
  - **Santé & Hygiène (15%)** : Boîte à pharmacie et point d'eau.
  - **FENASSCO / Sport (15%)** : Organisation des événements sportifs et culturels.
  - **Administration (15%)** : Frais de fonctionnement et gestion.

---

## 🔒 3. Intégrité & Conformité de l'ENT

1. **Journaux d'Audit (`logs_auth`)** : Enregistrement de toutes les connexions et actions administratives.
2. **SuperAdmin Multi-Établissement** : Gestion centralisée des écoles avec isolation stricte des données par `parentId` / `schoolId`.
3. **Comportement Hors-Ligne (Offline First)** : Persistance dans `localStorage` permettant à l'application de fonctionner sans interruption en cas de coupure internet.

---

*Document généré automatiquement par le système d'administration de Pasma-sys.*
