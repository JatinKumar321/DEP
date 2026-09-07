from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import scipy.stats as stats
from scipy.stats import chi2
import json
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.fda_cdp import AlphaGuardCDPEngine
from src.regime_detector import RegimeDetector
from src.lob_loader import LOBLoader
from src.lob_functionalizer import LOBFunctionalizer
from src.lob_embedder import LOBEmbedder
from src.lob_detector import LOBDetector
from src.lob_orderflow import OrderFlowExtractor, fpca_on_orderflow
from app.simulator import MarketSimulator

app = FastAPI(title="Spectra V7 Dashboard API (SP500 + LOB)")


def _cors_settings():
    raw_origins = os.getenv("FRONTEND_ORIGINS", "*").strip()
    if raw_origins == "*":
        return {
            "allow_origins": ["*"],
            "allow_credentials": False,
            "allow_methods": ["*"],
            "allow_headers": ["*"],
        }

    origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    return {
        "allow_origins": origins or ["*"],
        "allow_credentials": bool(origins),
        "allow_methods": ["*"],
        "allow_headers": ["*"],
    }

app.add_middleware(
    CORSMiddleware,
    **_cors_settings(),
)

# Cache keyed by query parameters so different (ref_size, test_size, alpha)
# combinations don't clobber each other.
_scan_cache: dict = {}

# LOB caches — loaded once, reused across requests
_lob_cache: dict = {}
_lob_scan_cache: dict = {}


def _get_data_path():
    return os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "spy_returns_normalized.npy")


def _base_dir():
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _safe_float(val):
    try:
        v = float(val)
        if np.isnan(v) or np.isinf(v):
            return 0.0
        return v
    except Exception:
        return 0.0


@app.get("/")
def read_root():
    return {"status": "Spectra V7 API is running", "modes": ["sp500", "lob"]}


@app.on_event("startup")
async def startup_event():
    print("Pre-calculating SP500 regime scan...")
    regime_scan()
    print("SP500 scan complete and cached.")
    try:
        print("Pre-loading LOB dataset...")
        _get_lob_context()
        print("LOB context loaded.")
        print("Pre-calculating LOB regime scan (default params)...")
        lob_scan()
        print("LOB scan complete and cached.")
    except Exception as e:
        print(f"[WARN] LOB startup failed: {e}")


# ════════════════════════════════════════════════════════════════
# SP500 Endpoints
# ════════════════════════════════════════════════════════════════

@app.get("/api/regime/scan")
def regime_scan(ref_size: int = 50, test_size: int = 5, alpha: float = 0.01):
    """
    Full sliding-window scan across the SP500 dataset.
    Returns macro time-series of fANOVA distances and detected regime boundaries.
    Cache keyed by (ref_size, test_size, alpha).
    """
    cache_key = (ref_size, test_size, alpha)
    if cache_key in _scan_cache:
        return _scan_cache[cache_key]

    full_data = np.load(_get_data_path())
    detector = RegimeDetector(ref_size=ref_size, test_size=test_size, alpha=alpha)
    results = detector.scan_dataset(full_data)

    # Compute regime bands (consecutive windows flagged as shifts)
    regime_bands = []
    current_band = None
    for r in results:
        if r["is_regime_shift"]:
            if current_band is None:
                current_band = {"start": r["window_start"], "end": r["window_end"]}
            else:
                current_band["end"] = r["window_end"]
        else:
            if current_band is not None:
                regime_bands.append(current_band)
                current_band = None
    if current_band is not None:
        regime_bands.append(current_band)

    # Compute PnL for each regime band
    for band in regime_bands:
        s, e = band["start"], band["end"]
        band_returns = full_data[s:e, -1]
        band["benchmark_return_pct"] = float(np.sum(band_returns) * 100)
        band["fda_return_pct"] = 0.0
        band["value_saved_pct"] = float(-np.sum(band_returns) * 100)
        band["duration_days"] = e - s

    response = {
        "total_days": int(full_data.shape[0]),
        "windows_scanned": len(results),
        "regime_bands": regime_bands,
        "timeline": [{
            "window_start": r["window_start"],
            "window_end": r["window_end"],
            "f_stat": r["f_stat"],
            "f_p_value": r["f_p_value"],
            "frobenius_norm": r["frobenius_norm"],
            "hotelling_t2": r["hotelling_t2"],
            "is_regime_shift": r["is_regime_shift"],
        } for r in results]
    }

    _scan_cache[cache_key] = response
    return response


