/**
 * Reads amplitude off a MediaStream for the waveform.
 *
 * Shared by the local microphone and the remote peer so both waveforms are the
 * same measurement — a "you" bar and a "them" bar have to be comparable, or
 * the tile that looks louder is just the one with different maths.
 */

const FFT_SIZE = 256;
/** Bins above roughly 6kHz carry almost no speech energy. */
const USABLE_BIN_FRACTION = 0.6;

export type LevelMeterOptions = {
  stream: MediaStream;
  bars: number;
  fps: number;
  onLevels: (levels: number[]) => void;
  /** Reuse an existing context where possible; browsers cap how many exist. */
  context?: AudioContext;
};

export type LevelMeter = {
  stop: () => void;
};

export function attachLevelMeter({
  stream,
  bars,
  fps,
  onLevels,
  context,
}: LevelMeterOptions): LevelMeter {
  const ownsContext = !context;
  const audioContext = context ?? new AudioContext();

  const analyser = audioContext.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = 0.6;

  const source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);

  const spectrum = new Uint8Array(analyser.frequencyBinCount);
  const usableBins = Math.floor(analyser.frequencyBinCount * USABLE_BIN_FRACTION);
  const binsPerBar = Math.max(1, Math.floor(usableBins / bars));
  const frameInterval = 1000 / fps;

  let frame: number | null = null;
  let lastFrame = 0;

  const tick = (now: number) => {
    frame = requestAnimationFrame(tick);
    if (now - lastFrame < frameInterval) return;
    lastFrame = now;

    analyser.getByteFrequencyData(spectrum);

    const next = new Array<number>(bars);
    for (let bar = 0; bar < bars; bar += 1) {
      const from = bar * binsPerBar;
      let total = 0;
      for (let bin = from; bin < from + binsPerBar; bin += 1) {
        total += spectrum[bin] ?? 0;
      }
      next[bar] = total / binsPerBar / 255;
    }
    onLevels(next);
  };

  frame = requestAnimationFrame(tick);

  return {
    stop: () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      source.disconnect();
      analyser.disconnect();
      if (ownsContext) void audioContext.close();
    },
  };
}

/** Rough "is this person talking right now" test, for the speaking ring. */
export function isSpeaking(levels: readonly number[], threshold = 0.08): boolean {
  return levels.some((level) => level > threshold);
}
