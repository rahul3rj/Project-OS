import React, { useState, useEffect, useRef } from "react";

// Station defaults are provided by the parent (App.jsx → DEFAULT_LOFI_STATIONS) via the
// `stations` prop. No local copy is kept here to avoid two sources of truth.

/** Helper component to render video or GIF background with automatic error fallback */
const CustomBackgroundMedia = ({ src }) => {
  const [videoError, setVideoError] = useState(false);
  if (!src) return null;

  const isVideoHint =
    src.startsWith("data:video/") ||
    Boolean(src.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i)) ||
    (!src.match(/\.(gif|jpg|jpeg|png|webp)(\?.*)?$/i) && !videoError);

  if (isVideoHint && !videoError) {
    return (
      <video
        src={src}
        autoPlay
        loop
        muted
        playsInline
        onError={() => setVideoError(true)}
        className="w-full h-full object-cover rounded-2xl"
      />
    );
  }

  return (
    <img
      src={src}
      alt="Custom Lofi Background"
      className="w-full h-full object-cover rounded-2xl"
    />
  );
};

/**
 * 24/7 Lofi Live Stream Song Player Component
 * Features:
 * - 24/7 Live Lofi Radio audio streaming from high-availability streaming servers.
 * - Robust play/pause & station switcher with explicit audio loading (.load()) and error recovery.
 * - Custom user video/animation backdrop container (supports uploaded video/GIF or animated lofi visualizer).
 */
const DEFAULT_SONG_BG = "https://i.pinimg.com/originals/ee/e0/c1/eee0c1dc806da44930fc6eb26b94a737.gif";

