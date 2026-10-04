import React, { useState, useEffect } from "react";
import {
  detectUserPlatform,
  APP_PACKAGE_INFO,
  downloadPackageWithProgress,
} from "../services/appDownloadEngine";

const Icon = ({ name, size = 20, className = "", style = {} }) => (
  <span
    className={`material-symbols-rounded select-none inline-flex items-center justify-center ${className}`}
    style={{ fontSize: size, width: size, height: size, ...style }}
  >
    {name}
  </span>
);

export default function InAppDownloadModal({
  isOpen,
  onClose,
  initialPlatform,
  themeColors = {},
}) {
  const [platform, setPlatform] = useState(() => {
    if (initialPlatform && initialPlatform !== "auto") return initialPlatform;
    const detected = detectUserPlatform();
    return detected === "windows" ? "windows" : "android";
  });

  const [downloadState, setDownloadState] = useState({
    active: false,
    percent: 0,
    receivedBytes: 0,
    totalBytes: 0,
    status: "idle", // 'idle' | 'connecting' | 'downloading' | 'verifying' | 'complete' | 'error'
    errorMsg: null,
  });

  useEffect(() => {
    if (isOpen) {
      if (initialPlatform && initialPlatform !== "auto") {
        setPlatform(initialPlatform);
      } else {
        const detected = detectUserPlatform();
        setPlatform(detected === "windows" ? "windows" : "android");
      }
      setDownloadState({
        active: false,
        percent: 0,
        receivedBytes: 0,
        totalBytes: 0,
        status: "idle",
        errorMsg: null,
      });
    }
  }, [isOpen, initialPlatform]);

  if (!isOpen) return null;

  const pkg = APP_PACKAGE_INFO[platform] || APP_PACKAGE_INFO.android;
  const isAndroid = platform === "android";

  const handleStartDownload = async () => {
    setDownloadState({
      active: true,
      percent: 5,
      receivedBytes: 0,
      totalBytes: pkg.approxBytes,
      status: "connecting",
      errorMsg: null,
    });

    try {
      await downloadPackageWithProgress(platform, (progress) => {
        setDownloadState((prev) => ({
          ...prev,
          percent: progress.percent,
          receivedBytes: progress.receivedBytes,
          totalBytes: progress.totalBytes,
          status: progress.status,
        }));
      });
    } catch (err) {
      setDownloadState((prev) => ({
        ...prev,
        status: "error",
        errorMsg: err.message || "Download failed. Please try again.",
      }));
    }
  };

  const formatMB = (bytes) => {
    if (!bytes) return "0.0";
    return (bytes / (1024 * 1024)).toFixed(1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-[#0d0d10] border border-white/10 rounded-[32px] p-6 text-white shadow-2xl relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle background glow */}
        <div
          className="absolute -top-24 -left-24 w-60 h-60 rounded-full blur-[90px] pointer-events-none opacity-20"
          style={{ backgroundColor: pkg.accentColor }}
        />

        {/* Top Header */}
        <div className="flex items-center justify-between mb-5 relative z-10">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-white shadow-lg"
              style={{
                backgroundColor: isAndroid ? "rgba(16, 185, 129, 0.15)" : "rgba(59, 130, 246, 0.15)",
                color: pkg.accentColor,
                border: `1px solid ${isAndroid ? "rgba(16, 185, 129, 0.3)" : "rgba(59, 130, 246, 0.3)"}`,
              }}
            >
              <Icon name={pkg.icon} size={22} />
            </div>
            <div>
              <div className="text-sm font-black tracking-tight">{pkg.name}</div>
              <div className="text-[10px] font-mono text-gray-400">
                {pkg.badge} • {pkg.sizeFormatted}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* ─── STATE A: DOWNLOADING PROGRESS VIEW ─────────────────────────── */}
        {downloadState.active ? (
          <div className="space-y-5 relative z-10 py-2">
            <div className="text-center">
              <div
                className="w-16 h-16 rounded-3xl mx-auto flex items-center justify-center mb-3 shadow-inner"
                style={{
                  backgroundColor: isAndroid ? "rgba(16, 185, 129, 0.12)" : "rgba(59, 130, 246, 0.12)",
                  border: `1px solid ${isAndroid ? "rgba(16, 185, 129, 0.25)" : "rgba(59, 130, 246, 0.25)"}`,
                  color: pkg.accentColor,
                }}
              >
                {downloadState.status === "complete" ? (
                  <Icon name="check_circle" size={32} className="animate-bounce" />
                ) : (
                  <Icon name="downloading" size={32} className="animate-pulse" />
                )}
              </div>

              <div className="text-base font-black tracking-tight">
                {downloadState.status === "complete"
                  ? "Download Complete!"
                  : downloadState.status === "verifying"
                  ? "Verifying Package..."
                  : "Downloading TYMVERA Package"}
              </div>

              <div className="text-xs font-mono text-gray-400 mt-1">
                {downloadState.status === "complete"
                  ? `${pkg.filename} saved to device`
                  : `${formatMB(downloadState.receivedBytes)} MB / ${formatMB(downloadState.totalBytes)} MB • ${downloadState.percent}%`}
              </div>
            </div>

            {/* Glowing In-App Progress Bar */}
            <div className="relative w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/10 p-[1px]">
              <div
                className="h-full rounded-full transition-all duration-300 relative"
                style={{
                  width: `${downloadState.percent}%`,
                  background: isAndroid
                    ? "linear-gradient(90deg, #059669 0%, #10b981 100%)"
                    : "linear-gradient(90deg, #2563eb 0%, #3b82f6 100%)",
                  boxShadow: `0 0 16px ${pkg.accentColor}`,
                }}
              >
                <div className="absolute right-0 top-0 bottom-0 w-2 bg-white rounded-full animate-ping opacity-75" />
              </div>
            </div>

            {/* Post-Download Instructions */}
            {downloadState.status === "complete" ? (
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2.5 animate-in fade-in duration-300">
                <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Icon name="touch_app" size={14} /> Ready to Install
                </div>
                <ol className="text-xs text-gray-300 space-y-1.5 list-decimal list-inside leading-relaxed">
                  {isAndroid ? (
                    <>
                      <li>Pull down your notifications or open <b>Downloads</b></li>
                      <li>Tap <b>{pkg.filename}</b> and choose <b>Install</b></li>
                      <li>Launch TYMVERA directly from your phone's home screen</li>
                    </>
                  ) : (
                    <>
                      <li>Open your <b>Downloads</b> folder</li>
                      <li>Run <b>{pkg.filename}</b> to start TYMVERA</li>
                      <li>Pin to your Taskbar for background routine alarms</li>
                    </>
                  )}
                </ol>

                <div className="pt-2 flex gap-2">
                  <button
                    onClick={handleStartDownload}
                    className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-gray-200 transition-colors"
                  >
                    Download Again
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-black text-white transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-center text-gray-500 font-mono">
                Streaming directly from verified high-speed CDN • No redirects
              </div>
            )}
          </div>
        ) : (
          /* ─── STATE B: INITIAL OVERVIEW & DOWNLOAD TRIGGER ────────────────── */
          <div className="space-y-4 relative z-10">
            {/* Value Highlights */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2.5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-gray-400 font-bold">
                Why Install The Standalone App?
              </div>
              <ul className="text-xs text-gray-300 space-y-2">
                {pkg.benefits.map((benefit, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
                      style={{ backgroundColor: pkg.accentColor }}
                    />
                    <span className="leading-snug">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Direct 1-Click Action Button */}
            <button
              type="button"
              onClick={handleStartDownload}
              className="w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] text-white"
              style={{
                background: isAndroid
                  ? "linear-gradient(135deg, #059669 0%, #10b981 100%)"
                  : "linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)",
                boxShadow: `0 8px 24px ${isAndroid ? "rgba(16, 185, 129, 0.25)" : "rgba(59, 130, 246, 0.25)"}`,
              }}
            >
              <Icon name="download" size={20} />
              <span>Download Official {isAndroid ? "APK" : "App"} ({pkg.sizeFormatted})</span>
            </button>

            {/* Platform indicator */}
            <div className="text-center pt-1 text-[11px] text-gray-500 font-mono">
              <span>{isAndroid ? "Official Android Package (.apk) • Direct Install" : "Official Windows Desktop Application (.exe) • Direct Install"}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
