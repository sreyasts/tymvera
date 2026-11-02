## Get TYMVERA

### [Download Android APK — 3.3.0](https://github.com/sreyasts/tymvera/releases/download/v3.3.0-phone-test/TYMVERA-Android-3.3.0.apk)

[Open the web app](https://tymvera.web.app) · [Release notes](https://github.com/sreyasts/tymvera/releases/tag/v3.3.0-phone-test) · [Current app source](https://github.com/sreyasts/tymvera/tree/codex/simplify-daily-planner)

Android 3.3.0 is a **phone-test release**. Install it over your existing TYMVERA app. This is the last manual install needed to enable in-app updates: future newer published APKs reveal **Update**; the current version shows no Update button. Android still asks you to approve installation. The current implementation is linked above; the older overview below describes the legacy version.

---

> **Daily planner rebuild:** The active app now uses a simple agenda, one-tap completion, dated repeating routines, readable completion graphs, and account-scoped Google backup. See [current implementation and release checks](docs/REBUILD.md). The older feature/architecture overview below describes the legacy implementation, whose source is retained for reference.

<p align="center">
  <img src="public/og-image.png" alt="TYMVERA Banner" width="100%" style="border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);" />
</p>

<h1 align="center">TYMVERA</h1>

<p align="center">
  <strong>Offline-first, distraction-free productivity OS and weighted routine tracker built with React 19, Vite, and Cloud Firestore.</strong>
</p>

<p align="center">
  <a href="https://tymvera.web.app"><img src="https://img.shields.io/badge/Live%20App-tymvera.web.app-10B981?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Live App" /></a>
  <a href="https://tymvera.web.app"><img src="https://img.shields.io/badge/PWA-WebAPK_Ready-8B5CF6?style=for-the-badge&logo=pwa&logoColor=white" alt="PWA" /></a>
  <a href="https://github.com/sreyasts/tymvera/actions"><img src="https://img.shields.io/github/actions/workflow/status/sreyasts/tymvera/ci.yml?branch=main&style=for-the-badge&label=CI%20Status&logo=githubactions&logoColor=white" alt="CI Status" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License" /></a>
  <a href="https://react.dev"><img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" /></a>
</p>

---

## 1. System Overview

**TYMVERA** is a local-first Progressive Web App (PWA) designed for time-blocking execution, weighted priority routine tracking, and multi-session performance analytics. Unlike traditional project management tools that introduce administrative overhead, TYMVERA is built around minimal-latency time tracking with cognitive effort weighting.

- **Zero-Friction Execution**: Immediate timeline rendering of active blocks without login walls.
- **Weighted Scoring**: Evaluates productivity using prioritized weights (`Critical: 4x`, `High: 3x`, `Medium: 2x`, `Low: 1x`) with optional zero-XP exclusions for routine maintenance habits.
- **Dual-Redundant Storage**: Zero-data-loss architecture backing up IndexedDB transactions to LocalStorage mirrors.
- **Subcollection Cloud Architecture**: Scalable Firestore sync utilizing subcollections per day and setting to avoid monolithic document growth limits.

---

## 2. Architecture & Directory Structure

```
tymvera/
├── .github/
│   └── workflows/
│       ├── ci.yml                 # Automated test & production build verification
│       └── deploy.yml             # Firebase Hosting production deployment
├── public/
│   ├── manifest.json              # WebAPK-compliant PWA manifest
│   ├── sw.js                      # Offline service worker with cache-first routing
│   └── vendor/                    # Local fallbacks for Material Symbols & Tailwind CSS
├── src/
│   ├── components/                # Reusable UI components & modals
│   ├── services/
│   │   ├── alarmEngine.js         # Web Audio API synthesizer for offline alarms
│   │   ├── firebaseAuth.js        # Google Auth & subcollection Cloud Firestore sync
│   │   ├── notificationEngine.js  # Precision timeline notification dispatcher
│   │   └── storageRecovery.js     # Deep multi-schema browser storage recovery engine
│   ├── storage/
│   │   └── indexedDb.js           # Transaction-guarded IndexedDB layer & fallbacks
│   ├── App.jsx                    # Primary application orchestration component
│   └── index.jsx                  # React 19 root entrypoint
├── tests/
│   ├── storage.test.js            # IndexedDB operations, Promise error handling & fallback tests
│   ├── routine.test.js            # Weighted priority calculation & streak invariants
│   └── recovery.test.js           # Multi-schema recovery and backup serialization tests
├── firestore.rules                # Granular user ownership security rules
├── index.html                     # SPA root HTML template
├── package.json                   # Clean modern dependencies (Vite + React 19 + Vitest)
└── vite.config.mjs                # Production Vite configuration
```

---

## 3. Offline-First Storage Architecture

TYMVERA implements a local-first dual-storage pattern to ensure data integrity even in constrained, offline, or incognito browser environments:

```mermaid
flowchart TD
    App["TYMVERA Client"]
    IDB[("Primary: IndexedDB (TYMVERA_PWA_DB)")]
    LS[("Secondary: LocalStorage Mirror")]
    Recovery["Storage Recovery Scanner"]
    Firestore[("Cloud Firestore")]

    App -->|Write Block / Checkmark| IDB
    IDB -.->|Async Mirror / Fallback| LS
    App -.->|On Storage Corruption / Incognito| Recovery
    Recovery -->|Deep Scans DBs & Heuristics| App
    App <-->|Authenticated Sync| Firestore
```

1. **IndexedDB Layer (`src/storage/indexedDb.js`)**:
   - Manages asynchronous transactions on object store `app_data`.
   - Promise executors feature explicit `resolve` and `reject` handlers for both `request.onerror` and `tx.onabort` events.
2. **LocalStorage Fallback**:
   - Every write mirrors critical keys (`fo6_history`, `fo6_presets`, `fo6_alarms`) to synchronous `localStorage`.
   - If IndexedDB is blocked or quota-exceeded, reads and writes fall back gracefully without disrupting application flow.
3. **Storage Recovery Engine (`src/services/storageRecovery.js`)**:
   - Scans all browser storage databases (`TYMVERA_PWA_DB`, legacy databases, raw JSON keys, PlusTwo study planner schemas).
   - Performs non-destructive heuristic merges if local caches are partially cleared.

---

## 4. Cloud Firestore Data Architecture & Security

### 4.1 Subcollection Hierarchy

To ensure scalability and prevent hitting Firestore's 1MB single-document quota as user history expands over multiple years, data is stored in discrete subcollections:

```
users/{userId}
├── (document fields: themeMode, chartViewMode, lastSyncedAt, daysLoggedCount)
├── settings/
│   └── current
│       └── (fields: presets, alarms, notificationConfig, updatedAt)
└── days/
    ├── 2026-09-20
    │   └── (fields: date, dailyScore, blocks, blocksList, updatedAt)
    ├── 2026-09-21
    └── ...
```

### 4.2 Security Rules (`firestore.rules`)

Data ownership is enforced at the rule level. Authenticated users are strictly restricted to reading and writing paths matching their own authenticated UID:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 5. Development & Testing

### Prerequisites
- Node.js \(\ge 20.0.0\)
- npm \(\ge 10.0.0\)

### Installation & Local Server

```bash
# Install dependencies
npm install

# Start local development server with HMR
npm run dev

# Preview production build locally
npm run preview
```

### Automated Testing

Unit and integration tests are executed via [Vitest](https://vitest.dev):

```bash
# Run full test suite
npm test
```

Test coverage includes:
- **`tests/storage.test.js`**: IndexedDB initialization, write/read cycles, error rejection regression tests, and LocalStorage fallback.
- **`tests/routine.test.js`**: 4-tier weighted priority scoring, zero-XP exclusions, partial duration credits, and streak continuity.
- **`tests/recovery.test.js`**: Multi-schema migration, PlusTwo plan converter, and backup serialization.

### Production Build

```bash
# Build optimized static distribution to dist/
npm run build
```

---

## 6. Privacy & Security

- **Zero Third-Party Trackers**: No intrusive behavioral advertising scripts or external tracker pixels.
- **Zero Audio Network Requests**: All notification chimes and alarms are synthesized on-the-fly via the Web Audio API without fetching external MP3 assets.
- **Client-Side Encryption Ready**: Google credentials stay within Firebase Auth; local routine data never leaves the browser unless the student explicitly links an account.

---

## 7. License

TYMVERA is open source software released under the [MIT License](LICENSE).
