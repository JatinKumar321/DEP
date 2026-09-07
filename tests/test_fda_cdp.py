import unittest
import numpy as np
import sys
import os

# Ensure src can be imported
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.fda_cdp import AlphaGuardCDPEngine

class TestAlphaGuardCDPEngine(unittest.TestCase):
    def setUp(self):
        # Create dummy data: 50 days of historical data, 390 minutes each
        # Let's say normal days are just small random noise around 0
        np.random.seed(42)
        self.historical_data = np.cumsum(np.random.normal(0, 0.01, (50, 390)), axis=1)
        
        # Anomaly day starts normal, then crashes at minute 200
        self.anomaly_day = np.cumsum(np.random.normal(0, 0.01, 390))
        self.anomaly_day[200:] -= np.linspace(0, 2.0, 190) # Huge crash
        
        self.engine = AlphaGuardCDPEngine(n_basis=10, n_components=3, window_size=50)

    def test_baseline_fitting(self):
        self.engine.update_baseline(self.historical_data)
        self.assertTrue(self.engine.is_fitted)
        self.assertIsNotNone(self.engine.mean_scores)
        
    def test_anomaly_detection(self):
        self.engine.update_baseline(self.historical_data)

        # At minute 50, it should be normal
        normal_part = np.zeros(390)
        normal_part[:50] = self.anomaly_day[:50]
        t2, llr_step, p_val, day_scores, shift_size = self.engine.evaluate_day_cdp(normal_part)
        self.assertLess(t2, 500.0)  # Shouldn't register a massive Mahalanobis distance

        # By minute 300, it should be heavily anomalous
        anomalous_part = np.zeros(390)
        anomalous_part[:300] = self.anomaly_day[:300]
        t2_anom, llr_anom, p_anom, scores_anom, shift_anom = self.engine.evaluate_day_cdp(anomalous_part)
        self.assertGreater(t2_anom, t2)  # T² should rise on the crash relative to normal

if __name__ == '__main__':
    unittest.main()
