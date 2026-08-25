# RetinoScan CM — Frontend React

Interface web du système de diagnostic assisté par IA pour la rétinopathie diabétique.

## Installation

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer les variables d'environnement
cp .env.example .env
# Édite .env avec tes clés Firebase et l'URL de ton backend

# 3. Lancer en développement
npm run dev
```

L'application sera disponible sur http://localhost:5173

## Variables d'environnement (.env)

```
VITE_BACKEND_URL=http://localhost:8000          # URL du backend FastAPI en local
VITE_FIREBASE_API_KEY=...                       # Depuis la console Firebase
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## Structure

```
src/
├── App.jsx              ← Router principal
├── firebase.js          ← Config Firebase
├── constants.js         ← Constantes (stades, couleurs, questions)
├── components/
│   ├── Navbar.jsx       ← Navigation sticky
│   ├── Footer.jsx
│   ├── ChatbotWidget.jsx ← Chat flottant (toutes les pages)
│   ├── ResultatRetino.jsx ← Card résultat rétinopathie
│   └── LoadingSpinner.jsx
└── pages/
    ├── Accueil.jsx      ← Landing page
    ├── Diagnostic.jsx   ← 3 onglets (Rétino, Diabète, HTA+CHD)
    ├── Assistant.jsx    ← Chatbot pleine page
    ├── Dashboard.jsx    ← Statistiques + historique consultations
    └── Communaute.jsx   ← Chat temps réel entre médecins
```

## Déploiement sur Vercel

```bash
# Build de production
npm run build

# Déployer avec Vercel CLI
npx vercel --prod
```

Ou connecter le repo GitHub à Vercel et configurer les variables d'environnement dans le dashboard.

## Firebase — Collections requises

Créer dans Firestore :
- `consultations` — toutes les analyses (rétinopathie, diabète, HTA+CHD)
- `messages` — chat de la communauté

Règles Firestore minimales pour le développement :
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```
⚠️ Renforcer les règles avant mise en production !
