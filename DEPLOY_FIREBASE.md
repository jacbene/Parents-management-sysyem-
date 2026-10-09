# Guide de Déploiement en Production Réelle (Firebase Hosting & Cloud Run)

Ce guide détaille les étapes pour mettre en ligne votre application **PASMA** sur Firebase Hosting avec votre projet `pasma-sys`.

---

## 1. Configuration requise avant déploiement

- Les établissements partagés sont accessibles uniquement aux comptes Firebase dont l'e-mail est enregistré dans les paramètres de la direction ou dans la liste des enseignants. La liste administrative est fournie par le backend après vérification de l'adresse authentifiée ; les collaborateurs administratifs accèdent aux données scolaires et financières, tandis que les enseignants accèdent aux données scolaires sans accès aux factures ni aux paramètres financiers.
- Pour enregistrer les collaborateurs, saisissez l'e-mail de connexion de la direction et les e-mails professionnels des enseignants dans les paramètres APEE, puis enregistrez les paramètres. Cette opération synchronise les autorisations vers l'établissement ; les collaborateurs doivent ensuite se connecter avec le même compte e-mail sur chaque terminal. Les factures restent réservées au propriétaire, à la direction et aux collaborateurs administratifs enregistrés.
- Le backend Campay utilise Firebase Admin pour créer des intentions de paiement et ne comptabiliser un paiement qu'après un webhook HMAC rapproché de la référence et du montant attendus. Configurez sur Render `FIREBASE_SERVICE_ACCOUNT_JSON` (JSON du compte de service Firebase avec le rôle IAM minimal `Cloud Datastore User` sur `pasma-sys`), `CAMPAY_TOKEN` et `CAMPAY_WEBHOOK_KEY`. Sans accès Admin Firestore, la collecte est refusée et aucun paiement ne doit être déclaré acquitté.
- Configurez `VITE_API_URL` pour que le frontend appelle l'URL du backend Render.
- Le workflow GitHub exige le secret `FIREBASE_SERVICE_ACCOUNT_PASMA_SYS` ; il échoue explicitement si le secret manque ou si le déploiement des règles échoue.

## 2. Préparation du projet

- **Configuration Firebase Hosting** : `firebase.json` utilise le dossier cible `dist/` et les règles de redirection SPA.
- **Projet par défaut** : `.firebaserc` est associé au projet `pasma-sys`.
- **Règles Firestore** : `firestore.rules` est la source déployée par le workflow.
- **Build de production** : `npm run build` génère le frontend dans `dist/` et le backend dans `dist-server/`.

---

## 3. Déploiement du Frontend sur Firebase Hosting

Votre application sera accessible publiquement aux adresses :
- 🔗 **https://pasma-sys.web.app**
- 🔗 **https://pasma-sys.firebaseapp.com**

### Méthode Directe (en ligne de commande) :
Depuis le dossier de votre projet :
```bash
# 1. Connexion à votre compte Google / Firebase
firebase login

# 2. Compiler l'application pour la production
npm run build

# 3. Déployer l'hébergement web et les règles
firebase deploy --only hosting,firestore:rules
```

---

## 4. Résolution de la connexion Chrome (Domaines Autorisés Firebase Auth)

Si vos utilisateurs ou vous-même rencontrez un blocage lors de la connexion Google ou par identifiant dans Google Chrome :

1. Rendez-vous sur la **[Console Firebase](https://console.firebase.google.com/project/pasma-sys/authentication/settings)**.
2. Allez dans **Authentication** > Onglet **Settings (Paramètres)** > **Authorized domains (Domaines autorisés)**.
3. Vérifiez et ajoutez les domaines suivants en cliquant sur **Ajouter un domaine** :
   - `pasma-sys.web.app` *(normalement présent par défaut)*
   - `pasma-sys.firebaseapp.com` *(normalement présent par défaut)*
   - `ais-pre-xjwa452a7g45f5oz5ftfxe-118121873529.europe-west2.run.app` *(pour les tests en pré-production)*
   - *(Votre propre nom de domaine personnalisé si vous en achetez un, ex: `ecole-pasma.cm`)*.

---

## 5. Déploiement du Backend Express (SMS / Emails / Webhooks / Paiements Campay)

L'application contient un serveur d'API (`server.ts`) gérant :
- **Paiements Campay des Frais de site (Directeurs)** : initialisation sécurisée (`/api/campay/collect-portal-fee`), enregistrement d'intentions (`portal_payment_intents`), réconciliation webhook HMAC et incrément de la redevance sur l'établissement.
- **Paiements Campay des Frais de scolarité (Parents)** : prélèvement USSD direct (`/api/campay/collect-tuition`), suivi en direct (`/api/campay/tuition/:externalRef`), enregistrement d'intentions (`tuition_payment_intents`), réconciliation webhook HMAC et acquittement automatique de la facture (`invoices/{id}`).
- **Envoi des SMS réels** (Twilio, Orange, Campay) avec rate-limiting et validation des destinataires.
- **Envoi des e-mails SMTP** (Bulletins et factures aux parents).
- **Génération assistée par Gemini AI**.

### Variables d'environnement requises sur Render ou Cloud Run :
1. `CAMPAY_TOKEN` : Jeton d'API permanent délivré par Campay.
2. `CAMPAY_WEBHOOK_KEY` : Clé secrète de signature HMAC configurée dans le compte marchand Campay.
3. `FIREBASE_SERVICE_ACCOUNT_JSON` : Clé privée de compte de service Firebase (JSON complet) avec les permissions `Cloud Datastore User` et `Firebase Authentication Admin`.
4. `FIREBASE_PROJECT_ID` : `pasma-sys`.

### URL du Webhook à enregistrer sur la console Campay :
- **URL Webhook** : `https://pasma-sys-backend.onrender.com/api/campay-webhook` (ou votre URL Cloud Run)
- **Événements** : Paiement réussi (`SUCCESSFUL`), Paiement échoué (`FAILED`).

Pour héberger ce serveur d'API en production avec Firebase / Google Cloud Run :
```bash
# Déploiement en un clic sur Google Cloud Run (dans le même projet pasma-sys)
gcloud run deploy pasma-backend \
  --project pasma-sys \
  --region europe-west1 \
  --source . \
  --allow-unauthenticated \
  --port 3000
```
Dans `firebase.json`, Firebase Hosting peut automatiquement rediriger `/api/**` vers ce service Cloud Run.
