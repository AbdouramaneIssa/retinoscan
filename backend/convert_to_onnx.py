"""
convert_to_onnx.py — Convertit chaque modele .keras de models/ en .onnx (tf2onnx).

Les fichiers .keras originaux ne sont JAMAIS modifies ni supprimes.
Les .onnx sont ecrits a cote, dans models/.

Usage :
    python convert_to_onnx.py [--opset 13] [--models-dir ./models]

--- Deux ecueils rencontres sur ce projet, et leur traitement ---

1) Keras 3 : tf2onnx.convert.from_keras() ne supporte que les modeles tf.keras
   (Keras 2). Ce projet tourne sous Keras 3.14 ; on passe donc par le tracage
   d'une tf.function (from_function), qui produit un graphe d'ops concret.

2) Normalization interne d'EfficientNet : la couche Normalization de
   efficientnetb0 detient mean/variance sous forme de tenseurs *captures* par
   la tf.function. tf2onnx ne les fige pas en constantes -- il les declare en
   ENTREES du graphe ONNX. Resultat : onnxruntime reclame
       'functional_1/efficientnetb0_1/normalization_1/Sub/y:0'
       'functional_1/efficientnetb0_1/normalization_1/Sqrt/x:0'
   en plus de l'image, et toute inference echoue.
   Contournement : apres conversion, on relit les valeurs reelles depuis les
   captures de la ConcreteFunction (dont les noms de tenseurs internes
   correspondent exactement aux noms des entrees fantomes ONNX), on les
   reinjecte comme initializers, et on retire les entrees fantomes du graphe.
   Aucune valeur n'est devinee : elles proviennent du modele trace lui-meme.
"""

import argparse
import os
import sys

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

# Console Windows en cp1252 : force UTF-8 pour les caracteres accentues/symboles.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

import numpy as np
import onnx
import tensorflow as tf
import tf2onnx
from onnx import numpy_helper

NOM_ENTREE = "input"


def input_signature_de(modele):
    """Construit la TensorSpec correspondant EXACTEMENT a la forme d'entree du modele."""
    shape = modele.input_shape
    if isinstance(shape, list):
        raise ValueError(
            f"Modele a entrees multiples ({len(shape)} entrees) — non gere par ce script."
        )
    # shape = (None, H, W, C) ; la dimension batch reste dynamique.
    dtype = getattr(modele, "input_dtype", None) or tf.float32
    return (tf.TensorSpec(tuple(shape), tf.as_dtype(dtype), name=NOM_ENTREE),)


def tracer(modele, spec):
    """Enveloppe le modele dans une tf.function tracee a la signature exacte."""

    @tf.function(input_signature=spec)
    def servir(x):
        return modele(x, training=False)

    return servir


def captures_non_ressources(fonction_concrete):
    """
    Valeurs des tenseurs captures par la tf.function, indexees par le nom du
    tenseur *interne* — c'est ce nom que tf2onnx reutilise pour ses entrees.
    Les captures de type resource (variables) sont ignorees : tf2onnx les fige
    correctement de son cote.
    """
    valeurs = {}
    for externe, interne in fonction_concrete.graph.captures:
        if externe.dtype == tf.resource:
            continue
        valeurs[interne.name] = np.asarray(externe)
    return valeurs


def figer_entrees_fantomes(chemin_onnx, valeurs_captures):
    """
    Transforme en initializers les entrees du graphe ONNX qui ne sont pas
    l'entree reelle du modele (ecueil n2 documente en tete de fichier).
    Retourne la liste des (nom, forme, valeurs) figes.
    """
    graphe = onnx.load(chemin_onnx)
    deja_init = {i.name for i in graphe.graph.initializer}
    fantomes = [
        vi for vi in graphe.graph.input
        if vi.name not in deja_init and vi.name != NOM_ENTREE
    ]
    if not fantomes:
        return []

    figes = []
    for vi in fantomes:
        if vi.name not in valeurs_captures:
            raise RuntimeError(
                f"Entree fantome sans valeur connue : {vi.name!r}. "
                f"Captures disponibles : {sorted(valeurs_captures)}"
            )
        tableau = np.asarray(valeurs_captures[vi.name], dtype=np.float32)
        graphe.graph.initializer.append(numpy_helper.from_array(tableau, vi.name))
        figes.append((vi.name, tuple(tableau.shape), tableau.ravel().tolist()))

    for vi in fantomes:
        graphe.graph.input.remove(vi)

    onnx.checker.check_model(graphe)
    onnx.save(graphe, chemin_onnx)
    return figes


