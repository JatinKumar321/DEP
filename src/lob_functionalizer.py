"""
LOB Functionalizer — transforms raw LOB snapshots into multi-channel
functional objects over the depth-level domain {1..10}.

For each snapshot k, 5 channels over the discrete grid i ∈ {1,...,10}:
  f_k^b(i)  = bid volume at level i
  f_k^a(i)  = ask volume at level i
  g_k^b(i)  = cumulative bid depth Σ_{j≤i} f^b(j)
  g_k^a(i)  = cumulative ask depth Σ_{j≤i} f^a(j)
  h_k(i)    = level-wise imbalance (f^b(i) - f^a(i)) / (|f^b(i)| + |f^a(i)| + ε)

Microstructure scalars per snapshot are computed alongside for the UI.
"""

import numpy as np


EPSILON = 1e-8


class LOBFunctionalizer:
    """Turns raw (N, 10) bid/ask volume matrices into (N, 5, 10) channels."""

    LEVELS = np.arange(1, 11, dtype=float)

    def transform(self, bid_vol: np.ndarray, ask_vol: np.ndarray) -> np.ndarray:
        """
        bid_vol: (N, 10)
        ask_vol: (N, 10)
        Returns channels: (N, 5, 10) where
          channels[:, 0, :] = bid vol
          channels[:, 1, :] = ask vol
          channels[:, 2, :] = cum bid
          channels[:, 3, :] = cum ask
          channels[:, 4, :] = level-wise imbalance
        """
        if bid_vol.shape != ask_vol.shape:
            raise ValueError("bid_vol and ask_vol must share shape (N, 10)")
        if bid_vol.shape[1] != 10:
            raise ValueError(f"expected 10 levels, got {bid_vol.shape[1]}")

        cum_bid = np.cumsum(bid_vol, axis=1)
        cum_ask = np.cumsum(ask_vol, axis=1)

        denom = np.abs(bid_vol) + np.abs(ask_vol) + EPSILON
        imbalance = (bid_vol - ask_vol) / denom

        channels = np.stack([bid_vol, ask_vol, cum_bid, cum_ask, imbalance], axis=1)
        return channels  # (N, 5, 10)

    def microstructure(
        self,
        bid_vol: np.ndarray,
        ask_vol: np.ndarray,
        bid_price: np.ndarray,
        ask_price: np.ndarray,
    ) -> dict:
        """
        Per-snapshot scalar microstructure summaries.
        All arrays (N,10) input; returns (N,) arrays keyed by metric.
        """
        bid_mass = bid_vol.sum(axis=1)
        ask_mass = ask_vol.sum(axis=1)
        total_imb = (bid_mass - ask_mass) / (np.abs(bid_mass) + np.abs(ask_mass) + EPSILON)

        center_thickness = bid_vol[:, 0] + ask_vol[:, 0]

        cum_bid = np.cumsum(bid_vol, axis=1)
        cum_ask = np.cumsum(ask_vol, axis=1)
        depth_convexity_bid = cum_bid[:, 9] - 2.0 * cum_bid[:, 4]
        depth_convexity_ask = cum_ask[:, 9] - 2.0 * cum_ask[:, 4]

        spread_proxy = ask_price[:, 0] - bid_price[:, 0]

        return {
            "bid_mass": bid_mass,
            "ask_mass": ask_mass,
            "total_imbalance": total_imb,
            "center_thickness": center_thickness,
            "depth_convexity_bid": depth_convexity_bid,
            "depth_convexity_ask": depth_convexity_ask,
            "spread_proxy": spread_proxy,
        }