@app.get("/api/regime/window/{end_day}")
def regime_window_detail(end_day: int, ref_size: int = 50, test_size: int = 5):
    full_data = np.load(_get_data_path())
    n_days = full_data.shape[0]

    test_end = min(end_day + 1, n_days)
    test_start = max(test_end - test_size, 0)
    ref_end = test_start
    ref_start = max(ref_end - ref_size, 0)

    ref_matrix = full_data[ref_start:ref_end]
    test_matrix = full_data[test_start:test_end]

    detector = RegimeDetector(ref_size=ref_size, test_size=test_size)
    metrics = detector.compute_window_distance(ref_matrix, test_matrix)

    test_returns = full_data[test_start:test_end, -1]

    return {
        "window_start": int(test_start),
        "window_end": int(test_end - 1),
        "ref_start": int(ref_start),
        "ref_end": int(ref_end - 1),
        **metrics,
        "test_daily_returns": [float(r) for r in test_returns],
        "benchmark_cumulative_pct": float(np.sum(test_returns) * 100),
    }


@app.get("/api/curve/{day}")
def get_curve(day: int, n_basis: int = 30):
    from skfda.representation.grid import FDataGrid
    from skfda.representation.basis import BSpline

    full_data = np.load(_get_data_path())
    n_days = full_data.shape[0]

    if day < 0 or day >= n_days:
        return {"error": f"Day {day} is out of range [0, {n_days - 1}]"}

    raw = full_data[day]
    grid_points = np.linspace(0, 389, len(raw))

    fd = FDataGrid(data_matrix=raw.reshape(1, -1), grid_points=grid_points)
    basis = BSpline(n_basis=n_basis)
    fd_basis = fd.to_basis(basis)
    fd_smooth = fd_basis.to_grid(grid_points)
    smooth = fd_smooth.data_matrix[0, :, 0]

    return {
        "day": day,
        "n_points": len(raw),
        "grid_points": [float(g) for g in grid_points],
        "raw_curve": [float(v) for v in raw],
        "smooth_curve": [float(v) for v in smooth],
    }


@app.get("/api/days/metadata")
def get_days_metadata():
    base_dir = _base_dir()
    json_path = os.path.join(base_dir, "sp_math_metadata.json")

    if os.path.exists(json_path):
        with open(json_path, 'r') as f:
            return json.load(f)

    data = np.load(_get_data_path())
    num_days = data.shape[0]
    final_returns = data[:, -1]
    volatilities = np.std(data, axis=1)

    metadata = []
    for day_idx in range(50, num_days):
        metadata.append({
            "day": day_idx,
            "final_return": float(final_returns[day_idx]),
            "max_sprt_llr": float(volatilities[day_idx] * 10),
            "min_p_value": max(0.0001, 1.0 - float(volatilities[day_idx] * 50))
        })

    return {"total_days": num_days, "valid_start": 50, "days": metadata}


