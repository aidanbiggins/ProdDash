# Oracle Engine: Mathematical Foundations

This document describes the rigorous mathematical foundations of the PlatoVue Oracle forecasting engine.

## Overview

The Oracle is a probabilistic hiring forecast system that predicts time-to-fill for requisitions. It combines:

1. **Bayesian inference** for parameter estimation under uncertainty
2. **Monte Carlo simulation** for outcome distribution
3. **Bootstrap resampling** for confidence interval estimation
4. **Proper quantile estimation** (Hyndman-Fan Type 7)

## 1. Bayesian Inference for Conversion Rates

### The Problem

We want to estimate the probability `p` that a candidate passes a given stage. With small samples, the empirical rate `successes/total` is unreliable.

### The Solution: Beta-Binomial Model

We use conjugate Bayesian inference:

**Prior:** Beta(α₀, β₀)

By default, α₀ = β₀ = 2 (weak uniform prior with slight regularization).

**Likelihood:** Binomial(n, p) where n = total candidates, k = successes

**Posterior:** Beta(α₀ + k, β₀ + n - k)

### Posterior Statistics

For Beta(α, β):

- **Mean:** E[p] = α / (α + β)
- **Variance:** Var[p] = αβ / [(α+β)²(α+β+1)]
- **95% Credible Interval:** [I⁻¹(0.025; α, β), I⁻¹(0.975; α, β)]

Where I⁻¹ is the inverse incomplete beta function.

### Shrinkage Effect

With small samples, the posterior mean is "shrunk" toward the prior mean (0.5):

```
Observed: 3/5 = 60%
With Beta(2,2) prior and n=5:
  Posterior = Beta(2+3, 2+2) = Beta(5, 4)
  Posterior mean = 5/9 = 55.6% (shrunk toward 50%)
```

This prevents overconfident predictions from noisy small samples.

## 2. Duration Modeling with Gamma Distributions

### The Problem

Stage durations are non-negative with right-skewed distributions. We need a flexible model that captures this.

### The Solution: Gamma Distribution

If X ~ Gamma(α, β):
- **Mean:** E[X] = α/β
- **Variance:** Var[X] = α/β²
- **Coefficient of Variation:** CV = 1/√α

### Method of Moments Fitting

Given observed durations with sample mean x̄ and variance s²:

- α̂ = x̄² / s²
- β̂ = x̄ / s²

### Sampling

We use the Marsaglia-Tsang method for shape ≥ 1, with Ahrens-Dieter transformation for shape < 1.

## 3. Monte Carlo Simulation

### Candidate Journey Model

For each simulation iteration:

1. Start at candidate's current stage
2. For each stage until HIRED:
   - Sample duration from Gamma(α, β)
   - Sample pass/fail from Beta posterior (Thompson Sampling)
   - If fail: candidate rejected (exit)
   - If pass: advance to next stage
3. Return total days to hire (or null if rejected)

### Pipeline-Aware "First Hire" Model

When multiple candidates are in pipeline:

```
For iteration i:
  minDays = ∞
  For each candidate:
    days = simulateCandidateJourney(candidate)
    if days ≠ null and days < minDays:
      minDays = days

  if minDays ≠ ∞:
    outcomes.push(minDays)
```

This models the reality that a req is filled when ANY candidate accepts.

### Thompson Sampling

Instead of using point estimates for conversion rates, we **sample** from the Beta posterior:

```typescript
passRate = sampleBeta(posterior.alpha, posterior.beta, rng)
```

This naturally propagates parameter uncertainty through the simulation.

## 4. Quantile Estimation (Hyndman-Fan Type 7)

### The Problem

Standard floor-based quantile calculation is imprecise:
```
Q(p) = x[floor(n*p)]  // Naive
```

### The Solution: Linear Interpolation

Hyndman-Fan Type 7 (R's default):

```
h = (n-1) * p
j = floor(h)
k = ceil(h)
γ = h - j

Q(p) = (1-γ)*x[j] + γ*x[k]
```

This provides smooth, interpolated quantile estimates.

## 5. Bootstrap Confidence Intervals

### The Problem

We want to quantify uncertainty in our percentile estimates.

### The Solution: Percentile Bootstrap

```
For b = 1 to B:
  sample = resample(simulatedDays, with_replacement=True)
  p10_b = quantile(sample, 0.10)
  p50_b = quantile(sample, 0.50)
  p90_b = quantile(sample, 0.90)

p10_CI = [percentile(p10_samples, 2.5), percentile(p10_samples, 97.5)]
```

With B=200 bootstrap samples, we get stable 95% confidence intervals.

## 6. Confidence Level Calculation

The system reports confidence as HIGH/MEDIUM/LOW/INSUFFICIENT based on:

1. **Minimum sample size** across all stages
2. **Success probability** (% of iterations that produced a hire)

```
if minSampleSize >= 20 and successProbability >= 0.8:
  return 'HIGH'
elif minSampleSize >= 10 and successProbability >= 0.5:
  return 'MEDIUM'
elif minSampleSize >= 5:
  return 'LOW'
else:
  return 'INSUFFICIENT'
```

## 7. Implementation Notes

### Numerical Stability

- **Log-gamma** uses Lanczos approximation for precision
- **Incomplete beta** uses continued fraction expansion
- **Inverse incomplete beta** uses bisection method for robustness
- All distributions use seeded RNG for reproducibility

### Performance

- Typical forecast: 1000 iterations × 5 candidates × 4 stages = 20K stage evaluations
- Bootstrap: 200 resamples × percentile calculation
- Total runtime: ~50-150ms on modern hardware

### File Locations

- Core engine: `/src/productivity-dashboard/services/oracleEngine.ts`
- Tests: `/src/productivity-dashboard/services/__tests__/oracleEngine.test.ts`
- Legacy bridge: `tolegacyForecastResult()` function

## 8. Configuration Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `iterations` | 1000 | Monte Carlo simulation runs |
| `bootstrapSamples` | 200 | Bootstrap resamples for CI |
| `priorStrength` | 2 | Beta prior pseudo-observations |
| `minSampleSize` | 5 | Threshold for cohort data usage |

## 9. Future Improvements

1. **Markov Chain Absorbing States**: Full transition matrix modeling
2. **M/M/c Queueing Theory**: Proper capacity constraint modeling
3. **Online Learning**: Adaptive weights from prediction errors
4. **Calibration via Isotonic Regression**: Post-hoc probability calibration

## References

- Gelman, A. et al. (2013). *Bayesian Data Analysis*, 3rd ed.
- Hyndman, R. J. & Fan, Y. (1996). Sample Quantiles in Statistical Packages.
- Marsaglia, G. & Tsang, W. W. (2000). A Simple Method for Generating Gamma Variables.
- Efron, B. & Tibshirani, R. J. (1993). *An Introduction to the Bootstrap*.
