import { describe, it, expect } from "vitest";
import { AnthropicSSEParser, anthropicDeltaText, sseData, sseDone, sseError } from "./sse";

describe("AnthropicSSEParser", () => {
  it("splits complete events and yields their data lines", () => {
    const p = new AnthropicSSEParser();
    const out = p.push("event: foo\ndata: {\"a\":1}\n\nevent: bar\ndata: {\"b\":2}\n\n");
    expect(out).toEqual(['{"a":1}', '{"b":2}']);
  });

  it("buffers a partial event across chunk boundaries", () => {
    const p = new AnthropicSSEParser();
    expect(p.push("event: x\ndata: {\"hal")).toEqual([]); // incomplete
    expect(p.push('f":true}\n\n')).toEqual(['{"half":true}']);
  });

  it("handles a delta split mid-token", () => {
    const p = new AnthropicSSEParser();
    const frames = [
      'data: {"type":"content_block_delta","del',
      'ta":{"type":"text_delta","text":"abc"}}\n\n',
    ];
    let collected: string[] = [];
    for (const f of frames) collected = collected.concat(p.push(f));
    expect(collected.length).toBe(1);
    expect(anthropicDeltaText(collected[0])).toBe("abc");
  });
});

describe("anthropicDeltaText", () => {
  it("extracts text from a content_block_delta", () => {
    expect(anthropicDeltaText('{"type":"content_block_delta","delta":{"type":"text_delta","text":"hi"}}')).toBe("hi");
  });
  it("returns null for non-delta events", () => {
    expect(anthropicDeltaText('{"type":"message_start"}')).toBeNull();
    expect(anthropicDeltaText('{"type":"ping"}')).toBeNull();
    expect(anthropicDeltaText("not json")).toBeNull();
  });
});

describe("sse frame helpers", () => {
  it("formats data/done/error frames with the SSE double-newline terminator", () => {
    expect(sseData("x")).toBe('data: {"text":"x"}\n\n');
    expect(sseDone("2026-06-03-1")).toBe('event: done\ndata: {"id":"2026-06-03-1"}\n\n');
    expect(sseError("nope")).toBe('event: error\ndata: {"error":"nope"}\n\n');
  });
});
