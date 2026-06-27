import { describe, expect, it, vi } from "vitest";
import { toLocalISOString } from "./date";

describe("toLocalISOString", () => {
  it("タイムゾーンオフセットが含まれる", () => {
    const result = toLocalISOString(new Date("2026-03-28T09:00:00"));
    expect(result).toMatch(/[+-]\d{2}:\d{2}$/);
  });

  it("UTC末尾のZが含まれない", () => {
    const result = toLocalISOString(new Date("2026-03-28T09:00:00"));
    expect(result).not.toMatch(/Z$/);
  });

  it("ISO 8601形式になっている", () => {
    const result = toLocalISOString(new Date("2026-03-28T09:00:00"));
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/);
  });

  it("UTC+0環境で+00:00になる", () => {
    const date = new Date("2026-03-28T09:00:00Z");
    const spy = vi.spyOn(date, "getTimezoneOffset").mockReturnValue(0);
    const result = toLocalISOString(date);
    expect(result).toMatch(/\+00:00$/);
    spy.mockRestore();
  });

  it("UTC+9環境で+09:00になる", () => {
    const date = new Date("2026-03-28T09:00:00Z");
    const spy = vi.spyOn(date, "getTimezoneOffset").mockReturnValue(-540);
    const result = toLocalISOString(date);
    expect(result).toMatch(/\+09:00$/);
    spy.mockRestore();
  });

  it("UTC-5環境で-05:00になる", () => {
    const date = new Date("2026-03-28T09:00:00Z");
    const spy = vi.spyOn(date, "getTimezoneOffset").mockReturnValue(300);
    const result = toLocalISOString(date);
    expect(result).toMatch(/-05:00$/);
    spy.mockRestore();
  });

  it("ミリ秒が3桁でゼロ埋めされる", () => {
    const date = new Date("2026-03-28T09:00:00Z");
    vi.spyOn(date, "getTimezoneOffset").mockReturnValue(0);
    vi.spyOn(date, "getMilliseconds").mockReturnValue(5);
    const result = toLocalISOString(date);
    expect(result).toContain(".005");
  });
});
