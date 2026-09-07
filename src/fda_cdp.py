import numpy as np
from skfda.representation.grid import FDataGrid
from skfda.representation.basis import BSpline
from skfda.preprocessing.dim_reduction import FPCA
from sklearn.covariance import MinCovDet
from scipy.stats import chi2

class AlphaGuardCDPEngine:
    """
    Stationary Assumption Engine using Wald's Sequential Probability Ratio Test (SPRT).
    Utilizes Robust Covariance (MCD) to isolate historical outliers from the baseline distribution.
    Calculates precise p-values for continuous circuit-breaker risk management.
    """
    def __init__(self, n_basis=30, n_components=3, window_size=50, alpha=0.001, beta=0.1):
        self.n_basis = n_basis
        self.n_components = n_components
        self.window_size = window_size
        
        self.basis_obj = BSpline(n_basis=self.n_basis)
        self.fpca = FPCA(n_components=self.n_components)
        self.is_fitted = False
        
        # Robust Statistics
        self.mean_scores = None
        self.inv_cov = None

        # SPRT Tolerances
        # Alpha (Type I Error Rate) - Probability of false circuit breaker (e.g. 1%)
        # Beta (Type II Error Rate) - Probability of failing to breaker a crash (e.g. 5%)
        self.alpha = alpha
        self.beta = beta
        
        # Wald's Boundaries
        self.sprt_upper_bound = np.log((1 - self.beta) / self.alpha)
        self.sprt_lower_bound = np.log(self.beta / (1 - self.alpha))

        # We need an alternative hypothesis distribution for SPRT
        # The shift param acts as our severity threshold
        # We increase it so SPRT requires a massive, sustained break to trigger
        self.h1_mu_shift = 5.0

    def _get_active_domain(self, data_vector):
        """Identifies the last non-zero minute for real-time scaling."""
        non_zero_indices = np.where(data_vector != 0)[0]
        if len(non_zero_indices) == 0:
            return 389
        return max(30, non_zero_indices[-1])

    def update_baseline(self, historical_matrix):
        """
        Fits FPCA and uses Minimum Covariance Determinant (MCD) for robust covariance 
        to resist historical poisoning.
        """
        grid_points = np.linspace(0, 389, historical_matrix.shape[1])
        fd = FDataGrid(data_matrix=historical_matrix, grid_points=grid_points)
        fd_smoothed = fd.to_basis(self.basis_obj)
        
        self.fpca.fit(fd_smoothed)
        scores = self.fpca.transform(fd_smoothed)
        
        # Use MCD for Robust Covariance with Exception Handling
        try:
            robust_cov = MinCovDet(random_state=42).fit(scores)
            self.mean_scores = robust_cov.location_
            self.inv_cov = np.linalg.pinv(robust_cov.covariance_)
        except Exception as e:
            # Fallback to standard covariance if MCD fails (collinearity / identical samples)
            self.mean_scores = np.mean(scores, axis=0)
            cov = np.cov(scores, rowvar=False)
            self.inv_cov = np.linalg.pinv(cov)
        
        self.is_fitted = True

    def calculate_p_value(self, t_squared, df):
        """Returns the statistically rigorous p-value of viewing this Mahalanobis distance."""
        # T^2 under normality assumptions follows a Chi-Square distribution with df = n_components
        return 1.0 - chi2.cdf(t_squared, df)

    def calculate_log_likelihood_ratio(self, current_z_score):
        """
        Calculates the instantaneous log-likelihood ratio for SPRT.
        H0 (Stationary): z ~ N(0, 1)
        H1 (Crash): z ~ N(mu_shift, 1)
        """
        # pdf(z | H1) / pdf(z | H0) simplified for Guassian with unit variance
        # log(LR) = mu_shift * (z - mu_shift / 2)
        return self.h1_mu_shift * (current_z_score - (self.h1_mu_shift / 2.0))

    def evaluate_day_cdp(self, current_day_vector):
        """
        Evaluates a day incrementally.
        Returns the Adjusted T^2, the rigorous SPRT Log-Likelihood Ratio step, p_val, FPCA bounds, and shift_size.
        """
        if not self.is_fitted:
            return 0.0, 0.0, 1.0, np.zeros(self.n_components), 0.0

        grid_points = np.linspace(0, 389, len(current_day_vector))
        fd_day = FDataGrid(data_matrix=[current_day_vector], grid_points=grid_points)
        fd_day_basis = fd_day.to_basis(self.basis_obj)
        
        day_scores = self.fpca.transform(fd_day_basis)[0]
        diff = day_scores - self.mean_scores
        t_squared = diff.T @ self.inv_cov @ diff
        
        # Calculate Shift Size (L2 norm of the coefficient difference)
        shift_size = np.linalg.norm(diff)
        
        last_min = self._get_active_domain(current_day_vector)
        completion_ratio = (last_min + 1) / 390
        adjusted_t_squared = t_squared / completion_ratio

        # Calculate exact p-value
        p_val = self.calculate_p_value(adjusted_t_squared, df=self.n_components)
        
        # Approximate a Z-score equivalent from the p-value for the LLR test
        # Because we need a 1D scalar for standard SPRT
        from scipy.stats import norm
        # Cap to prevent inf
        clamped_p = max(1e-15, min(p_val, 1.0 - 1e-15))
        z_score_equiv = np.abs(norm.ppf(clamped_p))

        # single step LL ratio
        # We apply a slight decay to the step if it's not strongly anomalous to prevent slow creep
        llr_step = self.calculate_log_likelihood_ratio(z_score_equiv)
        if z_score_equiv < 1.0:
            llr_step -= 0.5 

        return adjusted_t_squared, llr_step, p_val, day_scores, shift_size
