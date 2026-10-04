import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";

import {
  playAlarmSound,
  stopAlarmSound,
  playNotificationChime,
  calculateAutoWakeTime,
  calculateAutoSleepTime,
  initAudioContextUnlocker,
  startAudioKeepAlive,
} from "./services/alarmEngine";

import {
  checkScheduleNotifications,
  dispatchNotification,
  requestNotificationPermission,
  dispatchAlarmNativeNotification,
  getNotificationPermissionStatus,
  isNotificationGranted,
} from "./services/notificationEngine";

import { startBackgroundWorkerTimer, stopBackgroundWorkerTimer } from "./services/timerWorker";
import TaskSectionTimer from "./components/TaskSectionTimer";
import FloatingTaskTimer from "./components/FloatingTaskTimer";
import FullscreenFocusModal from "./components/FullscreenFocusModal";
import InAppDownloadModal from "./components/InAppDownloadModal";
import { launchSystemPipTimer, openDocumentPipWindow, updateDocumentPipWindow, formatTimerSeconds } from "./services/pipTimerEngine";
import { isAppInstalled, detectUserPlatform, APP_PACKAGE_INFO } from "./services/appDownloadEngine";

import {
  signInWithGoogle,
  signOut,
  onAuthChange,
  syncUserDataToCloud,
  loadUserDataFromCloud,
  getActiveFirebaseConfig,
  saveCustomFirebaseConfig,
} from "./services/firebaseAuth";

import {
  performDeepScanAndRecover,
  exportBackupData,
  parseImportBackup,
  getRawStorageDiagnosticReport,
} from "./services/storageRecovery";

import {
  renderDailyFocusCard,
  shareOrDownloadDailyCard,
  isDailyCardUnlocked,
} from "./services/shareCardEngine";
import { idbGet, idbSet, initDB } from "./storage/indexedDb.js";

// ─── ICON SYSTEM (Zero-Dependency Google Material Symbols) ────────────────────
const normalizeIconName = (name) => {
  if (!name || typeof name !== "string") return "monitoring";
  const legacyMap = {
    Activity: "monitoring",
    Home: "home",
    BarChart2: "bar_chart",
    Settings: "settings",
    CalendarIcon: "calendar_month",
    MoreVertical: "more_vert",
    Check: "check",
    X: "close",
    CheckCircle: "check_circle",
    ArrowRight: "arrow_forward",
    Star: "star",
    Download: "download",
    AlertTriangle: "warning",
    ChevronRight: "chevron_right",
    Wrench: "build",
    Code: "code",
    Dumbbell: "fitness_center",
    Target: "ads_click",
    Book: "menu_book",
    Moon: "dark_mode",
    Coffee: "local_cafe",
    Layout: "dashboard",
    Headphones: "headphones",
    Alarm: "alarm",
    AlarmOn: "alarm_on",
    AlarmOff: "alarm_off",
    Notifications: "notifications",
    Timer: "timer",
  };
  if (legacyMap[name]) return legacyMap[name];
  return name.toLowerCase().replace(/-/g, "_");
};

const Icon = ({ name, size = 24, className = "", style = {} }) => (
  <span
    className={`material-symbols-rounded ${className}`}
    style={{ fontSize: size, lineHeight: 1, userSelect: "none", ...style }}
  >
    {normalizeIconName(name)}
  </span>
);

