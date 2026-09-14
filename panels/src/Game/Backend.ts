const backend = new URL(import.meta.env.VITE_GAME_SERVER_URL ||
  `${window.location.protocol}//${window.location.hostname}:2087`);

export function getApiUrl(path: string) {
  return new URL(path, backend).toString();
}

export function getSocketUrl() {
  const url = new URL(backend);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}
