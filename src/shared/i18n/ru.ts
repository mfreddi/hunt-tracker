// Русские строки интерфейса. Ключи — плоские, с точечными пространствами имён.
// `en.ts` обязан содержать те же ключи (проверяется типом MessageKey).

export const ru = {
  // --- Общее ----------------------------------------------------------------
  'app.title': 'Hunt Tracker',
  'app.subtitle': 'Трекер Hunt: Showdown и оверлей для OBS',
  'app.language': 'Язык интерфейса',
  'common.test': 'Тест',
  'common.copy': 'Копировать',
  'common.copied': 'Скопировано',
  'common.clickToCopy': 'Нажми, чтобы скопировать',
  'common.default': 'По умолчанию',

  // --- Группы настроек ------------------------------------------------------
  'hunt.group.gameWindow': 'Окно поверх игры',
  'hunt.group.connection': 'Подключение игры',
  'hunt.group.session': 'Сессия',
  'hunt.group.goals': 'Челлендж-цели',
  'hunt.group.streak': 'Серия убийств',
  'hunt.group.history': 'История каток',
  'hunt.group.look': 'Вид оверлея',

  // --- Подключение игры -----------------------------------------------------
  'hunt.conn.intro':
    'Hunt Tracker собирает данные Hunt Showdown прямо на этом компьютере. Игра должна быть установлена, а Highlights включены в игре и в приложении NVIDIA. Сами моменты сохранять не нужно - достаточно, чтобы функция была включена.',
  'hunt.conn.dataFromGameTip': 'Данные из игры приходят',
  'hunt.conn.noDataTip': 'Нет данных из игры',
  'hunt.conn.trackerOn': 'трекер включён',
  'hunt.conn.trackerOff': 'трекер выключен',
  'hunt.conn.enableTracker': 'Включить трекер',
  'hunt.conn.gameData': 'Данные игры',
  'hunt.conn.combatEvents': 'События боя',
  'hunt.conn.status.notFound': 'не найден',
  'hunt.conn.status.noNvidia': 'нет связи с NVIDIA',
  'hunt.conn.status.readingMoments': 'читается · моментов: {n}',
  'hunt.conn.status.reading': 'читается',
  'hunt.conn.status.fileMissing': 'файл не появился',
  'hunt.conn.status.connecting': 'подключаемся',
  'hunt.conn.status.waitingGame': 'ждём игру',
  'hunt.conn.sdkFailedTitle': 'Игра не подключилась к NVIDIA Highlights при запуске',
  'hunt.conn.sdkFailed':
    ', поэтому убийства и смерти сейчас не считаются (игры и исходы считаются). Обычно так бывает, когда игру запускают, пока приложение NVIDIA ещё не загрузилось. Закрой игру, дождись, пока приложение NVIDIA полностью запустится, и запусти игру заново. Если не помогает — перезапусти приложение NVIDIA и проверь, что в нём включены оверлей и Highlights.',
  'hunt.conn.eventsMissing':
    'События боя не появились: включи Highlights в игре и в приложении NVIDIA (сами моменты сохранять не нужно), иначе убийства не считаются.',
  'hunt.conn.speedLabel': 'Скорость учёта убийств',
  'hunt.conn.speed.normal': 'Обычная - 3,5 с, находит размены (рекомендуется)',
  'hunt.conn.speed.fast': 'Быстро - 300 мс, возможны ложные срабатывания',
  'hunt.conn.speedHint':
    'Убийство и смерть сначала выглядят одинаково, отличить их можно только по данным игры. Обычная скорость надёжнее и находит размены, поэтому рекомендуется. В быстром режиме, если подтверждение смерти запоздает, смерть может засчитаться как убийство — бывают ложные срабатывания.',
  'hunt.conn.gamePathLabel': 'Путь к данным игры (game.log)',
  'hunt.conn.gamePathPlaceholder': 'Например, …\\Hunt Showdown 1896\\game.log',
  'hunt.conn.eventsPathLabel': 'Путь к событиям боя (NVIDIA Highlights)',
  'hunt.conn.eventsPathPlaceholder': 'Папка с событиями боя',
  'hunt.conn.detect': 'Определить автоматически',
  'hunt.conn.detectFailed': 'Не удалось выполнить поиск.',
  'hunt.conn.detectGameOk': '✓ Игра найдена',
  'hunt.conn.detectGameBad': '✗ Игра не найдена: ищем Hunt: Showdown 1896 в библиотеках Steam',
  'hunt.conn.detectEventsOk': '✓ События боя найдены',
  'hunt.conn.detectEventsBad':
    '✗ События боя не найдены: включи Highlights в игре и в приложении NVIDIA и сыграй катку',

  // --- Сессия ---------------------------------------------------------------
  'hunt.session.inGame': 'В игре',
  'hunt.session.games': 'Игр',
  'hunt.session.survived': 'Выжили',
  'hunt.session.lost': 'Не выжили',
  'hunt.session.kd': 'K / D',
  'hunt.session.trades': 'Размены',
  'hunt.session.unclassified': 'Не определено',
  'hunt.session.unclassifiedTip':
    'Не удалось отличить убийство от смерти: данные игры были недоступны',
  'hunt.session.currentMatch': 'Текущая катка:',
  'hunt.session.skulls': 'черепов: {kills}/{total}',
  'hunt.session.hint':
    'Считаются все режимы кроме Tutorial и Shooting Range. Время в игре идёт, только пока запущена игра.',
  'hunt.session.newAuto': 'Новая сессия автоматически',
  'hunt.session.gap.3': 'после 3 ч без игры',
  'hunt.session.gap.6': 'после 6 ч без игры',
  'hunt.session.gap.12': 'после 12 ч без игры',
  'hunt.session.gap.off': 'выключено — только вручную',
  'hunt.session.newBtn': 'Новая сессия',

  // --- Окно поверх игры -----------------------------------------------------
  'hunt.gov.hint':
    'Панель можно показывать прямо поверх игры, без OBS. Это прозрачное окно поверх всех окон: клики и управление остаются у игры, а в саму игру ничего не внедряется.',
  'hunt.gov.showOverGame': 'Показывать поверх игры',
  'hunt.gov.whatToShow': 'Что показывать в окне',
  'hunt.gov.source.panel': 'Вся панель',
  'hunt.gov.source.recent': 'Последние катки, серия и рекорд',
  'hunt.gov.source.goal': 'Челлендж-цели',
  'hunt.gov.source.maps': 'Винрейт по картам',
  'hunt.gov.hotkeyHintBefore': 'Горячая клавиша',
  'hunt.gov.hotkeyHintAfter':
    'включает и выключает окно прямо во время игры. Настройки «Вид оверлея» (позиция, масштаб, прозрачность, тема) действуют и здесь.',
  'hunt.gov.warnTitle': 'Важно:',
  'hunt.gov.warnBody':
    'в настройках графики игры выбери «Оконный» или «Оконный без рамки» режим. В полноэкранном (exclusive) режиме окно поверх игры не видно.',

  // --- Отдельные виджеты для OBS -------------------------------------------
  'hunt.widgets.summary': 'Отдельные виджеты для OBS',
  'hunt.widgets.hint':
    'Каждый виджет добавляется в OBS отдельным источником «Браузер» — его можно поставить и растянуть в любом месте экрана. Тема, прозрачность и масштаб общие с панелью.',
  'hunt.widgets.linkRecent': 'Последние катки, серия и рекорд',
  'hunt.widgets.linkGoal': 'Челлендж-цели',
  'hunt.widgets.linkMaps': 'Винрейт по картам',
  'hunt.widgets.periodLabel': 'Винрейт по картам считать',
  'hunt.widgets.periodAll': 'за всё время (вся история каток)',
  'hunt.widgets.periodSession': 'за текущий эфир (сессию)',
  'hunt.widgets.mapsHint':
    'Винрейт — доля выжитых каток на карте; катки без результата (игру закрыли посреди катки) не считаются. Режим берётся тот же, что и у панели.',

  // --- Челлендж-цели --------------------------------------------------------
  'hunt.goals.hint':
    'Цели показываются отдельным виджетом в OBS (ссылка — в «Отдельные виджеты для OBS» выше). Прогресс идёт за текущую сессию эфира и начинается заново с новой сессией.',
  'hunt.goals.metric.kills': 'Убийств за эфир',
  'hunt.goals.metric.survived': 'Выживаний за эфир',
  'hunt.goals.metric.games': 'Каток за эфир',
  'hunt.goals.metric.streak': 'Выживаний подряд',
  'hunt.goals.metric.bestKills': 'Убийств за одну катку',
  'hunt.goals.titlePlaceholder': 'Название (по умолчанию: {label})',
  'hunt.goals.empty': 'Целей пока нет. Например: «10 убийств за эфир» или «3 выживания подряд».',
  'hunt.goals.add': 'Добавить цель',
  'hunt.goals.max': 'Больше {max} целей не нужно.',
  'hunt.goals.remove': 'Удалить цель',

  // --- История каток --------------------------------------------------------
  'hunt.history.empty': 'Пока пусто. Каждая сыгранная катка будет появляться здесь сама.',
  'hunt.history.period.all': 'За всё время',
  'hunt.history.period.today': 'Сегодня',
  'hunt.history.period.7': '7 дней',
  'hunt.history.period.30': '30 дней',
  'hunt.history.allModes': 'Все режимы',
  'hunt.history.allMaps': 'Все карты',
  'hunt.history.gamesLabel': 'Игр',
  'hunt.history.survivedLabel': 'Выжили',
  'hunt.history.lostLabel': 'Не выжили',
  'hunt.history.kdLabel': 'K/D',
  'hunt.history.byMaps': 'По картам',
  'hunt.history.gamesCount': '{n} игр',
  'hunt.history.survivedPct': 'выжили {pct}',
  'hunt.history.kdValue': 'K/D {kd}',
  'hunt.history.outcome.survived': 'выжил',
  'hunt.history.outcome.lost': 'не выжил',
  'hunt.history.minutes': '{n} мин',
  'hunt.history.tradeShort': '· размен {n}',
  'hunt.history.noMatches': 'Под эти фильтры каток нет.',
  'hunt.history.showMore': 'Показать ещё ({n})',
  'hunt.history.csv': 'CSV',
  'hunt.history.csvSaved': 'CSV сохранён',
  'hunt.history.csvHeader': 'Начало;Конец;Режим;Карта;Итог;Убийства;Смерти;Размены',

  // --- Серия убийств --------------------------------------------------------
  'hunt.ks.hint':
    'Крупная надпись и звук на экране, когда число убийств в матче достигает числа правила (например, «Доминатор» на пятом). Показывается в своём источнике в OBS (ссылка ниже), по одному разу за матч, отдельно от алертов донатов. Число 1 — первое убийство в матче («Первая кровь»).',
  'hunt.ks.linkLabel': 'Ссылка для OBS (серия убийств)',
  'hunt.ks.enable': 'Включить серию убийств',
  'hunt.ks.rules': 'Правила ({n})',
  'hunt.ks.add': 'Добавить',
  'hunt.ks.noRules': 'Правил нет: ничего показываться не будет.',
  'hunt.ks.f.kills': 'Убийств',
  'hunt.ks.f.text': 'Текст',
  'hunt.ks.f.title': 'Надпись',
  'hunt.ks.f.color': 'Цвет',
  'hunt.ks.f.image': 'Картинка',
  'hunt.ks.f.sound': 'Звук',
  'hunt.ks.tipShowText': 'Показывать надпись (выключить: только картинка)',
  'hunt.ks.tipReplaceImage': 'Заменить картинку',
  'hunt.ks.tipChooseImage': 'Выбрать картинку, гифку или видео',
  'hunt.ks.tipRemoveImage': 'Убрать картинку',
  'hunt.ks.tipReplaceSound': 'Заменить звук',
  'hunt.ks.tipOwnSound': 'Свой звук (без него играет фанфара)',
  'hunt.ks.tipRemoveSound': 'Убрать звук: останется встроенная фанфара',
  'hunt.ks.tipRuleEnabled': 'Правило включено',
  'hunt.ks.tipShowOnStream': 'Показать на стриме',
  'hunt.ks.tipDelete': 'Удалить',
  'hunt.ks.nothing': 'Текст выключен и картинки нет: на экране ничего не появится{extra}.',
  'hunt.ks.nothingSound': ', будет только звук',
  'hunt.ks.chimeHint':
    'Без своего звука играет встроенная фанфара: чем выше правило, тем она длиннее.',
  'hunt.ks.font': 'Шрифт надписей',
  'hunt.ks.duration': 'Показывать, сек',
  'hunt.ks.position': 'Положение',
  'hunt.ks.width': 'Ширина картинки, %',
  'hunt.ks.volume': 'Громкость, %',
  'hunt.ks.newRule': 'Новая серия',
  'hunt.ks.toastTitle': 'Серия убийств',
  'hunt.ks.saveFailed': 'Не удалось сохранить',
  'hunt.ks.testNoOverlay':
    'Источник «Серия убийств» не открыт в OBS (ссылка выше), показывать негде',
  'hunt.ks.testSaveFirst': 'Сначала сохрани правило',

  // --- Смерть (алерт серии) -------------------------------------------------
  'hunt.death.head': 'Смерть',
  'hunt.death.hint': 'Надпись и звук, когда тебя убили. Работает вместе с включённой серией убийств.',
  'hunt.death.f.onscreen': 'На весь экран',
  'hunt.death.tipOnscreen':
    'Растянуть картинку на весь экран (обрезается по краям, чтобы не искажаться)',
  'hunt.death.tipSound': 'Звук смерти (без него тишина)',
  'hunt.death.tipEnabled': 'Показывать при смерти',
  'hunt.death.nothing': 'Текст выключен и картинки нет: на экране ничего не появится{extra}.',

  // --- Предпросмотр алерта --------------------------------------------------
  'alerts.preview.title': 'Предпросмотр',
  'alerts.preview.bgLight': 'Фон: светлый',
  'alerts.preview.bgDark': 'Фон: тёмный',
  'alerts.preview.bigger': 'Крупнее',
  'alerts.preview.smaller': 'Мельче',
  'alerts.preview.frameTitle': 'Предпросмотр алерта',
  'alerts.preview.hint':
    'Так алерт выглядит на экране 1920x1080. Появление и исчезновение не показываются: для этого есть кнопка «Тест».',

  // --- Ссылка на оверлей ----------------------------------------------------
  'link.twoPc': 'Стримишь с двух ПК?',
  'link.twoPcHint':
    'Запусти Hunt Tracker на игровом ПК, а в OBS на стрим-ПК вставь ссылку с адресом этого компьютера в сети. Если Windows спросит про брандмауэр — разреши доступ в частной сети.',
  'link.searching': 'Ищем адрес в сети…',
  'link.noLan': 'Компьютер не подключён к локальной сети.',

  // --- Выбор шрифта ---------------------------------------------------------
  'fonts.load': 'Шрифты этого ПК',
  'fonts.failed':
    'Не удалось получить список шрифтов (нужно разрешение) — название можно вписать вручную.',
  'fonts.unsupported': 'Список шрифтов недоступен — впиши название шрифта вручную.',
  'fonts.hint':
    'Шрифт берётся с ПК, где запущен OBS: если OBS на другом ПК, там такой шрифт должен стоять. Только что установленный шрифт OBS увидит после полного перезапуска (обновления источника мало), а приложение после перезапуска покажет его в списке.',

  // --- Вид оверлея ----------------------------------------------------------
  'look.theme': 'Тема',
  'look.theme.classic': 'Классика',
  'look.theme.slate': 'Камень',
  'look.theme.wood': 'Дерево',
  'look.theme.blood': 'Кровь — кровавый ивент',
  'look.themeHint': 'У темы свои цвета — настройки цвета ниже действуют только для «Классики».',
  'look.position': 'Позиция',
  'look.scale': 'Масштаб',
  'look.bgOpacity': 'Фон: {pct}%',
  'look.bg': 'Фон',
  'look.text': 'Текст',
  'look.accent': 'Акцент',
  'look.whatToShow': 'Что показывать',
  'look.scope.mode': 'Статистика текущего режима',
  'look.scope.session': 'За всю сессию (все режимы)',
  'look.scopeHint':
    'Статистика текущего режима переключается сама: показывается режим, в котором идёт катка, а между катками - выбранный в лобби (или последний сыгранный).',
  'look.row.duration': 'Время в игре',
  'look.row.survival': 'Выживание (вышли/не вышли)',
  'look.row.combat': 'Боевая статистика (K/D)',
  'look.row.modes': 'Сводка по режимам (когда показана вся сессия)',
  'look.row.current': 'Текущая катка',
  'look.row.recent': 'Последние катки, серия и рекорд',

  // --- Позиция панели (вид оверлея, серия убийств) --------------------------
  'pos.top-left': 'Сверху слева',
  'pos.top': 'Сверху',
  'pos.top-right': 'Сверху справа',
  'pos.center': 'По центру',
  'pos.bottom-left': 'Снизу слева',
  'pos.bottom': 'Снизу',
  'pos.bottom-right': 'Снизу справа',

  // --- Позиция алерта (серия убийств, смерть) -------------------------------
  'apos.tl': 'сверху слева',
  'apos.tc': 'сверху',
  'apos.tr': 'сверху справа',
  'apos.ml': 'по центру слева',
  'apos.mc': 'по центру',
  'apos.mr': 'по центру справа',
  'apos.bl': 'снизу слева',
  'apos.bc': 'снизу',
  'apos.br': 'снизу справа',

  // --- Оверлей-страницы (resources/overlay) ---------------------------------
  'ov.recent': 'Последние катки',
  'ov.streak': 'Серия',
  'ov.best': 'Рекорд',
  'ov.won': 'Выжил',
  'ov.lostOutcome': 'Не выжил',
  'ov.noResult': 'Без результата',
  'ov.mapsTitle': 'Винрейт по картам',
  'ov.mapsNote': 'выжил / сыграно',
  'ov.periodAll': 'за всё время',
  'ov.periodSession': 'за эфир',
  'ov.session': 'Сессия',
  'ov.games': 'Игр',
  'ov.survived': 'Выжили',
  'ov.lost': 'Не выжили',
  'ov.kills': 'Убийств',
  'ov.deaths': 'Смертей',
  'ov.dataOn': 'Данные из игры идут',
  'ov.dataOff': 'Нет данных из игры',
  'ov.currentMatch': 'Текущая катка',
  'ov.goal.kills': 'Убийств за эфир',
  'ov.goal.survived': 'Выживаний за эфир',
  'ov.goal.games': 'Каток за эфир',
  'ov.goal.streak': 'Выживаний подряд',
  'ov.goal.bestKills': 'Убийств за одну катку',

  // --- Страница алертов (resources/overlay/alerts.html) ---------------------
  'alerts.title': 'Hunt Tracker - Алерты',
  'alerts.unlockAudio': '🔇 Кликни по странице, чтобы включить звук (в OBS это не нужно)',

  // --- Встроенные строки main (серия убийств) -------------------------------
  'streak.inMatch': '{n} {word} в матче',
  'streak.defaultRule': 'Серия убийств',
  'streak.defaultDeath': 'Вы погибли',
  'streak.rule.3': 'Серия убийств',
  'streak.rule.5': 'Доминатор',
  'streak.rule.7': 'Неудержимый',
  'streak.rule.10': 'Богоподобный'
} as const
