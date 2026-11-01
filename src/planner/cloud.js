import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut,
  signInWithCredential,
} from "firebase/auth";
import { hasNativeHost, nativeRequest } from './native';
import { emptyPlan, mergeRecords, mergePlans, migrateLegacy, LEGACY_MIGRATION_VERSION } from "./model";

const app =
  getApps()[0] ||
  initializeApp({
    apiKey: "AIzaSyDPcQQkOABPaZAv1lc9-u4Xm5UvMcI0g1A",
    authDomain: "mission-plustwo.firebaseapp.com",
    projectId: "mission-plustwo",
    storageBucket: "mission-plustwo.firebasestorage.app",
    messagingSenderId: "376961059569",
    appId: "1:376961059569:web:3c220fd351410959a57750",
  });
const auth = getAuth(app);
async function cloudSDK() {
  const {
    getFirestore,
    collection,
    doc,
    getDocFromServer,
    getDocsFromServer,
    runTransaction,
    onSnapshot,
  } = await import("firebase/firestore");
  return {
    db: getFirestore(app),
    collection,
    doc,
    getDocFromServer,
    getDocsFromServer,
    runTransaction,
    onSnapshot,
  };
}
export const observeUser = (callback, onError) =>
  onAuthStateChanged(auth, callback, onError);
