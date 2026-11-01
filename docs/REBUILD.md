# Daily planner rebuild

The active entrypoint is `src/planner/PlannerApp.jsx`, with its own CSS, model, persistence hook and cloud adapter. `src/App.jsx` and older components/services are retained for reference and do not ship in the active JavaScript bundle.

## Run

```sh
npm ci
npm test
npm run dev
npm run build
npm run preview
```

## Data

- Local account data: `tymvera_v3_<uid>`; separate guest store: `tymvera_v3_guest`. Each envelope includes the plan and whether cloud changes are pending.
- IndexedDB: existing TYMVERA database and object store. Transaction completion establishes durability; localStorage offers an independent fallback.
- Cloud: `users/<uid>/planner_v3/routines`, `templates`, `day_modes`, and `YYYY-MM-DD` documents. Records contain timestamps; deleted records remain tombstones. Transactions merge individual records. Only changed documents are sent. Initial cloud read failures prevent uploads until successful retry.
- Routines carry dated versions. Historical planned blocks derive from the effective version; day records override individual occurrences. Completed records, explicit removals and daily customizations survive routine changes.
- Account manages saved alternative day-plan versions. Today's Day plan selector switches immediately between a saved version and the usual weekly routine, preserving completed work and manual tasks. Manual blocks can remain one-off or repeat on selected weekdays.
- Progress groups task names with NFKC Unicode normalization, trimmed/collapsed whitespace, and lowercase matching. Actual logged minutes accumulate across matching names; completing a block supplies planned minutes when actual time has not been entered.
- Progress periods are rolling 7, 28, 90, and 365 days, plus Lifetime from `2026-10-31` through today. Earlier recovered history is preserved outside that lifetime baseline; its link opens the 365-day view. Charts group up to 28 days daily, 29–90 days weekly, and longer ranges monthly; exact daily rows remain available.
- Old history/presets migrate into the guest store on the same browser origin/profile. Cloud legacy data migrates on first sign-in if no v3 documents exist. No old stores are deleted. Account and guest plans merge only on explicit request.
- JSON backup import accepts the v3 format and merges by record timestamps. Old local data remains available to legacy recovery tools; cross-browser/profile data cannot be automatically accessed by a webpage.

## Google authentication and deployment

Uses the existing `mission-plustwo` Firebase project. Public client configuration is embedded as normal Firebase web configuration; access control depends on deployed Firestore ownership rules.

The website is `tymvera.web.app`; the registered authentication handler remains `mission-plustwo.firebaseapp.com`. Switching the handler to the website's domain without updating Google's OAuth client caused `redirect_uri_mismatch`. The registered handler has been restored and real account sign-in verified.

Popup sign-in is attempted first; blocked or unsupported popups fall back to redirect. User cancellation does not force a redirect. The Android host uses Credential Manager and native Google credentials, passed to the same Firebase project; it does not open Google login inside its WebView.

Local changes work offline after the app shell is cached. Google sync uses transactions and waits for connectivity. The Account screen differentiates local storage from server acknowledgement. Automatic error retry runs after 30 seconds while online. Reconnect and manual retry also retry hydration/sync.

## Release checks

- Real Google consent on the deployed origin and correct account restoration after reload.
- Two-device completion, undo, deletion and reconnect convergence.
- Actual Android browser installation, keyboard, restart and dark/system appearance.
- Existing Firebase ownership rules deployed and working for `planner_v3`.
- Long-running storage capacity and timestamp conflict limits accepted.

Android now bundles the same web UI in a native host with Credential Manager, native scheduled notifications, boot/time-change restoration, file import/export, and system insets. Its existing package and signing identity are preserved for updates. It is a hybrid application, not a separate Kotlin UI. Web changes reach reminders when the APK opens and synchronizes; background remote push is not implemented.

## Verification

48 JavaScript tests pass. The deployed website restores the owner's actual Google account and shows the recovered history. An independent comparison found all 40 original historical sessions and six weekly routines preserved with no mismatches in dates, names, times, duration, completion, or actual logged minutes. Original legacy documents remain intact and have a local backup.

Five native tests passed in the initial run. Native alarm notification delivery was verified while the app was in the background. Final emulator Google sign-in remains unverified because the Google service timed out; neither passing native/model tests nor verified web sign-in establishes APK login or physical-phone behavior. The final native rerun and physical-device checks remain separate release evidence.

The native test rerun passed all five tests. The signed release APK rendered correctly on an isolated Android 15 emulator and opened Google's account chooser; account sign-in was not completed there. The owner will test authentication on their phone. Native permission results now immediately refresh the reminder status. Release builds succeed, with a lint metadata diagnostic from Firebase Auth 25's Kotlin 2.4 metadata and the older lint reader; this diagnostic is not evidence of a native authentication pass.

Real web completion was written to Firestore, survived reload, and its undo was independently confirmed on the server (completed false, logged minutes zero). All 40 original sessions still match. Two editable saved versions, No class and Class day, were saved and independently read back; both start from the recovered Saturday plan pending the owner's class-time edits.

## Android distribution

Firebase Spark Hosting rejects APK files. Keep APK files excluded from Hosting and distribute the signed APK through GitHub Releases. Do not upgrade billing to distribute it. Build the web bundle first, then assemble Android so bundled UI assets match the web build. Signing passwords are read from environment variables. Install over the existing APK to retain device data.
