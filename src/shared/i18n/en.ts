// English UI strings. The key set is enforced to match `ru.ts` (MessageKey).

import type { ru } from './ru'

export const en: Record<keyof typeof ru, string> = {
  // --- Common ---------------------------------------------------------------
  'app.title': 'Hunt Tracker',
  'app.subtitle': 'Hunt: Showdown tracker and OBS overlay',
  'app.language': 'Interface language',
  'common.test': 'Test',
  'common.copy': 'Copy',
  'common.copied': 'Copied',
  'common.clickToCopy': 'Click to copy',
  'common.default': 'Default',

  // --- Settings groups ------------------------------------------------------
  'hunt.group.gameWindow': 'Overlay window over the game',
  'hunt.group.connection': 'Game connection',
  'hunt.group.session': 'Session',
  'hunt.group.goals': 'Challenge goals',
  'hunt.group.streak': 'Kill streak',
  'hunt.group.history': 'Match history',
  'hunt.group.look': 'Overlay look',

  // --- Game connection ------------------------------------------------------
  'hunt.conn.intro':
    'Hunt Tracker collects Hunt: Showdown data right on this computer. The game must be installed and Highlights must be enabled in the game and in the NVIDIA app. You do not need to save the highlights themselves - it is enough for the feature to be on.',
  'hunt.conn.dataFromGameTip': 'Game data is coming in',
  'hunt.conn.noDataTip': 'No data from the game',
  'hunt.conn.trackerOn': 'tracker is on',
  'hunt.conn.trackerOff': 'tracker is off',
  'hunt.conn.enableTracker': 'Enable tracker',
  'hunt.conn.gameData': 'Game data',
  'hunt.conn.combatEvents': 'Combat events',
  'hunt.conn.status.notFound': 'not found',
  'hunt.conn.status.noNvidia': 'no NVIDIA connection',
  'hunt.conn.status.readingMoments': 'reading · moments: {n}',
  'hunt.conn.status.reading': 'reading',
  'hunt.conn.status.fileMissing': 'file did not appear',
  'hunt.conn.status.connecting': 'connecting',
  'hunt.conn.status.waitingGame': 'waiting for the game',
  'hunt.conn.sdkFailedTitle': 'The game did not connect to NVIDIA Highlights on launch',
  'hunt.conn.sdkFailed':
    ', so kills and deaths are not counted right now (games and outcomes still are). This usually happens when the game is started before the NVIDIA app has loaded. Close the game, wait for the NVIDIA app to finish loading, and start the game again. If that does not help — restart the NVIDIA app and make sure its overlay and Highlights are enabled.',
  'hunt.conn.eventsMissing':
    'Combat events did not appear: enable Highlights in the game and in the NVIDIA app (you do not need to save the highlights themselves), otherwise kills will not be counted.',
  'hunt.conn.speedLabel': 'Kill detection speed',
  'hunt.conn.speed.normal': 'Normal - 3.5 s, detects trades (recommended)',
  'hunt.conn.speed.fast': 'Fast - 300 ms, false positives possible',
  'hunt.conn.speedHint':
    'A kill and a death look the same at first; only the game data can tell them apart. Normal speed is more reliable and detects trades, so it is recommended. In fast mode, if the death confirmation is late, a death may be counted as a kill — false positives happen.',
  'hunt.conn.gamePathLabel': 'Game data path (game.log)',
  'hunt.conn.gamePathPlaceholder': 'For example, …\\Hunt Showdown 1896\\game.log',
  'hunt.conn.eventsPathLabel': 'Combat events path (NVIDIA Highlights)',
  'hunt.conn.eventsPathPlaceholder': 'Folder with combat events',
  'hunt.conn.detect': 'Detect automatically',
  'hunt.conn.detectFailed': 'The search failed.',
  'hunt.conn.detectGameOk': '✓ Game found',
  'hunt.conn.detectGameBad': '✗ Game not found: looking for Hunt: Showdown 1896 in Steam libraries',
  'hunt.conn.detectEventsOk': '✓ Combat events found',
  'hunt.conn.detectEventsBad':
    '✗ Combat events not found: enable Highlights in the game and in the NVIDIA app and play a match',

  // --- Session --------------------------------------------------------------
  'hunt.session.inGame': 'In game',
  'hunt.session.games': 'Games',
  'hunt.session.survived': 'Survived',
  'hunt.session.lost': 'Died',
  'hunt.session.kd': 'K / D',
  'hunt.session.trades': 'Trades',
  'hunt.session.unclassified': 'Unknown',
  'hunt.session.unclassifiedTip': 'Could not tell a kill from a death: game data was unavailable',
  'hunt.session.currentMatch': 'Current match:',
  'hunt.session.skulls': 'skulls: {kills}/{total}',
  'hunt.session.hint':
    'All modes are counted except Tutorial and Shooting Range. In-game time runs only while the game is running.',
  'hunt.session.newAuto': 'New session automatically',
  'hunt.session.gap.3': 'after 3 h without playing',
  'hunt.session.gap.6': 'after 6 h without playing',
  'hunt.session.gap.12': 'after 12 h without playing',
  'hunt.session.gap.off': 'off — manually only',
  'hunt.session.newBtn': 'New session',

  // --- Overlay window over the game -----------------------------------------
  'hunt.gov.hint':
    'The panel can be shown right over the game, without OBS. It is a transparent window on top of all windows: clicks and input stay with the game, and nothing is injected into the game itself.',
  'hunt.gov.showOverGame': 'Show over the game',
  'hunt.gov.whatToShow': 'What to show in the window',
  'hunt.gov.source.panel': 'Whole panel',
  'hunt.gov.source.recent': 'Recent matches, streak and best',
  'hunt.gov.source.goal': 'Challenge goals',
  'hunt.gov.source.maps': 'Win rate by map',
  'hunt.gov.hotkeyHintBefore': 'The hotkey',
  'hunt.gov.hotkeyHintAfter':
    'turns the window on and off right during the game. The "Overlay look" settings (position, scale, opacity, theme) apply here as well.',
  'hunt.gov.warnTitle': 'Important:',
  'hunt.gov.warnBody':
    'in the game\'s graphics settings choose "Windowed" or "Borderless" mode. In exclusive fullscreen the window over the game is not visible.',

  // --- Separate widgets for OBS ---------------------------------------------
  'hunt.widgets.summary': 'Separate widgets for OBS',
  'hunt.widgets.hint':
    'Each widget is added to OBS as its own "Browser" source — you can place and stretch it anywhere on screen. The theme, opacity and scale are shared with the panel.',
  'hunt.widgets.linkRecent': 'Recent matches, streak and best',
  'hunt.widgets.linkGoal': 'Challenge goals',
  'hunt.widgets.linkMaps': 'Win rate by map',
  'hunt.widgets.periodLabel': 'Count win rate by map over',
  'hunt.widgets.periodAll': 'all time (the whole match history)',
  'hunt.widgets.periodSession': 'the current stream (session)',
  'hunt.widgets.mapsHint':
    'Win rate is the share of survived matches on a map; matches without a result (the game was closed mid-match) are not counted. The mode is the same as the panel uses.',

  // --- Challenge goals ------------------------------------------------------
  'hunt.goals.hint':
    'The goals are shown as a separate widget in OBS (the link is under "Separate widgets for OBS" above). Progress runs for the current stream session and starts over with a new session.',
  'hunt.goals.metric.kills': 'Kills this stream',
  'hunt.goals.metric.survived': 'Survivals this stream',
  'hunt.goals.metric.games': 'Matches this stream',
  'hunt.goals.metric.streak': 'Survivals in a row',
  'hunt.goals.metric.bestKills': 'Kills in one match',
  'hunt.goals.titlePlaceholder': 'Title (default: {label})',
  'hunt.goals.empty': 'No goals yet. For example: "10 kills this stream" or "3 survivals in a row".',
  'hunt.goals.add': 'Add goal',
  'hunt.goals.max': 'No more than {max} goals are needed.',
  'hunt.goals.remove': 'Delete goal',

  // --- Match history --------------------------------------------------------
  'hunt.history.empty': 'Empty so far. Every match you play will appear here by itself.',
  'hunt.history.period.all': 'All time',
  'hunt.history.period.today': 'Today',
  'hunt.history.period.7': '7 days',
  'hunt.history.period.30': '30 days',
  'hunt.history.allModes': 'All modes',
  'hunt.history.allMaps': 'All maps',
  'hunt.history.gamesLabel': 'Games',
  'hunt.history.survivedLabel': 'Survived',
  'hunt.history.lostLabel': 'Died',
  'hunt.history.kdLabel': 'K/D',
  'hunt.history.byMaps': 'By map',
  'hunt.history.gamesCount': '{n} games',
  'hunt.history.survivedPct': 'survived {pct}',
  'hunt.history.kdValue': 'K/D {kd}',
  'hunt.history.outcome.survived': 'survived',
  'hunt.history.outcome.lost': 'died',
  'hunt.history.minutes': '{n} min',
  'hunt.history.tradeShort': '· trade {n}',
  'hunt.history.noMatches': 'No matches under these filters.',
  'hunt.history.showMore': 'Show more ({n})',
  'hunt.history.csv': 'CSV',
  'hunt.history.csvSaved': 'CSV saved',
  'hunt.history.csvHeader': 'Start;End;Mode;Map;Outcome;Kills;Deaths;Trades',

  // --- Kill streak ----------------------------------------------------------
  'hunt.ks.hint':
    'A big title and a sound on screen when the kills of a match reach the number of a rule (for example "Dominator" at five). It is shown in its own OBS source (link below), once per match, separately from the donation alerts. Number 1 is the first kill of the match ("First blood").',
  'hunt.ks.linkLabel': 'OBS link (kill streak)',
  'hunt.ks.enable': 'Enable kill streak',
  'hunt.ks.rules': 'Rules ({n})',
  'hunt.ks.add': 'Add',
  'hunt.ks.noRules': 'No rules: nothing will be shown.',
  'hunt.ks.f.kills': 'Kills',
  'hunt.ks.f.text': 'Text',
  'hunt.ks.f.title': 'Title',
  'hunt.ks.f.color': 'Color',
  'hunt.ks.f.image': 'Image',
  'hunt.ks.f.sound': 'Sound',
  'hunt.ks.tipShowText': 'Show the title (turn off: image only)',
  'hunt.ks.tipReplaceImage': 'Replace the image',
  'hunt.ks.tipChooseImage': 'Choose an image, gif or video',
  'hunt.ks.tipRemoveImage': 'Remove the image',
  'hunt.ks.tipReplaceSound': 'Replace the sound',
  'hunt.ks.tipOwnSound': 'Your own sound (otherwise a fanfare plays)',
  'hunt.ks.tipRemoveSound': 'Remove the sound: the built-in fanfare stays',
  'hunt.ks.tipRuleEnabled': 'Rule is on',
  'hunt.ks.tipShowOnStream': 'Show on stream',
  'hunt.ks.tipDelete': 'Delete',
  'hunt.ks.nothing': 'The text is off and there is no image: nothing will appear{extra}.',
  'hunt.ks.nothingSound': ', only sound',
  'hunt.ks.chimeHint':
    'Without your own sound the built-in fanfare plays: the higher the rule, the longer it is.',
  'hunt.ks.font': 'Title font',
  'hunt.ks.duration': 'Show, sec',
  'hunt.ks.position': 'Position',
  'hunt.ks.width': 'Image width, %',
  'hunt.ks.volume': 'Volume, %',
  'hunt.ks.newRule': 'New streak',
  'hunt.ks.toastTitle': 'Kill streak',
  'hunt.ks.saveFailed': 'Could not save',
  'hunt.ks.testNoOverlay': 'The "Kill streak" source is not open in OBS (link above), nowhere to show',
  'hunt.ks.testSaveFirst': 'Save the rule first',

  // --- Death (streak alert) -------------------------------------------------
  'hunt.death.head': 'Death',
  'hunt.death.hint': 'A title and a sound when you are killed. Works together with the kill streak being on.',
  'hunt.death.f.onscreen': 'Full screen',
  'hunt.death.tipOnscreen':
    'Stretch the image over the whole screen (cropped at the edges so it is not distorted)',
  'hunt.death.tipSound': 'Death sound (without it, silence)',
  'hunt.death.tipEnabled': 'Show on death',
  'hunt.death.nothing': 'The text is off and there is no image: nothing will appear{extra}.',

  // --- Alert preview --------------------------------------------------------
  'alerts.preview.title': 'Preview',
  'alerts.preview.bgLight': 'Background: light',
  'alerts.preview.bgDark': 'Background: dark',
  'alerts.preview.bigger': 'Bigger',
  'alerts.preview.smaller': 'Smaller',
  'alerts.preview.frameTitle': 'Alert preview',
  'alerts.preview.hint':
    'This is how the alert looks on a 1920x1080 screen. The appear and disappear animations are not shown: use the "Test" button for that.',

  // --- Overlay link ---------------------------------------------------------
  'link.twoPc': 'Streaming from two PCs?',
  'link.twoPcHint':
    'Run Hunt Tracker on the gaming PC, and in OBS on the streaming PC paste the link with the network address of this computer. If Windows asks about the firewall — allow access on the private network.',
  'link.searching': 'Looking for a network address…',
  'link.noLan': 'The computer is not connected to a local network.',

  // --- Font picker ----------------------------------------------------------
  'fonts.load': 'Fonts of this PC',
  'fonts.failed':
    'Could not get the font list (permission needed) — you can type the name by hand.',
  'fonts.unsupported': 'The font list is unavailable — type the font name by hand.',
  'fonts.hint':
    'The font comes from the PC where OBS runs: if OBS is on another PC, that font must be installed there. A font installed just now is seen by OBS after a full restart (reloading the source is not enough), and by the app after a restart.',

  // --- Overlay look ---------------------------------------------------------
  'look.theme': 'Theme',
  'look.theme.classic': 'Classic',
  'look.theme.slate': 'Slate',
  'look.theme.wood': 'Wood',
  'look.theme.blood': 'Blood — the blood event',
  'look.themeHint': 'The theme has its own colors — the color settings below apply to "Classic" only.',
  'look.position': 'Position',
  'look.scale': 'Scale',
  'look.bgOpacity': 'Background: {pct}%',
  'look.bg': 'Background',
  'look.text': 'Text',
  'look.accent': 'Accent',
  'look.whatToShow': 'What to show',
  'look.scope.mode': 'Stats of the current mode',
  'look.scope.session': 'Whole session (all modes)',
  'look.scopeHint':
    'The current-mode stats switch by themselves: the mode being played is shown, and between matches - the one chosen in the lobby (or the last played).',
  'look.row.duration': 'Time in game',
  'look.row.survival': 'Survival (survived/died)',
  'look.row.combat': 'Combat stats (K/D)',
  'look.row.modes': 'Per-mode summary (when the whole session is shown)',
  'look.row.current': 'Current match',
  'look.row.recent': 'Recent matches, streak and best',

  // --- Panel position (overlay look, kill streak) ---------------------------
  'pos.top-left': 'Top left',
  'pos.top': 'Top',
  'pos.top-right': 'Top right',
  'pos.center': 'Center',
  'pos.bottom-left': 'Bottom left',
  'pos.bottom': 'Bottom',
  'pos.bottom-right': 'Bottom right',

  // --- Alert position (kill streak, death) ----------------------------------
  'apos.tl': 'top left',
  'apos.tc': 'top',
  'apos.tr': 'top right',
  'apos.ml': 'middle left',
  'apos.mc': 'middle',
  'apos.mr': 'middle right',
  'apos.bl': 'bottom left',
  'apos.bc': 'bottom',
  'apos.br': 'bottom right',

  // --- Overlay pages (resources/overlay) ------------------------------------
  'ov.recent': 'Recent matches',
  'ov.streak': 'Streak',
  'ov.best': 'Best',
  'ov.won': 'Survived',
  'ov.lostOutcome': 'Died',
  'ov.noResult': 'No result',
  'ov.mapsTitle': 'Win rate by map',
  'ov.mapsNote': 'survived / played',
  'ov.periodAll': 'all time',
  'ov.periodSession': 'this stream',
  'ov.session': 'Session',
  'ov.games': 'Games',
  'ov.survived': 'Survived',
  'ov.lost': 'Died',
  'ov.kills': 'Kills',
  'ov.deaths': 'Deaths',
  'ov.dataOn': 'Game data is coming in',
  'ov.dataOff': 'No data from the game',
  'ov.currentMatch': 'Current match',
  'ov.goal.kills': 'Kills this stream',
  'ov.goal.survived': 'Survivals this stream',
  'ov.goal.games': 'Matches this stream',
  'ov.goal.streak': 'Survivals in a row',
  'ov.goal.bestKills': 'Kills in one match',

  // --- Alerts page (resources/overlay/alerts.html) --------------------------
  'alerts.title': 'Hunt Tracker - Alerts',
  'alerts.unlockAudio': '🔇 Click the page to enable sound (not needed in OBS)',

  // --- Built-in main-process strings (kill streak) --------------------------
  'streak.inMatch': '{n} {word} in the match',
  'streak.defaultRule': 'Kill streak',
  'streak.defaultDeath': 'You died',
  'streak.rule.3': 'Kill streak',
  'streak.rule.5': 'Dominator',
  'streak.rule.7': 'Unstoppable',
  'streak.rule.10': 'Godlike'
}