@app.get("/api/forensic/{day}")
def get_forensic_event(day: int, alpha: float = 0.001, beta: float = 0.1):
    base_dir = _base_dir()
    data_path = os.path.join(base_dir, "spy_returns_normalized.npy")
    full_data = np.load(data_path)

    if day >= len(full_data) or day < 50:
        return {"error": "Invalid day"}

    engine = AlphaGuardCDPEngine(alpha=alpha, beta=beta)
    historical_chunk = full_data[day - 50: day]
    engine.update_baseline(historical_chunk)

    target_curve = full_data[day]
    history = []
    anomaly_flagged = False
    flag_minute = -1
    sprt_log_lambda = 0.0

    for m in range(1, 390):
        current_day = np.zeros(390)
        current_day[:m + 1] = target_curve[:m + 1]
        t2_score, llr_step, p_val, fpca_scores, shift_size = engine.evaluate_day_cdp(current_day)
        sprt_log_lambda += llr_step
        sprt_log_lambda = max(0.0, sprt_log_lambda)
        is_anomaly = sprt_log_lambda >= engine.sprt_upper_bound
        safe_fpca = fpca_scores.tolist() if hasattr(fpca_scores, 'tolist') else list(fpca_scores)
        history.append({
            "minute": m, "price": float(target_curve[m]),
            "sprt_llr": float(sprt_log_lambda), "t2_score": float(t2_score),
            "p_value": float(p_val), "is_anomaly": bool(is_anomaly),
            "fpca_scores": [float(s) for s in safe_fpca]
        })
        if is_anomaly and not anomaly_flagged:
            anomaly_flagged = True
            flag_minute = m

    t_stat, p_val_t, levene_stat, p_val_levene = 0.0, 1.0, 0.0, 1.0
    pre_scores = [0.0] * 3
    post_scores = [0.0] * 3

    if anomaly_flagged and 30 < flag_minute < 360:
        pre_ret = target_curve[max(0, flag_minute - 30):flag_minute]
        post_ret = target_curve[flag_minute:min(390, flag_minute + 30)]
        try:
            t_stat, p_val_t = stats.ttest_ind(pre_ret, post_ret, equal_var=False)
            levene_stat, p_val_levene = stats.levene(pre_ret, post_ret)
        except Exception:
            pass
        pre_scores = history[flag_minute - 2]["fpca_scores"] if flag_minute > 1 else [0] * 3
        post_scores = history[-1]["fpca_scores"]
    else:
        pre_scores = history[59]["fpca_scores"] if len(history) > 59 else [0] * 3
        post_scores = history[-1]["fpca_scores"] if history else [0] * 3

    delta_scores = [post - pre for pre, post in zip(pre_scores, post_scores)]
    shift_size = float(np.linalg.norm(delta_scores))
    final_t2 = history[-1]["t2_score"] if history else 0.0
    chi2_p = float(1.0 - chi2.cdf(final_t2, engine.n_components))

    verdict = "STABLE REGIME"
    if anomaly_flagged:
        verdict = "VALIDATED STRUCTURAL BREAK" if (p_val_t < 0.05 or p_val_levene < 0.05) else "EARLY FLAG / FALSE ALARM"

    return {
        "day": day, "is_anomaly": anomaly_flagged,
        "flag_minute": flag_minute if anomaly_flagged else None,
        "t_stream": flag_minute if anomaly_flagged else None,
        "shift_size": shift_size,
        "t_stat_mean": float(t_stat) if not np.isnan(t_stat) else 0,
        "p_val_mean": float(p_val_t) if not np.isnan(p_val_t) else 1,
        "levene_stat_var": float(levene_stat) if not np.isnan(levene_stat) else 0,
        "p_val_var": float(p_val_levene) if not np.isnan(p_val_levene) else 1,
        "coefficient_deltas": delta_scores,
        "chi2_stat": float(final_t2), "chi2_df": engine.n_components, "chi2_p_value": chi2_p,
        "sprt_upper_bound": float(engine.sprt_upper_bound),
        "verdict": verdict,
        "history": [{"minute": h["minute"], "price": float(h["price"]),
                     "sprt_llr": float(h["sprt_llr"]), "t2_score": float(h["t2_score"]),
                     "p_value": float(h["p_value"])} for h in history]
    }


@app.websocket("/ws/market")
async def market_stream(websocket: WebSocket, day: int = 302, alpha: float = 0.001, beta: float = 0.1):
    await websocket.accept()
    data_path = _get_data_path()
    simulator = MarketSimulator(data_path=data_path, target_day=day, lookback=50, alpha=alpha, beta=beta)
    try:
        await simulator.stream_day(websocket)
    except WebSocketDisconnect:
        print(f"Disconnected from Day {day}")


# ════════════════════════════════════════════════════════════════
# LOB Endpoints
# ════════════════════════════════════════════════════════════════

def _get_lob_context():
    """Loads LOB data (cached). Returns dict with arrays + fitted embedder."""
    if _lob_cache:
        return _lob_cache

    loader = LOBLoader(base_dir=_base_dir())
    data = loader.load()  # dict: bid_vol, ask_vol, bid_price, ask_price, ti, ts, labels

    functionalizer = LOBFunctionalizer()
    channels = functionalizer.transform(
        bid_vol=data["bid_vol"], ask_vol=data["ask_vol"]
    )  # (N, 5, 10)

    microstructure = functionalizer.microstructure(
        bid_vol=data["bid_vol"], ask_vol=data["ask_vol"],
        bid_price=data["bid_price"], ask_price=data["ask_price"],
    )

    _lob_cache.update({
        "bid_vol": data["bid_vol"],
        "ask_vol": data["ask_vol"],
        "bid_price": data["bid_price"],
        "ask_price": data["ask_price"],
        "labels": data["labels"],
        "channels": channels,
        "microstructure": microstructure,
    })
    return _lob_cache


