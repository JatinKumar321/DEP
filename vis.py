import numpy as np
import matplotlib.pyplot as plt

# 1. Load the normalized functional data
intraday_returns = np.load("spy_returns_normalized.npy")

# 2. Define the objects to plot
target_day = 302
single_curve = intraday_returns[target_day]
mean_baseline = np.mean(intraday_returns, axis=0)

# 3. Create the Functional Plot
plt.figure(figsize=(12, 6))

# Plot the "Normal" behavior
plt.plot(mean_baseline, color='black', linestyle='--', linewidth=2, label="Historical Mean (The 'Expected' Function)")

# Plot the "Anomalous" functional object
plt.plot(single_curve, color='red', linewidth=3, label=f"Day {target_day} (The 'Broken' Function)")

# Fill the area between them - this is what the L2 Norm measures!
plt.fill_between(range(390), single_curve, mean_baseline, color='red', alpha=0.1, label="Functional Deviation (L2 Area)")

# Formatting
plt.title(f"Visualizing a Functional Object: Structural Break on Day {target_day}", fontsize=14)
plt.xlabel("Minutes from Market Open", fontsize=12)
plt.ylabel("Cumulative % Return", fontsize=12)
plt.axhline(0, color='gray', linewidth=1, alpha=0.5)
plt.legend()
plt.grid(True, alpha=0.2)

plt.tight_layout()
plt.show()

print(f"Bhai, look at Day {target_day}. While the mean stays flat, this curve plunged nearly 2% and never recovered.")