export function completionTone(enabled, mode, focusTone, restTone) {
  if (!enabled || (mode !== "focus" && mode !== "rest")) return null;
  return (mode === "focus" ? focusTone : restTone) || "beep";
}

// Prepare the audio context from the Start button's user gesture when possible.
export function createTimerAlertPlayer(env = globalThis) {
  let context = null;
  const activeAudio = new Set();
  const prepare = () => {
    try {
      const AudioContext = env.AudioContext || env.webkitAudioContext;
      if (!context && AudioContext) context = new AudioContext();
      if (context?.state === "suspended") context.resume()?.catch(() => {});
    } catch { /* Sound can be unavailable or blocked by the browser. */ }
  };
  const play = (tone) => {
    if (!tone) return;
    if (tone !== "beep") {
      try {
        const audio = new env.Audio(tone);
        activeAudio.add(audio);
        audio.volume = 0.7;
        audio.onended = () => activeAudio.delete(audio);
        audio.onerror = () => activeAudio.delete(audio);
        const playback = audio.play();
        if (playback?.catch) playback.catch(() => activeAudio.delete(audio));
      } catch { /* The selected sound may be unavailable. */ }
      return;
    }
    try {
      prepare();
      if (!context) return;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, context.currentTime);
      gain.gain.setValueAtTime(0.3, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.5);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + 0.5);
    } catch { /* Playback failure must never stop the timer. */ }
  };
  const dispose = () => {
    for (const audio of activeAudio) {
      try { audio.pause(); } catch { /* The sound may already be unavailable. */ }
    }
    activeAudio.clear();
    try {
      if (context && context.state !== "closed") context.close()?.catch(() => {});
    } catch { /* Ignore audio shutdown failures. */ }
    context = null;
  };
  return { prepare, play, dispose };
}
