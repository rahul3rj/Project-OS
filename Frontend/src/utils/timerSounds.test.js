import test from "node:test";
import assert from "node:assert/strict";
import { completionTone, createTimerAlertPlayer } from "./timerSounds.js";

test("completion sounds respect the toggle and the finished phase", () => {
  assert.equal(completionTone(false, "focus", "focus-file", "rest-file"), null);
  assert.equal(completionTone(true, "focus", "focus-file", "rest-file"), "focus-file");
  assert.equal(completionTone(true, "rest", "focus-file", "rest-file"), "rest-file");
  assert.equal(completionTone(true, "focus", "", "rest-file"), "beep");
  assert.equal(completionTone(true, "other", "focus-file", "rest-file"), null);
});

test("default beep uses a prepared audio context and closes it", () => {
  const events = [];
  class Context {
    constructor() { this.currentTime = 10; this.state = "running"; this.destination = {}; events.push("created"); }
    createOscillator() { return { connect() {}, disconnect() {}, frequency: { setValueAtTime: (value) => events.push(value) }, start: () => events.push("start"), stop: (time) => events.push(time) }; }
    createGain() { return { connect() {}, disconnect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } }; }
    close() { events.push("closed"); return Promise.resolve(); }
  }
  const player = createTimerAlertPlayer({ AudioContext: Context });
  player.prepare();
  player.play("beep");
  player.dispose();
  assert.deepEqual(events, ["created", 880, "start", 10.5, "closed"]);
});

test("custom sound plays and can be stopped; blocked audio does not throw", async () => {
  let audio;
  class Audio {
    constructor(src) { this.src = src; audio = this; }
    play() { return Promise.resolve(); }
    pause() { this.paused = true; }
  }
  const player = createTimerAlertPlayer({ Audio });
  player.play("data:audio/example");
  assert.equal(audio.src, "data:audio/example");
  assert.equal(audio.volume, 0.7);
  player.dispose();
  assert.equal(audio.paused, true);
  class BlockedAudio { play() { return Promise.reject(new Error("blocked")); } }
  const blocked = createTimerAlertPlayer({ Audio: BlockedAudio });
  blocked.play("data:audio/example");
  await Promise.resolve();
  blocked.dispose();
});
