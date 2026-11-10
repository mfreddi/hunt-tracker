# Privacy Policy

## Data Collection

**Hunt Tracker collects zero personal data.**

- No accounts, no login, no telemetry
- No crash reports sent automatically
- No usage analytics
- No network requests except the local server on port 1040

## What the App Reads

### Game.log

**Location:** `<Hunt: Showdown install folder>\USER\Game.log`

**Content read:**

- Mission start/end events (map, mode, timestamp)
- Disconnect/reconnect events
- Game time of day

**Not read:** Chat messages, player names, inventory, matchmaking data, voice chat

### NVIDIA Highlights SDK log

**Location:** `%LOCALAPPDATA%\NVIDIA Corporation\GfeSDK\HuntGame_<pid>.log`

**Content read:**

- Kill events (weapon, victim, headshot, timestamp)
- Death events (killer, weapon, timestamp)
- Trade events (correlated kill + death within 500 ms)
- Assist, revive, headshot highlights

**Not read:** Video clips, screenshots, GPU telemetry, driver info

## What the App Stores Locally

All data stays in your **user profile** on **your machine**:

| Data | Purpose |
|------|---------|
| Session counters | Games, kills, deaths, survival rate |
| Current match | In-progress match state |
| Kill streak config | Alert rules, media / sound URLs |
| Challenge goals | Goal targets, progress |
| UI preferences | Theme, position, opacity, scale |
| Log paths | `Game.log`, NVIDIA SDK log locations |
| Match history | `hunt-history/matches.ndjson` under the app's user-data folder |

Settings are stored with `electron-store` as a plain JSON file in the app's user-data folder. It is local-only; the app makes no attempt to hide it, and nothing is uploaded anywhere.

## Network Communication

**Only a local server on port 1040** (HTTP + WebSocket):

- Serves the overlay page and the live state JSON to OBS Browser Source
- No authentication — intended for local trusted use
- Can be reached from the LAN for remote OBS (so the user can run OBS on a second PC)

**No outbound connections** — no update checks, no telemetry, no license validation.

## Third Party

- **NVIDIA Highlights SDK** — reads its log file only, no SDK integration
- **Steam** — game folder detection, no Steam API
- **Electron** — runtime only, no auto-updater

## Your Rights

- **Delete all data:** uninstall the app and remove its user-data folder
- **No data sharing** — nothing to share, nothing leaves your PC

## Compliance

- **GDPR:** No personal data processed → not applicable
- **CCPA:** No sale of personal information → not applicable
- **COPPA:** Not directed at children under 13

## Open Source

Full source code: https://github.com/mfreddi/hunt-tracker

You can audit, build, and run without any external dependencies.

## Contact

General questions: GitHub Issues
