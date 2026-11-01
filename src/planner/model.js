export const emptyPlan = () => ({
  version: 3,
  routines: {},
  days: {},
  templates: {},
  dayModes: {},
});
export const TRACKING_START = "2026-10-31";
export const LEGACY_MIGRATION_VERSION = 3;
export const taskKey = (name) =>
  String(name || "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
export const dateKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const shiftDate = (key, amount) => {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + amount);
  return dateKey(d);
};
export const newId = () => crypto.randomUUID();
let lastStamp = 0;
export const stamp = () => (lastStamp = Math.max(Date.now(), lastStamp + 1));
const isRecord = (value) =>
  value && typeof value === "object" && !Array.isArray(value);
export function validatePlan(value) {
  if (
    !isRecord(value) ||
    value.version !== 3 ||
    !isRecord(value.routines) ||
    !isRecord(value.days)
  )
    throw new Error("Choose a TYMVERA backup exported from this version.");
  const check = (record) => {
    if (record?.weight !== undefined && ![1,2,3,4].includes(record.weight)) throw new Error("Invalid task weight.");
    if (
      record?.actualMinutes !== undefined &&
      (!Number.isFinite(record.actualMinutes) ||
        record.actualMinutes < 0 ||
        record.actualMinutes > 1440)
    )
      throw new Error("Invalid logged minutes.");
    if (
      !isRecord(record) ||
      typeof record.id !== "string" ||
      !Number.isFinite(record.updatedAt)
    )
      throw new Error("This backup contains an invalid block.");
    if (
      !record.deleted &&
      (typeof record.name !== "string" ||
        !record.name.trim() ||
        record.name.length > 120 ||
        !Number.isFinite(record.duration) ||
        record.duration < 1 ||
        record.duration > 1440 ||
        (record.start && !/^([01]\d|2[0-3]):[0-5]\d$/.test(record.start)))
    )
      throw new Error("This backup contains an invalid block.");
    if (
      record.days &&
      (!Array.isArray(record.days) ||
        record.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6))
    )
      throw new Error("This backup contains invalid repeat days.");
  };
  Object.entries(value.routines).forEach(([id, r]) => {
    check(r);
    if (r.id !== id) throw new Error("Invalid routine ID.");
    if (!Array.isArray(r.days) || !/^\d{4}-\d{2}-\d{2}$/.test(r.from))
      throw new Error("Invalid routine schedule.");
    if (r.versions) {
      if (!Array.isArray(r.versions))
        throw new Error("Invalid routine history.");
      r.versions.forEach((version) => {
        check(version);
        if (
          !Array.isArray(version.days) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(version.effectiveFrom)
        )
          throw new Error("Invalid routine history.");
      });
    }
  });
  Object.entries(value.days).forEach(([date, records]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isRecord(records))
      throw new Error("This backup contains an invalid date.");
    Object.entries(records).forEach(([id, r]) => {
      check(r);
      if (r.id !== id) throw new Error("Invalid block ID.");
    });
  });
  if (value.templates && !isRecord(value.templates))
    throw new Error("Invalid routine versions.");
  for (const [id, template] of Object.entries(value.templates || {})) {
    if (
      template.id !== id ||
      !Number.isFinite(template.updatedAt) ||
      typeof template.name !== "string" ||
      !Array.isArray(template.blocks)
    )
      throw new Error("Invalid routine version.");
    template.blocks.forEach(check);
  }
  if (value.dayModes && !isRecord(value.dayModes))
    throw new Error("Invalid day versions.");
  for (const [date, mode] of Object.entries(value.dayModes || {})) {
    if (
      mode.id !== date ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(mode.updatedAt) ||
      (mode.templateId !== null && typeof mode.templateId !== "string")
    )
      throw new Error("Invalid day version.");
    if (mode.blocks) {
      if (!Array.isArray(mode.blocks)) throw new Error("Invalid day version.");
      mode.blocks.forEach(check);
    }
  }
  return value;
}
export function mergeRecords(a = {}, b = {}) {
  const merged = { ...a };
  for (const [id, record] of Object.entries(b)) {
    if (
      !merged[id] ||
      record.updatedAt > merged[id].updatedAt ||
      (record.updatedAt === merged[id].updatedAt &&
        JSON.stringify(record) > JSON.stringify(merged[id]))
    )
      merged[id] = record;
  }
  return merged;
}
export function mergePlans(a, b) {
  if ((a.resetAt || 0) !== (b.resetAt || 0))
    return structuredClone((a.resetAt || 0) > (b.resetAt || 0) ? a : b);
  const result = {
    version: 3,
    resetAt: a.resetAt || 0,
    trackingStart: a.trackingStart || b.trackingStart,
    routines: mergeRecords(a.routines, b.routines),
    days: { ...a.days },
    templates: mergeRecords(a.templates, b.templates),
    dayModes: mergeRecords(a.dayModes, b.dayModes),
  };
  for (const [date, records] of Object.entries(b.days))
    result.days[date] = mergeRecords(result.days[date], records);
  return result;
}
export function blocksForDay(plan, date) {
  if (date < (plan.trackingStart || '0000-00-00')) return [];
  const records = { ...(plan.days[date] || {}) };
  const mode = plan.dayModes?.[date];
  const chosenId = mode?.templateId || automaticTemplate(plan, date)?.id;
  const template = chosenId && plan.templates?.[chosenId];
  if (chosenId && (mode?.blocks || template)) {
    const definitions =
      mode?.blocks || templateRevision(template, date)?.blocks || [];
    const visible = {};
    for (const definition of definitions) {
      const existing = records[definition.id];
      if (existing?.deleted) continue;
      visible[definition.id] =
        existing?.completed ||
        (existing?.customized && existing.planVersionId === chosenId)
          ? existing
          : { ...definition, completed: false, planVersionId: chosenId };
    }
    for (const r of Object.values(records))
      if (!r.deleted && (r.completed || r.dayOnly)) visible[r.id] = r;
    return Object.values(visible).sort((a, b) =>
      (a.start || "99:99").localeCompare(b.start || "99:99"),
    );
  }
  const weekday = new Date(`${date}T12:00:00`).getDay();
  for (const routine of Object.values(plan.routines)) {
    const id = `r-${routine.id}`;
    if (
      records[id]?.planVersionId &&
      !records[id].completed &&
      !records[id].dayOnly
    )
      delete records[id];
    const versions = routine.versions || [
      { ...routine, effectiveFrom: routine.from },
    ];
    const r = [...versions]
      .filter((v) => v.effectiveFrom <= date)
      .sort(
        (a, b) =>
          b.effectiveFrom.localeCompare(a.effectiveFrom) ||
          b.updatedAt - a.updatedAt,
      )[0];
    const scheduled =
      r && !r.deleted && date >= routine.from && r.days.includes(weekday);
    const existing = records[id];
    // Explicit daily removals/overrides and completed records always win. Generated
    // future rows follow the effective routine, even if another action saved them.
    if (
      existing?.deleted ||
      existing?.customized ||
      existing?.completed ||
      (existing && date <= dateKey())
    )
      continue;
    if (scheduled) {
      const { versions: unused, ...fields } = r;
      records[id] = { ...fields, id, routineId: routine.id, completed: false };
    } else if (existing) delete records[id];
  }
  return Object.values(records)
    .filter((r) => !r.deleted && (!r.planVersionId || r.completed || r.dayOnly))
    .sort(
      (a, b) =>
        (a.start || "99:99").localeCompare(b.start || "99:99") ||
        a.updatedAt - b.updatedAt,
    );
}
export function reviseRoutine(previous, changes, effectiveFrom) {
  const { versions: previousVersions, ...old } = previous || {};
  const next = { ...old, ...changes, updatedAt: stamp() };
  const { versions: unused, ...revision } = next;
  const versions =
    previousVersions || (previous ? [{ ...old, effectiveFrom: old.from }] : []);
  // Only one effective configuration per day is necessary; past dates keep their
  // previous version and daily records retain deliberate exceptions.
  return {
    ...next,
    versions: [
      ...versions.filter((v) => v.effectiveFrom !== effectiveFrom),
      { ...revision, effectiveFrom },
    ],
  };
}
export function dayStats(blocks) {
  const completed = blocks.filter((b) => b.completed);
  const totalWeight = blocks.reduce((sum, b) => sum + taskWeight(b), 0);
  const doneWeight = blocks.reduce((sum, b) => sum + taskWeight(b) * completionFraction(b), 0);
  return {
    totalWeight, doneWeight,
    total: blocks.length,
    done: completed.length,
    percent: totalWeight
      ? Math.round((doneWeight / totalWeight) * 100)
      : 0,
    minutes: blocks.reduce(
      (sum, b) =>
        sum +
        (Number.isFinite(b.actualMinutes)
          ? b.actualMinutes
          : b.completed
            ? b.duration
            : 0),
      0,
    ),
  };
}
export function completionFraction(block) {
  return block.completed ? 1 : Math.min(1, Math.max(0, Number(block.actualMinutes) || 0) / Math.max(1, block.duration));
}
export function recordTaskTime(plan, date, id, minutes) {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1440)
    throw new Error('Choose a time between 0 and 24 hours.');
  const block = blocksForDay(plan,date).find(b=>b.id===id);
  if (!block) return plan;
  return {...plan,days:{...plan.days,[date]:{...(plan.days[date]||{}),[id]:{
    ...block, actualMinutes:minutes, completed:minutes>=block.duration,
    customized:true, timeSource:'logged', updatedAt:stamp(),
  }}}};
}
export function selectDayVersion(plan, date, templateId) {
  const template = templateId ? plan.templates?.[templateId] : null;
  if (templateId && (!template || template.deleted)) return plan;
  const records = { ...(plan.days[date] || {}) };
  for (const row of blocksForDay(plan, date))
    if (!records[row.id]) records[row.id] = row;
  return {
    ...plan,
    days: { ...plan.days, [date]: records },
    dayModes: {
      ...plan.dayModes,
      [date]: {
        id: date,
        templateId: templateId || null,
        blocks: template ? template.blocks.map((b) => ({ ...b })) : null,
        updatedAt: stamp(),
      },
    },
  };
}
export function saveRoutineVersion(plan, record, today = dateKey()) {
  const previous = plan.templates?.[record.id];
  const versions = previous?.versions || (previous ? [{...previous, effectiveFrom: previous.from || plan.trackingStart || '0000-00-00'}] : []);
  const {versions: ignoredVersions, ...definition} = record;
  record = {...definition, from: previous?.from || record.from || today,
    versions: [...versions.filter(v => v.effectiveFrom !== today), {...definition, effectiveFrom: today}]};
  const dayModes = { ...plan.dayModes };
  for (const [date, mode] of Object.entries(dayModes)) {
    if (date > today && mode.templateId === record.id) {
      dayModes[date] = { ...mode, blocks: record.blocks.map(b => ({ ...b })), updatedAt: record.updatedAt };
    }
  }
  return { ...plan, templates: { ...plan.templates, [record.id]: record }, dayModes };
}
export const WEIGHTS = [[1, 'Low'], [2, 'Medium'], [3, 'High'], [4, 'Very high']];
export const taskWeight = block => WEIGHTS.some(([value]) => value === Number(block.weight)) ? Number(block.weight) : 2;
export function templateRevision(template, date) {
  if (!template) return null;
  return template.versions ? [...template.versions].filter(v => v.effectiveFrom <= date)
    .sort((a,b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0] : template;
}
export function automaticTemplate(plan, date) {
  const weekday = new Date(`${date}T12:00:00`).getDay();
  return Object.values(plan.templates || {}).filter(t => {
    const revision = templateRevision(t, date);
    return revision && !revision.deleted && revision.autoDays?.includes(weekday) && (!revision.from || revision.from <= date);
  }).sort((a,b) => templateRevision(b,date).updatedAt - templateRevision(a,date).updatedAt)[0];
}
export function blockEnd(block) {
  if (!block.start) return null;
  const [h,m] = block.start.split(':').map(Number);
  const minutes = h * 60 + m + Number(block.duration);
  return {time: `${String(Math.floor(minutes / 60) % 24).padStart(2,'0')}:${String(minutes % 60).padStart(2,'0')}`, nextDay: minutes >= 1440};
}
// Attribute recorded time across midnight, without counting a session twice.
export function minutesOnDate(block, startDate, targetDate) {
  const minutes = Number.isFinite(block.actualMinutes) ? block.actualMinutes : block.completed ? block.duration : 0;
  if (!block.start) return startDate === targetDate ? minutes : 0;
  const [h,m] = block.start.split(':').map(Number);
  const beforeMidnight = 1440 - h * 60 - m;
  if (startDate === targetDate) return Math.min(minutes, beforeMidnight);
  return shiftDate(startDate, 1) === targetDate ? Math.max(0, minutes - beforeMidnight) : 0;
}
export function renameTask(plan, previousName, nextName) {
  const name = String(nextName || '').trim();
  if (!name || name.length > 120) throw new Error('Use a task name between 1 and 120 characters.');
  if (previousName === name) return plan;
  const previousKey = taskKey(previousName);
  const rename = record => taskKey(record.name) === previousKey
    ? { ...record, name, updatedAt: stamp() } : record;
  const records = rows => Object.fromEntries(Object.entries(rows || {}).map(([id,row]) => [id,rename(row)]));
  return {
    ...plan,
    routines: Object.fromEntries(Object.entries(plan.routines).map(([id,row]) => [id,{
      ...rename(row), ...(row.versions ? {versions:row.versions.map(rename)} : {}),
    }])),
    days: Object.fromEntries(Object.entries(plan.days).map(([date,rows]) => [date,records(rows)])),
    templates: Object.fromEntries(Object.entries(plan.templates || {}).map(([id,row]) => {
      const blocks=row.blocks.map(rename);
      const versions=row.versions?.map(v=>({...v,blocks:v.blocks.map(rename)}));
      return [id,blocks.some((b,i)=>b!==row.blocks[i]) ? {...row,blocks,...(versions ? {versions} : {}),updatedAt:stamp()} : row];
    })),
    dayModes: Object.fromEntries(Object.entries(plan.dayModes || {}).map(([date,row]) => {
      const blocks=row.blocks?.map(rename);
      return [date,blocks?.some((b,i)=>b!==row.blocks[i]) ? {...row,blocks,updatedAt:stamp()} : row];
    })),
  };
}
export function updateDay(plan, date, blocks) {
  return {
    ...plan,
    days: {
      ...plan.days,
      [date]: Object.fromEntries(blocks.map((b) => [b.id, b])),
    },
  };
}
export function migrateLegacy(history = {}, presets = []) {
  const plan = emptyPlan();
  for (const p of Array.isArray(presets) ? presets : []) {
    if (!p?.id || !p.name) continue;
    plan.routines[p.id] = {
      id: String(p.id),
      name: String(p.name).slice(0, 120),
      start: p.start || "",
      duration: legacyDuration(p),
      days: Array.isArray(p.days) ? [...new Set(p.days.map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))] : [0, 1, 2, 3, 4, 5, 6],
      from: dateKey(),
      updatedAt: 2,
      deleted: false,
    };
  }
  for (const [date, log] of Object.entries(history || {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !log) continue;
    const list = Array.isArray(log.blocksList)
      ? log.blocksList
      : presets.filter((p) =>
          p?.days?.map(Number).includes(new Date(`${date}T12:00:00`).getDay()),
        );
    plan.days[date] = {};
    for (const p of list) {
      if (!p?.id || !p.name) continue;
      const progress = log.blocks?.[p.id];
      const id = `r-${p.id}`;
      plan.days[date][id] = {
        id,
        routineId: String(p.id),
        name: String(p.name).slice(0, 120),
        start: p.start || "",
        duration: legacyDuration(p),
        completed: progress?.status === "completed",
        actualMinutes: Number.isFinite(progress?.actualMins)
          ? progress.actualMins
          : progress?.status === "completed"
            ? legacyDuration(p)
            : 0,
        timeSource: Number.isFinite(progress?.actualMins)
          ? "logged"
          : "planned",
        legacyProgress: progress || null,
        updatedAt: 2,
        deleted: false,
      };
    }
    // Older clients logged sessions that were no longer present in blocksList.
    // Retain those sessions instead of silently dropping real progress.
    for (const [oldId, progress] of Object.entries(log.blocks || {})) {
      const id = `r-${oldId}`;
      if (plan.days[date][id] || !progress?.name) continue;
      const minutes = Math.max(0, Number(progress.actualMins) || 0);
      plan.days[date][id] = {
        id,
        name: String(progress.name).slice(0, 120),
        start: "",
        duration: Math.max(1, Math.min(1440, minutes || 30)),
        actualMinutes: minutes,
        completed: progress.status === "completed",
        timeSource: "logged",
        legacyProgress: progress,
        updatedAt: 2,
        deleted: false,
      };
    }
  }
  return plan;
}
function legacyDuration(p) {
  const minutes = (t) => {
    const [h, m] = (t || "00:00").split(":").map(Number);
    return h * 60 + m;
  };
  return Math.max(
    1,
    Math.min(
      1440,
      (minutes(p.end) - minutes(p.start) + 1440) % 1440 ||
        Number(p.duration) ||
        30,
    ),
  );
}
