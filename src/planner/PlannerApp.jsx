import React, { useEffect, useRef, useState } from "react";
import {
  blocksForDay,
  dateKey,
  dayStats,
  mergePlans,
  newId,
  shiftDate,
  stamp,
  updateDay,
  validatePlan,
  reviseRoutine,
  selectDayVersion,
  TRACKING_START,
} from "./model";
import {
  authMessage,
  finishRedirect,
  logIn,
  logOut,
  observeUser,
} from "./cloud";
import { storageKey, usePlanner } from "./usePlanner";
import { parsePlannerBackup } from "./backups";
import RoutineVersions from "./RoutineVersions";
import {hasNativeHost,nativeRequest} from './native';
import NativeReminders,{useNativeReminders} from './NativeReminders';
import {
  PERIODS,
  progressSeries,
  groupProgress,
  taskNames,
  taskTotals,
} from "./progress";
import "./planner.css";

function Icon({ name, size = 20 }) {
  const paths = {
    plus: "M12 5v14M5 12h14",
    check: "m5 12 4 4L19 6",
    left: "m14 6-6 6 6 6",
    right: "m10 6 6 6-6 6",
    calendar: "M8 3v4m8-4v4M4 10h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z",
    chart: "M4 4v16h16M8 16v-4m5 4V7m5 9v-6",
    user: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2",
    edit: "m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15l-1 6Z",
    close: "m6 6 12 12M6 18 18 6",
    repeat:
      "m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3",
    download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
    cloud: "M7 18a5 5 0 1 1 1-10 6 6 0 0 1 11 2 4 4 0 0 1-1 8H7Z",
    moon: "M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12Z",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.calendar} />
    </svg>
  );
}
const formatDate = (key, options = { month: "short", day: "numeric" }) =>
  new Date(`${key}T12:00:00`).toLocaleDateString(undefined, options);
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const timeLabel = (start) =>
  start
    ? new Date(`2000-01-01T${start}`).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : "Anytime";
function GoogleButton({ busy, onClick }) {
  return (
    <button className="google-button" disabled={busy} onClick={onClick}>
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.2h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c2-1.8 2.9-4.4 2.9-7.5Z"
        />
        <path
          fill="#34A853"
          d="M12 22c2.7 0 5-.9 6.7-2.3l-3.3-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.2H3v2.6A10 10 0 0 0 12 22Z"
        />
        <path
          fill="#FBBC05"
          d="M6.4 14a6 6 0 0 1 0-4V7.4H3a10 10 0 0 0 0 9.2L6.4 14Z"
        />
        <path
          fill="#EA4335"
          d="M12 5.8c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.7 9.7 0 0 0 12 2a10 10 0 0 0-9 5.4L6.4 10A6 6 0 0 1 12 5.8Z"
        />
      </svg>
      {busy ? "Opening Google…" : "Continue with Google"}
    </button>
  );
}

export default function PlannerApp() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const unsub = observeUser(
      (next) => {
        setUser(next);
        setAuthReady(true);
        setBusy(false);
      },
      (err) => {
        setAuthError(authMessage(err));
        setAuthReady(true);
      },
    );
    finishRedirect().catch((err) => {
      setAuthError(authMessage(err));
      setBusy(false);
    });
    return unsub;
  }, []);
  async function login() {
    setBusy(true);
    setAuthError("");
    try {
      await logIn();
    } catch (err) {
      setAuthError(authMessage(err));
    } finally {
      setBusy(false);
    }
  }
  if (!authReady)
    return (
      <main className="boot" aria-busy="true">
        <span className="wordmark">
          tymvera<span>.</span>
        </span>
        <p>Opening your day…</p>
      </main>
    );
  return (
    <Workspace
      key={user?.uid || "guest"}
      user={user}
      login={login}
      busy={busy}
      authError={authError}
      setAuthError={setAuthError}
    />
  );
}

