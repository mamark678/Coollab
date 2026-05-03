import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

// Typed IPC channels — all renderer↔main communication goes through these
export type IpcChannel =
  | 'window:minimize'
  | 'window:maximize'
  | 'window:close'
  | 'window:focus'
  | 'app:ready'
  | 'auth:google-login'
  | 'auth:google-result'
  | 'canvas:open-image-dialog'
  | 'screen:capture'
  | 'fs:delete-temp-file'

console.log('[Preload] Preload script is running');

type IpcListener = (event: IpcRendererEvent, ...args: unknown[]) => void

const electronApi = {
  send: (channel: IpcChannel, ...args: unknown[]): void => {
    ipcRenderer.send(channel, ...args)
  },

  on: (channel: IpcChannel, listener: IpcListener): (() => void) => {
    ipcRenderer.on(channel, listener)
    // Return a cleanup function so callers can unsubscribe
    return () => ipcRenderer.removeListener(channel, listener)
  },

  invoke: (channel: IpcChannel, ...args: unknown[]): Promise<unknown> => {
    return ipcRenderer.invoke(channel, ...args)
  },
}

console.log('[Preload] Exposing electronAPI to main world...');
contextBridge.exposeInMainWorld('electronAPI', electronApi)

// Type the window.electronAPI global for the renderer-side TypeScript
export type ElectronApi = typeof electronApi