def _get_lob_latent(n_basis: int, n_components: int, ref_size: int):
    """
    Fit LOBEmbedder on first ref_size snapshots, transform full dataset.
    Cache keyed by (n_basis, n_components, ref_size).
    """
    key = ("latent", n_basis, n_components, ref_size)
    if key in _lob_cache:
        return _lob_cache[key]

    ctx = _get_lob_context()
    channels = ctx["channels"]  # (N, 5, 10)

    embedder = LOBEmbedder(n_basis_per_channel=n_basis, n_components=n_components)
    embedder.fit(channels[:ref_size])
    latent = embedder.transform(channels)  # (N, m)

    _lob_cache[key] = {
        "embedder": embedder,
        "latent": latent,
    }
    return _lob_cache[key]


@app.get("/api/lob/scan")
def lob_scan(ref_size: int = 300, test_size: int = 30, alpha: float = 0.01,
             n_basis: int = 4, n_components: int = 5, min_consecutive: int = 2,
             min_mahalanobis: float = 3.0):
    """
    Full sliding-window scan across the LOB dataset.
    Three-layer thresholding: AND criterion + Bonferroni + effect size + persistence.
    Cache keyed by all parameters.
    """
    key = (ref_size, test_size, alpha, n_basis, n_components, min_consecutive, min_mahalanobis)
    if key in _lob_scan_cache:
        return _lob_scan_cache[key]

    latent_ctx = _get_lob_latent(n_basis, n_components, ref_size)
    latent = latent_ctx["latent"]  # (N, m)

    detector = LOBDetector(ref_size=ref_size, test_size=test_size,
                           n_components=n_components, alpha=alpha,
                           min_consecutive=min_consecutive,
                           min_mahalanobis=min_mahalanobis)
    timeline = detector.scan(latent)
    alarm = detector.online_alarm_series(latent, ref_size=ref_size)

    # Regime bands
    regime_bands = []
    current = None
    for r in timeline:
        if r["is_regime_shift"]:
            if current is None:
                current = {"start": r["test_start"], "end": r["test_end"],
                           "max_t2": r["hotelling_t2"], "max_d_sigma": r["frobenius_norm"]}
            else:
                current["end"] = r["test_end"]
                current["max_t2"] = max(current["max_t2"], r["hotelling_t2"])
                current["max_d_sigma"] = max(current["max_d_sigma"], r["frobenius_norm"])
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
        "regime_bands": regime_bands,
        "timeline": timeline,
        "alarm_series": [_safe_float(a) for a in alarm],
    }

    response["min_consecutive"] = min_consecutive
    response["min_mahalanobis"] = min_mahalanobis
    response["alpha_adjusted"] = float(alpha / max(len(timeline), 1))
    _lob_scan_cache[key] = response
    return response


@app.get("/api/lob/snapshot/{idx}")
def lob_snapshot(idx: int, n_basis: int = 4, n_components: int = 5, ref_size: int = 300):
    """Single snapshot view: raw + smoothed depth, microstructure, latent, labels."""
    ctx = _get_lob_context()
    latent_ctx = _get_lob_latent(n_basis, n_components, ref_size)

    n = ctx["bid_vol"].shape[0]
    if idx < 0 or idx >= n:
        return {"error": f"idx out of range [0, {n - 1}]"}

    embedder = latent_ctx["embedder"]
    latent = latent_ctx["latent"]

    bid = ctx["bid_vol"][idx]
    ask = ctx["ask_vol"][idx]
    bid_p = ctx["bid_price"][idx]
    ask_p = ctx["ask_price"][idx]

    smooth = embedder.reconstruct_snapshot(ctx["channels"][idx], n_eval=50)
    ms = ctx["microstructure"]

    return {
        "snapshot_idx": int(idx),
        "raw": {
            "bid_vol": [_safe_float(v) for v in bid],
            "ask_vol": [_safe_float(v) for v in ask],
            "bid_price": [_safe_float(v) for v in bid_p],
            "ask_price": [_safe_float(v) for v in ask_p],
        },
        "smooth": {
            "grid": [_safe_float(g) for g in smooth["grid"]],
            "bid_vol": [_safe_float(v) for v in smooth["bid_vol"]],
            "ask_vol": [_safe_float(v) for v in smooth["ask_vol"]],
            "cum_bid": [_safe_float(v) for v in smooth["cum_bid"]],
            "cum_ask": [_safe_float(v) for v in smooth["cum_ask"]],
            "imbalance": [_safe_float(v) for v in smooth["imbalance"]],
        },
        "microstructure": {
            "bid_mass": _safe_float(ms["bid_mass"][idx]),
            "ask_mass": _safe_float(ms["ask_mass"][idx]),
            "total_imbalance": _safe_float(ms["total_imbalance"][idx]),
            "center_thickness": _safe_float(ms["center_thickness"][idx]),
            "depth_convexity_bid": _safe_float(ms["depth_convexity_bid"][idx]),
            "depth_convexity_ask": _safe_float(ms["depth_convexity_ask"][idx]),
            "spread_proxy": _safe_float(ms["spread_proxy"][idx]),
        },
        "latent_scores": [_safe_float(v) for v in latent[idx]],
        "labels": {
            "P1": int(ctx["labels"][idx, 0]),
            "P2": int(ctx["labels"][idx, 1]),
            "P3": int(ctx["labels"][idx, 2]),
            "P4": int(ctx["labels"][idx, 3]),
            "P5": int(ctx["labels"][idx, 4]),
        },
    }


