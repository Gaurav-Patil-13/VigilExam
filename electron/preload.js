/**
 * VigilExam - Secure Preload Bridge
 * 
 * Exposes strictly controlled desktop capabilities through contextBridge.
 * Follows Electron security best practices: contextIsolation enabled, nodeIntegration disabled.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vigilNative', {
  isDesktopApp: true,
  isPackagedApp: (() => {
    try {
      return ipcRenderer.sendSync('is-packaged-sync');
    } catch (e) {
      return false;
    }
  })(),

  // Process Monitoring & Audit APIs
  scanProcesses: () => ipcRenderer.invoke('audit-processes'),
  getSuspiciousProcesses: () => ipcRenderer.invoke('get-suspicious-processes'),
  captureProcessBaseline: () => ipcRenderer.invoke('capture-process-baseline'),
  startProcessMonitoring: (intervalMs) => ipcRenderer.invoke('start-process-monitoring', intervalMs),
  stopProcessMonitoring: () => ipcRenderer.invoke('stop-process-monitoring'),
  terminateApprovedProcess: (pid, name) => ipcRenderer.invoke('terminate-approved-process', pid, name),
  closeApplication: (pid, name) => ipcRenderer.invoke('terminate-approved-process', pid, name),
  closeNonEssentialApplications: () => ipcRenderer.invoke('close-non-essential-apps'),

  // Display Configuration APIs
  getDisplays: () => ipcRenderer.invoke('get-display-info'),

  // Kiosk Lockdown APIs
  enableKioskMode: () => ipcRenderer.invoke('enable-kiosk-mode'),
  disableKioskMode: () => ipcRenderer.invoke('disable-kiosk-mode'),
  getKioskState: () => ipcRenderer.invoke('get-kiosk-state'),

  // System Diagnostics
  getSystemDiagnostics: () => ipcRenderer.invoke('get-system-diagnostics'),

  // Clipboard Security
  setExamClipboardSecurity: (options) => ipcRenderer.invoke('set-exam-clipboard-security', options),

  // Push Event Listeners
  onKioskExitAttempt: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('kiosk-exit-attempt', handler);
    return () => ipcRenderer.removeListener('kiosk-exit-attempt', handler);
  },

  onDisplayConfigurationChanged: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('display-configuration-changed', handler);
    return () => ipcRenderer.removeListener('display-configuration-changed', handler);
  },

  onWindowBlur: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('window-blur-event', handler);
    return () => ipcRenderer.removeListener('window-blur-event', handler);
  },

  onWindowFocus: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('window-focus-event', handler);
    return () => ipcRenderer.removeListener('window-focus-event', handler);
  },

  onShortcutBlocked: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('exam-shortcut-blocked', handler);
    return () => ipcRenderer.removeListener('exam-shortcut-blocked', handler);
  },

  onProcessViolation: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('process-violation-event', handler);
    return () => ipcRenderer.removeListener('process-violation-event', handler);
  },

  onExamClipboardSecurityState: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('exam-clipboard-security-state', handler);
    return () => ipcRenderer.removeListener('exam-clipboard-security-state', handler);
  }
});
