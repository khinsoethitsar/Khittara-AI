import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global error handling for debugging production white screens
window.onerror = function(message, source, lineno, colno, error) {
  const root = document.getElementById('root');
  if (root && root.innerHTML === '') {
    root.innerHTML = `<div style="padding: 20px; color: white; background: #0c0c0c; font-family: sans-serif;">
      <h1 style="color: #8b5cf6;">Runtime Error</h1>
      <pre style="white-space: pre-wrap; font-size: 12px; color: #94a3b8;">${message}</pre>
    </div>`;
  }
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
