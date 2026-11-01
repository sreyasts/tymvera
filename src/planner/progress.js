import {
  blocksForDay,
  dateKey,
  dayStats,
  shiftDate,
  taskKey,
  TRACKING_START,
} from "./model";

export const PERIODS = [
  [7, "7 days"],
  [28, "28 days"],
  [90, "90 days"],
  [365, "1 year"],
  ["lifetime", "Lifetime"],
];
export function progressDates(period, today = dateKey()) {
  if (period !== "lifetime")
    return Array.from({ length: Number(period) }, (_, i) =>
      shiftDate(today, i - Number(period) + 1),
    );
  const dates = [];
  for (let d = TRACKING_START; d <= today; d = shiftDate(d, 1)) {
    dates.push(d);
    if (dates.length > 36600) break;
  }
  return dates;
}
export function progressSeries(
  plan,
  period,
  selectedTask = "",
  today = dateKey(),
) {
  const dates = period === 'recovered'
    ? Object.keys(plan.days).filter(date => date < TRACKING_START && date <= today).sort()
    : progressDates(period, today);
  return dates.map((date) => ({
    date,
    ...dayStats(
      blocksForDay(plan, date).filter(
        (b) => !selectedTask || taskKey(b.name) === selectedTask,
      ),
    ),
  }));
}
export function groupProgress(series) {
  if (series.length <= 28)
    return series.map((d) => ({
      ...d,
      label: new Date(d.date + "T12:00:00").toLocaleDateString(undefined, {
        weekday: series.length <= 7 ? "short" : undefined,
        day: series.length > 7 ? "numeric" : undefined,
      }),
      end: d.date,
    }));
  const groups = new Map();
  for (const day of series) {
    const key =
      series.length <= 90
        ? String(Math.floor(series.indexOf(day) / 7))
        : day.date.slice(0, 7);
    const group = groups.get(key) || {
      date: day.date,
      end: day.date,
      done: 0,
      total: 0,
      minutes: 0,
    };
    group.end = day.date;
    group.done += day.done;
    group.total += day.total;
    group.minutes += day.minutes;
    groups.set(key, group);
  }
  return [...groups.values()].map((g) => ({
    ...g,
    percent: g.total ? Math.round((g.done / g.total) * 100) : 0,
    label: new Date(g.date + "T12:00:00").toLocaleDateString(
      undefined,
      series.length <= 90
        ? { month: "short", day: "numeric" }
        : { month: "short", year: "2-digit" },
    ),
  }));
}
export function taskNames(plan) {
  const names = new Map();
  for (const row of [
    ...Object.values(plan.routines),
    ...Object.values(plan.days).flatMap((d) => Object.values(d)),
    ...Object.values(plan.templates || {}).flatMap((t) => t.blocks || []),
  ]) {
    if (row.name && !row.deleted && !names.has(taskKey(row.name)))
      names.set(taskKey(row.name), row.name.trim());
  }
  return [...names].sort((a, b) => a[1].localeCompare(b[1]));
}
export function taskTotals(plan, dates) {
  const totals = new Map();
  for (const date of dates)
    for (const b of blocksForDay(plan, date)) {
      const key = taskKey(b.name),
        value = totals.get(key) || { key, name: b.name, minutes: 0, done: 0 };
      value.minutes += Number.isFinite(b.actualMinutes)
        ? b.actualMinutes
        : b.completed
          ? b.duration
          : 0;
      value.done += b.completed ? 1 : 0;
      totals.set(key, value);
    }
  return [...totals.values()].sort(
    (a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name),
  );
}