const SongPlayer = ({ dragHandleProps, playlistUrl, autoPlay, customVideo, stations }) => {
  const [stationIndex, setStationIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay || false);
  const [isBuffering, setIsBuffering] = useState(false);
  const audioRef = useRef(null);

  const activeStations = Array.isArray(stations) && stations.length > 0 ? stations : [];
  const isCustomStream = Boolean(playlistUrl && playlistUrl.trim().startsWith("http"));
  const activeStation = activeStations[stationIndex] || activeStations[0] || {};
  const activeStreamUrl = isCustomStream ? playlistUrl.trim() : (activeStation.streamUrl ?? "");

  // Initialize & update audio element src whenever stream URL changes
  useEffect(() => {
    if (!audioRef.current) return;
    const currentAudio = audioRef.current;
    
    // Set src and reload audio buffer
    currentAudio.src = activeStreamUrl;
    currentAudio.load();

    if (isPlaying) {
      setIsBuffering(true);
      const promise = currentAudio.play();
      if (promise !== undefined) {
        promise
          .then(() => setIsBuffering(false))
          .catch((err) => {
            console.warn("Autoplay or stream play prevented:", err);
            setIsBuffering(false);
            setIsPlaying(false);
          });
      }
    } else {
      currentAudio.pause();
      setIsBuffering(false);
    }
  }, [activeStreamUrl]);

  // Clean up audio element on component unmount
  useEffect(() => {
    const currentAudio = audioRef.current;
    return () => {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = "";
      }
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    const currentAudio = audioRef.current;

    if (isPlaying) {
      currentAudio.pause();
      setIsPlaying(false);
      setIsBuffering(false);
    } else {
      setIsBuffering(true);
      if (!currentAudio.src || currentAudio.src !== activeStreamUrl) {
        currentAudio.src = activeStreamUrl;
        currentAudio.load();
      }
      const promise = currentAudio.play();
      if (promise !== undefined) {
        promise
          .then(() => {
            setIsBuffering(false);
            setIsPlaying(true);
          })
          .catch((err) => {
            console.error("Audio stream playback failed:", err);
            setIsBuffering(false);
            setIsPlaying(false);
          });
      }
    }
  };

  const changeStation = (newIndex) => {
    setStationIndex(newIndex);
    const nextStation = activeStations[newIndex];
    const streamUrl = isCustomStream ? playlistUrl.trim() : nextStation.streamUrl;

    if (audioRef.current) {
      const currentAudio = audioRef.current;
      currentAudio.pause();
      currentAudio.src = streamUrl;
      currentAudio.load();

      setIsBuffering(true);
      const promise = currentAudio.play();
      if (promise !== undefined) {
        promise
          .then(() => {
            setIsBuffering(false);
            setIsPlaying(true);
          })
          .catch((err) => {
            console.warn("Station switch playback prevented:", err);
            setIsBuffering(false);
            setIsPlaying(false);
          });
      }
    }
  };

  const goNext = () => {
    const nextIdx = (stationIndex + 1) % activeStations.length;
    changeStation(nextIdx);
  };

  const goPrev = () => {
    const prevIdx = (stationIndex - 1 + activeStations.length) % activeStations.length;
    changeStation(prevIdx);
  };

  const videoSrc =
    (typeof customVideo === "string" ? customVideo : customVideo?.dataUrl) ||
    DEFAULT_SONG_BG;

  const stationTitle = isCustomStream ? "Custom Audio Stream" : activeStation.name;
  const stationBadge = isCustomStream ? "Custom Lofi Stream" : (activeStation.badge || activeStation.name);
  const stationProvider = isCustomStream ? "User Custom Stream" : activeStation.provider;

  return (
    <div className="figma-glass-static song-widget rounded-[26px] px-4 py-3 text-white font-gilroy-medium w-full h-full select-none flex flex-col shadow-2xl relative overflow-hidden">
      {/* HTML5 Audio Element for 24/7 Live Stream */}
      <audio
        ref={audioRef}
        preload="auto"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onError={(e) => {
          console.warn("Audio stream event error:", e);
          setIsBuffering(false);
          setIsPlaying(false);
        }}
      />

      {/* Header Row */}
      <div className="w-full flex items-center justify-between z-10 relative shrink-0 mb-3">
        <div
          className="flex items-center gap-2 text-white/70 text-xs font-gilroy-medium cursor-grab active:cursor-grabbing select-none pr-2 min-w-0"
          data-drag-handle
          {...dragHandleProps}
        >
          <i className="ri-draggable text-sm pointer-events-none shrink-0"></i>
          <span className="pointer-events-none truncate">{stationTitle}</span>
        </div>

        {/* Live Station Badge (Matching controls style & darkest theme color dot) */}
        <div
          className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-transparent hover:border-white/30 text-white opacity-45 hover:opacity-80 transition-all duration-300 shrink-0 shadow-sm"
          style={{ backgroundColor: "var(--theme-4, #0F172A)" }}
        >
          <span
            className={`w-2.5 h-2.5 rounded-full border border-white/60 transition-all ${
              isPlaying
                ? "animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                : "opacity-40"
            }`}
            style={{ backgroundColor: "var(--theme-4, #0F172A)" }}
          />
          <span className="text-[10.5px] font-gilroy-bold text-white tracking-wide uppercase">
            {isBuffering ? "BUFFERING" : isPlaying ? "LIVE" : "PAUSED"}
          </span>
        </div>
      </div>

      {/* Main Content Area: Left Video Container + Right Controls */}
      <div className="w-full flex-1 min-h-0 flex items-stretch gap-3 z-10 relative overflow-hidden">
        {/* Left Screen Container (Uploaded Video / GIF or Cozy Lofi Visualizer) */}
        <div className="flex-1 min-w-0 rounded-2xl overflow-hidden relative border border-white/15 bg-black/70 shadow-xl flex items-center justify-center group">
          {videoSrc ? (
            <CustomBackgroundMedia src={videoSrc} />
          ) : (
            /* Aesthetic Animated Lofi Backdrop Visualizer */
            <div
              className={`w-full h-full bg-gradient-to-br ${activeStation.gradient} flex flex-col items-center justify-center p-3 relative overflow-hidden transition-all duration-500`}
            >
              {/* Subtle background radial glow */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08)_0%,transparent_70%)]" />

              {/* Animated Music Equalizer Bars */}
              <div className="flex items-end justify-center gap-1.5 mb-2.5 h-10 z-10">
                <span
                  className={`w-1.5 bg-purple-300 rounded-full transition-all duration-300 ${
                    isPlaying ? "animate-pulse h-9" : "h-3 opacity-40"
                  }`}
                />
                <span
                  className={`w-1.5 bg-indigo-300 rounded-full transition-all duration-300 ${
                    isPlaying ? "animate-pulse h-7 delay-100" : "h-4 opacity-40"
                  }`}
                />
                <span
                  className={`w-1.5 bg-pink-300 rounded-full transition-all duration-300 ${
                    isPlaying ? "animate-pulse h-10 delay-200" : "h-2 opacity-40"
                  }`}
                />
                <span
                  className={`w-1.5 bg-cyan-300 rounded-full transition-all duration-300 ${
                    isPlaying ? "animate-pulse h-6 delay-75" : "h-4 opacity-40"
                  }`}
                />
                <span
                  className={`w-1.5 bg-purple-300 rounded-full transition-all duration-300 ${
                    isPlaying ? "animate-pulse h-8 delay-150" : "h-3 opacity-40"
                  }`}
                />
              </div>

              {/* Active Streaming Station Info */}
              <div className="z-10 text-center px-2 max-w-full">
                <span className="inline-block px-2 py-0.5 rounded-md bg-black/40 border border-white/10 text-[10px] font-gilroy-bold text-white/80 uppercase tracking-wider mb-1">
                  {stationBadge} {!isCustomStream && `(${stationIndex + 1}/${activeStations.length})`}
                </span>
                <p className="text-white text-xs font-gilroy-bold truncate drop-shadow-md">
                  {stationTitle}
                </p>
                <p className="text-white/50 text-[10px] font-gilroy-medium mt-0.5">
                  {isBuffering ? "Connecting Stream..." : isPlaying ? stationProvider : "Press Play to Stream"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Controls Stack (Circular Buttons, Darkest Theme Color, 45% Opacity -> 80% Hover) */}
        <div className="flex flex-col items-center justify-center gap-2.5 shrink-0">
          {/* Previous Lofi Station */}
          <button
            type="button"
            onClick={goPrev}
            className="h-8 w-8 rounded-full border border-transparent hover:border-white/30 flex items-center justify-center text-white opacity-45 hover:opacity-80 transition-all duration-300 cursor-pointer active:scale-95 shadow-sm"
            style={{ backgroundColor: "var(--theme-4, #0F172A)" }}
            title="Previous 24/7 Lofi Station"
          >
            <i className="ri-skip-back-fill text-xs relative z-10"></i>
          </button>

          {/* Play / Pause Stream (Larger) */}
          <button
            type="button"
            onClick={togglePlay}
            className="h-11 w-11 rounded-full border border-transparent hover:border-white/40 flex items-center justify-center text-white opacity-45 hover:opacity-80 transition-all duration-300 cursor-pointer active:scale-95 shadow-md"
            style={{ backgroundColor: "var(--theme-4, #0F172A)" }}
            title={isPlaying ? "Pause Stream" : "Play 24/7 Lofi Stream"}
          >
            {isBuffering ? (
              <i className="ri-loader-4-line text-lg animate-spin text-white relative z-10" />
            ) : (
              <i
                className={`${
                  isPlaying ? "ri-pause-fill" : "ri-play-fill ml-0.5"
                } text-lg relative z-10`}
              />
            )}
          </button>

          {/* Next Lofi Station */}
          <button
            type="button"
            onClick={goNext}
            className="h-8 w-8 rounded-full border border-transparent hover:border-white/30 flex items-center justify-center text-white opacity-45 hover:opacity-80 transition-all duration-300 cursor-pointer active:scale-95 shadow-sm"
            style={{ backgroundColor: "var(--theme-4, #0F172A)" }}
            title="Next 24/7 Lofi Station"
          >
            <i className="ri-skip-forward-fill text-xs relative z-10"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SongPlayer;
