import rdata
import numpy as np
import matplotlib.pyplot as plt

file_path = "SPYUS500.rda"
parsed = rdata.parser.parse_file(file_path)
converted = rdata.conversion.convert(parsed)

# It's just a dictionary!
obj = converted['SPYUS500']

print("--- Inspecting the Dictionary ---")
for key, value in obj.items():
    if hasattr(value, 'shape'):
        print(f"Found Key: '{key}' -> Shape: {value.shape} -> Size: {value.size}")

# Grab the data matrix
if 'data' in obj:
    # R stores it as (Minutes, Days).
    # We transpose (.T) to get (Days, Minutes) for Python
    curves = np.array(obj['data']).T
    
    print(f"\n✅ Target acquired! Final Python shape: {curves.shape}")
    
    # Save it natively so we NEVER run rdata again
    np.save("spy_data.npy", curves)
    print("🔥 Data secured in 'spy_data.npy'.")
    
    # Visual check
    plt.figure(figsize=(12, 6))
    plt.plot(curves[0], label="Day 1", alpha=0.7)
    plt.plot(curves[-1], label="Last Day", alpha=0.7)
    plt.plot(np.mean(curves, axis=0), color='black', linewidth=3, label="Historical Mean")
    plt.title(f"SPY500 Intraday Returns ({curves.shape[0]} Trading Days)")
    plt.xlabel("Minutes from Open")
    plt.ylabel("Cumulative Return")
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.show()
else:
    print("Keys found:", obj.keys())