// ─── ERROR BOUNDARY (Production Fail-Safe) ────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("TYMVERA Crash Intercepted:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            backgroundColor: "#080808",
            color: "white",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            fontFamily: "sans-serif",
          }}
        >
          <Icon
            name="build"
            size={48}
            style={{ color: "#FF3B30", marginBottom: "1rem" }}
          />
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: "bold",
              marginBottom: "0.5rem",
            }}
          >
            System Error
          </h1>
          <p
            style={{
              color: "#9ca3af",
              textAlign: "center",
              fontSize: "0.875rem",
              marginBottom: "1rem",
              maxWidth: "22rem",
            }}
          >
            An unexpected error occurred during execution.
          </p>
          {this.state.error && (
            <div
              style={{
                backgroundColor: "#161616",
                border: "1px solid #333",
                borderRadius: "0.75rem",
                padding: "0.75rem",
                fontSize: "0.75rem",
                fontFamily: "monospace",
                color: "#ff6b6b",
                maxWidth: "22rem",
                maxHeight: "6rem",
                overflowY: "auto",
                marginBottom: "1.5rem",
                wordBreak: "break-word",
              }}
            >
              {this.state.error.message || String(this.state.error)}
            </div>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              backgroundColor: "#3b82f6",
              color: "white",
              fontWeight: "bold",
              padding: "0.75rem 2rem",
              borderRadius: "9999px",
              border: "none",
              width: "100%",
              maxWidth: "20rem",
              cursor: "pointer",
              marginBottom: "0.75rem",
            }}
          >
            Reload App
          </button>
          <button
            onClick={() => {
              try {
                const dump = {};
                for (let i = 0; i < localStorage.length; i++) {
                  const k = localStorage.key(i);
                  dump[k] = localStorage.getItem(k);
                }
                const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `tymvera-emergency-backup-${Date.now()}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              } catch(e) {
                alert("Failed to dump data: " + e.message);
              }
            }}
            style={{
              backgroundColor: "rgba(59, 130, 246, 0.15)",
              color: "#60a5fa",
              fontWeight: "bold",
              padding: "0.75rem 2rem",
              borderRadius: "9999px",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              width: "100%",
              maxWidth: "20rem",
              cursor: "pointer",
              marginBottom: "0.75rem",
            }}
          >
            Emergency Export Local Data
          </button>
          <button
            onClick={() => {
              if (window.confirm("Wipe local database? Only do this after exporting backup.")) {
                const req = indexedDB.deleteDatabase("TYMVERA_PWA_DB");
                req.onsuccess = () => window.location.reload();
                req.onerror = () => {
                  alert("Failed to wipe data. Try manually clearing browser cache.");
                  window.location.reload();
                };
                req.onblocked = () => {
                  alert("Please close all other tabs running this app to wipe data.");
                  window.location.reload();
                };
              }
            }}
            style={{
              backgroundColor: "transparent",
              color: "#FF3B30",
              fontWeight: "bold",
              padding: "0.75rem 2rem",
              borderRadius: "9999px",
              border: "2px solid #FF3B30",
              width: "100%",
              maxWidth: "20rem",
              cursor: "pointer",
            }}
          >
            Wipe Data & Reset
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── ONLINE STATUS HOOK ───────────────────────────────────────────────────────
const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" && typeof navigator.onLine === "boolean"
      ? navigator.onLine
      : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
};

// ─── PWA & SERVICE WORKER HOOK ────────────────────────────────────────────────
const usePWA = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    if (!document.getElementById("hide-csb-watermark")) {
      const style = document.createElement("style");
      style.id = "hide-csb-watermark";
      style.innerHTML = `
          body > *:not(#root):not(script):not(style):not(noscript) { display: none !important; opacity: 0 !important; pointer-events: none !important; z-index: -9999 !important; }
          iframe { display: none !important; opacity: 0 !important; pointer-events: none !important; }
          a[href*="codesandbox.io"] { display: none !important; opacity: 0 !important; pointer-events: none !important; }
      `;
      document.head.appendChild(style);
    }

    const absoluteIconUrl = window.location.origin + "/icon.png";

    // Maintain static /manifest.json link
    let link = document.querySelector('link[rel="manifest"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      link.href = "/manifest.json";
      document.head.appendChild(link);
    }

    let appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
    if (!appleIcon) {
      appleIcon = document.createElement("link");
      appleIcon.rel = "apple-touch-icon";
      appleIcon.href = absoluteIconUrl;
      document.head.appendChild(appleIcon);
    }

    // Register production Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          if (reg) {
            reg.update().catch(() => {});
          }
        })
        .catch((err) => {
          console.warn("[TYMVERA] Service worker registration note:", err);
        });
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  return { deferredPrompt, setDeferredPrompt };
};

// ─── CONFIG & DEFAULTS ────────────────────────────────────────────────────────
const ICONS = [
  "monitoring",
  "alarm",
  "menu_book",
  "fitness_center",
  "directions_run",
  "pool",
  "self_improvement",
  "hiking",
  "restaurant",
  "local_cafe",
  "sports_esports",
  "terminal",
  "code",
  "laptop_mac",
  "brush",
  "palette",
  "music_note",
  "headset",
  "school",
  "science",
  "calculate",
  "language",
  "directions_car",
  "pedal_bike",
  "local_grocery_store",
  "shopping_cart",
  "flight",
  "work",
  "attach_file",
  "edit_square",
  "folder",
  "cloud",
  "dark_mode",
  "light_mode",
  "wb_twilight",
  "check_circle",
  "star",
  "battery_charging_full",
  "psychology",
  "architecture",
  "sports_soccer",
  "directions_walk",
  "church",
  "theater_comedy",
];

const PRIORITIES = [
  { id: "high", label: "High Priority", short: "HIGH", weight: 4, color: "#FF3B30", bg: "rgba(255, 59, 48, 0.15)", border: "border-red-500/40" },
  { id: "medium", label: "Medium Priority", short: "MED", weight: 3, color: "#0A84FF", bg: "rgba(10, 132, 255, 0.15)", border: "border-blue-500/40" },
  { id: "low", label: "Low Priority", short: "LOW", weight: 2, color: "#FF9F0A", bg: "rgba(255, 159, 10, 0.15)", border: "border-amber-500/40" },
  { id: "lowest", label: "Lowest Priority", short: "MIN", weight: 1, color: "#8E8E93", bg: "rgba(142, 142, 147, 0.15)", border: "border-gray-500/40" },
];

const WEIGHTS = {
  high: 4,
  highest: 4,
  medium: 3,
  low: 2,
  lower: 2,
  lowest: 1,
};

const pColor = (priority) => {
  const p = String(priority || "").toLowerCase();
  if (p === "high" || p === "highest") return "#FF3B30";
  if (p === "medium") return "#0A84FF";
  if (p === "low" || p === "lower") return "#FF9F0A";
  if (p === "lowest") return "#8E8E93";
  return "#0A84FF";
};

const pBadge = (priority) => {
  const p = String(priority || "").toLowerCase();
  if (p === "high" || p === "highest") return { text: "HIGH", color: "#FF3B30", bg: "bg-red-500/15 text-red-500 border-red-500/30" };
  if (p === "medium") return { text: "MED", color: "#0A84FF", bg: "bg-blue-500/15 text-blue-500 border-blue-500/30" };
  if (p === "low" || p === "lower") return { text: "LOW", color: "#FF9F0A", bg: "bg-amber-500/15 text-amber-500 border-amber-500/30" };
  if (p === "lowest") return { text: "MIN", color: "#8E8E93", bg: "bg-gray-500/15 text-gray-400 border-gray-500/30" };
  return { text: "MED", color: "#0A84FF", bg: "bg-blue-500/15 text-blue-500 border-blue-500/30" };
};

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

const DEFAULT_PRESETS = [];

// ─── UTILITIES ────────────────────────────────────────────────────────────────
const localDateStr = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};
const todayStr = () => localDateStr(new Date());

const to12hObj = (t) => {
  if (!t || typeof t !== "string" || !t.includes(":"))
    return { time: "", period: "" };
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return { time: `${h % 12 || 12}:${String(m).padStart(2, "0")}`, period: ap };
};
const to12h = (t) => {
  const o = to12hObj(t);
  return `${o.time} ${o.period}`;
};

const mins = (s, e) => {
  if (
    !s ||
    !e ||
    typeof s !== "string" ||
    typeof e !== "string" ||
    !s.includes(":") ||
    !e.includes(":")
  )
    return 0;
  const [sh, sm] = s.split(":").map(Number);
  const [eh, em] = e.split(":").map(Number);
  let diff = eh * 60 + em - (sh * 60 + sm);
  if (diff <= 0) diff += 24 * 60;
  return diff;
};

const calcScore = (blocks, progress) => {
  if (!blocks || !Array.isArray(blocks) || !blocks.length) return 0;
  let earned = 0,
    total = 0,
    zeroXpCompleted = 0;
  blocks.forEach((b) => {
    if (!b) return;
    const p = (progress || {})[b.id];
    if (b.zeroXp) {
      if (p && p.status === "completed") zeroXpCompleted++;
      return;
    }
    const w = WEIGHTS[b.priority] || 2;
    total += w;
    if (!p || p.status === "pending" || p.status === "missed") return;

    if (p.status === "completed") {
      earned += w;
    } else if (p.status === "partial") {
      const d = mins(b.start, b.end);
      const ratio = d > 0 ? (p.actualMins || 0) / d : 0;
      earned += w * Math.max(0, ratio);
    }
  });
  if (total === 0) return zeroXpCompleted > 0 ? 100 : 0;
  return Math.round((earned / total) * 100);
};

const useLongPress = (callback = () => {}, ms = 500) => {
  const timerRef = useRef();
  const start = useCallback(
    (e) => {
      timerRef.current = setTimeout(() => {
        if (navigator.vibrate) navigator.vibrate(50);
        callback(e);
      }, ms);
    },
    [callback, ms]
  );
  const stop = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);
  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: stop,
    onTouchStart: start,
    onTouchEnd: stop,
    onTouchMove: stop,
  };
};

// ─── TASK ITEM COMPONENT ──────────────────────────────────────────────────────
const TaskItem = ({
  block,
  status,
  prog,
  isCurrent,
  currentProgress,
  isDark,
  themeColors,
  onMark,
  onUnmark,
  onOpenPartial,
  onEdit,
  onDeleteFromToday,
  onDeletePreset,
  onDuplicate,
  isTimerActive,
  isTimerPaused,
  remainingSeconds,
  totalSeconds,
  isDetached,
  onTogglePause,
  onDetachTimer,
  onDockBack,
  onOpenFullscreen,
  onStartFocusTimer,
  onLaunchPip,
  onInAppToast,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [offset, setOffset] = useState(0);

  // Long-press (tap and hold) refs
  const longPressTimerRef = useRef(null);
  const pointerStartRef = useRef({ x: 0, y: 0, time: 0 });
  const isDetachedByHoldRef = useRef(false);

  const duration = mins(block.start, block.end);
  const actualMins = prog?.actualMins || 0;
  const isOvertime = status === "partial" && actualMins > duration;
  const overtimeMins = isOvertime ? actualMins - duration : 0;
  const sessionPct = duration > 0 ? Math.round((actualMins / duration) * 100) : 100;
  const [sh, sm] = (block.start || "00:00").split(":").map(Number);
  const [eh] = (block.end || "00:00").split(":").map(Number);
  const isCrossMidnight = eh < sh;

  // Responsive pointer handlers for routine card (clean hand cursor, reliable PiP launch on tap/hold/drag)
  const handleCardPointerDown = (e) => {
    if (e.target.closest("button") || e.target.closest("a") || e.target.closest(".no-drag")) return;
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX);
    const clientY = e.clientY || (e.touches && e.touches[0]?.clientY);
    if (typeof clientX !== "number" || typeof clientY !== "number") return;

    pointerStartRef.current = { x: clientX, y: clientY, time: Date.now() };
    isDetachedByHoldRef.current = false;

    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

    // Subtle 260ms haptic indicator
    longPressTimerRef.current = setTimeout(() => {
      isDetachedByHoldRef.current = true;
      if (navigator.vibrate) {
        try { navigator.vibrate(30); } catch (v) {}
      }
    }, 260);
  };

  const handleCardPointerMove = (e) => {
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX);
    const clientY = e.clientY || (e.touches && e.touches[0]?.clientY);
    if (typeof clientX !== "number" || typeof clientY !== "number") return;

    const deltaX = Math.abs(clientX - pointerStartRef.current.x);
    const deltaY = Math.abs(clientY - pointerStartRef.current.y);

    // Cancel long press if user is scrolling page
    if (!isDetachedByHoldRef.current && (deltaX > 8 || deltaY > 8)) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      // Horizontal swipe to complete routine
      if (deltaX > deltaY && clientX > pointerStartRef.current.x && deltaX < 90) {
        setOffset(clientX - pointerStartRef.current.x);
      }
    }
  };

  const handleCardPointerUp = (e) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (offset > 45) {
      if (status !== "completed") onMark(block.id, "completed");
      else onUnmark(block.id);
    }
    setOffset(0);

    const duration = Date.now() - pointerStartRef.current.time;
    const clientX = e.clientX || (e.changedTouches && e.changedTouches[0]?.clientX);
    const clientY = e.clientY || (e.changedTouches && e.changedTouches[0]?.clientY);
    const dist = clientX ? Math.hypot(clientX - pointerStartRef.current.x, clientY - pointerStartRef.current.y) : 0;

    // DIRECT SYNCHRONOUS USER GESTURE!
    // Triggers on: quick tap, hold-and-release, or drag-and-release on active routine
    if (isCurrent && onLaunchPip) {
      const isQuickTap = duration < 350 && dist < 12;
      const isHoldRelease = isDetachedByHoldRef.current || duration >= 260;
      const isDragRelease = dist > 20;

      if (isQuickTap || isHoldRelease || isDragRelease) {
        onLaunchPip();
      }
    }

    isDetachedByHoldRef.current = false;
  };

  let badgeBorder = "border-transparent";
  let statusBadge = null;

  if (status === "completed") {
    badgeBorder = "border-[#32D74B]/40";
    statusBadge = (
      <span className="text-[10px] font-black uppercase tracking-wider bg-[#32D74B]/15 text-[#32D74B] px-2 py-0.5 rounded-full flex items-center gap-1">
        <Icon name="check" size={12} /> Done
      </span>
    );
  } else if (status === "partial") {
    if (isOvertime) {
      badgeBorder = "border-emerald-500/60 shadow-lg shadow-emerald-500/15 ring-1 ring-emerald-500/30";
      statusBadge = (
        <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm shadow-emerald-500/20 animate-pulse">
          <Icon name="bolt" size={12} /> {actualMins}m · {sessionPct}% (+{overtimeMins}m)
        </span>
      );
    } else {
      badgeBorder = "border-[#FF9F0A]/40";
      statusBadge = (
        <span className="text-[10px] font-black uppercase tracking-wider bg-[#FF9F0A]/15 text-[#FF9F0A] px-2 py-0.5 rounded-full flex items-center gap-1">
          <Icon name="timelapse" size={12} /> {actualMins}m ({sessionPct}%)
        </span>
      );
    }
  } else if (status === "missed") {
    badgeBorder = "border-[#FF3B30]/40";
    statusBadge = (
      <span className="text-[10px] font-black uppercase tracking-wider bg-[#FF3B30]/15 text-[#FF3B30] px-2 py-0.5 rounded-full flex items-center gap-1">
        <Icon name="close" size={12} /> Skipped
      </span>
    );
  }

  return (
    <div className="relative mb-3 select-none">
      {/* Swipe reveal background */}
      <div
        className="absolute inset-0 bg-[#32D74B] rounded-3xl flex items-center pl-6 text-white font-black text-sm"
        style={{ opacity: Math.min(1, offset / 40) }}
      >
        <Icon name="check" size={24} />
      </div>

      <div
        onPointerDown={handleCardPointerDown}
        onPointerMove={handleCardPointerMove}
        onPointerUp={handleCardPointerUp}
        onTouchStart={handleCardPointerDown}
        onTouchMove={handleCardPointerMove}
        onTouchEnd={handleCardPointerUp}
        style={{ transform: `translateX(${offset}px)`, transition: offset === 0 ? "transform 0.2s" : "none" }}
        className={`relative cursor-pointer ${themeColors.surface} ${
          isOvertime ? "bg-gradient-to-br from-emerald-500/[0.08] via-transparent to-transparent" : ""
        } border ${
          isCurrent
            ? "border-blue-500 shadow-md shadow-blue-500/10 ring-1 ring-blue-500/30"
            : badgeBorder !== "border-transparent"
            ? badgeBorder
            : themeColors.border
        } rounded-3xl p-5 overflow-hidden transition-all`}
      >
        {/* ─── BACKGROUND COMPLETED PROGRESS FILL ─── */}
        {/* Progressively covers the block with the completed portion from a small line to the full box */}
        {isCurrent && (
          <div
            className="absolute inset-y-0 left-0 pointer-events-none transition-all duration-1000 ease-linear z-0"
            style={{
              width: `${Math.max(1, Math.min(100, currentProgress))}%`,
              background: isDark
                ? "linear-gradient(90deg, rgba(37, 99, 235, 0.18) 0%, rgba(59, 130, 246, 0.32) 98%, rgba(96, 165, 250, 0.85) 100%)"
                : "linear-gradient(90deg, rgba(37, 99, 235, 0.12) 0%, rgba(59, 130, 246, 0.22) 98%, rgba(37, 99, 235, 0.7) 100%)",
            }}
          >
            {/* The leading edge line, initially a small line at 0-1%, filling across the box */}
            <div className="absolute top-0 bottom-0 right-0 w-[2.5px] bg-blue-500 shadow-[0_0_12px_#3b82f6]" />
          </div>
        )}

        <div className="flex justify-between items-start relative z-10">
          <div className="flex items-center gap-3.5 flex-1 min-w-0">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                status === "completed"
                  ? "bg-[#32D74B]/15 text-[#32D74B]"
                  : status === "partial" && isOvertime
                  ? "bg-emerald-500/25 text-emerald-400 border border-emerald-500/40 shadow-md shadow-emerald-500/20"
                  : status === "partial"
                  ? "bg-[#FF9F0A]/15 text-[#FF9F0A]"
                  : isCurrent
                  ? "bg-blue-500 text-white shadow-md shadow-blue-500/20"
                  : `${themeColors.surface2} ${themeColors.text2}`
              }`}
            >
              <Icon name={isOvertime ? "bolt" : block.icon || "monitoring"} size={22} />
            </div>

            <div className="flex-1 min-w-0 pr-2">
              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                <span className="font-black text-base truncate text-gray-900 dark:text-white">
                  {block.name}
                </span>
                {/* Priority Badge */}
                {block.priority && !block.zeroXp && (
                  <span
                    className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${pBadge(block.priority).bg}`}
                  >
                    {pBadge(block.priority).text}
                  </span>
                )}
                {/* Status Badge */}
                {statusBadge}
                {/* 0XP Badge */}
                {block.zeroXp && (
                  <span className="text-[9px] uppercase tracking-wider bg-purple-500/15 text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded font-black flex items-center gap-0.5">
                    0XP
                  </span>
                )}
              </div>
              <div className="text-xs font-mono font-medium text-gray-500 flex items-center gap-1.5 flex-wrap">
                <span>
                  {to12h(block.start)} – {to12h(block.end)}
                </span>
                {isCrossMidnight && (
                  <span className="text-[9px] text-[#BF5AF2] font-bold uppercase">(NEXT DAY)</span>
                )}
                <span>•</span>
                <span>{duration}m</span>
                {isCurrent && (
                  <span className="text-blue-500 font-bold ml-1 animate-pulse">● In Progress</span>
                )}
                {!isTimerActive && onStartFocusTimer && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartFocusTimer(block);
                    }}
                    className="ml-1 px-2 py-0.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 text-[10px] font-bold flex items-center gap-1 transition-colors active:scale-95"
                    title="Activate timer for this routine"
                  >
                    <Icon name="timer" size={12} />
                    <span>Focus</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="relative flex-shrink-0">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={`w-8 h-8 rounded-full flex items-center justify-center ${themeColors.text3} hover:bg-gray-100 dark:hover:bg-[#222]`}
            >
              <Icon name="more_vert" size={20} />
            </button>

            {menuOpen && (
              <div
                className={`absolute right-0 top-10 w-44 rounded-2xl ${themeColors.surface} border ${themeColors.border} shadow-2xl z-50 py-2 animate-in fade-in zoom-in-95 duration-150`}
              >
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit(block);
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs font-bold flex items-center gap-2.5 hover:bg-gray-100 dark:hover:bg-[#222]"
                >
                  <Icon name="edit" size={16} /> Edit Routine
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    if (onDuplicate) onDuplicate(block);
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs font-bold flex items-center gap-2.5 hover:bg-gray-100 dark:hover:bg-[#222]"
                >
                  <Icon name="content_copy" size={16} className="text-blue-500" /> Duplicate Routine
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onDeleteFromToday(block.id);
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs font-bold text-amber-500 flex items-center gap-2.5 hover:bg-gray-100 dark:hover:bg-[#222]"
                >
                  <Icon name="event_busy" size={16} /> Skip Today Only
                </button>
                {onDeletePreset && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      if (window.confirm(`Permanently remove routine "${block.name}"?`)) {
                        onDeletePreset(block.id);
                      }
                    }}
                    className="w-full px-4 py-2.5 text-left text-xs font-bold text-[#FF3B30] flex items-center gap-2.5 hover:bg-gray-100 dark:hover:bg-[#222]"
                  >
                    <Icon name="delete_forever" size={16} /> Delete Routine
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ─── IN-SECTION ROUTINE TIMER (NO BOTTLE) ─── */}
        {isTimerActive && !isDetached && (
          <div className="relative z-10">
            <TaskSectionTimer
              block={block}
              isCurrent={isCurrent}
              isPaused={isTimerPaused}
              remainingSeconds={remainingSeconds}
              totalSeconds={totalSeconds}
              completedPct={currentProgress}
              onTogglePause={onTogglePause}
              onOpenFullscreen={onOpenFullscreen}
              onInAppToast={onInAppToast}
              onLaunchPip={onLaunchPip}
              isDark={isDark}
              themeColors={themeColors}
            />
          </div>
        )}

        {isTimerActive && isDetached && (
          <div className="my-2.5 p-3 rounded-2xl bg-blue-500/10 border border-dashed border-blue-500/30 flex items-center justify-between text-xs text-blue-500 font-mono relative z-10">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
              <span>Timer detached & floating</span>
            </span>
            <button
              type="button"
              onClick={onDockBack}
              className="text-[10px] uppercase font-black px-2.5 py-1 rounded-xl bg-blue-500 text-white hover:bg-blue-600 transition-colors shadow-sm"
            >
              Dock Back
            </button>
          </div>
        )}

        {/* Partial & Overtime Visual Progress Bar */}
        {status === "partial" && (
          <div className="mt-3 pt-2.5 border-t border-gray-100/60 dark:border-[#222]">
            <div className="flex justify-between items-center text-[10px] font-mono font-bold mb-1.5">
              <span className={isOvertime ? "text-emerald-400 flex items-center gap-1 font-black" : "text-[#FF9F0A] flex items-center gap-1"}>
                <Icon name={isOvertime ? "bolt" : "timelapse"} size={12} />
                {isOvertime ? `Overtime +${overtimeMins}m (${sessionPct}%)` : `${sessionPct}% Logged`}
              </span>
              <span className="text-gray-400 font-medium">
                {actualMins}m / {duration}m target
              </span>
            </div>
            <div className="w-full bg-black/10 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  isOvertime
                    ? "bg-gradient-to-r from-emerald-500 to-[#32D74B] shadow-sm shadow-emerald-500/50"
                    : "bg-[#FF9F0A]"
                }`}
                style={{ width: `${Math.min(100, sessionPct)}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Buttons Row */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-[#1e1e1e]">
          <button
            onClick={() => onMark(block.id, "completed")}
            className={`py-2 px-1 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 ${
              status === "completed"
                ? "bg-[#32D74B] text-black shadow-sm"
                : "bg-gray-100 dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 active:scale-95"
            }`}
          >
            <Icon name="check" size={14} /> Done
          </button>

          <button
            onClick={() => onOpenPartial(block)}
            className={`py-2 px-1 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 ${
              status === "partial" && isOvertime
                ? "bg-gradient-to-r from-emerald-500 to-[#32D74B] text-black shadow-md shadow-emerald-500/25"
                : status === "partial"
                ? "bg-[#FF9F0A] text-black shadow-sm"
                : "bg-gray-100 dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 active:scale-95"
            }`}
          >
            <Icon name={isOvertime ? "bolt" : "timer"} size={14} />
            {isOvertime
              ? `Overtime (${actualMins}m)`
              : status === "partial"
              ? `Partial (${actualMins}m)`
              : "Partial"}
          </button>

          <button
            onClick={() => onMark(block.id, "missed")}
            className={`py-2 px-1 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 ${
              status === "missed"
                ? "bg-[#FF3B30] text-white shadow-sm"
                : "bg-gray-100 dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 active:scale-95"
            }`}
          >
            <Icon name="close" size={14} /> Skip
          </button>
        </div>

        {status && status !== "pending" && (
          <button
            onClick={() => onUnmark(block.id)}
            className="w-full text-center text-[10px] font-bold text-gray-400 mt-2 hover:underline"
          >
            Undo status
          </button>
        )}
      </div>
    </div>
  );
};

// ─── MAIN APP COMPONENT (TYMVERA) ─────────────────────────────────────────────
function TYMVERA() {
  const [isReady, setIsReady] = useState(false);
  const [tab, setTab] = useState("today");
  const [selDate, setSelDate] = useState(todayStr());
  const [now, setNow] = useState(new Date());

  const [history, setHistory] = useState({});
  const [presets, setPresets] = useState([]);
  const [themeMode, setThemeMode] = useState("system");

  // Alarms State (Single Signature Obsidian Beacon Sound)
  const [alarms, setAlarms] = useState({
    wake: { enabled: false, time: "05:00", autoSync: false },
    sleep: { enabled: false, time: "22:00", autoSync: false },
  });
  const [activeAlarm, setActiveAlarm] = useState(null);

  // Notifications State (Enabled by default for instant milestone alerts)
  const [notificationConfig, setNotificationConfig] = useState({
    enabled: true,
    leadMins: 0, // 0 for exact instant time
    notifyStart: true,
    notifyEnd: true,
    sound: true,
  });
  const [inAppToast, setInAppToast] = useState(null);
  const [notificationPermission, setNotificationPermission] = useState(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default"
  );
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [testingCountdown, setTestingCountdown] = useState(null);

  // Authentication & Cloud Sync State
  const [currentUser, setCurrentUser] = useState(null);
  const [cloudSyncStatus, setCloudSyncStatus] = useState("idle");
  const [showFirebaseModal, setShowFirebaseModal] = useState(false);
  const [showAddTaskGraphModal, setShowAddTaskGraphModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const userPlatform = useMemo(() => detectUserPlatform(), []);
  const isStandaloneApp = useMemo(() => isAppInstalled(), []);
  const [lastSyncedTime, setLastSyncedTime] = useState(null);

  // Storage Inspector State
  const [showStorageInspector, setShowStorageInspector] = useState(false);
  const [storageReport, setStorageReport] = useState(null);

  // ─── IN-SECTION & FLOATING BOTTLE TIMER STATE ──────────────────────────────
  const [selectedFocusBlockId, setSelectedFocusBlockId] = useState(null);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [pausedSeconds, setPausedSeconds] = useState(null);
  const [detachedTimer, setDetachedTimer] = useState(null); // { block, coords }
  const [fullscreenTimerBlock, setFullscreenTimerBlock] = useState(null);

  // Boot safety refs (prevent empty-state overwrite of existing data)
  const hasCompletedInitialLoadRef = useRef(false);
  const hadPriorDataRef = useRef(false);

  // Modals & UI Controls
  const [partialModal, setPartialModal] = useState(null);
  const [partialMins, setPartialMins] = useState(30);
  const [partialReason, setPartialReason] = useState("Time shortage");
  const [editingPreset, setEditingPreset] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [cMon, setCMon] = useState(new Date());

  // Analytics & Graph Controls
  const [tf, setTf] = useState(7);
  const [filterTask, setFilterTask] = useState("ALL");
  const [chartViewMode, setChartViewMode] = useState("line");
  const [scrubberPoint, setScrubberPoint] = useState(null);
  const [burst, setBurst] = useState(false);

  // Storage & Recovery State
  const [isScanningStorage, setIsScanningStorage] = useState(false);
  const [scanReport, setScanReport] = useState(null);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupJsonInput, setBackupJsonInput] = useState("");

  // Daily Focus Story Card State (Viral loop unlocked by real study time)
  const [showShareCardModal, setShowShareCardModal] = useState(false);
  const [shareCardPreview, setShareCardPreview] = useState(null);
  const [isGeneratingCard, setIsGeneratingCard] = useState(false);

  const handleAddToast = useCallback((toast) => {
    setInAppToast(toast);
    setTimeout(() => {
      setInAppToast((prev) => (prev && prev.id === toast.id ? null : prev));
    }, 6000);
  }, []);

  const { deferredPrompt, setDeferredPrompt } = usePWA();
  const isOnline = useOnlineStatus();

  // ─── INITIAL BOOT & STORAGE LOADING ─────────────────────────────────────────
  useEffect(() => {
    document.title = "TYMVERA";
    initAudioContextUnlocker();
    startAudioKeepAlive();

    const handleVisChange = () => {
      startAudioKeepAlive();
      setNow(new Date());

      if (typeof window !== "undefined" && "Notification" in window) {
        setNotificationPermission(Notification.permission);
      }

      // If app is placed in background or screen is locked, ensure service worker has latest schedule
      if (document.visibilityState === "hidden") {
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: "SYNC_SCHEDULE",
            blocks: presets,
            alarms,
            config: notificationConfig,
          });
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisChange);
    window.addEventListener("focus", handleVisChange);

    let twLoaded = false;
    let dbLoaded = false;

    const checkReady = () => {
      if (twLoaded && dbLoaded) setIsReady(true);
    };

    // Fail-safe maximum splash duration (400ms) to guarantee app unblocks immediately
    const failSafeTimer = setTimeout(() => {
      setIsReady(true);
    }, 400);

    async function loadData() {
      try {
        if (!document.getElementById("tailwind-script") && !window.tailwind) {
          const script = document.createElement("script");
          script.id = "tailwind-script";
          script.src = "https://cdn.tailwindcss.com";
          script.onload = () => {
            twLoaded = true;
            checkReady();
          };
          script.onerror = () => {
            twLoaded = true;
            checkReady();
          };
          document.head.appendChild(script);
        } else {
          twLoaded = true;
        }

        if (window.tailwind) {
          if (!window.tailwind.config) window.tailwind.config = {};
          window.tailwind.config.darkMode = "class";
        }

        if (!document.getElementById("material-icons")) {
          const link = document.createElement("link");
          link.id = "material-icons";
          link.href =
            "https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,600,0,0";
          link.rel = "stylesheet";
          document.head.appendChild(link);
        }

        initAudioContextUnlocker();

        let hist = await idbGet("fo6_history", null);
        let pres = await idbGet("fo6_presets", null);
        const th = await idbGet("fo6_theme", "system");
        const savedAlarms = await idbGet("fo6_alarms", {
          wake: { enabled: false, time: "05:00", autoSync: false },
          sleep: { enabled: false, time: "22:00", autoSync: false },
        });
        const savedNotif = await idbGet("fo6_notif_config", {
          enabled: true,
          leadMins: 0,
          notifyStart: true,
          notifyEnd: true,
          sound: true,
        });
        const savedChart = await idbGet("fo6_chart_mode", "line");

        // 1. Dual-Storage Check: if hist not found in IndexedDB, check localStorage mirrors
        if (!hist || typeof hist !== "object" || Object.keys(hist).length === 0) {
          try {
            const rawLs =
              localStorage.getItem("fo6_history") ||
              localStorage.getItem("tymvera_history_master_backup");
            if (rawLs) {
              const parsed = JSON.parse(rawLs);
              if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
                hist = parsed;
              }
            }
          } catch (e) {}
        }

        // 2. Universal Deep Scan on startup if history is empty (recover all past keys from device)
        if (!hist || typeof hist !== "object" || Object.keys(hist).length === 0) {
          const scanRes = await performDeepScanAndRecover({
            currentHistory: {},
            currentPresets: pres && pres.length > 0 ? pres : DEFAULT_PRESETS,
          });
          if (scanRes && scanRes.mergedHistory && Object.keys(scanRes.mergedHistory).length > 0) {
            hist = scanRes.mergedHistory;
            if (scanRes.mergedPresets && scanRes.mergedPresets.length > 0) {
              pres = scanRes.mergedPresets;
            }
            setTimeout(() => {
              handleAddToast({
                id: `toast_recovered_${Date.now()}`,
                title: "✨ Progress Recovered",
                body: `Found & restored ${scanRes.stats.totalDays} days of activity from local storage.`,
                timestamp: new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              });
            }, 1000);
          }
        }

        // 2. Remove legacy template sample routines if present
        const LEGACY_SAMPLE_IDS = new Set(["p1", "p2", "p7", "p10"]);
        if (Array.isArray(pres)) {
          const cleanedPres = pres.filter(
            (p) =>
              p &&
              !LEGACY_SAMPLE_IDS.has(p.id) &&
              p.name !== "Skills / Python / AI" &&
              p.name !== "Gym" &&
              p.name !== "Study (Evening)"
          );
          if (cleanedPres.length !== pres.length) {
            pres = cleanedPres;
            await idbSet("fo6_presets", pres);
            try {
              localStorage.setItem("fo6_presets", JSON.stringify(pres));
            } catch (e) {}
          }
        }

        // Clean uncompleted legacy template sample blocks from today's timeline
        if (hist && typeof hist === "object") {
          const today = todayStr();
          if (hist[today] && Array.isArray(hist[today].blocksList)) {
            const hasLegacy = hist[today].blocksList.some(
              (b) =>
                b &&
                (LEGACY_SAMPLE_IDS.has(b.id) ||
                  b.name === "Skills / Python / AI" ||
                  b.name === "Gym" ||
                  b.name === "Study (Evening)")
            );
            if (hasLegacy) {
              const cleanedList = hist[today].blocksList.filter(
                (b) =>
                  b &&
                  !LEGACY_SAMPLE_IDS.has(b.id) &&
                  b.name !== "Skills / Python / AI" &&
                  b.name !== "Gym" &&
                  b.name !== "Study (Evening)"
              );
              const cleanedBlocks = {};
              for (const [k, v] of Object.entries(hist[today].blocks || {})) {
                if (!LEGACY_SAMPLE_IDS.has(k)) cleanedBlocks[k] = v;
              }
              const s = calcScore(cleanedList, cleanedBlocks);
              hist = {
                ...hist,
                [today]: {
                  ...hist[today],
                  blocksList: cleanedList,
                  blocks: cleanedBlocks,
                  dailyScore: s,
                },
              };
              await idbSet("fo6_history", hist);
              try {
                localStorage.setItem("fo6_history", JSON.stringify(hist));
              } catch (e) {}
            }
          }
        }

        setHistory(hist || {});
        setPresets(Array.isArray(pres) ? pres : []);
        setThemeMode(th || "system");
        setAlarms(savedAlarms);
        setNotificationConfig(savedNotif);
        setChartViewMode(savedChart);

        if (typeof window !== "undefined" && "Notification" in window) {
          setNotificationPermission(Notification.permission);
          if (Notification.permission === "granted") {
            setNotificationConfig((prev) => ({ ...prev, enabled: true }));
          }
        }

        dbLoaded = true;
        hasCompletedInitialLoadRef.current = true;
        checkReady();
      } catch (err) {
        console.error("Boot Error:", err);
      }
    }
    loadData();
    return () => {
      document.removeEventListener("visibilitychange", handleVisChange);
      window.removeEventListener("focus", handleVisChange);
    };
  }, [handleAddToast]);

  // ─── RECONCILE CLOUD & LOCAL DATA NON-DESTRUCTIVELY ────────────────────────
  const reconcileCloudAndLocal = useCallback((localHistory, cloudHistory) => {
    const merged = { ...(cloudHistory || {}), ...(localHistory || {}) };
    const allDates = new Set([
      ...Object.keys(localHistory || {}),
      ...Object.keys(cloudHistory || {}),
    ]);

    allDates.forEach((ds) => {
      const lDay = localHistory ? localHistory[ds] : null;
      const cDay = cloudHistory ? cloudHistory[ds] : null;
      if (lDay && cDay) {
        const mergedBlocks = {
          ...(cDay.blocks || {}),
          ...(lDay.blocks || {}),
        };
        // Preserve completed/partial tasks from either cloud or local
        Object.entries(cDay.blocks || {}).forEach(([bid, bProg]) => {
          if (bProg && (bProg.status === "completed" || bProg.status === "partial")) {
            if (!lDay.blocks || !lDay.blocks[bid] || lDay.blocks[bid].status === "pending") {
              mergedBlocks[bid] = bProg;
            }
          }
        });
        merged[ds] = {
          ...cDay,
          ...lDay,
          blocks: mergedBlocks,
          blocksList:
            lDay.blocksList && lDay.blocksList.length > 0
              ? lDay.blocksList
              : cDay.blocksList || [],
          dailyScore: Math.max(lDay.dailyScore || 0, cDay.dailyScore || 0),
        };
      } else if (cDay) {
        merged[ds] = cDay;
      } else if (lDay) {
        merged[ds] = lDay;
      }
    });

    return merged;
  }, []);
  // ─── AUTHENTICATION LISTENER ───────────────────────────────────────────────
  useEffect(() => {
    let unsub = () => {};
    onAuthChange(async (user) => {
      setCurrentUser(user || null);
      if (user && isReady) {
        setCloudSyncStatus("syncing");
        const cloudData = await loadUserDataFromCloud(user.uid);
        if (cloudData) {
          if (cloudData.presets && Array.isArray(cloudData.presets)) {
            setPresets(cloudData.presets);
          }
          if (cloudData.history && typeof cloudData.history === "object") {
            setHistory((prev) => reconcileCloudAndLocal(prev, cloudData.history));
          }
          if (cloudData.alarms) {
            setAlarms((prev) => ({ ...prev, ...cloudData.alarms }));
          }
          if (cloudData.notificationConfig) {
            setNotificationConfig((prev) => ({ ...prev, ...cloudData.notificationConfig }));
          }
        }
        setCloudSyncStatus("synced");
      }
    }).then((fn) => {
      if (fn) unsub = fn;
    });
    return () => unsub();
  }, [isReady]);

  // ─── PERSISTENCE (INDEXEDDB + LOCALSTORAGE DUAL-SYNC & CLOUD) ───────────────
  useEffect(() => {
    if (!isReady || !hasCompletedInitialLoadRef.current) return;

    // Guard against accidental overwrite with empty history
    if (Object.keys(history).length === 0 && hadPriorDataRef.current) {
      console.warn("Guarding against saving empty history over preserved progress");
      return;
    }
    if (Object.keys(history).length > 0) {
      hadPriorDataRef.current = true;
    }

    // 1. Local IndexedDB & LocalStorage dual-sync
    idbSet("fo6_history", history);
    idbSet("fo6_presets", presets);
    idbSet("fo6_theme", themeMode);
    idbSet("fo6_alarms", alarms);
    idbSet("fo6_notif_config", notificationConfig);
    idbSet("fo6_chart_mode", chartViewMode);

    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem("fo6_history", JSON.stringify(history));
        localStorage.setItem("tymvera_history_master_backup", JSON.stringify(history));
        localStorage.setItem("fo6_presets", JSON.stringify(presets));
        localStorage.setItem("fo6_theme", themeMode);
        localStorage.setItem("fo6_alarms", JSON.stringify(alarms));
        localStorage.setItem("fo6_notif_config", JSON.stringify(notificationConfig));
      }
    } catch (e) {}

    // 2. Continuous Cloud Synchronization whenever signed in with Google
    if (currentUser && currentUser.uid) {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setCloudSyncStatus("offline");
        return;
      }
      setCloudSyncStatus("syncing");
      if (window.__syncTimeout) clearTimeout(window.__syncTimeout);
      window.__syncTimeout = setTimeout(async () => {
        try {
          await syncUserDataToCloud(currentUser.uid, {
            history,
            presets,
            themeMode,
            alarms,
            notificationConfig,
            chartViewMode,
          });
          setCloudSyncStatus("synced");
          setLastSyncedTime(new Date());
        } catch (e) {
          console.error("Cloud auto-sync failed:", e);
          setCloudSyncStatus("error");
        }
      }, 1200);
    }
  }, [
    history,
    presets,
    themeMode,
    alarms,
    notificationConfig,
    chartViewMode,
    currentUser,
    isReady,
  ]);

  // ─── AUTO-SYNC WHEN RECONNECTING ONLINE ──────────────────────────────────────
  useEffect(() => {
    if (isOnline && currentUser && currentUser.uid && hasCompletedInitialLoadRef.current) {
      setCloudSyncStatus("syncing");
      syncUserDataToCloud(currentUser.uid, {
        history,
        presets,
        themeMode,
        alarms,
        notificationConfig,
        chartViewMode,
      })
        .then(() => {
          setCloudSyncStatus("synced");
          setLastSyncedTime(new Date());
          handleAddToast({
            id: Date.now(),
            title: "⚡ Back Online",
            body: "Your offline changes were synced with Google Cloud.",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          });
        })
        .catch(() => {
          setCloudSyncStatus("error");
        });
    }
  }, [isOnline]);

  // ─── FLUSH CLOUD SYNC ON APP BACKGROUND / SCREEN LOCK ───────────────────────
  useEffect(() => {
    const handleFlushSync = () => {
      if (document.visibilityState === "hidden" && currentUser && currentUser.uid) {
        syncUserDataToCloud(currentUser.uid, {
          history,
          presets,
          themeMode,
          alarms,
          notificationConfig,
          chartViewMode,
        }).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", handleFlushSync);
    window.addEventListener("pagehide", handleFlushSync);
    return () => {
      document.removeEventListener("visibilitychange", handleFlushSync);
      window.removeEventListener("pagehide", handleFlushSync);
    };
  }, [currentUser, history, presets, themeMode, alarms, notificationConfig, chartViewMode]);

  // ─── HELPER: GET BLOCKS FOR DATE ───────────────────────────────────────────
  const getBlocksForDate = useCallback(
    (ds, currentPresets = presets) => {
      const log = history[ds];
      if (log && log.blocksList && Array.isArray(log.blocksList) && log.blocksList.length > 0) {
        return log.blocksList.filter(Boolean);
      }
      const dayOfWeek = new Date(ds + "T12:00:00").getDay();
      const activePresets = (Array.isArray(currentPresets) ? currentPresets : []).filter(
        (p) => p && Array.isArray(p.days) && p.days.includes(dayOfWeek)
      );
      return [...activePresets].sort((a, z) => (a.start || "").localeCompare(z.start || ""));
    },
    [history, presets]
  );

  // ─── ALARMS AUTO-SYNC LOGIC ────────────────────────────────────────────────
  // Automatically when user toggles it on, set wake-up alarm to first task's start time,
  // and sleep alarm to the last schedule's end time.
  useEffect(() => {
    if (!isReady) return;
    const todaysBlocks = getBlocksForDate(todayStr(), presets);
    if (!todaysBlocks || todaysBlocks.length === 0) return;

    let changed = false;
    let nextAlarms = { ...alarms };

    if (alarms.wake.autoSync) {
      const autoWake = calculateAutoWakeTime(todaysBlocks);
      if (autoWake && autoWake !== alarms.wake.time) {
        nextAlarms.wake = { ...nextAlarms.wake, time: autoWake };
        changed = true;
      }
    }
    if (alarms.sleep.autoSync) {
      const autoSleep = calculateAutoSleepTime(todaysBlocks);
      if (autoSleep && autoSleep !== alarms.sleep.time) {
        nextAlarms.sleep = { ...nextAlarms.sleep, time: autoSleep };
        changed = true;
      }
    }

    if (changed) {
      setAlarms(nextAlarms);
    }
  }, [presets, history, alarms.wake.autoSync, alarms.sleep.autoSync, isReady, getBlocksForDate]);

  // ─── RESILIENT BACKGROUND TICK, ALARM & NOTIFICATION EVALUATOR ──────────────
  // Executes inside an isolated Web Worker thread: survives background tab throttling and screen lock
  useEffect(() => {
    // 1. Prime audio keep-alive carrier and MediaSession immediately
    startAudioKeepAlive();

    let notifCycle = 0;
    const stopTimer = startBackgroundWorkerTimer(() => {
      const d = new Date();
      setNow(d);

      if (!isReady) return;
      const ds = localDateStr(d);
      const currentTotalMins = d.getHours() * 60 + d.getMinutes();

      // ─── A. EVALUATE WAKE & SLEEP ALARMS (Every 1s) ─────────────────────────
      if (alarms.wake && alarms.wake.enabled && alarms.wake.time) {
        const [wh, wm] = alarms.wake.time.split(":").map(Number);
        const wakeTotalMins = wh * 60 + (wm || 0);
        const diff = currentTotalMins - wakeTotalMins;

        if (diff >= 0 && diff <= 3) {
          const wakeKey = `alarm_wake_triggered_${ds}_${alarms.wake.time}`;
          if (!sessionStorage.getItem(wakeKey) && !activeAlarm) {
            sessionStorage.setItem(wakeKey, "true");
            playAlarmSound(1.0);
            const alarmData = {
              type: "wake",
              time: alarms.wake.time,
              title: "🌅 Wake-Up Alarm",
              subtitle: `First scheduled task begins at ${to12h(alarms.wake.time)}`,
            };
            setActiveAlarm(alarmData);
            dispatchAlarmNativeNotification(alarmData);
          }
        }
      }

      if (alarms.sleep && alarms.sleep.enabled && alarms.sleep.time) {
        const [sh, sm] = alarms.sleep.time.split(":").map(Number);
        const sleepTotalMins = sh * 60 + (sm || 0);
        const diff = currentTotalMins - sleepTotalMins;

        if (diff >= 0 && diff <= 3) {
          const sleepKey = `alarm_sleep_triggered_${ds}_${alarms.sleep.time}`;
          if (!sessionStorage.getItem(sleepKey) && !activeAlarm) {
            sessionStorage.setItem(sleepKey, "true");
            playAlarmSound(0.95);
            const alarmData = {
              type: "sleep",
              time: alarms.sleep.time,
              title: "🌙 Bedtime / Sleep Alarm",
              subtitle: `Final schedule ended at ${to12h(alarms.sleep.time)}. Rest up!`,
            };
            setActiveAlarm(alarmData);
            dispatchAlarmNativeNotification(alarmData);
          }
        }
      }

      // ─── B. EVALUATE SECTION NOTIFICATIONS (Every 3s) ───────────────────────
      notifCycle++;
      if (notifCycle % 3 === 0) {
        const today = todayStr();
        const todaysBlocks = getBlocksForDate(today, presets);
        checkScheduleNotifications({
          todaysBlocks,
          config: notificationConfig,
          dateStr: today,
          onInAppToast: (toast) => {
            setInAppToast(toast);
            setTimeout(() => {
              setInAppToast((prev) => (prev && prev.id === toast.id ? null : prev));
            }, 6000);
          },
        });

        // ─── C. SYNC SCHEDULE TO SERVICE WORKER (Every 15s) ───────────────────
        if (notifCycle % 15 === 0 && navigator.serviceWorker && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: "SYNC_SCHEDULE",
            blocks: todaysBlocks,
            alarms,
            config: notificationConfig,
          });
        }
      }
    }, 1000);

    return () => {
      stopTimer();
    };
  }, [alarms, activeAlarm, isReady, notificationConfig, presets, getBlocksForDate]);

  // ─── HASH NAVIGATION & MODAL CONTROLS ───────────────────────────────────────
  useEffect(() => {
    const handleHash = () => {
      const h = window.location.hash;
      if (h !== "#edit") setEditingPreset(null);
      if (h !== "#partial") setPartialModal(null);
      if (h !== "#cal") setShowCalendar(false);
    };
    window.addEventListener("popstate", handleHash);
    return () => window.removeEventListener("popstate", handleHash);
  }, []);

  const pushHash = (h) => {
    if (window.location.hash !== h) window.history.pushState(null, "", h);
  };
  const closeModal = (setterFallback) => {
    if (window.location.hash) window.history.back();
    else if (setterFallback) setterFallback(null);
  };

  const handleDuplicateRoutine = (blockOrPreset) => {
    if (!blockOrPreset) return;
    const baseName = blockOrPreset.name || "Routine";
    let [sh, sm] = (blockOrPreset.start || "08:00").split(":").map(Number);
    let [eh, em] = (blockOrPreset.end || "10:00").split(":").map(Number);
    const duration = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
    
    // Shift forward by +4 hours for afternoon/evening session
    let newSh = (sh + 4) % 24;
    let newEh = (newSh + Math.max(1, Math.round((duration > 0 ? duration : 60) / 60))) % 24;
    const pad = (n) => String(n).padStart(2, "0");
    const newStart = `${pad(newSh)}:${pad(sm || 0)}`;
    const newEnd = `${pad(newEh)}:${pad(em || 0)}`;

    const duplicated = {
      id: `p_${Date.now()}`,
      name: baseName,
      start: newStart,
      end: newEnd,
      priority: blockOrPreset.priority || "medium",
      days: Array.isArray(blockOrPreset.days) ? [...blockOrPreset.days] : [0, 1, 2, 3, 4, 5, 6],
      icon: normalizeIconName(blockOrPreset.icon),
      zeroXp: !!blockOrPreset.zeroXp,
    };

    openEditingPreset(duplicated);
    handleAddToast({
      id: `toast_dup_${Date.now()}`,
      title: "Routine Duplicated",
      body: `Copied "${baseName}". Adjust times & tap Checkmark to save.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  };

  const openEditingPreset = (p) => {
    setEditingPreset(p);
    pushHash("#edit");
  };

  const openPartialModal = (block) => {
    setPartialModal({ block });
    const fullDur = mins(block?.start, block?.end);
    const existing = history[selDate]?.blocks?.[block?.id];
    const initialMins = existing?.actualMins || Math.min(fullDur, Math.round(fullDur * 0.75)) || 30;
    setPartialMins(initialMins);
    if (existing?.reason) {
      setPartialReason(existing.reason);
    } else {
      setPartialReason("Standard task progress");
    }
    pushHash("#partial");
  };

  const openCalendar = () => {
    setShowCalendar(true);
    pushHash("#cal");
  };

  // ─── THEME & STYLES ─────────────────────────────────────────────────────────
  const isDark = useMemo(() => {
    if (themeMode === "dark") return true;
    if (themeMode === "light") return false;
    return (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  }, [themeMode]);

  const themeColors = useMemo(() => {
    return {
      bg: isDark ? "bg-[#080808]" : "bg-[#f8fafc]",
      surface: isDark ? "bg-[#141414]" : "bg-white",
      surface2: isDark ? "bg-[#1e1e1e]" : "bg-gray-100",
      border: isDark ? "border-[#222222]" : "border-gray-200",
      text: isDark ? "text-white" : "text-gray-900",
      text2: isDark ? "text-gray-300" : "text-gray-700",
      text3: isDark ? "text-gray-500" : "text-gray-500",
    };
  }, [isDark]);

  useEffect(() => {
    // 1. Synchronize HTML class for Tailwind class-based dark mode
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    // 2. Ensure Tailwind config stays in class dark mode
    if (typeof window !== "undefined" && window.tailwind) {
      if (!window.tailwind.config) window.tailwind.config = {};
      if (window.tailwind.config.darkMode !== "class") {
        window.tailwind.config.darkMode = "class";
      }
    }

    // 3. Synchronize mobile status bar meta theme-color
    let metaThemeColor = document.querySelector("meta[name=theme-color]");
    if (!metaThemeColor) {
      metaThemeColor = document.createElement("meta");
      metaThemeColor.name = "theme-color";
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.content = isDark ? "#080808" : "#f8fafc";
  }, [isDark]);

  // ─── COMPUTED TIMELINE & STATS ──────────────────────────────────────────────
  const selBlocks = useMemo(() => getBlocksForDate(selDate), [getBlocksForDate, selDate]);
  const selLog = useMemo(() => history[selDate] || null, [history, selDate]);
  const selProg = useMemo(() => (selLog && selLog.blocks ? selLog.blocks : {}), [selLog]);
  const score = useMemo(() => calcScore(selBlocks, selProg), [selBlocks, selProg]);

  const nowStr = now.toTimeString().slice(0, 5);
  const isToday = selDate === todayStr();
  const activeBl = isToday
    ? selBlocks.find((b) => {
        if (!b || !b.start || !b.end) return false;
        if (b.start > b.end) return nowStr >= b.start || nowStr < b.end;
        return nowStr >= b.start && nowStr < b.end;
      })
    : null;

  // ─── IN-SECTION & FLOATING BOTTLE TIMER COMPUTATIONS ──────────────────────
  const focusBlock = useMemo(() => {
    if (selectedFocusBlockId) {
      const found = selBlocks.find((b) => b && b.id === selectedFocusBlockId);
      if (found) return found;
    }
    return activeBl;
  }, [selectedFocusBlockId, selBlocks, activeBl]);

  const focusBlockTotalSeconds = useMemo(() => {
    if (!focusBlock || !focusBlock.start || !focusBlock.end) return 3600;
    const [sh, sm] = focusBlock.start.split(":").map(Number);
    const [eh, em] = focusBlock.end.split(":").map(Number);
    let durMins = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
    if (durMins <= 0) durMins += 24 * 60;
    return durMins * 60;
  }, [focusBlock]);

  const focusBlockRemainingSeconds = useMemo(() => {
    if (!focusBlock || !focusBlock.start || !focusBlock.end) return 0;
    if (isTimerPaused && pausedSeconds !== null) return pausedSeconds;

    const [sh, sm] = focusBlock.start.split(":").map(Number);
    const [eh, em] = focusBlock.end.split(":").map(Number);
    let startSecs = sh * 3600 + (sm || 0) * 60;
    let endSecs = eh * 3600 + (em || 0) * 60;
    if (endSecs <= startSecs) endSecs += 24 * 3600;

    let nowSecs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    if (nowSecs < startSecs && endSecs > 24 * 3600) nowSecs += 24 * 3600;

    const rem = Math.max(0, endSecs - nowSecs);
    return rem;
  }, [focusBlock, isTimerPaused, pausedSeconds, now]);

  const toggleFocusTimerPause = useCallback(() => {
    setIsTimerPaused((prev) => {
      const next = !prev;
      if (next) {
        setPausedSeconds(focusBlockRemainingSeconds);
        playNotificationChime(0.5);
      } else {
        setPausedSeconds(null);
        playNotificationChime(0.8);
      }
      return next;
    });
  }, [focusBlockRemainingSeconds]);

  const handleOpenPip = useCallback(async (targetBlock) => {
    const b = targetBlock || focusBlock;
    if (!b) return;
    const formattedTime = formatTimerSeconds(focusBlockRemainingSeconds);
    const completedPct = focusBlockTotalSeconds > 0
      ? ((focusBlockTotalSeconds - focusBlockRemainingSeconds) / focusBlockTotalSeconds) * 100
      : 0;

    const pipResult = await launchSystemPipTimer({
      taskName: b.name,
      timeFormatted: formattedTime,
      isPaused: isTimerPaused,
      progressPct: completedPct,
      onTogglePause: toggleFocusTimerPause,
      onClose: () => {},
    });

    if (pipResult) {
      setDetachedTimer(null);
      try {
        window.blur();
      } catch (e) {}
      setInAppToast({
        id: Date.now(),
        title: pipResult.mode === 'document' ? "Floating Over All Windows" : "Picture-in-Picture Active",
        body: `Timer for "${b.name}" is now floating above all apps and windows!`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
    } else {
      // In-app fallback only if browser completely lacks PiP support
      setDetachedTimer({
        block: b,
        coords: { x: window.innerWidth - 260, y: window.innerHeight - 150 },
        isCurrentlyHeld: false,
      });
      setInAppToast({
        id: Date.now(),
        title: "Floating Timer Active",
        body: `Timer for "${b.name}" is floating. Drag it anywhere!`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
    }
  }, [focusBlock, focusBlockRemainingSeconds, focusBlockTotalSeconds, isTimerPaused, toggleFocusTimerPause]);

  // Keep native Document PiP window synchronized if open
  useEffect(() => {
    if (focusBlock) {
      const pct = focusBlockTotalSeconds > 0
        ? ((focusBlockTotalSeconds - focusBlockRemainingSeconds) / focusBlockTotalSeconds) * 100
        : 0;
      updateDocumentPipWindow({
        taskName: focusBlock.name,
        timeFormatted: formatTimerSeconds(focusBlockRemainingSeconds),
        isPaused: isTimerPaused,
        progressPct: pct,
        onTogglePause: toggleFocusTimerPause,
      });
    }
  }, [focusBlock, focusBlockRemainingSeconds, focusBlockTotalSeconds, isTimerPaused, toggleFocusTimerPause]);

  const streak = useMemo(() => {
    try {
      let s = 0;
      const d = new Date();
      if (history[localDateStr(d)] && history[localDateStr(d)].dailyScore >= 50) s++;
      d.setDate(d.getDate() - 1);
      for (let i = 0; i < 365; i++) {
        const ds = localDateStr(d);
        if (history[ds] && history[ds].dailyScore >= 50) {
          s++;
          d.setDate(d.getDate() - 1);
        } else break;
      }
      return s;
    } catch {
      return 0;
    }
  }, [history]);

  // Today Focus Stats & Story Card Unlock Verification
  const todayFocusMins = useMemo(() => {
    let total = 0;
    selBlocks.forEach((b) => {
      if (!b || b.zeroXp) return;
      const p = selProg[b.id];
      if (!p) return;
      if (p.status === "completed") {
        total += mins(b.start, b.end);
      } else if (p.status === "partial") {
        total += (p.actualMins || 0);
      }
    });
    return total;
  }, [selBlocks, selProg]);

  const doneCount = useMemo(() => {
    return selBlocks.filter((b) => b && selProg[b.id]?.status === "completed").length;
  }, [selBlocks, selProg]);

  const tier1Stats = useMemo(() => {
    const t1 = selBlocks.filter((b) => b && (b.prio === 1 || b.priority === 1));
    const t1Done = t1.filter((b) => selProg[b.id]?.status === "completed").length;
    return { done: t1Done, total: t1.length };
  }, [selBlocks, selProg]);

  const isCardUnlocked = useMemo(() => {
    return isToday && isDailyCardUnlocked(todayFocusMins, doneCount);
  }, [isToday, todayFocusMins, doneCount]);

  const handleOpenShareCard = useCallback(async () => {
    if (!isCardUnlocked) return;
    setIsGeneratingCard(true);
    setShowShareCardModal(true);
    try {
      const res = await renderDailyFocusCard({
        dateStr: new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }),
        focusMins: todayFocusMins,
        score,
        streak,
        doneCount,
        totalCount: selBlocks.length,
        tier1Done: tier1Stats.done,
        tier1Total: tier1Stats.total,
      });
      setShareCardPreview(res);
    } catch (err) {
      console.error("Card generation error:", err);
      handleAddToast({ id: Date.now(), title: "Generation Failed", message: "Could not create daily story card.", type: "error" });
    } finally {
      setIsGeneratingCard(false);
    }
  }, [isCardUnlocked, todayFocusMins, score, streak, doneCount, selBlocks.length, tier1Stats, handleAddToast]);

  const allLogs = useMemo(() => {
    return Object.values(history || {})
      .filter(Boolean)
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  }, [history]);

  const uniqueTaskNames = useMemo(() => {
    const names = new Set();
    presets.forEach((p) => {
      if (p && p.name) names.add(p.name);
    });
    allLogs.forEach((log) => {
      Object.values(log.blocks || {}).forEach((p) => {
        if (p && p.name) names.add(p.name);
      });
    });
    return Array.from(names);
  }, [presets, allLogs]);

  const dynamicFilterOptions = useMemo(() => {
    return ["ALL", ...uniqueTaskNames];
  }, [uniqueTaskNames]);

  const chartData = useMemo(() => {
    const slice = allLogs.slice(-tf);
    if (slice.length === 0) return [];
    return slice.map((log) => {
      let val = log.dailyScore || 0;
      const sessions = [];

      if (filterTask !== "ALL") {
        val = 0;
        const normFilter = String(filterTask || "").toLowerCase();
        
        // Check blocksList or fallback to presets
        const dayBlocks = log.blocksList && log.blocksList.length > 0 ? log.blocksList : presets;
        
        dayBlocks.forEach((b) => {
          if (!b || !b.name) return;
          const normName = String(b.name).toLowerCase();
          if (normName.includes(normFilter) || normFilter.includes(normName)) {
            const p = (log.blocks || {})[b.id];
            const status = p ? p.status : "pending";
            let dur = p?.actualMins || 0;
            if (status === "completed") {
              dur = mins(b.start, b.end);
            }
            const durHours = dur > 0 ? dur / 60 : 0;
            val += durHours;
            sessions.push({
              id: b.id,
              name: b.name,
              start: b.start,
              end: b.end,
              status,
              durHours,
              durMins: dur,
              zeroXp: !!b.zeroXp,
            });
          }
        });

        // Also check any ad-hoc blocks recorded in log.blocks with matching name
        Object.entries(log.blocks || {}).forEach(([bid, p]) => {
          if (!p || !p.name) return;
          const already = sessions.some(s => s.id === bid || s.name === p.name);
          if (!already) {
            const normName = String(p.name).toLowerCase();
            if (normName.includes(normFilter) || normFilter.includes(normName)) {
              let dur = p.actualMins || 0;
              const durHours = dur / 60;
              val += durHours;
              sessions.push({
                id: bid,
                name: p.name,
                status: p.status || "pending",
                durHours,
                durMins: dur,
                zeroXp: !!p.zeroXp,
              });
            }
          }
        });
      }

      return {
        date: log.date,
        val: isNaN(val) ? 0 : val,
        sessions,
      };
    });
  }, [allLogs, tf, filterTask, presets]);

  const sortedPresets = useMemo(() => {
    return Array.isArray(presets)
      ? [...presets].sort((a, b) => (a.start || "00:00").localeCompare(b.start || "00:00"))
      : [];
  }, [presets]);

  // ─── ACTION HANDLERS ────────────────────────────────────────────────────────
  const mark = useCallback(
    (blockId, status, extras = {}) => {
      setHistory((prev) => {
        try {
          const ds = selDate;
          const log = prev[ds] || { date: ds, blocks: {}, dailyScore: 0 };
          let snapshotBlocks = log.blocksList;
          if (!snapshotBlocks || !Array.isArray(snapshotBlocks) || snapshotBlocks.length === 0) {
            const dayOfWeek = new Date(ds + "T12:00:00").getDay();
            snapshotBlocks = presets
              .filter((p) => p && p.days && p.days.includes(dayOfWeek))
              .sort((a, z) => (a.start || "").localeCompare(z.start || ""));
          }
          const currentBlock = snapshotBlocks.find((b) => b && b.id === blockId);
          if (!currentBlock) return prev;
          const newProg = {
            ...log.blocks,
            [blockId]: {
              status,
              timestamp: new Date().toISOString(),
              name: currentBlock.name,
              ...extras,
            },
          };
          const s = calcScore(snapshotBlocks, newProg);
          return {
            ...prev,
            [ds]: {
              ...log,
              blocks: newProg,
              dailyScore: s,
              blocksList: snapshotBlocks,
            },
          };
        } catch (err) {
          console.error("Mark task failed:", err);
          return prev;
        }
      });
      if (status === "completed") {
        setBurst(true);
        setTimeout(() => setBurst(false), 1800);
      }
    },
    [selDate, presets]
  );

  const unmark = useCallback(
    (blockId) => {
      setHistory((prev) => {
        try {
          const log = prev[selDate];
          if (!log) return prev;
          const newProg = { ...log.blocks };
          delete newProg[blockId];
          const snapshotBlocks = log.blocksList || getBlocksForDate(selDate, presets);
          const s = calcScore(snapshotBlocks, newProg);
          return {
            ...prev,
            [selDate]: { ...log, blocks: newProg, dailyScore: s },
          };
        } catch (err) {
          console.error("Unmark task failed:", err);
          return prev;
        }
      });
    },
    [selDate, getBlocksForDate, presets]
  );

  const savePreset = useCallback(
    (updatedPreset) => {
      setPresets((prev) => {
        const exists = prev.find((p) => p && p.id === updatedPreset.id);
        if (exists) return prev.map((p) => (p && p.id === updatedPreset.id ? updatedPreset : p));
        return [...prev, updatedPreset];
      });

      setHistory((prev) => {
        const ds = selDate;
        const log = prev[ds] || { date: ds, blocks: {}, dailyScore: 0 };
        const dayOfWeek = new Date(ds + "T12:00:00").getDay();
        let snapshotBlocks = log.blocksList;
        if (!snapshotBlocks || !Array.isArray(snapshotBlocks) || snapshotBlocks.length === 0) {
          snapshotBlocks = presets
            .filter((p) => p && p.days && p.days.includes(dayOfWeek))
            .sort((a, z) => (a.start || "").localeCompare(z.start || ""));
        }

        if (updatedPreset.days && updatedPreset.days.includes(dayOfWeek)) {
          const existingIdx = snapshotBlocks.findIndex((b) => b && b.id === updatedPreset.id);
          if (existingIdx >= 0) snapshotBlocks[existingIdx] = updatedPreset;
          else snapshotBlocks.push(updatedPreset);
          snapshotBlocks.sort((a, z) => (a.start || "").localeCompare(z.start || ""));
        } else {
          snapshotBlocks = snapshotBlocks.filter((b) => b && b.id !== updatedPreset.id);
        }

        const s = calcScore(snapshotBlocks, log.blocks);
        return {
          ...prev,
          [ds]: { ...log, blocks: log.blocks, dailyScore: s, blocksList: snapshotBlocks },
        };
      });

      closeModal(() => setEditingPreset(null));
    },
    [selDate, presets]
  );

  const deletePreset = useCallback(
    (id) => {
      setPresets((prev) => prev.filter((p) => p && p.id !== id));
      setHistory((prev) => {
        const ds = selDate;
        const log = prev[ds] || { date: ds, blocks: {}, dailyScore: 0 };
        let snapshotBlocks = log.blocksList;
        if (!snapshotBlocks || !Array.isArray(snapshotBlocks) || snapshotBlocks.length === 0) {
          const dayOfWeek = new Date(ds + "T12:00:00").getDay();
          snapshotBlocks = presets
            .filter((p) => p && p.days && p.days.includes(dayOfWeek))
            .sort((a, z) => (a.start || "").localeCompare(z.start || ""));
        }
        snapshotBlocks = snapshotBlocks.filter((b) => b && b.id !== id);
        const newProg = { ...log.blocks };
        delete newProg[id];
        const s = calcScore(snapshotBlocks, newProg);
        return {
          ...prev,
          [ds]: { ...log, blocksList: snapshotBlocks, blocks: newProg, dailyScore: s },
        };
      });
      closeModal(() => setEditingPreset(null));
    },
    [selDate, presets]
  );

  const removeTaskFromToday = useCallback(
    (id) => {
      setHistory((prev) => {
        const ds = selDate;
        const log = prev[ds] || { date: ds, blocks: {}, dailyScore: 0 };
        let snapshotBlocks = log.blocksList || getBlocksForDate(selDate, presets);
        snapshotBlocks = snapshotBlocks.filter((b) => b && b.id !== id);
        const newProg = { ...log.blocks };
        delete newProg[id];
        const s = calcScore(snapshotBlocks, newProg);
        return {
          ...prev,
          [ds]: { ...log, blocks: newProg, dailyScore: s, blocksList: snapshotBlocks },
        };
      });
      closeModal(() => setEditingPreset(null));
    },
    [selDate, getBlocksForDate, presets]
  );

  // ─── AUTHENTICATION ACTIONS ─────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    if (!navigator.onLine) {
      handleAddToast({
        id: Date.now(),
        title: "⚡ Offline Mode Active",
        body: "Google Sign-In requires an active internet connection. All changes are being saved locally on this device.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
      return;
    }
    try {
      setCloudSyncStatus("syncing");
      const user = await signInWithGoogle();
      setCurrentUser(user);
      setCloudSyncStatus("synced");
    } catch (err) {
      console.error("Google Sign-In failed:", err);
      handleAddToast({
        id: Date.now(),
        title: "Sign In Warning",
        body: err.message || "Failed to authenticate with Google",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
      setCloudSyncStatus("error");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setCurrentUser(null);
      setCloudSyncStatus("idle");
    } catch (err) {
      console.error("Sign-out error:", err);
    }
  };

  // ─── ALARM DISMISS & SNOOZE ─────────────────────────────────────────────────
  const dismissAlarm = () => {
    stopAlarmSound();
    setActiveAlarm(null);
  };

  const snoozeAlarm = (minsCount = 5) => {
    stopAlarmSound();
    setActiveAlarm(null);
    const d = new Date();
    d.setMinutes(d.getMinutes() + minsCount);
    const snoozeTime = d.toTimeString().slice(0, 5);

    setTimeout(() => {
      playAlarmSound(1.0);
      setActiveAlarm({
        type: "snooze",
        time: snoozeTime,
        title: "⏰ Snooze Alarm Expired",
        subtitle: `Resuming your alarm (${minsCount}m elapsed)`,
      });
    }, minsCount * 60 * 1000);
  };

  // ─── STORAGE RECOVERY & BACKUP ACTIONS ───────────────────────────────────────
  const handleDeepScanStorage = async () => {
    setIsScanningStorage(true);
    setScanReport(null);
    try {
      const res = await performDeepScanAndRecover({
        currentHistory: history,
        currentPresets: presets,
      });

      setHistory(res.mergedHistory);
      if (res.mergedPresets && res.mergedPresets.length > 0) {
        setPresets(res.mergedPresets);
      }

      const msg = `Checked ${res.stats.keysScanned} LocalStorage keys & ${res.stats.dbsScanned} IndexedDB databases. Found ${res.stats.totalDays} total days (${res.stats.newlyRecoveredDays} newly restored)!`;
      setScanReport(msg);

      handleAddToast({
        id: `toast_scan_${Date.now()}`,
        title: "Deep Scan Complete",
        body: msg,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
    } catch (err) {
      console.error("Storage scan failed:", err);
      alert("Storage scan error: " + err.message);
    } finally {
      setIsScanningStorage(false);
    }
  };

  const handleCopyStorageReport = async () => {
    try {
      const report = await getRawStorageDiagnosticReport();
      setStorageReport(report);
      const txt = JSON.stringify(report, null, 2);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(txt);
      }
      handleAddToast({
        id: `toast_report_${Date.now()}`,
        title: 'Diagnostic Copied',
        body: 'Storage diagnostic JSON copied to clipboard!',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    } catch (err) {
      console.error('Failed to copy storage report:', err);
      alert('Could not copy diagnostic: ' + err.message);
    }
  };

  const handleExportBackup = () => {
    exportBackupData({ history, presets, alarms, notificationConfig });
    handleAddToast({
      id: `toast_export_${Date.now()}`,
      title: "Backup Exported",
      body: `Downloaded complete TYMVERA backup (${Object.keys(history).length} days).`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  };

  const handleFileImport = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const res = parseImportBackup(text);
        if (!res.success) {
          alert("Import failed: " + res.error);
          return;
        }
        const mergedHistory = { ...res.history, ...history };
        setHistory(mergedHistory);
        if (res.presets && res.presets.length > 0) {
          setPresets(res.presets);
        }
        if (res.alarms) {
          setAlarms((prev) => ({ ...prev, ...res.alarms }));
        }
        if (res.notificationConfig) {
          setNotificationConfig((prev) => ({ ...prev, ...res.notificationConfig }));
        }
        handleAddToast({
          id: `toast_import_${Date.now()}`,
          title: "Backup Restored",
          body: `Successfully imported ${Object.keys(res.history).length} days of history!`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });
      } catch (err) {
        alert("File read error: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleCopyRawBackup = () => {
    const payload = {
      app: "TYMVERA",
      version: "6.0-pro",
      exportedAt: new Date().toISOString(),
      history,
      presets,
      alarms,
      notificationConfig,
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    }
    handleAddToast({
      id: `toast_copy_${Date.now()}`,
      title: "Copied Backup",
      body: "All progress data copied to clipboard as JSON!",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  };

  const handlePasteRawBackup = () => {
    if (!backupJsonInput.trim()) {
      alert("Please paste valid JSON text first.");
      return;
    }
    const res = parseImportBackup(backupJsonInput);
    if (!res.success) {
      alert("Invalid JSON: " + res.error);
      return;
    }
    const mergedHistory = { ...res.history, ...history };
    setHistory(mergedHistory);
    if (res.presets && res.presets.length > 0) setPresets(res.presets);
    if (res.alarms) setAlarms((prev) => ({ ...prev, ...res.alarms }));
    if (res.notificationConfig) setNotificationConfig((prev) => ({ ...prev, ...res.notificationConfig }));
    setShowBackupModal(false);
    setBackupJsonInput("");
    handleAddToast({
      id: `toast_paste_${Date.now()}`,
      title: "Data Restored",
      body: `Successfully restored ${Object.keys(res.history).length} days of activity!`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  };

  // ─── RENDER: IN-APP TOAST ───────────────────────────────────────────────────
  const renderInAppToast = () => {
    if (!inAppToast) return null;
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 w-full max-w-[400px] z-[3000] px-4 animate-in slide-in-from-top-full duration-300 pointer-events-auto">
        <div
          className={`${themeColors.surface} border border-blue-500/40 rounded-2xl p-4 shadow-2xl flex items-start gap-3.5 backdrop-blur-xl ring-2 ring-blue-500/20`}
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
            <img src="/icon-192.png" alt="TYMVERA" className="w-7 h-7 object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-black tracking-tight text-gray-900 dark:text-white flex items-center justify-between">
              <span>{inAppToast.title}</span>
              <span className="text-[10px] text-gray-400 font-mono">{inAppToast.timestamp}</span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-300 mt-1 leading-snug">
              {inAppToast.body}
            </div>
          </div>
          <button
            onClick={() => setInAppToast(null)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      </div>
    );
  };


  // ─── RENDER: STORAGE INSPECTOR MODAL ───────────────────────────────────────
  const renderStorageInspectorModal = () => {
    if (!showStorageInspector) return null;
    const lsKeys = storageReport?.localStorage?.keys || [];
    const idbList = storageReport?.indexedDB?.databases || [];
    const totalDays = storageReport?.totalRecoverableDays || 0;

    return (
      <div className="fixed inset-0 z-[3600] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-3 select-none animate-in fade-in duration-200">
        <div className={`${themeColors.surface} border ${themeColors.border} w-full max-w-[460px] max-h-[85vh] rounded-[32px] p-5 shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-300`}>
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-[#222]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-black">
                <Icon name="troubleshoot" size={18} />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900 dark:text-white leading-none">
                  Storage Inspector
                </h3>
                <span className="text-[10px] text-gray-400 font-medium">Device Storage & Recovery Diagnostic</span>
              </div>
            </div>
            <button
              onClick={() => setShowStorageInspector(false)}
              className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#222] text-gray-500 flex items-center justify-center font-bold"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
            {/* Summary Banner */}
            <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs">
              <div className="font-black text-blue-500 mb-1 flex items-center justify-between">
                <span>Total Recoverable Days Detected:</span>
                <span className="text-sm px-2 py-0.5 rounded-full bg-blue-500 text-white font-mono">{totalDays}</span>
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                Found {lsKeys.length} LocalStorage keys and {idbList.length} IndexedDB databases.
              </div>
            </div>

            {/* LocalStorage Breakdown */}
            <div>
              <div className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>LocalStorage Keys ({lsKeys.length})</span>
              </div>
              <div className="space-y-2">
                {lsKeys.length === 0 ? (
                  <div className="text-xs text-gray-400 italic">No keys found in LocalStorage.</div>
                ) : (
                  lsKeys.map((k, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-gray-50 dark:bg-[#1a1a1a] border border-gray-100 dark:border-[#262626] text-xs">
                      <div className="flex justify-between items-center font-mono font-bold text-gray-800 dark:text-gray-200">
                        <span className="truncate max-w-[240px] text-blue-500">{k.key}</span>
                        <span className="text-[10px] text-gray-400">{k.sizeKb}</span>
                      </div>
                      <div className="text-[10px] font-mono text-gray-400 truncate mt-1 bg-white dark:bg-[#111] p-1.5 rounded-lg border border-gray-100 dark:border-[#222]">
                        {k.preview}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* IndexedDB Breakdown */}
            <div>
              <div className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider mb-2">
                IndexedDB Databases ({idbList.length})
              </div>
              <div className="space-y-2">
                {idbList.length === 0 ? (
                  <div className="text-xs text-gray-400 italic">No accessible IndexedDB databases.</div>
                ) : (
                  idbList.map((db, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-gray-50 dark:bg-[#1a1a1a] border border-gray-100 dark:border-[#262626] text-xs">
                      <div className="flex justify-between items-center font-bold text-gray-800 dark:text-gray-200">
                        <span className="font-mono text-indigo-400 truncate">{db.dbName}</span>
                        <span className="text-[10px] text-gray-400 font-mono">v{db.version}</span>
                      </div>
                      <div className="mt-1 space-y-1">
                        {db.stores.map((st, sIdx) => (
                          <div key={sIdx} className="flex justify-between text-[11px] text-gray-500">
                            <span>Store: <strong className="text-gray-700 dark:text-gray-300 font-mono">{st.storeName}</strong></span>
                            <span>{st.recordCount} records</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-3 border-t border-gray-100 dark:border-[#222] flex flex-col gap-2">
            <button
              onClick={async () => {
                setShowStorageInspector(false);
                await handleDeepScanStorage();
              }}
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-md shadow-blue-500/25 flex items-center justify-center gap-1.5 active:scale-98 transition-all"
            >
              <Icon name="history" size={16} /> Force Restore All Detected Days
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleCopyStorageReport}
                className="flex-1 py-2.5 px-3 rounded-xl bg-gray-100 dark:bg-[#222] text-xs font-black text-gray-700 dark:text-gray-300 flex items-center justify-center gap-1 hover:bg-gray-200 dark:hover:bg-[#2a2a2a] transition-all"
              >
                <Icon name="content_copy" size={14} /> Copy Diagnostic Dump
              </button>
              <button
                onClick={() => setShowStorageInspector(false)}
                className="py-2.5 px-4 rounded-xl bg-gray-100 dark:bg-[#222] text-xs font-bold text-gray-500"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── RENDER: RINGING ALARM MODAL ────────────────────────────────────────────
  const renderAlarmModal = () => {
    if (!activeAlarm) return null;
    const isWake = activeAlarm.type === "wake";

    return (
      <div className="fixed inset-0 z-[4000] bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-between p-8 text-white select-none animate-in zoom-in-95 duration-300">
        <div className="w-full flex justify-center pt-8">
          <div
            className={`w-28 h-28 rounded-full flex items-center justify-center animate-bounce shadow-2xl ${
              isWake
                ? "bg-gradient-to-tr from-amber-500 to-yellow-300 text-black shadow-amber-500/50"
                : "bg-gradient-to-tr from-indigo-600 to-purple-400 text-white shadow-purple-500/50"
            }`}
          >
            <Icon name={isWake ? "wb_sunny" : "bedtime"} size={56} />
          </div>
        </div>

        <div className="text-center my-auto">
          <div className="text-sm uppercase tracking-[4px] font-mono font-bold text-gray-400 mb-2">
            TYMVERA Smart Alarm
          </div>
          <div className="text-6xl font-black tracking-tight mb-3">
            {to12h(activeAlarm.time)}
          </div>
          <div className="text-2xl font-black text-white mb-2">{activeAlarm.title}</div>
          <div className="text-sm font-medium text-gray-300 max-w-xs mx-auto">
            {activeAlarm.subtitle}
          </div>
        </div>

        <div className="w-full max-w-xs flex flex-col gap-3 pb-8">
          <button
            onClick={dismissAlarm}
            className="w-full py-4 rounded-2xl bg-white text-black font-black text-lg active:scale-95 transition-transform shadow-xl"
          >
            Dismiss Alarm
          </button>
          <button
            onClick={() => snoozeAlarm(5)}
            className="w-full py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-sm active:scale-95 transition-transform"
          >
            Snooze (5 Minutes)
          </button>
        </div>
      </div>
    );
  };

  // ─── RENDER: BACKUP & DATA TRANSFER MODAL ──────────────────────────────────
  const renderBackupModal = () => {
    if (!showBackupModal) return null;
    return (
      <div className="fixed inset-0 z-[3500] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4 select-none animate-in fade-in duration-200">
        <div
          className={`${themeColors.surface} border ${themeColors.border} w-full max-w-[420px] rounded-[32px] p-6 shadow-2xl animate-in slide-in-from-bottom duration-300`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center">
                <Icon name="database" size={20} />
              </div>
              <div className="text-base font-black text-gray-900 dark:text-white">
                Backup & Data Vault
              </div>
            </div>
            <button
              onClick={() => setShowBackupModal(false)}
              className="p-1 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
            >
              <Icon name="close" size={20} />
            </button>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
            Transfer progress between your smartphone and browser. Copy the raw JSON backup string or paste previous data to merge with zero data loss.
          </p>

          <div className="flex gap-2 mb-4">
            <button
              onClick={handleCopyRawBackup}
              className="flex-1 py-3 px-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-500 text-xs font-black flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
            >
              <Icon name="content_copy" size={16} /> Copy Current Data
            </button>
            <button
              onClick={handleExportBackup}
              className="flex-1 py-3 px-3 rounded-2xl bg-gray-100 dark:bg-[#222] border border-gray-200 dark:border-[#333] text-gray-700 dark:text-gray-200 text-xs font-black flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
            >
              <Icon name="download" size={16} /> Save .JSON
            </button>
          </div>

          <div className="mb-3">
            <label className="text-[10px] font-mono uppercase tracking-wider text-gray-400 font-bold block mb-1.5">
              Paste Backup JSON To Restore
            </label>
            <textarea
              rows={4}
              value={backupJsonInput}
              onChange={(e) => setBackupJsonInput(e.target.value)}
              placeholder='Paste JSON here (e.g. {"history": {...}})'
              className="w-full text-xs font-mono p-3 rounded-2xl bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-[#333] text-gray-800 dark:text-gray-200 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <button
            onClick={handlePasteRawBackup}
            className="w-full py-3.5 rounded-2xl bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-500/20 active:scale-98 transition-transform flex items-center justify-center gap-2"
          >
            <Icon name="system_update_alt" size={18} /> Restore & Merge Data
          </button>
        </div>
      </div>
    );
  };

  // ─── RENDER: DAILY FOCUS STORY CARD MODAL (Viral Social Loop) ───────────────
  const renderShareCardModal = () => {
    if (!showShareCardModal) return null;

    const handleShare = async () => {
      if (!shareCardPreview) return;
      try {
        const res = await shareOrDownloadDailyCard(shareCardPreview);
        if (res.shared) {
          if (res.method === "download") {
            handleAddToast({
              id: Date.now(),
              title: "Downloaded!",
              message: "Story card saved to your gallery. Upload to WhatsApp / Instagram!",
              type: "success",
            });
          } else {
            handleAddToast({
              id: Date.now(),
              title: "Shared!",
              message: "Daily Focus Card shared successfully!",
              type: "success",
            });
          }
        }
      } catch (err) {
        console.error("Share error:", err);
      }
    };

    return (
      <div className="fixed inset-0 z-[3600] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
        <div
          className={`${themeColors.surface} border ${themeColors.border} w-full max-w-[420px] max-h-[92vh] flex flex-col rounded-[32px] p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden`}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                <Icon name="bolt" size={18} />
              </div>
              <div>
                <div className="text-base font-black text-gray-900 dark:text-white leading-tight">
                  Daily Focus Story Card
                </div>
                <div className="text-[10px] font-mono text-emerald-500 dark:text-emerald-400 font-bold">
                  ● Verified Study Session
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowShareCardModal(false)}
              className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Icon name="close" size={20} />
            </button>
          </div>

          {/* Card Preview Container */}
          <div className="relative flex-1 min-h-[320px] max-h-[460px] my-2 rounded-2xl overflow-hidden bg-black/60 border border-white/10 flex items-center justify-center p-2">
            {isGeneratingCard ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-400">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-mono font-medium">Generating HD 9:16 Story Card...</span>
              </div>
            ) : shareCardPreview ? (
              <img
                src={shareCardPreview.dataUrl}
                alt="TYMVERA Daily Focus Card"
                className="max-h-full max-w-full object-contain rounded-xl shadow-2xl"
              />
            ) : (
              <div className="text-xs text-gray-400">Unable to load card preview.</div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2.5 mt-3 pt-2 border-t border-gray-100 dark:border-[#222] shrink-0">
            <button
              onClick={handleShare}
              disabled={isGeneratingCard || !shareCardPreview}
              className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 active:scale-95 transition-all"
            >
              <Icon name="share" size={16} />
              <span>Share to Stories / WhatsApp</span>
            </button>
            <button
              onClick={() => {
                if (shareCardPreview) {
                  shareOrDownloadDailyCard({ ...shareCardPreview, filename: `tymvera-${selDate}.png` });
                  handleAddToast({
                    id: Date.now(),
                    title: "Downloaded!",
                    message: "Story card saved to gallery.",
                    type: "success",
                  });
                }
              }}
              disabled={isGeneratingCard || !shareCardPreview}
              className="py-3 px-3.5 rounded-2xl bg-gray-100 dark:bg-[#1a1a1a] hover:bg-gray-200 dark:hover:bg-[#252525] border border-gray-200 dark:border-[#2a2a2a] text-gray-800 dark:text-gray-200 text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-all"
              title="Download PNG to gallery"
            >
              <Icon name="download" size={16} />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 text-center mt-2 font-mono">
            Optimized for Instagram Stories, WhatsApp Status & Snapchat (9:16 HD)
          </p>
        </div>
      </div>
    );
  };

  // ─── RENDER: SIMPLIFIED, INTUITIVE TIME LOGGING MODAL ──────────────────────
  const renderPartialModal = () => {
    if (!partialModal || !partialModal.block) return null;
    const hours = Math.floor(partialMins / 60);
    const minutes = partialMins % 60;
    const fullDuration = mins(partialModal.block.start, partialModal.block.end) || 60;
    const pct = fullDuration > 0 ? Math.round((partialMins / fullDuration) * 100) : 100;
    const isOvertime = partialMins > fullDuration;

    // 4 clean contextual presets (25%, 50%, 75%, 100%)
    const presetsList = [
      { label: "25%", mins: Math.max(5, Math.round((fullDuration * 0.25) / 5) * 5) },
      { label: "50%", mins: Math.max(5, Math.round((fullDuration * 0.50) / 5) * 5) },
      { label: "75%", mins: Math.max(5, Math.round((fullDuration * 0.75) / 5) * 5) },
      { label: "Full", mins: fullDuration },
    ].filter((p, idx, arr) => arr.findIndex((x) => x.mins === p.mins) === idx);

    const sliderMax = Math.max(120, Math.ceil((fullDuration * 1.5) / 15) * 15, Math.ceil(partialMins / 15) * 15 + 15);

    return (
      <div className="fixed inset-0 bg-black/80 z-[2000] flex flex-col justify-end sm:justify-center p-3 sm:p-4 animate-in fade-in select-none backdrop-blur-sm">
        <div
          className={`${themeColors.surface} rounded-[32px] p-6 w-full max-w-[420px] mx-auto border ${themeColors.border} shadow-2xl transition-all`}
        >
          {/* Mobile Handle indicator */}
          <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-5 sm:hidden" />

          {/* Header */}
          <div className="text-center mb-5">
            <span className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-widest font-bold text-[#FF9F0A] bg-[#FF9F0A]/10 px-2.5 py-0.5 rounded-full mb-2">
              <Icon name="timer" size={12} />
              Log Time
            </span>
            <h3 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">
              {partialModal.block.name}
            </h3>
            <p className="text-xs text-gray-500 font-mono mt-1">
              Scheduled: {to12h(partialModal.block.start)} – {to12h(partialModal.block.end)} ({fullDuration}m)
            </p>
          </div>

          {/* Main Hero Duration & Progress Box */}
          <div className={`p-4 rounded-2xl ${themeColors.surface2} border ${themeColors.border} mb-4`}>
            {/* Big readable duration */}
            <div className="flex items-center justify-center gap-2 mb-2">
              <input
                type="number"
                min="1"
                max="999"
                value={partialMins}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) setPartialMins(Math.max(1, Math.min(999, val)));
                }}
                className="text-5xl font-black text-[#FF9F0A] bg-transparent outline-none text-center w-28 tracking-tight font-mono focus:border-b-2 focus:border-[#FF9F0A]"
              />
              <div className="flex flex-col text-left">
                <span className="text-sm font-extrabold uppercase tracking-wide text-gray-500">
                  {partialMins === 1 ? "min" : "mins"}
                </span>
                {hours > 0 && (
                  <span className="text-xs font-mono font-bold text-gray-400">
                    {hours}h {minutes > 0 ? `${minutes}m` : ""}
                  </span>
                )}
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-black/10 dark:bg-white/10 h-2 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  isOvertime ? "bg-emerald-500" : "bg-[#FF9F0A]"
                }`}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>

            {/* Completion Percentage Info */}
            <div className="flex justify-between items-center text-xs font-mono font-semibold px-0.5 mb-3">
              <span className={isOvertime ? "text-emerald-500 font-bold" : "text-gray-500 dark:text-gray-400"}>
                {pct}% {isOvertime ? `(Overtime +${partialMins - fullDuration}m)` : "completed"}
              </span>
              <span className="text-gray-400">Target: {fullDuration}m</span>
            </div>

            {/* Smooth Slider & Step Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPartialMins(Math.max(5, partialMins - 15))}
                className="h-9 px-2.5 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center font-bold text-xs text-gray-700 dark:text-gray-300 active:scale-95 transition-transform"
                title="Decrease 15m"
              >
                -15
              </button>
              <button
                type="button"
                onClick={() => setPartialMins(Math.max(5, partialMins - 5))}
                className="h-9 px-2 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center font-bold text-xs text-gray-700 dark:text-gray-300 active:scale-95 transition-transform"
                title="Decrease 5m"
              >
                -5
              </button>

              <input
                type="range"
                min="5"
                max={sliderMax}
                step="5"
                value={partialMins}
                onChange={(e) => setPartialMins(parseInt(e.target.value, 10) || 5)}
                className="flex-1 accent-[#FF9F0A] cursor-pointer h-2 bg-black/10 dark:bg-white/10 rounded-lg"
              />

              <button
                type="button"
                onClick={() => setPartialMins(partialMins + 5)}
                className="h-9 px-2 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center font-bold text-xs text-gray-700 dark:text-gray-300 active:scale-95 transition-transform"
                title="Increase 5m"
              >
                +5
              </button>
              <button
                type="button"
                onClick={() => setPartialMins(partialMins + 15)}
                className="h-9 px-2.5 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center font-bold text-xs text-gray-700 dark:text-gray-300 active:scale-95 transition-transform"
                title="Increase 15m"
              >
                +15
              </button>
            </div>
          </div>

          {/* Quick Presets: 4 clean pills */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {presetsList.map((p) => {
              const isSelected = partialMins === p.mins;
              return (
                <button
                  key={p.mins}
                  type="button"
                  onClick={() => setPartialMins(p.mins)}
                  className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center transition-all ${
                    isSelected
                      ? "bg-[#FF9F0A] text-black font-black shadow-md shadow-[#FF9F0A]/20 scale-[1.02]"
                      : `${themeColors.surface2} ${themeColors.text2} border ${themeColors.border} hover:bg-black/5 dark:hover:bg-white/5`
                  }`}
                >
                  <span className="text-sm font-black tracking-tight">{p.mins}m</span>
                  <span
                    className={`text-[10px] uppercase font-bold tracking-wider ${
                      isSelected ? "text-black/75" : themeColors.text3
                    }`}
                  >
                    {p.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Reason / Note (Clean & Compact) */}
          <div className="mb-5">
            <div className="text-[10px] font-mono uppercase tracking-wider font-bold text-gray-400 mb-1 px-1">
              Note / Reason (Optional)
            </div>
            <div className="relative">
              <select
                value={partialReason}
                onChange={(e) => setPartialReason(e.target.value)}
                className={`w-full py-2.5 px-3 rounded-xl appearance-none outline-none ${themeColors.surface2} border ${themeColors.border} font-semibold text-xs text-gray-800 dark:text-gray-200 cursor-pointer`}
              >
                <option value="Standard task progress">Standard task progress</option>
                <option value="Ran out of time">Ran out of time</option>
                <option value="Got distracted / interrupted">Got distracted / interrupted</option>
                <option value="Low energy / fatigued">Low energy / fatigued</option>
                <option value="Bonus / overtime session">Bonus / overtime session</option>
                <option value="Other">Other</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">
                ▼
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => closeModal(() => setPartialModal(null))}
              className={`flex-1 py-3.5 rounded-2xl ${themeColors.surface2} font-bold text-sm text-gray-600 dark:text-gray-300 active:scale-[0.98] transition-transform`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                mark(partialModal.block.id, "partial", {
                  actualMins: partialMins,
                  reason: partialReason,
                });
                closeModal(() => setPartialModal(null));
              }}
              className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-[#FF9F0A] to-[#FF8000] text-black font-black text-sm active:scale-[0.98] transition-transform shadow-lg shadow-[#FF9F0A]/20"
            >
              Log {partialMins}m
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─── RENDER: CALENDAR MODAL ─────────────────────────────────────────────────
  const renderCalendar = () => {
    const y = cMon.getFullYear(),
      m = cMon.getMonth();
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMon = new Date(y, m + 1, 0).getDate();
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    const cells = [
      ...Array(offset).fill(null),
      ...Array.from({ length: daysInMon }, (_, i) => i + 1),
    ];
    const monthName = new Date(y, m).toLocaleDateString("en", {
      month: "long",
      year: "numeric",
    });

    return (
      <div
        className="fixed inset-0 bg-black/80 z-[2000] flex flex-col justify-end p-3 animate-in fade-in select-none backdrop-blur-sm"
        onClick={() => closeModal(() => setShowCalendar(false))}
      >
        <div
          className={`${themeColors.surface} rounded-[36px] p-8 w-full max-w-[414px] mx-auto border ${themeColors.border} shadow-2xl`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-8">
            <button
              onClick={() => setCMon(new Date(y, m - 1))}
              className={`w-12 h-12 rounded-full ${themeColors.surface2} flex items-center justify-center font-black active:scale-90 transition-transform`}
            >
              <Icon name="chevron_left" />
            </button>
            <span className="font-black text-xl text-gray-900 dark:text-white">{monthName}</span>
            <button
              onClick={() => setCMon(new Date(y, m + 1))}
              className={`w-12 h-12 rounded-full ${themeColors.surface2} flex items-center justify-center font-black active:scale-90 transition-transform`}
            >
              <Icon name="chevron_right" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2 mb-4">
            {["M", "T", "W", "T", "F", "S", "S"].map((l, i) => (
              <div
                key={i}
                className="text-center text-xs font-mono font-bold text-gray-400 py-1"
              >
                {l}
              </div>
            ))}
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const curDs = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isSelected = curDs === selDate;
              const isCurToday = curDs === todayStr();
              const dayLog = history[curDs];
              const hasScore = dayLog && dayLog.dailyScore !== undefined;

              return (
                <button
                  key={i}
                  onClick={() => {
                    setSelDate(curDs);
                    closeModal(() => setShowCalendar(false));
                  }}
                  className={`aspect-square rounded-2xl flex flex-col items-center justify-center relative font-bold text-sm transition-all ${
                    isSelected
                      ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30 scale-105"
                      : isCurToday
                      ? "border border-blue-500 text-blue-500"
                      : `${themeColors.surface2} text-gray-700 dark:text-gray-300`
                  }`}
                >
                  <span>{day}</span>
                  {hasScore && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                        dayLog.dailyScore >= 80
                          ? "bg-[#32D74B]"
                          : dayLog.dailyScore >= 50
                          ? "bg-[#FF9F0A]"
                          : "bg-gray-400"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ─── RENDER: PRESET / BLOCK EDITOR MODAL ────────────────────────────────────
  const renderPresetEditor = () => {
    if (!editingPreset) return null;
    const existsInPresets = presets.some((p) => p && p.id === editingPreset.id);
    const existsInToday = (history[selDate]?.blocksList || []).some(
      (p) => p && p.id === editingPreset.id
    );
    const isUnsavedNew = !existsInPresets && !existsInToday;

    const toggleDay = (d) => {
      const newDays = editingPreset.days.includes(d)
        ? editingPreset.days.filter((x) => x !== d)
        : [...editingPreset.days, d].sort();
      setEditingPreset({ ...editingPreset, days: newDays });
    };

    return (
      <div className="fixed inset-0 z-[1000] flex flex-col bg-[#f9fafb] dark:bg-[#080808] animate-in slide-in-from-bottom-full duration-300 overflow-hidden text-gray-900 dark:text-white select-none">
        <div className="flex justify-between items-center p-4 bg-white dark:bg-[#151515] border-b border-gray-200 dark:border-[#222]">
          <button
            onClick={() => closeModal(() => setEditingPreset(null))}
            className="text-xl p-2 rounded-full active:bg-gray-100 dark:active:bg-[#222]"
          >
            <Icon name="close" size={28} />
          </button>
          <div className="font-black text-lg tracking-tight">
            {isUnsavedNew ? "Create Block" : "Edit Block"}
          </div>
          <button
            onClick={() => savePreset(editingPreset)}
            className="text-xl p-2 text-blue-500 rounded-full active:bg-blue-50 dark:active:bg-blue-500/10"
          >
            <Icon name="check" size={28} style={{ fontWeight: 800 }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pb-32 px-5 scroll-smooth">
          <div className="flex items-center justify-center gap-4 my-8 bg-white dark:bg-[#151515] p-5 rounded-[32px] border border-gray-200 dark:border-[#222] shadow-[0_8px_30px_-12px_rgba(0,0,0,0.05)]">
            <div className="flex flex-col items-center flex-1">
              <label className="text-[10px] uppercase tracking-[2px] text-gray-500 font-mono font-bold mb-3">
                Start Time
              </label>
              <input
                type="time"
                value={editingPreset.start}
                onChange={(e) => setEditingPreset({ ...editingPreset, start: e.target.value })}
                className="w-full text-xl font-black bg-gray-100 dark:bg-[#222] rounded-2xl py-3 px-1 text-center text-gray-900 dark:text-white border-none outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="text-gray-400 font-black text-lg mt-6">→</div>
            <div className="flex flex-col items-center flex-1">
              <label className="text-[10px] uppercase tracking-[2px] text-gray-500 font-mono font-bold mb-3">
                End Time
              </label>
              <input
                type="time"
                value={editingPreset.end}
                onChange={(e) => setEditingPreset({ ...editingPreset, end: e.target.value })}
                className="w-full text-xl font-black bg-gray-100 dark:bg-[#222] rounded-2xl py-3 px-1 text-center text-gray-900 dark:text-white border-none outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="mb-8">
            <label className="text-[10px] uppercase tracking-[2px] text-gray-500 font-mono font-bold ml-2 mb-3 block">
              Block Title
            </label>
            <input
              type="text"
              placeholder="e.g. Deep Work, Gym, Sleep"
              value={editingPreset.name}
              onChange={(e) => setEditingPreset({ ...editingPreset, name: e.target.value })}
              className="w-full bg-white dark:bg-[#151515] border border-gray-200 dark:border-[#222] rounded-2xl p-4 font-black text-lg outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              required
            />
          </div>

          <div className="mb-8">
            <label className="text-[10px] uppercase tracking-[2px] text-gray-500 font-mono font-bold ml-2 mb-3 block">
              Icon
            </label>
            <div className="grid grid-cols-6 gap-2 bg-white dark:bg-[#151515] p-4 rounded-[28px] border border-gray-200 dark:border-[#222] max-h-48 overflow-y-auto">
              {ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setEditingPreset({ ...editingPreset, icon: ic })}
                  className={`aspect-square rounded-2xl flex items-center justify-center transition-all ${
                    editingPreset.icon === ic
                      ? "bg-blue-500 text-white shadow-md scale-105"
                      : "bg-gray-100 dark:bg-[#222] text-gray-700 dark:text-gray-300"
                  }`}
                >
                  <Icon name={ic} size={20} />
                </button>
              ))}
            </div>
          </div>

          {/* Priority Level Selector */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-3 ml-2">
              <label className="text-[10px] uppercase tracking-[2px] text-gray-500 font-mono font-bold">
                Priority Level
              </label>
              <span className="text-[10px] font-bold font-mono text-gray-400">
                Weight: {WEIGHTS[editingPreset.priority || "medium"]}x Score Impact
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRIORITIES.map((pr) => {
                const isSel = (editingPreset.priority || "medium").toLowerCase() === pr.id;
                return (
                  <button
                    key={pr.id}
                    type="button"
                    onClick={() => setEditingPreset({ ...editingPreset, priority: pr.id })}
                    className={`p-3 rounded-2xl border text-left transition-all flex flex-col gap-1 ${
                      isSel
                        ? "shadow-sm scale-102 ring-1"
                        : "border-gray-200 dark:border-[#262626] bg-white dark:bg-[#151515] opacity-75"
                    }`}
                    style={{
                      borderColor: isSel ? pr.color : undefined,
                      backgroundColor: isSel ? pr.bg : undefined,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black" style={{ color: pr.color }}>
                        {pr.short}
                      </span>
                      <span className="text-[10px] font-mono font-bold" style={{ color: pr.color }}>
                        {pr.weight}x
                      </span>
                    </div>
                    <div className="text-[11px] font-bold text-gray-800 dark:text-gray-200 leading-tight">
                      {pr.label.split(" ")[0]}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Skip Adding XP Toggle */}
          <div className="mb-8 bg-white dark:bg-[#151515] p-5 rounded-[28px] border border-gray-200 dark:border-[#222] shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
                  <span>Skip Adding XP</span>
                  {editingPreset.zeroXp && (
                    <span className="text-[9px] uppercase tracking-wider bg-purple-500/15 text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded font-black">
                      0XP Active
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-snug max-w-[260px]">
                  Useful for school, eating, travel, or sleep. Tracks your schedule without affecting productivity XP or score.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingPreset({ ...editingPreset, zeroXp: !editingPreset.zeroXp })}
                className={`w-14 h-8 rounded-full transition-colors relative shadow-inner flex-shrink-0 ${
                  editingPreset.zeroXp ? "bg-purple-600" : "bg-gray-200 dark:bg-[#333]"
                }`}
              >
                <div
                  className={`w-6 h-6 bg-white rounded-full absolute top-1 shadow-md transition-transform ${
                    editingPreset.zeroXp ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="mb-8">
            <label className="text-[10px] uppercase tracking-[2px] text-gray-500 font-mono font-bold ml-2 mb-3 block">
              Active Days
            </label>
            <div className="flex justify-between gap-1 bg-white dark:bg-[#151515] p-3 rounded-2xl border border-gray-200 dark:border-[#222]">
              {DAYS.map((d, i) => {
                const active = editingPreset.days.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${
                      active ? "bg-blue-500 text-white shadow-md" : "bg-gray-100 dark:bg-[#222] text-gray-400"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => savePreset(editingPreset)}
              className="w-full py-4 rounded-2xl bg-blue-500 text-white font-black text-base active:scale-98 transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
            >
              <Icon name="check" size={20} /> Save Routine
            </button>
            <button
              type="button"
              onClick={() => handleDuplicateRoutine(editingPreset)}
              className="w-full py-3.5 rounded-2xl border border-gray-200 dark:border-[#2a2a2a] text-xs font-black text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#1f1f1f] active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              <Icon name="content_copy" size={16} className="text-blue-500" /> Duplicate Routine (e.g. Evening Session)
            </button>
            {!isUnsavedNew && (
              <button
                type="button"
                onClick={() => deletePreset(editingPreset.id)}
                className="w-full py-2.5 text-xs font-bold text-[#FF3B30] hover:underline flex items-center justify-center gap-1.5"
              >
                <Icon name="delete" size={14} /> Delete Routine Completely
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ─── RENDER: ADD TASK GRAPH MODAL ──────────────────────────────────────────
  const renderAddTaskGraphModal = () => {
    if (!showAddTaskGraphModal) return null;

    return (
      <div
        className="fixed inset-0 bg-black/80 z-[3000] flex flex-col justify-end p-3 animate-in fade-in backdrop-blur-sm"
        onClick={() => setShowAddTaskGraphModal(false)}
      >
        <div
          className={`${themeColors.surface} rounded-[36px] p-6 w-full max-w-[420px] mx-auto border ${themeColors.border} shadow-2xl animate-in slide-in-from-bottom duration-200`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-black text-lg text-gray-900 dark:text-white flex items-center gap-2">
                <Icon name="add_chart" size={20} className="text-blue-500" />
                Add Task Graph
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Select any routine to plot its sessions and period milestones.
              </p>
            </div>
            <button
              onClick={() => setShowAddTaskGraphModal(false)}
              className="p-1 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-white"
            >
              <Icon name="close" size={20} />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto space-y-2 py-2">
            <button
              onClick={() => {
                setFilterTask("ALL");
                setShowAddTaskGraphModal(false);
              }}
              className={`w-full p-4 rounded-2xl text-left font-black text-sm flex items-center justify-between border transition-all ${
                filterTask === "ALL"
                  ? "border-blue-500 bg-blue-500/10 text-blue-500"
                  : "border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#161616] text-gray-800 dark:text-gray-200"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon name="monitoring" size={20} className="text-blue-500" />
                <span>Overall Productivity Score</span>
              </div>
              <span className="text-xs font-mono text-gray-400">Score (%)</span>
            </button>

            {uniqueTaskNames.map((tName) => {
              const isSel = filterTask === tName;
              const matchingPresets = presets.filter((p) => p && p.name === tName);
              const sessionCount = matchingPresets.length;

              return (
                <button
                  key={tName}
                  onClick={() => {
                    setFilterTask(tName);
                    setShowAddTaskGraphModal(false);
                  }}
                  className={`w-full p-4 rounded-2xl text-left font-black text-sm flex items-center justify-between border transition-all ${
                    isSel
                      ? "border-blue-500 bg-blue-500/10 text-blue-500"
                      : "border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#161616] text-gray-800 dark:text-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon name={matchingPresets[0]?.icon || "schedule"} size={20} className="text-blue-500" />
                    <div>
                      <div>{tName}</div>
                      {sessionCount > 1 && (
                        <div className="text-[10px] font-mono text-blue-500 font-bold">
                          {sessionCount} sessions scheduled (Morning/Evening)
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-mono text-gray-400">Hours (h)</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ─── RENDER: FIREBASE CONFIG MODAL ──────────────────────────────────────────
  const renderFirebaseModal = () => {
    if (!showFirebaseModal) return null;
    const currentCfg = getActiveFirebaseConfig();

    return (
      <div className="fixed inset-0 bg-black/80 z-[3000] flex flex-col justify-end p-3 animate-in fade-in backdrop-blur-sm">
        <div
          className={`${themeColors.surface} rounded-[36px] p-6 w-full max-w-[420px] mx-auto border ${themeColors.border} shadow-2xl`}
        >
          <div className="flex justify-between items-center mb-4">
            <span className="font-black text-lg text-gray-900 dark:text-white flex items-center gap-2">
              <Icon name="cloud" size={20} className="text-blue-500" /> Firebase Cloud Setup
            </span>
            <button
              onClick={() => setShowFirebaseModal(false)}
              className="text-gray-400 hover:text-gray-700 dark:hover:text-white"
            >
              <Icon name="close" size={20} />
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-4 leading-relaxed">
            Google Sign-in is pre-configured and ready to run. You can also paste your own
            Firebase configuration JSON below to connect a dedicated Firebase backend.
          </p>

          <textarea
            id="custom-firebase-cfg"
            defaultValue={JSON.stringify(currentCfg, null, 2)}
            rows={8}
            className="w-full p-3 font-mono text-xs rounded-xl bg-gray-100 dark:bg-[#181818] border border-gray-200 dark:border-[#2a2a2a] outline-none text-gray-900 dark:text-gray-200 mb-4"
          />

          <div className="flex gap-2">
            <button
              onClick={() => setShowFirebaseModal(false)}
              className={`flex-1 py-3 rounded-xl ${themeColors.surface2} font-bold text-xs`}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                try {
                  const val = document.getElementById("custom-firebase-cfg").value;
                  const parsed = JSON.parse(val);
                  saveCustomFirebaseConfig(parsed);
                } catch (e) {
                  alert("Invalid JSON format. Please verify configuration.");
                }
              }}
              className="flex-1 py-3 rounded-xl bg-blue-500 text-white font-black text-xs shadow-md"
            >
              Save & Reload
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─── DELAYED LOCK SCREEN TEST (5s) ──────────────────────────────────────────
  const triggerDelayedLockScreenTest = async () => {
    let perm = notificationPermission;
    if (perm !== "granted") {
      const res = await requestNotificationPermission();
      perm = res.status;
      setNotificationPermission(perm);
      if (perm === "denied") {
        setShowPermissionModal(true);
        return;
      }
      if (perm !== "granted") return;
    }

    setNotificationConfig((prev) => ({ ...prev, enabled: true }));
    startAudioKeepAlive();

    let remaining = 5;
    setTestingCountdown(remaining);

    const timer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(timer);
        setTestingCountdown(null);
        dispatchNotification({
          title: "⚡ TYMVERA Lock Screen Test",
          body: "Section alerts and obsidian alarms are active on your lock screen with sound & haptics!",
          onInAppToast: setInAppToast,
        });
      } else {
        setTestingCountdown(remaining);
      }
    }, 1000);
  };

  // ─── RENDER: NOTIFICATION PERMISSION GUIDE MODAL ────────────────────────────
  const renderPermissionModal = () => {
    if (!showPermissionModal) return null;

    return (
      <div className="fixed inset-0 z-[5000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
        <div className={`${themeColors.surface} border ${themeColors.border} rounded-[32px] p-6 max-w-sm w-full shadow-2xl relative`}>
          <button
            onClick={() => setShowPermissionModal(false)}
            className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 dark:hover:text-white"
          >
            <Icon name="close" size={20} />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
              <Icon name="notifications" size={22} />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900 dark:text-white">Enable Notifications</h3>
              <p className="text-xs text-gray-500">Unblock in Chrome in 2 steps</p>
            </div>
          </div>

          <div className="space-y-3 text-xs text-gray-600 dark:text-gray-300 mb-6">
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-gray-50 dark:bg-[#151515] border border-gray-100 dark:border-[#222]">
              <span className="w-5 h-5 rounded-full bg-blue-500 text-white font-black text-[11px] flex items-center justify-center shrink-0">1</span>
              <div>
                <div className="font-bold text-gray-900 dark:text-white mb-0.5">Tap the Site Icon in Address Bar</div>
                <div>At top of Chrome: tap the 🔒 lock or tune icon next to <span className="font-mono text-blue-500 font-bold">tymvera.web.app</span></div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-gray-50 dark:bg-[#151515] border border-gray-100 dark:border-[#222]">
              <span className="w-5 h-5 rounded-full bg-blue-500 text-white font-black text-[11px] flex items-center justify-center shrink-0">2</span>
              <div>
                <div className="font-bold text-gray-900 dark:text-white mb-0.5">Set Notifications to "Allow"</div>
                <div>Tap <span className="font-semibold text-gray-900 dark:text-white">Permissions</span> or <span className="font-semibold text-gray-900 dark:text-white">Site Settings</span> and toggle Notifications <span className="text-emerald-500 font-bold">ON</span>.</div>
              </div>
            </div>
          </div>

          <button
            onClick={async () => {
              if (typeof window !== "undefined" && "Notification" in window) {
                const current = Notification.permission;
                setNotificationPermission(current);
                if (current === "granted") {
                  setNotificationConfig((prev) => ({ ...prev, enabled: true }));
                  setShowPermissionModal(false);
                  playNotificationChime(1.0);
                  dispatchNotification({
                    title: "⚡ TYMVERA Alerts Active",
                    body: "Section alerts and obsidian alarms are now active with sound.",
                    onInAppToast: setInAppToast,
                  });
                } else {
                  const res = await requestNotificationPermission();
                  setNotificationPermission(Notification.permission);
                  if (res.status === "granted") {
                    setNotificationConfig((prev) => ({ ...prev, enabled: true }));
                    setShowPermissionModal(false);
                  }
                }
              }
            }}
            className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-lg shadow-blue-500/25 active:scale-95 transition-all"
          >
            I've Enabled It • Check Status
          </button>
        </div>
      </div>
    );
  };

  // ─── RENDER: IN-APP STREAMING DOWNLOAD MODAL ───────────────────────────────
  const renderDownloadModal = () => {
    return (
      <InAppDownloadModal
        isOpen={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
        initialPlatform={userPlatform}
        themeColors={themeColors}
      />
    );
  };

  // ─── RENDER: CONFETTI BURST ─────────────────────────────────────────────────
  const renderConfetti = () => {
    return (
      <div className="fixed inset-0 pointer-events-none z-[5000] overflow-hidden">
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `-10px`,
              width: `${Math.random() * 8 + 4}px`,
              height: `${Math.random() * 8 + 4}px`,
              backgroundColor: ["#32D74B", "#0A84FF", "#FF9F0A", "#BF5AF2", "#FF3B30"][i % 5],
              animation: `fall ${1 + Math.random() * 1.5}s ease-out forwards`,
            }}
          />
        ))}
        <style>{`@keyframes fall { to { transform: translateY(100vh) rotate(360deg); opacity: 0; } }`}</style>
      </div>
    );
  };

  // ─── TAB 1: HOME (TIMELINE & ROUTINES) ──────────────────────────────────────
  const renderHomeTab = () => {
    const done = selBlocks.filter((b) => b && selProg[b.id]?.status === "completed").length;
    const partial = selBlocks.filter((b) => b && selProg[b.id]?.status === "partial").length;

    let activeBlProgress = 0;
    if (isToday && activeBl && activeBl.start && activeBl.end) {
      const [sh, sm] = activeBl.start.split(":").map(Number);
      const [eh, em] = activeBl.end.split(":").map(Number);
      const startMins = sh * 60 + (sm || 0);
      let endMins = eh * 60 + (em || 0);
      if (endMins <= startMins) endMins += 24 * 60;
      let currentMins = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
      if (currentMins < startMins && endMins > 24 * 60) currentMins += 24 * 60;
      activeBlProgress = Math.max(0, Math.min(100, ((currentMins - startMins) / (endMins - startMins)) * 100));
    }

    const selDateObj = new Date(selDate + "T12:00:00");
    const formattedDate = isNaN(selDateObj)
      ? "Today"
      : selDateObj.toLocaleDateString("en", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });

    return (
      <div className="pb-32 select-none animate-in fade-in duration-500">
        {/* Top App Bar with Date & User Avatar / Sign In */}
        <div className="px-5 pt-8 pb-3 flex justify-between items-center">
          <button
            onClick={openCalendar}
            className="flex items-center gap-2.5 active:scale-95 transition-transform bg-gray-100 dark:bg-[#1a1a1a] px-4 py-2 rounded-full border border-gray-200/60 dark:border-[#262626]"
          >
            <span className="text-base font-black tracking-tight text-gray-900 dark:text-white">
              {isToday ? "Today" : formattedDate}
            </span>
            <Icon name="calendar_month" size={18} className={themeColors.text2} />
          </button>

          {/* Quick App Download Button — Hidden when running inside the installed standalone app */}
          {!isStandaloneApp && (
            <button
              onClick={() => setShowDownloadModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/25 text-xs font-black shadow-sm active:scale-95 transition-all"
              title={
                userPlatform === "android"
                  ? "Download Official TYMVERA Android Native App (.apk)"
                  : "Download Official TYMVERA Windows Desktop App (.exe)"
              }
            >
              <Icon name={userPlatform === "android" ? "phone_android" : userPlatform === "windows" ? "desktop_windows" : "download"} size={15} />
              <span className="hidden sm:inline">
                {userPlatform === "android" ? "Get Android App" : userPlatform === "windows" ? "Get Windows App" : "Get App"}
              </span>
              <span className="text-[10px] font-mono opacity-80">
                {userPlatform === "android" ? ".apk" : userPlatform === "windows" ? ".exe" : ".apk / .exe"}
              </span>
            </button>
          )}

          {/* Offline Indicator or Google Auth Status Badge */}
          {!isOnline ? (
            <div
              onClick={() => setTab("settings")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 dark:text-amber-400 text-xs font-black shadow-sm cursor-pointer active:scale-95 transition-transform"
              title="100% Offline Mode Active — All routines and progress saved locally"
            >
              <Icon name="cloud_off" size={15} />
              <span>Offline Mode</span>
            </div>
          ) : currentUser ? (
            <div
              onClick={() => setTab("settings")}
              className="flex items-center gap-2 cursor-pointer bg-gray-100 dark:bg-[#1a1a1a] py-1 px-3 rounded-full border border-gray-200/60 dark:border-[#262626] active:scale-95 transition-transform"
            >
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName}
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-blue-500 text-white font-black text-xs flex items-center justify-center">
                  {(currentUser.displayName || currentUser.email || "U")[0].toUpperCase()}
                </div>
              )}
              <span className="text-xs font-black truncate max-w-[90px] text-gray-900 dark:text-white">
                {currentUser.displayName ? currentUser.displayName.split(" ")[0] : "Account"}
              </span>
              <span
                className={`w-2 h-2 rounded-full ${
                  cloudSyncStatus === "synced"
                    ? "bg-[#32D74B]"
                    : cloudSyncStatus === "syncing"
                    ? "bg-[#FF9F0A] animate-ping"
                    : "bg-gray-400"
                }`}
                title={cloudSyncStatus === "synced" ? "Synced to Cloud" : "Syncing..."}
              />
            </div>
          ) : (
            <button
              onClick={handleGoogleSignIn}
              className="flex items-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/30 px-3 py-1.5 rounded-full text-xs font-black active:scale-95 transition-transform"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Sign In</span>
            </button>
          )}
        </div>

        {/* Smart Alarms Status Pills (Wake / Sleep) */}
        {(alarms.wake.enabled || alarms.sleep.enabled) && (
          <div className="px-5 pb-3 flex items-center gap-2 flex-wrap">
            {alarms.wake.enabled && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[11px] font-mono font-bold">
                <Icon name="wb_sunny" size={13} />
                <span>Wake: {to12h(alarms.wake.time)}</span>
                {alarms.wake.autoSync && <span className="text-[9px] opacity-75">(auto)</span>}
              </div>
            )}
            {alarms.sleep.enabled && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[11px] font-mono font-bold">
                <Icon name="bedtime" size={13} />
                <span>Sleep: {to12h(alarms.sleep.time)}</span>
                {alarms.sleep.autoSync && <span className="text-[9px] opacity-75">(auto)</span>}
              </div>
            )}
          </div>
        )}

        {/* Native Notification & Sound Permission Prompt Banner */}
        {typeof window !== "undefined" &&
          "Notification" in window &&
          notificationPermission !== "granted" && (
            <div className="px-4 mb-4">
              {notificationPermission === "denied" ? (
                <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 shadow-sm backdrop-blur-md">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                      <Icon name="warning" size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-amber-600 dark:text-amber-400 truncate">
                        Notifications Blocked by Browser
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                        Tap here for 2-step guide to unblock in Chrome settings.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowPermissionModal(true)}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black shrink-0 shadow-md shadow-amber-500/25 active:scale-95 transition-all"
                  >
                    How to Fix
                  </button>
                </div>
              ) : (
                <div className="p-3.5 sm:p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-between gap-3 shadow-sm backdrop-blur-md">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src="/icon-192.png"
                      alt="TYMVERA"
                      className="w-9 h-9 rounded-xl object-contain shrink-0 shadow-sm"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-black text-gray-900 dark:text-white truncate">
                        Enable Section Alerts & Alarms
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                        Receive sound & notifications when routine blocks start and finish.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      const res = await requestNotificationPermission();
                      if (typeof window !== "undefined" && "Notification" in window) {
                        setNotificationPermission(Notification.permission);
                      }
                      if (res.status === "granted") {
                        setNotificationConfig((prev) => ({ ...prev, enabled: true }));
                        playNotificationChime(1.0);
                        dispatchNotification({
                          title: "⚡ TYMVERA Alerts Active",
                          body: "Milestone alerts and obsidian alarms are now active with sound.",
                          onInAppToast: setInAppToast,
                        });
                      } else if (res.status === "denied") {
                        setShowPermissionModal(true);
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shrink-0 shadow-md shadow-blue-500/25 active:scale-95 transition-all"
                  >
                    Allow Alerts
                  </button>
                </div>
              )}
            </div>
          )}

        {/* Circular Progress & Daily Metrics Card */}
        <div className="px-4 mb-6">
          <div
            className={`${themeColors.surface} border ${themeColors.border} rounded-[32px] p-6 flex items-center gap-6 shadow-sm`}
          >
            <svg width={92} height={92} viewBox="0 0 84 84" className="rotate-[-90deg]">
              <circle
                cx={42}
                cy={42}
                r={36}
                fill="none"
                className="stroke-gray-100 dark:stroke-[#222]"
                strokeWidth={7}
              />
              <circle
                cx={42}
                cy={42}
                r={36}
                fill="none"
                stroke={score > 100 ? "#10B981" : score >= 80 ? "#32D74B" : score >= 50 ? "#FF9F0A" : "#3b82f6"}
                strokeWidth={score > 100 ? 8 : 7}
                strokeDasharray={226.2}
                strokeDashoffset={226.2 - (226.2 * Math.min(100, score)) / 100}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>

            <div className="flex-1">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className={`text-4xl font-black tracking-tight ${score > 100 ? "text-emerald-500 dark:text-emerald-400" : "text-gray-900 dark:text-white"}`}>
                  {score}%
                </span>
                <span className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider">
                  Score
                </span>
                {score > 100 && (
                  <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-0.5 animate-pulse">
                    <Icon name="bolt" size={10} /> +{score - 100}% Overtime
                  </span>
                )}
              </div>
              <div className="text-xs font-bold text-gray-500 mt-1">
                {done} of {selBlocks.length} completed {partial > 0 ? `(${partial} logged)` : ""}
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-[#222] flex-wrap gap-2">
                <div className="flex items-center gap-1 text-xs font-mono font-bold text-amber-500">
                  <Icon name="local_fire_department" size={16} />
                  <span>{streak} Day Streak</span>
                </div>

                {/* Limited Daily Focus Card - Only unlocked when user actually studies (30m+ or 1+ session done) */}
                {isToday && (
                  <div>
                    {isCardUnlocked ? (
                      <button
                        onClick={handleOpenShareCard}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-indigo-500 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-md shadow-blue-500/25 active:scale-95 transition-all group"
                        title="Share your verified daily focus summary to Instagram Story / WhatsApp Status"
                      >
                        <Icon name="share" size={13} className="text-white group-hover:rotate-12 transition-transform" />
                        <span>Daily Focus Card</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
                      </button>
                    ) : (
                      <div
                        className="text-[11px] font-mono text-gray-400 dark:text-gray-500 flex items-center gap-1.5 bg-gray-100/80 dark:bg-[#151515] px-2.5 py-1 rounded-lg border border-gray-200 dark:border-[#262626]"
                        title="Locked: Log at least 30 mins of focus or complete 1 session today to unlock your Daily Focus Card"
                      >
                        <Icon name="lock" size={12} className="text-gray-400" />
                        <span>Daily Card: {todayFocusMins}/30m</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Timeline Tasks List */}
        <div className="px-4">
          <div className="flex justify-between items-center mb-3 ml-2">
            <span
              className={`text-[11px] font-mono tracking-[2px] font-bold uppercase ${themeColors.text3}`}
            >
              Timeline · {selBlocks.length} Blocks
            </span>
          </div>

          {selBlocks.length === 0 ? (
            <div
              className={`${themeColors.surface} border ${themeColors.border} rounded-3xl p-8 text-center text-gray-400 font-medium`}
            >
              <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto mb-3">
                <Icon name="event_note" size={24} />
              </div>
              <div className="font-bold text-gray-900 dark:text-white text-base mb-1">
                No routines scheduled
              </div>
              <div className="text-xs text-gray-400 max-w-xs mx-auto mb-1">
                Your schedule is clean. Tap "+ Add Block" below to create your custom daily routine.
              </div>
            </div>
          ) : (
            selBlocks.map((block) => {
              const prog = selProg[block.id];
              const status = prog?.status || "pending";
              const isCurrent = isToday && activeBl && activeBl.id === block.id;
              const isFocusActive = isToday && focusBlock && focusBlock.id === block.id;
              const isDetached = detachedTimer && detachedTimer.block && detachedTimer.block.id === block.id;

              return (
                <TaskItem
                  key={block.id}
                  block={block}
                  status={status}
                  prog={prog}
                  isCurrent={isCurrent}
                  currentProgress={activeBlProgress}
                  isDark={isDark}
                  themeColors={themeColors}
                  onMark={mark}
                  onUnmark={unmark}
                  onOpenPartial={openPartialModal}
                  onEdit={openEditingPreset}
                  onDeleteFromToday={removeTaskFromToday}
                  onDeletePreset={deletePreset}
                  onDuplicate={handleDuplicateRoutine}
                  isTimerActive={isFocusActive}
                  isTimerPaused={isTimerPaused}
                  remainingSeconds={focusBlockRemainingSeconds}
                  totalSeconds={focusBlockTotalSeconds}
                  isDetached={isDetached}
                  onTogglePause={toggleFocusTimerPause}
                  onDetachTimer={({ block: b, initialCoords, isCurrentlyHeld }) =>
                    setDetachedTimer({ block: b, coords: initialCoords, isCurrentlyHeld })
                  }
                  onDockBack={() => setDetachedTimer(null)}
                  onOpenFullscreen={() => setFullscreenTimerBlock(block)}
                  onStartFocusTimer={(b) => setSelectedFocusBlockId(b.id)}
                  onLaunchPip={() => handleOpenPip(block)}
                  onInAppToast={setInAppToast}
                />
              );
            })
          )}

          {/* Add Block Button */}
          <button
            onClick={() =>
              openEditingPreset({
                id: `block_${Date.now()}`,
                name: "",
                start: "09:00",
                end: "10:00",
                priority: "medium",
                days: [0, 1, 2, 3, 4, 5, 6],
                icon: "ads_click",
                zeroXp: false,
              })
            }
            className="w-full py-4 mt-3 rounded-2xl border-2 border-dashed border-gray-200 dark:border-[#262626] text-blue-500 font-black flex items-center justify-center gap-2 hover:bg-blue-500/5 active:scale-98 transition-all"
          >
            <Icon name="add" size={20} /> Add Block
          </button>
        </div>
      </div>
    );
  };

  // ─── TAB 2: ANALYTICS & INTERACTIVE GRAPH ───────────────────────────────────
  const renderProgressTab = () => {
    const maxValReal = chartData.reduce((m, d) => Math.max(m, d.val), 0);
    const maxValChart = filterTask === "ALL" ? Math.max(100, maxValReal * 1.1) : Math.max(6, maxValReal * 1.2);
    const avgVal = chartData.length > 0 ? chartData.reduce((s, d) => s + d.val, 0) / chartData.length : 0;
    const totalVal = chartData.reduce((s, d) => s + d.val, 0);

    // ─── PERIOD MILESTONE CALCULATIONS ──────────────────────────────────────
    const isOverall = filterTask === "ALL";
    const dailyTarget = isOverall ? 80 : 2.0; // 80% daily milestone for score, or 2.0h/day for task
    const periodTarget = dailyTarget * tf;
    const milestonePercent = Math.min(100, Math.round((totalVal / periodTarget) * 100));
    const daysAchieved = chartData.filter((d) => d.val >= dailyTarget).length;

    // Milestone Tier Badge
    let milestoneBadge = { tier: "Momentum", icon: "rocket_launch", color: "#3b82f6" };
    if (milestonePercent >= 100) {
      milestoneBadge = { tier: "Diamond Milestone (100% Target Met!)", icon: "diamond", color: "#BF5AF2" };
    } else if (milestonePercent >= 75) {
      milestoneBadge = { tier: "Gold Milestone (75% Achieved)", icon: "workspace_premium", color: "#32D74B" };
    } else if (milestonePercent >= 50) {
      milestoneBadge = { tier: "Silver Milestone (50% Achieved)", icon: "military_tech", color: "#0A84FF" };
    } else if (milestonePercent >= 25) {
      milestoneBadge = { tier: "Bronze Milestone (25% Achieved)", icon: "shield", color: "#FF9F0A" };
    }

    const width = 340;
    const height = 180;
    const xStep = chartData.length > 1 ? width / (chartData.length - 1) : width;

    const points = chartData.map((d, i) => {
      const x = i * xStep;
      let rawY = height - (d.val / maxValChart) * height;
      if (isNaN(rawY) || !isFinite(rawY)) rawY = height;
      const y = Math.max(15, Math.min(height - 5, rawY));
      return { x, y, ...d, index: i };
    });

    // Smooth Bezier Curve Path Generator
    let pathD = "";
    let areaD = "";
    if (points.length > 0) {
      if (points.length === 1) {
        pathD = `M ${points[0].x} ${points[0].y}`;
        areaD = `M 0 ${height} L ${points[0].x} ${points[0].y} L ${width} ${points[0].y} L ${width} ${height} Z`;
      } else {
        pathD = `M ${points[0].x} ${points[0].y}`;
        for (let i = 0; i < points.length - 1; i++) {
          const p0 = points[i];
          const p1 = points[i + 1];
          const cpX = (p0.x + p1.x) / 2;
          pathD += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
        }
        areaD = `${pathD} L ${points[points.length - 1].x} ${height} L 0 ${height} Z`;
      }
    }

    const handleScrub = (clientX, rect) => {
      if (points.length === 0) return;
      const relX = ((clientX - rect.left) / rect.width) * width;
      let closest = points[0];
      let minDiff = Infinity;
      points.forEach((p) => {
        const diff = Math.abs(p.x - relX);
        if (diff < minDiff) {
          minDiff = diff;
          closest = p;
        }
      });
      setScrubberPoint(closest);
    };

    return (
      <div className="pb-32 select-none animate-in fade-in duration-500">
        <div className="px-4 pt-8 mb-6">
          <div className="flex justify-between items-center mb-5">
            <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white">
              Analytics
            </h1>

            {/* Line / Bar Chart Toggle */}
            <div className="flex bg-gray-100 dark:bg-[#222] p-1 rounded-2xl border border-gray-200/50 dark:border-[#333]">
              <button
                onClick={() => setChartViewMode("line")}
                className={`px-3 py-1 rounded-xl text-xs font-black transition-all ${
                  chartViewMode === "line"
                    ? "bg-white dark:bg-[#333] text-blue-500 shadow-sm"
                    : "text-gray-400"
                }`}
                title="Line Curve View"
              >
                Line
              </button>
              <button
                onClick={() => setChartViewMode("bar")}
                className={`px-3 py-1 rounded-xl text-xs font-black transition-all ${
                  chartViewMode === "bar"
                    ? "bg-white dark:bg-[#333] text-blue-500 shadow-sm"
                    : "text-gray-400"
                }`}
                title="Bar Chart View"
              >
                Bar
              </button>
            </div>
          </div>

          {/* ─── GRAPH SELECTOR PILLS STRIP & ADD TASK GRAPH ────────────────── */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-4 no-scrollbar">
            <button
              onClick={() => setFilterTask("ALL")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 ${
                filterTask === "ALL"
                  ? "bg-blue-500 text-white shadow-md shadow-blue-500/25"
                  : "bg-gray-100 dark:bg-[#1a1a1a] text-gray-600 dark:text-gray-300 border border-gray-200/50 dark:border-[#262626]"
              }`}
            >
              <Icon name="monitoring" size={14} /> Overall Score
            </button>

            {dynamicFilterOptions
              .filter((opt) => opt !== "ALL")
              .map((opt) => {
                const isSel = filterTask === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => setFilterTask(opt)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      isSel
                        ? "bg-blue-500 text-white shadow-md shadow-blue-500/25"
                        : "bg-gray-100 dark:bg-[#1a1a1a] text-gray-600 dark:text-gray-300 border border-gray-200/50 dark:border-[#262626]"
                    }`}
                  >
                    <Icon name="schedule" size={14} /> {opt}
                  </button>
                );
              })}

            <button
              onClick={() => setShowAddTaskGraphModal(true)}
              className="px-3.5 py-1.5 rounded-full text-xs font-black whitespace-nowrap transition-all border border-dashed border-blue-500/50 text-blue-500 hover:bg-blue-500/10 flex items-center gap-1"
            >
              <Icon name="add" size={14} /> Add Task Graph
            </button>
          </div>

          <div
            className={`${themeColors.surface} border ${themeColors.border} rounded-[32px] p-6 mb-6 shadow-sm`}
          >
            <div className="flex justify-between items-center mb-4">
              <div>
                <span className="font-black text-xl text-gray-900 dark:text-white flex items-center gap-2">
                  {isOverall ? "Overall Performance" : `${filterTask} Sessions`}
                </span>
                <span className="text-[11px] font-bold text-gray-400 block mt-0.5">
                  {isOverall
                    ? `Productivity score weighted by priority (${tf} Day Period)`
                    : `Multi-session tracked time (${tf} Day Period)`}
                </span>
              </div>

              {/* Timeframe selector */}
              <div className="flex bg-gray-100 dark:bg-[#222] p-1.5 rounded-2xl text-xs font-bold">
                {[7, 14, 30, 90].map((v) => (
                  <button
                    key={v}
                    onClick={() => setTf(v)}
                    className={`px-2.5 py-1 rounded-xl transition-all ${
                      tf === v
                        ? "bg-white dark:bg-[#333] shadow-sm text-black dark:text-white font-black"
                        : themeColors.text3
                    }`}
                  >
                    {v}D
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive SVG Chart Container */}
            {chartData.length < 2 ? (
              <div className={`h-44 flex items-center justify-center ${themeColors.text3} text-sm font-medium`}>
                Complete routines over 2 or more days to populate interactive graphs.
              </div>
            ) : (
              <div
                className="relative mt-4 overflow-visible rounded-2xl touch-none cursor-crosshair"
                style={{ width: "100%", aspectRatio: "340/190" }}
                onPointerMove={(e) => handleScrub(e.clientX, e.currentTarget.getBoundingClientRect())}
                onPointerLeave={() => setScrubberPoint(null)}
              >
                <svg
                  viewBox={`-10 -15 ${width + 20} ${height + 35}`}
                  className="w-full h-full overflow-visible"
                >
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0A84FF" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#0A84FF" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0A84FF" stopOpacity="1" />
                      <stop offset="100%" stopColor="#0A84FF" stopOpacity="0.4" />
                    </linearGradient>
                  </defs>

                  {/* Period Milestone Target Line */}
                  <line
                    x1="0"
                    y1={height - (dailyTarget / maxValChart) * height}
                    x2={width}
                    y2={height - (dailyTarget / maxValChart) * height}
                    stroke="#32D74B"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    opacity="0.6"
                  />
                  <text
                    x={width - 4}
                    y={Math.max(12, height - (dailyTarget / maxValChart) * height - 4)}
                    textAnchor="end"
                    fill="#32D74B"
                    fontSize="9"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {isOverall ? "Target: 80%" : `Target: ${dailyTarget.toFixed(1)}h/d`}
                  </text>

                  {/* LINE CHART MODE */}
                  {chartViewMode === "line" && (
                    <>
                      <path d={areaD} fill="url(#chartGrad)" />
                      <path
                        d={pathD}
                        fill="none"
                        stroke="#0A84FF"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {points.map((p, i) => {
                        const isScrubbed = scrubberPoint && scrubberPoint.index === i;
                        return (
                          <g key={i}>
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r={isScrubbed ? "6.5" : "4"}
                              fill={isDark ? "#111" : "#fff"}
                              stroke={p.val >= dailyTarget ? "#32D74B" : "#0A84FF"}
                              strokeWidth={isScrubbed ? "4" : "2.5"}
                              className="transition-all duration-150"
                            />
                          </g>
                        );
                      })}
                    </>
                  )}

                  {/* BAR CHART MODE */}
                  {chartViewMode === "bar" && (
                    <>
                      {points.map((p, i) => {
                        const bWidth = Math.max(6, Math.min(28, (width / points.length) * 0.65));
                        const bHeight = Math.max(4, height - p.y);
                        const isScrubbed = scrubberPoint && scrubberPoint.index === i;

                        return (
                          <rect
                            key={i}
                            x={p.x - bWidth / 2}
                            y={p.y}
                            width={bWidth}
                            height={bHeight}
                            rx={bWidth / 3}
                            ry={bWidth / 3}
                            fill={isScrubbed ? "#32D74B" : p.val >= dailyTarget ? "#0A84FF" : "url(#barGrad)"}
                            opacity={isScrubbed ? 1 : 0.85}
                            className="transition-all duration-150"
                          />
                        );
                      })}
                    </>
                  )}

                  {/* Vertical Guideline for Scrubber */}
                  {scrubberPoint && (
                    <line
                      x1={scrubberPoint.x}
                      y1={10}
                      x2={scrubberPoint.x}
                      y2={height}
                      stroke="#0A84FF"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                  )}
                </svg>

                {/* Multi-Session Interactive Tooltip Card Floating Above Scrubber */}
                {scrubberPoint && (
                  <div
                    className="absolute pointer-events-none -top-16 z-20 transition-all duration-100 ease-out"
                    style={{
                      left: `${Math.max(25, Math.min(75, (scrubberPoint.x / width) * 100))}%`,
                      transform: "translateX(-50%)",
                    }}
                  >
                    <div
                      className={`${themeColors.surface} border border-blue-500/50 rounded-2xl p-2.5 shadow-2xl backdrop-blur-lg flex flex-col gap-1 min-w-[160px] whitespace-nowrap`}
                    >
                      <div className="flex justify-between items-center text-[10px] font-mono text-gray-400">
                        <span>
                          {new Date(scrubberPoint.date + "T12:00:00").toLocaleDateString("en", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        <span
                          className={`font-black ${
                            scrubberPoint.val >= dailyTarget ? "text-[#32D74B]" : "text-amber-500"
                          }`}
                        >
                          {scrubberPoint.val >= dailyTarget ? "Target Met 🎯" : "Pacing"}
                        </span>
                      </div>
                      <div className="text-sm font-black text-blue-500">
                        {isOverall
                          ? `${Math.round(scrubberPoint.val)}% Score`
                          : `${scrubberPoint.val.toFixed(1)} hrs Total`}
                      </div>

                      {/* Multi-Session Itemized Breakdown */}
                      {scrubberPoint.sessions && scrubberPoint.sessions.length > 0 && (
                        <div className="mt-1 pt-1 border-t border-gray-100 dark:border-[#222] flex flex-col gap-0.5">
                          {scrubberPoint.sessions.map((s, idx) => (
                            <div key={idx} className="flex justify-between items-center text-[10px] text-gray-500 dark:text-gray-300">
                              <span className="truncate max-w-[100px]">{s.name}</span>
                              <span className="font-mono font-bold">
                                {s.durHours.toFixed(1)}h {s.status === "completed" ? "✅" : s.status === "partial" ? "⏳" : "⭕"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Summary Metrics Row */}
            <div className="grid grid-cols-3 gap-2 mt-6">
              <div className="bg-gray-50 dark:bg-[#1a1a1a] p-3 rounded-2xl text-center shadow-inner">
                <div className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">
                  Daily Avg
                </div>
                <div className="text-xl font-black text-blue-500">
                  {isOverall ? Math.round(avgVal) + "%" : avgVal.toFixed(1) + "h"}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-[#1a1a1a] p-3 rounded-2xl text-center shadow-inner">
                <div className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">
                  Peak Day
                </div>
                <div className="text-xl font-black text-[#32D74B]">
                  {isOverall ? Math.round(maxValReal) + "%" : maxValReal.toFixed(1) + "h"}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-[#1a1a1a] p-3 rounded-2xl text-center shadow-inner">
                <div className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">
                  Period Total
                </div>
                <div className="text-xl font-black text-[#FF9F0A]">
                  {isOverall ? `${daysAchieved}/${chartData.length}d` : `${totalVal.toFixed(1)}h`}
                </div>
              </div>
            </div>
          </div>

          {/* ─── PERIOD MILESTONES CARD ────────────────────────────────────── */}
          <div className={`${themeColors.surface} border ${themeColors.border} rounded-[32px] p-6 mb-6 shadow-sm`}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-gray-400">
                  {tf}-Day Period Milestones
                </span>
                <h3 className="text-lg font-black text-gray-900 dark:text-white mt-0.5 flex items-center gap-2">
                  <Icon name={milestoneBadge.icon} size={20} style={{ color: milestoneBadge.color }} />
                  {milestoneBadge.tier}
                </h3>
              </div>
              <span className="text-lg font-black" style={{ color: milestoneBadge.color }}>
                {milestonePercent}%
              </span>
            </div>

            {/* Milestone Progress Bar */}
            <div className="h-3 w-full bg-gray-100 dark:bg-[#222] rounded-full overflow-hidden p-0.5 mb-3">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${Math.min(100, Math.max(5, milestonePercent))}%`,
                  backgroundColor: milestoneBadge.color,
                }}
              />
            </div>

            <div className="flex justify-between text-xs font-mono font-bold text-gray-500 dark:text-gray-400">
              <span>
                Achieved: {isOverall ? `${Math.round(avgVal)}% avg` : `${totalVal.toFixed(1)} hrs`}
              </span>
              <span>
                Target: {isOverall ? "80% consistency" : `${periodTarget.toFixed(1)} hrs total`}
              </span>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-[#222] flex justify-between items-center text-xs">
              <span className="font-bold text-gray-500">Days Met Daily Milestone:</span>
              <span className="font-black text-[#32D74B]">
                {daysAchieved} of {chartData.length} days ({chartData.length > 0 ? Math.round((daysAchieved / chartData.length) * 100) : 0}%)
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── TAB 3: SETTINGS (ALARMS, NOTIFICATIONS, CLOUD, PRESETS) ────────────────
  const renderSettingsTab = () => {
    const handleInstallClick = async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") setDeferredPrompt(null);
      }
    };

    return (
      <div className="pb-32 px-4 pt-8 select-none animate-in fade-in duration-500">
        <h1 className="text-3xl font-black tracking-tight mb-6 text-gray-900 dark:text-white">
          Settings
        </h1>

        {deferredPrompt && (
          <div className="mb-6">
            <button
              onClick={handleInstallClick}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white font-black py-4 rounded-[24px] flex justify-center items-center gap-3 shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-transform text-lg"
            >
              <Icon name="download" size={24} /> Install TYMVERA
            </button>
          </div>
        )}

        {/* ─── ROUTINES LIBRARY (FIRST IN SETTINGS) ─────────────────────────── */}
        <div className="flex justify-between items-end mb-3 ml-2">
          <div className={`text-[11px] font-mono tracking-[2px] font-bold uppercase ${themeColors.text3}`}>
            Daily Routines
          </div>
        </div>
        <div className={`${themeColors.surface} border ${themeColors.border} rounded-[32px] overflow-hidden mb-8 shadow-sm`}>
          <button
            onClick={() =>
              openEditingPreset({
                id: `new_${Date.now()}`,
                name: "",
                start: "08:00",
                end: "09:00",
                priority: "medium",
                days: [1, 2, 3, 4, 5],
                icon: "ads_click",
                zeroXp: false,
              })
            }
            className="w-full p-5 flex items-center justify-center gap-2 text-blue-500 font-black border-b border-gray-100 dark:border-[#222] active:bg-gray-50 dark:active:bg-[#1a1a1a] transition-colors text-lg"
          >
            <Icon name="add" size={20} /> Create New Routine
          </button>

          <div className="max-h-[50vh] overflow-y-auto scroll-smooth">
            {sortedPresets.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs font-medium">
                No routines configured. Tap "Create New Routine" above to add your first routine.
              </div>
            ) : sortedPresets.map((p) => {
                const tObj = to12hObj(p.start);
                return (
                  <div
                    key={p.id}
                    onClick={() => openEditingPreset(p)}
                    className="flex flex-col p-5 border-b border-gray-100 dark:border-[#222] active:bg-gray-50 dark:active:bg-[#1a1a1a] cursor-pointer transition-colors group"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-light tracking-tight leading-none text-gray-900 dark:text-white">
                            {tObj.time}
                          </span>
                          <span className="text-xs font-bold text-gray-500 tracking-wider uppercase">
                            {tObj.period}
                          </span>
                        </div>
                        <div className="text-sm font-black mt-2 flex items-center gap-1.5 text-gray-800 dark:text-gray-200 flex-wrap">
                          <Icon name={p.icon || "monitoring"} size={16} />
                          <span>{p.name}</span>
                          {p.priority && !p.zeroXp && (
                            <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${pBadge(p.priority).bg}`}>
                              {pBadge(p.priority).text}
                            </span>
                          )}
                          {p.zeroXp && (
                            <span className="text-[9px] uppercase tracking-wider bg-purple-500/15 text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded font-black">
                              0XP
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs font-mono font-bold text-gray-400">
                          {mins(p.start, p.end)}m
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Delete routine "${p.name}"?`)) {
                              deletePreset(p.id);
                            }
                          }}
                          className="p-1.5 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                          title="Delete routine"
                        >
                          <Icon name="delete" size={18} />
                        </button>
                      </div>
                    </div>
                  <div className="flex gap-1.5">
                    {DAYS.map((d, i) => (
                      <div
                        key={i}
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-colors ${
                          p.days.includes(i)
                            ? "bg-blue-500 text-white shadow-sm"
                            : "bg-gray-100 dark:bg-[#222] text-gray-400"
                        }`}
                      >
                        {d}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── SMART WAKE-UP & SLEEP ALARMS CARD ────────────────────────────── */}
        <div className={`text-[11px] font-mono tracking-[2px] font-bold uppercase ${themeColors.text3} mb-3 ml-2`}>
          Smart Schedule Alarms
        </div>
        <div className={`${themeColors.surface} border ${themeColors.border} rounded-[32px] overflow-hidden shadow-sm mb-8`}>
          {/* Wake-Up Alarm Row */}
          <div className="p-5 border-b border-gray-100 dark:border-[#222]">
            <div className="flex justify-between items-center mb-3">
              <div>
                <div className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Icon name="wb_sunny" size={20} className="text-amber-500" />
                  Wake-Up Alarm
                </div>
                <div className="text-xs font-medium text-gray-500 mt-0.5">
                  {alarms.wake.autoSync
                    ? `Auto-synced to first block: ${to12h(alarms.wake.time)}`
                    : `Set for ${to12h(alarms.wake.time)}`}
                </div>
              </div>

              <button
                onClick={() => {
                  const willEnable = !alarms.wake.enabled;
                  if (willEnable) {
                    requestNotificationPermission();
                    startAudioKeepAlive();
                  }
                  setAlarms({
                    ...alarms,
                    wake: { ...alarms.wake, enabled: willEnable },
                  });
                }}
                className={`w-14 h-8 rounded-full transition-colors relative shadow-inner ${
                  alarms.wake.enabled ? "bg-[#32D74B]" : "bg-gray-200 dark:bg-[#333]"
                }`}
              >
                <div
                  className={`w-6 h-6 bg-white rounded-full absolute top-1 shadow-md transition-transform ${
                    alarms.wake.enabled ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {alarms.wake.enabled && (
              <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-[#222]">
                <label className="text-xs font-bold text-gray-600 dark:text-gray-300 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={alarms.wake.autoSync}
                    onChange={(e) =>
                      setAlarms({
                        ...alarms,
                        wake: { ...alarms.wake, autoSync: e.target.checked },
                      })
                    }
                    className="rounded text-blue-500 w-4 h-4"
                  />
                  Auto-sync to first daily task
                </label>

                {!alarms.wake.autoSync && (
                  <input
                    type="time"
                    value={alarms.wake.time}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAlarms({
                        ...alarms,
                        wake: { ...alarms.wake, time: val },
                      });
                      sessionStorage.removeItem(`alarm_wake_triggered_${todayStr()}_${val}`);
                    }}
                    className="text-xs font-black p-1.5 rounded-lg bg-gray-100 dark:bg-[#222] border-none outline-none"
                  />
                )}
              </div>
            )}
          </div>

          {/* Sleep / Bedtime Alarm Row */}
          <div className="p-5 border-b border-gray-100 dark:border-[#222]">
            <div className="flex justify-between items-center mb-3">
              <div>
                <div className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Icon name="bedtime" size={20} className="text-indigo-400" />
                  Sleep / Bedtime Alarm
                </div>
                <div className="text-xs font-medium text-gray-500 mt-0.5">
                  {alarms.sleep.autoSync
                    ? `Auto-synced to final block: ${to12h(alarms.sleep.time)}`
                    : `Set for ${to12h(alarms.sleep.time)}`}
                </div>
              </div>

              <button
                onClick={() => {
                  const willEnable = !alarms.sleep.enabled;
                  if (willEnable) {
                    requestNotificationPermission();
                    startAudioKeepAlive();
                  }
                  setAlarms({
                    ...alarms,
                    sleep: { ...alarms.sleep, enabled: willEnable },
                  });
                }}
                className={`w-14 h-8 rounded-full transition-colors relative shadow-inner ${
                  alarms.sleep.enabled ? "bg-[#32D74B]" : "bg-gray-200 dark:bg-[#333]"
                }`}
              >
                <div
                  className={`w-6 h-6 bg-white rounded-full absolute top-1 shadow-md transition-transform ${
                    alarms.sleep.enabled ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {alarms.sleep.enabled && (
              <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-[#222]">
                <label className="text-xs font-bold text-gray-600 dark:text-gray-300 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={alarms.sleep.autoSync}
                    onChange={(e) =>
                      setAlarms({
                        ...alarms,
                        sleep: { ...alarms.sleep, autoSync: e.target.checked },
                      })
                    }
                    className="rounded text-blue-500 w-4 h-4"
                  />
                  Auto-sync to last daily schedule
                </label>

                {!alarms.sleep.autoSync && (
                  <input
                    type="time"
                    value={alarms.sleep.time}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAlarms({
                        ...alarms,
                        sleep: { ...alarms.sleep, time: val },
                      });
                      sessionStorage.removeItem(`alarm_sleep_triggered_${todayStr()}_${val}`);
                    }}
                    className="text-xs font-black p-1.5 rounded-lg bg-gray-100 dark:bg-[#222] border-none outline-none"
                  />
                )}
              </div>
            )}
          </div>

          {/* Unified Signature Alarm Sound Banner & Test */}
          <div className="p-5 border-t border-gray-100 dark:border-[#222] bg-gradient-to-b from-transparent to-blue-500/5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                  <Icon name="graphic_eq" size={18} />
                </div>
                <div>
                  <div className="text-xs font-black text-gray-900 dark:text-white">
                    Obsidian Beacon (Signature Alarm)
                  </div>
                  <div className="text-[10px] font-mono text-gray-500">
                    Loud dual beacon + sub-bass kick • Calibrated for mobile speakers
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  playAlarmSound(1.0);
                  setTimeout(stopAlarmSound, 3500);
                }}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-blue-500/25 active:scale-95 transition-all shrink-0"
              >
                <Icon name="volume_up" size={16} /> Test Alarm (3s)
              </button>
            </div>
          </div>
        </div>

        {/* ─── CUSTOMIZABLE NOTIFICATIONS ENGINE CARD ───────────────────────── */}
        <div className={`text-[11px] font-mono tracking-[2px] font-bold uppercase ${themeColors.text3} mb-3 ml-2`}>
          Instant & Advance Notifications
        </div>
        <div className={`${themeColors.surface} border ${themeColors.border} rounded-[32px] overflow-hidden shadow-sm mb-8`}>
          {/* Main Toggle & Live Status Badge */}
          <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-[#222]">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-gray-900 dark:text-white">
                  Task Milestone Notifications
                </span>
                {notificationPermission === "granted" ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    ACTIVE
                  </span>
                ) : notificationPermission === "denied" ? (
                  <button
                    onClick={() => setShowPermissionModal(true)}
                    className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1 active:scale-95"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    BLOCKED (FIX)
                  </button>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gray-500/10 text-gray-400 border border-gray-500/20">
                    NOT ALLOWED
                  </span>
                )}
              </div>
              <div className="text-xs font-medium text-gray-500 mt-1">
                Alerts for task starts, finishes & handovers
              </div>
            </div>

            <button
              onClick={async () => {
                if (!notificationConfig.enabled) {
                  const res = await requestNotificationPermission();
                  if (typeof window !== "undefined" && "Notification" in window) {
                    setNotificationPermission(Notification.permission);
                  }
                  if (res.status === "denied") {
                    setShowPermissionModal(true);
                  }
                  setNotificationConfig({ ...notificationConfig, enabled: true });
                  playNotificationChime();
                } else {
                  setNotificationConfig({ ...notificationConfig, enabled: false });
                }
              }}
              className={`w-14 h-8 rounded-full transition-colors relative shadow-inner ${
                notificationConfig.enabled ? "bg-[#32D74B]" : "bg-gray-200 dark:bg-[#333]"
              }`}
            >
              <div
                className={`w-6 h-6 bg-white rounded-full absolute top-1 shadow-md transition-transform ${
                  notificationConfig.enabled ? "translate-x-7" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Blocked Permission Alert Banner inside Settings */}
          {notificationPermission === "denied" && (
            <div className="p-4 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between gap-3">
              <div className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                ⚠️ Notifications are blocked in your browser. Chrome won't send alerts until unblocked.
              </div>
              <button
                onClick={() => setShowPermissionModal(true)}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black shrink-0 active:scale-95"
              >
                How to Fix
              </button>
            </div>
          )}

          {/* Lead Time Options */}
          {notificationConfig.enabled && (
            <div className="p-5 border-b border-gray-100 dark:border-[#222]">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-3">
                Notification Timing Offset
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "0m (Exact)", val: 0 },
                  { label: "1 min", val: 1 },
                  { label: "2 min", val: 2 },
                  { label: "5 min", val: 5 },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setNotificationConfig({ ...notificationConfig, leadMins: opt.val })}
                    className={`py-2 rounded-xl text-xs font-black transition-all ${
                      notificationConfig.leadMins === opt.val
                        ? "bg-blue-500 text-white shadow-md shadow-blue-500/20"
                        : "bg-gray-100 dark:bg-[#222] text-gray-600 dark:text-gray-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Checkboxes for Start and End */}
              <div className="flex items-center gap-6 mt-4 pt-3 border-t border-gray-100 dark:border-[#222]">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={notificationConfig.notifyStart}
                    onChange={(e) =>
                      setNotificationConfig({
                        ...notificationConfig,
                        notifyStart: e.target.checked,
                      })
                    }
                    className="rounded text-blue-500 w-4 h-4"
                  />
                  Alert at Start
                </label>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={notificationConfig.notifyEnd}
                    onChange={(e) =>
                      setNotificationConfig({
                        ...notificationConfig,
                        notifyEnd: e.target.checked,
                      })
                    }
                    className="rounded text-blue-500 w-4 h-4"
                  />
                  Alert at Finish
                </label>
              </div>
            </div>
          )}

          {/* Test & Verification Controls */}
          <div className="p-4 bg-gray-50/50 dark:bg-[#181818]/50 flex flex-wrap justify-between items-center gap-3">
            <span className="text-xs font-bold text-gray-500">Alert Diagnostics & Tests</span>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => playNotificationChime()}
                className="px-2.5 py-1.5 rounded-xl bg-gray-100 dark:bg-[#222] text-xs font-black text-gray-700 dark:text-gray-300 flex items-center gap-1 active:scale-95 transition-all"
              >
                <Icon name="music_note" size={15} /> Chime
              </button>
              <button
                type="button"
                onClick={async () => {
                  let perm = notificationPermission;
                  if (perm !== "granted") {
                    const res = await requestNotificationPermission();
                    perm = res.status;
                    setNotificationPermission(perm);
                    if (perm === "denied") {
                      setShowPermissionModal(true);
                      return;
                    }
                  }
                  dispatchNotification({
                    title: "⚡ TYMVERA Section Alert",
                    body: "Routine milestone alerts and obsidian resonance are operating with precision.",
                    onInAppToast: setInAppToast,
                  });
                }}
                className="px-3 py-1.5 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 text-xs font-black flex items-center gap-1 active:scale-95 transition-all border border-blue-500/20"
              >
                <Icon name="send" size={15} /> Instant Alert
              </button>
              <button
                type="button"
                onClick={triggerDelayedLockScreenTest}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black flex items-center gap-1 active:scale-95 transition-all shadow-md shadow-blue-500/20"
              >
                <Icon name="phone_android" size={15} /> Test on Lock Screen (5s)
              </button>
            </div>
          </div>
        </div>

        {/* ─── NATIVE APP DOWNLOADS (FILTERED BY PLATFORM & HIDDEN IN INSTALLED APP) ─── */}
        {!isStandaloneApp && (
          <div>
            <div className={`text-[11px] font-mono tracking-[2px] font-bold uppercase ${themeColors.text3} mb-3 ml-2 flex items-center justify-between`}>
              <span>{userPlatform === "android" ? "Official Android Native App" : userPlatform === "windows" ? "Official Windows Desktop App" : "Official Standalone App"}</span>
              <span className="text-[9px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">100% Offline & Background Alarms</span>
            </div>
            <div className={`${themeColors.surface} border ${themeColors.border} rounded-[32px] p-6 mb-8 shadow-sm space-y-4`}>
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-white shrink-0"
                  style={{
                    backgroundColor: userPlatform === "android" ? "rgba(16, 185, 129, 0.15)" : "rgba(59, 130, 246, 0.15)",
                    color: userPlatform === "android" ? "#10b981" : "#3b82f6",
                    border: `1px solid ${userPlatform === "android" ? "rgba(16, 185, 129, 0.3)" : "rgba(59, 130, 246, 0.3)"}`,
                  }}
                >
                  <Icon name={userPlatform === "android" ? "phone_android" : userPlatform === "windows" ? "desktop_windows" : "download"} size={22} />
                </div>
                <div>
                  <div className="font-black text-sm text-gray-900 dark:text-white">
                    {userPlatform === "android" ? "Install TYMVERA for Android" : userPlatform === "windows" ? "Install TYMVERA for Windows" : "Install Standalone TYMVERA"}
                  </div>
                  <p className={`text-xs ${themeColors.text3} mt-1 leading-relaxed`}>
                    {userPlatform === "android"
                      ? "Official standalone Android app (.apk). Runs completely independent of Brave or Chrome, with 0ms offline startup, guaranteed AlarmManager alerts, and floating PiP overlay."
                      : "Official standalone desktop application. Runs natively in Windows with background system tray persistence, hardware PiP widget, and zero virus warnings."}
                  </p>
                </div>
              </div>

              {/* Action Button: Opens In-App Streaming Download with Progress Bar */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowDownloadModal(true)}
                  className="w-full py-3.5 px-4 rounded-2xl text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98]"
                  style={{
                    background: userPlatform === "android"
                      ? "linear-gradient(135deg, #059669 0%, #10b981 100%)"
                      : "linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)",
                    boxShadow: `0 8px 24px ${userPlatform === "android" ? "rgba(16, 185, 129, 0.25)" : "rgba(59, 130, 246, 0.25)"}`,
                  }}
                >
                  <Icon name="download" size={18} />
                  <span>
                    {userPlatform === "android"
                      ? "Download Official Android App (.apk • 8.0 MB)"
                      : userPlatform === "windows"
                      ? "Download Official Windows App (.exe • 80 KB)"
                      : "Download Official Standalone Package"}
                  </span>
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono pt-1">
                <span>In-app download • Zero redirects</span>
                <span className="text-emerald-500 font-bold">100% Offline Ready</span>
              </div>
            </div>
          </div>
        )}

        {/* ─── GOOGLE SIGN-IN & CLOUD SYNCHRONIZATION CARD ─────────────────── */}
        <div className={`text-[11px] font-mono tracking-[2px] font-bold uppercase ${themeColors.text3} mb-3 ml-2`}>
          Google Account & Cloud Sync
        </div>
        <div className={`${themeColors.surface} border ${themeColors.border} rounded-[32px] p-6 mb-8 shadow-sm`}>
          {currentUser ? (
            <div>
              <div className="flex items-center gap-4 mb-4">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName}
                    className="w-14 h-14 rounded-full object-cover border-2 border-blue-500"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-blue-500 text-white font-black text-xl flex items-center justify-center">
                    {(currentUser.displayName || currentUser.email || "U")[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-black text-lg text-gray-900 dark:text-white truncate">
                    {currentUser.displayName || "Google User"}
                  </div>
                  <div className="text-xs text-gray-500 font-mono truncate">{currentUser.email}</div>
                  <div className={`flex items-center gap-1.5 mt-1 text-xs font-bold ${isOnline ? "text-[#32D74B]" : "text-amber-500"}`}>
                    <Icon name={isOnline ? "cloud_done" : "cloud_off"} size={16} />
                    <span>{isOnline ? "Cloud Backup Active" : "Offline Mode (Saved locally)"}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-[#222]">
                <button
                  onClick={async () => {
                    if (!navigator.onLine) {
                      handleAddToast({
                        id: Date.now(),
                        title: "⚡ Offline Mode",
                        body: "Cannot sync while offline. Your changes are safely stored in local Dual IndexedDB.",
                        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                      });
                      return;
                    }
                    setCloudSyncStatus("syncing");
                    try {
                      await syncUserDataToCloud(currentUser.uid, {
                        history,
                        presets,
                        themeMode,
                        alarms,
                        notificationConfig,
                      });
                      setCloudSyncStatus("synced");
                      handleAddToast({
                        id: Date.now(),
                        title: "Cloud Sync Complete",
                        body: "All routines and timeline logs synced to Cloud Firestore!",
                        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                      });
                    } catch (e) {
                      setCloudSyncStatus("error");
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 font-black text-xs transition-all"
                >
                  Manual Sync
                </button>
                <button
                  onClick={handleSignOut}
                  className="py-2.5 px-4 rounded-xl bg-gray-100 dark:bg-[#222] text-gray-600 dark:text-gray-300 font-bold text-xs"
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                Backup routines and sync across devices
              </div>
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                Connect your Google account to automatically store timelines, smart alarms, and history in
                Cloud Firestore.
              </p>
              <button
                onClick={handleGoogleSignIn}
                className="w-full py-3.5 px-4 bg-white dark:bg-[#222] hover:bg-gray-50 dark:hover:bg-[#2a2a2a] text-gray-800 dark:text-white border border-gray-300 dark:border-[#333] rounded-2xl font-black text-sm flex items-center justify-center gap-3 shadow-sm active:scale-98 transition-all"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Sign in with Google
              </button>
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-[#222] flex justify-between items-center">
            <span className="text-[11px] text-gray-400 font-mono">Firebase Credentials</span>
            <button
              onClick={() => setShowFirebaseModal(true)}
              className="text-xs font-bold text-blue-500 hover:underline"
            >
              Configure API Keys
            </button>
          </div>
        </div>

        {/* Appearance */}
        <div className={`text-[11px] font-mono tracking-[2px] font-bold uppercase ${themeColors.text3} mb-3 ml-2`}>
          Appearance
        </div>
        <div className={`${themeColors.surface} border ${themeColors.border} rounded-3xl p-2 flex mb-8 shadow-sm`}>
          {["light", "dark", "system"].map((m) => (
            <button
              key={m}
              onClick={() => {
                setThemeMode(m);
                try {
                  localStorage.setItem("fo6_theme", m);
                } catch (e) {}
              }}
              className={`flex-1 py-3 rounded-2xl text-xs font-black capitalize transition-all ${
                themeMode === m
                  ? "bg-blue-500 text-white shadow-md shadow-blue-500/20"
                  : themeColors.text3
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Backup & Data Transfer */}
        <div className={`text-[11px] font-mono tracking-[2px] font-bold uppercase ${themeColors.text3} mb-3 ml-2 flex items-center gap-1.5`}>
          <Icon name="cloud_sync" size={14} className="text-blue-500" /> Backup & Portability
        </div>
        <div className={`${themeColors.surface} border ${themeColors.border} rounded-3xl p-4 mb-8 shadow-sm flex flex-col gap-2`}>
          <div className="text-xs font-bold text-gray-400 px-2 pb-1">Backup & Portability</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleExportBackup}
              className="py-3 px-3 rounded-2xl border border-gray-200 dark:border-[#2a2a2a] text-xs font-black text-gray-800 dark:text-gray-200 flex items-center justify-center gap-1.5 active:bg-gray-100 dark:active:bg-[#222] transition-colors"
            >
              <Icon name="download" size={16} className="text-blue-500" />
              Export .JSON
            </button>

            <label className="py-3 px-3 rounded-2xl border border-gray-200 dark:border-[#2a2a2a] text-xs font-black text-gray-800 dark:text-gray-200 flex items-center justify-center gap-1.5 cursor-pointer active:bg-gray-100 dark:active:bg-[#222] transition-colors">
              <Icon name="upload" size={16} className="text-emerald-500" />
              Import .JSON
              <input
                type="file"
                accept=".json"
                onChange={handleFileImport}
                className="hidden"
              />
            </label>
          </div>

          <button
            onClick={() => setShowBackupModal(true)}
            className="w-full py-2.5 px-3 rounded-2xl bg-gray-100 dark:bg-[#1e1e1e] text-xs font-black text-gray-600 dark:text-gray-300 flex items-center justify-center gap-1.5 active:opacity-70 transition-opacity"
          >
            <Icon name="code" size={16} /> Quick Copy / Paste Backup
          </button>
        </div>

        {/* Database Clean / Reset */}
        <div className={`text-[11px] font-mono tracking-[2px] font-bold uppercase ${themeColors.text3} mb-3 ml-2`}>
          Reset Options
        </div>
        <div className={`${themeColors.surface} border ${themeColors.border} rounded-[32px] overflow-hidden shadow-sm`}>
          <button
            onClick={() => {
              if (window.confirm("Remove all routines? Your schedule will be completely cleared.")) {
                setPresets([]);
                idbSet("fo6_presets", []);
                try {
                  localStorage.setItem("fo6_presets", "[]");
                } catch (e) {}
                handleAddToast({
                  id: Date.now(),
                  title: "Routines Cleared",
                  body: "All preset routines have been removed.",
                  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                });
              }
            }}
            className="w-full p-5 text-left text-[#FF9F0A] font-black border-b border-gray-100 dark:border-[#222] active:bg-gray-50 dark:active:bg-[#1a1a1a] transition-colors text-sm flex items-center justify-between"
          >
            <span>Clear All Routines</span>
            <Icon name="delete_sweep" size={18} />
          </button>
          <button
            onClick={() => {
              if (window.confirm("Wipe all local records and restart?")) {
                const req = indexedDB.deleteDatabase("TYMVERA_PWA_DB");
                localStorage.removeItem("fo6_history");
                localStorage.removeItem("tymvera_history_master_backup");
                req.onsuccess = () => window.location.reload();
              }
            }}
            className="w-full p-5 text-left text-[#FF3B30] font-black active:bg-gray-50 dark:active:bg-[#1a1a1a] transition-colors text-sm"
          >
            Delete All History & Reset
          </button>
        </div>
      </div>
    );
  };

  // ─── SMART SPLASH SCREEN ────────────────────────────────────────────────────
  if (!isReady) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: isDark ? "#080808" : "#ffffff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src="icon.png"
          alt="TYMVERA"
          style={{
            width: 90,
            height: 90,
            borderRadius: 24,
            marginBottom: 32,
            boxShadow: "0 20px 40px -10px rgba(0,0,0,0.2)",
          }}
        />
        <div
          style={{
            width: 28,
            height: 28,
            border: "3px solid #3b82f6",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const TABS = [
    { id: "today", icon: "home", label: "Home" },
    { id: "progress", icon: "bar_chart", label: "Analytics" },
    { id: "settings", icon: "settings", label: "Settings" },
  ];

  return (
    <div className={isDark ? "dark" : ""}>
      <div
        className={`h-screen overflow-y-auto overflow-x-hidden ${themeColors.bg} ${themeColors.text} font-sans flex justify-center selection:bg-blue-500/30 transition-colors duration-300`}
      >
        <div
          className={`w-full max-w-[430px] relative min-h-full border-x ${themeColors.border} ${themeColors.bg}`}
        >
          {tab === "today" && renderHomeTab()}
          {tab === "progress" && renderProgressTab()}
          {tab === "settings" && renderSettingsTab()}

          {/* Bottom Navigation Bar */}
          <div
            className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] ${
              isDark ? "bg-[#080808]/90" : "bg-white/90"
            } backdrop-blur-xl border-t ${themeColors.border} flex pb-safe pt-2 z-[100] pb-6`}
          >
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="flex-1 py-2 flex flex-col items-center gap-1 active:scale-95 transition-transform"
                >
                  <Icon
                    name={t.icon}
                    size={26}
                    className={active ? "text-blue-500" : themeColors.text3}
                    style={{ fontWeight: active ? 800 : 500 }}
                  />
                  <span
                    className={`text-[10px] font-black tracking-wide ${
                      active ? "text-blue-500" : themeColors.text3
                    }`}
                  >
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Lock Screen Test Countdown Banner */}
          {testingCountdown !== null && (
            <div className="fixed top-4 left-4 right-4 z-[9999] max-w-sm mx-auto shadow-2xl animate-bounce">
              <div className="p-4 rounded-3xl bg-blue-600 text-white border border-white/20 shadow-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-2xl bg-white text-blue-600 flex items-center justify-center font-black text-xl shadow-inner">
                    {testingCountdown}
                  </span>
                  <div>
                    <div className="text-xs font-black">LOCK YOUR PHONE NOW!</div>
                    <div className="text-[11px] text-blue-100">
                      Alert arrives on lock screen in {testingCountdown}s
                    </div>
                  </div>
                </div>
                <Icon name="phone_android" size={24} className="text-white shrink-0" />
              </div>
            </div>
          )}

          {/* Overlays & Modals */}
          {detachedTimer && (
            <FloatingTaskTimer
              block={detachedTimer.block}
              isPaused={isTimerPaused}
              remainingSeconds={focusBlockRemainingSeconds}
              totalSeconds={focusBlockTotalSeconds}
              completedPct={
                focusBlockTotalSeconds > 0
                  ? ((focusBlockTotalSeconds - focusBlockRemainingSeconds) / focusBlockTotalSeconds) * 100
                  : 0
              }
              initialPosition={detachedTimer.coords}
              isCurrentlyHeld={detachedTimer.isCurrentlyHeld}
              onTogglePause={toggleFocusTimerPause}
              onDockBack={() => setDetachedTimer(null)}
              onOpenFullscreen={() => setFullscreenTimerBlock(detachedTimer.block)}
              onInAppToast={setInAppToast}
            />
          )}

          {fullscreenTimerBlock && (
            <FullscreenFocusModal
              block={fullscreenTimerBlock}
              isPaused={isTimerPaused}
              remainingSeconds={focusBlockRemainingSeconds}
              totalSeconds={focusBlockTotalSeconds}
              completedPct={
                focusBlockTotalSeconds > 0
                  ? ((focusBlockTotalSeconds - focusBlockRemainingSeconds) / focusBlockTotalSeconds) * 100
                  : 0
              }
              onTogglePause={toggleFocusTimerPause}
              onClose={() => setFullscreenTimerBlock(null)}
              onInAppToast={setInAppToast}
            />
          )}

          {renderInAppToast()}
          {renderAlarmModal()}
          {renderPermissionModal()}
          {renderDownloadModal()}
          {renderFirebaseModal()}
          {renderBackupModal()}
          {renderShareCardModal()}
          {renderStorageInspectorModal()}
          {renderAddTaskGraphModal()}
          {editingPreset && renderPresetEditor()}
          {partialModal && renderPartialModal()}
          {showCalendar && renderCalendar()}
          {burst && renderConfetti()}
        </div>
      </div>
    </div>
  );
}

// ── ROOT EXPORT ──
export default function App() {
  return (
    <ErrorBoundary>
      <TYMVERA />
    </ErrorBoundary>
  );
}
