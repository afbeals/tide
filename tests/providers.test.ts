import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import fs from "node:fs";
import path from "node:path";
import { temporaryDatabase } from "./helpers/database";
import { addDays, workspaceDay } from "../src/lib/domain";

const fixture = temporaryDatabase("providers");
let providers: typeof import("../src/server/providers");
let store: typeof import("../src/server/store");
let database: typeof import("../src/server/db");
const originalKey = process.env.GOOGLE_SERVER_API_KEY;
const originalMapKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
const originalRuntimeMapKey = process.env.GOOGLE_MAPS_BROWSER_KEY;
const originalGoogleMode = process.env.TIDE_GOOGLE_MODE;
const fetchMock = vi.fn<typeof fetch>();
beforeAll(async () => {
  store = await import("../src/server/store");
  database = await import("../src/server/db");
  providers = await import("../src/server/providers");
  await store.initialize();
});
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-24T19:00:00Z"));
  process.env.GOOGLE_SERVER_API_KEY = "test-server-key";
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY = "test-browser-key";
  process.env.GOOGLE_MAPS_BROWSER_KEY = "test-runtime-browser-key";
  process.env.TIDE_GOOGLE_MODE = "live";
  fs.rmSync(path.join(fixture.root, "provider-usage.json"), { force: true });
  database.runtime.requestCache.clear();
  const cfg = (await store.entities()).find((r) => r.kind === "settings")!;
  await store.updateRecord(cfg.id, cfg.version, {
    ...cfg.data,
    googleEnabled: true,
    googleDailyLimit: 10,
  });
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
afterAll(async () => {
  for (const [key, value] of Object.entries({
    GOOGLE_SERVER_API_KEY: originalKey,
    NEXT_PUBLIC_GOOGLE_MAPS_KEY: originalMapKey,
    GOOGLE_MAPS_BROWSER_KEY: originalRuntimeMapKey,
    TIDE_GOOGLE_MODE: originalGoogleMode,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await fixture.close(database);
});
const json = (value: unknown) =>
  new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" },
  });
const travel = { origin: "Home", destination: "Library", travelMode: "DRIVE" };
describe("external provider boundaries", () => {
  it.each([undefined, "disabled", "unexpected"])(
    "blocks live calls and browser key delivery when production access is not explicitly enabled (%s)",
    async (mode) => {
      if (mode === undefined) delete process.env.TIDE_GOOGLE_MODE;
      else process.env.TIDE_GOOGLE_MODE = mode;
      await expect(providers.places("Library")).rejects.toMatchObject({
        status: 503,
      });
      await expect(providers.placeDetails("library")).rejects.toMatchObject({
        status: 503,
      });
      await expect(providers.route(travel)).rejects.toMatchObject({
        status: 503,
      });
      expect(await providers.providerStatus()).toMatchObject({
        configured: false,
        mapConfigured: false,
        mapsBrowserKey: "",
        used: 0,
      });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
  it("blocks live requests and browser keys during local Next development even if live mode was inherited", async () => {
    vi.stubEnv("NODE_ENV", "development");
    try {
      await expect(providers.places("Library")).rejects.toMatchObject({
        status: 503,
      });
      expect(await providers.providerStatus()).toMatchObject({
        configured: false,
        mapConfigured: false,
        mapsBrowserKey: "",
        used: 0,
      });
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it("reads the current runtime browser key with a legacy fallback and never exposes the server key", async () => {
    for (const [current, legacy, expected] of [
      ["runtime-key", "legacy-key", "runtime-key"],
      ["rotated-key", "legacy-key", "rotated-key"],
      ["", "legacy-key", "legacy-key"],
      ["", "", ""],
    ]) {
      process.env.GOOGLE_MAPS_BROWSER_KEY = current;
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY = legacy;
      expect(await providers.providerStatus()).toEqual({
        configured: true,
        mapConfigured: !!expected,
        mapsBrowserKey: expected,
        used: 0,
        limit: 10,
      });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("sends Places credentials only in server headers and requests the required fields", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ places: [{ id: "library", formattedAddress: "100 Main St" }] }),
    );
    expect(await providers.places("Library")).toMatchObject({
      places: [{ id: "library" }],
    });
    const [url, request] = fetchMock.mock.calls[0];
    expect(String(url)).not.toContain("test-server-key");
    expect(request?.headers).toMatchObject({
      "X-Goog-Api-Key": "test-server-key",
      "X-Goog-FieldMask": expect.stringContaining("regularOpeningHours"),
    });
    expect(JSON.parse(String(request?.body))).toMatchObject({
      textQuery: "Library",
      maxResultCount: 5,
    });
    expect(await providers.providerStatus()).toMatchObject({
      configured: true,
      mapConfigured: true,
      used: 1,
    });
  });
  it("rejects underspecified searches and invalid place IDs before charging allowance", async () => {
    await expect(providers.places(" a ")).rejects.toMatchObject({
      status: 422,
    });
    await expect(providers.placeDetails("../secret")).rejects.toMatchObject({
      status: 422,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await providers.providerStatus()).used).toBe(0);
  });
  it("returns opening hours with the actual check time", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ currentOpeningHours: { openNow: true } }),
    );
    expect(await providers.placeDetails("place_123")).toMatchObject({
      currentOpeningHours: { openNow: true },
      checkedAt: new Date().toISOString(),
    });
    expect(fetchMock.mock.calls[0][1]?.method).toBe("GET");
  });
  it("rejects missing credentials and disabled requests without external calls", async () => {
    delete process.env.GOOGLE_SERVER_API_KEY;
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    delete process.env.GOOGLE_MAPS_BROWSER_KEY;
    await expect(providers.places("Library")).rejects.toMatchObject({
      status: 503,
    });
    expect(await providers.providerStatus()).toMatchObject({
      configured: false,
      mapConfigured: false,
    });
    process.env.GOOGLE_SERVER_API_KEY = "test-server-key";
    const cfg = (await store.entities()).find((r) => r.kind === "settings")!;
    await store.updateRecord(cfg.id, cfg.version, {
      ...cfg.data,
      googleEnabled: false,
    });
    await expect(providers.places("Library")).rejects.toMatchObject({
      status: 503,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("enforces a zero allowance and serializes concurrent requests at the limit", async () => {
    let cfg = (await store.entities()).find((r) => r.kind === "settings")!;
    await store.updateRecord(cfg.id, cfg.version, {
      ...cfg.data,
      googleDailyLimit: 0,
    });
    await expect(providers.places("Library")).rejects.toMatchObject({
      status: 429,
    });
    cfg = (await store.entities()).find((r) => r.kind === "settings")!;
    await store.updateRecord(cfg.id, cfg.version, {
      ...cfg.data,
      googleDailyLimit: 1,
    });
    fetchMock.mockImplementation(async () => json({ places: [] }));
    const results = await Promise.allSettled([
      providers.places("Library"),
      providers.places("Park"),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await providers.providerStatus()).used).toBe(1);
  });
  it("resets daily usage at workspace midnight without resetting the stored counter on restore", async () => {
    fs.writeFileSync(
      path.join(fixture.root, "provider-usage.json"),
      JSON.stringify({ day: "2026-10-23", count: 999 }),
    );
    expect((await providers.providerStatus()).used).toBe(0);
    fetchMock.mockResolvedValueOnce(json({ places: [] }));
    await providers.places("Library");
    expect((await providers.providerStatus()).used).toBe(1);
    expect(
      JSON.parse(
        fs.readFileSync(path.join(fixture.root, "provider-usage.json"), "utf8"),
      ).day,
    ).toBe("2026-10-24");
  });
  it("hides upstream failure bodies and counts attempted Google requests", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("upstream details: test-server-key", { status: 403 }),
    );
    await expect(providers.places("Library")).rejects.toMatchObject({
      status: 502,
      message: expect.not.stringContaining("test-server-key"),
    });
    expect((await providers.providerStatus()).used).toBe(1);
  });
  it.each(["DRIVE", "WALK", "BICYCLE", "TRANSIT"])(
    "requests the selected %s route with a future departure",
    async (mode) => {
      fetchMock.mockResolvedValueOnce(
        json({ routes: [{ duration: "600s", distanceMeters: 5000 }] }),
      );
      const departure = "2026-10-25T15:00:00Z";
      const result = await providers.route({
        ...travel,
        travelMode: mode,
        departure,
      });
      expect(result.approximate).toBe(false);
      expect(
        JSON.parse(String(fetchMock.mock.calls[0][1]?.body)),
      ).toMatchObject({
        travelMode: mode,
        departureTime: new Date(departure).toISOString(),
      });
    },
  );
  it("uses transit arrival directly and refines an approximate driving leave-by once", async () => {
    fetchMock.mockImplementation(async () =>
      json({ routes: [{ duration: "600s", distanceMeters: 5000 }] }),
    );
    const arrival = "2026-10-25T16:00:00Z";
    expect(
      (await providers.route({ ...travel, travelMode: "TRANSIT", arrival }))
        .approximate,
    ).toBe(false);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      arrivalTime: new Date(arrival).toISOString(),
    });
    expect((await providers.route({ ...travel, arrival })).approximate).toBe(
      true,
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toMatchObject({
      departureTime: "2026-10-25T15:50:00.000Z",
    });
  });
  it("does not request a past departure and offers manual fallback for unavailable routes", async () => {
    fetchMock.mockResolvedValueOnce(json({ routes: [{ duration: "600s" }] }));
    await providers.route({
      ...travel,
      travelMode: "unknown",
      departure: "2020-01-01T00:00:00Z",
      arrival: "2020-01-01T01:00:00Z",
    });
    expect(
      JSON.parse(String(fetchMock.mock.calls[0][1]?.body)),
    ).not.toHaveProperty("departureTime");
    fetchMock.mockResolvedValueOnce(json({ routes: [] }));
    await expect(providers.route(travel)).rejects.toMatchObject({
      status: 422,
    });
    await expect(
      providers.route({ ...travel, origin: "" }),
    ).rejects.toMatchObject({ status: 422 });
  });
  it("uses the workspace zone and caches weather for thirty minutes without Google usage", async () => {
    fetchMock.mockImplementation(async () =>
      json({ daily: { time: ["2026-10-24"], temperature_2m_max: [20] } }),
    );
    const input = {
      latitude: 37.7749,
      longitude: -122.4194,
      day: workspaceDay(),
    };
    const first = await providers.weather(input);
    expect(await providers.weather(input)).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("timezone")).toBe("America/Los_Angeles");
    expect(url.searchParams.get("longitude")).toBe("-122.4194");
    vi.setSystemTime(Date.now() + 31 * 60000);
    expect((await providers.weather(input)).checkedAt).not.toBe(
      first.checkedAt,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((await providers.providerStatus()).used).toBe(0);
  });
  it.each([
    { latitude: 91, longitude: 0 },
    { latitude: 0, longitude: -181 },
    { latitude: NaN, longitude: 0 },
  ])("rejects invalid coordinates %j", async (input) => {
    await expect(
      providers.weather({ ...input, day: workspaceDay() }),
    ).rejects.toMatchObject({ status: 422 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects past/out-of-range forecasts and preserves an unavailable-weather response", async () => {
    const input = {
      latitude: 0,
      longitude: 0,
      day: addDays(workspaceDay(), -1),
    };
    await expect(providers.weather(input)).rejects.toMatchObject({
      status: 422,
    });
    await expect(
      providers.weather({ ...input, day: addDays(workspaceDay(), 16) }),
    ).rejects.toMatchObject({ status: 422 });
    fetchMock.mockResolvedValueOnce(
      new Response("Unavailable", { status: 503 }),
    );
    await expect(
      providers.weather({ ...input, day: workspaceDay() }),
    ).rejects.toMatchObject({ status: 502 });
  });
});
