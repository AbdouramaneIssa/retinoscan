"""
diagnostic_memoire.py — Decompose l'empreinte memoire d'un backend FastAPI.

Mesure, dans un meme processus et dans cet ordre :
  1. RSS de l'interpreteur nu
  2. RSS apres les imports tiers SEULS (aucun modele charge)
  3. RSS apres `import main` (donc apres chargement des modeles)
  4. Presence de tensorflow / keras dans sys.modules
  5. RSS apres 1 puis 2 predictions reelles

S'applique tel quel a RetinoScan et a AgriScan : le jeu d'imports et la
fonction de prediction sont choisis d'apres --app.

Usage (depuis le dossier backend du projet vise, avec SON venv) :
    python diagnostic_memoire.py --app retinoscan --image ../frontend/public/hero.jpg
    python diagnostic_memoire.py --app agriscan  --image ../frontend/public/hero.jpg
"""

import argparse
import gc
import io
import os
import sys

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")

import warnings

warnings.filterwarnings("ignore")

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

import psutil

PROC = psutil.Process()


def rss():
    """RSS du processus courant, en Mo."""
    return PROC.memory_info().rss / 1024 / 1024


# Imports tiers de chaque main.py, hors stdlib. Recopies depuis l'en-tete des
# fichiers pour que la mesure "imports seuls" reflete exactement le vrai cout.
IMPORTS = {
    "retinoscan": [
        ("numpy", "import numpy"),
        ("pandas", "import pandas"),
        ("joblib", "import joblib"),
        ("pillow", "from PIL import Image"),
        ("onnxruntime", "import onnxruntime"),
        ("fastapi", "import fastapi"),
        ("pydantic", "import pydantic"),
        ("google-generativeai", "import google.generativeai"),
        ("reportlab", "from reportlab.platypus import SimpleDocTemplate"),
        ("dotenv", "from dotenv import load_dotenv"),
        # Non importes par main.py directement, mais tires par les .pkl au
        # moment du joblib.load : mesures ici pour isoler leur cout d'import
        # du cout de deserialisation.
        ("scikit-learn", "import sklearn.ensemble, sklearn.preprocessing"),
        ("xgboost", "import xgboost"),
    ],
    "agriscan": [
        ("numpy", "import numpy"),
        ("pillow", "from PIL import Image"),
        ("onnxruntime", "import onnxruntime"),
        ("fastapi", "import fastapi"),
        ("pydantic", "import pydantic"),
        ("google-generativeai", "import google.generativeai"),
        ("reportlab", "from reportlab.platypus import SimpleDocTemplate"),
        ("dotenv", "from dotenv import load_dotenv"),
    ],
}


def mesurer_imports(app):
    print(f"  {'module':26s} {'RSS':>10s} {'cout':>10s}")
    print("  " + "-" * 48)
    base = rss()
    print(f"  {'(interpreteur nu)':26s} {base:7.1f} Mo {base:+7.1f} Mo")
    precedent = base
    for etiquette, instruction in IMPORTS[app]:
        exec(instruction, {})
        courant = rss()
        print(f"  {etiquette:26s} {courant:7.1f} Mo {courant - precedent:+7.1f} Mo")
        precedent = courant
    print("  " + "-" * 48)
    print(f"  {'TOTAL imports seuls':26s} {precedent:7.1f} Mo {precedent - base:+7.1f} Mo")
    return base, precedent


def verifier_tensorflow(etape):
    tf_charges = sorted(
        m for m in sys.modules
        if m == "tensorflow" or m.startswith("tensorflow.")
        or m == "keras" or m.startswith("keras.")
        or m == "tf2onnx" or m.startswith("tf2onnx.")
    )
    racines = sorted({m.split(".")[0] for m in tf_charges})
    if tf_charges:
        print(f"  [{etape}] TensorFlow/Keras PRESENT dans sys.modules : "
              f"{len(tf_charges)} modules, racines {racines}")
    else:
        print(f"  [{etape}] tensorflow / keras / tf2onnx : ABSENTS de sys.modules")
    return tf_charges


def predire(app, main, image_bytes):
    """Appelle la fonction de prediction du module main, selon le projet."""
    if app == "retinoscan":
        return main.predire_retinopathie(image_bytes)
    from PIL import Image
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    culture = "mais" if main.MODELES.get("mais") else "manioc"
    return main.predire_maladie(image, culture)


def main_cli():
    p = argparse.ArgumentParser()
    p.add_argument("--app", required=True, choices=sorted(IMPORTS))
    p.add_argument("--image", required=True)
    args = p.parse_args()

    print(f"=== DIAGNOSTIC MEMOIRE — {args.app.upper()} ===")
    print(f"  Python {sys.version.split()[0]} | {sys.executable}\n")

    print("--- 1. Imports tiers seuls (aucun modele charge) ---")
    rss_nu, rss_imports = mesurer_imports(args.app)

    print("\n--- 2. TensorFlow encore importe ? (avant main) ---")
    verifier_tensorflow("imports seuls")

    print("\n--- 3. Chargement de l'application (import main) ---")
    import main

    rss_demarrage = rss()
    print(f"  RSS apres import main       : {rss_demarrage:7.1f} Mo "
          f"({rss_demarrage - rss_imports:+.1f} Mo pour les modeles)")

    print("\n--- 4. TensorFlow encore importe ? (apres main) ---")
    verifier_tensorflow("application chargee")

    print("\n--- 5. Predictions reelles ---")
    with open(args.image, "rb") as f:
        image_bytes = f.read()
    print(f"  image : {args.image} ({len(image_bytes) / 1024:.0f} Ko)")

    resultat_1 = predire(args.app, main, image_bytes)
    rss_p1 = rss()
    print(f"  RSS apres 1re prediction    : {rss_p1:7.1f} Mo ({rss_p1 - rss_demarrage:+.1f} Mo)")

    resultat_2 = predire(args.app, main, image_bytes)
    rss_p2 = rss()
    print(f"  RSS apres 2e prediction     : {rss_p2:7.1f} Mo ({rss_p2 - rss_p1:+.1f} Mo)")

    gc.collect()
    print(f"  RSS apres gc.collect()      : {rss():7.1f} Mo")
    print(f"  memes resultats aux 2 appels : {resultat_1 == resultat_2}")

    print("\n--- SYNTHESE ---")
    print(f"  interpreteur nu        : {rss_nu:7.1f} Mo")
    print(f"  + imports tiers        : {rss_imports:7.1f} Mo  (+{rss_imports - rss_nu:.1f})")
    print(f"  + modeles (demarrage)  : {rss_demarrage:7.1f} Mo  (+{rss_demarrage - rss_imports:.1f})")
    print(f"  + 2 predictions        : {rss_p2:7.1f} Mo  (+{rss_p2 - rss_demarrage:.1f})")
    print(f"  budget 512 Mo          : {100.0 * rss_p2 / 512:.1f} % consomme")
    return 0


if __name__ == "__main__":
    sys.exit(main_cli())
