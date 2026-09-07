"""
LOB Data Loader — parses Train_Dst_NoAuction_ZScore_CF_1.csv into
typed numpy arrays and caches them as .npy files for fast reloads.

CSV schema (149 columns):
  [0..39]   40 LOB cols: L{1..10}_{BidPrice,BidVolume,AskPrice,AskVolume}
  [40..79]  40 TI features: TI_Feature_41..80
  [80..143] 64 TS features: TS_Feature_81..144
  [144..148] 5 labels: Label_P1..P5

We only need the 40 LOB cols and 5 label cols for the FDA pipeline;
TI/TS are loaded but not used as core functional inputs (auxiliary only).
"""

import os
import numpy as np
import pandas as pd


CSV_FILENAME = "Train_Dst_NoAuction_ZScore_CF_1.csv"

BID_VOL_COLS = [f"L{i}_BidVolume" for i in range(1, 11)]
ASK_VOL_COLS = [f"L{i}_AskVolume" for i in range(1, 11)]
BID_PRC_COLS = [f"L{i}_BidPrice" for i in range(1, 11)]
ASK_PRC_COLS = [f"L{i}_AskPrice" for i in range(1, 11)]
LABEL_COLS = [f"Label_P{i}" for i in range(1, 6)]


class LOBLoader:
    """Loads and caches the LOB CSV, exposing typed numpy arrays."""

    def __init__(self, base_dir: str | None = None, cache: bool = True):
        self.base_dir = base_dir or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.csv_path = os.path.join(self.base_dir, CSV_FILENAME)
        self.cache_dir = os.path.join(self.base_dir, "lob_cache")
        self.cache = cache

    def _cache_file(self, name: str) -> str:
        return os.path.join(self.cache_dir, f"{name}.npy")

    def _all_cache_present(self) -> bool:
        names = ["bid_vol", "ask_vol", "bid_price", "ask_price", "labels"]
        return all(os.path.exists(self._cache_file(n)) for n in names)

    def load(self) -> dict:
        """
        Returns dict:
          bid_vol:   (N, 10) float64
          ask_vol:   (N, 10) float64
          bid_price: (N, 10) float64
          ask_price: (N, 10) float64
          labels:    (N, 5) int64
        """
        if self.cache and self._all_cache_present():
            return {
                "bid_vol": np.load(self._cache_file("bid_vol")),
                "ask_vol": np.load(self._cache_file("ask_vol")),
                "bid_price": np.load(self._cache_file("bid_price")),
                "ask_price": np.load(self._cache_file("ask_price")),
                "labels": np.load(self._cache_file("labels")),
            }

        if not os.path.exists(self.csv_path):
            raise FileNotFoundError(f"LOB CSV not found: {self.csv_path}")

        # Only read columns we need — keeps memory lean.
        needed = BID_VOL_COLS + ASK_VOL_COLS + BID_PRC_COLS + ASK_PRC_COLS + LABEL_COLS
        df = pd.read_csv(self.csv_path, usecols=needed)

        bid_vol = df[BID_VOL_COLS].to_numpy(dtype=np.float64)
        ask_vol = df[ASK_VOL_COLS].to_numpy(dtype=np.float64)
        bid_price = df[BID_PRC_COLS].to_numpy(dtype=np.float64)
        ask_price = df[ASK_PRC_COLS].to_numpy(dtype=np.float64)
        labels = df[LABEL_COLS].to_numpy(dtype=np.int64)

        if self.cache:
            os.makedirs(self.cache_dir, exist_ok=True)
            np.save(self._cache_file("bid_vol"), bid_vol)
            np.save(self._cache_file("ask_vol"), ask_vol)
            np.save(self._cache_file("bid_price"), bid_price)
            np.save(self._cache_file("ask_price"), ask_price)
            np.save(self._cache_file("labels"), labels)

        return {
            "bid_vol": bid_vol,
            "ask_vol": ask_vol,
            "bid_price": bid_price,
            "ask_price": ask_price,
            "labels": labels,
        }
