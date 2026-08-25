"""
test_endpoints.py — Frappe chaque endpoint de prediction et enregistre les reponses.

Lance uvicorn, appelle /health, /predict/diabete, /predict/hypertension,
/predict/chd, /predict/retinopathie (sur de vraies images du projet) et
/predict/complet, puis ecrit le tout dans un JSON.

Sert a comparer strictement les resultats avant et apres la migration
TensorFlow -> onnxruntime : memes entrees, memes sorties attendues.

Usage :
    python test_endpoints.py --out resultats_avant.json
    python test_endpoints.py --out resultats_apres.json
    python test_endpoints.py --compare resultats_avant.json resultats_apres.json
"""

import argparse
import json
import mimetypes
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid

RACINE = os.path.dirname(os.path.abspath(__file__))
PROJET = os.path.dirname(RACINE)

# Images reelles du projet. Aucun fond d'oeil n'est fourni dans le depot :
# ces photos exercent surtout les barrieres de securite (classe "non reconnue"
# et seuil de confiance). Ce qui compte ici est que la reponse soit IDENTIQUE
# avant et apres migration pour une entree donnee.
IMAGES = [
    os.path.join(PROJET, "frontend", "public", "hero.jpg"),
    os.path.join(PROJET, "frontend", "public", "hero1.jpg"),
    os.path.join(PROJET, "frontend", "public", "pwa-512x512.png"),
]

CAS_DIABETE = {
    "gender": "Male", "age": 58.0, "hypertension": 1, "heart_disease": 0,
    "smoking_history": "former", "bmi": 31.4, "HbA1c_level": 7.8,
    "blood_glucose_level": 185.0,
}

CAS_HYPERTENSION = {
    "male": 1, "age": 61.0, "education": 2.0, "currentSmoker": 1,
    "cigsPerDay": 20.0, "BPMeds": 0.0, "prevalentStroke": 0, "diabetes": 1,
    "totChol": 260.0, "BMI": 29.8, "heartRate": 82.0, "glucose": 155.0,
}

CAS_CHD = {
    "male": 1, "age": 61.0, "education": 2.0, "currentSmoker": 1,
    "cigsPerDay": 20.0, "BPMeds": 0.0, "prevalentStroke": 0, "prevalentHyp": 1,
    "diabetes": 1, "totChol": 260.0, "sysBP": 158.0, "diaBP": 96.0,
    "BMI": 29.8, "heartRate": 82.0, "glucose": 155.0,
}


def poster_json(url, charge):
    donnees = json.dumps(charge).encode()
    req = urllib.request.Request(
        url, data=donnees, headers={"Content-Type": "application/json"}, method="POST"
    )
    return _executer(req)


def poster_fichier(url, chemin, champ="image"):
    """Construit un corps multipart/form-data sans dependance externe."""
    limite = f"----claude{uuid.uuid4().hex}"
    nom = os.path.basename(chemin)
    type_mime = mimetypes.guess_type(nom)[0] or "application/octet-stream"
    with open(chemin, "rb") as f:
        contenu = f.read()

    corps = b"".join([
        f"--{limite}\r\n".encode(),
        f'Content-Disposition: form-data; name="{champ}"; filename="{nom}"\r\n'.encode(),
        f"Content-Type: {type_mime}\r\n\r\n".encode(),
        contenu,
        f"\r\n--{limite}--\r\n".encode(),
    ])
    req = urllib.request.Request(
        url, data=corps,
        headers={"Content-Type": f"multipart/form-data; boundary={limite}"},
        method="POST",
    )
    return _executer(req)


def _executer(req):
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return {"statut": r.status, "corps": json.loads(r.read().decode())}
    except urllib.error.HTTPError as e:
        return {"statut": e.code, "corps": e.read().decode()[:500]}
    except Exception as e:
        return {"statut": None, "erreur": f"{type(e).__name__}: {e}"}


def attendre_health(port, timeout=180):
    debut = time.time()
    while time.time() - debut < timeout:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=2) as r:
                return time.time() - debut, json.loads(r.read().decode())
        except Exception:
            time.sleep(0.25)
    raise TimeoutError(f"/health n'a pas repondu en {timeout}s")