def controler_entrees(chemin_onnx):
    """Verifie ce que le .onnx final expose reellement a onnxruntime."""
    import onnxruntime as ort

    session = ort.InferenceSession(chemin_onnx, providers=["CPUExecutionProvider"])
    entrees = [(e.name, e.shape) for e in session.get_inputs()]
    sorties = [(s.name, s.shape) for s in session.get_outputs()]
    return entrees, sorties


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--models-dir", default="./models")
    p.add_argument("--opset", type=int, default=13)
    args = p.parse_args()

    models_dir = args.models_dir
    fichiers = sorted(f for f in os.listdir(models_dir) if f.endswith(".keras"))

    if not fichiers:
        print(f"Aucun fichier .keras trouve dans {models_dir}")
        return 1

    print(f"TensorFlow {tf.__version__} | tf2onnx {tf2onnx.__version__} | opset {args.opset}")
    print(f"{len(fichiers)} modele(s) .keras detecte(s) dans {models_dir}\n")

    echecs = 0
    for nom in fichiers:
        chemin_keras = os.path.join(models_dir, nom)
        chemin_onnx = os.path.join(models_dir, nom[: -len(".keras")] + ".onnx")

        print(f"-- {nom}")
        try:
            modele = tf.keras.models.load_model(chemin_keras)
        except Exception as e:
            print(f"   [ECHEC] chargement Keras impossible : {type(e).__name__}: {e}\n")
            echecs += 1
            continue

        spec = input_signature_de(modele)
        print(f"   entree  : {tuple(spec[0].shape)} {spec[0].dtype.name}")
        print(f"   sortie  : {modele.output_shape}")

        try:
            fonction = tracer(modele, spec)
            valeurs = captures_non_ressources(fonction.get_concrete_function())
            tf2onnx.convert.from_function(
                fonction, input_signature=spec, opset=args.opset,
                output_path=chemin_onnx,
            )
            figes = figer_entrees_fantomes(chemin_onnx, valeurs)
            entrees, sorties = controler_entrees(chemin_onnx)
        except Exception as e:
            print(f"   [ECHEC] conversion : {type(e).__name__}: {e}\n")
            echecs += 1
            continue

        if figes:
            print(f"   [i] {len(figes)} entree(s) fantome(s) figee(s) en constantes "
                  f"(Normalization EfficientNet) :")
            for nom_f, forme, vals in figes:
                print(f"        {nom_f}  {forme} = {vals}")

        if len(entrees) != 1:
            print(f"   [ECHEC] le .onnx expose {len(entrees)} entrees : {entrees}\n")
            echecs += 1
            continue

        taille_k = os.path.getsize(chemin_keras) / 1e6
        taille_o = os.path.getsize(chemin_onnx) / 1e6
        print(f"   [OK] ecrit : {os.path.basename(chemin_onnx)}")
        print(f"   entree ONNX  : {entrees[0][0]} {entrees[0][1]}")
        print(f"   sortie ONNX  : {sorties[0][0]} {sorties[0][1]}")
        print(f"   taille  : .keras {taille_k:.1f} Mo -> .onnx {taille_o:.1f} Mo")
        print(f"   original intact : {os.path.exists(chemin_keras)}\n")

    return 1 if echecs else 0


if __name__ == "__main__":
    sys.exit(main())