@app.get("/api/lob/window/{end_idx}")
def lob_window(end_idx: int, ref_size: int = 300, test_size: int = 30,
               n_basis: int = 4, n_components: int = 5):
    """Detailed ref-vs-test window comparison."""
    ctx = _get_lob_context()
    latent_ctx = _get_lob_latent(n_basis, n_components, ref_size)
    latent = latent_ctx["latent"]
    n = latent.shape[0]

    test_end = min(end_idx + 1, n)
    test_start = max(test_end - test_size, 0)
    ref_end = test_start
    ref_start = max(ref_end - ref_size, 0)

    if ref_start >= ref_end or test_start >= test_end:
        return {"error": "insufficient data for window"}

    detector = LOBDetector(ref_size=ref_size, test_size=test_size, n_components=n_components)
    metrics = detector.compute_window_stats(latent[ref_start:ref_end], latent[test_start:test_end])

    bid_ref = ctx["bid_vol"][ref_start:ref_end]
    ask_ref = ctx["ask_vol"][ref_start:ref_end]
    bid_test = ctx["bid_vol"][test_start:test_end]
    ask_test = ctx["ask_vol"][test_start:test_end]

    ref_mean_bid = bid_ref.mean(axis=0)
    ref_mean_ask = ask_ref.mean(axis=0)
    test_mean_bid = bid_test.mean(axis=0)
    test_mean_ask = ask_test.mean(axis=0)

    # Label distributions in ref and test windows
    labels_ref = ctx["labels"][ref_start:ref_end]
    labels_test = ctx["labels"][test_start:test_end]
    label_dist_ref = _label_distributions(labels_ref)
    label_dist_test = _label_distributions(labels_test)
    kl = _kl_divergences(label_dist_test, label_dist_ref)

    return {
        "ref_start": int(ref_start),
        "ref_end": int(ref_end - 1),
        "test_start": int(test_start),
        "test_end": int(test_end - 1),
        **metrics,
        "ref_mean_bid_vol": [_safe_float(v) for v in ref_mean_bid],
        "ref_mean_ask_vol": [_safe_float(v) for v in ref_mean_ask],
        "test_mean_bid_vol": [_safe_float(v) for v in test_mean_bid],
        "test_mean_ask_vol": [_safe_float(v) for v in test_mean_ask],
        "delta_bid_vol": [_safe_float(t - r) for t, r in zip(test_mean_bid, ref_mean_bid)],
        "delta_ask_vol": [_safe_float(t - r) for t, r in zip(test_mean_ask, ref_mean_ask)],
        "ref_mean_latent": [_safe_float(v) for v in latent[ref_start:ref_end].mean(axis=0)],
        "test_mean_latent": [_safe_float(v) for v in latent[test_start:test_end].mean(axis=0)],
        "ref_latent_scores": [[_safe_float(x) for x in row] for row in latent[ref_start:ref_end]],
        "test_latent_scores": [[_safe_float(x) for x in row] for row in latent[test_start:test_end]],
        "label_distributions_ref": label_dist_ref,
        "label_distributions_test": label_dist_test,
        "kl_divergence": kl,
    }


def _label_distributions(labels: np.ndarray) -> dict:
    """Returns per-horizon dict {P1..P5: {classes, counts, probs}}."""
    out = {}
    horizons = ["P1", "P2", "P3", "P4", "P5"]
    for i, h in enumerate(horizons):
        col = labels[:, i]
        classes, counts = np.unique(col, return_counts=True)
        total = counts.sum()
        probs = counts / max(total, 1)
        out[h] = {
            "classes": [int(c) for c in classes],
            "counts": [int(c) for c in counts],
            "probs": [_safe_float(p) for p in probs],
        }
    return out


