
from pydlm import dlm
d = dlm([1, 2])
print("Help for getLatentState:")
help(d.getLatentState)
print("\nHelp for _getComponentMean:")
try:
    help(d._getComponentMean)
except:
    print("No help for _getComponentMean")
