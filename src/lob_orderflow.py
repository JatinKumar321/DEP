"""
LOB Order Flow extractor.

Since we only have snapshot data (no raw trade tape), we synthesize order
flow signals from snapshot-to-snapshot deltas using the
Cont–Kukanov–Stoikov OFI formulation:

    e_n^b = q_n^b * 1{P_n^b > P_{n-1}^b}
          + (q_n^b - q_{n-1}^b) * 1{P_n^b == P_{n-1}^b}
          - q_{n-1}^b * 1{P_n^b < P_{n-1}^b}

    e_n^a = -q_n^a * 1{P_n^a < P_{n-1}^a}
          + (q_{n-1}^a - q_n^a) * 1{P_n^a == P_{n-1}^a}
          + q_{n-1}^a * 1{P_n^a > P_{n-1}^a}

    OFI_n = e_n^b + e_n^a    (positive → buy pressure, negative → sell pressure)

We extend across all 10 levels (multi-level OFI) and build five derived
functional features that are FDA-friendly: smooth, bounded, with clear
regime-shift signatures.

  1. ofi(t)            : multi-level order-flow imbalance (signed)
  2. activity(t)       : magnitude of book changes per snapshot (proxy for
                         trade intensity; smoothed with Gaussian kernel)
  3. signed_flow(t)    : cumulative signed flow (rolling window normalized)
  4. buy_intensity(t)  : positive part of activity (buy-side aggression)
  5. sell_intensity(t) : negative part (sell-side aggression)
  6. joint(t)          : activity(t) * |imbalance(t)| — informed-trading proxy

All outputs are length-N (one value per snapshot), so they slot directly
into the existing FDA pipeline (B-spline → FPCA → CPD).
"""

import numpy as np


def _gaussian_smooth(x: np.ndarray, sigma: float = 5.0) -> np.ndarray:
    """1D Gaussian smoothing via direct convolution. Reflect-pad to avoid edge bias."""
    if sigma <= 0:
        return x.astype(float)
    radius = int(max(1, np.ceil(3 * sigma)))
    k = np.arange(-radius, radius + 1, dtype=float)
    kernel = np.exp(-0.5 * (k / sigma) ** 2)
    kernel /= kernel.sum()
    pad = np.pad(x.astype(float), radius, mode="reflect")
    return np.convolve(pad, kernel, mode="valid")


