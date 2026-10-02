import React from "react";
import { openDocumentPipWindow, formatTimerSeconds } from "../services/pipTimerEngine";

const Icon = ({ name, size = 18, className = "", style = {} }) => (
  <span
    className={`material-symbols-rounded select-none inline-flex items-center justify-center ${className}`}
    style={{ fontSize: size, width: size, height: size, ...style }}
  >
    {name}
  </span>
);

/**
 * TaskSectionTimer: Embedded inside the routine section card.
 * - Shows exact time remaining, completed percentage, and Pause/Resume.
 * - Single click pops up Picture-in-Picture mode.
 * - Tap and hold (400ms without scrolling) detaches the timer into the user's hand/mouse.
 */
export default function TaskSectionTimer({
  block,
  isCurrent = false,
  isPaused = false,
  remainingSeconds = 0,
  totalSeconds = 3600,
  completedPct = 0,
  onTogglePause,
  onOpenFullscreen,
  onInAppToast,
  onLaunchPip,
  isDark = true,
  themeColors,
}) {
  const formattedTime = formatTimerSeconds(remainingSeconds);
  const clampedPct = Math.max(0, Math.min(100, Math.round(completedPct)));

  // Trigger Picture-in-Picture
  const handleTriggerPip = async (e) => {
    if (e) e.stopPropagation();
    if (onLaunchPip) {
      onLaunchPip();
      return;
    }
    try {
      const pipWin = await openDocumentPipWindow({
        taskName: block.name,
        timeFormatted: formattedTime,
        isPaused,
        progressPct: clampedPct,
        onTogglePause,
        onClose: () => {},
      });

      if (pipWin && onInAppToast) {
        onInAppToast({
          id: Date.now(),
          title: "Picture-in-Picture Active",
          body: `Floating window active for "${block.name}".`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });
      }
    } catch (err) {
      console.warn("PiP launch error:", err);
    }
  };

  return (
    <div
      onClick={handleTriggerPip}
      className="my-2.5 p-3 rounded-2xl bg-black/25 dark:bg-white/[0.03] border border-blue-500/30 backdrop-blur-md cursor-pointer select-none relative overflow-hidden group transition-all hover:border-blue-500/50"
      title="Click to open Picture-in-Picture • Tap & hold to float"
    >
      <div className="flex items-center justify-between gap-3 relative z-10">
        {/* Left: Time and Percentage */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className="w-2 h-2 rounded-full animate-ping"
              style={{ backgroundColor: isPaused ? "#F59E0B" : "#3b82f6" }}
            />
            <span className="text-[10px] font-mono font-black uppercase tracking-wider text-blue-500 dark:text-blue-400">
              {isPaused ? "Paused" : "Live Routine Timer"}
            </span>
            <span className="text-[10px] font-mono font-bold text-gray-500 dark:text-gray-400">
              • {clampedPct}% Done
            </span>
          </div>

          <div className="text-2xl font-black font-mono tracking-tight text-gray-900 dark:text-white flex items-baseline gap-2">
            <span>{formattedTime}</span>
            <span className="text-[11px] font-sans font-medium text-gray-400">left</span>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Pause / Resume Button ("Post and Resume") */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onTogglePause) onTogglePause();
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm active:scale-95 ${
              isPaused
                ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/25"
                : "bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/25"
            }`}
          >
            <Icon name={isPaused ? "play_arrow" : "pause"} size={15} />
            <span>{isPaused ? "Resume" : "Pause"}</span>
          </button>

          {/* Picture-in-Picture Button */}
          <button
            type="button"
            onClick={handleTriggerPip}
            className="p-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/25 transition-all active:scale-95"
            title="Pop up Picture-in-Picture window"
          >
            <Icon name="picture_in_picture_alt" size={16} />
          </button>

          {/* Fullscreen Button */}
          {onOpenFullscreen && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenFullscreen();
              }}
              className="p-2 rounded-xl bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 text-gray-600 dark:text-gray-300 transition-all active:scale-95"
              title="Full Screen Focus"
            >
              <Icon name="fullscreen" size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Subtle Hint Bar */}
      <div className="mt-2 pt-1.5 border-t border-dashed border-gray-200/40 dark:border-white/10 flex items-center justify-between text-[10px] font-mono text-gray-500 dark:text-gray-400 relative z-10">
        <span className="flex items-center gap-1">
          <Icon name="touch_app" size={12} className="text-blue-500" />
          Click for PiP • Hold to float on screen
        </span>
        <span className="opacity-80">{block.start} – {block.end}</span>
      </div>
    </div>
  );
}
