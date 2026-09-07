import numpy as np
from src.fda_engine import AlphaGuardFDAEngine
from src.hmm_engine import HMMCompetitorEngine

def run_realtime_comparison(day_idx=302):
    data = np.load("spy_returns_normalized.npy")
    # Initialize both engines
    fda_eng = AlphaGuardFDAEngine(window_size=50)
    hmm_eng = HMMCompetitorEngine(window_size=50)
    
    # Calibrate baselines using the 50 days before the crash
    chunk = data[day_idx-50:day_idx]
    fda_eng.update_baseline(chunk)
    hmm_eng.update_baseline(chunk)
    
    print(f"{'Minute':<6} | {'FDA T^2':<10} | {'HMM Prob':<10} | {'Decision'}")
    print("-" * 55)
    
    current_day = np.zeros(390)
    # Stream data in 15-minute intervals
    for m in range(45, 390, 15):
        current_day[:m] = data[day_idx, :m]
        
        t2, _ = fda_eng.evaluate_day(current_day)
        prob = hmm_eng.evaluate_day(current_day)
        
        # Logic: FDA warns at 35, HMM warns at 0.30 probability
        if t2 > 35:
            decision = "🚨 FDA EXIT"
        elif prob > 0.30:
            decision = "⚠️ HMM EXIT"
        else:
            decision = "✅ HOLD"
            
        print(f"{m:<6} | {t2:<10.2f} | {prob:<10.2f} | {decision}")

if __name__ == "__main__":
    run_realtime_comparison()