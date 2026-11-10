import { ref } from 'vue'

// Font families installed on THIS PC, for the font dropdowns of the overlay settings. Uses Chromium's
// queryLocalFonts() (Electron 28), which must be started by a click. Where it is missing or refused the
// dropdowns still let the streamer type a family name by hand. The list is loaded once per window.
const fonts = ref<string[]>([])
const loaded = ref(false)
const busy = ref(false)
const failed = ref(false)

export function useSystemFonts() {
  const supported = typeof (window as any).queryLocalFonts === 'function'

  const load = async (): Promise<void> => {
    if (loaded.value || busy.value || !supported) return
    busy.value = true
    failed.value = false
    try {
      const all: { family: string }[] = await (window as any).queryLocalFonts()
      fonts.value = Array.from(new Set(all.map((f) => f.family).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      )
      loaded.value = true
    } catch {
      failed.value = true
    } finally {
      busy.value = false
    }
  }

  return { fonts, loaded, busy, failed, supported, load }
}
