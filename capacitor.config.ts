// The iPhone app: Capacitor wraps the built web app (dist/client) in a native iOS project (ios/).
// Build and copy with: npm run build:ios
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.cardshot.ios',
  appName: 'CardShot',
  webDir: 'dist/client',
  ios: {
    // The app handles the notch and home bar itself (env(safe-area-inset-*) in global.css).
    contentInset: 'never',
    // No rubber-band bounce or link previews: it should feel like an app, not a web page.
    scrollEnabled: true,
    allowsLinkPreview: false,
    backgroundColor: '#ffffff',
  },
  plugins: {
    SplashScreen: {
      // Hidden by the app as soon as it has drawn (startNativeShell); this is the fallback.
      launchAutoHide: true,
      launchShowDuration: 1500,
      backgroundColor: '#ffffff',
      showSpinner: false,
    },
  },
};

export default config;
