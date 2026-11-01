import { describe, it, expect } from "vitest";
import {
  blocksForDay,
  dateKey,
  emptyPlan,
  selectDayVersion,
  saveRoutineVersion,
  updateDay,
  validatePlan,
} from "../src/planner/model";
import {
  groupProgress,
  progressDates,
  progressSeries,
  taskTotals,
} from "../src/planner/progress";
const row = (id, name = "Study skills", extra = {}) => ({
  id,
  name,
  start: "09:00",
  duration: 30,
  updatedAt: 10,
  completed: false,
  ...extra,
});
describe("Personal weekly routine and progress", () => {
  it("updates future assigned snapshots while preserving current and historical plans", () => {
    let plan = emptyPlan();
    const original = { id: "class", name: "Class", blocks: [row("study")], updatedAt: 10 };
    plan.templates.class = original;
    plan = selectDayVersion(plan, "2026-10-31", "class");
    plan = selectDayVersion(plan, "2026-11-02", "class");
    plan = saveRoutineVersion(plan, { ...original, blocks: [row("study", "Read", { start: "16:00" })], updatedAt: 20 }, "2026-11-01");
    expect(plan.dayModes["2026-10-31"].blocks[0].name).toBe("Study skills");
    expect(plan.dayModes["2026-11-02"].blocks[0].name).toBe("Read");
    expect(blocksForDay(plan, "2026-11-02")[0].start).toBe("16:00");
  });
  it("switches a date to a saved version and back, retaining completed work", () => {
    const today = dateKey(),
      p = emptyPlan();
    p.routines.a = { ...row("a"), from: today, days: [0, 1, 2, 3, 4, 5, 6] };
    p.templates.class = {
      id: "class",
      name: "Class day",
      blocks: [
        row("r-a", "Study skills", { start: "16:00" }),
        row("class", "Special class"),
      ],
      updatedAt: 10,
    };
    let changed = selectDayVersion(p, today, "class");
    expect(blocksForDay(changed, today).map((b) => b.start)).toEqual([
      "09:00",
      "16:00",
    ]);
    changed = updateDay(
      changed,
      today,
      blocksForDay(changed, today).map((b) =>
        b.id === "r-a" ? { ...b, completed: true, actualMinutes: 22 } : b,
      ),
    );
    changed = selectDayVersion(changed, today, null);
    expect(
      blocksForDay(changed, today).find((b) => b.id === "r-a").completed,
    ).toBe(true);
    expect(
      blocksForDay(changed, today).find((b) => b.id === "r-a").actualMinutes,
    ).toBe(22);
  });
  it("restores usual pending routine times when switching back", () => {
    const today = dateKey(),
      p = emptyPlan();
    p.routines.a = { ...row("a"), from: today, days: [0, 1, 2, 3, 4, 5, 6] };
    p.templates.class = {
      id: "class",
      name: "Class day",
      blocks: [row("r-a", "Study skills", { start: "16:00" })],
      updatedAt: 10,
    };
    let changed = selectDayVersion(p, today, "class");
    changed = updateDay(changed, today, blocksForDay(changed, today));
    expect(
      blocksForDay(selectDayVersion(changed, today, null), today)[0].start,
    ).toBe("09:00");
  });
  it("freezes the selected date snapshot when a saved version is later edited", () => {
    const p = emptyPlan(),
      today = dateKey();
    p.templates.c = {
      id: "c",
      name: "Class day",
      blocks: [row("a")],
      updatedAt: 10,
    };
    const changed = selectDayVersion(p, today, "c");
    changed.templates.c = {
      ...changed.templates.c,
      blocks: [row("a", "New name")],
    };
    expect(blocksForDay(changed, today)[0].name).toBe("Study skills");
    expect(validatePlan(changed)).toBe(changed);
  });
  it("anchors lifetime to October 31, never silently including older history", () => {
    expect(progressDates("lifetime", "2026-11-02")).toEqual([
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
    expect(progressDates(365, "2026-11-02")).toHaveLength(365);
    expect(progressDates(90, "2026-11-02")).toHaveLength(90);
  });
  it("groups matching task names and respects individually logged minutes", () => {
    const p = updateDay(emptyPlan(), dateKey(), [
      row("a", "Study skills", { actualMinutes: 22, completed: true }),
      row("b", " study  skills ", { actualMinutes: 38, completed: true }),
    ]);
    const totals = taskTotals(p, [dateKey()]);
    expect(totals).toHaveLength(1);
    expect(totals[0].minutes).toBe(60);
    expect(progressSeries(p, 7, "study skills").at(-1).minutes).toBe(60);
  });
  it("preserves exact totals when large periods are grouped for chart readability", () => {
    const series = progressDates(90).map((date) => ({
      date,
      done: 1,
      total: 2,
      minutes: 25,
    }));
    const groups = groupProgress(series);
    expect(groups.length).toBeLessThan(15);
    expect(groups.reduce((s, g) => s + g.minutes, 0)).toBe(2250);
    expect(groups.reduce((s, g) => s + g.done, 0)).toBe(90);
  });
});
