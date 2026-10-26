import fs from "node:fs";
import path from "node:path";
import { dataRoot, runtime, serialize, HttpError } from "./db";
import { settings } from "./store";
import { workspaceDay } from "../lib/domain";

const usageFile = path.join(dataRoot, "provider-usage.json");
function liveGoogleEnabled() {
  return (
    process.env.NODE_ENV !== "development" &&
    process.env.TIDE_GOOGLE_MODE === "live"
  );
}
function usage() {
  try {
    return JSON.parse(fs.readFileSync(usageFile, "utf8")) as {
      day: string;
      count: number;
    };
  } catch {
    return { day: "", count: 0 };
  }
}
export async function providerStatus() {
  const s = await settings();
  const u = usage();
  // Read the legacy name dynamically so Next never freezes it at build time.
  const env = process.env;
  const mapsBrowserKey = liveGoogleEnabled()
    ? env.GOOGLE_MAPS_BROWSER_KEY || env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ""
    : "";
  return {
    configured:
      liveGoogleEnabled() &&
      !!process.env.GOOGLE_SERVER_API_KEY &&
      s.googleEnabled,
    mapConfigured: !!mapsBrowserKey,
    mapsBrowserKey,
    used: u.day === workspaceDay({ ...s, dayBoundary: "00:00" }) ? u.count : 0,
    limit: s.googleDailyLimit,
  };
}
async function allowance() {
  await serialize(async () => {
    const cfg = await settings();
    if (
      !liveGoogleEnabled() ||
      !cfg.googleEnabled ||
      !process.env.GOOGLE_SERVER_API_KEY
    )
      throw new HttpError(
        503,
        "Google is not configured. Use a saved place, manual address, or manual travel estimate.",
      );
    const day = workspaceDay({ ...cfg, dayBoundary: "00:00" });
    const u = usage();
    if (u.day !== day) {
      u.day = day;
      u.count = 0;
    }
    if (u.count >= cfg.googleDailyLimit)
      throw new HttpError(
        429,
        "Daily request allowance reached. New Google requests are paused until midnight.",
      );
    u.count++;
    fs.writeFileSync(`${usageFile}.tmp`, JSON.stringify(u));
    fs.renameSync(`${usageFile}.tmp`, usageFile);
  });
}
async function google(url: string, body?: unknown, fieldMask?: string) {
  await allowance();
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": process.env.GOOGLE_SERVER_API_KEY!,
      ...(fieldMask ? { "X-Goog-FieldMask": fieldMask } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok)
    throw new HttpError(
      502,
      "Google could not provide this result. Choose a manual alternative or try again.",
    );
  return response.json();
}
export async function places(query: string) {
  if (query.trim().length < 3)
    throw new HttpError(422, "Enter at least three characters");
  return google(
    "https://places.googleapis.com/v1/places:searchText",
    { textQuery: query, maxResultCount: 5 },
    "places.id,places.displayName,places.formattedAddress,places.location,places.regularOpeningHours",
  );
}
export async function placeDetails(id: string) {
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(id))
    throw new HttpError(422, "Choose a Google place to check opening hours.");
  return {
    ...(await google(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`,
      undefined,
      "id,displayName,regularOpeningHours,currentOpeningHours",
    )),
    checkedAt: new Date().toISOString(),
  };
}
export async function route(input: {
  origin: string;
  destination: string;
  travelMode: string;
  departure?: string;
  arrival?: string;
}) {
  if (!input.origin || !input.destination)
    throw new HttpError(422, "Choose a starting address and destination");
  const mode = ["DRIVE", "WALK", "BICYCLE", "TRANSIT"].includes(
    input.travelMode,
  )
    ? input.travelMode
    : "DRIVE";
  const body: Record<string, unknown> = {
    origin: { address: input.origin },
    destination: { address: input.destination },
    travelMode: mode,
  };
  if (input.arrival && mode === "TRANSIT")
    body.arrivalTime = new Date(input.arrival).toISOString();
  else if (input.departure && Date.parse(input.departure) > Date.now())
    body.departureTime = new Date(input.departure).toISOString();
  if (mode === "DRIVE") body.routingPreference = "TRAFFIC_AWARE";
  let data = await google(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    body,
    "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
  );
  if (!data.routes?.length)
    throw new HttpError(
      422,
      "This travel mode has no available route. Choose another mode or use a manual estimate.",
    );
  const approximate = !!input.arrival && mode !== "TRANSIT";
  if (approximate && mode === "DRIVE") {
    const duration = Number.parseInt(data.routes[0].duration);
    const departure = Date.parse(input.arrival!) - duration * 1000;
    if (departure > Date.now()) {
      data = await google(
        "https://routes.googleapis.com/directions/v2:computeRoutes",
        { ...body, departureTime: new Date(departure).toISOString() },
        "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
      );
    }
  }
  return { ...data, checkedAt: new Date().toISOString(), approximate };
}
export async function weather(input: {
  latitude: number;
  longitude: number;
  day: string;
}) {
  if (
    !Number.isFinite(input.latitude) ||
    Math.abs(input.latitude) > 90 ||
    !Number.isFinite(input.longitude) ||
    Math.abs(input.longitude) > 180
  )
    throw new HttpError(422, "Choose a location with coordinates");
  const cfg = await settings();
  const today = workspaceDay({ ...cfg, dayBoundary: "00:00" });
  if (
    input.day < today ||
    input.day > new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10)
  )
    throw new HttpError(
      422,
      "This date is outside the available forecast range",
    );
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  Object.entries({
    latitude: String(input.latitude),
    longitude: String(input.longitude),
    daily:
      "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code",
    timezone: cfg.timezone,
    forecast_days: "16",
  }).forEach(([k, v]) => url.searchParams.set(k, v));
  const key = url.toString();
  let result = runtime.requestCache.get(key);
  if (!result || result.expires < Date.now()) {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok)
      throw new HttpError(
        502,
        "Weather is unavailable. Your task remains editable.",
      );
    result = { expires: Date.now() + 30 * 60000, data: await response.json() };
    runtime.requestCache.set(key, result);
  }
  return {
    forecast: result.data,
    checkedAt: new Date(result.expires - 30 * 60000).toISOString(),
  };
}
