const CURVE_POINT_COUNT = 64;

export function equalPowerGainAt(from, to, progress) {
  const normalized = Math.min(1, Math.max(0, progress));
  const shaped = to >= from
    ? Math.sin(normalized * Math.PI * 0.5)
    : Math.cos(normalized * Math.PI * 0.5);
  return to >= from
    ? from + (to - from) * shaped
    : to + (from - to) * shaped;
}

function equalPowerCurve(from, to) {
  const curve = new Float32Array(CURVE_POINT_COUNT);

  for (let index = 0; index < curve.length; index += 1) {
    const progress = index / (curve.length - 1);
    curve[index] = equalPowerGainAt(from, to, progress);
  }

  return curve;
}

function safeParamCall(param, method, ...args) {
  if (typeof param?.[method] === "function") {
    param[method](...args);
    return true;
  }
  return false;
}

export function scheduleEqualPowerFade(param, from, to, startAt, duration) {
  const fadeDuration = Math.max(0.05, Number(duration) || 0);
  safeParamCall(param, "cancelScheduledValues", startAt);
  safeParamCall(param, "setValueAtTime", from, startAt);

  const curve = equalPowerCurve(from, to);
  if (!safeParamCall(param, "setValueCurveAtTime", curve, startAt, fadeDuration)) {
    if (!safeParamCall(param, "linearRampToValueAtTime", to, startAt + fadeDuration)) {
      param.value = to;
    }
  }

  return startAt + fadeDuration;
}
