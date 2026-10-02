import React from "react";
import LiquidBottleGauge from "./LiquidBottleGauge";
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
 * FullscreenBottleModal: Minimalist, zen obsidian full-screen view
 * featuring the giant liquid bottle gauge draining like battery percentage.
 */
export default function FullscreenBottleModal({
  block,
  isPaused = false,
  remainingSeconds = 0,
  totalSeconds = 3600,
  onTogglePause,
  onClose,
  onInAppToast,
}) {
  if (!block) return null;

  const remainingPct = totalSeconds > 0
    ? Math.max(0, Math.min(100, (remainingSeconds / totalSeconds) * 100))
    : 0;

  const formattedTime = formatTimerSeconds(remainingSeconds);

  const handleLaunchPip = async () => {
    try {
      await openDocumentPipWindow({
        taskName: block.name,
        timeFormatted: formattedTime,
        isPaused,
        progressPct: remainingPct,
        onTogglePause,
        onClose: () => {},
      });
      if (onInAppToast) {
        onInAppToast({
          id: Date.now(),
          title: "PiP Window Opened",
          body: `Picture-in-Picture launched for "${block.name}".`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });
      }
      onClose();
    } catch (e) {
      console.warn("PiP launch error:", e);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-[#050505] text-white flex flex-col justify-between p-6 sm:p-12 select-none animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex justify-between items-center max-w-xl w-full mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-blue-400">
            <Icon name={block.icon || "monitoring"} size={22} />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-white">{block.name}</h2>
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

      {/* Main Center Display: Giant Liquid Bottle & Countdown */}
      <div className="flex flex-col items-center justify-center my-auto py-6">
        {/* Giant Liquid Bottle Gauge */}
        <div className="relative mb-6 transform hover:scale-105 transition-transform duration-500">
          <LiquidBottleGauge
            percent={remainingPct}
            isPaused={isPaused}
            width={110}
            height={190}
            showLabel={false}
          />
        </div>

        {/* Battery / Energy Percentage */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 mb-4 backdrop-blur-md">
          <span
            className="w-2.5 h-2.5 rounded-full animate-ping"
            style={{ backgroundColor: isPaused ? "#F59E0B" : "#10B981" }}
          />
          <span className="text-sm font-mono font-black tracking-wider text-gray-300">
            {Math.round(remainingPct)}% Energy Remaining
          </span>
        </div>

        {/* Giant Monospaced Digits */}
        <div className="text-6xl sm:text-8xl font-black font-mono tracking-tighter text-white drop-shadow-2xl my-2">
          {formattedTime}
        </div>

        <div className="text-xs font-mono tracking-widest text-gray-500 uppercase mt-1">
          {isPaused ? "Session Suspended" : "Pure Resonance Focus"}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="max-w-md w-full mx-auto flex items-center justify-center gap-4">
        {/* Pause / Resume Button */}
        <button
          type="button"
          onClick={onTogglePause}
          className={`flex-1 py-4 px-6 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-98 shadow-xl ${
            isPaused
              ? "bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/25"
              : "bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/25"
          }`}
        >
          <Icon name={isPaused ? "play_arrow" : "pause"} size={22} />
          <span>{isPaused ? "Resume Session" : "Pause Session"}</span>
        </button>
      </div>
    </div>
  );
}
