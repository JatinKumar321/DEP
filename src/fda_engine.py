import numpy as np
from skfda.representation.grid import FDataGrid
from skfda.representation.basis import BSpline
from skfda.preprocessing.dim_reduction import FPCA

class AlphaGuardFDAEngine:
    def __init__(self, n_basis=30, n_components=3, window_size=50):
        self.n_basis = n_basis
        self.n_components = n_components
        self.window_size = window_size
        # Define the basis once
        self.basis_obj = BSpline(n_basis=self.n_basis)
        self.fpca = FPCA(n_components=self.n_components)
        self.is_fitted = False
        
        self.mean_scores = None
        self.inv_cov = None

    def _get_active_domain(self, data_vector):
        """Identifies the last non-zero minute for real-time scaling."""
        non_zero_indices = np.where(data_vector != 0)[0]
        if len(non_zero_indices) == 0:
            return 389
        return max(30, non_zero_indices[-1])

    def update_baseline(self, historical_matrix):
        """Fits FPCA to the historical window."""
        grid_points = np.linspace(0, 389, historical_matrix.shape[1])
        
        # CORRECTED SYNTAX: Create FDataGrid first
        fd = FDataGrid(data_matrix=historical_matrix, grid_points=grid_points)
        
        # Smooth the data using the basis (Optional but recommended)
        fd_smoothed = fd.to_basis(self.basis_obj)
        
        # Compute Principal Components
        self.fpca.fit(fd_smoothed)
        scores = self.fpca.transform(fd_smoothed)
        
        # Calculate Mahalanobis Baseline
        self.mean_scores = np.mean(scores, axis=0)
        cov = np.cov(scores, rowvar=False)
        self.inv_cov = np.linalg.pinv(cov)
        self.is_fitted = True

    def evaluate_day(self, current_day_vector):
        """Evaluates a day (full or partial) against the baseline."""
        if not self.is_fitted:
            return 0.0, None

        grid_points = np.linspace(0, 389, len(current_day_vector))
        
        # Wrap input in FDataGrid and convert to basis representation
        fd_day = FDataGrid(data_matrix=[current_day_vector], grid_points=grid_points)
        fd_day_basis = fd_day.to_basis(self.basis_obj)
        
        # Transform into FPCA Score space
        day_scores = self.fpca.transform(fd_day_basis)[0]
        
        # Calculate Hotelling T^2
        diff = day_scores - self.mean_scores
        t_squared = diff.T @ self.inv_cov @ diff
        
        # Real-time completion scaling
        last_min = self._get_active_domain(current_day_vector)
        completion_ratio = (last_min + 1) / 390
        adjusted_t_squared = t_squared / completion_ratio

        return adjusted_t_squared, day_scores