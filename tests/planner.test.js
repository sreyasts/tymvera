import { describe, it, expect } from "vitest";
import {
  blocksForDay,
  dateKey,
  dayStats,
  emptyPlan,
  mergePlans,
  migrateLegacy,
  shiftDate,
  updateDay,
  validatePlan,
  reviseRoutine,
} from "../src/planner/model";

const block = (extras = {}) => ({
  id: "a",
  name: "Read",
  duration: 30,
  start: "",
  completed: false,
  updatedAt: 10,
  ...extras,
});
describe("Planner records and progress", () => {
  it("keeps untouched scheduled days in history after rollover", () => {
    const p = emptyPlan(),
      yesterday = shiftDate(dateKey(), -1);
    p.routines.a = reviseRoutine(
      null,
      block({ from: yesterday, days: [0, 1, 2, 3, 4, 5, 6] }),
      yesterday,
    );
    expect(dayStats(blocksForDay(p, yesterday))).toMatchObject({
      total: 1,
      done: 0,
    });
    p.routines.a = reviseRoutine(p.routines.a, { deleted: true }, dateKey());
    expect(dayStats(blocksForDay(p, yesterday))).toMatchObject({
      total: 1,
      done: 0,
    });
    expect(blocksForDay(p, dateKey())).toHaveLength(0);
  });
  it("updates generated future snapshots and keeps deliberate day overrides", () => {
    const p = emptyPlan(),
      today = dateKey(),
      tomorrow = shiftDate(today, 1);
    p.routines.a = reviseRoutine(
      null,
      block({ from: today, days: [0, 1, 2, 3, 4, 5, 6] }),
      today,
    );
    p.days[tomorrow] = Object.fromEntries(
      blocksForDay(p, tomorrow).map((r) => [r.id, r]),
    );
    p.routines.a = reviseRoutine(
      p.routines.a,
      { name: "New routine" },
      tomorrow,
    );
    expect(blocksForDay(p, tomorrow)[0].name).toBe("New routine");
    p.days[tomorrow]["r-a"].customized = true;
    expect(blocksForDay(p, tomorrow)[0].name).toBe("Read");
    p.days[tomorrow]["r-a"].customized = false;
    p.routines.a = reviseRoutine(p.routines.a, { deleted: true }, tomorrow);
    expect(blocksForDay(p, tomorrow)).toHaveLength(0);
    expect(blocksForDay(p, today)).toHaveLength(1);
  });
  it("uses equal default weights and never labels no-plan as success", () => {
    expect(dayStats([])).toEqual({ total: 0, done: 0, percent: 0, minutes: 0, totalWeight: 0, doneWeight: 0 });
    expect(
      dayStats([block({ completed: true }), block({ id: "b", duration: 90 })]),
    ).toEqual({ total: 2, done: 1, percent: 50, minutes: 30, totalWeight: 4, doneWeight: 2 });
  });
  it("preserves a newer undo when older completed data arrives", () => {
    const a = updateDay(emptyPlan(), dateKey(), [
      block({ completed: false, updatedAt: 20 }),
    ]);
    const b = updateDay(emptyPlan(), dateKey(), [
      block({ completed: true, updatedAt: 10 }),
    ]);
    expect(blocksForDay(mergePlans(a, b), dateKey())[0].completed).toBe(false);
  });
  it("keeps deletion tombstones when merging another device", () => {
    const a = updateDay(emptyPlan(), dateKey(), [
      block({ deleted: true, updatedAt: 20 }),
    ]);
    const b = updateDay(emptyPlan(), dateKey(), [block()]);
    expect(blocksForDay(mergePlans(a, b), dateKey())).toEqual([]);
  });
  it("merges independent edits on the same day", () => {
    const a = updateDay(emptyPlan(), dateKey(), [block()]);
    const b = updateDay(emptyPlan(), dateKey(), [block({ id: "b" })]);
    expect(blocksForDay(mergePlans(a, b), dateKey())).toHaveLength(2);
  });
  it("projects repeat days, respects from date, and does not invent historical plans", () => {
    const today = dateKey();
    const p = emptyPlan();
    p.routines.a = block({ from: today, days: [0, 1, 2, 3, 4, 5, 6] });
    expect(blocksForDay(p, today)).toHaveLength(1);
    expect(blocksForDay(p, shiftDate(today, -1))).toHaveLength(0);
    p.routines.a.from = shiftDate(today, 1);
    expect(blocksForDay(p, today)).toHaveLength(0);
  });
  it("does not regenerate a removed repeating instance", () => {
    const today = dateKey();
    const p = emptyPlan();
    p.routines.a = block({ from: today, days: [0, 1, 2, 3, 4, 5, 6] });
    p.days[today] = {
      "r-a": block({ id: "r-a", deleted: true, updatedAt: 30 }),
    };
    expect(blocksForDay(p, today)).toEqual([]);
  });
  it("stopping a repeat keeps recorded historical completion", () => {
    const p = emptyPlan();
    const yesterday = shiftDate(dateKey(), -1);
    p.routines.a = block({
      from: yesterday,
      days: [0, 1, 2, 3, 4, 5, 6],
      deleted: true,
    });
    p.days[yesterday] = { "r-a": block({ id: "r-a", completed: true }) };
    expect(dayStats(blocksForDay(p, yesterday)).done).toBe(1);
    expect(blocksForDay(p, dateKey())).toHaveLength(0);
  });
  it("migrates the real legacy schema without modifying it", () => {
    const presets = [
      { id: "p", name: "Read", start: "23:30", end: "00:30", days: [1, 2] },
    ];
    const history = {
      "2026-10-20": {
        blocksList: presets,
        blocks: { p: { status: "completed" } },
      },
    };
    const before = JSON.stringify({ presets, history });
    const p = migrateLegacy(history, presets);
    expect(p.days["2026-10-20"]["r-p"].completed).toBe(true);
    expect(p.days["2026-10-20"]["r-p"].duration).toBe(60);
    expect(JSON.stringify({ presets, history })).toBe(before);
    expect(validatePlan(p)).toBe(p);
  });
  it("uses an explicit empty legacy day snapshot instead of restoring deleted blocks", () => {
    const p = migrateLegacy({ "2026-10-20": { blocksList: [], blocks: {} } }, [
      { id: "p", name: "Read", days: [2] },
    ]);
    expect(p.days["2026-10-20"]).toEqual({});
  });
  it("rejects malformed backup contents before merging", () => {
    const p = emptyPlan();
    p.days[dateKey()] = { a: block({ duration: -3 }) };
    expect(() => validatePlan(p)).toThrow();
    expect(() =>
      validatePlan({ version: 3, routines: [], days: {} }),
    ).toThrow();
  });
  it("resolves equal timestamps consistently independent of merge order", () => {
    const a = updateDay(emptyPlan(), dateKey(), [block({ completed: true })]);
    const b = updateDay(emptyPlan(), dateKey(), [block({ completed: false })]);
    expect(mergePlans(a, b)).toEqual(mergePlans(b, a));
  });
});
