# Hunt Tracker / Трекер Hunt: Showdown

> **English** | [Русский](#russian)

---

## English

Real-time match statistics overlay for Hunt: Showdown. Reads the game log and the NVIDIA Highlights SDK log to show kills, deaths, trades, survival rate, K/D, win rate per map, recent matches and kill-streak alerts — all on an OBS Browser Source. Every feature is free; there is no paid tier.

### How it works

```
┌──────────────┐   ┌──────────────────┐   ┌──────────────────┐
│ Game logs    │   │ Hunt Tracker     │   │ Overlay          │
│ Game.log +   │──▶│ (Electron app)   │──▶│ OBS Browser Src  │
│ GfeSDK.log   │   │ engine + WS:1040 │   │ http://…:1040/hunt│
└──────────────┘   └──────────────────┘   └──────────────────┘
```

- The **app** finds the game, tails both logs, runs the deterministic rules engine and serves the overlay over a local WebSocket/HTTP server on port `1040`.
- The **overlay** is a single HTML page that connects to that server and renders the live state. It draws nothing on its own — OBS (or any browser) just opens the URL.
- Nothing leaves your machine: both logs are read locally, the server only serves your own overlay.

### Quick start

1. Install and launch **Hunt Tracker** (Windows).
2. Open **Settings**:
   - **Paths** — click *Detect automatically*, or pick `Game.log` and the NVIDIA `GfeSDK.log` folder by hand.
   - **Overlay** — copy the overlay URL.
3. In OBS: **Add → Browser Source**, paste the URL, set the size (e.g. `280×400`), and uncheck *Shutdown source when not visible*.
4. Play a match — kills, deaths and the rest appear on the overlay.

### Overlay URLs

| Page | URL | Purpose |
|------|-----|---------|
| Main panel | `http://localhost:1040/hunt` | Full stats panel |
| Recent matches | `http://localhost:1040/hunt?show=recent` | Last games, streak, record |
| Map win rates | `http://localhost:1040/hunt?show=maps` | Win rate per map |
| Challenge goals | `http://localhost:1040/hunt?show=goal` | Goal progress bars |
| Kill-streak alerts | `http://localhost:1040/killstreak` | Alert when a rule fires |

Common query parameters: `theme` (`classic` / `slate` / `wood` / `blood`), `bga` (background opacity `0.0–1.0`), `scale`, `position`, `scope` (`session` / `mode`), `mapsPeriod` (`all` / `session`), `demo` (fake data). See [OBS_SETUP.md](OBS_SETUP.md) for the full list.

### Features

- Session stats: games, survived, lost, kills, deaths, K/D, play time
- Per-mode breakdown: Bounty Hunt / Clash / Soul Survivor
- Current match skulls: kill/death timeline
- Recent matches with outcome colours and streak / record
- Win rate per map
- Challenge goals with progress bars
- Kill-streak alerts with custom media and sound
- Four themes (Classic, Slate, Wood, Blood)
- Widget modes for separate OBS sources
- Streaming from a second PC (OBS on one machine, the tracker on another)

### Requirements

- **Windows 10/11** (the game logs are Windows-only)
- **Hunt: Showdown** installed via Steam
- **NVIDIA GeForce Experience** with Highlights enabled (for kills / deaths / trades)

### Development

```bash
npm install
npm run dev        # run the app with hot reload
npm test           # unit tests (Vitest)
npm run typecheck  # tsc for main/preload + vue-tsc for the renderer
npm run lint
npm run build:win  # package the Windows installer
```

Project layout:

```
src/main/                 Electron main process: log tailing, engine, overlay server
  hunt/                   Pure, deterministic rules engine (no I/O)
  overlayServer/          HTTP + WebSocket server on :1040
src/preload/              contextBridge API for the settings window
src/renderer/             Vue 3 + PrimeVue settings UI
resources/overlay/        The overlay pages served to OBS
```

### Releases

Releases are built manually. To publish a new version:

1. Bump the version: `npm version patch` (or `minor` / `major`), then `git push --follow-tags`.
2. In GitHub: **Actions → Build → Run workflow** (keep the `release` checkbox on).

The workflow builds the Windows installer on a Windows runner and creates a GitHub Release tagged `v<version>` with the installer attached. Uncheck `release` to only produce a build artifact without publishing.

### Privacy

- No data leaves your machine — logs are read locally, the WebSocket serves only your overlay
- No telemetry, no accounts, no cloud — fully offline
- Reads only `Game.log` and `GfeSDK.log`. See [PRIVACY.md](PRIVACY.md).

### License

GPL-3.0-or-later — see [LICENSE](LICENSE) and [NOTICE](NOTICE).

> Not affiliated with Crytek or NVIDIA. Hunt: Showdown is a trademark of Crytek.

---

<a id="russian"></a>

## Русский

Накладка (overlay) со статистикой матчей в Hunt: Showdown в реальном времени. Читает игровой лог и лог NVIDIA Highlights SDK, показывает убийства, смерти, трейды, процент выживаний, K/D, винрейт по картам, последние катки и алерты серий убийств — всё через OBS Browser Source. Все возможности бесплатны, платного тарифа нет.

### Как это работает

```
┌──────────────┐   ┌──────────────────┐   ┌──────────────────┐
│ Логи игры    │   │ Hunt Tracker     │   │ Оверлей          │
│ Game.log +   │──▶│ (Electron-       │──▶│ OBS Browser Src  │
│ GfeSDK.log   │   │  приложение)     │   │ http://…:1040/hunt│
└──────────────┘   └──────────────────┘   └──────────────────┘
```

- **Приложение** находит игру, читает оба лога, прогоняет их через детерминированный движок и отдаёт оверлей по локальному WebSocket/HTTP-серверу на порту `1040`.
- **Оверлей** — одна HTML-страница, которая подключается к этому серверу и рисует состояние в реальном времени. Сама по себе она ничего не считает — OBS (или любой браузер) просто открывает URL.
- Данные не покидают ваш компьютер: логи читаются локально, сервер отдаёт только вашему оверлею.

### Быстрый старт

1. Установите и запустите **Hunt Tracker** (Windows).
2. Откройте **Настройки**:
   - **Пути** — нажмите *Определить автоматически* либо укажите `Game.log` и папку лога NVIDIA `GfeSDK.log` вручную.
   - **Оверлей** — скопируйте URL оверлея.
3. В OBS: **Добавить → Источник «Браузер»**, вставьте URL, задайте размер (например `280×400`) и снимите галочку *«Отключать источник, когда он не виден»*.
4. Зайдите в матч — убийства, смерти и остальное появятся на оверлее.

### URL оверлеев

| Страница | URL | Назначение |
|----------|-----|------------|
| Основная панель | `http://localhost:1040/hunt` | Полная панель статистики |
| Последние катки | `http://localhost:1040/hunt?show=recent` | Последние игры, серия, рекорд |
| Винрейт по картам | `http://localhost:1040/hunt?show=maps` | Процент побед по картам |
| Челлендж-цели | `http://localhost:1040/hunt?show=goal` | Прогресс целей |
| Алерты серий | `http://localhost:1040/killstreak` | Алерт при срабатывании правила |

Основные параметры: `theme` (`classic` / `slate` / `wood` / `blood`), `bga` (прозрачность фона `0.0–1.0`), `scale`, `position`, `scope` (`session` / `mode`), `mapsPeriod` (`all` / `session`), `demo` (фейковые данные). Полный список — в [OBS_SETUP.md](OBS_SETUP.md).

### Возможности

- Статистика сессии: игры, выжил, проиграл, убийства, смерти, K/D, время
- Разбивка по режимам: Bounty Hunt / Clash / Soul Survivor
- Черепа текущего матча: таймлайн убийств/смертей
- Последние катки с цветом исхода, серия и рекорд
- Винрейт по картам
- Челлендж-цели с прогресс-барами
- Алерты серий убийств с медиа и звуком
- Четыре темы (Classic, Slate, Wood, Blood)
- Виджет-режимы для отдельных источников OBS
- Стрим с двух ПК (OBS на одном, трекер на другом)

### Требования

- **Windows 10/11** (логи игры только под Windows)
- **Hunt: Showdown** из Steam
- **NVIDIA GeForce Experience** с включёнными Highlights (для убийств/смертей/трейдов)

### Разработка

```bash
npm install
npm run dev        # запуск приложения с горячей перезагрузкой
npm test           # юнит-тесты (Vitest)
npm run typecheck  # tsc для main/preload + vue-tsc для рендерера
npm run lint
npm run build:win  # сборка установщика для Windows
```

Структура:

```
src/main/                 Главный процесс Electron: чтение логов, движок, сервер оверлея
  hunt/                   Чистый детерминированный движок правил (без I/O)
  overlayServer/          HTTP + WebSocket сервер на :1040
src/preload/              contextBridge-API для окна настроек
src/renderer/             Настройки на Vue 3 + PrimeVue
resources/overlay/        Страницы оверлея, отдаваемые в OBS
```

### Релизы

Релизы собираются вручную. Чтобы выпустить новую версию:

1. Поднимите версию: `npm version patch` (или `minor` / `major`), затем `git push --follow-tags`.
2. В GitHub: **Actions → Build → Run workflow** (галочка `release` включена).

Workflow соберёт установщик для Windows на Windows-раннере и создаст GitHub Release с тегом `v<версия>` и прикреплённым установщиком. Снимите галочку `release`, чтобы просто получить артефакт сборки без публикации.

### Приватность

- Данные не покидают ваш компьютер — логи читаются локально, WebSocket отдаёт только вашему оверлею
- Нет телеметрии, аккаунтов, облака — полностью офлайн
- Читаются только `Game.log` и `GfeSDK.log`. Подробнее — в [PRIVACY.md](PRIVACY.md).

### Лицензия

GPL-3.0-or-later — см. [LICENSE](LICENSE) и [NOTICE](NOTICE).

> Не аффилирован с Crytek или NVIDIA. Hunt: Showdown — торговая марка Crytek.