def executer_campagne(port, label):
    base = f"http://127.0.0.1:{port}"
    env = dict(os.environ, TF_CPP_MIN_LOG_LEVEL="3", PYTHONIOENCODING="utf-8")
    serveur = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app",
         "--host", "127.0.0.1", "--port", str(port), "--log-level", "warning"],
        cwd=RACINE, env=env,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )

    resultats = {"label": label, "endpoints": {}}
    try:
        delai, sante = attendre_health(port)
        resultats["demarrage_s"] = round(delai, 1)
        resultats["endpoints"]["/health"] = {"statut": 200, "corps": sante}
        print(f"  /health                 -> {json.dumps(sante, ensure_ascii=False)}")

        for chemin, charge in (
            ("/predict/diabete", CAS_DIABETE),
            ("/predict/hypertension", CAS_HYPERTENSION),
            ("/predict/chd", CAS_CHD),
        ):
            r = poster_json(base + chemin, charge)
            resultats["endpoints"][chemin] = r
            print(f"  {chemin:23s} -> {r['statut']} {json.dumps(r.get('corps'), ensure_ascii=False)[:110]}")

        for image in IMAGES:
            cle = f"/predict/retinopathie[{os.path.basename(image)}]"
            if not os.path.exists(image):
                resultats["endpoints"][cle] = {"erreur": "image absente"}
                print(f"  {cle} -> image absente")
                continue
            r = poster_fichier(base + "/predict/retinopathie", image)
            resultats["endpoints"][cle] = r
            print(f"  {cle} -> {r['statut']} {json.dumps(r.get('corps'), ensure_ascii=False)[:160]}")

        image_ok = next((i for i in IMAGES if os.path.exists(i)), None)
        if image_ok:
            cle = f"/predict/complet[{os.path.basename(image_ok)}]"
            r = poster_fichier(base + "/predict/complet", image_ok)
            # La cle 'date' est un horodatage : non comparable d'un run a l'autre.
            if isinstance(r.get("corps"), dict):
                r["corps"].pop("date", None)
            resultats["endpoints"][cle] = r
            print(f"  {cle} -> {r['statut']} {json.dumps(r.get('corps'), ensure_ascii=False)[:160]}")
    finally:
        import psutil
        try:
            for enfant in psutil.Process(serveur.pid).children(recursive=True):
                enfant.kill()
        except Exception:
            pass
        serveur.kill()
        serveur.wait(timeout=10)

    return resultats


def comparer(chemin_a, chemin_b):
    a = json.load(open(chemin_a, encoding="utf-8"))
    b = json.load(open(chemin_b, encoding="utf-8"))
    cles = sorted(set(a["endpoints"]) | set(b["endpoints"]))

    print(f"AVANT : {a['label']}  (demarrage {a.get('demarrage_s')} s)")
    print(f"APRES : {b['label']}  (demarrage {b.get('demarrage_s')} s)\n")

    differences = 0
    for cle in cles:
        va, vb = a["endpoints"].get(cle), b["endpoints"].get(cle)
        if va == vb:
            print(f"  [IDENTIQUE] {cle}")
        else:
            differences += 1
            print(f"  [DIFFERENT] {cle}")
            print(f"      avant : {json.dumps(va, ensure_ascii=False)[:400]}")
            print(f"      apres : {json.dumps(vb, ensure_ascii=False)[:400]}")
    print(f"\n  {len(cles) - differences}/{len(cles)} reponses strictement identiques.")
    return 1 if differences else 0


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--port", type=int, default=8124)
    p.add_argument("--label", default="run")
    p.add_argument("--out")
    p.add_argument("--compare", nargs=2, metavar=("AVANT", "APRES"))
    args = p.parse_args()

    if args.compare:
        return comparer(*args.compare)

    print(f"=== CAMPAGNE ENDPOINTS [{args.label}] ===")
    resultats = executer_campagne(args.port, args.label)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(resultats, f, ensure_ascii=False, indent=2, sort_keys=True)
        print(f"\n  -> ecrit dans {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
