import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import './Config.scss'

export function Config() {
  return (
    <div className="config">
      <h1>Config</h1>
    </div>
  )
}

createRoot(document.getElementById('config')!)
  .render(
    <StrictMode>
      <Config />
    </StrictMode>
  );