export function joinPublicAssetUrl(baseUrl, assetPath) {
  if (typeof assetPath !== "string" || assetPath.length === 0) {
    throw new TypeError("Public asset paths must be non-empty strings.");
  }
  const base = typeof baseUrl === "string" && baseUrl.length > 0 ? baseUrl : "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}${assetPath.replace(/^\/+/, "")}`;
}

const runtimeBaseUrl = import.meta.env?.BASE_URL ?? "/";

export function publicAssetUrl(assetPath) {
  return joinPublicAssetUrl(runtimeBaseUrl, assetPath);
}
