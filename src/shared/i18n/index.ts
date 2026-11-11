// Лёгкий i18n без зависимостей: два словаря (ru/en) и простые функции перевода.
// Модуль общий для main-процесса (оверлей-страницы, встроенные строки), renderer и тестов.

import { ru } from './ru'
import { en } from './en'

export const LANGS = ['ru', 'en'] as const
export type Lang = (typeof LANGS)[number]

/** Язык приложения, пока пользователь не выбрал другой. */
export const DEFAULT_LANG: Lang = 'ru'

/** Ключи словаря: набор задаёт `ru.ts`, `en.ts` обязан его повторять. */
export type MessageKey = keyof typeof ru

export const messages: Record<Lang, Record<MessageKey, string>> = { ru, en }

/** Локаль для `toLocaleString` / `Intl`, по языку интерфейса. */
export const LOCALES: Record<Lang, string> = { ru: 'ru-RU', en: 'en-US' }

export function isLang(v: unknown): v is Lang {
  return typeof v === 'string' && (LANGS as readonly string[]).includes(v)
}

/** Язык по локали системы: `ru*` -> ru, всё остальное -> en. */
export function langFromLocale(locale: string | null | undefined): Lang {
  return typeof locale === 'string' && /^ru\b/i.test(locale.replace('_', '-')) ? 'ru' : 'en'
}

export type MessageParams = Record<string, string | number>

/** Перевод по ключу с подстановкой `{name}`. Неизвестный ключ возвращается как есть. */
export function translate(lang: Lang, key: MessageKey, params?: MessageParams): string {
  const table = messages[lang] || messages[DEFAULT_LANG]
  let s = table[key] ?? messages[DEFAULT_LANG][key] ?? String(key)
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      s = s.split(`{${name}}`).join(String(value))
    }
  }
  return s
}
