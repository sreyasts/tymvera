import React, { useState, useRef, useEffect } from "react";
import LiquidBottleGauge from "./LiquidBottleGauge";
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
 * FloatingBottleTimer: A detached, draggable floating window on screen.
 * Displays the bottle/battery level decreasing, live time, task name,
 * and Pause/Resume controls.
 */
export default function FloatingBottleTimer({
  block,
  isPaused = false,
  remainingSeconds = 0,
  totalSeconds = 3600,
  initialPosition = { x: window.innerWidth - 220, y: window.innerHeight - 260 },
  onTogglePause,
  onDockBack,
  onOpenFullscreen,
  onInAppToast,
}) {
  const [pos, setPos] = useState({
    x: Math.max(10, Math.min(window.innerWidth - 240, initialPosition?.x || 20)),
    y: Math.max(10, Math.min(window.innerHeight - 220, initialPosition?.y || 100)),
  });

  const draggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, startPosX: 0, startPosY: 0 });

  const remainingPct = totalSeconds > 0
    ? Math.max(0, Math.min(100, (remainingSeconds / totalSeconds) * 100))
    : 0;

  const formattedTime = formatTimerSeconds(remainingSeconds);

  // Dragging event handlers
  const handlePointerDown = (e) => {
    if (e.target.closest("button") || e.target.closest("a")) return;
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);

    draggingRef.current = true;
    dragStartRef.current = {
      x: clientX,
      y: clientY,
      startPosX: pos.x,
      startPosY: pos.y,
    };
  };

  const handlePointerMove = (e) => {
    if (!draggingRef.current) return;
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);

    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;

    const newX = Math.max(8, Math.min(window.innerWidth - 230, dragStartRef.current.startPosX + deltaX));
    const newY = Math.max(8, Math.min(window.innerHeight - 180, dragStartRef.current.startPosY + deltaY));

    setPos({ x: newX, y: newY });
  };

  const handlePointerUp = () => {
    draggingRef.current = false;
  };

  useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("touchmove", handlePointerMove);
    window.addEventListener("touchend", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("touchmove", handlePointerMove);
      window.removeEventListener("touchend", handlePointerUp);
    };
  }, []);

  // Launch OS Picture-in-Picture
  const handleTriggerPip = async () => {
    try {
      await openDocumentPipWindow({
        taskName: block?.name,
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
          body: `Picture-in-Picture window is active for "${block?.name}".`,
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
        touchAction: "none",
      }}
      onPointerDown={handlePointerDown}
      onTouchStart={handlePointerDown}
      className="z-[9990] w-[220px] rounded-3xl bg-[#080808]/90 text-white border border-white/15 p-3.5 shadow-2xl backdrop-blur-xl select-none cursor-move animate-in zoom-in-95 duration-200"
    >
      {/* Window Header with Grip Bar & Controls */}
      <div className="flex items-center justify-between gap-1 mb-2 pb-1.5 border-b border-white/10">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon name="drag_handle" size={15} className="text-gray-400 shrink-0" />
          <span className="text-[11px] font-black text-white truncate max-w-[110px]" title={block?.name}>
            {block?.name || "Focus Session"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* PiP Button */}
          <button
            type="button"
            onClick={handleTriggerPip}
            className="p-1 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
            title="Pop up Native OS Picture-in-Picture"
          >
            <Icon name="picture_in_picture_alt" size={14} />
          </button>

          {/* Fullscreen Button */}
          {onOpenFullscreen && (
            <button
              type="button"
              onClick={onOpenFullscreen}
              className="p-1 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              title="Fullscreen Mode"
            >
              <Icon name="fullscreen" size={14} />
            </button>
          )}

          {/* Dock Back into Section Button */}
          <button
            type="button"
            onClick={onDockBack}
            className="p-1 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
            title="Dock back into section"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      </div>

      {/* Main Body: Liquid Bottle Gauge & Live Countdown */}
      <div className="flex items-center gap-3">
        {/* Animated Bottle */}
        <div className="shrink-0">
          <LiquidBottleGauge
            percent={remainingPct}
            isPaused={isPaused}
            width={46}
            height={82}
            showLabel={false}
          />
        </div>

        {/* Time, Battery % & Controls */}
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-mono font-bold text-gray-400 flex items-center justify-between">
            <span>{isPaused ? "PAUSED" : "ACTIVE"}</span>
            <span
              className="font-black"
              style={{ color: isPaused ? "#F59E0B" : "#10B981" }}
            >
              {Math.round(remainingPct)}%
            </span>
          </div>

          <div className="text-xl font-black font-mono tracking-tight text-white my-1">
            {formattedTime}
          </div>

          {/* Pause / Resume Button ("Post and Resume") */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onTogglePause) onTogglePause();
            }}
            className={`w-full py-1.5 px-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1 active:scale-95 transition-all shadow-md ${
              isPaused
                ? "bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20"
                : "bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20"
            }`}
          >
            <Icon name={isPaused ? "play_arrow" : "pause"} size={13} />
            <span>{isPaused ? "Resume" : "Pause"}</span>
          </button>
        </div>
      </div>

      <div className="mt-2 text-[9px] text-center font-mono text-gray-400">
        Drag anywhere • Click X to dock
      </div>
    </div>
  );
}
