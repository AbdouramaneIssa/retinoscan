"""
Backend FastAPI — Rétinopathie Diabétique & Modules Associés
Auteur : Projet de soutenance
Routes : /health, /predict/diabete, /predict/hypertension,
         /predict/chd, /predict/retinopathie, /chat, /rapport/envoyer
"""

import os
import io
import base64
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from datetime import datetime
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from PIL import Image

import tensorflow as tf
from tensorflow.keras.applications.efficientnet import preprocess_input

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import google.generativeai as genai
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable

# ─────────────────────────────────────────────
# Configuration du logging
# ─────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# Initialisation de l'application FastAPI
# ─────────────────────────────────────────────
app = FastAPI(
    title="API Rétinopathie Diabétique",
    description="Backend de prédiction : Rétinopathie, Diabète, Hypertension, Risque CHD + Chatbot IA",
    version="1.0.0"
)

# CORS — autorise le frontend React (Vercel) à appeler ce backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En production, remplace par l'URL Vercel exacte
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# Variables d'environnement
# ─────────────────────────────────────────────
from dotenv import load_dotenv
load_dotenv()

GEMINI_API_KEY    = os.getenv("GEMINI_API_KEY", "")
GMAIL_ADDRESS     = os.getenv("GMAIL_ADDRESS", "")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "")

# ─────────────────────────────────────────────
# Constantes
# ─────────────────────────────────────────────
IMG_SIZE         = 224
SEUIL_CONFIANCE  = 0.55
MODELS_DIR       = "./models"

CLASS_NAMES_RETINO = [
    "Stade 0 — Aucune rétinopathie",
    "Stade 1 — Rétinopathie légère (Mild)",
    "Stade 2 — Rétinopathie modérée (Moderate)",
    "Stade 3 — Rétinopathie sévère (Severe)",
    "Stade 4 — Rétinopathie proliférante (Proliferative DR)",
    "Image non reconnue"
]

INFOS_STADES = {
    0: {
        "titre": "Aucune rétinopathie détectée",
        "description": "Le fond d'œil ne présente aucun signe de rétinopathie diabétique.",
        "recommandations": [
            "Contrôle glycémique strict (HbA1c < 7%)",
            "Examen ophtalmologique annuel de suivi",
            "Maintien d'une tension artérielle optimale (< 130/80 mmHg)",
            "Arrêt du tabac si fumeur"
        ],
        "urgence": "Faible",
        "couleur": "#27ae60"
    },
    1: {
        "titre": "Rétinopathie légère (Mild NPDR)",
        "description": "Présence de micro-anévrismes rétiniens. Premiers signes de la maladie.",
        "recommandations": [
            "Optimisation urgente de l'équilibre glycémique",
            "Suivi ophtalmologique tous les 6 à 12 mois",
            "Contrôle strict de la tension artérielle",
            "Bilan lipidique et traitement si nécessaire"
        ],
        "urgence": "Modérée",
        "couleur": "#f39c12"
    },
    2: {
        "titre": "Rétinopathie modérée (Moderate NPDR)",
        "description": "Hémorragies rétiniennes, exsudats durs, anomalies microvasculaires.",
        "recommandations": [
            "Suivi ophtalmologique tous les 3 à 6 mois",
            "Optimisation du traitement du diabète (ajustement thérapeutique)",
            "Traitement de l'hypertension artérielle associée",
            "Envisager une photocoagulation selon l'évolution"
        ],
        "urgence": "Élevée",
        "couleur": "#e67e22"
    },
    3: {
        "titre": "Rétinopathie sévère (Severe NPDR)",
        "description": "Occlusions veineuses, anomalies microvasculaires intrarétiniennes étendues.",
        "recommandations": [
            "Consultation ophtalmologique en urgence",
            "Photocoagulation panrétinienne à discuter rapidement",
            "Hospitalisation possible selon l'état général",
            "Optimisation maximale de tous les facteurs de risque"
        ],
        "urgence": "Très élevée",
        "couleur": "#e74c3c"
    },
    4: {
        "titre": "Rétinopathie proliférante (PDR)",
        "description": "Néovascularisation rétinienne et/ou prérétinienne. Stade avancé à haut risque de cécité.",
        "recommandations": [
            "Consultation ophtalmologique en URGENCE absolue",
            "Photocoagulation panrétinienne immédiate",
            "Injections intravitréennes d'anti-VEGF à évaluer",
            "Vitrectomie possible si complications (hémorragie, décollement de rétine)",
            "Surveillance multidisciplinaire diabétologue + ophtalmologue"
        ],
        "urgence": "Urgence absolue",
        "couleur": "#8e44ad"
    }
}

