"""
measure_memory.py — Mesure l'empreinte memoire du backend au demarrage.

Lance uvicorn dans un sous-processus, attend que /health reponde, puis releve
la RSS du processus serveur (enfants compris). Sert a comparer avant/apres la
migration TensorFlow -> onnxruntime.

Usage :
    python measure_memory.py [--port 8123] [--label avant]
"""

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

import psutil

RACINE = os.path.dirname(os.path.abspath(__file__))


def rss_totale(processus):
    """RSS du processus + de tous ses enfants, en octets."""
    total = processus.memory_info().rss
    for enfant in processus.children(recursive=True):
        try:
            total += enfant.memory_info().rss
        except psutil.NoSuchProcess:
            pass
    return total


def attendre_health(port, timeout=180):
    """Interroge /health jusqu'a reponse ou expiration. Retourne (delai, payload)."""
    debut = time.time()
    url = f"http://127.0.0.1:{port}/health"
    while time.time() - debut < timeout:
        try:
            with urllib.request.urlopen(url, timeout=2) as r:
                return time.time() - debut, json.loads(r.read().decode())
        except Exception:
            time.sleep(0.25)
    raise TimeoutError(f"/health n'a pas repondu en {timeout}s")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--port", type=int, default=8123)
    p.add_argument("--label", default="mesure")
    args = p.parse_args()

    env = dict(os.environ, TF_CPP_MIN_LOG_LEVEL="3", PYTHONIOENCODING="utf-8")
    serveur = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app",
         "--host", "127.0.0.1", "--port", str(args.port), "--log-level", "warning"],
        cwd=RACINE, env=env,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )

    try:
        processus = psutil.Process(serveur.pid)
        delai, sante = attendre_health(args.port)

        # Deux relevés espacés : la RSS peut encore bouger juste apres le boot.
        rss_1 = rss_totale(processus)
        time.sleep(3)
        rss_2 = rss_totale(processus)

        print(f"=== EMPREINTE MEMOIRE AU DEMARRAGE [{args.label}] ===")
        print(f"  Python              : {sys.version.split()[0]}")
        print(f"  PID serveur         : {serveur.pid}")
        print(f"  Temps jusqu'a /health : {delai:.1f} s")
        print(f"  RSS a /health       : {rss_1 / 1024 / 1024:.1f} Mo")
        print(f"  RSS +3 s (stabilisee) : {rss_2 / 1024 / 1024:.1f} Mo")
        print(f"  Budget 512 Mo       : {100.0 * rss_2 / (512 * 1024 * 1024):.1f} % consomme")
        print(f"  /health             : {json.dumps(sante, ensure_ascii=False)}")
    finally:
        for enfant in psutil.Process(serveur.pid).children(recursive=True):
            try:
                enfant.kill()
            except psutil.NoSuchProcess:
                pass
        serveur.kill()
        serveur.wait(timeout=10)

    return 0


if __name__ == "__main__":
    sys.exit(main())
