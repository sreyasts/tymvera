import React, { useState, useEffect, useRef } from "react";
import {
  formatTimerSeconds,
  openDocumentPipWindow,
  updateDocumentPipWindow,
  closeDocumentPipWindow,
  openVideoPipFallback,
} from "../services/pipTimerEngine";

export default function FocusTimerSection({
  activeBlock,
  allBlocks = [],
  themeColors,
  isDark = true,
  onCompleteTask,
  onInAppToast,
}) {
  // Timer State
  const defaultTaskName = activeBlock ? activeBlock.name : (allBlocks[0] ? allBlocks[0].name : "Focus Session");
  const [taskName, setTaskName] = useState(defaultTaskName);
  const [totalSeconds, setTotalSeconds] = useState(25 * 60);
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
  const [isPaused, setIsPaused] = useState(true);
  const [mode, setMode] = useState("card"); // 'card' | 'minimized' | 'fullscreen'
  const [isPipActive, setIsPipActive] = useState(false);

  // Sync with activeBlock if it changes and timer is paused at start
  useEffect(() => {
    if (activeBlock && activeBlock.name) {
      setTaskName(activeBlock.name);
      if (activeBlock.start && activeBlock.end) {
        const [sh, sm] = activeBlock.start.split(":").map(Number);
        const [eh, em] = activeBlock.end.split(":").map(Number);
        let diff = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
        if (diff <= 0) diff += 24 * 60;
        const secs = diff * 60;
        setTotalSeconds(secs);
        setRemainingSeconds(secs);
      }
    }
  }, [activeBlock]);

  // Main countdown tick
  useEffect(() => {
    let interval = null;
    if (!isPaused && remainingSeconds > 0) {
      interval = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setIsPaused(true);
            if (typeof onInAppToast === "function") {
              onInAppToast({
                id: `timer_done_${Date.now()}`,
                title: `🏁 ${taskName} Completed!`,
                body: "Focus timer finished. Great work on this milestone!",
                icon: "/icon-192.png",
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              });
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPaused, remainingSeconds, taskName, onInAppToast]);

  // Sync with Document PiP window if open
  useEffect(() => {
    if (isPipActive) {
      const progressPct = totalSeconds > 0 ? Math.min(100, Math.max(0, ((totalSeconds - remainingSeconds) / totalSeconds) * 100)) : 0;
      updateDocumentPipWindow({
        taskName,
        timeFormatted: formatTimerSeconds(remainingSeconds),
        isPaused,
        progressPct,
        onTogglePause: handleTogglePause,
      });
    }
  }, [remainingSeconds, isPaused, taskName, isPipActive, totalSeconds]);

  const handleTogglePause = () => {
    setIsPaused((prev) => !prev);
  };

  const handleReset = (mins = 25) => {
    const s = mins * 60;
    setTotalSeconds(s);
    setRemainingSeconds(s);
    setIsPaused(true);
  };

  const handleOpenPip = async () => {
    const progressPct = totalSeconds > 0 ? Math.min(100, Math.max(0, ((totalSeconds - remainingSeconds) / totalSeconds) * 100)) : 0;
    const pipWin = await openDocumentPipWindow({
      taskName,
      timeFormatted: formatTimerSeconds(remainingSeconds),
      isPaused,
      progressPct,
      onTogglePause: handleTogglePause,
      onClose: () => setIsPipActive(false),
    });

    if (pipWin) {
      setIsPipActive(true);
      // Auto-minimize in-app card when native PiP window is open
      setMode("minimized");
    } else {
      // Fallback to Canvas Video PiP or in-app corner mode
      const videoPipSuccess = await openVideoPipFallback({
        taskName,
        timeFormatted: formatTimerSeconds(remainingSeconds),
        isPaused,
      });
      if (!videoPipSuccess) {
        setMode("minimized");
      }
    }
  };

  const handleClosePip = () => {
    closeDocumentPipWindow();
    setIsPipActive(false);
  };

  const progressPercent = totalSeconds > 0
    ? Math.min(100, Math.max(0, ((totalSeconds - remainingSeconds) / totalSeconds) * 100))
    : 0;

  const formattedTime = formatTimerSeconds(remainingSeconds);

  // ─── 1. FULL SCREEN FOCUS MODE ──────────────────────────────────────────────
  if (mode === "fullscreen") {
    return (
      <div className="fixed inset-0 z-[4000] bg-[#080808] text-white flex flex-col justify-between p-6 sm:p-12 select-none animate-in fade-in duration-300">
        {/* Top Header */}
        <div className="flex justify-between items-center w-full max-w-2xl mx-auto">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-gray-400">
              {isPaused ? "Paused" : "Focus Mode Active"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenPip}
              className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              title="Pop out in Picture-in-Picture window"
            >
              <span className="material-symbols-rounded text-xl">picture_in_picture_alt</span>
            </button>
            <button
              onClick={() => setMode("minimized")}
              className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              title="Minimize to Corner"
            >
              <span className="material-symbols-rounded text-xl">expand_more</span>
            </button>
            <button
              onClick={() => setMode("card")}
              className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              title="Exit Full Screen"
            >
              <span className="material-symbols-rounded text-xl">fullscreen_exit</span>
            </button>
          </div>
        </div>

        {/* Center Display: Task Name & Huge Timer Digits */}
        <div className="flex flex-col items-center justify-center my-auto w-full max-w-xl mx-auto text-center">
          <div className="text-sm sm:text-base font-bold text-gray-400 uppercase tracking-widest mb-3 px-4 py-1.5 rounded-full bg-white/5 border border-white/10">
            {taskName}
          </div>

          <div
            className={`text-7xl sm:text-9xl font-black font-mono tracking-tight my-6 transition-colors duration-300 ${
              isPaused ? "text-amber-400" : "text-white"
            }`}
          >
            {formattedTime}
          </div>

          {/* Progress Bar */}
          <div className="w-full max-w-md h-2 bg-white/10 rounded-full overflow-hidden mb-8">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                isPaused ? "bg-amber-400" : "bg-emerald-400"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Controls: Pause / Resume, Adjustments, Done */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setRemainingSeconds((prev) => Math.max(0, prev - 300))}
              className="px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-xs font-mono font-bold text-gray-400 active:scale-95 transition-all"
            >
              -5m
            </button>

            <button
              onClick={handleTogglePause}
              className={`px-8 py-4 rounded-3xl font-black text-sm flex items-center gap-2 shadow-2xl active:scale-95 transition-all ${
                isPaused
                  ? "bg-emerald-400 text-black hover:bg-emerald-300 shadow-emerald-400/20"
                  : "bg-amber-400 text-black hover:bg-amber-300 shadow-amber-400/20"
              }`}
            >
              <span className="material-symbols-rounded text-2xl">
                {isPaused ? "play_arrow" : "pause"}
              </span>
              <span>{isPaused ? "Resume" : "Pause"}</span>
            </button>

            <button
              onClick={() => setRemainingSeconds((prev) => prev + 300)}
              className="px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-xs font-mono font-bold text-gray-400 active:scale-95 transition-all"
            >
              +5m
            </button>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="text-center text-xs font-mono text-gray-600">
          TYMVERA Focus Mode • Picture-in-Picture & Fullscreen Active
        </div>
      </div>
    );
  }

  // ─── 2. CORNER MINIMIZED FLOATING WIDGET (Like another window) ──────────────
  if (mode === "minimized") {
    return (
      <div className="fixed bottom-24 right-4 z-[990] animate-in slide-in-from-bottom-4 duration-200">
        <div className="bg-[#121212]/95 border border-[#2a2a2a] text-white p-3.5 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center gap-3 w-64">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold text-gray-400 truncate uppercase tracking-wider">
              {taskName}
            </div>
            <div
              className={`text-xl font-black font-mono tracking-tight ${
                isPaused ? "text-amber-400" : "text-white"
              }`}
            >
              {formattedTime}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleTogglePause}
              className={`w-8 h-8 rounded-xl flex items-center justify-center text-black font-bold active:scale-95 transition-all ${
                isPaused ? "bg-emerald-400" : "bg-amber-400"
              }`}
              title={isPaused ? "Resume" : "Pause"}
            >
              <span className="material-symbols-rounded text-lg">
                {isPaused ? "play_arrow" : "pause"}
              </span>
            </button>

            <button
              onClick={() => setMode("fullscreen")}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center transition-colors"
              title="Full Screen"
            >
              <span className="material-symbols-rounded text-base">fullscreen</span>
            </button>

            <button
              onClick={() => setMode("card")}
              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
              title="Expand back to section"
            >
              <span className="material-symbols-rounded text-base">expand_less</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── 3. DEFAULT IN-APP SECTION CARD ─────────────────────────────────────────
  return (
    <div className="px-4 mb-5">
      <div className={`${themeColors.surface} border ${themeColors.border} rounded-[32px] p-5 shadow-sm overflow-hidden relative group`}>
        {/* Top Header Row */}
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
              <span className="material-symbols-rounded text-lg">timer</span>
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400 font-bold block">
                Focus Session Timer
              </span>
              <span className="text-sm font-black text-gray-900 dark:text-white truncate block">
                {taskName}
              </span>
            </div>
          </div>

          {/* Mode Switchers: PiP, Fullscreen, Corner */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleOpenPip}
              className="px-2.5 py-1.5 rounded-xl bg-gray-100 dark:bg-[#1a1a1a] hover:bg-blue-500/10 hover:text-blue-500 text-gray-600 dark:text-gray-300 text-xs font-bold flex items-center gap-1 transition-all active:scale-95"
              title="Open in Picture-in-Picture window (floats above all other apps)"
            >
              <span className="material-symbols-rounded text-base">picture_in_picture_alt</span>
              <span className="hidden sm:inline">PiP</span>
            </button>

            <button
              onClick={() => setMode("fullscreen")}
              className="px-2.5 py-1.5 rounded-xl bg-gray-100 dark:bg-[#1a1a1a] hover:bg-blue-500/10 hover:text-blue-500 text-gray-600 dark:text-gray-300 text-xs font-bold flex items-center gap-1 transition-all active:scale-95"
              title="Full Screen Focus"
            >
              <span className="material-symbols-rounded text-base">fullscreen</span>
              <span className="hidden sm:inline">Full</span>
            </button>

            <button
              onClick={() => setMode("minimized")}
              className="p-1.5 rounded-xl bg-gray-100 dark:bg-[#1a1a1a] hover:bg-gray-200 dark:hover:bg-[#252525] text-gray-500 hover:text-gray-900 dark:hover:text-white transition-all active:scale-95"
              title="Minimize to Corner Widget"
            >
              <span className="material-symbols-rounded text-base">minimize</span>
            </button>
          </div>
        </div>

        {/* Big Time Display & Action Buttons */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-[#222]">
          <div className="flex items-baseline gap-2">
            <span
              className={`text-4xl sm:text-5xl font-black font-mono tracking-tight ${
                isPaused ? "text-amber-500 dark:text-amber-400" : "text-gray-900 dark:text-white"
              }`}
            >
              {formattedTime}
            </span>
            <span className="text-[11px] font-mono font-bold text-gray-400">
              {isPaused ? "PAUSED" : "RUNNING"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTogglePause}
              className={`px-4 py-2.5 rounded-2xl font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all ${
                isPaused
                  ? "bg-emerald-500 text-black hover:bg-emerald-400 shadow-emerald-500/20"
                  : "bg-amber-500 text-black hover:bg-amber-400 shadow-amber-500/20"
              }`}
            >
              <span className="material-symbols-rounded text-base">
                {isPaused ? "play_arrow" : "pause"}
              </span>
              <span>{isPaused ? "Resume" : "Pause"}</span>
            </button>

            <button
              onClick={() => handleReset(25)}
              className="p-2.5 rounded-2xl bg-gray-100 dark:bg-[#1a1a1a] text-gray-500 hover:text-gray-900 dark:hover:text-white active:scale-95 transition-all"
              title="Reset Timer to 25m"
            >
              <span className="material-symbols-rounded text-base">restart_alt</span>
            </button>
          </div>
        </div>

        {/* Bottom Thin Progress Bar */}
        <div className="w-full h-1.5 bg-gray-100 dark:bg-[#1c1c1c] rounded-full overflow-hidden mt-3">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              isPaused ? "bg-amber-400" : "bg-[#32D74B]"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
