import numpy as np
import json
import os
from src.fda_cdp import AlphaGuardCDPEngine

def generate_metadata():
    """
    Precomputes rigorous mathematical statistics for all days in the dataset.
    This replaces the naive volatility proxy with true Sequential Probability Ratio Test metrics.
    """
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_path = os.path.join(base_dir, "spy_returns_normalized.npy")
    
    print("Loading Dataset...")
    data = np.load(data_path)
    num_days = data.shape[0]
    lookback = 50
    
    metadata = []
    
    print(f"Precomputing SPRT Metrics for {num_days - lookback} days. This may take a moment...")
    
    for target_day in range(lookback, num_days):
        if target_day % 50 == 0:
            print(f"Processing day {target_day}/{num_days}...")
            
        historical_chunk = data[target_day - lookback : target_day]
        target_curve = data[target_day]
        
        # We need a fresh engine per day to avoid cross-contamination
        engine = AlphaGuardCDPEngine(window_size=lookback, alpha=0.01, beta=0.05)
        # Using a subset of the curve for speed if necessary, but this script runs offline
        engine.update_baseline(historical_chunk)
        
        sprt_log_lambda = 0.0
        max_sprt_llr = 0.0
        min_p_val = 1.0
        
        current_day = np.zeros(390)
        
        for minute in range(1, 390):
            current_day[: minute + 1] = target_curve[: minute + 1]
            t2, llr_step, p_val, day_scores, shift_size = engine.evaluate_day_cdp(current_day)
            
            sprt_log_lambda += llr_step
            sprt_log_lambda = max(0.0, sprt_log_lambda)
            
            if sprt_log_lambda > max_sprt_llr:
                max_sprt_llr = float(sprt_log_lambda)
            if p_val < min_p_val:
                min_p_val = float(p_val)
                
        metadata.append({
            "day": target_day,
            "final_return": float(target_curve[-1]),
            "max_sprt_llr": max_sprt_llr,
            "min_p_value": min_p_val,
            "sprt_upper_bound": float(engine.sprt_upper_bound)
        })
        
    out_path = os.path.join(base_dir, "sp_math_metadata.json")
    with open(out_path, 'w') as f:
        json.dump({
            "total_days": num_days,
            "valid_start": lookback,
            "days": metadata
        }, f)
        
    print(f"✅ Metadata saved to {out_path}")

if __name__ == "__main__":
    generate_metadata()
