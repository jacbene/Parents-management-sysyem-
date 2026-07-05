# Conformité RGPD et Protection de la Vie Privée - Parents-Schools Management System (Pasma-sys) ENT

**Date de conformité : 23 mai 2026**

Le présent document décrit l'alignement du **Parents-Schools Management System (Pasma-sys) ENT** avec le Règlement Général sur la Protection des Données (RGPD) et les législations nationales ou internationales afférentes aux données personnelles dans le milieu d'apprentissage.

---

## 1. Principes Fondamentaux Respectés

### A. Minimisation des Données
Le portail ne collecte que les données strictement indispensables aux objectifs pédagogiques et financiers :
* **Pas de données sensibles :** Nous ne conservons aucune information sur les croyances religieuses, l'état de santé détaillé (hors contre-indications physiques déclarées), ou les opinions politiques des familles.
* **Juste-à-temps :** Seuls les numéros de téléphones et adresses de quartier des parents de l'année scolaire active sont indexés pour assurer la communication efficace et la réconciliation financière.

### B. Transparence Totale
Tout parent d'élève dispose d'un accès constant à ses données. La création d'un compte ou l'enregistrement de cotisations s'accompagne de l'édition d'une fiche client transparente, vérifiable à la demande.

---

## 2. Rôle du Délégué à la Protection des Données (DPO)
Pour chapeauter la bonne application de ces règles et la tenue des registres conformément à la loi, un Délégué à la Protection des Données unique a été désigné :

* **Nom :** Jacques Bene Mbama
* **Téléphone professionnel :** +237 656 454 053
* **E-mail professionnel :** jacquesbene301@gmail.com
* **Missions :** Tenue du registre des activités de traitement, traitement des requêtes de suppression (droit à l'oubli), formation du bureau de l'APEE, notification en cas d'incidents de sécurité sous 72 heures.

---

## 3. Sécurité des Données
Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles robustes :
* **Règles de sécurité robustes (Firestore Rules) :** L'authentification Firebase limite les requêtes d'écriture et de lecture. Seuls les comptes enregistrés et autorisés peuvent lire ou modifier les fiches élèves et de trésorerie APEE.
* **Chiffrement de bout en bout :** Toutes les connexions transitent par des canaux chiffrés SSL (HTTPS), protégeant les données contre les interceptions sauvages lors des connexions sur réseaux mobiles locaux.
* **Sauvegardes chiffrées :** Les archives exportées en sauvegarde locale sont formatées en JSON pur et doivent être stockées sur des supports sécurisés par les utilisateurs.

---

## 4. Gestion des Consentements
1. **Consentement explicite :** Lors de l'envoi de SMS de relance pour la trésorerie ou de WhatsApp d'information, les parents ont le choix de suspendre ou de modifier leur canal favori d'alerte.
2. **Consentement aux Cookies :** Un bandeau de consentement explicite aux cookies et traceurs locaux est affiché dès le premier chargement de la page de l'ENT, mémorisant les choix de l'utilisateur de manière durable (voir `COOKIES_POLICY.md`).

---

## 5. Procédure relative aux Exercices de Droits
Tout parent d'élève de l'établissement désirant faire valoir son droit d'accès, de modification ou de suppression complète de sa fiche et de celle de ses enfants peut envoyer sa demande motivée de deux façons :
1. **Par e-mail :** À `jacquesbene301@gmail.com` avec pour objet : *"RGPD - Exercice de Droit d'Accès/Suppression"*.
2. **Par téléphone ou entretien physique :** En prenant contact avec M. Jacques Bene Mbama au numéro de permanence téléphonique publique : **+237 656 454 053**.

Ces demandes recevront une attention prioritaire et seront traitées sous 30 jours calendaires à compter de la réception de la demande officielle.
