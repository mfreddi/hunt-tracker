import { ref } from 'vue'

export interface LanAddress {
  ip: string
  label: string
  virtual: boolean
}

// One request for the whole window: every overlay link shares the list.
const addresses = ref<LanAddress[] | null>(null)
let loading: Promise<void> | null = null

/** This PC's LAN IPv4 addresses (real adapters first), for OBS on a second PC. */
export function useLanAddresses() {
  const load = (): Promise<void> => {
    loading ??= window.electron.ipcRenderer
      .invoke('lanAddresses')
      .then((list: LanAddress[]) => {
        addresses.value = Array.isArray(list) ? list : []
      })
      .catch(() => {
        addresses.value = []
        loading = null // let a later open retry
      })
    return loading
  }
  return { addresses, load }
}

/** The same overlay URL, reachable from another PC on the LAN. */
export const lanUrl = (url: string, ip: string): string =>
  url.replace(/^(https?:\/\/)(localhost|127\.0\.0\.1)(?=[:/])/, `$1${ip}`)
