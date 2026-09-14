export function bindPanelKeyboard(
  onChange: (keys: Record<string, boolean>) => void,
  onRelease: () => void,
  targetWindow = window,
  targetDocument = document
) {
  let keys: Record<string, boolean> = {};
  const normalize = (key: string) => /^[A-Z]$/.test(key) ? key.toLowerCase() : key;
  const keyDown = (event: KeyboardEvent) => {
    if (targetDocument.hidden) return;
    keys = { ...keys, [normalize(event.key)]: true };
    onChange(keys);
  };
  const keyUp = (event: KeyboardEvent) => {
    keys = { ...keys, [normalize(event.key)]: false };
    onChange(keys);
  };
  const release = () => {
    keys = {};
    onChange(keys);
    // Send immediately; rendering can pause while the tab is hidden.
    onRelease();
  };
  const visibilityChanged = () => { if (targetDocument.hidden) release(); };
  targetWindow.addEventListener('keydown', keyDown);
  targetWindow.addEventListener('keyup', keyUp);
  targetWindow.addEventListener('blur', release);
  targetWindow.addEventListener('pagehide', release);
  targetDocument.addEventListener('visibilitychange', visibilityChanged);
  return () => {
    targetWindow.removeEventListener('keydown', keyDown);
    targetWindow.removeEventListener('keyup', keyUp);
    targetWindow.removeEventListener('blur', release);
    targetWindow.removeEventListener('pagehide', release);
    targetDocument.removeEventListener('visibilitychange', visibilityChanged);
    onRelease();
  };
}
