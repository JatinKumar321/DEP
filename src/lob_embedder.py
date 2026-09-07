"""
LOB Embedder — fits per-channel B-spline bases on the depth domain {1..10},
concatenates coefficient vectors across channels, and projects onto a
low-dimensional PCA latent space fit on a reference set only.

Pipeline per snapshot:
  channels (5, 10)
    → per-channel B-spline coefficients (5 * n_basis)
    → PCA projection → latent score (n_components,)

IMPORTANT: fit() must be called on reference snapshots only. transform()
applies the fitted basis/PCA to arbitrary future snapshots — no leakage.
"""

import numpy as np
from skfda.representation.grid import FDataGrid
from skfda.representation.basis import BSpline as SkfdaBSpline
from sklearn.decomposition import PCA


DOMAIN = (1.0, 10.0)
GRID = np.arange(1, 11, dtype=float)  # discrete levels 1..10


class LOBEmbedder:
    """
    Per-channel B-spline smoothing + PCA on concatenated coefficient vectors.
    """

    N_CHANNELS = 5

    def __init__(self, n_basis_per_channel: int = 4, n_components: int = 5):
        self.n_basis = int(n_basis_per_channel)
        self.n_components = int(n_components)
        self.basis = SkfdaBSpline(n_basis=self.n_basis, domain_range=DOMAIN)
        self.pca: PCA | None = None
        self.is_fitted = False
        self._fine_grid = np.linspace(DOMAIN[0], DOMAIN[1], 50)

    def _channel_to_coeffs(self, ch_matrix: np.ndarray) -> np.ndarray:
        """
        ch_matrix: (N, 10) values on grid {1..10}
        Returns:   (N, n_basis) B-spline coefficients
        """
        fd = FDataGrid(data_matrix=ch_matrix, grid_points=GRID)
        fd_basis = fd.to_basis(self.basis)
        coeffs = np.asarray(fd_basis.coefficients)  # (N, n_basis)
        return coeffs

    def _to_coefficients(self, channels: np.ndarray) -> np.ndarray:
        """
        channels: (N, 5, 10) → (N, 5*n_basis) concatenated coefficients.
        Separate B-spline fit per channel — no smoothing across channels.
        """
        if channels.ndim != 3 or channels.shape[1] != self.N_CHANNELS:
            raise ValueError(f"expected (N, {self.N_CHANNELS}, 10), got {channels.shape}")
        blocks = []
        for ch in range(self.N_CHANNELS):
            blocks.append(self._channel_to_coeffs(channels[:, ch, :]))
        return np.hstack(blocks)  # (N, 5*n_basis)

    def fit(self, channels: np.ndarray) -> "LOBEmbedder":
        """Fit PCA on reference channels only. channels: (N_ref, 5, 10)."""
        coeffs = self._to_coefficients(channels)
        # Guard: PCA n_components must be <= min(n_samples, n_features)
        max_comp = min(coeffs.shape[0], coeffs.shape[1])
        n_comp = min(self.n_components, max_comp)
        if n_comp < self.n_components:
            # Fall back to the largest possible component count for this reference.
            self.n_components = n_comp
        self.pca = PCA(n_components=self.n_components)
        self.pca.fit(coeffs)
        self.is_fitted = True
        return self

    def transform(self, channels: np.ndarray) -> np.ndarray:
        """Project channels (N, 5, 10) → latent scores (N, n_components)."""
        if not self.is_fitted or self.pca is None:
            raise RuntimeError("LOBEmbedder not fitted — call fit() first")
        coeffs = self._to_coefficients(channels)
        return self.pca.transform(coeffs)

    def fit_transform(self, channels: np.ndarray) -> np.ndarray:
        return self.fit(channels).transform(channels)

    def reconstruct_snapshot(self, channels_single: np.ndarray, n_eval: int = 50) -> dict:
        """
        Given a single snapshot's (5, 10) channel matrix, build a smooth
        reconstruction on a fine grid for visualization.

        Returns dict with 'grid' and one smoothed curve per channel.
        """
        if channels_single.shape != (self.N_CHANNELS, 10):
            raise ValueError(f"expected (5, 10), got {channels_single.shape}")

        fine_grid = np.linspace(DOMAIN[0], DOMAIN[1], n_eval)
        out = {"grid": fine_grid}
        names = ["bid_vol", "ask_vol", "cum_bid", "cum_ask", "imbalance"]
        for ch in range(self.N_CHANNELS):
            row = channels_single[ch].reshape(1, -1)
            fd = FDataGrid(data_matrix=row, grid_points=GRID)
            fd_basis = fd.to_basis(self.basis)
            fine = fd_basis.to_grid(fine_grid)
            out[names[ch]] = np.asarray(fine.data_matrix[0, :, 0])
        return out
