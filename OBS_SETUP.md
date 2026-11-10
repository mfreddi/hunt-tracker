# OBS Setup Guide

## Quick Setup (Combined Panel)

1. **Add Browser Source** in OBS: `+` → **Browser Source**
2. **URL**: `http://localhost:1040/hunt?theme=slate&bga=0.8`
3. **Width**: 280, **Height**: 400 (adjust for theme)
4. **Uncheck** "Shutdown source when not visible" (keeps WS alive)
5. Click **OK**

## Widget Mode (Separate Sources)

For granular control, add multiple Browser Sources:

| Widget | URL | Suggested Size |
|--------|-----|----------------|
| **Main Panel** | `http://localhost:1040/hunt?theme=slate&bga=0.8&show=all` | 280×400 |
| **Recent Matches** | `http://localhost:1040/hunt?theme=slate&bga=0.8&show=recent` | 280×200 |
| **Map Win Rates** | `http://localhost:1040/hunt?theme=wood&bga=0.8&show=maps` | 300×350 |
| **Challenge Goals** | `http://localhost:1040/hunt?theme=blood&bga=0.8&show=goal` | 300×250 |
| **Kill-streak Alerts** | `http://localhost:1040/killstreak` | 400×250 |

## Query Parameters Reference

| Param | Values | Default | Description |
|-------|--------|---------|-------------|
| `theme` | `classic`, `slate`, `wood`, `blood` | `classic` | Visual theme |
| `show` | `all`, `recent`, `maps`, `goal` | `all` | Widget mode |
| `position` | `top-left`, `top`, `top-right`, `bottom-left`, `bottom`, `bottom-right` | `top-left` | Panel corner (only `show=all`) |
| `bga` | `0.0` – `1.0` | `0.85` | Background opacity |
| `scale` | `0.5` – `2.0` | `1.0` | UI scale multiplier |
| `scope` | `session`, `mode` | `mode` | Stats scope (only `show=all`) |
| `mapsPeriod` | `all`, `session` | `all` | Map stats period (only `show=all`) |
| `port` | number | `1040` | WS port (for `file://` protocol) |
| `demo` | (flag) | — | Demo mode with fake data |

## Theme Preview

| Theme | Best For |
|-------|----------|
| **Classic** | Minimal, semi-transparent, works on any background |
| **Slate** | Dark stone texture, torn edges — streamer favorite |
| **Wood** | Dark planks, brass rivets — immersive |
| **Blood** | Dried blood stone, red drips — aggressive |

## Remote OBS (Another PC on LAN)

If running OBS on a different machine than the tracker:

1. Find host IP: `ipconfig` → IPv4 address (e.g., `192.168.1.50`)
2. OBS Browser Source URL: `http://192.168.1.50:1040/hunt?theme=slate&bga=0.8`
3. **Firewall**: Allow inbound TCP 1040 on host (`netsh advfirewall firewall add rule name="Hunt Tracker" dir=in action=allow protocol=TCP localport=1040`)

The overlay auto-rewrites `http://localhost:1040/media/...` → `http://<host-ip>:1040/media/...` for media/sounds.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Blank panel | Check WS port (1040), firewall, or `http://localhost:1040/hunt?demo` to test overlay alone |
| "Нет данных из игры" | Game not running, or log paths wrong → Settings → Paths → Detect |
| Kills/deaths missing | NVIDIA Highlights must be ON in GeForce Experience → Hunt: Showdown |
| Flickering | Increase `bga` (background opacity) or disable hardware acceleration in OBS |
| Wrong position | `position` param only works with `show=all`; widget modes (`recent`/`maps`/`goal`) fill the source rect |
| Media/sounds not playing | Remote OBS: overlay auto-rewrites URLs; check firewall allows media port (same 1040) |

## Performance Tips

- **One combined panel** (`show=all`) = 1 WS connection, 1 browser source
- **Multiple widgets** = multiple sources, each maintains own WS connection
- Disable "Shutdown when not visible" to avoid WS reconnect lag
- For 4K streams, increase `scale` (1.25–1.5) and source resolution

## Custom CSS (Advanced)

Inject custom CSS via OBS Browser Source → **CSS** tab:

```css
/* Larger text */
.panel { --scale: 1.2; }

/* Hide specific rows */
.panel .modes { display: none; }

/* Custom colors */
:root { --accent: #ff6b35; --good: #4ade80; --bad: #f87171; }
```

## Demo Mode (No Game Running)

Test overlay without game:
```
http://localhost:1040/hunt?demo&theme=slate&bga=0.8
```
