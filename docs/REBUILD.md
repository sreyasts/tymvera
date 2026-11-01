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

## Recovery and rename correction

Migration version 3 reads the predecessor `focusos_users/<uid>` document as well as `users/<uid>` and its settings/day subcollections. The prior migration missed that predecessor. Its weekday strings are normalized to numbers. Predecessor history is merged without automatically replacing an existing weekly plan; explicitly restoring an earlier plan preserves dated routine versions and completed history. Originals remain intact, and the restoration uses an atomic, preconditioned cloud commit after backup.

Renaming a task from its block editor updates matching task names across historical records, routines and their dated versions, saved plans, and assigned-day snapshots. It preserves IDs, minutes, completion flags, dates, and scheduling fields. Capitalization follows the entered label. The recovered-history view includes all recorded dates before the tracking baseline rather than a moving one-year window. Progress defaults to 90 days; Lifetime retains its original baseline.

52 JavaScript tests pass. A browser edit test verified mixed-case renaming with historical minutes and completion unchanged. The restored weekday plan was checked in the signed-in deployed web app and independently compared with its cloud source. APK 3.0.1 includes these changes; native Google sign-in remains a phone-test item.


## 3.1.0: automatic presets and weighted progress

Day presets have optional automatic weekdays, with a date-only override in Today. Preset revisions preserve historical schedule definitions and weights. Renaming a task relabels matching history without changing completed records or minutes. Priority points are Low 1 / Medium 2 / High 3 / Very high 4, independent of duration. Graph aggregation sums earned and available points before calculating percentages.

Overnight sessions belong to their start date for completion. Recorded minutes split at midnight; task totals use the same split as the time graph. Today includes last night's sessions for completion without date navigation.

Account reset metadata carries an epoch and tracking start. Merging different epochs discards the older plan; cloud transactions and security rules reject stale-epoch uploads. The requested personal-account reset and preset setup were applied by a private, preconditioned administrative commit. No account data, backups, credentials, or personal schedules are bundled into the release.

The existing logo is cleaned and included across the web header/loading view, favicons, PWA/iOS install icons, share card, Android launcher/adaptive/themed icons, splash screen and notification glyph. Asset generation is documented in `assets/brand/README.md`.

Validation: JavaScript unit tests; Android NativePlan JVM tests; browser interaction checks of weighted completion, day overrides, editable priorities/presets, light/dark mode and widths 320–1440px; independent server reads after account reset. Native Google sign-in still requires a successful phone test before claiming end-to-end native account verification.


### Quick actual-time logging

Each agenda session offers Log time and Fully completed. The inline time form accepts hours and minutes, common time shortcuts, and the full planned duration. Saved time replaces the session total. Under-target sessions earn `weight * actualMinutes / plannedMinutes`; the fraction is capped at one. Full completion logs the target duration; undo clears the recorded time. Overnight sessions expose these controls on the following morning as well. The full block editor uses the same target comparison when actual minutes change.

Validation: 61 JavaScript tests pass. Browser tests cover six-hour partial recording against an eight-hour target, reload persistence, full-target shortcut, undo, last-night recording, both themes, and widths 320–1440px.


## 3.2.0: notifications and extra-work scoring

Recorded time earns proportional priority points without a 100% cap; a full-completion action still logs exactly the planned duration. Graphs normalize to the visible peak and draw a dotted 100% reference line. Exact percentages remain visible in the daily records. The time graph also displays overnight carryover when there is no new task starting that day.

Android uses AlarmManager wakeup alarms, monochrome T icon, brand accent, large app icon, private lock-screen content and Android system notification templates. A channel-level block is reflected in Account. Exact-alarm permission revocation falls back to inexact scheduling. Recent undelivered alarms (up to 12 hours) produce a single review summary on reboot/reopen, except entries superseded by a fresh plan update; duplicates are receipted. Device power-off prevents all delivery; reboot recovery happens after Android permits the receiver to run. Notification tap opens the relevant date. Account includes a test action.

Web reminders run from the open page and display persistent service-worker notifications with the app icon, monochrome badge and date-aware tap action. Account explicitly describes the foreground/background limitation and provides permission and test controls. No closed-tab push sender/subscription/scheduler is configured; the legacy volatile worker schedule cache and misleading periodic-sync hooks were removed. The push event handler remains available for a future real push backend. No paid infrastructure or extra third-party service was enabled.

Developer checks include a custom Android instrumentation smoke test (debug test APK only), native missed-alarm policy tests, real browser scheduled/test notification retrieval, extra-credit chart tests and responsive browser checks. Personal account data is not used by these tests.


3.2.0 verification: 65 JavaScript tests and nine native JVM tests pass. On the Android 15 emulator, the signed release APK was installed and a custom instrumentation runner verified the notification icon, accent, content intent, recent-miss summary and an actual exact alarm posting while the device was forced into deep idle. The runner leaves reminders disabled on the disposable emulator after the check. Emulator battery/idle overrides were then reset. Web browser tests retrieved both a real scheduled notification and a test notification via the service worker, verified identity assets, and confirmed 150% scoring and a bounded graph at 320–1440px. This does not constitute testing a powered-off phone or every manufacturer's battery restrictions.


## 3.2.1: Android Back and notification-card branding

The previous host only checked WebView URL history, while planner pages changed React state. Android Back therefore left the app from nested screens. The host now uses AndroidX OnBackPressedDispatcher and asks the planner to consume Back first. Open time forms, task editors and preset drafts close before page navigation. A bounded route history restores visited tabs, selected dates and the preset page; the original Today root remains available even after long sessions. Only an exhausted root permits the task to move into the background.

Notifications use a dedicated 128px full-colour image generated from the approved logo master. Existing Android cards receive a one-time silent refresh, retaining their channel, title, body, priority and tap intent. Image URLs and install/favicon revisions move to v5 to avoid stale image caches. Android retains its required monochrome status icon.

Validation: 69 JavaScript tests and nine native JVM tests pass. Browser interaction tests verify editor/time-form/draft dismissal and Presets -> Account -> Progress -> Today ordering. The signed release was installed on the Android 15 emulator; real AndroidX Back dispatch passed on the running app. Both a new notification card and a simulated old card refreshed during upgrade matched the expected current logo exactly after Android's 128px-to-96px scaling (mean channel difference 0). Background exact-alarm delivery was checked in deep idle. Account data was not used by these tests.


## 3.2.2: task tap completes instead of editing

Tapping a task's name or schedule toggles full completion, including overnight tasks. Only the pencil opens its editor. Manual-time controls remain separate. Browser regression checks confirmed full planned-time logging and cross-off, persistence after reload, undo by tapping again, and pencil-only editing without completion. All 69 JavaScript tests pass.
