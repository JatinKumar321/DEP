import numpy as np
import matplotlib.pyplot as plt

# 1. Load the stationary functional data
intraday_returns = np.load("spy_returns_normalized.npy")
num_days, num_minutes = intraday_returns.shape

# 2. Engine Parameters
lookback_window = 50  # We use the last 50 days to form our "Expected Regime"
deviation_scores = np.zeros(num_days)
threshold_multiplier = 3.5 # Standard deviations above the mean to trigger an alert

# 3. The Functional CUSUM / L2 Norm Loop
print("Running Functional Regime Detection Engine...")

for t in range(lookback_window, num_days):
    # The 'Expected Shape' is the rolling functional mean of the past window
    rolling_baseline = np.mean(intraday_returns[t-lookback_window : t], axis=0)
    
    # The current day's actual shape
    current_curve = intraday_returns[t]
    
    # Calculate the L2 Norm (squared distance integrated over the 390 minutes)
    # We use np.trapz for numerical integration of the functional distance
    squared_diff = (current_curve - rolling_baseline)**2
    l2_distance = np.trapezoid(squared_diff) 
    
    deviation_scores[t] = l2_distance

# 4. Identify the Regime Shifts (Anomalies)
# We calculate a rolling threshold to adapt to general market conditions
thresholds = np.zeros(num_days)
for t in range(lookback_window + 20, num_days):
    past_scores = deviation_scores[t-20 : t]
    thresholds[t] = np.mean(past_scores) + (threshold_multiplier * np.std(past_scores))

# Find the exact days that broke the threshold
shift_days = [t for t in range(lookback_window + 20, num_days) if deviation_scores[t] > thresholds[t]]

# 5. Visualization: The Output of the Engine
plt.figure(figsize=(14, 6))

# Plot the raw L2 distance scores
plt.plot(deviation_scores, color='#1f77b4', label="Functional Deviation Score (L2 Norm)")

# Plot the dynamic threshold
plt.plot(thresholds, color='orange', linestyle='--', label="Dynamic Alert Threshold")

# Mark the Regime Shifts
for day in shift_days:
    plt.axvline(x=day, color='red', alpha=0.3, linewidth=1)

# Highlight the absolute craziest day in the dataset
max_anomaly_day = np.argmax(deviation_scores)
plt.axvline(x=max_anomaly_day, color='purple', linewidth=2, label=f"Max Structural Break (Day {max_anomaly_day})")

plt.title("AlphaGuard Engine: Detecting Structural Market Breaks")
plt.xlabel("Trading Day Index")
plt.ylabel("Functional Distance Score")
plt.legend()
plt.grid(True, alpha=0.3)
plt.tight_layout()
plt.show()

print(f"Total Regime Shifts Detected: {len(shift_days)}")
print(f"The most extreme structural break happened on Day: {max_anomaly_day}")