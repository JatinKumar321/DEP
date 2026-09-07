import numpy as np
import asyncio
import math
from src.fda_cdp import AlphaGuardCDPEngine

def sanitize_float(val):
    try:
        fval = float(val)
        if math.isnan(fval) or math.isinf(fval):
            return 0.0
        return fval
    except:
        return 0.0

class MarketSimulator:
    def __init__(self, data_path="spy_returns_normalized.npy", target_day=302, lookback=50, alpha=0.01, beta=0.05):
        self.data = np.load(data_path)
        self.target_day = target_day
        self.lookback = lookback
        
        # Initialize engine with rigorous mathematical parameters
        self.fda_engine = AlphaGuardCDPEngine(window_size=lookback, alpha=alpha, beta=beta)
        
        historical_chunk = self.data[self.target_day - self.lookback : self.target_day]
        self.fda_engine.update_baseline(historical_chunk)

        # Strategy State
        self.pnl_baseline = 0.0 # Buy and Hold
        self.pnl_fda = 0.0      # FDA-Adaptive Strategy
        self.in_position = True # FDA starts in position
        self.notional = 1000000 # $1M starting notional
        
        # Drawdown tracking
        self.peak_baseline = self.notional
        self.peak_fda = self.notional
        self.max_dd_baseline = 0.0
        self.max_dd_fda = 0.0

    async def stream_day(self, websocket):
        """
        Streams a single day minute-by-minute via Websocket.
        Evaluates FDA SPRT concurrently.
        """
        target_curve = self.data[self.target_day]
        current_day = np.zeros(390)

        # SPRT state tracker (Log Likelihood Ratio)
        sprt_log_lambda = 0.0
        cumulative_price = 0.0
        
        await websocket.send_json({
            "type": "baseline",
            "historical_mean": self.fda_engine.mean_scores.tolist() if self.fda_engine.mean_scores is not None else [],
            "target_day": self.target_day,
            "sprt_bounds": {
                "upper": sanitize_float(self.fda_engine.sprt_upper_bound),
                "lower": sanitize_float(self.fda_engine.sprt_lower_bound)
            }
        })

        for minute in range(1, 390):
            current_day[: minute + 1] = target_curve[: minute + 1]
            cumulative_price += target_curve[minute]
            
            # FDA Math (SPRT & P-Value)
            t2_score, llr_step, p_val, fpca_scores, shift_size = self.fda_engine.evaluate_day_cdp(current_day)
            
            # Accumulate Log Likelihood Ratio
            sprt_log_lambda += llr_step
            # Reset to zero if it drops to negative (continuous monitoring assumption)
            sprt_log_lambda = max(0.0, sprt_log_lambda)
            
            is_anomaly = sprt_log_lambda >= self.fda_engine.sprt_upper_bound

            # Safe list parsing for FPCA 
            safe_fpca = fpca_scores.tolist() if getattr(fpca_scores, "tolist", None) else fpca_scores
            if isinstance(safe_fpca, list):
                safe_fpca = [sanitize_float(v) for v in safe_fpca]
            else:
                safe_fpca = []

            # Simple Strategy Logic: 
            # If SPRT Anomaly is detected, 'Risk-Off' (Exit position)
            ret_step = target_curve[minute] - target_curve[minute-1]
            
            # Baseline always takes the return
            self.pnl_baseline += ret_step
            
            # FDA only takes return if in_position
            if self.in_position:
                self.pnl_fda += ret_step
                
            # Exit if anomaly triggered
            if is_anomaly:
                self.in_position = False
            
            # Track drawdowns
            val_baseline = self.notional * (1 + self.pnl_baseline)
            val_fda = self.notional * (1 + self.pnl_fda)
            self.peak_baseline = max(self.peak_baseline, val_baseline)
            self.peak_fda = max(self.peak_fda, val_fda)
            dd_baseline = (self.peak_baseline - val_baseline) / self.peak_baseline * 100 if self.peak_baseline > 0 else 0
            dd_fda = (self.peak_fda - val_fda) / self.peak_fda * 100 if self.peak_fda > 0 else 0
            self.max_dd_baseline = max(self.max_dd_baseline, dd_baseline)
            self.max_dd_fda = max(self.max_dd_fda, dd_fda)
            
            value_saved = val_fda - val_baseline

            payload = {
                "type": "tick",
                "minute": minute,
                "price": sanitize_float(target_curve[minute]),
                "cumulative_price": sanitize_float(cumulative_price),
                "t2_score": sanitize_float(t2_score),
                "sprt_llr": sanitize_float(sprt_log_lambda),
                "sprt_upper_bound": sanitize_float(self.fda_engine.sprt_upper_bound),
                "llr_step": sanitize_float(llr_step),
                "p_value": sanitize_float(p_val),
                "shift_size": sanitize_float(shift_size),
                "is_anomaly": bool(is_anomaly),
                "fpca_scores": safe_fpca,
                "strategy": {
                    "pnl_baseline_pct": sanitize_float(self.pnl_baseline * 100),
                    "pnl_fda_pct": sanitize_float(self.pnl_fda * 100),
                    "value_baseline": sanitize_float(val_baseline),
                    "value_fda": sanitize_float(val_fda),
                    "value_saved": sanitize_float(value_saved),
                    "max_dd_baseline": sanitize_float(self.max_dd_baseline),
                    "max_dd_fda": sanitize_float(self.max_dd_fda),
                    "in_position": self.in_position
                }
            }
            
            await websocket.send_json(payload)
            await asyncio.sleep(0.005)
