import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { isNative } from './state/platform';
import { boot, openJoinLink } from './state/store';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { installPressEffects } from './ui/effects';
import './styles/global.css';
import './styles/cards.css';
import './styles/screens.css';

// Whether this phone had any saved data before the app started writing (it sets a device ID straight away).
const hadSavedData = hasSavedData();

boot();
installPressEffects();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

if (isNative) {
  document.documentElement.classList.add('native');
  void import('./state/native').then(async (native) => {
    // iOS can clear a web view's storage when space is short. If it did, put the saved games
    // back from the app's own copy and start again with them (rare, so a reload is fine).
    if (!hadSavedData && (await native.restoreSavedData()) > 0) {
      location.reload();
      return;
    }
    await native.startNativeShell(openJoinLink);
  });
} else if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // Offline support for the website (production only, so development always gets fresh files).
  // The iPhone app doesn't need it: its files are already on the phone.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

function hasSavedData(): boolean {
  try {
    return Object.keys(localStorage).some((k) => k.startsWith('sendit.'));
  } catch {
    return false;
  }
}
