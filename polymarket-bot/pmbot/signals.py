"""Las dos señales del sistema descrito.

1. Momentum a corto plazo:
       momentum = (P_t - P_{t-30s}) / P_{t-30s} * 100
2. Sesgo por semivarianza sobre los retornos recientes:
       var_sub  = sum(max(r, 0)^2)
       var_baj  = sum(min(r, 0)^2)
       sesgo    = (var_sub - var_baj) / (var_sub + var_baj)      en [-1, 1]

Se compra "Up" cuando ambos son positivos y "Down" cuando ambos son negativos.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class SignalParams:
    momentum_secs: int = 30        # ventana del momentum (la del post)
    skew_secs: int = 300           # ventana de retornos de 1 s para la semivarianza (el post no la da)
    min_momentum_pct: float = 0.0  # umbral |momentum| en %, 0 = como el post
    min_skew: float = 0.0          # umbral |sesgo|, 0 = como el post


def momentum_pct(price_now, price_then):
    if not price_then:
        return 0.0
    return (price_now - price_then) / price_then * 100.0


def semivariance_skew(returns):
    up = 0.0
    down = 0.0
    for r in returns:
        if r > 0:
            up += r * r
        elif r < 0:
            down += r * r
    total = up + down
    if total == 0.0:
        return 0.0
    return (up - down) / total


def decide(momentum, skew, params):
    """Devuelve "Up", "Down" o None."""
    if momentum > params.min_momentum_pct and skew > params.min_skew:
        return "Up"
    if momentum < -params.min_momentum_pct and skew < -params.min_skew:
        return "Down"
    return None


def evaluate(closes, params):
    """closes: precios de cierre de 1 s, el último es el más reciente.

    Devuelve (lado, momentum, sesgo) o (None, ...) si no hay historia suficiente.
    """
    need = max(params.momentum_secs, params.skew_secs) + 1
    if len(closes) < need:
        return None, 0.0, 0.0
    now = closes[-1]
    mom = momentum_pct(now, closes[-1 - params.momentum_secs])
    window = closes[-1 - params.skew_secs:]
    rets = [(window[i] - window[i - 1]) / window[i - 1] for i in range(1, len(window)) if window[i - 1]]
    skew = semivariance_skew(rets)
    return decide(mom, skew, params), mom, skew