export const finishRedirect = () => hasNativeHost() ? Promise.resolve(null) : getRedirectResult(auth);
export const logOut = async () => { await signOut(auth); if(hasNativeHost())await nativeRequest('signOut'); };
export async function logIn() {
  if (!navigator.onLine)
    throw new Error(
      "Connect to the internet to sign in. Your blocks still work offline.",
    );
  if (hasNativeHost()) {
    const {idToken} = await nativeRequest('signIn');
    return signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  }
  if (window.NativeAndroid || /; wv\)/.test(navigator.userAgent))
    throw new Error(
      "Google sign-in needs Chrome or your default browser. Open tymvera.web.app there, then choose Install app from the browser menu.",
    );
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    return await signInWithPopup(auth, provider);
  } catch (error) {
    if (
      error.code === "auth/popup-blocked" ||
      error.code === "auth/operation-not-supported-in-this-environment"
    )
      return signInWithRedirect(auth, provider);
    throw error;
  }
}
export async function watchPlan(uid, callback, onError) {
  const { db, collection, onSnapshot } = await cloudSDK();
  return onSnapshot(
    collection(db, "users", uid, "planner_v3"),
    { includeMetadataChanges: true },
    (snapshot) => {
      const plan = emptyPlan();
      snapshot.forEach((s) => {
        if (s.id === "meta") {
          plan.migrationComplete = s.data().migrationComplete === true;
          plan.legacyMigrationVersion = s.data().legacyMigrationVersion || 0;
        }
        if (s.id === "routines") plan.routines = s.data().records || {};
        if (s.id === "templates") plan.templates = s.data().records || {};
        if (s.id === "day_modes") plan.dayModes = s.data().records || {};
        else if (/^\d{4}-\d{2}-\d{2}$/.test(s.id))
          plan.days[s.id] = s.data().records || {};
      });
      callback(
        plan,
        !snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites,
      );
    },
    onError,
  );
}
export async function readPlan(uid) {
  const { db, collection, doc, getDocsFromServer, getDocFromServer } =
    await cloudSDK();
  const snapshots = await getDocsFromServer(
    collection(db, "users", uid, "planner_v3"),
  );
  const plan = emptyPlan();
  snapshots.forEach((s) => {
    if (s.id === "meta") {
      plan.migrationComplete = s.data().migrationComplete === true;
      plan.legacyMigrationVersion = s.data().legacyMigrationVersion || 0;
    }
    if (s.id === "routines") plan.routines = s.data().records || {};
    if (s.id === "templates") plan.templates = s.data().records || {};
    if (s.id === "day_modes") plan.dayModes = s.data().records || {};
    else if (/^\d{4}-\d{2}-\d{2}$/.test(s.id))
      plan.days[s.id] = s.data().records || {};
  });
  if (plan.migrationComplete && plan.legacyMigrationVersion >= LEGACY_MIGRATION_VERSION) return plan;
  // Read the old schema only on the first migration. Never overwrite or delete it.
  const root = await getDocFromServer(doc(db, "users", uid));
  const settings = await getDocFromServer(
    doc(db, "users", uid, "settings", "current"),
  );
  const days = await getDocsFromServer(collection(db, "users", uid, "days"));
  const focusos = await getDocFromServer(doc(db, "focusos_users", uid));
  const earlier = focusos.data() || {};
  const earlierPlan = migrateLegacy(earlier.history || {}, earlier.presets || []);
  // Recover history from the predecessor without silently switching a user's
  // current weekly schedule back to that older plan.
  earlierPlan.routines = {};
  const old = root.data() || {};
  const history = { ...(old.TYMVERA_history || old.history || {}) };
  days.forEach((d) => {
    history[d.id] = d.data();
  });
  return {
    ...mergePlans(
      mergePlans(earlierPlan, migrateLegacy(
        history,
        settings.data()?.presets || old.TYMVERA_presets || old.presets || [],
      )),
      plan,
    ),
    needsMigration: true,
  };
}
export async function pushPlan(uid, plan, previous = emptyPlan()) {
  if (!auth.currentUser || auth.currentUser.uid !== uid)
    throw new Error("Sign in again before syncing.");
  const { db, doc, runTransaction } = await cloudSDK();
  const entries = [
    ["routines", plan.routines],
    ["templates", plan.templates || {}],
    ["day_modes", plan.dayModes || {}],
    ...Object.entries(plan.days),
  ];
  // Per-day transactions preserve independent edits and tombstones across devices.
  for (const [key, records] of entries) {
    const previousRecords =
      key === "routines"
        ? previous.routines
        : key === "templates"
          ? previous.templates || {}
          : key === "day_modes"
            ? previous.dayModes || {}
            : previous.days[key];
    if (JSON.stringify(records) === JSON.stringify(previousRecords)) continue;
    const ref = doc(db, "users", uid, "planner_v3", key);
    await runTransaction(db, async (transaction) => {
      const existing = await transaction.get(ref);
      const merged = mergeRecords(existing.data()?.records || {}, records);
      if (
        !existing.exists() ||
        JSON.stringify(merged) !== JSON.stringify(existing.data().records)
      )
        transaction.set(ref, { records: merged });
    });
  }
  // A partially interrupted migration must continue reading the legacy source
  // on the next device/session. Mark complete only after every record succeeds.
  if (!previous.migrationComplete || previous.legacyMigrationVersion < LEGACY_MIGRATION_VERSION) {
    const meta = doc(db, "users", uid, "planner_v3", "meta");
    await runTransaction(db, async (transaction) => {
      const existing = await transaction.get(meta);
      if (
        !existing.data()?.migrationComplete ||
        (existing.data()?.legacyMigrationVersion || 0) < LEGACY_MIGRATION_VERSION
      )
        transaction.set(meta, {
          migrationComplete: true,
          legacyMigrationVersion: LEGACY_MIGRATION_VERSION,
        });
    });
  }
}
export function authMessage(error) {
  const messages = {
    "auth/popup-closed-by-user":
      "Sign-in was cancelled. Your blocks are still on this device.",
    "auth/cancelled-popup-request": "A sign-in window is already open.",
    "auth/unauthorized-domain":
      "This preview address is not authorized for Google sign-in. Use tymvera.web.app or authorize this domain in Firebase Authentication.",
    "auth/network-request-failed":
      "Google could not be reached. Check your connection and try again.",
    "permission-denied":
        "Google sync could not access your plan. Your device data is preserved. Retry; if this continues, check cloud permissions.",
  };
  return (
    messages[error.code] || error.message || "Something went wrong. Try again."
  );
}
