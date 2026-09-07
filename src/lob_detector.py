"""
LOB Detector — change-point detection on latent LOB trajectories.

Statistics:
  1. Hotelling T²    — mean shift with pooled covariance
  2. Frobenius D_Σ  — covariance shift
  3. fANOVA F-stat  — between/within variance ratio
  4. Online alarm   — per-snapshot Mahalanobis distance vs rolling reference

Thresholding (three-layer):
  Layer 1 — AND criterion   : both T² p-value AND F p-value must be < α_adj
  Layer 2 — Bonferroni      : α_adj = α / n_windows (corrects for multiple testing)
  Layer 3 — Persistence     : window kept only if part of a run ≥ min_consecutive
"""

import math
import numpy as np
from scipy.stats import f as f_dist, chi2


def _safe_float(v) -> float:
    try:
        x = float(v)
        if math.isnan(x) or math.isinf(x):
            return 0.0
        return x
    except Exception:
        return 0.0


def _persistence_filter(flags: list, k: int) -> list:
    """Keep a True only if it belongs to a consecutive run of length >= k."""
    n = len(flags)
    result = [False] * n
    i = 0
    while i < n:
        if flags[i]:
            j = i
            while j < n and flags[j]:
                j += 1
            if j - i >= k:
                for m in range(i, j):
                    result[m] = True
            i = j
        else:
            i += 1
    return result


