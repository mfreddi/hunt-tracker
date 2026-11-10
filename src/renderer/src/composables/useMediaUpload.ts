import { ref } from 'vue'
import { useToast } from 'primevue/usetoast'

export function useMediaUpload() {
  const toast = useToast()
  const busy = ref(false)

  const upload = async (file: File, kind?: 'video'): Promise<string | null> => {
    busy.value = true
    try {
      const data = await file.arrayBuffer()
      const resp = await window.electron.ipcRenderer.invoke('saveOverlayMedia', {
        name: file.name,
        data,
        kind
      })
      if (resp?.error) {
        toast.add({
          severity: 'error',
          summary: resp.error,
          detail: resp.error_description,
          life: 4000
        })
        return null
      }
      return resp?.url || null
    } finally {
      busy.value = false
    }
  }

  return { busy, upload }
}