def _kl_divergences(dist_t: dict, dist_r: dict, eps: float = 1e-8) -> dict:
    """KL(P_test || P_ref) per horizon with support union."""
    out = {}
    for h in ["P1", "P2", "P3", "P4", "P5"]:
        t = dist_t[h]
        r = dist_r[h]
        support = sorted(set(t["classes"]) | set(r["classes"]))
        t_probs = {c: p for c, p in zip(t["classes"], t["probs"])}
        r_probs = {c: p for c, p in zip(r["classes"], r["probs"])}
        kl = 0.0
        for c in support:
            pt = t_probs.get(c, 0.0) + eps
            pr = r_probs.get(c, 0.0) + eps
            kl += pt * np.log(pt / pr)
        out[h] = _safe_float(kl)
    return out


@app.get("/api/lob/labels/{start_idx}/{end_idx}")
def lob_labels(start_idx: int, end_idx: int):
    ctx = _get_lob_context()
    n = ctx["labels"].shape[0]
    start_idx = max(0, int(start_idx))
    end_idx = min(n, int(end_idx))
    if start_idx >= end_idx:
        return {"error": "empty range"}

    labels = ctx["labels"][start_idx:end_idx]
    dist = _label_distributions(labels)

    entropy = {}
    dominant = {}
    eps = 1e-12
    for h in ["P1", "P2", "P3", "P4", "P5"]:
        probs = np.array(dist[h]["probs"])
        H = -np.sum(probs * np.log(probs + eps))
        entropy[h] = _safe_float(H)
        if len(dist[h]["classes"]) > 0:
            k = int(np.argmax(probs))
            dominant[h] = dist[h]["classes"][k]
        else:
            dominant[h] = 0
    return {
        "window": {"start": start_idx, "end": end_idx - 1},
        "count": int(end_idx - start_idx),
        "distributions": dist,
        "entropy": entropy,
        "dominant_label": dominant,
    }


@app.get("/api/lob/latent")
def lob_latent(start: int = 0, end: int = -1, stride: int = 1,
               n_basis: int = 4, n_components: int = 5, ref_size: int = 300):
    latent_ctx = _get_lob_latent(n_basis, n_components, ref_size)
    latent = latent_ctx["latent"]
    embedder = latent_ctx["embedder"]
    n = latent.shape[0]
    if end < 0 or end > n:
        end = n
    start = max(0, start)
    stride = max(1, stride)

    indices = list(range(start, end, stride))
    subset = latent[start:end:stride]

    return {
        "snapshot_indices": indices,
        "latent_scores": [[_safe_float(x) for x in row] for row in subset],
        "pca_variance_explained": [_safe_float(v) for v in embedder.pca.explained_variance_ratio_],
        "n_components": int(n_components),
    }


@app.get("/api/lob/microstructure")
def lob_microstructure(start: int = 0, end: int = -1, stride: int = 1):
    ctx = _get_lob_context()
    ms = ctx["microstructure"]
    n = ms["bid_mass"].shape[0]
    if end < 0 or end > n:
        end = n
    start = max(0, start)
    stride = max(1, stride)

    idx = list(range(start, end, stride))
    return {
        "snapshot_indices": idx,
        "bid_mass": [_safe_float(v) for v in ms["bid_mass"][start:end:stride]],
        "ask_mass": [_safe_float(v) for v in ms["ask_mass"][start:end:stride]],
        "total_imbalance": [_safe_float(v) for v in ms["total_imbalance"][start:end:stride]],
        "center_thickness": [_safe_float(v) for v in ms["center_thickness"][start:end:stride]],
        "spread_proxy": [_safe_float(v) for v in ms["spread_proxy"][start:end:stride]],
        "depth_convexity_bid": [_safe_float(v) for v in ms["depth_convexity_bid"][start:end:stride]],
        "depth_convexity_ask": [_safe_float(v) for v in ms["depth_convexity_ask"][start:end:stride]],
    }


@app.get("/api/lob/imbalance_grid")
def lob_imbalance_grid(start: int = 0, end: int = -1, stride: int = 1):
    """Returns level-by-snapshot imbalance matrix for heatmap viewing."""
    ctx = _get_lob_context()
    channels = ctx["channels"]  # (N, 5, 10); channel 4 = imbalance
    n = channels.shape[0]
    if end < 0 or end > n:
        end = n
    start = max(0, start)
    stride = max(1, stride)

    imb = channels[start:end:stride, 4, :]  # (n_sub, 10)
    idx = list(range(start, end, stride))
    return {
        "snapshot_indices": idx,
        "levels": [int(i) for i in range(1, 11)],
        "imbalance_matrix": [[_safe_float(v) for v in row] for row in imb],
    }