# ─────────────────────────────────────────────
# Chargement des modèles au démarrage
# ─────────────────────────────────────────────
logger.info("Chargement des modèles en mémoire...")

try:
    pipe_diabete = joblib.load(f"{MODELS_DIR}/module_prediction_diabete_v_optimisee.pkl")
    logger.info("✅ Modèle diabète chargé")
except Exception as e:
    logger.error(f"❌ Modèle diabète : {e}")
    pipe_diabete = None

try:
    pipe_hypertension = joblib.load(f"{MODELS_DIR}/module_prediction_hypertension.pkl")
    logger.info("✅ Modèle hypertension chargé")
except Exception as e:
    logger.error(f"❌ Modèle hypertension : {e}")
    pipe_hypertension = None

try:
    pipe_chd = joblib.load(f"{MODELS_DIR}/module_prediction_chd.pkl")
    logger.info("✅ Modèle CHD chargé")
except Exception as e:
    logger.error(f"❌ Modèle CHD : {e}")
    pipe_chd = None

try:
    modele_retino = tf.keras.models.load_model(
        f"{MODELS_DIR}/module_retinopathie_efficientnet_final.keras"
    )
    logger.info("✅ Modèle rétinopathie EfficientNet chargé")
except Exception as e:
    logger.error(f"❌ Modèle rétinopathie : {e}")
    modele_retino = None

# Gemini
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    gemini_model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        system_instruction=(
            "Tu es un assistant médical spécialisé en ophtalmologie, diabétologie et cardiologie. "
            "Tu aides les professionnels de santé à interpréter les résultats de diagnostics automatisés "
            "(rétinopathie diabétique, diabète, hypertension artérielle). "
            "Réponds toujours en français, de façon claire, structurée et professionnelle. "
            "Ne pose jamais de diagnostic définitif — tu assistes le médecin, tu ne le remplace pas. "
            "Si une question sort du champ médical, redirige poliment vers le sujet principal."
        )
    )
    logger.info("✅ Gemini configuré")
else:
    gemini_model = None
    logger.warning("⚠️ GEMINI_API_KEY manquante — chatbot désactivé")

logger.info("Tous les modèles sont chargés. Serveur prêt.")

# ─────────────────────────────────────────────
# Schémas Pydantic (validation des entrées)
# ─────────────────────────────────────────────

class DonneesDiabete(BaseModel):
    gender: str = Field(..., description="Sexe : 'Male', 'Female' ou 'Other'")
    age: float = Field(..., ge=0, le=120)
    hypertension: int = Field(..., ge=0, le=1, description="0 = Non, 1 = Oui")
    heart_disease: int = Field(..., ge=0, le=1, description="0 = Non, 1 = Oui")
    smoking_history: str = Field(..., description="'never', 'former', 'current', 'ever', 'not current', 'No Info'")
    bmi: float = Field(..., ge=10, le=70)
    HbA1c_level: float = Field(..., ge=3.0, le=15.0)
    blood_glucose_level: float = Field(..., ge=50, le=500)

class DonneesHypertension(BaseModel):
    male: int = Field(..., ge=0, le=1, description="1 = Homme, 0 = Femme")
    age: float = Field(..., ge=0, le=120)
    education: float = Field(..., ge=1, le=4)
    currentSmoker: int = Field(..., ge=0, le=1)
    cigsPerDay: float = Field(..., ge=0, le=100)
    BPMeds: float = Field(..., ge=0, le=1, description="Sous médicaments antihypertenseurs")
    prevalentStroke: int = Field(..., ge=0, le=1)
    diabetes: int = Field(..., ge=0, le=1)
    totChol: float = Field(..., ge=100, le=600, description="Cholestérol total (mg/dL)")
    BMI: float = Field(..., ge=10, le=70)
    heartRate: float = Field(..., ge=30, le=200)
    glucose: float = Field(..., ge=50, le=500)

