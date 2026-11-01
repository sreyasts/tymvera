import { useEffect, useRef, useState } from "react";
import { emptyPlan, mergePlans, migrateLegacy, validatePlan, LEGACY_MIGRATION_VERSION } from "./model";
import { idbGet, initDB, STORE_NAME } from "../storage/indexedDb";
import { readPlan, pushPlan, watchPlan, authMessage } from "./cloud";

export const storageKey = (uid) => `tymvera_v3_${uid || "guest"}`;
const parse = (raw) => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
async function writeIDB(key, value) {
  const db = await initDB();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () =>
        reject(tx.error || new Error("Storage write was interrupted."));
    });
  } finally {
    db.close();
  }
}
export function usePlanner(uid) {
  const key = storageKey(uid);
  const [plan, setPlan] = useState(null);
  const [localStatus, setLocalStatus] = useState("loading");
  const [cloudStatus, setCloudStatus] = useState(uid ? "connecting" : "guest");
  const [error, setError] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [retry, setRetry] = useState(0);
  const [revision, setRevision] = useState(0);
  const current = useRef(null);
  const dirty = useRef(false);
  const generation = useRef(0);
  const saveGeneration = useRef(0);
  const queue = useRef(Promise.resolve());
  const mounted = useRef(true);
  const remoteReady = useRef(false);
  const confirmedRemote = useRef(emptyPlan());
  const migrationComplete = useRef(false);

  function persist(next, pending = dirty.current) {
    const token = ++saveGeneration.current;
    const envelope = { plan: next, dirty: pending };
    let localSaved = false;
    try {
      localStorage.setItem(key, JSON.stringify(envelope));
      localSaved = true;
    } catch {}
    setLocalStatus(localSaved ? "saved" : "saving");
    queue.current = queue.current
      .catch(() => {})
      .then(() => writeIDB(key, envelope))
      .then(() => {
        if (mounted.current && token === saveGeneration.current)
          setLocalStatus("saved");
      })
      .catch(() => {
        if (
          mounted.current &&
          token === saveGeneration.current &&
          !localSaved
        ) {
          setLocalStatus("error");
          setError(
            "Device storage is unavailable. Keep this page open and export a backup from Account.",
          );
        }
      });
  }
  function accept(next, pending) {
    current.current = next;
    dirty.current = pending;
    setPlan(next);
    persist(next, pending);
  }
  function change(updater) {
    if (!current.current) return;
    const next = updater(current.current);
    generation.current++;
    accept(next, !!uid);
    setRevision((value) => value + 1);
  }
  useEffect(() => {
    mounted.current = true;
    let alive = true;
    (async () => {
      let local;
      try {
        local = parse(localStorage.getItem(key));
      } catch {}
      const stored = await idbGet(key);
      if (stored?.plan && local?.plan)
        local = {
          plan: mergePlans(stored.plan, local.plan),
          dirty: stored.dirty || local.dirty,
        };
      else local ||= stored;
      let next = emptyPlan();
      if (local?.plan) {
        next = validatePlan(local.plan);
        dirty.current = !!local.dirty;
      } else if (!uid) {
        let history, presets;
        try {
          history = parse(localStorage.getItem("fo6_history"));
          presets = parse(localStorage.getItem("fo6_presets"));
        } catch {}
        history ||= await idbGet("fo6_history", {});
        presets ||= await idbGet("fo6_presets", []);
        next = migrateLegacy(history, presets);
      }
      if (alive) accept(next, dirty.current);
    })().catch(() => {
      if (alive) {
        setError(
          "Your saved plan could not be read. Export your existing browser data before retrying.",
        );
        setLocalStatus("error");
      }
    });
    const connectivity = () => {
      setOnline(navigator.onLine);
      setRetry((v) => v + 1);
    };
    window.addEventListener("online", connectivity);
    window.addEventListener("offline", connectivity);
    const receive = (event) => {
      if (event.key !== key || !current.current) return;
      const incoming = parse(event.newValue);
      if (incoming?.plan) {
        generation.current++;
        accept(
          mergePlans(current.current, incoming.plan),
          dirty.current || incoming.dirty,
        );
        setRevision((v) => v + 1);
      }
    };
    window.addEventListener("storage", receive);
    return () => {
      alive = false;
      mounted.current = false;
      window.removeEventListener("online", connectivity);
      window.removeEventListener("offline", connectivity);
      window.removeEventListener("storage", receive);
    };
  }, [key]);

  useEffect(() => {
    if (!uid || !plan || !online) return;
    let alive = true,
      unsubscribe = () => {};
    remoteReady.current = false;
    setCloudStatus("connecting");
    readPlan(uid)
      .then(async (remote) => {
        if (!alive) return;
        confirmedRemote.current = remote.needsMigration ? emptyPlan() : remote;
        migrationComplete.current =
          !!remote.migrationComplete && remote.legacyMigrationVersion >= LEGACY_MIGRATION_VERSION;
        accept(mergePlans(current.current, remote), true);
        remoteReady.current = true;
        setRevision((v) => v + 1);
        unsubscribe = await watchPlan(
          uid,
          (incoming, serverConfirmed) => {
            if (!alive) return;
            if (
              serverConfirmed &&
              incoming.migrationComplete &&
              incoming.legacyMigrationVersion >= LEGACY_MIGRATION_VERSION
            )
              migrationComplete.current = true;
            if (serverConfirmed)
              confirmedRemote.current = mergePlans(
                confirmedRemote.current,
                incoming,
              );
            const merged = mergePlans(current.current, incoming);
            if (JSON.stringify(merged) !== JSON.stringify(current.current))
              accept(merged, dirty.current);
            if (serverConfirmed && !dirty.current) setCloudStatus("synced");
          },
          (err) => {
            if (alive) {
              remoteReady.current = false;
              setCloudStatus("error");
              setError(authMessage(err));
            }
          },
        );
        if (!alive) unsubscribe();
      })
      .catch((err) => {
        if (alive) {
          setCloudStatus("error");
          setError(authMessage(err));
        }
      });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [uid, !!plan, online, retry]);

  useEffect(() => {
    if (!uid || !plan || !online || !remoteReady.current || !dirty.current)
      return;
    let alive = true;
    setCloudStatus("syncing");
    const timer = setTimeout(async () => {
      const sentGeneration = generation.current;
      const snapshot = current.current;
      try {
        await pushPlan(uid, snapshot, {
          ...confirmedRemote.current,
          migrationComplete: migrationComplete.current,
          legacyMigrationVersion: migrationComplete.current ? LEGACY_MIGRATION_VERSION : 0,
        });
        if (!alive) return;
        migrationComplete.current = true;
        confirmedRemote.current = mergePlans(confirmedRemote.current, snapshot);
        if (generation.current === sentGeneration) {
          dirty.current = false;
          persist(current.current, false);
          setCloudStatus("synced");
          setError("");
        }
      } catch (err) {
        if (alive) {
          setCloudStatus("error");
          setError(authMessage(err));
        }
      }
    }, 650);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [uid, revision, online, retry, !!plan]);

  useEffect(() => {
    if (cloudStatus !== "error" || !online || !uid) return;
    const timer = setTimeout(() => setRetry((v) => v + 1), 30000);
    return () => clearTimeout(timer);
  }, [cloudStatus, online, uid, retry]);

  return {
    plan,
    change,
    localStatus,
    cloudStatus:
      uid && !online
        ? "offline"
        : uid && dirty.current && cloudStatus === "synced"
          ? "syncing"
          : cloudStatus,
    error,
    clearError: () => setError(""),
    retry: () => setRetry((v) => v + 1),
    online,
  };
}