class OrderFlowExtractor:
    """
    Build 6 per-snapshot order-flow signals from raw LOB snapshots.

    Inputs (all (N, 10)):
      bid_vol, ask_vol, bid_price, ask_price
    Output dict (all (N,)):
      ofi, activity, signed_flow, buy_intensity, sell_intensity, joint
    """

    def __init__(self, smooth_sigma: float = 4.0, flow_window: int = 50):
        self.smooth_sigma = float(smooth_sigma)
        self.flow_window = int(flow_window)

    def extract(
        self,
        bid_vol: np.ndarray,
        ask_vol: np.ndarray,
        bid_price: np.ndarray,
        ask_price: np.ndarray,
    ) -> dict:
        N, L = bid_vol.shape
        if L != 10:
            raise ValueError(f"expected 10 levels, got {L}")

        # Multi-level OFI per Cont–Kukanov–Stoikov (2014).
        ofi = np.zeros(N, dtype=float)
        # We'll also track per-side activity here.
        bid_activity = np.zeros(N, dtype=float)
        ask_activity = np.zeros(N, dtype=float)

        for lvl in range(L):
            pb_now, pb_prev = bid_price[1:, lvl], bid_price[:-1, lvl]
            qb_now, qb_prev = bid_vol[1:, lvl], bid_vol[:-1, lvl]
            pa_now, pa_prev = ask_price[1:, lvl], ask_price[:-1, lvl]
            qa_now, qa_prev = ask_vol[1:, lvl], ask_vol[:-1, lvl]

            # Bid side e_n
            e_b = np.where(
                pb_now > pb_prev, qb_now,
                np.where(pb_now == pb_prev, qb_now - qb_prev, -qb_prev),
            )
            # Ask side e_n
            e_a = np.where(
                pa_now < pa_prev, -qa_now,
                np.where(pa_now == pa_prev, qa_prev - qa_now, qa_prev),
            )

            # Weight deeper levels less (level 0 is most informative)
            weight = 1.0 / (lvl + 1)
            ofi[1:] += weight * (e_b + e_a)
            bid_activity[1:] += np.abs(qb_now - qb_prev)
            ask_activity[1:] += np.abs(qa_now - qa_prev)

        # Activity = total book turnover (proxy for trade intensity since trades
        # are the primary driver of volume changes between snapshots).
        activity_raw = bid_activity + ask_activity
        activity = _gaussian_smooth(activity_raw, sigma=self.smooth_sigma)

        # Cumulative signed flow over a rolling window (zero-centred).
        cum = np.cumsum(ofi)
        w = self.flow_window
        signed_flow = np.zeros(N, dtype=float)
        if N > w:
            signed_flow[w:] = cum[w:] - cum[:-w]
        # Normalize by rolling activity so the curve stays bounded
        norm_act = np.maximum(activity_raw, 1e-6)
        rolling_act = np.zeros(N, dtype=float)
        cum_act = np.cumsum(norm_act)
        if N > w:
            rolling_act[w:] = cum_act[w:] - cum_act[:-w]
        signed_flow = signed_flow / np.maximum(rolling_act, 1.0)
        signed_flow = _gaussian_smooth(signed_flow, sigma=self.smooth_sigma)

        # Buy / sell intensity — split activity by sign of OFI.
        sign = np.sign(ofi)
        buy_raw = activity_raw * (sign > 0)
        sell_raw = activity_raw * (sign < 0)
        buy_intensity = _gaussian_smooth(buy_raw, sigma=self.smooth_sigma)
        sell_intensity = _gaussian_smooth(sell_raw, sigma=self.smooth_sigma)

        # Joint feature: activity × |imbalance|.
        # |imbalance| ∈ [0,1] is normalized aggressiveness; activity supplies
        # the magnitude. High joint = "many trades, one-sided" = informed flow.
        # Normalize activity to its 99th-pct so the feature stays in a clean range.
        denom = np.abs(bid_vol[:, 0]) + np.abs(ask_vol[:, 0]) + 1e-8
        l1_imb = np.abs((bid_vol[:, 0] - ask_vol[:, 0]) / denom)
        act_scale = max(np.percentile(activity, 99), 1e-6)
        joint = (activity / act_scale) * l1_imb

        return {
            "ofi": ofi,
            "activity": activity,
            "signed_flow": signed_flow,
            "buy_intensity": buy_intensity,
            "sell_intensity": sell_intensity,
            "joint": joint,
        }


def fpca_on_orderflow(features: dict, window_size: int = 200, stride: int = 50,
                      n_components: int = 3) -> dict:
    """
    Apply FPCA to fixed-length sliding windows of the 6 order-flow signals
    so we get a per-window latent embedding that complements the depth-based
    LOBEmbedder.

    Returns:
      indices  : (W,) starting snapshot index of each window
      latent   : (W, n_components) PCA scores (fit on first half — no leakage)
      var_exp  : (n_components,) variance explained
    """
    keys = ["ofi", "activity", "signed_flow", "buy_intensity", "sell_intensity", "joint"]
    series = np.stack([features[k] for k in keys], axis=1)  # (N, 6)
    N = series.shape[0]
    if N < window_size:
        return {"indices": [], "latent": np.zeros((0, n_components)), "var_exp": []}

    starts = list(range(0, N - window_size + 1, stride))
    W = len(starts)
    flat = np.zeros((W, window_size * 6), dtype=float)
    for i, s in enumerate(starts):
        flat[i] = series[s:s + window_size].flatten()

    # Fit PCA on first half only (no leakage)
    half = max(1, W // 2)
    from sklearn.decomposition import PCA
    pca = PCA(n_components=min(n_components, half, flat.shape[1]))
    pca.fit(flat[:half])
    latent = pca.transform(flat)

    return {
        "indices": starts,
        "latent": latent,
        "var_exp": pca.explained_variance_ratio_.tolist(),
    }
