# Guide de Déploiement en Production Réelle (Firebase Hosting & Cloud Run)

Ce guide détaille les étapes pour mettre en ligne votre application **PASMA** sur Firebase Hosting avec votre projet `pasma-sys`.

---

## 1. Préparation effectuée automatiquement

- **Configuration Firebase Hosting** : `firebase.json` a été configuré avec le dossier cible `dist/` et les règles de redirection SPA (`rewrites: [ { "source": "**", "destination": "/index.html" } ]`).
- **Projet par défaut** : `.firebaserc` est associé au projet `pasma-sys`.
- **Règles Firestore** : Déployées et synchronisées sur votre base de données avec `firestore.rules`.
- **Build de production** : Le bundle optimisé a été généré dans le dossier `/dist`.

---

## 2. Déploiement du Frontend sur Firebase Hosting

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

## 3. Résolution de la connexion Chrome (Domaines Autorisés Firebase Auth)

Si vos utilisateurs ou vous-même rencontrez un blocage lors de la connexion Google ou par identifiant dans Google Chrome :

1. Rendez-vous sur la **[Console Firebase](https://console.firebase.google.com/project/pasma-sys/authentication/settings)**.
2. Allez dans **Authentication** > Onglet **Settings (Paramètres)** > **Authorized domains (Domaines autorisés)**.
3. Vérifiez et ajoutez les domaines suivants en cliquant sur **Ajouter un domaine** :
   - `pasma-sys.web.app` *(normalement présent par défaut)*
   - `pasma-sys.firebaseapp.com` *(normalement présent par défaut)*
   - `ais-pre-xjwa452a7g45f5oz5ftfxe-118121873529.europe-west2.run.app` *(pour les tests en pré-production)*
   - *(Votre propre nom de domaine personnalisé si vous en achetez un, ex: `ecole-pasma.cm`)*.

---

## 4. Déploiement du Backend Express (Optionnel pour SMS / Emails / Webhooks)

L'application contient un serveur d'API (`server.ts`) gérant :
- L'envoi des SMS réels (Twilio, Orange, Campay)
- L'envoi des e-mails SMTP (Bulletins et factures aux parents)
- Les webhooks Campay Mobile Money
- La génération de devoirs assistée par Gemini

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
