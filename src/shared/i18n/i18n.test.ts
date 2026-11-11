import { describe, expect, it } from 'vitest'
import { DEFAULT_LANG, LANGS, LOCALES, isLang, langFromLocale, messages, translate } from './index'

describe('i18n', () => {
  it('keeps the supported language dictionaries in sync', () => {
    expect(Object.keys(messages.ru).sort()).toEqual(Object.keys(messages.en).sort())
    expect(LANGS).toEqual(['ru', 'en'])
    for (const key of Object.keys(messages.ru) as (keyof typeof messages.ru)[]) {
      const params = (value: string): string[] => [...value.matchAll(/\{([^}]+)\}/g)]
        .map((match) => match[1])
        .sort()
      expect(params(messages.en[key]), `${key} placeholder parity`).toEqual(params(messages.ru[key]))
    }
  })

  it('validates language values and maps system locales', () => {
    expect(DEFAULT_LANG).toBe('ru')
    expect(isLang('ru')).toBe(true)
    expect(isLang('en')).toBe(true)
    expect(isLang('fr')).toBe(false)
    expect(isLang(null)).toBe(false)
    expect(langFromLocale('ru_RU')).toBe('ru')
    expect(langFromLocale('RU')).toBe('ru')
    expect(langFromLocale('en-US')).toBe('en')
    expect(langFromLocale(undefined)).toBe('en')
    expect(LOCALES).toEqual({ ru: 'ru-RU', en: 'en-US' })
  })

  it('translates messages and replaces every named parameter', () => {
    expect(translate('ru', 'hunt.conn.status.readingMoments', { n: 2 })).toBe('читается · моментов: 2')
    expect(translate('en', 'hunt.conn.status.readingMoments', { n: 2 })).toBe('reading · moments: 2')
    expect(translate('en', 'hunt.goals.max', { max: 3 })).toBe('No more than 3 goals are needed.')
    expect(translate('en', 'app.title')).toBe('Hunt Tracker')
  })
})
