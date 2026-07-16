import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Tone.js is a browser-audio library that constructs real Web Audio nodes on
// import. In the node test env there is no AudioContext, so we mock it to
// lightweight stand-ins and, crucially, capture the Sampler options object so
// we can drive the onload / onerror callbacks by hand and assert the singleton
// state machine (loaded flag, deferred master-chain connect) behaves.
//
// piano-sampler pulls Tone lazily through tone-loader's getTone() (the audio
// engine is a first-gesture chunk), so we mock tone-loader rather than "tone".

type SamplerOpts = {
  urls: Record<string, string>;
  baseUrl: string;
  release: number;
  onload: () => void;
  onerror: (err: Error) => void;
};

let lastSamplerOpts: SamplerOpts | null = null;
let contextState = "suspended"; // flip to "running" to simulate an unlocked ctx
const connectSpy = vi.fn();

vi.mock("./tone-loader", () => {
  class Limiter {
    threshold: number;
    constructor(threshold: number) {
      this.threshold = threshold;
    }
    toDestination() {
      return this;
    }
  }
  class Reverb {
    opts: unknown;
    connect = vi.fn();
    constructor(opts: unknown) {
      this.opts = opts;
    }
  }
  class Sampler {
    constructor(opts: SamplerOpts) {
      lastSamplerOpts = opts;
    }
    connect = connectSpy;
  }
  const fakeTone = {
    Limiter,
    Reverb,
    Sampler,
    getContext: () => ({ get state() { return contextState; } }),
  };
  return {
    getTone: () => fakeTone,
    toneLoaded: () => true,
    loadTone: () => Promise.resolve(fakeTone),
  };
});

// Fresh module (and thus fresh singleton state) per test.
async function freshModule() {
  vi.resetModules();
  return import("./piano-sampler");
}

describe("piano-sampler", () => {
  beforeEach(() => {
    lastSamplerOpts = null;
    contextState = "suspended";
    connectSpy.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("preloadPianoSampler constructs the sampler but reports not-ready until onload", async () => {
    const mod = await freshModule();
    mod.preloadPianoSampler();
    expect(lastSamplerOpts).not.toBeNull();
    expect(mod.isSamplerReady()).toBe(false);

    lastSamplerOpts!.onload();
    expect(mod.isSamplerReady()).toBe(true);
  });

  it("onerror leaves the sampler not-ready (permanent synth fallback) and warns", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mod = await freshModule();
    mod.preloadPianoSampler();

    lastSamplerOpts!.onerror(new Error("404 on C4.mp3"));
    expect(mod.isSamplerReady()).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("defers connecting the sampler to the master chain until the AudioContext is running", async () => {
    const mod = await freshModule();

    // Suspended context (before any user gesture): construct only, no connect.
    contextState = "suspended";
    mod.getPianoSampler();
    expect(connectSpy).not.toHaveBeenCalled();

    // Once running, the next call wires it to the master chain exactly once.
    contextState = "running";
    mod.getPianoSampler();
    mod.getPianoSampler();
    expect(connectSpy).toHaveBeenCalledOnce();
  });
});
