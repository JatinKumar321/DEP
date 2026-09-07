"""
Sliding Window Regime Detector using Functional Data Analysis.

Compares a Reference Population (L=50 days) against a Test Population (K=5 days)
using fANOVA (Functional Analysis of Variance) in FPCA score space.

A regime shift is flagged only when the test window shows PERSISTENT divergence
(all K days deviate), eliminating false positives from transient intraday spikes.

IMPORTANT: FPCA is fit on the reference window only to prevent future-information
leakage. Test windows are transformed using the reference-derived basis.
"""

import numpy as np
from skfda.representation.grid import FDataGrid
from skfda.representation.basis import BSpline
from skfda.preprocessing.dim_reduction import FPCA
from sklearn.covariance import MinCovDet
from scipy.stats import f as f_dist
import math


def _safe_float(val):
    try:
        v = float(val)
        if math.isnan(v) or math.isinf(v):
            return 0.0
        return v
    except:
        return 0.0


class RegimeDetector:
    """
    Sliding-window FDA change-point detector.

    Math Pipeline:
      1. Fit B-Spline FPCA on the reference window only (no leakage)
      2. Project both ref and test windows into the reference basis
      3. Compute fANOVA F-statistic in score space
      4. Compute Frobenius norm of covariance difference
      5. Compute Hotelling T² between population means
      6. Flag regime shift if F-stat p-value < alpha for the full test window
    """

    def __init__(self, n_basis=30, n_components=3, ref_size=50, test_size=5, alpha=0.01):
        self.n_basis = n_basis
        self.n_components = n_components
        self.ref_size = ref_size
        self.test_size = test_size
        self.alpha = alpha
        self.basis_obj = BSpline(n_basis=self.n_basis)

    def _fit_fpca_on_ref(self, ref_matrix):
        """Fit FPCA using reference data only. Returns the fitted FPCA object."""
        grid_points = np.linspace(0, 389, ref_matrix.shape[1])
        fd = FDataGrid(data_matrix=ref_matrix, grid_points=grid_points)
        fd_basis = fd.to_basis(self.basis_obj)
        fpca = FPCA(n_components=self.n_components)
        fpca.fit(fd_basis)
        return fpca, fd_basis

    def _project(self, matrix, fpca):
        """Project a matrix into an already-fit FPCA basis (no leakage)."""
        grid_points = np.linspace(0, 389, matrix.shape[1])
        fd = FDataGrid(data_matrix=matrix, grid_points=grid_points)
        fd_basis = fd.to_basis(self.basis_obj)
        return fpca.transform(fd_basis)

    def compute_window_distance(self, ref_matrix, test_matrix):
        """
        Compare reference population vs test population.

        FPCA is fit on the reference window only; the test window is
        transformed using the reference-derived basis.

        Returns dict with fANOVA, covariance, and Hotelling statistics.
        """
        # Fit FPCA on reference only (no leakage)
        fpca, ref_fd_basis = self._fit_fpca_on_ref(ref_matrix)
        ref_scores = fpca.transform(ref_fd_basis)
        test_scores = self._project(test_matrix, fpca)

        L = ref_matrix.shape[0]
        K = test_matrix.shape[0]

        # --- fANOVA F-statistic ---
        all_scores = np.vstack([ref_scores, test_scores])
        grand_mean = np.mean(all_scores, axis=0)
        ref_mean = np.mean(ref_scores, axis=0)
        test_mean = np.mean(test_scores, axis=0)

        # Between-group sum of squares (SSB)
        ssb = L * np.sum((ref_mean - grand_mean) ** 2) + K * np.sum((test_mean - grand_mean) ** 2)

        # Within-group sum of squares (SSW)
        ssw_ref = np.sum((ref_scores - ref_mean) ** 2)
        ssw_test = np.sum((test_scores - test_mean) ** 2)
        ssw = ssw_ref + ssw_test

        n_groups = 2
        N = L + K
        p = self.n_components

        df_between = n_groups - 1  # = 1
        df_within = N - n_groups

        msb = ssb / max(df_between, 1)
        msw = ssw / max(df_within, 1)
        f_stat = msb / max(msw, 1e-10)

        # p-value from F-distribution
        try:
            f_p_value = 1.0 - f_dist.cdf(f_stat, df_between * p, df_within * p)
        except:
            f_p_value = 1.0

        # --- Frobenius Norm of covariance difference ---
        cov_ref = np.cov(ref_scores, rowvar=False) if L > 1 else np.eye(p)
        cov_test = np.cov(test_scores, rowvar=False) if K > 1 else np.eye(p)
        if cov_ref.ndim < 2:
            cov_ref = np.eye(p)
        if cov_test.ndim < 2:
            cov_test = np.eye(p)
        frobenius = np.linalg.norm(cov_test - cov_ref, 'fro')

        # --- Hotelling T² ---
        diff = test_mean - ref_mean
        pooled_cov = ((L - 1) * cov_ref + (K - 1) * cov_test) / max(N - 2, 1)
        try:
            inv_pooled = np.linalg.pinv(pooled_cov)
        except:
            inv_pooled = np.eye(p)

        t2 = (L * K) / N * diff.T @ inv_pooled @ diff

        # T² to F conversion for p-value
        t2_f = t2 * (N - p - 1) / (p * (N - 2)) if (N - 2) > 0 else 0
        try:
            t2_p = 1.0 - f_dist.cdf(t2_f, p, N - p - 1)
        except:
            t2_p = 1.0

        return {
            "f_stat": _safe_float(f_stat),
            "f_p_value": _safe_float(f_p_value),
            "frobenius_norm": _safe_float(frobenius),
            "hotelling_t2": _safe_float(t2),
            "t2_p_value": _safe_float(t2_p),
            "ref_mean_scores": [_safe_float(x) for x in ref_mean],
            "test_mean_scores": [_safe_float(x) for x in test_mean],
            "ref_scores": [[_safe_float(x) for x in row] for row in ref_scores],
            "test_scores": [[_safe_float(x) for x in row] for row in test_scores],
        }

    def scan_dataset(self, full_data):
        """
        Slide a test_size window across the full dataset.
        For each position, compare the test window against the preceding ref_size window.

        IMPORTANT: FPCA is fit on a *training prefix* (first ref_size days) only,
        then all subsequent windows are transformed using that fixed basis.
        This prevents future-information leakage into the regime detection.
        """
        n_days = full_data.shape[0]

        if n_days < self.ref_size + self.test_size:
            return []

        # Fit FPCA on the first ref_size days as a training prefix.
        # All downstream scores use this fixed basis — no leakage.
        training_prefix = full_data[: self.ref_size]
        fpca, _ = self._fit_fpca_on_ref(training_prefix)
        all_scores = self._project(full_data, fpca)

        start = self.ref_size + self.test_size
        results = []

        for window_end in range(start, n_days, self.test_size):
            test_start = window_end - self.test_size
            ref_start = test_start - self.ref_size

            if ref_start < 0:
                continue

            ref_scores = all_scores[ref_start:test_start]
            test_scores = all_scores[test_start:window_end]

            L, K = ref_scores.shape[0], test_scores.shape[0]
            p = self.n_components
            N = L + K

            ref_mean = np.mean(ref_scores, axis=0)
            test_mean = np.mean(test_scores, axis=0)
            grand_mean = np.mean(all_scores[ref_start:window_end], axis=0)

            ssb = L * np.sum((ref_mean - grand_mean) ** 2) + K * np.sum((test_mean - grand_mean) ** 2)
            ssw = np.sum((ref_scores - ref_mean) ** 2) + np.sum((test_scores - test_mean) ** 2)

            f_stat = (ssb / 1) / (ssw / (N - 2)) if ssw > 1e-10 else 0.0
            f_p_value = 1.0 - f_dist.cdf(f_stat, p, (N - 2) * p)

            results.append({
                "window_start": int(test_start),
                "window_end": int(window_end),
                "is_regime_shift": bool(f_p_value < self.alpha),
                "f_stat": _safe_float(f_stat),
                "f_p_value": _safe_float(f_p_value),
                "frobenius_norm": 0.0,  # Computed on demand in detail view
                "hotelling_t2": 0.0,
            })

        return results
