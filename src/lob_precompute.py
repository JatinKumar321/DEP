"""
Offline LOB precompute — runs the full pipeline once and writes
lob_scan_cache.json with per-window stats + per-snapshot alarm scores.

Usage:
    python -m src.lob_precompute [--ref 300] [--test 30] [--basis 4] [--components 5]
"""

import argparse
import json
import os

import numpy as np

from src.lob_loader import LOBLoader
from src.lob_functionalizer import LOBFunctionalizer
from src.lob_embedder import LOBEmbedder
from src.lob_detector import LOBDetector


def precompute_lob_scan(
    ref_size: int = 300,
    test_size: int = 30,
    n_basis: int = 4,
    n_components: int = 5,
    alpha: float = 0.01,
    output_path: str | None = None,
) -> dict:
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    print("[1/5] Loading LOB data...")
    loader = LOBLoader(base_dir=base_dir)
    data = loader.load()
    print(f"       bid_vol shape: {data['bid_vol'].shape}")

    print("[2/5] Functionalizing (5 channels × 10 levels)...")
    fn = LOBFunctionalizer()
    channels = fn.transform(data["bid_vol"], data["ask_vol"])
    print(f"       channels shape: {channels.shape}")

    print(f"[3/5] Fitting LOBEmbedder on first {ref_size} snapshots (no leakage)...")
    embedder = LOBEmbedder(n_basis_per_channel=n_basis, n_components=n_components)
    embedder.fit(channels[:ref_size])
    latent = embedder.transform(channels)
    print(f"       latent shape: {latent.shape}")
    print(f"       variance explained: {embedder.pca.explained_variance_ratio_}")

    print("[4/5] Running sliding-window detector...")
    det = LOBDetector(ref_size=ref_size, test_size=test_size,
                      n_components=n_components, alpha=alpha)
    timeline = det.scan(latent)
    alarm = det.online_alarm_series(latent, ref_size=ref_size)
    print(f"       windows scanned: {len(timeline)}")

    print("[5/5] Building regime bands + writing cache...")
    regime_bands = []
    current = None
    for r in timeline:
        if r["is_regime_shift"]:
            if current is None:
                current = {"start": r["test_start"], "end": r["test_end"],
                           "max_t2": r["hotelling_t2"]}
            else:
                current["end"] = r["test_end"]
                current["max_t2"] = max(current["max_t2"], r["hotelling_t2"])
        else:
            if current is not None:
                current["duration"] = current["end"] - current["start"]
                regime_bands.append(current)
                current = None
    if current is not None:
        current["duration"] = current["end"] - current["start"]
        regime_bands.append(current)

    response = {
        "total_snapshots": int(latent.shape[0]),
        "windows_scanned": len(timeline),
        "ref_size": ref_size,
        "test_size": test_size,
        "n_components": n_components,
        "n_basis": n_basis,
        "alpha": alpha,
        "pca_variance_explained": [float(v) for v in embedder.pca.explained_variance_ratio_],
        "regime_bands": regime_bands,
        "timeline": timeline,
        "alarm_series": [float(a) for a in alarm],
    }

    output_path = output_path or os.path.join(base_dir, "lob_scan_cache.json")
    with open(output_path, "w") as f:
        json.dump(response, f)
    print(f"[✓] Wrote {output_path} ({len(regime_bands)} regime bands detected)")
    return response


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ref", type=int, default=300)
    ap.add_argument("--test", type=int, default=30)
    ap.add_argument("--basis", type=int, default=4)
    ap.add_argument("--components", type=int, default=5)
    ap.add_argument("--alpha", type=float, default=0.01)
    ap.add_argument("--out", type=str, default=None)
    args = ap.parse_args()
    precompute_lob_scan(
        ref_size=args.ref,
        test_size=args.test,
        n_basis=args.basis,
        n_components=args.components,
        alpha=args.alpha,
        output_path=args.out,
    )


if __name__ == "__main__":
    main()
