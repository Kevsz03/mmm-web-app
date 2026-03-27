
import statsmodels.api as sm
import inspect

print("Checking RecursiveLS...")
try:
    from statsmodels.tsa.recursive.recursive_ls import RecursiveLS
    print("Found in statsmodels.tsa.recursive.recursive_ls")
except ImportError:
    print("Not found in statsmodels.tsa.recursive.recursive_ls")

try:
    from statsmodels.tsa.statespace.recursive_ls import RecursiveLS
    print("Found in statsmodels.tsa.statespace.recursive_ls")
except ImportError:
    print("Not found in statsmodels.tsa.statespace.recursive_ls")

try:
    from statsmodels.tsa.api import RecursiveLS
    print("Found in statsmodels.tsa.api")
except ImportError:
    print("Not found in statsmodels.tsa.api")

print("\nChecking pydlm...")
from pydlm import dlm, trend, dynamic
d = dlm([1, 2, 3, 4, 5])
d = d + trend(degree=1, discount=0.9, name='trend')
d = d + dynamic(features=[[1], [2], [3], [4], [5]], discount=0.9, name='dyn')
d.fit()

print("pydlm fit complete.")

try:
    # Try getting latent state
    state = d.getLatentState(component='trend', filterType='forwardFilter')
    print(f"getLatentState('trend', 'forwardFilter') success. Shape: {len(state)}")
except Exception as e:
    print(f"getLatentState('trend', 'forwardFilter') failed: {e}")

try:
    # Try getting latent state
    state = d.getLatentState(component='trend', filterType='backwardSmoother')
    print(f"getLatentState('trend', 'backwardSmoother') success. Shape: {len(state)}")
except Exception as e:
    print(f"getLatentState('trend', 'backwardSmoother') failed: {e}")

# Check available methods on dlm object
methods = [func for func in dir(d) if callable(getattr(d, func)) and not func.startswith("__")]
print("\nAvailable methods on dlm object:", methods)
