import React from "react";
import { formatTimerSeconds, openDocumentPipWindow } from "../services/pipTimerEngine";

const Icon = ({ name, size = 24, className = "", style = {} }) => (
  <span
    className={`material-symbols-rounded select-none inline-flex items-center justify-center ${className}`}
    style={{ fontSize: size, width: size, height: size, ...style }}
  >
    {name}
  </span>
);

/**
 * FullscreenFocusModal: Minimalist, zen obsidian full-screen view.
 * Features background progress fill covering the completed portion,
 * giant monospaced digits, and pause/resume controls.
 */
export default function FullscreenFocusModal({
  block,
  isPaused = false,
  remainingSeconds = 0,
  totalSeconds = 3600,
  completedPct = 0,
  onTogglePause,
  onClose,
  onInAppToast,
}) {
  if (!block) return null;

  const clampedPct = Math.max(0, Math.min(100, Math.round(completedPct)));
  const formattedTime = formatTimerSeconds(remainingSeconds);

  const handleLaunchPip = async () => {
    try {
      await openDocumentPipWindow({
        taskName: block.name,
        timeFormatted: formattedTime,
        isPaused,
        progressPct: clampedPct,
        onTogglePause,
        onClose: () => {},
      });
      if (onInAppToast) {
        onInAppToast({
          id: Date.now(),
          title: "PiP Window Opened",
          body: `Picture-in-Picture active for "${block.name}".`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });
      }
      onClose();
    } catch (e) {
      console.warn("PiP launch error:", e);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-[#050505] text-white flex flex-col justify-between p-6 sm:p-12 select-none animate-in fade-in duration-300 overflow-hidden">
      {/* ─── BACKGROUND COMPLETED PROGRESS FILL ─── */}
      <div
        className="absolute inset-y-0 left-0 pointer-events-none transition-all duration-1000 ease-linear"
        style={{
          width: `${Math.max(1, Math.min(100, clampedPct))}%`,
          background: isPaused
            ? "linear-gradient(90deg, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.18) 99%, rgba(251, 191, 36, 0.6) 100%)"
            : "linear-gradient(90deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.22) 99%, rgba(96, 165, 250, 0.7) 100%)",
        }}
      >
        <div className="absolute top-0 bottom-0 right-0 w-[3px] bg-blue-500 shadow-[0_0_20px_#3b82f6]" />
      </div>

      {/* Top Header */}
      <div className="flex justify-between items-center max-w-2xl w-full mx-auto relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-blue-400">
            <Icon name={block.icon || "monitoring"} size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-white">{block.name}</h2>
            <div className="text-xs font-mono text-gray-400">
              {block.start} – {block.end}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* PiP Shortcut */}
          <button
            type="button"
            onClick={handleLaunchPip}
            className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-all active:scale-95"
            title="Pop up Picture-in-Picture"
          >
            <Icon name="picture_in_picture_alt" size={20} />
          </button>

          {/* Close / Exit Fullscreen */}
          <button
            type="button"
            onClick={onClose}
            className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-all active:scale-95"
            title="Exit Fullscreen"
          >
            <Icon name="fullscreen_exit" size={20} />
          </button>
        </div>
      </div>

      {/* Main Center Display: Giant Digital Readout & Completed % */}
      <div className="flex flex-col items-center justify-center my-auto py-8 relative z-10">
        {/* Progress Percentage Badge */}
        <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/5 border border-white/10 mb-6 backdrop-blur-md">
          <span
            className="w-2.5 h-2.5 rounded-full animate-ping"
            style={{ backgroundColor: isPaused ? "#F59E0B" : "#3b82f6" }}
          />
          <span className="text-sm font-mono font-black tracking-wider text-blue-400">
            {clampedPct}% Completed
          </span>
        </div>

        {/* Giant Monospaced Digits */}
        <div className="text-7xl sm:text-9xl font-black font-mono tracking-tighter text-white drop-shadow-2xl my-2">
          {formattedTime}
        </div>

        <div className="text-xs font-mono tracking-widest text-gray-400 uppercase mt-2">
          {isPaused ? "Session Paused" : "Routine in Progress"}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="max-w-md w-full mx-auto flex items-center justify-center gap-4 relative z-10">
        {/* Pause / Resume Button */}
        <button
          type="button"
          onClick={onTogglePause}
          className={`flex-1 py-4 px-6 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-98 shadow-xl ${
            isPaused
              ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/30"
              : "bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/30"
          }`}
        >
          <Icon name={isPaused ? "play_arrow" : "pause"} size={22} />
          <span>{isPaused ? "Resume Routine" : "Pause Routine"}</span>
        </button>
      </div>
    </div>
  );
}
