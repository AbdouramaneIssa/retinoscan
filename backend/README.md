# Backend — API Rétinopathie Diabétique

Backend FastAPI pour le système de diagnostic assisté par IA : rétinopathie diabétique, diabète, hypertension artérielle et risque cardiovasculaire.

## Structure

```
backend/
├── main.py                  # Application FastAPI principale
├── requirements.txt         # Dépendances Python
├── .env.example             # Template des variables d'environnement
├── .env                     # Variables d'environnement (NE PAS COMMITER)
├── .gitignore
├── README.md
└── models/
    ├── module_prediction_diabete_v_optimisee.pkl
    ├── module_prediction_hypertension.pkl
    ├── module_prediction_chd.pkl
    └── module_retinopathie_efficientnet_final.keras
```

## Routes disponibles

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/health` | Vérification état du serveur (UptimeRobot) |
| GET | `/docs` | Documentation Swagger interactive |
| POST | `/predict/diabete` | Prédiction risque diabète |
| POST | `/predict/hypertension` | Prédiction hypertension |
| POST | `/predict/chd` | Prédiction risque cardiovasculaire 10 ans |
| POST | `/predict/retinopathie` | Classification stade rétinopathie (image) |
| POST | `/predict/complet` | Tous les modules en une requête |
| POST | `/chat` | Chatbot médical Gemini |
| POST | `/rapport/envoyer` | Génération PDF + envoi mail |

## Installation locale

```bash
# 1. Créer un environnement virtuel
python -m venv venv
source venv/bin/activate  # Windows : venv\Scripts\activate

# 2. Installer les dépendances
pip install -r requirements.txt

# 3. Configurer les variables d'environnement
cp .env.example .env
# Édite .env avec tes vraies clés

# 4. Placer les modèles dans le dossier models/

# 5. Lancer le serveur
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Le serveur sera accessible sur : http://localhost:8000
Documentation Swagger : http://localhost:8000/docs

## Déploiement sur Render

1. Push le code sur GitHub (sans .env ni modèles lourds)
2. Créer un nouveau Web Service sur render.com
3. Connecter le repo GitHub
4. Configurer :
   - **Build Command** : `pip install -r requirements.txt`
   - **Start Command** : `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Ajouter les variables d'environnement dans Settings → Environment
6. Pour les modèles : utiliser Git LFS ou les télécharger depuis Hugging Face Hub

## Anti-sleep (UptimeRobot)

Configurer un monitor HTTP sur `https://ton-projet.onrender.com/health` toutes les 10 minutes pour éviter la mise en veille du tier gratuit Render.
