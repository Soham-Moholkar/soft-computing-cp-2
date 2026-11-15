from math import exp, isfinite


def _require_finite(*values: float) -> None:
    if not all(isfinite(value) for value in values):
        raise ValueError("membership values must be finite")


def _clamp(value: float) -> float:
    _require_finite(value)
    return max(0.0, min(1.0, value))


def triangular(x: float, a: float, b: float, c: float) -> float:
    """Evaluate a triangle; equal outer/peak values model valid shoulders."""
    _require_finite(x, a, b, c)
    if not a <= b <= c or a == c:
        raise ValueError("triangular parameters must satisfy a <= b <= c with a < c")
    # b == a is a left shoulder; b == c is a right shoulder. Only a == c
    # has no support and is rejected rather than silently dividing by zero.
    if b == a:
        return 1.0 if x <= b else _clamp((c - x) / (c - b))
    if b == c:
        return 1.0 if x >= b else _clamp((x - a) / (b - a))
    if x <= a or x >= c:
        return 0.0
    if x == b:
        return 1.0
    return _clamp((x - a) / (b - a) if x < b else (c - x) / (c - b))


def trapezoidal(x: float, a: float, b: float, c: float, d: float) -> float:
    """Evaluate a trapezoid with optional left/right shoulders without division by zero."""
    _require_finite(x, a, b, c, d)
    if not a <= b <= c <= d or a == d:
        raise ValueError("trapezoidal parameters must satisfy a <= b <= c <= d with a < d")
    # Equal a/b or c/d expresses a shoulder. Equal a/d is degenerate.
    if b <= x <= c:
        return 1.0
    if x < b:
        return 1.0 if a == b else _clamp((x - a) / (b - a))
    return 1.0 if c == d else _clamp((d - x) / (d - c))


def gaussian(x: float, center: float, sigma: float) -> float:
    _require_finite(x, center, sigma)
    if sigma <= 0:
        raise ValueError("gaussian sigma must be positive")
    return _clamp(exp(-((x - center) ** 2) / (2 * sigma**2)))


def union(left: float, right: float) -> float:
    _require_finite(left, right)
    return max(_clamp(left), _clamp(right))


def intersection(left: float, right: float) -> float:
    _require_finite(left, right)
    return min(_clamp(left), _clamp(right))


def complement(value: float) -> float:
    _require_finite(value)
    return 1 - _clamp(value)
