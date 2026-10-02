import React, { useMemo } from "react";

/**
 * LiquidBottleGauge: A tactile, high-fidelity liquid bottle & battery percentage gauge.
 * Shows fluid draining like a real bottle as time elapses, with animated waves,
 * glass refraction highlights, and etched graduation marks.
 */
export default function LiquidBottleGauge({
  percent = 100, // 0 to 100
  isPaused = false,
  width = 68,
  height = 120,
  glowColor = null,
  showLabel = true,
  className = "",
}) {
  const clampedPct = Math.max(0, Math.min(100, Number(percent) || 0));

  // Fluid theme colors based on state and percentage
  const colors = useMemo(() => {
    if (glowColor) return { main: glowColor, secondary: glowColor, glow: glowColor };
    if (isPaused) {
      return { main: "#F59E0B", secondary: "#D97706", glow: "rgba(245, 158, 11, 0.45)" };
    }
    if (clampedPct <= 15) {
      return { main: "#EF4444", secondary: "#DC2626", glow: "rgba(239, 68, 68, 0.45)" };
    }
    if (clampedPct <= 35) {
      return { main: "#F59E0B", secondary: "#10B981", glow: "rgba(245, 158, 11, 0.4)" };
    }
    return { main: "#10B981", secondary: "#06B6D4", glow: "rgba(16, 185, 129, 0.45)" };
  }, [clampedPct, isPaused, glowColor]);

  // Dimensions for bottle anatomy
  const capWidth = 22;
  const capHeight = 8;
  const neckWidth = 26;
  const neckHeight = 10;
  const bodyWidth = 56;
  const bodyHeight = 90;
  const cornerRadius = 14;

  const totalHeight = capHeight + neckHeight + bodyHeight; // 108
  const totalWidth = 60;
  const centerX = totalWidth / 2;

  // Fluid level calculation
  const maxFluidHeight = bodyHeight - 4; // leave 2px padding at bottom
  const fluidHeight = (clampedPct / 100) * maxFluidHeight;
  const fluidTopY = totalHeight - 2 - fluidHeight;

  // Unique IDs for SVG filters and gradients
  const gradId = useMemo(() => `liquid-grad-${Math.random().toString(36).substr(2, 9)}`, []);
  const clipId = useMemo(() => `bottle-clip-${Math.random().toString(36).substr(2, 9)}`, []);

  return (
    <div className={`relative inline-flex flex-col items-center select-none ${className}`}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        className="overflow-visible"
        style={{ filter: `drop-shadow(0 6px 14px ${colors.glow})` }}
      >
        <defs>
          {/* Fluid Gradient */}
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.secondary} stopOpacity="0.95" />
            <stop offset="100%" stopColor={colors.main} stopOpacity="0.85" />
          </linearGradient>

          {/* Internal Chamber Clip Path for Bottle Fluid */}
          <clipPath id={clipId}>
            <rect
              x={(totalWidth - bodyWidth) / 2 + 2}
              y={capHeight + neckHeight + 2}
              width={bodyWidth - 4}
              height={bodyHeight - 4}
              rx={cornerRadius - 2}
              ry={cornerRadius - 2}
            />
          </clipPath>
        </defs>

        {/* ─── BOTTLE CAP / TOP TERMINAL ─── */}
        <rect
          x={centerX - capWidth / 2}
          y={0}
          width={capWidth}
          height={capHeight}
          rx={3}
          ry={3}
          fill="#2a2a2a"
          stroke="#444"
          strokeWidth={1}
        />
        {/* Cap ridges */}
        <line x1={centerX - 5} y1={2} x2={centerX - 5} y2={capHeight - 2} stroke="#555" strokeWidth={1} />
        <line x1={centerX} y1={2} x2={centerX} y2={capHeight - 2} stroke="#555" strokeWidth={1} />
        <line x1={centerX + 5} y1={2} x2={centerX + 5} y2={capHeight - 2} stroke="#555" strokeWidth={1} />

        {/* ─── BOTTLE NECK ─── */}
        <rect
          x={centerX - neckWidth / 2}
          y={capHeight}
          width={neckWidth}
          height={neckHeight}
          fill="rgba(255, 255, 255, 0.05)"
          stroke="#333"
          strokeWidth={1}
        />

        {/* ─── GLASS CHAMBER BACKDROP ─── */}
        <rect
          x={(totalWidth - bodyWidth) / 2}
          y={capHeight + neckHeight}
          width={bodyWidth}
          height={bodyHeight}
          rx={cornerRadius}
          ry={cornerRadius}
          fill="rgba(10, 10, 10, 0.75)"
          stroke="rgba(255, 255, 255, 0.12)"
          strokeWidth={1.5}
        />

        {/* ─── FLUID FILL (CLIPPED TO BOTTLE INTERIOR) ─── */}
        <g clipPath={`url(#${clipId})`}>
          {clampedPct > 0 && (
            <g>
              {/* Main Liquid Column */}
              <rect
                x={(totalWidth - bodyWidth) / 2}
                y={fluidTopY}
                width={bodyWidth}
                height={fluidHeight + 6}
                fill={`url(#${gradId})`}
                className="transition-all duration-700 ease-out"
              />

              {/* Animated Liquid Surface Wave */}
              <path
                d={`M ${(totalWidth - bodyWidth) / 2} ${fluidTopY} 
                    Q ${centerX - 10} ${fluidTopY - 3} ${centerX} ${fluidTopY} 
                    T ${(totalWidth + bodyWidth) / 2} ${fluidTopY} 
                    L ${(totalWidth + bodyWidth) / 2} ${fluidTopY + 4} 
                    L ${(totalWidth - bodyWidth) / 2} ${fluidTopY + 4} Z`}
                fill={colors.secondary}
                opacity={0.8}
                className={isPaused ? "" : "animate-pulse"}
              />

              {/* Rising Energy Bubbles */}
              {!isPaused && clampedPct > 10 && (
                <>
                  <circle
                    cx={centerX - 8}
                    cy={fluidTopY + Math.min(20, fluidHeight * 0.4)}
                    r={2}
                    fill="rgba(255,255,255,0.7)"
                    className="animate-ping"
                    style={{ animationDuration: "2.4s" }}
                  />
                  <circle
                    cx={centerX + 10}
                    cy={fluidTopY + Math.min(35, fluidHeight * 0.7)}
                    r={1.5}
                    fill="rgba(255,255,255,0.6)"
                    className="animate-ping"
                    style={{ animationDuration: "1.8s" }}
                  />
                </>
              )}
            </g>
          )}

          {/* Graduation Ticks (25%, 50%, 75%) etched on glass */}
          {[0.25, 0.5, 0.75].map((mark) => {
            const markY = totalHeight - 2 - mark * maxFluidHeight;
            return (
              <g key={mark} opacity={0.35}>
                <line
                  x1={(totalWidth - bodyWidth) / 2 + 5}
                  y1={markY}
                  x2={(totalWidth - bodyWidth) / 2 + 11}
                  y2={markY}
                  stroke="#fff"
                  strokeWidth={1}
                  strokeLinecap="round"
                />
                <line
                  x1={(totalWidth + bodyWidth) / 2 - 11}
                  y1={markY}
                  x2={(totalWidth + bodyWidth) / 2 - 5}
                  y2={markY}
                  stroke="#fff"
                  strokeWidth={1}
                  strokeLinecap="round"
                />
              </g>
            );
          })}
        </g>

        {/* ─── GLASS REFLECTION & HIGHLIGHT ─── */}
        {/* Left vertical light streak */}
        <path
          d={`M ${(totalWidth - bodyWidth) / 2 + 5} ${capHeight + neckHeight + 8} 
              L ${(totalWidth - bodyWidth) / 2 + 5} ${totalHeight - 12}`}
          stroke="rgba(255, 255, 255, 0.28)"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        {/* Curved corner gloss */}
        <path
          d={`M ${(totalWidth - bodyWidth) / 2 + 7} ${capHeight + neckHeight + 6} 
              Q ${(totalWidth - bodyWidth) / 2 + 5} ${capHeight + neckHeight + 6} 
                ${(totalWidth - bodyWidth) / 2 + 5} ${capHeight + neckHeight + 14}`}
          stroke="rgba(255, 255, 255, 0.35)"
          strokeWidth={1.2}
          fill="none"
        />
      </svg>

      {/* Percentage Readout Tag */}
      {showLabel && (
        <div className="mt-1.5 flex items-center gap-1 font-mono font-black text-xs tracking-tight">
          <span
            style={{ color: colors.main }}
            className="drop-shadow-[0_0_8px_currentColor]"
          >
            {Math.round(clampedPct)}%
          </span>
        </div>
      )}
    </div>
  );
}
