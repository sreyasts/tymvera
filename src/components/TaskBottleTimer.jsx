import React, { useState, useRef, useEffect } from "react";
import LiquidBottleGauge from "./LiquidBottleGauge";
import { openDocumentPipWindow, formatTimerSeconds } from "../services/pipTimerEngine";

// Simple Icon component helper if not passed
const Icon = ({ name, size = 18, className = "", style = {} }) => (
  <span
    className={`material-symbols-rounded select-none inline-flex items-center justify-center ${className}`}
    style={{ fontSize: size, width: size, height: size, ...style }}
  >
    {name}
  </span>
);

/**
 * TaskBottleTimer: Embedded directly inside a routine section card.
 * - Displays liquid bottle gauge decreasing like battery percentage
 * - Shows countdown time, task/mark name, and Pause/Resume ("post and resume")
 * - Clicking pops up Picture-in-Picture mode
 * - Pressing and dragging outside the section detaches the timer to float on screen
 */
export default function TaskBottleTimer({
  block,
  isCurrent = false,
  isPaused = false,
  remainingSeconds = 0,
  totalSeconds = 3600,
  onTogglePause,
  onDetach,
  onOpenFullscreen,
  onInAppToast,
  themeColors,
}) {
  const containerRef = useRef(null);
  const dragStartRef = useRef(null);
  const [isPressing, setIsPressing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Percentage of remaining time (like battery level)
  const remainingPct = totalSeconds > 0
    ? Math.max(0, Math.min(100, (remainingSeconds / totalSeconds) * 100))
    : 0;

  const formattedTime = formatTimerSeconds(remainingSeconds);

  // Trigger Picture-in-Picture
  const handleTriggerPip = async (e) => {
    if (e) e.stopPropagation();
    try {
      const pipWin = await openDocumentPipWindow({
        taskName: block.name,
        timeFormatted: formattedTime,
        isPaused,
        progressPct: remainingPct,
        onTogglePause,
        onClose: () => {},
      });

      if (pipWin) {
        if (onInAppToast) {
          onInAppToast({
            id: Date.now(),
            title: "Picture-in-Picture Active",
            body: `Floating PiP window opened for "${block.name}".`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          });
        }
      } else {
        // Fallback: detach as floating in-app window
        if (onDetach) {
          onDetach({
            block,
            initialCoords: { x: window.innerWidth - 180, y: window.innerHeight - 240 },
          });
        }
      }
    } catch (err) {
      console.warn("PiP launch error:", err);
      if (onDetach) onDetach({ block, initialCoords: { x: window.innerWidth - 180, y: window.innerHeight - 240 } });
    }
  };

  // Drag-to-detach handling: detect when user drags outside the section
  const handlePointerDown = (e) => {
    // Only primary button
    if (e.button !== 0 && e.type !== "touchstart") return;
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);

    dragStartRef.current = {
      x: clientX,
      y: clientY,
      time: Date.now(),
      hasDetached: false,
    };
    setIsPressing(true);
  };

  const handlePointerMove = (e) => {
    if (!dragStartRef.current || dragStartRef.current.hasDetached) return;
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);

    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;
    const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    setDragOffset({ x: deltaX * 0.4, y: deltaY * 0.4 });

    // Check if dragged outside the card boundary
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const isOutside =
        clientX < rect.left - 20 ||
        clientX > rect.right + 20 ||
        clientY < rect.top - 20 ||
        clientY > rect.bottom + 20 ||
        dist > 65;

      if (isOutside) {
        dragStartRef.current.hasDetached = true;
        setIsPressing(false);
        setDragOffset({ x: 0, y: 0 });

        if (onDetach) {
          onDetach({
            block,
            initialCoords: { x: clientX - 100, y: clientY - 80 },
          });
        }

        if (navigator.vibrate) {
          try { navigator.vibrate(40); } catch (v) {}
        }
      }
    }
  };

  const handlePointerUp = (e) => {
    if (dragStartRef.current && !dragStartRef.current.hasDetached) {
      const duration = Date.now() - dragStartRef.current.time;
      const clientX = e.clientX || (e.changedTouches && e.changedTouches[0]?.clientX);
      const clientY = e.clientY || (e.changedTouches && e.changedTouches[0]?.clientY);
      const deltaX = clientX ? clientX - dragStartRef.current.x : 0;
      const deltaY = clientY ? clientY - dragStartRef.current.y : 0;
      const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Short tap without dragging: Launch Picture-in-Picture!
      if (duration < 350 && dist < 15) {
        handleTriggerPip();
      }
    }

    dragStartRef.current = null;
    setIsPressing(false);
    setDragOffset({ x: 0, y: 0 });
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onTouchStart={handlePointerDown}
      onTouchMove={handlePointerMove}
      onTouchEnd={handlePointerUp}
      style={{
        transform: `translate(${dragOffset.x}px, ${dragOffset.y}px) scale(${isPressing ? 0.98 : 1})`,
        transition: isPressing ? "none" : "transform 0.25s ease-out",
        touchAction: "none",
      }}
      className={`my-3 p-3.5 rounded-2xl bg-gradient-to-br from-black/40 via-black/20 to-black/30 dark:from-white/[0.04] dark:via-transparent dark:to-white/[0.02] border ${
        isCurrent ? "border-blue-500/40 shadow-lg shadow-blue-500/10" : "border-gray-200/50 dark:border-white/10"
      } backdrop-blur-md cursor-grab active:cursor-grabbing select-none relative overflow-hidden group`}
    >
      {/* Background Ambient Glow */}
      <div
        className="absolute -right-8 -bottom-8 w-28 h-28 rounded-full blur-2xl opacity-20 pointer-events-none transition-colors"
        style={{ backgroundColor: isPaused ? "#F59E0B" : "#10B981" }}
      />

      <div className="flex items-center gap-3.5 relative z-10">
        {/* Tactile Liquid Bottle & Battery Gauge */}
        <div className="shrink-0 relative group-hover:scale-105 transition-transform">
          <LiquidBottleGauge
            percent={remainingPct}
            isPaused={isPaused}
            width={52}
            height={92}
            showLabel={false}
          />
        </div>

        {/* Timer Metrics & Controls */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: isPaused ? "#F59E0B" : "#10B981" }} />
              <span className="text-[10px] font-mono uppercase font-black tracking-wider text-gray-400 truncate">
                {isPaused ? "Paused" : "Active Focus"}
              </span>
            </div>
            {/* Battery / Liquid Percentage Badge */}
            <span
              className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full border ${
                isPaused
                  ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                  : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
              }`}
            >
              {Math.round(remainingPct)}% Energy
            </span>
          </div>

          {/* Large Monospaced Time Readout */}
          <div className="text-2xl font-black font-mono tracking-tight text-gray-900 dark:text-white leading-none my-1 flex items-baseline gap-2">
            <span>{formattedTime}</span>
            <span className="text-[11px] font-sans font-bold text-gray-400">remaining</span>
          </div>

          {/* Interactive Action Pill Buttons */}
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-black/5 dark:border-white/5">
            {/* Pause / Resume Button ("Post and Resume") */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onTogglePause) onTogglePause();
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm active:scale-95 ${
                isPaused
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20"
                  : "bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20"
              }`}
            >
              <Icon name={isPaused ? "play_arrow" : "pause"} size={15} />
              <span>{isPaused ? "Resume" : "Pause"}</span>
            </button>

            {/* Click to PiP Button */}
            <button
              type="button"
              onClick={handleTriggerPip}
              className="p-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/20 text-xs font-bold flex items-center gap-1 active:scale-95 transition-all"
              title="Pop up Picture-in-Picture window"
            >
              <Icon name="picture_in_picture_alt" size={15} />
              <span className="text-[10px]">PiP</span>
            </button>

            {/* Fullscreen Button */}
            {onOpenFullscreen && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenFullscreen();
                }}
                className="p-1.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 text-xs font-bold active:scale-95 transition-all"
                title="Full Screen Focus View"
              >
                <Icon name="fullscreen" size={15} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tactile Drag Hint Bar at bottom */}
      <div className="mt-2 pt-1.5 border-t border-dashed border-gray-200/50 dark:border-white/5 flex items-center justify-between text-[10px] font-mono text-gray-400">
        <span className="flex items-center gap-1">
          <Icon name="drag_indicator" size={13} className="text-gray-400" />
          Hold & drag outside to float window
        </span>
        <span className="opacity-75">Click for PiP</span>
      </div>
    </div>
  );
}