@app.get("/api/lob/metadata")
def lob_metadata():
    """Compact per-snapshot metadata for the timeline minimap / heatmaps."""
    ctx = _get_lob_context()
    ms = ctx["microstructure"]
    return {
        "total_snapshots": int(ctx["bid_vol"].shape[0]),
        "n_lob_levels": 10,
        "n_channels": 5,
        "n_label_horizons": 5,
    }


# ════════════════════════════════════════════════════════════════
# Order Flow Endpoints (Cont–Kukanov–Stoikov OFI from snapshot deltas)
# ════════════════════════════════════════════════════════════════

def _get_orderflow(smooth_sigma: float = 4.0, flow_window: int = 50):
    """Cached order-flow features for the full dataset."""
    key = ("orderflow", smooth_sigma, flow_window)
    if key in _lob_cache:
        return _lob_cache[key]

    ctx = _get_lob_context()
    ext = OrderFlowExtractor(smooth_sigma=smooth_sigma, flow_window=flow_window)
    feats = ext.extract(
        bid_vol=ctx["bid_vol"],
        ask_vol=ctx["ask_vol"],
        bid_price=ctx["bid_price"],
        ask_price=ctx["ask_price"],
    )
    _lob_cache[key] = feats
    return feats


@app.get("/api/lob/orderflow")
def lob_orderflow(start: int = 0, end: int = -1, stride: int = 1,
                  smooth_sigma: float = 4.0, flow_window: int = 50):
    """
    Per-snapshot order-flow signals: OFI, activity, signed flow,
    buy/sell intensity, joint feature.
    """
    feats = _get_orderflow(smooth_sigma, flow_window)
    n = feats["ofi"].shape[0]
    if end < 0 or end > n:
        end = n
    start = max(0, start)
    stride = max(1, stride)

    idx = list(range(start, end, stride))
    return {
        "snapshot_indices": idx,
        "ofi": [_safe_float(v) for v in feats["ofi"][start:end:stride]],
        "activity": [_safe_float(v) for v in feats["activity"][start:end:stride]],
        "signed_flow": [_safe_float(v) for v in feats["signed_flow"][start:end:stride]],
        "buy_intensity": [_safe_float(v) for v in feats["buy_intensity"][start:end:stride]],
        "sell_intensity": [_safe_float(v) for v in feats["sell_intensity"][start:end:stride]],
        "joint": [_safe_float(v) for v in feats["joint"][start:end:stride]],
    }


@app.get("/api/lob/orderflow/window")
def lob_orderflow_window(center: int, halfwindow: int = 100,
                         smooth_sigma: float = 4.0, flow_window: int = 50):
    """
    Centred slice for B-spline / curve visualization, with a smooth
    reconstruction of each signal over the window.
    """
    feats = _get_orderflow(smooth_sigma, flow_window)
    n = feats["ofi"].shape[0]
    s = max(0, center - halfwindow)
    e = min(n, center + halfwindow + 1)
    if s >= e:
        return {"error": "empty window"}

    keys = ["ofi", "activity", "signed_flow", "buy_intensity", "sell_intensity", "joint"]
    out = {"start": int(s), "end": int(e - 1), "center": int(center),
           "snapshot_indices": list(range(s, e))}
    for k in keys:
        seg = feats[k][s:e]
        out[k] = [_safe_float(v) for v in seg]
    # Summary stats
    out["summary"] = {
        "ofi_mean": _safe_float(np.mean(feats["ofi"][s:e])),
        "ofi_std": _safe_float(np.std(feats["ofi"][s:e])),
        "activity_max": _safe_float(np.max(feats["activity"][s:e])),
        "joint_max": _safe_float(np.max(feats["joint"][s:e])),
        "signed_flow_end": _safe_float(feats["signed_flow"][e - 1]),
    }
    return out


