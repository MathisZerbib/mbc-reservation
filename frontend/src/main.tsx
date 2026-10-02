import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Third-party challenge/onboarding bundles (Stripe/Cloudflare) can throw
// opaque `M_ID` rejections when third-party cookies are blocked (incognito).
// Log them without crashing our UI; our own errors still surface normally.
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason as Error | undefined;
    const msg = typeof reason?.message === 'string' ? reason.message : String(reason ?? '');
    const stack = typeof reason?.stack === 'string' ? reason.stack : '';
    if (/M_ID/.test(msg + stack)) {
      console.warn('[third-party] suppressed M_ID rejection (likely blocked cookies in private mode):', reason);
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
      <App />
  </StrictMode>,
)
