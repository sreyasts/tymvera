import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  auth: { currentUser: { uid: "alice" } },
  records: new Map(),
  writes: [],
  offline: false,
  reads: 0,
  legacyDays: {},
  focusos: {},
  failRef: null,
}));
vi.hoisted(() => {
  globalThis.location = { hostname: "localhost" };
});
vi.stubGlobal("navigator", { onLine: true, userAgent: "test" });
vi.stubGlobal("window", {});
vi.mock("firebase/app", () => ({
  getApps: () => [],
  initializeApp: () => ({}),
}));
vi.mock("firebase/auth", () => ({
  getAuth: () => mock.auth,
  GoogleAuthProvider: class {
    setCustomParameters() {}
  },
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  getRedirectResult: vi.fn(),
  onAuthStateChanged: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("firebase/firestore", () => ({
  getFirestore: () => ({}),
  collection: (_, ...parts) => parts.join("/"),
  doc: (_, ...parts) => parts.join("/"),
  getDocFromServer: async ref => ({ data: () => ref.startsWith('focusos_users/') ? mock.focusos : {}, exists: () => ref.startsWith('focusos_users/') && Object.keys(mock.focusos).length > 0 }),
  getDocsFromServer: async (ref) => {
    if (mock.offline) throw new Error("offline");
    const entries = ref.endsWith('/planner_v3') ? [...mock.records.entries()].filter(([key]) => key.startsWith(`${ref}/`)).map(([key,value]) => [key.split('/').at(-1),value]) : Object.entries(mock.legacyDays);
    return { empty: entries.length === 0, forEach: callback => entries.forEach(([id,value]) => callback({id,data:()=>value})) };
  },
  onSnapshot: vi.fn(),
  runTransaction: async (_, fn) => {
    if (mock.offline) throw new Error("offline");
    return fn({
      get: async (ref) => {
        if (ref === mock.failRef) throw new Error('interrupted');
        mock.reads++;
        return {
          exists: () => mock.records.has(ref),
          data: () => mock.records.get(ref),
        };
      },
      set: (ref, value) => {
        mock.records.set(ref, value);
        mock.writes.push(ref);
      },
    });
  },
}));
import { pushPlan, readPlan, logIn } from "../src/planner/cloud";
import { emptyPlan, mergePlans, updateDay } from "../src/planner/model";
const day = "2026-10-31";
const block = (id, time, extra = {}) => ({
  id,
  name: id,
  duration: 30,
  start: "",
  updatedAt: time,
  completed: false,
  ...extra,
});
beforeEach(() => {
  mock.auth.currentUser = { uid: "alice" };
  mock.records.clear();
  mock.writes = [];
  mock.offline = false;
  mock.reads = 0;
  mock.legacyDays = {};
  mock.focusos = {};
  mock.failRef = null;
  window.NativeAndroid = undefined;
});
describe("Cloud isolation and conflict handling", () => {
  it('recovers predecessor history even after the users-only migration was marked complete', async () => {
    mock.records.set('users/alice/planner_v3/meta', {migrationComplete:true,legacyMigrationVersion:2});
    mock.records.set('users/alice/planner_v3/routines', {records:{current:block('current',100,{days:[1],from:'2026-10-31'})}});
    const preset={id:'early',name:'Skills',start:'05:00',end:'06:00',days:['1','2','3','4','5']};
    mock.focusos={presets:[preset],history:{'2026-09-22':{blocksList:[preset],blocks:{early:{status:'completed'}}}}};
    const recovered=await readPlan('alice');
    expect(recovered.days['2026-09-22']['r-early'].completed).toBe(true);
    expect(recovered.days['2026-09-22']['r-early'].duration).toBe(60);
    expect(Object.keys(recovered.routines)).toEqual(['current']);
    await pushPlan('alice',recovered);
    expect(mock.records.get('users/alice/planner_v3/meta').legacyMigrationVersion).toBe(3);
  });
  it('resumes an interrupted migration without abandoning unmigrated legacy days', async () => {
    const prior = '2026-10-30';
    mock.legacyDays = { [prior]:{blocksList:[{id:'p',name:'Legacy',start:'09:00',end:'10:00'}],blocks:{p:{status:'completed'}}} };
    const local = updateDay(updateDay(emptyPlan(),day,[block('a',20)]),prior,[block('b',21)]);
    mock.failRef = `users/alice/planner_v3/${prior}`;
    await expect(pushPlan('alice',local)).rejects.toThrow('interrupted');
    expect(mock.records.has('users/alice/planner_v3/meta')).toBe(false);
    const recovered = await readPlan('alice');
    expect(recovered.needsMigration).toBe(true);
    expect(recovered.days[day].a).toBeDefined();
    expect(recovered.days[prior]['r-p'].completed).toBe(true);
    mock.failRef = null;
    await pushPlan('alice',recovered);
    expect((await readPlan('alice')).migrationComplete).toBe(true);
    expect((await readPlan('alice')).days[prior]['r-p'].completed).toBe(true);
  });
  it("marks legacy reads for full migration before trusting the new collection", async () => {
    expect((await readPlan("alice")).needsMigration).toBe(true);
  });
  it("refuses to write an account other than the signed-in user", async () => {
    await expect(pushPlan("bob", emptyPlan())).rejects.toThrow("Sign in again");
    expect(mock.writes).toEqual([]);
  });
  it("propagates a failed cloud read instead of reporting an empty successful account", async () => {
    mock.offline = true;
    await expect(readPlan("alice")).rejects.toThrow("offline");
  });
  it("retains changes across offline failure then merges after reconnect", async () => {
    const local = updateDay(emptyPlan(), day, [
      block("a", 20, { completed: true }),
    ]);
    mock.offline = true;
    await expect(pushPlan("alice", local)).rejects.toThrow("offline");
    mock.offline = false;
    mock.records.set(`users/alice/planner_v3/${day}`, {
      records: { b: block("b", 10) },
    });
    await pushPlan("alice", local);
    expect(
      Object.keys(mock.records.get(`users/alice/planner_v3/${day}`).records),
    ).toEqual(["b", "a"]);
  });
  it("converges independent device completions and newer deletions", async () => {
    const a = updateDay(emptyPlan(), day, [
      block("a", 10, { completed: true }),
    ]);
    const b = updateDay(emptyPlan(), day, [
      block("b", 11, { completed: true }),
      block("a", 30, { deleted: true }),
    ]);
    await pushPlan("alice", a);
    await pushPlan("alice", b);
    await pushPlan("alice", a);
    expect(mock.records.get(`users/alice/planner_v3/${day}`).records).toEqual(
      mergePlans(a, b).days[day],
    );
  });
  it("does not re-read unchanged historical documents for each completion", async () => {
    const before = updateDay(emptyPlan(), "2026-10-01", [block("old", 1)]);
    const after = updateDay(before, day, [block("new", 2)]);
    await pushPlan("alice", after, { ...before, migrationComplete: true, legacyMigrationVersion:3 });
    expect(mock.writes).toEqual([`users/alice/planner_v3/${day}`]);
    expect(mock.reads).toBe(2);
  });
  it('rejects stale writes after an account reset', async()=>{
    mock.records.set('users/alice/planner_v3/meta',{resetAt:99,migrationComplete:true,legacyMigrationVersion:3});
    await expect(pushPlan('alice',updateDay(emptyPlan(),day,[block('old',100)]))).rejects.toThrow('reset');
    expect(mock.writes).toEqual([]);
  });
  it("rejects unsupported embedded Google login with a recovery instruction", async () => {
    window.NativeAndroid = {};
    await expect(logIn()).rejects.toThrow("Chrome");
  });
});
