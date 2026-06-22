export function getCachedSignedUrl(key: string) {
  const item = sessionStorage.getItem(key);
  if (!item) return null;
  try {
    const { url, expiresAt } = JSON.parse(item);
    if (Date.now() < expiresAt) {
      return url;
    }
    sessionStorage.removeItem(key);
    return null;
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}

export function setCachedSignedUrl(key: string, url: string, expiresInSeconds: number) {
  const expiresAt = Date.now() + expiresInSeconds * 1000 - 5000;
  sessionStorage.setItem(key, JSON.stringify({ url, expiresAt }));
}