class LOBDetector:
    def __init__(
        self,
        ref_size: int = 300,
        test_size: int = 30,
        n_components: int = 5,
        alpha: float = 0.01,
        min_consecutive: int = 2,
        min_mahalanobis: float = 3.0,
    ):
        self.ref_size = int(ref_size)
        self.test_size = int(test_size)
        self.n_components = int(n_components)
        self.alpha = float(alpha)
        self.min_consecutive = int(min_consecutive)
        # Minimum normalized Mahalanobis distance d_M = sqrt(T² * N / (L*M))
        # between group means to declare a shift. Invariant to window sizes.
        # d_M=3 means a 3-sigma shift in latent space (only ~top 10% of windows).
        self.min_mahalanobis = float(min_mahalanobis)

    # ── Core window comparison ───────────────────────────────────
    def compute_window_stats(self, ref_scores: np.ndarray, test_scores: np.ndarray,
                             alpha_override: float | None = None) -> dict:
        """
        ref_scores:  (L, m)
        test_scores: (M, m)
        Returns dict of scalar regime statistics + preliminary verdict.

        is_regime_shift here uses the AND criterion (T² AND F both significant)
        under alpha_override (Bonferroni-corrected when called from scan).
        """
        alpha = alpha_override if alpha_override is not None else self.alpha

        L = ref_scores.shape[0]
        M = test_scores.shape[0]
        N = L + M
        p = min(self.n_components, ref_scores.shape[1])

        mu_r = ref_scores.mean(axis=0)
        mu_t = test_scores.mean(axis=0)

        cov_r = np.cov(ref_scores, rowvar=False) if L > 1 else np.eye(p)
        cov_t = np.cov(test_scores, rowvar=False) if M > 1 else np.eye(p)
        if cov_r.ndim < 2:
            cov_r = np.eye(p)
        if cov_t.ndim < 2:
            cov_t = np.eye(p)

        frobenius = float(np.linalg.norm(cov_t - cov_r, "fro"))

        # Hotelling T² (pooled-covariance form)
        diff = mu_t - mu_r
        pooled = ((L - 1) * cov_r + (M - 1) * cov_t) / max(N - 2, 1)
        try:
            inv_pooled = np.linalg.pinv(pooled)
        except Exception:
            inv_pooled = np.eye(p)
        t2 = float((L * M / max(N, 1)) * diff @ inv_pooled @ diff)

        # T² p-value via F conversion
        if N - p - 1 > 0:
            t2_f = t2 * (N - p - 1) / max(p * (N - 2), 1)
            try:
                t2_p = float(1.0 - f_dist.cdf(t2_f, p, N - p - 1))
            except Exception:
                t2_p = 1.0
        else:
            t2_p = float(1.0 - chi2.cdf(max(t2, 0.0), p))

        # fANOVA F-stat
        all_scores = np.vstack([ref_scores, test_scores])
        grand = all_scores.mean(axis=0)
        ssb = L * np.sum((mu_r - grand) ** 2) + M * np.sum((mu_t - grand) ** 2)
        ssw = np.sum((ref_scores - mu_r) ** 2) + np.sum((test_scores - mu_t) ** 2)
        df_b = 1
        df_w = max(N - 2, 1)
        f_stat = (ssb / df_b) / max(ssw / df_w, 1e-12)
        try:
            f_p = float(1.0 - f_dist.cdf(f_stat, df_b * p, df_w * p))
        except Exception:
            f_p = 1.0

        # Normalized Mahalanobis distance between group means (invariant to L, M).
        d_M = math.sqrt(t2 * N / max(L * M, 1))

        # AND criterion: both tests must clear the threshold AND effect size must be large.
        is_shift = bool(t2_p < alpha and f_p < alpha and d_M >= self.min_mahalanobis)

        return {
            "hotelling_t2": _safe_float(t2),
            "t2_p_value": _safe_float(t2_p),
            "mahalanobis_d": _safe_float(d_M),
            "frobenius_norm": _safe_float(frobenius),
            "f_stat": _safe_float(f_stat),
            "f_p_value": _safe_float(f_p),
            "is_regime_shift": is_shift,
            "ref_mean": [_safe_float(v) for v in mu_r],
            "test_mean": [_safe_float(v) for v in mu_t],
            "ref_cov": [[_safe_float(v) for v in row] for row in cov_r],
            "test_cov": [[_safe_float(v) for v in row] for row in cov_t],
            "n_ref": int(L),
            "n_test": int(M),
        }

    # ── Full dataset scan ────────────────────────────────────────
    def scan(self, latent: np.ndarray) -> list:
        """
        Slide a (ref, test) pair across the latent stream.

        Three-layer thresholding:
          1. AND criterion  — T² p AND F p both < α_adj
          2. Bonferroni     — α_adj = α / n_windows
          3. Persistence    — run of ≥ min_consecutive windows required
        """
        n = latent.shape[0]
        if n < self.ref_size + self.test_size:
            return []

        # Collect window index tuples first so we know n_windows for Bonferroni.
        window_args = []
        for test_start in range(self.ref_size, n - self.test_size + 1, self.test_size):
            ref_start = test_start - self.ref_size
            window_args.append((ref_start, test_start, test_start + self.test_size))

        n_windows = len(window_args)
        alpha_adj = self.alpha / max(n_windows, 1)  # Bonferroni per-test threshold

        raw_flags = []
        raw_entries = []
        for ref_start, test_start, test_end in window_args:
            metrics = self.compute_window_stats(
                latent[ref_start:test_start],
                latent[test_start:test_end],
                alpha_override=alpha_adj,
            )
            raw_flags.append(metrics["is_regime_shift"])
            raw_entries.append((ref_start, test_start, test_end, metrics))

        # Persistence filter
        persistent = _persistence_filter(raw_flags, self.min_consecutive)

        out = []
        for i, (ref_start, test_start, test_end, metrics) in enumerate(raw_entries):
            out.append({
                "ref_start": int(ref_start),
                "ref_end": int(test_start - 1),
                "test_start": int(test_start),
                "test_end": int(test_end - 1),
                "hotelling_t2": metrics["hotelling_t2"],
                "t2_p_value": metrics["t2_p_value"],
                "mahalanobis_d": metrics["mahalanobis_d"],
                "frobenius_norm": metrics["frobenius_norm"],
                "f_stat": metrics["f_stat"],
                "f_p_value": metrics["f_p_value"],
                "is_regime_shift": persistent[i],
                "alpha_adjusted": float(alpha_adj),
            })
        return out

    # ── Online per-snapshot alarm ───────────────────────────────
    def online_alarm_series(self, latent: np.ndarray, ref_size: int | None = None) -> np.ndarray:
        """
        Per-snapshot Mahalanobis² from the preceding ref_size rolling window.
        Output length matches latent.shape[0]; positions < ref_size are 0.
        """
        n = latent.shape[0]
        L = int(ref_size or self.ref_size)
        alarm = np.zeros(n, dtype=float)
        if n <= L:
            return alarm

        stride = max(1, L // 4)
        mu_r = None
        inv_r = None
        for k in range(L, n):
            if (k - L) % stride == 0:
                window = latent[k - L:k]
                mu_r = window.mean(axis=0)
                cov_r = np.cov(window, rowvar=False)
                if cov_r.ndim < 2:
                    cov_r = np.eye(latent.shape[1])
                cov_r = cov_r + 1e-6 * np.eye(cov_r.shape[0])
                try:
                    inv_r = np.linalg.pinv(cov_r)
                except Exception:
                    inv_r = np.eye(latent.shape[1])
            if mu_r is None or inv_r is None:
                continue
            diff = latent[k] - mu_r
            alarm[k] = float(diff @ inv_r @ diff)
        return alarm

    @staticmethod
    def online_alarm(z_k: np.ndarray, mu_ref: np.ndarray, inv_cov_ref: np.ndarray) -> float:
        diff = z_k - mu_ref
        return float(diff @ inv_cov_ref @ diff)
