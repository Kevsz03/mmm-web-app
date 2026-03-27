
import statsmodels.api as sm
try:
    from statsmodels.tsa.recursive.recursive_ls import RecursiveLS
    print("RecursiveLS found in statsmodels.tsa.recursive.recursive_ls")
except ImportError:
    print("RecursiveLS NOT found in statsmodels.tsa.recursive.recursive_ls")

try:
    from statsmodels.tsa.api import RecursiveLS
    print("RecursiveLS found in statsmodels.tsa.api")
except ImportError:
    print("RecursiveLS NOT found in statsmodels.tsa.api")

from pydlm import dlm, trend, dynamic
d = dlm([1, 2, 3])
d = d + trend(degree=1, discount=0.9, name='trend')
d = d + dynamic(features=[[1], [2], [3]], discount=0.9, name='dyn')
d.fit()

print("\nPyDLM Methods:")
# print(dir(d))
try:
    states = d.getLatentState('trend')
    print(f"getLatentState('trend') type: {type(states)}, shape: {len(states)}")
    print(f"getLatentState('trend')[0]: {states[0]}")
except Exception as e:
    print(f"getLatentState('trend') failed: {e}")

try:
    states = d.getLatentState('dyn')
    print(f"getLatentState('dyn') type: {type(states)}, shape: {len(states)}")
    print(f"getLatentState('dyn')[0]: {states[0]}")
except Exception as e:
    print(f"getLatentState('dyn') failed: {e}")
