import { contextBridge, ipcRenderer } from 'electron';

// Track trusted exam security state from main process
let examActive = false;
let currentPolicy = null;

ipcRenderer.on('exam-clipboard-security-state', (_event, state) => {
  if (typeof state === 'boolean') {
    examActive = state;
  } else if (state && typeof state === 'object') {
    examActive = Boolean(state.active);
    currentPolicy = state.policy || null;
  }
});

// Blocked proxy for navigator.clipboard during active exam
const blockedClipboardProxy = {
  read: () => Promise.reject(new DOMException('Clipboard access is disabled during this examination.', 'NotAllowedError')),
  readText: () => Promise.reject(new DOMException('Clipboard access is disabled during this examination.', 'NotAllowedError')),
  write: () => Promise.reject(new DOMException('Clipboard access is disabled during this examination.', 'NotAllowedError')),
  writeText: () => Promise.reject(new DOMException('Clipboard access is disabled during this examination.', 'NotAllowedError')),
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false
};

// Protect Chromium navigator.clipboard API
const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, 'clipboard');
if (originalClipboardDescriptor?.configurable) {
  Object.defineProperty(Navigator.prototype, 'clipboard', {
    configurable: false,
    enumerable: originalClipboardDescriptor.enumerable,
    get() {
      if (examActive) {
        return blockedClipboardProxy;
      }
      return originalClipboardDescriptor.get ? originalClipboardDescriptor.get.call(this) : undefined;
    }
  });
}

// Protect document.execCommand fallback from copy/cut/paste bypass
const originalExecCommand = Document.prototype.execCommand;
Document.prototype.execCommand = function (command, ...args) {
  if (examActive) {
    const cmd = String(command).toLowerCase();
    if (cmd === 'copy' || cmd === 'cut' || cmd === 'paste') {
      return false;
    }
  }
  return originalExecCommand.apply(this, [command, ...args]);
};

// Narrowly scoped native bridge API.
// Note: Electron's clipboard module and generic Node.js APIs are NEVER exposed to the renderer.
contextBridge.exposeInMainWorld('vigilNative', {
  getSystemDiagnostics: () => ipcRenderer.invoke('get-system-diagnostics'),
  scanActiveProcesses: () => ipcRenderer.invoke('scan-active-processes'),
  enableKioskMode: () => ipcRenderer.invoke('enable-kiosk-mode'),
  disableKioskMode: () => ipcRenderer.invoke('disable-kiosk-mode'),
  setExamClipboardSecurity: (options) => ipcRenderer.invoke('set-exam-clipboard-security', options),
  getExamClipboardSecurity: () => ipcRenderer.invoke('get-exam-clipboard-security'),
  onShortcutBlocked: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('exam-shortcut-blocked', listener);
    return () => ipcRenderer.removeListener('exam-shortcut-blocked', listener);
  },
  onClipboardSecurityState: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('exam-clipboard-security-state', listener);
    return () => ipcRenderer.removeListener('exam-clipboard-security-state', listener);
  },
  isDesktopApp: true
});
