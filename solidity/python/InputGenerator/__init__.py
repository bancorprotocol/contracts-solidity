from math import log


def UniformDistribution(minimumValue,maximumValue,samplesCount):
    return [minimumValue+n*(maximumValue-minimumValue)/(samplesCount-1) for n in range(samplesCount)]


def ExponentialDistribution(minimumValue,maximumValue,growthFactor):
    return [int(minimumValue*growthFactor**n) for n in range(int(log(float(maximumValue)/float(minimumValue),growthFactor))+1)]
