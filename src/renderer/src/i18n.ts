// Язык интерфейса настроек: текущее значение + t(). При старте берётся язык из
// main (сохранённый выбор или локаль системы), смена сохраняется через IPC и
// рассылается оверлей-страницам.
import { ref } from 'vue'
import {
  isLang,
  translate,
  type Lang,
  type MessageKey,
  type MessageParams
} from '@shared/i18n'

const lang = ref<Lang>('ru')
let started = false

/** Применить язык к странице (атрибут lang и перерисовка текстов через t). */
const apply = (v: Lang): void => {
  lang.value = v
  document.documentElement.lang = v
  document.title = translate(v, 'app.title')
}

/** Начальный язык из main + подписка на изменения. Вызывается один раз при старте. */
export async function initI18n(): Promise<void> {
  if (started) return
  started = true
  try {
    const v = await window.electron.ipcRenderer.invoke('getLang')
    if (isLang(v)) apply(v)
  } catch {
    /* остаётся ru */
  }
  window.electron.ipcRenderer.on('lang', (_e, v: unknown) => {
    if (isLang(v)) apply(v)
  })
}

/** Выбор языка пользователем: сохраняется в main и сразу применяется здесь. */
export function setLang(v: Lang): void {
  apply(v)
  window.electron.ipcRenderer.send('setLang', v)
}

export function useI18n(): {
  t: (key: MessageKey, params?: MessageParams) => string
  lang: typeof lang
  setLang: typeof setLang
} {
  const t = (key: MessageKey, params?: MessageParams): string => translate(lang.value, key, params)
  return { t, lang, setLang }
}
