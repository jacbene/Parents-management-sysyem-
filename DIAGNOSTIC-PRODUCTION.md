# Diagnostic général — Pasma-sys

**Date du diagnostic :** 3 octobre 2026  
**État de préparation à la production :** critique  
**Périmètre :** examen du code, de la configuration de déploiement et des vérifications exécutables disponibles dans le dépôt. Ce diagnostic ne constitue pas une validation indépendante de l’infrastructure ou des données actuellement en production.

## Synthèse

L’application compile et passe le contrôle TypeScript. Cependant, l’état actuel du code présente des risques majeurs de confidentialité et d’intégrité des données, en particulier dans les règles Firestore et les parcours de paiement. Le système ne devrait pas être considéré prêt pour une exploitation financière ou scolaire réelle avant la résolution des risques critiques.

## Constats

| Priorité | Constat | Conséquence |
|---|---|---|
| **P0 — Critique** | Les règles Firestore autorisent la lecture et l’écriture sans authentification dans des collections sensibles — notamment élèves, notes, présences, factures, utilisateurs et administrateurs. Le déploiement Firebase référence ces règles permissives. Voir [`firestore.rules`](./firestore.rules), [`src/firestore.rules`](./src/firestore.rules) et [`firebase.json`](./firebase.json). | Exposition et modification possibles de données scolaires, personnelles et financières. Vérifier si des données ont déjà été consultées ou altérées. |
| **P0 — Critique** | Le parcours de paiement peut considérer comme vérifié un webhook simulé : un en-tête de simulation contourne la vérification de signature et la route de simulation est exposée. La synchronisation fait confiance aux événements vérifiés et peut marquer une facture comme payée. En outre, après un échec de Campay, l’API peut répondre avec un succès simulé et le client comptabilise quand même le paiement. Voir [`server.ts`](./server.ts), [`PaymentWebhookHandler.tsx`](./src/components/PaymentWebhookHandler.tsx) et [`ApeeFinancial.tsx`](./src/components/apee/ApeeFinancial.tsx). | Risque de fausses factures acquittées et de montants de redevances erronés. |
| **P1 — Élevé** | Des routes d’envoi SMS et de relance groupée ne montrent pas de contrôle d’accès côté serveur. Le backend autorise les requêtes cross-origin ; cette configuration ne remplace pas une authentification. Voir [`server.ts`](./server.ts). | Abus possible des identifiants SMS globaux, envois indésirables et coûts imprévus. |
| **P1 — Élevé** | Le build place dans le dossier public Firebase le serveur compilé et sa source map. Le build constaté inclut également `pasma-project.zip`. Voir [`package.json`](./package.json), [`firebase.json`](./firebase.json) et [le workflow Firebase Hosting](./.github/workflows/firebase-hosting.yml). | Ces fichiers pourraient être publiés avec le site. Vérifier leur contenu et les retirer du répertoire livré s’ils ne sont pas destinés au public. |
| **P1 — À vérifier** | La clé `VITE_CAMPAY_WEBHOOK_KEY` est lue côté navigateur dans [`PaymentWebhookHandler.tsx`](./src/components/PaymentWebhookHandler.tsx). | Si une vraie clé est injectée sous ce nom, elle sera intégrée au bundle public. Les secrets doivent rester côté serveur. |
| **P2 — Fiabilité et performance** | Le workflow déploie Firebase Hosting après compilation, sans étape de tests ni déploiement explicite des règles Firestore ou du backend. Le bundle JavaScript généré atteint environ 4,4 Mo minifiés, avec avertissement du build. Voir [le workflow](./.github/workflows/firebase-hosting.yml) et [`package.json`](./package.json). | Les changements de règles ou de backend risquent de ne pas suivre le déploiement Hosting ; chargement potentiellement lent sur mobile. |

## Vérifications effectuées

- `npm run lint` : réussi. Il s’agit d’une vérification TypeScript, pas d’une suite de tests.
- `npm run build` : réussi, avec un avertissement sur la taille du bundle JavaScript.
- Aucun script `test` n’est défini dans `package.json`.
- La vérification de `https://pasma-sys-backend.onrender.com/api/health` a expiré après 15 secondes depuis l’environnement de diagnostic. L’état réel du backend en production reste donc indéterminé ; ce résultat ne permet pas de conclure qu’il est hors service.
- Aucun changement de code n’a été effectué dans le cadre du diagnostic.

## Actions prioritaires recommandées

1. **Sécuriser Firestore immédiatement** : remplacer les règles ouvertes par des droits fondés sur l’utilisateur, le rôle et l’établissement ; examiner les journaux d’accès et vérifier l’intégrité des données financières.
2. **Sécuriser les paiements** : désactiver les chemins de simulation en production, rejeter toute signature invalide et ne comptabiliser un paiement qu’après confirmation fiable du fournisseur.
3. **Protéger les routes backend sensibles** : imposer une authentification et une autorisation côté serveur, et limiter les envois SMS.
4. **Séparer les artefacts de déploiement** : retirer du répertoire Firebase Hosting les fichiers serveur, les source maps et toute archive non destinée au public ; vérifier le contenu de l’archive ZIP.
5. **Fiabiliser la livraison** : rendre explicites le déploiement des règles Firestore et du backend, puis ajouter des tests automatisés couvrant les accès et les paiements.

## Conclusion

Les résultats indiquent que Pasma-sys ne devrait pas être considéré prêt pour une exploitation financière ou scolaire réelle avant résolution des deux constats P0. L’état effectif du service hébergé et l’existence d’une éventuelle exposition antérieure restent à vérifier dans les consoles Firebase, Render et Campay.
