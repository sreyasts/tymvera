import React, { useState, useRef, useEffect } from "react";
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
 * FloatingTaskTimer: A detached, draggable floating window on screen.
 * - Follows the user's hand on mobile or mouse click point on Windows.
 * - When released, it stays exactly where dropped.
 * - Features background progress fill covering the completed portion, live countdown,
 *   task name, and Pause/Resume controls.
 */
export default function FloatingTaskTimer({
  block,
  isPaused = false,
  remainingSeconds = 0,
  totalSeconds = 3600,
  completedPct = 0,
  initialPosition = null,
  isCurrentlyHeld = false,
  onTogglePause,
  onDockBack,
  onOpenFullscreen,
  onInAppToast,
}) {
  const cardWidth = 240;
  const cardHeight = 110;

  // Initial position at mouse/touch click point or right side
  const [pos, setPos] = useState(() => {
    const defaultX = window.innerWidth - cardWidth - 20;
    const defaultY = window.innerHeight - cardHeight - 100;
    if (initialPosition && typeof initialPosition.x === "number") {
      return {
        x: Math.max(10, Math.min(window.innerWidth - cardWidth - 10, initialPosition.x)),
        y: Math.max(10, Math.min(window.innerHeight - cardHeight - 10, initialPosition.y)),
      };
    }
    return { x: defaultX, y: defaultY };
  });

  const isDraggingRef = useRef(isCurrentlyHeld);
  const dragOffsetRef = useRef({ x: cardWidth / 2, y: cardHeight / 2 });

  const clampedPct = Math.max(0, Math.min(100, Math.round(completedPct)));
  const formattedTime = formatTimerSeconds(remainingSeconds);

  // If spawned from an active long-press drag, follow finger/mouse until released
  useEffect(() => {
    if (isCurrentlyHeld) {
      isDraggingRef.current = true;
    }

    const handleGlobalMove = (e) => {
      if (!isDraggingRef.current) return;
      const clientX = e.clientX || (e.touches && e.touches[0]?.clientX);
      const clientY = e.clientY || (e.touches && e.touches[0]?.clientY);
      if (typeof clientX !== "number" || typeof clientY !== "number") return;

      const newX = Math.max(8, Math.min(window.innerWidth - cardWidth - 8, clientX - dragOffsetRef.current.x));
      const newY = Math.max(8, Math.min(window.innerHeight - cardHeight - 8, clientY - dragOffsetRef.current.y));

      setPos({ x: newX, y: newY });
    };

    const handleGlobalUp = () => {
      // User released hand or mouse: stay exactly right there!
      isDraggingRef.current = false;
    };

    window.addEventListener("pointermove", handleGlobalMove, { passive: false });
    window.addEventListener("pointerup", handleGlobalUp);
    window.addEventListener("touchmove", handleGlobalMove, { passive: false });
    window.addEventListener("touchend", handleGlobalUp);

    return () => {
      window.removeEventListener("pointermove", handleGlobalMove);
      window.removeEventListener("pointerup", handleGlobalUp);
      window.removeEventListener("touchmove", handleGlobalMove);
      window.removeEventListener("touchend", handleGlobalUp);
    };
  }, [isCurrentlyHeld]);

  // Dragging event handlers for dragging after initial drop
  const handlePointerDown = (e) => {
    if (e.target.closest("button") || e.target.closest("a")) return;
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX);
    const clientY = e.clientY || (e.touches && e.touches[0]?.clientY);

    isDraggingRef.current = true;
    dragOffsetRef.current = {
      x: clientX - pos.x,
      y: clientY - pos.y,
    };
  };

  // Launch OS Picture-in-Picture
  const handleTriggerPip = async (e) => {
    if (e) e.stopPropagation();
    try {
      await openDocumentPipWindow({
        taskName: block?.name,
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
          body: `Picture-in-Picture active for "${block?.name}".`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });
      }
    } catch (e) {
      console.warn("PiP failed", e);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: `${cardWidth}px`,
        touchAction: "none",
      }}
      onPointerDown={handlePointerDown}
      onTouchStart={handlePointerDown}
      className="z-[9990] rounded-3xl bg-[#090909]/95 text-white border border-blue-500/40 p-3.5 shadow-2xl backdrop-blur-2xl select-none cursor-move animate-in zoom-in-95 duration-150 overflow-hidden ring-1 ring-blue-500/30"
    >
      {/* ─── BACKGROUND COMPLETED PROGRESS FILL ─── */}
      <div
        className="absolute inset-y-0 left-0 pointer-events-none transition-all duration-700 ease-linear"
        style={{
          width: `${Math.max(1, Math.min(100, clampedPct))}%`,
          background: isPaused
            ? "linear-gradient(90deg, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0.3) 98%, rgba(251, 191, 36, 0.8) 100%)"
            : "linear-gradient(90deg, rgba(59, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0.38) 98%, rgba(96, 165, 250, 0.9) 100%)",
        }}
      >
        <div className="absolute top-0 bottom-0 right-0 w-[2.5px] bg-blue-400 shadow-[0_0_12px_#60a5fa]" />
      </div>

      {/* Foreground Content (100% Readable) */}
      <div className="relative z-10">
        {/* Header: Title and Window Controls */}
        <div className="flex items-center justify-between gap-1 mb-2 pb-1.5 border-b border-white/10">
          <div className="flex items-center gap-1.5 min-w-0">
            <Icon name="drag_indicator" size={15} className="text-blue-400 shrink-0" />
            <span className="text-xs font-black text-white truncate max-w-[120px]" title={block?.name}>
              {block?.name || "Routine"}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Picture-in-Picture Button */}
            <button
              type="button"
              onClick={handleTriggerPip}
              className="p-1 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              title="Pop up Native OS Picture-in-Picture"
            >
              <Icon name="picture_in_picture_alt" size={15} />
            </button>

            {/* Fullscreen Button */}
            {onOpenFullscreen && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenFullscreen();
                }}
                className="p-1 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                title="Fullscreen Mode"
              >
                <Icon name="fullscreen" size={15} />
              </button>
            )}

            {/* Dock Back into Section Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onDockBack) onDockBack();
              }}
              className="p-1 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
              title="Dock back into routine card"
            >
              <Icon name="close" size={15} />
            </button>
          </div>
        </div>

        {/* Center: Live Time & Completed % Readout */}
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-2xl font-black font-mono tracking-tight text-white drop-shadow-sm">
            {formattedTime}
          </div>
          <div className="text-xs font-mono font-black text-blue-400">
            {clampedPct}% completed
          </div>
        </div>

        {/* Controls: Pause / Resume Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onTogglePause) onTogglePause();
            }}
            className={`w-full py-1.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md ${
              isPaused
                ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/30"
                : "bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/30"
            }`}
          >
            <Icon name={isPaused ? "play_arrow" : "pause"} size={14} />
            <span>{isPaused ? "Resume Routine" : "Pause Routine"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
