"""
verify_onnx.py — Compare chaque modèle .keras à son .onnx converti.

Pour chaque paire (.keras, .onnx) :
  - génère N entrées aléatoires à la forme d'entrée exacte du modèle
  - les fait passer dans le modèle Keras ET dans le modèle ONNX
  - affiche l'écart absolu maximum entre les deux vecteurs de sortie
  - affiche le taux d'accord sur la classe prédite (argmax)

Le script affiche des chiffres bruts. Il ne conclut pas.

Usage :
    python verify_onnx.py [--n 20] [--seed 0] [--models-dir ./models]
"""

import argparse
import os
import sys

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

# Console Windows en cp1252 : force UTF-8 pour les caractères accentués/symboles.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

import numpy as np
import tensorflow as tf
import onnxruntime as ort


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--models-dir", default="./models")
    p.add_argument("--n", type=int, default=20, help="nombre d'entrées aléatoires")
    p.add_argument("--seed", type=int, default=0)
    args = p.parse_args()

    models_dir = args.models_dir
    fichiers = sorted(f for f in os.listdir(models_dir) if f.endswith(".keras"))

    if not fichiers:
        print(f"Aucun fichier .keras trouvé dans {models_dir}")
        return 1

    print(f"TensorFlow {tf.__version__} | onnxruntime {ort.__version__}")
    print(f"{args.n} entrées aléatoires par modèle | seed={args.seed}\n")

    manquants = 0
    for nom in fichiers:
        chemin_keras = os.path.join(models_dir, nom)
        chemin_onnx = os.path.join(models_dir, nom[: -len(".keras")] + ".onnx")

        print("=" * 70)
        print(f"Modèle : {nom}")
        print("=" * 70)

        if not os.path.exists(chemin_onnx):
            print(f"  ❌ .onnx absent : {os.path.basename(chemin_onnx)} "
                  f"— lancer convert_to_onnx.py d'abord\n")
            manquants += 1
            continue

        modele = tf.keras.models.load_model(chemin_keras)
        session = ort.InferenceSession(chemin_onnx, providers=["CPUExecutionProvider"])
        nom_entree = session.get_inputs()[0].name

        forme = tuple(modele.input_shape)
        forme_batch = (args.n,) + forme[1:]
        print(f"  forme d'entrée modèle : {forme}")
        print(f"  forme du lot de test  : {forme_batch}")
        print(f"  entrée ONNX           : {nom_entree} {session.get_inputs()[0].shape}")

        rng = np.random.default_rng(args.seed)
        # Plage large et centrée sur 0 : couvre le domaine des images prétraitées.
        X = rng.standard_normal(forme_batch).astype(np.float32) * 60.0

        sortie_keras = np.asarray(modele.predict(X, verbose=0), dtype=np.float64)
        sortie_onnx = np.asarray(session.run(None, {nom_entree: X})[0], dtype=np.float64)

        print(f"  sortie Keras          : {sortie_keras.shape}")
        print(f"  sortie ONNX           : {sortie_onnx.shape}")

        if sortie_keras.shape != sortie_onnx.shape:
            print("  ❌ formes de sortie différentes — comparaison impossible\n")
            manquants += 1
            continue

        ecarts = np.abs(sortie_keras - sortie_onnx)
        ecart_max = float(ecarts.max())
        ecart_moyen = float(ecarts.mean())
        ecart_max_par_entree = ecarts.reshape(args.n, -1).max(axis=1)

        argmax_keras = sortie_keras.reshape(args.n, -1).argmax(axis=1)
        argmax_onnx = sortie_onnx.reshape(args.n, -1).argmax(axis=1)
        accords = int((argmax_keras == argmax_onnx).sum())
        taux_accord = 100.0 * accords / args.n

        print()
        print(f"  Écart absolu MAXIMUM  : {ecart_max:.6e}")
        print(f"  Écart absolu moyen    : {ecart_moyen:.6e}")
        print(f"  Écart max par entrée  : min {ecart_max_par_entree.min():.3e} | "
              f"médiane {np.median(ecart_max_par_entree):.3e} | "
              f"max {ecart_max_par_entree.max():.3e}")
        print(f"  Accord argmax         : {accords}/{args.n} = {taux_accord:.1f} %")

        desaccords = np.flatnonzero(argmax_keras != argmax_onnx)
        if desaccords.size:
            print(f"  Entrées en désaccord  : {desaccords.tolist()}")
            for i in desaccords[:5]:
                print(f"    #{i}: keras argmax={argmax_keras[i]} "
                      f"(p={sortie_keras[i].max():.6f}) | "
                      f"onnx argmax={argmax_onnx[i]} (p={sortie_onnx[i].max():.6f})")
        print()

    return 1 if manquants else 0


if __name__ == "__main__":
    sys.exit(main())