function Workspace({ user, login, busy, authError, setAuthError }) {
  const {
    plan,
    change,
    localStatus,
    cloudStatus,
    error,
    clearError,
    retry,
    online,
  } = usePlanner(user?.uid);
  const nativeReminders = useNativeReminders(plan,user?.uid);
  const [tab, setTab] = useState("today");
  const [date, setDate] = useState(dateKey());
  const [editor, setEditor] = useState(null);
  const [message, setMessage] = useState(null);
  useEffect(() => {
    if (editor) setMessage(null);
  }, [editor]);
  const [range, setRange] = useState('lifetime');
  const [selectedTask, setSelectedTask] = useState("");
  const [progressMetric, setProgressMetric] = useState("completion");
  const [historyLimit, setHistoryLimit] = useState(31);
  const [manageVersions, setManageVersions] = useState(false);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("tymvera_appearance") || "system";
    } catch {
      return "system";
    }
  });
  const [importError, setImportError] = useState("");
  const fileRef = useRef(null);
  const today = dateKey();
  const blocks = plan ? blocksForDay(plan, date) : [];
  const stats = dayStats(blocks);
  const [guestAvailable, setGuestAvailable] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey()));
      return !!(
        Object.keys(saved?.plan?.days || {}).length ||
        Object.keys(saved?.plan?.routines || {}).length
      );
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
      if (hasNativeHost()) nativeRequest("appearance", {
        dark: document.documentElement.dataset.theme === "dark",
      }).catch(() => {});
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute(
          "content",
          document.documentElement.dataset.theme === "dark"
            ? "#181b19"
            : "#f8f9f5",
        );
    };
    apply();
    media.addEventListener("change", apply);
    try {
      localStorage.setItem("tymvera_appearance", theme);
    } catch {}
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (date === today && dateKey() !== today) setDate(dateKey());
    }, 30000);
    return () => clearInterval(timer);
  }, [date, today]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 9000);
    return () => clearTimeout(timer);
  }, [message]);
  function notify(text, undo) {
    setMessage({ text, undo });
  }
  function toggle(block) {
    change((p) => {
      const rows = blocksForDay(p, date);
      return updateDay(p, date, [
        ...Object.values(p.days[date] || {}),
        ...rows.map((b) =>
          b.id === block.id
            ? {
                ...b,
                completed: !b.completed,
                actualMinutes: b.completed
                  ? b.timeSource === "logged"
                    ? b.actualMinutes
                    : 0
                  : b.actualMinutes || b.duration,
                timeSource:
                  b.actualMinutes && b.timeSource === "logged"
                    ? "logged"
                    : "planned",
                updatedAt: stamp(),
              }
            : b,
        ),
      ]);
    });
  }
  function saveBlock(values) {
    const existing = editor?.block;
    change((p) => {
      let next = p;
      const id = existing?.id || newId();
      let routineId = existing?.routineId;
      if (values.days.length) {
        routineId ||= newId();
        next = {
          ...next,
          routines: {
            ...next.routines,
            [routineId]: reviseRoutine(
              next.routines[routineId],
              {
                id: routineId,
                name: values.name,
                start: values.start,
                duration: values.duration,
                days: values.days,
                from: next.routines[routineId]?.from || date,
                updatedAt: stamp(),
                deleted: false,
              },
              existing ? (date > today ? date : today) : date,
            ),
          },
        };
      }
      // Existing repeating blocks can be edited just for this date, or update the routine.
      const row = {
        id,
        name: values.name,
        start: values.start,
        duration: values.duration,
        completed: existing?.completed || false,
        updatedAt: stamp(),
        deleted: false,
        customized: !values.days.length,
        actualMinutes: values.actualMinutes ?? existing?.actualMinutes ?? 0,
        timeSource:
          values.actualMinutes !== null
            ? "logged"
            : existing?.timeSource || "planned",
        dayOnly: existing?.dayOnly || !existing,
        planVersionId: plan.dayModes?.[date]?.templateId || null,
        ...(routineId ? { routineId } : {}),
      };
      const rowId = !existing && routineId ? `r-${routineId}` : id;
      row.id = rowId;
      const records = { ...(next.days[date] || {}) };
      for (const b of blocksForDay(next, date))
        if (!records[b.id]) records[b.id] = b;
      records[rowId] = row;
      return { ...next, days: { ...next.days, [date]: records } };
    });
    setEditor(null);
    notify(existing ? "Block updated" : "Block added");
  }
  function removeBlock(block, stopRepeating = false) {
    const selected = date;
    const oldRoutine = plan.routines[block.routineId];
    change((p) => {
      const rows = { ...(p.days[selected] || {}) };
      blocksForDay(p, selected).forEach((b) => {
        rows[b.id] ||= b;
      });
      rows[block.id] = { ...block, deleted: true, updatedAt: stamp() };
      return {
        ...p,
        days: { ...p.days, [selected]: rows },
        routines:
          stopRepeating && oldRoutine
            ? {
                ...p.routines,
                [oldRoutine.id]: reviseRoutine(
                  oldRoutine,
                  { deleted: true },
                  selected > today ? selected : today,
                ),
              }
            : p.routines,
      };
    });
    setEditor(null);
    notify(
      stopRepeating
        ? "Repeating block removed. Past records kept."
        : "Block removed from this day",
      () =>
        change((p) => ({
          ...p,
          days: {
            ...p.days,
            [selected]: {
              ...p.days[selected],
              [block.id]: { ...block, deleted: false, updatedAt: stamp() },
            },
          },
          routines:
            stopRepeating && oldRoutine
              ? {
                  ...p.routines,
                  [oldRoutine.id]: {
                    ...oldRoutine,
                    deleted: false,
                    updatedAt: stamp(),
                  },
                }
              : p.routines,
        })),
    );
  }
  function copyYesterday() {
    const source = blocksForDay(plan, shiftDate(date, -1));
    if (!source.length) {
      notify("No blocks recorded for the previous day");
      return;
    }
    change((p) => {
      const records = { ...(p.days[date] || {}) };
      source.forEach((b) => {
        const id = newId();
        records[id] = {
          id,
            name: b.name,
            start: b.start,
            duration: b.duration,
          routineId: null,
            planVersionId: null,
            dayOnly: true,
            customized: true,
          completed: false,
            actualMinutes: 0,
            timeSource: "planned",
          updatedAt: stamp(),
        };
      });
      return { ...p, days: { ...p.days, [date]: records } };
    });
    notify("Previous day copied. Completions reset.");
  }
  function exportPlan() {
    if(hasNativeHost()){nativeRequest('export',{text:JSON.stringify(plan,null,2)}).catch(e=>setImportError(e.message));return;}
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `tymvera-${today}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importPlan(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024)
        throw new Error("Choose a backup smaller than 10 MB.");
      const imported = await parsePlannerBackup(await file.text());
      change((p) => mergePlans(p, imported));
      setImportError("");
      notify("Backup merged. Existing records kept.");
    } catch (err) {
      setImportError(err.message);
    }
  }
  const status =
    localStatus === "error"
      ? "Not saved — export a backup"
      : localStatus === "saving"
        ? "Saving on this device…"
        : !user
          ? online
            ? "Saved on this device"
            : "Offline · saved on this device"
          : {
              synced: "Saved to Google",
              connecting: "Checking Google backup…",
              syncing: "Saving to Google…",
              offline: "Offline · saved on this device",
              error: "Google sync needs attention",
            }[cloudStatus];
  const series = plan ? progressSeries(plan, range, selectedTask, today) : [];
  const dates = series.map((d) => d.date);
  const chartSeries = groupProgress(series);
  const names = plan ? taskNames(plan) : [];
  const totals = plan ? taskTotals(plan, dates) : [];
  const totalDone = series.reduce((sum, d) => sum + d.done, 0),
    totalPlanned = series.reduce((sum, d) => sum + d.total, 0);
  const totalMinutes = series.reduce((sum, d) => sum + d.minutes, 0);
  const maxMinutes = Math.max(1, ...chartSeries.map((d) => d.minutes));
  const currentRoutineCount = plan
    ? Object.values(plan.routines).filter((r) => !r.deleted).length
    : 0;

  return (
    <div className="app-shell">
      <header className="app-header">
        <a
          className="wordmark"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("today");
            setDate(today);
          }}
        >
          tymvera<span>.</span>
        </a>
        <button className="save-status" onClick={() => setTab("account")}>
          <span
            className={`status-dot ${cloudStatus === "error" || localStatus === "error" ? "warning" : ""}`}
          />
          {plan ? status : "Loading saved blocks…"}
        </button>
      </header>
      <nav className="navigation" aria-label="Main navigation">
        {[
          ["today", "calendar", "Today"],
          ["progress", "chart", "Progress"],
          ["account", "user", "Account"],
        ].map(([id, icon, label]) => (
          <button
            key={id}
            aria-current={tab === id ? "page" : undefined}
            className={tab === id ? "active" : ""}
            onClick={() => {
              setTab(id);
              setEditor(null);
            }}
          >
            <Icon name={icon} />
            {label}
          </button>
        ))}
      </nav>
      <main id="main-content">
        {(error || authError) && (
          <div className="error-banner" role="alert">
            <p>{error || authError}</p>
            <div>
              <button
                onClick={() => {
                  clearError();
                  setAuthError("");
                  retry();
                }}
              >
                Try again
              </button>
              <button
                aria-label="Dismiss error"
                onClick={() => {
                  clearError();
                  setAuthError("");
                }}
              >
                <Icon name="close" />
              </button>
            </div>
          </div>
        )}
        {!plan ? (
          <section className="empty-state" aria-busy={localStatus !== "error"}>
            <h1>
              {localStatus === "error"
                ? "Your plan needs attention"
                : "Opening your plan…"}
            </h1>
            <p>
              {localStatus === "error"
                ? "Your existing data has been left untouched. Reload to try again."
                : "Reading the blocks saved on this device."}
            </p>
            {localStatus === "error" && (
              <button onClick={() => location.reload()}>Reload</button>
            )}
          </section>
        ) : (
          <>
            {tab === "today" && (
              <>
                <div className="page-heading">
                  <div>
                    <h1>
                      {date === today
                        ? "Today"
                        : formatDate(date, { weekday: "long" })}
                    </h1>
                    <p>
                      {formatDate(date, {
                        weekday: date === today ? "long" : undefined,
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="date-controls">
                    <button
                      aria-label="Previous day"
                      onClick={() => {
                        setDate(shiftDate(date, -1));
                        setEditor(null);
                      }}
                    >
                      <Icon name="left" />
                    </button>
                    <label className="date-picker">
                      <Icon name="calendar" />
                      <input
                        aria-label="Choose date"
                        type="date"
                        value={date}
                        onChange={(e) => {
                          if (e.target.value) {
                            setDate(e.target.value);
                            setEditor(null);
                          }
                        }}
                      />
                    </label>
                    <button
                      aria-label="Next day"
                      onClick={() => {
                        setDate(shiftDate(date, 1));
                        setEditor(null);
                      }}
                    >
                      <Icon name="right" />
                    </button>
                  </div>
                </div>
                {date !== today && (
                  <button
                    className="text-button return-today"
                    onClick={() => {
                      setDate(today);
                      setEditor(null);
                    }}
                  >
                    Back to today
                  </button>
                )}
                {blocks.length > 0 && (
                  <section
                    className="day-summary"
                    aria-label="Daily completion"
                  >
                    <div>
                      <strong>
                        {stats.done} of {stats.total} blocks complete
                      </strong>
                      <span>{stats.percent}%</span>
                    </div>
                    <div
                      className="completion-track"
                      role="progressbar"
                      aria-label="Blocks completed"
                      aria-valuenow={stats.percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <span style={{ width: `${stats.percent}%` }} />
                    </div>
                    <p>
                      {stats.done === stats.total
                        ? "Your plan is complete. You can leave the rest of the day open."
                        : date > today
                          ? "A little structure for the day ahead."
                          : "One block at a time. Adjust the plan when life changes."}
                    </p>
                  </section>
                )}
                <section className="agenda" aria-label="Daily blocks">
                  <div className="section-heading">
                    <h2>Your plan</h2>
                    <button
                      className="primary compact"
                      onClick={() => setEditor({ block: null })}
                    >
                      <Icon name="plus" />
                      Add block
                    </button>
                  </div>
                  {Object.values(plan.templates || {}).some(
                    (t) => !t.deleted,
                  ) && (
                    <label className="day-version">
                      Day plan
                      <select
                        aria-label="Day plan version"
                        value={plan.dayModes?.[date]?.templateId || ""}
                        onChange={(e) => {
                          change((p) =>
                            selectDayVersion(p, date, e.target.value || null),
                          );
                          setEditor(null);
                        }}
                      >
                        <option value="">Usual weekly routine</option>
                        {Object.values(plan.templates || {})
                          .filter((t) => !t.deleted)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                  {editor && (
                    <BlockEditor
                      key={editor.block?.id || "new"}
                      block={editor.block}
                      taskNames={names.map(([, name]) => name)}
                      routine={plan.routines[editor.block?.routineId]}
                      date={date}
                      onSave={saveBlock}
                      onCancel={() => setEditor(null)}
                      onDelete={removeBlock}
                    />
                  )}
                  {!blocks.length && !editor && (
                    <div className="empty-state">
                      <div className="empty-mark">
                        <Icon name="calendar" size={30} />
                      </div>
                      <h3>Make room for what matters.</h3>
                      <p>
                        Add one thing you want to do. Give it a time, or keep it
                        flexible.
                      </p>
                      <button
                        className="primary"
                        onClick={() => setEditor({ block: null })}
                      >
                        <Icon name="plus" />
                        Add your first block
                      </button>
                      <button className="text-button" onClick={copyYesterday}>
                        Copy the previous day
                      </button>
                    </div>
                  )}
                  <div className="block-list">
                    {blocks.map((block) => (
                      <article
                        className={`block-row ${block.completed ? "is-complete" : ""}`}
                        key={block.id}
                      >
                        <button
                          className="completion-button"
                          role="checkbox"
                          aria-checked={!!block.completed}
                          aria-label={`${block.completed ? "Undo completion of" : "Complete"} ${block.name}`}
                          onClick={() => toggle(block)}
                        >
                          {block.completed && <Icon name="check" size={23} />}
                        </button>
                        <button
                          className="block-content"
                          onClick={() => setEditor({ block })}
                          aria-label={`Edit ${block.name}`}
                        >
                          <span className="block-name">{block.name}</span>
                          <span className="block-meta">
                            {timeLabel(block.start)}
                            <span aria-hidden="true">·</span>
                            {block.duration} min
                            {block.routineId && (
                              <Icon name="repeat" size={14} />
                            )}
                          </span>
                        </button>
                        <button
                          className="edit-button"
                          aria-label={`Edit block ${block.name}`}
                          onClick={() => setEditor({ block })}
                        >
                          <Icon name="edit" size={18} />
                        </button>
                      </article>
                    ))}
                  </div>
                  {blocks.length > 0 && (
                    <button
                      className="add-row"
                      onClick={() => setEditor({ block: null })}
                    >
                      <Icon name="plus" />
                      Add another block
                    </button>
                  )}
                </section>
                {!user && (
                  <aside className="backup-nudge">
                    <Icon name="cloud" />
                    <div>
                      <strong>Keep your plan with you.</strong>
                      <p>Sign in to back up and sync across devices.</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setTab("account")}
                    >
                      Connect Google
                      <Icon name="right" size={16} />
                    </button>
                  </aside>
                )}
              </>
            )}
            {tab === "progress" && (
              <>
                <div className="page-heading">
                  <div>
                    <h1>Your progress</h1>
                    <p>
                      {range === "lifetime"
                        ? `Your lifetime record starts ${formatDate(TRACKING_START, { month: "long", day: "numeric", year: "numeric" })}. Older progress stays in the other periods.`
                        : "Your time, across the things that matter to you."}
                    </p>
                  </div>
                </div>
                <div
                  className="period-picker"
                  role="group"
                  aria-label="Progress period"
                >
                  {PERIODS.map(([value, label]) => (
                    <button
                      key={value}
                      aria-pressed={range === value}
                      className={range === value ? "active" : ""}
                      onClick={() => {
                        setRange(value);
                        setHistoryLimit(31);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {Object.keys(plan.days).some(day=>day<TRACKING_START)&&<p className="fine-print">Your earlier progress is preserved. <button className="text-button" onClick={()=>{setRange(365);setHistoryLimit(366);}}>View recovered history</button></p>}
                <div className="progress-filters">
                  <label className="filter-label">
                    Task
                    <select
                      aria-label="Progress task"
                      value={selectedTask}
                      onChange={(e) => setSelectedTask(e.target.value)}
                    >
                      <option value="">All tasks</option>
                      {names.map(([key, name]) => (
                        <option key={key} value={key}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div
                    className="period-picker"
                    role="group"
                    aria-label="Progress metric"
                  >
                    <button
                      aria-pressed={progressMetric === "completion"}
                      className={
                        progressMetric === "completion" ? "active" : ""
                      }
                      onClick={() => setProgressMetric("completion")}
                    >
                      Completion
                    </button>
                    <button
                      aria-pressed={progressMetric === "time"}
                      className={progressMetric === "time" ? "active" : ""}
                      onClick={() => setProgressMetric("time")}
                    >
                      Logged time
                    </button>
                  </div>
                </div>
                <section className="progress-section">
                  <h2>
                    {progressMetric === "completion"
                      ? `${totalDone} of ${totalPlanned} planned blocks completed`
                      : `${Math.floor(totalMinutes / 60)}h ${Math.round(totalMinutes % 60)}m logged`}
                  </h2>
                  <p>
                    {progressMetric === "completion"
                      ? "Each block counts equally."
                      : "Completing a block logs its planned minutes. Edit the block to enter the actual time you spent."}
                  </p>
                  <div
                    className={`bar-chart ${chartSeries.length > 7 ? "days-28" : ""}`}
                    role="img"
                    aria-label={`${progressMetric === "time" ? "Logged minutes" : "Completion rate"} over the selected period. Exact values are in the daily table.`}
                  >
                    {chartSeries.map((d, i) => (
                      <div className="chart-column" key={d.date}>
                        <span className="chart-value">
                          {chartSeries.length <= 14
                            ? progressMetric === "time"
                              ? `${Math.round(d.minutes)}m`
                              : `${d.percent}%`
                            : ""}
                        </span>
                        <div className="bar-space">
                          <div
                            className={`chart-bar ${d.end === today ? "today" : ""} ${!d.total ? "no-plan" : ""}`}
                            style={{
                              height: d.total
                                ? `${Math.max(2, progressMetric === "time" ? (d.minutes / maxMinutes) * 100 : d.percent)}%`
                                : "3px",
                            }}
                          />
                        </div>
                        <span className="chart-label">
                          {chartSeries.length <= 7 ||
                          (chartSeries.length <= 14 ? i % 2 === 0 : i % 4 === 0)
                            ? d.label
                            : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="chart-note">
                    {series.length > 90
                      ? "Bars group days by month."
                      : series.length > 28
                        ? "Bars group days by week."
                        : "One bar per day."}{" "}
                    {progressMetric === "completion"
                      ? "Height = completed ÷ planned blocks."
                      : "Height = logged minutes."}
                  </p>
                </section>
                {!selectedTask && totals.length > 0 && (
                  <section className="history-section">
                    <h2>Time by task</h2>
                    <table>
                      <thead>
                        <tr>
                          <th>Task</th>
                          <th>Time logged</th>
                          <th>Done</th>
                        </tr>
                      </thead>
                      <tbody>
                        {totals.map((t) => (
                          <tr key={t.key}>
                            <th>
                              <button
                                className="text-button"
                                onClick={() => {
                                  setSelectedTask(t.key);
                                  setProgressMetric("time");
                                }}
                              >
                                {t.name}
                              </button>
                            </th>
                            <td>
                              {Math.floor(t.minutes / 60)}h{" "}
                              {Math.round(t.minutes % 60)}m
                            </td>
                            <td>{t.done}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                )}
                <section className="history-section">
                  <h2>Daily record</h2>
                  <table>
                    <caption className="sr-only">
                      Exact daily completion and logged minutes
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Day</th>
                        <th scope="col">Completed</th>
                        <th scope="col">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...series]
                        .reverse()
                        .slice(0, historyLimit)
                        .map((d) => (
                          <tr key={d.date}>
                            <th scope="row">
                              <button
                                className="text-button"
                                onClick={() => {
                                  setDate(d.date);
                                  setTab("today");
                                }}
                              >
                                {d.date === today
                                  ? "Today"
                                  : formatDate(d.date, {
                                      month: "short",
                                      day: "numeric",
                                      year: "2-digit",
                                    })}
                                <Icon name="right" size={14} />
                              </button>
                            </th>
                            <td>
                              {d.total ? `${d.done} / ${d.total}` : "No plan"}
                            </td>
                            <td>
                              {d.minutes
                                ? `${Math.floor(d.minutes / 60)}h ${Math.round(d.minutes % 60)}m`
                                : "—"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {historyLimit < series.length && (
                    <button
                      className="text-button"
                      onClick={() => setHistoryLimit((n) => n + 31)}
                    >
                      Show earlier days
                    </button>
                  )}
                </section>
              </>
            )}
            {tab === "account" && manageVersions && (
              <RoutineVersions
                plan={plan}
                change={change}
                date={date}
                onBack={() => setManageVersions(false)}
                onApply={(id) => {
                  change((p) => selectDayVersion(p, date, id));
                  setManageVersions(false);
                  setTab("today");
                  setEditor(null);
                  notify("Day plan changed. Completed work kept.");
                }}
              />
            )}
            {tab === "account" && !manageVersions && (
              <>
                <div className="page-heading">
                  <div>
                    <h1>Your space</h1>
                    <p>A safe home for your plan.</p>
                  </div>
                </div>
                <section className="settings-section">
                  <h2>
                    {user ? "Google account" : "Connect your Google account"}
                  </h2>
                  {user ? (
                    <>
                      <div className="account-identity">
                        <div className="avatar">
                          {(user.displayName || user.email || "G").slice(0, 1)}
                        </div>
                        <div>
                          <strong>
                            {user.displayName || "Google account"}
                          </strong>
                          <p>{user.email}</p>
                        </div>
                      </div>
                      <div className="sync-detail">
                        <Icon name="cloud" />
                        <div>
                          <strong>{status}</strong>
                          <p>
                            {cloudStatus === "synced"
                              ? "The latest sync was acknowledged by Google Cloud Firestore."
                              : cloudStatus === "offline"
                                ? "Changes will sync when you reconnect."
                                : "Your account uses Google Cloud Firestore. Changes stay on this device until sync is confirmed."}
                          </p>
                        </div>
                      </div>
                      <button className="secondary" onClick={retry}>
                        Sync now
                      </button>
                      {guestAvailable && (
                        <div className="guest-import">
                          <p>
                            A separate plan exists on this device from before
                            sign-in.
                          </p>
                          <button
                            className="secondary"
                            onClick={() => {
                              try {
                                const guest = JSON.parse(
                                  localStorage.getItem(storageKey()),
                                );
                                change((p) =>
                                  mergePlans(p, validatePlan(guest.plan)),
                                );
                                setGuestAvailable(false);
                                notify("Device plan added to this account");
                              } catch {
                                setImportError(
                                  "The device plan could not be read.",
                                );
                              }
                            }}
                          >
                            Add device plan to this account
                          </button>
                        </div>
                      )}
                      <button
                        className="text-button signout"
                        onClick={async () => {
                          try {
                            await logOut();
                          } catch (err) {
                            setAuthError(authMessage(err));
                          }
                        }}
                      >
                        Sign out
                      </button>
                    </>
                  ) : (
                    <>
                      <p>
                        Your plan works without an account. Connect Google to
                        back it up and use it on another device.
                      </p>
                      <GoogleButton busy={busy} onClick={login} />
                      <p className="fine-print">
                        Uses your Google account and Google Cloud Firestore. No
                        access to your Gmail messages, Drive files, or calendar
                        is requested.
                      </p>
                      {window.NativeAndroid && !hasNativeHost() && (
                        <p className="notice">
                          Using the old Android app? Open{" "}
                          <a
                            href="https://tymvera.web.app"
                            target="_blank"
                            rel="noreferrer"
                          >
                            tymvera.web.app in Chrome
                          </a>{" "}
                          for Google sign-in.
                        </p>
                      )}
                    </>
                  )}
                </section>
                <NativeReminders controller={nativeReminders}/>
                <section className="settings-section">
                  <h2>Appearance</h2>
                  <p>Choose what feels comfortable on your screen.</p>
                  <div
                    className="theme-options"
                    role="group"
                    aria-label="Theme"
                  >
                    {["light", "dark", "system"].map((value) => (
                      <button
                        key={value}
                        className={theme === value ? "active" : ""}
                        aria-pressed={theme === value}
                        onClick={() => setTheme(value)}
                      >
                        {value[0].toUpperCase() + value.slice(1)}
                      </button>
                    ))}
                  </div>
                </section>
                <section className="settings-section">
                  <h2>Routine versions</h2>
                  <p>
                    Keep your usual week, class day, half-day class, and other
                    day plans here.
                  </p>
                  <button
                    className="secondary"
                    onClick={() => setManageVersions(true)}
                  >
                    Manage routine versions
                  </button>
                </section>
                <section className="settings-section">
                  <h2>Repeating blocks</h2>
                  <p>
                    {currentRoutineCount
                      ? "Changes here affect upcoming days. Past records stay as they were."
                      : "Choose repeat days when adding a block to build a routine."}
                  </p>
                  {Object.values(plan.routines)
                    .filter((r) => !r.deleted)
                    .map((r) => (
                      <div className="routine-row" key={r.id}>
                        <div>
                          <strong>{r.name}</strong>
                          <p>
                            {r.days.map((d) => WEEKDAYS[d]).join(", ")} ·{" "}
                            {r.duration} min
                          </p>
                        </div>
                        <button
                          className="secondary"
                          onClick={() => {
                            const saved = r;
                            change((p) => ({
                              ...p,
                              routines: {
                                ...p.routines,
                                [r.id]: reviseRoutine(
                                  r,
                                  { deleted: true },
                                  shiftDate(today, 1),
                                ),
                              },
                            }));
                            notify(
                              "Repeating block stopped. Recorded days kept.",
                              () =>
                                change((p) => ({
                                  ...p,
                                  routines: {
                                    ...p.routines,
                                    [r.id]: {
                                      ...saved,
                                      deleted: false,
                                      updatedAt: stamp(),
                                    },
                                  },
                                })),
                            );
                          }}
                        >
                          Stop repeating
                        </button>
                      </div>
                    ))}
                </section>
                <section className="settings-section">
                  <h2>Your data</h2>
                  <p>
                    Keep an independent backup. Import merges records and
                    preserves newer edits.
                  </p>
                  <div className="button-row">
                    <button className="secondary" onClick={exportPlan}>
                      <Icon name="download" size={17} />
                      Export backup
                    </button>
                    <button
                      className="secondary"
                      onClick={() => fileRef.current.click()}
                    >
                      Import backup
                    </button>
                    <input
                      className="sr-only"
                      ref={fileRef}
                      type="file"
                      accept=".json,application/json"
                      onChange={importPlan}
                    />
                  </div>
                  {importError && (
                    <p role="alert" className="error-text">
                      {importError}
                    </p>
                  )}
                  <p className="fine-print">
                    Device storage can be cleared by your browser. Google sync
                    and exported backups offer separate copies. Older TYMVERA
                    history is migrated without deleting the originals.
                  </p>
                  {/Android/i.test(navigator.userAgent) && (
                    <details className="fine-print">
                      <summary>Moving from the old Android app?</summary>
                      <p>
                        Install the update over the old app. Save the old-plan
                        backup when prompted, then import that JSON file here.
                        Sign in with the same Google account to sync it. Keep
                        the old app installed until your data is recovered.
                      </p>
                      <a href="tymvera://recover">Open Android data recovery</a>
                    </details>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </main>
      <footer className="app-footer">
        A little structure. More room to live.
      </footer>
      {message && (
        <div className="toast" role="status">
          <span>{message.text}</span>
          {message.undo && (
            <button
              onClick={() => {
                message.undo();
                setMessage(null);
              }}
            >
              Undo
            </button>
          )}
          <button aria-label="Dismiss message" onClick={() => setMessage(null)}>
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function BlockEditor({
  block,
  routine,
  date,
  onSave,
  onCancel,
  onDelete,
  taskNames = [],
}) {
  const [name, setName] = useState(block?.name || "");
  const [start, setStart] = useState(block?.start || "");
  const [duration, setDuration] = useState(block?.duration || 30);
  const [repeat, setRepeat] = useState(!block);
  const [days, setDays] = useState(
    routine?.days || [new Date(date + "T12:00:00").getDay()],
  );
  const [actualMinutes, setActualMinutes] = useState(
    block?.actualMinutes ?? "",
  );
  const [error, setError] = useState("");
  const form = useRef(null);
  useEffect(() => {
    form.current?.querySelector("input")?.focus();
    form.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);
  function submit(event) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Give this block a name.");
      return;
    }
    if (repeat && !days.length) {
      setError("Choose at least one repeat day.");
      return;
    }
    onSave({
      name: name.trim(),
      start,
      duration: Number(duration),
      days: repeat ? days : [],
      actualMinutes: actualMinutes === "" ? null : Number(actualMinutes),
    });
  }
  return (
    <form
      className="block-editor"
      onSubmit={submit}
      ref={form}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
    >
      <div className="section-heading">
        <h3>{block ? "Edit block" : "A little time for…"}</h3>
        <button
          type="button"
          aria-label="Close block editor"
          onClick={onCancel}
        >
          <Icon name="close" />
        </button>
      </div>
      <label>
        Block name
        <input
          list="saved-task-names"
          name="name"
          maxLength={120}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Read a chapter, go for a walk…"
        />
      </label>
      <datalist id="saved-task-names">
        {taskNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <div className="form-columns">
        <label>
          <span className="field-caption">
            Start time <span>(optional)</span>
          </span>
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label>
          Minutes
          <input
            type="number"
            min="1"
            max="1440"
            required
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </label>
      </div>
      {block && (
        <label>
          Time logged (minutes)
          <input
            type="number"
            min="0"
            max="1440"
            value={actualMinutes}
            onChange={(e) => setActualMinutes(e.target.value)}
          />
          <span>
            Use the time you actually spent. Planned minutes are used when
            marking complete without editing.
          </span>
        </label>
      )}
      <label className="repeat-toggle">
        <input
          type="checkbox"
          checked={repeat}
          onChange={(e) => setRepeat(e.target.checked)}
        />
        {routine ? "Update repeating routine too" : "Repeat on selected days"}
      </label>
      {repeat && (
        <fieldset>
          <legend>Repeat days</legend>
          <div className="repeat-days">
            {WEEKDAYS.map((d, i) => (
              <button
                key={d}
                type="button"
                aria-pressed={days.includes(i)}
                className={days.includes(i) ? "active" : ""}
                onClick={() =>
                  setDays((prev) =>
                    prev.includes(i)
                      ? prev.filter((n) => n !== i)
                      : [...prev, i].sort(),
                  )
                }
              >
                {d}
              </button>
            ))}
          </div>
          <p className="fine-print">
            Starts {formatDate(date)}. Past records stay unchanged.
          </p>
        </fieldset>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <div className="editor-actions">
        <button className="primary" type="submit">
          {block ? "Save changes" : "Add block"}
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {block && (
        <div className="delete-actions">
          <button
            type="button"
            className="danger-text"
            onClick={() => onDelete(block)}
          >
            Remove from this day
          </button>
          {routine && (
            <button
              type="button"
              className="danger-text"
              onClick={() => onDelete(block, true)}
            >
              Remove and stop repeating
            </button>
          )}
        </div>
      )}
    </form>
  );
}
