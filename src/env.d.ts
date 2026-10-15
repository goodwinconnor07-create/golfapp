/// <reference types="vite/client" />

// Build-time settings (all optional). See src/state/platform.ts.
interface ImportMetaEnv {
  /** The server's full address, for the iPhone app build. Empty on the website. */
  readonly VITE_SERVER_URL?: string;
  /** "off" stops the website from starting games once the iPhone app is out. */
  readonly VITE_WEB_HOSTING?: string;
  /** The App Store page the website points hosts to. */
  readonly VITE_APP_STORE_URL?: string;
}