class DonneesCHD(BaseModel):
    male: int = Field(..., ge=0, le=1)
    age: float = Field(..., ge=0, le=120)
    education: float = Field(..., ge=1, le=4)
    currentSmoker: int = Field(..., ge=0, le=1)
    cigsPerDay: float = Field(..., ge=0, le=100)
    BPMeds: float = Field(..., ge=0, le=1)
    prevalentStroke: int = Field(..., ge=0, le=1)
    prevalentHyp: int = Field(..., ge=0, le=1, description="Résultat du module hypertension")
    diabetes: int = Field(..., ge=0, le=1)
    totChol: float = Field(..., ge=100, le=600)
    sysBP: float = Field(..., ge=80, le=300, description="Tension systolique (mmHg)")
    diaBP: float = Field(..., ge=40, le=200, description="Tension diastolique (mmHg)")
    BMI: float = Field(..., ge=10, le=70)
    heartRate: float = Field(..., ge=30, le=200)
    glucose: float = Field(..., ge=50, le=500)

class MessageChat(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    contexte: Optional[str] = Field(None, description="Contexte médical du patient (résultats récents)")
    historique: Optional[list] = Field(default=[], description="Historique de la conversation")

class DonneesRapport(BaseModel):
    nom_patient: str
    email_patient: str
    date_analyse: str
    resultat_retinopathie: Optional[dict] = None
    resultat_diabete: Optional[dict] = None
    resultat_hypertension: Optional[dict] = None
    resultat_chd: Optional[dict] = None
    nom_medecin: Optional[str] = "Dr. [Nom du médecin]"

# ─────────────────────────────────────────────
# Fonctions utilitaires
# ─────────────────────────────────────────────

def predire_retinopathie(image_bytes: bytes) -> dict:
    """Prédit le stade de rétinopathie avec filet de sécurité à 2 niveaux."""
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize((IMG_SIZE, IMG_SIZE))
    arr = np.array(img, dtype=np.float32)
    arr = preprocess_input(arr)
    arr = np.expand_dims(arr, axis=0)

    proba = modele_retino.predict(arr, verbose=0)[0]
    classe = int(np.argmax(proba))
    confiance = float(proba[classe])

    # Barrière 1 : classe "Not an Eye"
    if classe == 5:
        return {
            "valide": False,
            "message": "Image non reconnue comme un fond d'œil. Veuillez fournir une photo de fond d'œil valide.",
            "confiance": round(confiance * 100, 1)
        }

    # Barrière 2 : confiance insuffisante
    if confiance < SEUIL_CONFIANCE:
        return {
            "valide": False,
            "message": f"Confiance insuffisante ({round(confiance * 100, 1)}%). Image rejetée par précaution.",
            "confiance": round(confiance * 100, 1)
        }

    return {
        "valide": True,
        "stade": classe,
        "label": CLASS_NAMES_RETINO[classe],
        "confiance": round(confiance * 100, 1),
        "infos": INFOS_STADES[classe],
        "toutes_probabilites": {
            CLASS_NAMES_RETINO[i]: round(float(p) * 100, 1)
            for i, p in enumerate(proba)
        }
    }


def generer_pdf_rapport(donnees: DonneesRapport, texte_ia: str) -> bytes:
    """Génère un rapport PDF professionnel avec les résultats et le texte Gemini."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=2*cm, leftMargin=2*cm,
        topMargin=2*cm, bottomMargin=2*cm
    )

    styles = getSampleStyleSheet()
    titre_style = ParagraphStyle(
        'Titre', parent=styles['Title'],
        fontSize=18, textColor=colors.HexColor('#2c3e50'),
        spaceAfter=6
    )
    sous_titre_style = ParagraphStyle(
        'SousTitre', parent=styles['Heading2'],
        fontSize=13, textColor=colors.HexColor('#2980b9'),
        spaceBefore=12, spaceAfter=4
    )
    corps_style = ParagraphStyle(
        'Corps', parent=styles['Normal'],
        fontSize=10, leading=14
    )

    contenu = []

    # En-tête
    contenu.append(Paragraph("RAPPORT D'ANALYSE OPHTALMOLOGIQUE", titre_style))
    contenu.append(Paragraph("Système de Diagnostic Assisté par IA — Rétinopathie Diabétique", styles['Normal']))
    contenu.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#2980b9')))
    contenu.append(Spacer(1, 0.4*cm))

    # Informations patient
    contenu.append(Paragraph("Informations du Patient", sous_titre_style))
    data_patient = [
        ["Nom complet", donnees.nom_patient],
        ["Email", donnees.email_patient],
        ["Date d'analyse", donnees.date_analyse],
        ["Type de rapport", "Rapport automatisé — RetinoScan CM"],
    ]
    table = Table(data_patient, colWidths=[5*cm, 11*cm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#ecf0f1')),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('PADDING', (0, 0), (-1, -1), 6),
    ]))
    contenu.append(table)
    contenu.append(Spacer(1, 0.5*cm))

    # Résultats
    contenu.append(Paragraph("Résultats des Analyses", sous_titre_style))

    if donnees.resultat_retinopathie:
        r = donnees.resultat_retinopathie
        contenu.append(Paragraph("Rétinopathie Diabétique", styles['Heading3']))
        data_r = [
            ["Stade détecté", r.get('label', 'N/A')],
            ["Confiance du modèle", f"{r.get('confiance', 'N/A')}%"],
            ["Niveau d'urgence", r.get('infos', {}).get('urgence', 'N/A')],
        ]
        table_r = Table(data_r, colWidths=[5*cm, 11*cm])
        table_r.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#d5e8d4')),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        contenu.append(table_r)
        contenu.append(Spacer(1, 0.3*cm))

    if donnees.resultat_diabete:
        r = donnees.resultat_diabete
        contenu.append(Paragraph("Risque de Diabète", styles['Heading3']))
        data_d = [
            ["Prédiction", "Diabétique" if r.get('prediction') == 1 else "Non diabétique"],
            ["Probabilité", f"{r.get('probabilite', 'N/A')}%"],
        ]
        table_d = Table(data_d, colWidths=[5*cm, 11*cm])
        table_d.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#fff2cc')),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        contenu.append(table_d)
        contenu.append(Spacer(1, 0.3*cm))

    if donnees.resultat_hypertension:
        r = donnees.resultat_hypertension
        contenu.append(Paragraph("Hypertension Artérielle", styles['Heading3']))
        data_h = [
            ["Prédiction", "Hypertendu" if r.get('prediction') == 1 else "Non hypertendu"],
            ["Probabilité", f"{r.get('probabilite', 'N/A')}%"],
        ]
        table_h = Table(data_h, colWidths=[5*cm, 11*cm])
        table_h.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#dae8fc')),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        contenu.append(table_h)
        contenu.append(Spacer(1, 0.3*cm))

    if donnees.resultat_chd:
        r = donnees.resultat_chd
        contenu.append(Paragraph("Risque Cardiovasculaire à 10 ans (CHD)", styles['Heading3']))
        data_c = [
            ["Prédiction", "À risque élevé" if r.get('prediction') == 1 else "Risque faible"],
            ["Probabilité", f"{r.get('probabilite', 'N/A')}%"],
        ]
        table_c = Table(data_c, colWidths=[5*cm, 11*cm])
        table_c.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f8cecc')),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        contenu.append(table_c)
        contenu.append(Spacer(1, 0.5*cm))

    # Synthèse IA
    contenu.append(HRFlowable(width="100%", thickness=1, color=colors.grey))
    contenu.append(Spacer(1, 0.3*cm))
    contenu.append(Paragraph("Synthèse et Recommandations (Assisté par IA)", sous_titre_style))
    contenu.append(Paragraph(texte_ia.replace('\n', '<br/>'), corps_style))
    contenu.append(Spacer(1, 0.5*cm))

    # Avertissement médical
    contenu.append(HRFlowable(width="100%", thickness=1, color=colors.grey))
    avertissement = ParagraphStyle(
        'Avert', parent=styles['Normal'],
        fontSize=8, textColor=colors.grey, spaceBefore=6
    )
    contenu.append(Paragraph(
        "⚠️ Ce rapport est généré par un système d'aide au diagnostic assisté par intelligence artificielle. "
        "Il ne constitue pas un avis médical définitif et ne remplace pas le jugement clinique du médecin traitant. "
        "Toute décision thérapeutique doit être prise par un professionnel de santé qualifié.",
        avertissement
    ))

    doc.build(contenu)
    buffer.seek(0)
    return buffer.read()


def _carte_resultat_html(titre: str, lignes: list, couleur: str) -> str:
    """Construit une petite carte de résultat pour l'email HTML."""
    items = "".join(
        f'<tr>'
        f'<td style="padding:3px 0;color:#475569;font-size:14px;">{k}</td>'
        f'<td style="padding:3px 0;text-align:right;font-weight:700;color:#0f172a;font-size:14px;">{v}</td>'
        f'</tr>'
        for k, v in lignes
    )
    return f"""
    <tr><td style="padding:6px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="background:{couleur}14;border:1px solid {couleur}44;border-radius:12px;">
        <tr><td style="padding:13px 16px;">
          <div style="font-weight:700;color:{couleur};font-size:12px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">{titre}</div>
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">{items}</table>
        </td></tr>
      </table>
    </td></tr>"""


def _construire_email_html(donnees: "DonneesRapport", texte_synthese: str) -> str:
    """Génère le corps HTML (responsive, compatible clients mail) du rapport."""
    cartes = ""
    if donnees.resultat_retinopathie:
        r = donnees.resultat_retinopathie
        cartes += _carte_resultat_html("Rétinopathie diabétique", [
            ("Stade détecté", r.get('label', '—')),
            ("Confiance du modèle", f"{r.get('confiance', '—')}%"),
        ], "#0891b2")
    if donnees.resultat_diabete:
        r = donnees.resultat_diabete
        cartes += _carte_resultat_html("Risque de diabète", [
            ("Prédiction", "Diabétique" if r.get('prediction') == 1 else "Non diabétique"),
            ("Probabilité", f"{r.get('probabilite', '—')}%"),
        ], "#d97706")
    if donnees.resultat_hypertension:
        r = donnees.resultat_hypertension
        cartes += _carte_resultat_html("Hypertension artérielle", [
            ("Prédiction", "Hypertendu" if r.get('prediction') == 1 else "Non hypertendu"),
            ("Probabilité", f"{r.get('probabilite', '—')}%"),
        ], "#2563eb")
    if donnees.resultat_chd:
        r = donnees.resultat_chd
        cartes += _carte_resultat_html("Risque cardiovasculaire (10 ans)", [
            ("Prédiction", "Risque élevé" if r.get('prediction') == 1 else "Risque faible"),
            ("Probabilité", f"{r.get('probabilite', '—')}%"),
        ], "#dc2626")

    bloc_resultats = f"""
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:8px 0 4px;">
        {cartes}
      </table>""" if cartes else ""

    synthese_html = (texte_synthese or "").replace("\n", "<br/>")

    return f"""<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eef3f9;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#eef3f9;padding:24px 12px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation"
             style="max-width:600px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(2,44,72,0.10);">

        <!-- En-tête -->
        <tr><td style="background:linear-gradient(135deg,#072b48,#0c557d);padding:28px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:.3px;">
              👁️ RetinoScan <span style="color:#67e8f9;">CM</span>
            </td>
            <td align="right" style="color:#a5f3fc;font-size:12px;font-weight:600;">Rapport automatisé</td>
          </tr></table>
        </td></tr>
        <tr><td style="height:4px;background:linear-gradient(90deg,#22d3ee,#3b82f6,#22d3ee);"></td></tr>

        <!-- Corps -->
        <tr><td style="padding:30px 32px 8px;">
          <p style="margin:0 0 6px;font-size:18px;font-weight:700;color:#0f172a;">Bonjour {donnees.nom_patient},</p>
          <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#475569;">
            Voici votre <strong>rapport d'analyse</strong> généré automatiquement par notre système de diagnostic
            assisté par intelligence artificielle. Le rapport complet est disponible en <strong>pièce jointe (PDF)</strong>.
          </p>

          <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#0c557d;margin:6px 0;">Résumé des résultats</div>
          {bloc_resultats}
        </td></tr>

        <!-- Synthèse IA -->
        <tr><td style="padding:14px 32px 4px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f6f9fc;border:1px solid #e2eaf3;border-radius:12px;">
            <tr><td style="padding:16px 18px;">
              <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#0c557d;margin-bottom:8px;">✨ Synthèse &amp; recommandations</div>
              <div style="font-size:13.5px;line-height:1.7;color:#334155;">{synthese_html}</div>
            </td></tr>
          </table>
        </td></tr>

        <!-- Avertissement -->
        <tr><td style="padding:16px 32px 4px;">
          <p style="margin:0;font-size:11.5px;line-height:1.6;color:#94a3b8;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:12px 14px;">
            ⚠️ Ce rapport est un outil d'aide au diagnostic assisté par IA. Il ne remplace pas le jugement clinique
            d'un professionnel de santé qualifié. Consultez un médecin pour tout suivi médical.
          </p>
        </td></tr>

        <!-- Pied -->
        <tr><td style="padding:22px 32px 28px;text-align:center;">
          <p style="margin:0;font-size:13px;font-weight:700;color:#0c557d;">RetinoScan CM</p>
          <p style="margin:4px 0 0;font-size:11px;color:#94a3b8;">Rapport automatisé · Merci de ne pas répondre à cet email · {datetime.now().strftime('%d/%m/%Y')}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""


def envoyer_mail_avec_pdf(donnees: "DonneesRapport", pdf_bytes: bytes, texte_synthese: str = ""):
    """Envoie le rapport (email HTML designé + PDF en pièce jointe) via Gmail SMTP."""
    nom_patient = donnees.nom_patient
    email_dest  = donnees.email_patient

    msg = MIMEMultipart('mixed')
    msg['From']    = f"RetinoScan CM <{GMAIL_ADDRESS}>"
    msg['To']      = email_dest
    msg['Subject'] = f"Votre rapport d'analyse — RetinoScan CM — {datetime.now().strftime('%d/%m/%Y')}"

    # Alternative texte + HTML
    corps = MIMEMultipart('alternative')
    texte_brut = (
        f"Bonjour {nom_patient},\n\n"
        "Voici votre rapport d'analyse généré automatiquement par RetinoScan CM. "
        "Le rapport complet est disponible en pièce jointe (PDF).\n\n"
        "⚠️ Ce rapport est un outil d'aide au diagnostic et ne remplace pas l'avis d'un professionnel de santé.\n\n"
        "RetinoScan CM — Rapport automatisé"
    )
    corps.attach(MIMEText(texte_brut, 'plain', 'utf-8'))
    corps.attach(MIMEText(_construire_email_html(donnees, texte_synthese), 'html', 'utf-8'))
    msg.attach(corps)

    # Pièce jointe PDF
    piece_jointe = MIMEBase('application', 'octet-stream')
    piece_jointe.set_payload(pdf_bytes)
    encoders.encode_base64(piece_jointe)
    piece_jointe.add_header(
        'Content-Disposition',
        f'attachment; filename="rapport_{nom_patient.replace(" ", "_")}_{datetime.now().strftime("%Y%m%d")}.pdf"'
    )
    msg.attach(piece_jointe)

    with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
        server.login(GMAIL_ADDRESS, GMAIL_APP_PASSWORD)
        server.sendmail(GMAIL_ADDRESS, email_dest, msg.as_string())


# ─────────────────────────────────────────────
# Routes API
# ─────────────────────────────────────────────

@app.get("/health", tags=["Système"])
def health_check():
    """Vérification de l'état du serveur (utilisé par UptimeRobot pour éviter le sleep)."""
    return {
        "status": "ok",
        "modeles": {
            "diabete":       pipe_diabete is not None,
            "hypertension":  pipe_hypertension is not None,
            "chd":           pipe_chd is not None,
            "retinopathie":  modele_retino is not None,
        },
        "chatbot": gemini_model is not None
    }


@app.post("/predict/diabete", tags=["Prédictions"])
def predict_diabete(donnees: DonneesDiabete):
    """Prédit le risque de diabète à partir des données cliniques du patient."""
    if pipe_diabete is None:
        raise HTTPException(status_code=503, detail="Modèle diabète non disponible")

    try:
        enc = pipe_diabete['encodeurs']
        gender_enc  = enc['gender'].transform([donnees.gender])[0]
        smoking_enc = enc['smoking_history'].transform([donnees.smoking_history])[0]

        df = pd.DataFrame([{
            'gender':               gender_enc,
            'age':                  donnees.age,
            'hypertension':         donnees.hypertension,
            'heart_disease':        donnees.heart_disease,
            'smoking_history':      smoking_enc,
            'bmi':                  donnees.bmi,
            'HbA1c_level':          donnees.HbA1c_level,
            'blood_glucose_level':  donnees.blood_glucose_level,
        }])

        df_scaled  = pipe_diabete['scaler'].transform(df)
        prediction = int(pipe_diabete['modele_xgboost'].predict(df_scaled)[0])
        probabilite = float(pipe_diabete['modele_xgboost'].predict_proba(df_scaled)[0][1])

        return {
            "prediction":  prediction,
            "label":       "Diabétique" if prediction == 1 else "Non diabétique",
            "probabilite": round(probabilite * 100, 1),
            "risque":      "Élevé" if probabilite >= 0.5 else "Faible"
        }

    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Valeur invalide : {str(e)}")
    except Exception as e:
        logger.error(f"Erreur prédiction diabète : {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la prédiction")


@app.post("/predict/hypertension", tags=["Prédictions"])
def predict_hypertension(donnees: DonneesHypertension):
    """Prédit le risque d'hypertension artérielle (sans utiliser la tension elle-même)."""
    if pipe_hypertension is None:
        raise HTTPException(status_code=503, detail="Modèle hypertension non disponible")

    try:
        colonnes = pipe_hypertension['colonnes']
        df = pd.DataFrame([donnees.model_dump()])[colonnes]
        df_scaled  = pipe_hypertension['scaler'].transform(df)
        prediction  = int(pipe_hypertension['modele'].predict(df_scaled)[0])
        probabilite = float(pipe_hypertension['modele'].predict_proba(df_scaled)[0][1])

        return {
            "prediction":  prediction,
            "label":       "Hypertendu" if prediction == 1 else "Non hypertendu",
            "probabilite": round(probabilite * 100, 1),
            "risque":      "Élevé" if probabilite >= 0.5 else "Faible"
        }

    except Exception as e:
        logger.error(f"Erreur prédiction hypertension : {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la prédiction")


@app.post("/predict/chd", tags=["Prédictions"])
def predict_chd(donnees: DonneesCHD):
    """Prédit le risque de maladie coronarienne à 10 ans (TenYearCHD)."""
    if pipe_chd is None:
        raise HTTPException(status_code=503, detail="Modèle CHD non disponible")

    try:
        colonnes = pipe_chd['colonnes']
        df = pd.DataFrame([donnees.model_dump()])[colonnes]
        df_scaled  = pipe_chd['scaler'].transform(df)
        prediction  = int(pipe_chd['modele'].predict(df_scaled)[0])
        probabilite = float(pipe_chd['modele'].predict_proba(df_scaled)[0][1])

        return {
            "prediction":  prediction,
            "label":       "Risque cardiovasculaire élevé" if prediction == 1 else "Risque cardiovasculaire faible",
            "probabilite": round(probabilite * 100, 1),
            "risque":      "Élevé" if probabilite >= 0.5 else "Faible"
        }

    except Exception as e:
        logger.error(f"Erreur prédiction CHD : {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la prédiction")


@app.post("/predict/retinopathie", tags=["Prédictions"])
async def predict_retinopathie(image: UploadFile = File(...)):
    """
    Classifie le stade de rétinopathie diabétique sur une image de fond d'œil.
    Inclut un double filet de sécurité (classe 'Not Eye' + seuil de confiance).
    """
    if modele_retino is None:
        raise HTTPException(status_code=503, detail="Modèle rétinopathie non disponible")

    if not image.content_type.startswith("image/"):
        raise HTTPException(status_code=422, detail="Le fichier doit être une image (JPG, PNG, etc.)")

    try:
        image_bytes = await image.read()
        resultat    = predire_retinopathie(image_bytes)
        return resultat

    except Exception as e:
        logger.error(f"Erreur prédiction rétinopathie : {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de l'analyse de l'image")


@app.post("/predict/complet", tags=["Prédictions"])
async def predict_complet(
    image:            UploadFile = File(None),
    donnees_diabete:  Optional[str] = None,
    donnees_hta:      Optional[str] = None,
):
    """
    Route combinée : enchaîne tous les modules disponibles selon les données fournies.
    Renvoie un rapport complet en une seule requête.
    """
    resultats = {}

    if image:
        image_bytes = await image.read()
        resultats['retinopathie'] = predire_retinopathie(image_bytes)

    return {"resultats": resultats, "date": datetime.now().isoformat()}


@app.post("/chat", tags=["Assistant IA"])
async def chat(payload: MessageChat):
    """
    Chatbot médical alimenté par Gemini.
    Accepte un contexte médical optionnel (résultats du patient) pour des réponses personnalisées.
    """
    if gemini_model is None:
        raise HTTPException(status_code=503, detail="Chatbot non disponible — clé API manquante")

    try:
        # Construction du prompt avec contexte médical si disponible
        prompt_final = payload.message
        if payload.contexte:
            prompt_final = (
                f"[CONTEXTE MÉDICAL DU PATIENT : {payload.contexte}]\n\n"
                f"Question du médecin : {payload.message}"
            )

        # Historique de conversation pour le multi-tour
        historique_gemini = []
        for msg in (payload.historique or []):
            if msg.get('role') in ('user', 'model') and msg.get('content'):
                historique_gemini.append({
                    "role": msg['role'],
                    "parts": [msg['content']]
                })

        chat_session = gemini_model.start_chat(history=historique_gemini)
        response     = chat_session.send_message(prompt_final)

        return {
            "reponse": response.text,
            "tokens_utilises": response.usage_metadata.total_token_count if hasattr(response, 'usage_metadata') else None
        }

    except Exception as e:
        logger.error(f"Erreur chatbot Gemini : {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la génération de la réponse")


@app.post("/rapport/envoyer", tags=["Rapports"])
async def envoyer_rapport(donnees: DonneesRapport):
    """
    Génère un rapport PDF personnalisé (texte rédigé par Gemini) et l'envoie par mail au patient.
    """
    if not GMAIL_ADDRESS or not GMAIL_APP_PASSWORD:
        raise HTTPException(status_code=503, detail="Service mail non configuré")

    try:
        # Gemini rédige la synthèse médicale du rapport
        if gemini_model:
            prompt_rapport = f"""
Tu es un assistant médical. Rédige une synthèse médicale professionnelle et bienveillante 
pour le rapport du patient {donnees.nom_patient}, basée sur ces résultats :

- Rétinopathie : {donnees.resultat_retinopathie}
- Diabète : {donnees.resultat_diabete}
- Hypertension : {donnees.resultat_hypertension}
- Risque CHD : {donnees.resultat_chd}

La synthèse doit inclure :
1. Un résumé clair des résultats en langage accessible au patient
2. Les recommandations prioritaires adaptées à son état
3. Un message d'encouragement et l'importance du suivi médical régulier

Rédige en français, ton professionnel mais chaleureux, environ 200 mots.
Ne mets pas de titre — commence directement par le texte.
"""
            response_ia  = gemini_model.generate_content(prompt_rapport)
            texte_synthese = response_ia.text
        else:
            texte_synthese = (
                "Synthèse automatique non disponible. Veuillez consulter votre médecin traitant "
                "pour l'interprétation détaillée de vos résultats."
            )

        # Génération du PDF
        pdf_bytes = generer_pdf_rapport(donnees, texte_synthese)

        # Envoi par mail (email HTML designé + PDF)
        envoyer_mail_avec_pdf(donnees, pdf_bytes, texte_synthese)

        return {
            "success": True,
            "message": f"Rapport envoyé avec succès à {donnees.email_patient}"
        }

    except smtplib.SMTPAuthenticationError:
        raise HTTPException(status_code=503, detail="Erreur d'authentification Gmail — vérifiez le mot de passe d'application")
    except Exception as e:
        logger.error(f"Erreur envoi rapport : {e}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'envoi du rapport : {str(e)}")


@app.get("/", tags=["Système"])
def root():
    return {
        "message": "API Rétinopathie Diabétique — en ligne",
        "documentation": "/docs",
        "version": "1.0.0"
    }