@app.get("/api/lob/orderflow/fpca")
def lob_orderflow_fpca(window_size: int = 200, stride: int = 50,
                       n_components: int = 3,
                       smooth_sigma: float = 4.0, flow_window: int = 50):
    """
    FPCA on sliding windows of the order-flow signal stack — gives a
    flow-only latent embedding complementing the depth-based LOBEmbedder.
    """
    feats = _get_orderflow(smooth_sigma, flow_window)
    res = fpca_on_orderflow(feats, window_size=window_size,
                            stride=stride, n_components=n_components)
    return {
        "window_size": int(window_size),
        "stride": int(stride),
        "n_components": int(n_components),
        "snapshot_indices": [int(i) for i in res["indices"]],
        "latent": [[_safe_float(x) for x in row] for row in res["latent"]],
        "variance_explained": [_safe_float(v) for v in res["var_exp"]],
    }


# ════════════════════════════════════════════════════════════════
# Live Streaming WebSocket
# ════════════════════════════════════════════════════════════════

import asyncio  # noqa: E402

@app.websocket("/ws/lob/stream")
async def lob_live_stream(websocket: WebSocket, start_idx: int = 300, speed: float = 20.0,
                          ref_size: int = 300, n_basis: int = 4, n_components: int = 5):
    """
    Replays the LOB dataset as a live stream. For each snapshot:
      - rolling reference Mahalanobis² alarm
      - current OFI, intensity, imbalance, spread
      - structured packet for the trading-terminal-style UI

    Speed is snapshots-per-second. The rolling reference statistics are
    recomputed every ref_size//4 steps for performance.
    """
    await websocket.accept()
    ctx = _get_lob_context()
    latent_ctx = _get_lob_latent(n_basis, n_components, ref_size)
    feats = _get_orderflow()

    latent = latent_ctx["latent"]
    bid_vol = ctx["bid_vol"]; ask_vol = ctx["ask_vol"]
    bid_price = ctx["bid_price"]; ask_price = ctx["ask_price"]
    ms = ctx["microstructure"]
    n = latent.shape[0]
    p = latent.shape[1]

    L = max(50, int(ref_size))
    start_idx = max(L, min(n - 1, int(start_idx)))
    speed = max(1.0, min(200.0, float(speed)))
    delay = 1.0 / speed
    refresh_every = max(1, L // 4)

    threshold_99 = float(chi2.ppf(0.99, p))
    threshold_999 = float(chi2.ppf(0.999, p))

    # Pre-fit rolling reference at start_idx
    def fit_reference(k):
        win = latent[k - L:k]
        mu = win.mean(axis=0)
        cov = np.cov(win, rowvar=False)
        if cov.ndim < 2:
            cov = np.eye(p)
        cov = cov + 1e-6 * np.eye(p)
        try:
            inv = np.linalg.pinv(cov)
        except Exception:
            inv = np.eye(p)
        return mu, inv

    mu_r, inv_r = fit_reference(start_idx)

    try:
        idx = start_idx
        while idx < n:
            if (idx - start_idx) % refresh_every == 0:
                mu_r, inv_r = fit_reference(idx)

            diff = latent[idx] - mu_r
            alarm = float(diff @ inv_r @ diff)

            best_bid = float(bid_price[idx, 0])
            best_ask = float(ask_price[idx, 0])
            spread = best_ask - best_bid

            severity = "ok"
            if alarm > threshold_999:
                severity = "critical"
            elif alarm > threshold_99:
                severity = "warning"

            packet = {
                "type": "tick",
                "idx": int(idx),
                "alarm": _safe_float(alarm),
                "threshold_warn": threshold_99,
                "threshold_crit": threshold_999,
                "severity": severity,
                "best_bid": best_bid,
                "best_ask": best_ask,
                "spread": _safe_float(spread),
                "bid_vol": [_safe_float(v) for v in bid_vol[idx]],
                "ask_vol": [_safe_float(v) for v in ask_vol[idx]],
                "bid_price": [_safe_float(v) for v in bid_price[idx]],
                "ask_price": [_safe_float(v) for v in ask_price[idx]],
                "ofi": _safe_float(feats["ofi"][idx]),
                "activity": _safe_float(feats["activity"][idx]),
                "signed_flow": _safe_float(feats["signed_flow"][idx]),
                "joint": _safe_float(feats["joint"][idx]),
                "imbalance": _safe_float(ms["total_imbalance"][idx]),
                "bid_mass": _safe_float(ms["bid_mass"][idx]),
                "ask_mass": _safe_float(ms["ask_mass"][idx]),
                "latent": [_safe_float(x) for x in latent[idx]],
            }
            await websocket.send_json(packet)
            await asyncio.sleep(delay)
            idx += 1
    except WebSocketDisconnect:
        return
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=os.getenv("UVICORN_RELOAD", "true").lower() == "true",
    )
