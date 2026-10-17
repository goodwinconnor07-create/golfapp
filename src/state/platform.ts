// Where the app is running (the website or the iPhone app) and where its server is.
//
// On the website the page and the server share one address, so paths stay relative.
// The iPhone app's pages live on the phone (capacitor://localhost), so it's built with the
// server's full address in VITE_SERVER_URL (see npm run build:ios).

import { Capacitor } from '@capacitor/core';

/** True inside the iPhone app. */
export const isNative = Capacitor.isNativePlatform();

const SERVER = (import.meta.env.VITE_SERVER_URL ?? '').replace(/\/$/, '');

/** A server path ("/api/...") as a URL fetch can use. */
export function apiUrl(path: string): string {
  return `${SERVER}${path}`;
}

/** A server path as a WebSocket URL. */
export function socketUrl(path: string): string {
  if (SERVER) return SERVER.replace(/^http/, 'ws') + path;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}${path}`;
}

/** The public web address, for links people share: invites, results, the results picture. */
export function publicOrigin(): string {
  return SERVER || location.origin;
}

export const SHORT_HOST =import.meta.env.VITE_SHORT_LINK_HOST ?? 'cardshot.link';

/** The short join link for a game code, as typed or shared: cardshot.link/ABCDE. */
export function joinLinkLabel(code: string): string {
  return `${SHORT_HOST}/${code}`;
}

/** The same link with https, for sharing and QR codes. */
export function joinLink(code: string): string {
  return `https://${joinLinkLabel(code)}`;
}

/**
 * Who can start games. The host pays for the iPhone app; friends join free on the website.
 * The website keeps hosting until the app is in the App Store: build with VITE_WEB_HOSTING=off
 * to switch it off then.
 */
export const canHost = isNative || import.meta.env.VITE_WEB_HOSTING !== 'off';

/** Where the website sends would-be hosts once web hosting is off. */
export const APP_STORE_URL = import.meta.env.VITE_APP_STORE_URL ?? 'https://apps.apple.com/';
