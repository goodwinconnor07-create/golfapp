# The iPhone app

CardShot's iPhone app is the same web app, wrapped with [Capacitor](https://capacitorjs.com) 8.
The game's files are bundled inside the app (it never loads the website), and it talks to the
same Cloudflare server as the website.

## How it fits together

- `capacitor.config.ts`: app ID `app.cardshot.ios`, name, splash screen.
- `ios/`: the Xcode project (Swift Package Manager, no CocoaPods). iPhone only, portrait only.
- `src/state/platform.ts`: knows if it's running in the app, and where the server is
  (`VITE_SERVER_URL`, baked in by `npm run build:ios`).
- `src/state/native.ts`: real haptics, the iOS share sheet, a native backup of saved games (iOS
  can clear a web view's storage), the status bar, and invite links that open the app.
- `worker/index.ts`: lets the app's pages (`capacitor://localhost`) call the API.
- `public/.well-known/apple-app-site-association`: lets `/j/CODE` invite links open the app.
- `ios/App/App/PrivacyInfo.xcprivacy`: Apple's privacy manifest (no tracking; UserDefaults and
  file timestamps for saving games and sharing the results picture).
- `.github/workflows/ios.yml`: builds on a Mac and uploads to TestFlight.
- Push notifications: `src/game/notify.ts` decides who to tell (the round starting, a hole's
  results being in, a vote on someone's claim, a score fix waiting on you; never the phone that
  did it), `worker/apns.ts` sends them straight to Apple, and the app asks permission the first
  time it's in an online game. They only show when the app is in the background.

## Who pays

The host pays for the app; friends join free on the website with the link or code. Until the app
is in the App Store, the website can still start games. On launch day:

1. Set the App Store link and switch off hosting on the website, in the GitHub repository's
   variables (Settings → Secrets and variables → Actions → Variables):
   `VITE_WEB_HOSTING=off` and `VITE_APP_STORE_URL=https://apps.apple.com/app/id<your app id>`.
   (Or put them in front of `npm run deploy` when deploying by hand.)
2. Deploy. Home then shows Join a game first, and "Host · get the app" links to the App Store.

## One-time setup (you)

1. **Apple Developer Program** ($99 a year): developer.apple.com/programs.
2. **Team ID**: developer.apple.com → Account → Membership details. Then replace `TEAMID` in
   `public/.well-known/apple-app-site-association` with it and deploy the website.
3. **App record**: App Store Connect → Apps → + → New App. Platform iOS, name CardShot, bundle ID
   `app.cardshot.ios` (register it under Certificates, Identifiers & Profiles first, with
   Associated Domains switched on), SKU `cardshot`.
4. **Paid Apps Agreement**: App Store Connect → Business. Bank and tax forms. Needed before a
   paid app can go live, and approval can take a few days. Also apply for the App Store Small
   Business Program (15% commission instead of 30%).
5. **API key for the build**: App Store Connect → Users and Access → Integrations → App Store
   Connect API → Team Keys → +, access "App Manager". Download the `.p8` file (only once).
6. **GitHub secrets** (Settings → Secrets and variables → Actions → New repository secret):
   - `APPLE_TEAM_ID`: the Team ID
   - `APP_STORE_CONNECT_KEY_ID`: the key's ID
   - `APP_STORE_CONNECT_ISSUER_ID`: the Issuer ID above the keys list
   - `APP_STORE_CONNECT_KEY`: the whole contents of the `.p8` file

7. **Push notifications**:
   - developer.apple.com → Identifiers → `app.cardshot.ios`: tick **Push Notifications**.
   - developer.apple.com → Keys → +: name it "CardShot push", tick **Apple Push Notifications
     service (APNs)**, then download the `.p8` (only once) and note its Key ID. This is a
     different key from step 5.
   - Give the server the key (from the repo folder, with the Cloudflare token set):
     ```
     npx wrangler secret put APNS_KEY        # paste the whole .p8 file
     npx wrangler secret put APNS_KEY_ID     # the push key's ID
     npx wrangler secret put APNS_TEAM_ID    # your Team ID
     ```
     Until these are set the server just doesn't send notifications; nothing breaks.
   - Builds run straight from Xcode use Apple's test push server: set the var
     `APNS_HOST=api.sandbox.push.apple.com` while testing those. TestFlight and App Store builds
     use the default.

## Making a TestFlight build

GitHub → Actions → iOS → Run workflow (or push a tag like `ios-v1.0.0`). About 15 minutes later
the build shows in App Store Connect → TestFlight. Add yourself as an internal tester and install
it with the TestFlight app. Each run gets the next build number automatically.

Change the version people see (1.0, 1.1…) with `MARKETING_VERSION` in
`ios/App/App.xcodeproj/project.pbxproj`, or in Xcode.

## On a Mac (optional)

```
npm ci
npm run build:ios      # build the web app for the phone and copy it into ios/
npx cap open ios       # opens Xcode; pick your team under Signing, then Run
```

`SERVER_URL=http://<your-mac's-ip>:5173 npm run build:ios` points the app at `npm run dev`
instead of the live server.

## What to test on a real phone

- A full one-phone round, and an online round with a friend's phone.
- Haptics on taps, card draws and the stamp.
- Share invite and Share results open the iOS share sheet (with the picture).
- Tapping an invite link in Messages opens the app straight into Join (needs step 2 above).
- Close and reopen the app mid-round: it carries on where it was.
- Airplane mode mid-hole: the round keeps going and catches up after.
- Notifications: allow them when asked, lock the phone, and have a friend finish the hole, claim
  a distance card, or ask to fix your score. Each should buzz your phone.
