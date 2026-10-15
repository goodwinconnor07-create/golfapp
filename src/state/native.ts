// The iPhone app's native extras. Only used when isNative (see platform.ts); the plugins are
// loaded on demand, so the website never downloads them.

type HapticKind = 'light' | 'medium' | 'heavy' | 'success' | 'error';

const haptics = () => import('@capacitor/haptics');

/** Real Taptic Engine feedback (iPhones ignore the web's vibrate). */
export async function nativeHaptic(kind: HapticKind): Promise<void> {
  const { Haptics, ImpactStyle, NotificationType } = await haptics();
  if (kind === 'success') return Haptics.notification({ type: NotificationType.Success });
  if (kind === 'error') return Haptics.notification({ type: NotificationType.Error });
  const style = kind === 'heavy' ? ImpactStyle.Heavy : kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light;
  return Haptics.impact({ style });
}

/**
 * The iOS share sheet. A picture is saved to the app's cache first, since the sheet shares files
 * by path. Returns false if the person closed the sheet without sharing.
 */
export async function nativeShare(opts: { title?: string; text?: string; url?: string; image?: File | null }): Promise<boolean> {
  const { Share } = await import('@capacitor/share');
  let files: string[] | undefined;
  if (opts.image) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const data = await blobToBase64(opts.image);
    const saved = await Filesystem.writeFile({ path: opts.image.name, data, directory: Directory.Cache });
    files = [saved.uri];
  }
  try {
    await Share.share({ title: opts.title, text: opts.text, url: files ? undefined : opts.url, files, dialogTitle: opts.title });
    return true;
  } catch {
    // Closing the sheet counts as an error in the plugin; it isn't one for us.
    return false;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// ── Saved data ───────────────────────────────────────────────────────────────
//
// The app keeps everything in localStorage under "sendit." keys. iOS can clear a web view's
// storage when the phone is short of space, so the app also copies those keys into native
// storage (UserDefaults) and copies them back at launch if they've gone.

const PREFIX = 'sendit.';

function localKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX)) keys.push(k);
  }
  return keys;
}

/**
 * At launch, when the web view's storage was found empty: put back the app's copy, replacing the
 * fresh device ID this launch made, so the player keeps their place in games. Returns how many keys came back.
 */
export async function restoreSavedData(): Promise<number> {
  let restored = 0;
  try {
    const { Preferences } = await import('@capacitor/preferences');
    const { keys } = await Preferences.keys();
    for (const key of keys) {
      if (!key.startsWith(PREFIX)) continue;
      const { value } = await Preferences.get({ key });
      if (value !== null) {
        localStorage.setItem(key, value);
        restored++;
      }
    }
  } catch {
    // Nothing saved yet, or storage is unavailable: carry on as we are.
  }
  return restored;
}

/** Copies the saved data across to native storage. */
export async function backUpSavedData(): Promise<void> {
  try {
    const { Preferences } = await import('@capacitor/preferences');
    const keys = localKeys();
    const { keys: stored } = await Preferences.keys();
    await Promise.all([
      ...keys.map((key) => Preferences.set({ key, value: localStorage.getItem(key) ?? '' })),
      // Keys the app has removed (a finished game, cleared history) go from the backup too.
      ...stored.filter((k) => k.startsWith(PREFIX) && !keys.includes(k)).map((key) => Preferences.remove({ key })),
    ]);
  } catch {
    // Try again next time.
  }
}

// ── App shell ────────────────────────────────────────────────────────────────

/**
 * Status bar, splash screen, saving, and invite links that open the app.
 * onJoinLink gets the code from a tapped https://…/j/CODE link.
 */
export async function startNativeShell(onJoinLink: (code: string) => void): Promise<void> {
  const [{ App }, { StatusBar, Style }, { SplashScreen }] = await Promise.all([
    import('@capacitor/app'),
    import('@capacitor/status-bar'),
    import('@capacitor/splash-screen'),
  ]);

  // Dark status bar text on the app's white screens.
  void StatusBar.setStyle({ style: Style.Light }).catch(() => undefined);
  void SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => undefined);

  // Back up when the app goes to the background, and every so often while it's open.
  void App.addListener('pause', () => void backUpSavedData());
  setInterval(() => void backUpSavedData(), 15_000);

  const fromUrl = (url: string) => {
    const m = url.match(/\/j\/([A-Za-z]{5})\/?(?:[?#].*)?$/);
    if (m) onJoinLink(m[1]);
  };
  void App.addListener('appUrlOpen', ({ url }) => fromUrl(url));
  // The link that launched the app, if it was closed when the link was tapped.
  const launch = await App.getLaunchUrl().catch(() => undefined);
  if (launch?.url) fromUrl(launch.url);
}
