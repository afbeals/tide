import { afterEach, describe, expect, it, vi } from "vitest";
import { createId } from "../src/lib/id";

const uuidV4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => vi.unstubAllGlobals());

describe("browser-compatible identifiers", () => {
  it("creates distinct UUIDv4 identifiers using cryptographic randomness", () => {
    const ids = Array.from({ length: 64 }, () => createId());
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(uuidV4);
  });

  it.each([0, 255])(
    "preserves UUID version and variant without randomUUID for byte value %i",
    (byte) => {
      vi.stubGlobal("crypto", {
        getRandomValues: (bytes: Uint8Array) => bytes.fill(byte),
      });
      expect(createId()).toMatch(uuidV4);
    },
  );
});
