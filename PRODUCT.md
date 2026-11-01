# TYMVERA

<!-- impeccable:product-schema 1 -->

## Platform
web with a hybrid Android host

## Users
The owner primarily uses an Android phone. Their stated obstacle is difficulty marking work and understanding progress.

## Product Purpose
Plan time blocks, mark them complete in one tap, and understand progress over time. Support manual tasks, weekly repeating routines, and saved alternative day-plan versions managed in Account and selected immediately in Today. Track actual minutes by the same normalized task name across days.

## Capabilities and Constraints
React and Vite application, deployed to Firebase Hosting in project mission-plustwo. Preserve existing local and cloud history. Authentication needs consent and connectivity; cloud success must mean server acknowledgement. The Android host bundles the web UI and adds Credential Manager sign-in, native alarm notifications, and file import/export. Google login runs through native credentials rather than inside the WebView. Background remote push is not implemented; web schedule changes reach local reminders when the APK opens and synchronizes.

Progress offers rolling 7-, 28-, 90-, and 365-day windows plus Lifetime. Lifetime starts on October 31, 2026; earlier recovered records remain separate from that baseline and available through historical periods. Completion defaults to planned minutes unless actual minutes are entered; the interface must explain that distinction.

## Brand Commitments
Keep the TYMVERA name. User requests a simple, clean, premium design without clutter, and authorizes rebuilding and removing unnecessary features.

## Product Principles
- Completion is the primary interaction.
- Setup is optional and short.
- Counts and charts have plain definitions and use real records.
- Equivalent task names share time totals after Unicode normalization, whitespace normalization, and lowercase matching.
- Switching a saved day-plan version preserves completed work and manually added blocks.
- Saved locally and saved to Google are distinct states.
- An undo is as legitimate as a completion; deleted records must not reappear after sync.

## Evidence on Hand
48 JavaScript tests pass. The deployed website's real owner Google sign-in and account restoration were verified. Independent migration comparison found 40 original sessions and six weekly routines preserved with no mismatches in dates, names, times, duration, completion, or actual logged minutes; legacy documents remain intact. Five native tests passed in the initial run, and background alarm notification delivery was observed. Final emulator Google sign-in remains unverified because the Google service timed out; web sign-in verification does not establish APK sign-in. No usage analytics, interviews with other users, or retention cohort evidence are available. Reasons for wider adoption remain hypotheses.
