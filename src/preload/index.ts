import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// The settings window talks to the app through `window.electron.ipcRenderer` (the API the renderer
// components were written against) and reads the current state off the overlay websocket on :1040.

const api = {}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
