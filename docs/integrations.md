# Integrations

## Google account and services

Tide uses API keys from a Google Cloud project. There is no Google sign-in or account connection inside Tide. Everyone in the shared workspace uses the same configured services and billing project.

| Service | Tide feature | Credential |
|---|---|---|
| Places API (New) | Search destinations and check opening hours | Server key |
| Routes API | Travel duration, distance and departure/arrival estimates | Server key |
| Maps JavaScript API | Interactive outing maps | Browser key |

Google Maps directions links also work without these keys. Weather uses Open-Meteo separately and needs no Google account.

## 1. Create the Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/) and sign in with the Google account you want to own the integration.
2. Use the project selector to create a project named **Tide**, or select an existing personal project.
3. Under **Billing**, link the project to your billing account. Free usage allowances still depend on the Google services used; billing configuration does not guarantee a zero bill.
4. Open **APIs & Services → Library** and enable **Places API (New)**, **Routes API**, and **Maps JavaScript API** in that project.

## 2. Create two restricted API keys

Open **APIs & Services → Credentials → Create credentials → API key** for each key, then edit its restrictions.

| Key | API restrictions | Application restrictions |
|---|---|---|
| Tide server | Places API (New), Routes API | Where practical, restrict to the hosting machine's public outbound IP. Update it when moving from your development machine to Unraid or when that IP changes. Website/referrer restrictions are not suitable for this key. |
| Tide browser | Maps JavaScript API | Choose Websites/HTTP referrers and add the exact origins where you open Tide, using the examples below. |

Browser referrer examples:

```text
http://localhost:8776/*
http://127.0.0.1:8776/*
http://YOUR_UNRAID_IP:8776/*
https://YOUR_TIDE_HOSTNAME/*
```

Replace the uppercase placeholders with your actual address. Add only the origins you use. The browser key is visible to browsers by design; the server key stays on the server. Do not place the server key in a variable beginning with `NEXT_PUBLIC_`.

## 3. Keep local development and tests independent of Google

Keep both real Google keys exclusively in Unraid. The local [.env.example](../.env.example) sets `TIDE_GOOGLE_MODE=disabled` and contains no Google credentials. Next development always disables Google calls and browser-key delivery, even if keys or live mode are accidentally inherited. The running local application offers saved places, manual estimates and directions links; Storybook and automated provider tests use mocked Google responses.

`npm run docker:test` does not read `.env`. It explicitly disables live Google access and clears both current key variables and the legacy browser-key variable in the test container, including when the parent environment or image contains them. Local container tests therefore need no credentials. Automated tests use fake values and intercept provider calls; they do not consume Google quota. Opening a directions link leaves Tide and opens Google's normal website.

## 4. Configure Docker and Unraid

Build and publish the image without either key. Neither key belongs in a Docker build argument, image or committed file.

On Unraid, open **Docker → Tide → Edit → Add another Path, Port, Variable, Label or Device**, choose **Variable**, and add each of these container environment variables:

| Key | Value |
|---|---|
| `TIDE_GOOGLE_MODE` | `live` |
| `GOOGLE_SERVER_API_KEY` | Your server key for Places API (New) and Routes API |
| `GOOGLE_MAPS_BROWSER_KEY` | Your browser key for Maps JavaScript API |

Apply the configuration and recreate the container while preserving its data-folder mapping. Changing a key only requires applying the updated container environment and refreshing the browser; no image rebuild or Docker Hub push is needed after installing a version with runtime configuration. The public browser key is delivered through the uncached workspace response; the server key stays private. The browser key remains visible to browsers by design and needs website/API restrictions.

The older `NEXT_PUBLIC_GOOGLE_MAPS_KEY` name is supported as a runtime fallback on the server; `GOOGLE_MAPS_BROWSER_KEY` takes precedence. Prefer the new name. The included Compose file also supplies keys at runtime and defaults live access to disabled. See [Docker and Unraid](deploy-unraid.md) for the complete build, image and volume workflow.

## 5. Enable and verify the integration

1. Open Tide → **Settings → Dates, backups & integrations**.
2. Under **Google services**, enable **Enable Google requests**, set the **Daily request allowance**, and save.
3. The Google integration summary on Settings should show **Configured**. This reports that production live mode is enabled, the server key is present and requests are enabled in workspace settings; it does not prove that Google has accepted the key, billing or restrictions.
4. Under **Settings → Saved places**, add/edit a place and use **Search Google Places** to check a real destination search.
5. Open an away task, choose its start/destination and use its route/opening-hours checks. Open an outing's map to verify the browser key separately.

Tide's daily allowance counts server requests to Places and Routes. Some estimates can make more than one request. It does not cover Maps JavaScript map loads or guarantee a billing cap. Configure Google Cloud API quotas and billing alerts separately.

If a feature fails, check the selected Cloud project, billing, enabled APIs, key API restrictions and the actual browser referrer or server public outbound IP. An unavailable map can have a different key/configuration problem from a failed place search or route estimate. Live Google behavior has not yet been verified with the owner's credentials; see the [verification record](verification.md).

## Travel behavior and provider data

Server provider requests happen on explicit searches/checks. Opening an outing map loads Google's browser map service. Tide stores authored addresses, coordinates and place IDs; route, forecast and opening-hours summaries remain ephemeral. Daily server usage counters persist outside the active database so restoration does not reset the allowance.

Driving leave-by is approximate: a bounded departure query refines travel duration. Transit supports arrival-time queries directly. Unsupported modes/routes fall back to a manual duration and itinerary. Google Maps directions links remain usable separately.

## Weather and device location

Weather uses Open-Meteo's personal/prototype endpoint, credits Open-Meteo, and caches forecasts in memory for 30 minutes. Dates outside the forecast range and missing coordinates receive explicit messages. Home outdoors is supported as well as destination weather. Confirm any weather-based rescheduling manually.

Device location generally requires HTTPS or localhost. LAN HTTP users choose Home, Work or a manual address. Integration failure does not block task work.
