/**
 * VigilExam - Kiosk Lockdown Manager
 * 
 * Implements strict Electron fullscreen lockdown, topmost enforcement ('screen-saver'),
 * prevention of window minimize/close/resize/escape, keyboard shortcuts interception,
 * navigation denial, and blur tracking.
 */

import { Menu, app } from 'electron';

class KioskManager {
  constructor() {
    this.isKioskActive = false;
    this.mainWindow = null;
    this.defaultMenu = null;
    this.exitAttemptListeners = new Set();
  }

  setWindow(win) {
    this.mainWindow = win;
    this.defaultMenu = Menu.getApplicationMenu();
    this.setupWindowListeners();
  }

  setupWindowListeners() {
    if (!this.mainWindow) return;

    // 1. Block unauthorized new windows
    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      console.warn(`[KioskManager] Blocked window.open attempt: ${url}`);
      return { action: 'deny' };
    });

    // 2. Prevent navigation away from exam UI
    this.mainWindow.webContents.on('will-navigate', (event, url) => {
      if (url.startsWith('http://localhost:5173') || url.startsWith('file://')) {
        return;
      }
      event.preventDefault();
      console.warn(`[KioskManager] Blocked navigation attempt to: ${url}`);
    });

    // 3. Intercept window close attempt during active kiosk
    this.mainWindow.on('close', (e) => {
      if (this.isKioskActive) {
        e.preventDefault();
        console.warn('[KioskManager] Intercepted window close attempt during exam');
        this.emitExitAttempt('window_close_attempt');
        return false;
      }
    });

    // 4. Intercept window minimize attempt during active kiosk
    this.mainWindow.on('minimize', (e) => {
      if (this.isKioskActive) {
        e.preventDefault();
        this.mainWindow.restore();
        this.mainWindow.focus();
        console.warn('[KioskManager] Intercepted minimize attempt; restoring focus');
        this.emitExitAttempt('window_minimize_attempt');
      }
    });

    // 5. Intercept leaving fullscreen during active kiosk
    this.mainWindow.on('leave-full-screen', () => {
      if (this.isKioskActive) {
        this.mainWindow.setFullScreen(true);
        this.mainWindow.setKiosk(true);
        console.warn('[KioskManager] Restored fullscreen from leave-full-screen trigger');
        this.emitExitAttempt('fullscreen_lost');
      }
    });

    // 6. Window focus loss detection (blur) & aggressive re-focus
    this.mainWindow.on('blur', () => {
      if (this.isKioskActive && this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('window-blur-event', {
          timestamp: new Date().toISOString()
        });

        // Aggressively re-focus window
        setTimeout(() => {
          if (this.isKioskActive && this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.focus();
          }
        }, 50);
      }
    });

    this.mainWindow.on('focus', () => {
      if (this.isKioskActive && this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('window-focus-event', {
          timestamp: new Date().toISOString()
        });
      }
    });

    // 7. Keyboard & input event interception at browser window level
    this.mainWindow.webContents.on('before-input-event', (event, input) => {
      if (!this.isKioskActive) return;
      if (input.type !== 'keyDown') return;

      const key = (input.key || '').toLowerCase();
      const mod = input.control || input.meta;

      // Block Developer Tools shortcuts
      if (key === 'f12' || (mod && input.shift && (key === 'i' || key === 'j')) || (mod && key === 'u')) {
        event.preventDefault();
        return;
      }

      // Block F11 fullscreen toggle escape
      if (key === 'f11') {
        event.preventDefault();
        return;
      }

      // Block Alt+Tab, Alt+Esc, Ctrl+Esc where caught
      if (input.alt && (key === 'tab' || key === 'escape')) {
        event.preventDefault();
        this.emitExitAttempt('alt_tab_attempt');
        return;
      }
      if (input.control && key === 'escape') {
        event.preventDefault();
        this.emitExitAttempt('ctrl_esc_attempt');
        return;
      }

      // Clipboard shortcuts: Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A, Insert combos
      const isCopy = (mod && key === 'c') || (input.control && key === 'insert');
      const isPaste = (mod && key === 'v') || (input.shift && key === 'insert');
      const isCut = mod && key === 'x';
      const isSelectAll = mod && key === 'a';

      let blockedAction = null;
      if (isPaste) blockedAction = 'PASTE_ATTEMPT';
      else if (isCopy) blockedAction = 'COPY_ATTEMPT';
      else if (isCut) blockedAction = 'CUT_ATTEMPT';
      else if (isSelectAll) blockedAction = 'SELECT_ALL_ATTEMPT';

      if (blockedAction) {
        event.preventDefault();
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('exam-shortcut-blocked', {
            type: blockedAction,
            key: input.key,
            source: 'keyboard',
            timestamp: new Date().toISOString()
          });
        }
      }
    });

    // 8. Intercept browser context menu
    this.mainWindow.webContents.on('context-menu', (event) => {
      if (this.isKioskActive) {
        event.preventDefault();
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('exam-shortcut-blocked', {
            type: 'CLIPBOARD_ACCESS_ATTEMPT',
            source: 'context_menu',
            timestamp: new Date().toISOString()
          });
        }
      }
    });
  }

  enableKioskLockdown() {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return { success: false, error: 'Window not available' };
    }

    try {
      this.isKioskActive = true;
      this.mainWindow.setKiosk(true);
      this.mainWindow.setFullScreen(true);
      this.mainWindow.setAlwaysOnTop(true, 'screen-saver');
      this.mainWindow.setResizable(false);
      this.mainWindow.setMinimizable(false);
      this.mainWindow.setClosable(false);
      this.mainWindow.setAutoHideMenuBar(true);
      this.mainWindow.setMenuBarVisibility(false);
      Menu.setApplicationMenu(null);
      this.mainWindow.focus();

      if (app.isPackaged) {
        this.mainWindow.webContents.closeDevTools();
      }

      console.info('[KioskManager] Strict Fullscreen Exam Kiosk Lockdown enabled');
      return { success: true, kiosk: true };
    } catch (err) {
      console.error('[KioskManager] Failed to enable kiosk mode:', err);
      return { success: false, error: err.message };
    }
  }

  disableKioskLockdown() {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return { success: false };
    }

    try {
      this.isKioskActive = false;
      this.mainWindow.setKiosk(false);
      this.mainWindow.setFullScreen(false);
      this.mainWindow.setAlwaysOnTop(false);
      this.mainWindow.setResizable(true);
      this.mainWindow.setMinimizable(true);
      this.mainWindow.setClosable(true);
      this.mainWindow.setAutoHideMenuBar(false);
      this.mainWindow.setMenuBarVisibility(true);
      if (this.defaultMenu) {
        Menu.setApplicationMenu(this.defaultMenu);
      }
      console.info('[KioskManager] Kiosk Lockdown deactivated');
      return { success: true, kiosk: false };
    } catch (err) {
      console.error('[KioskManager] Failed to disable kiosk mode:', err);
      return { success: false, error: err.message };
    }
  }

  getKioskState() {
    return {
      active: this.isKioskActive,
      isFullScreen: this.mainWindow ? this.mainWindow.isFullScreen() : false,
      isAlwaysOnTop: this.mainWindow ? this.mainWindow.isAlwaysOnTop() : false
    };
  }

  emitExitAttempt(action) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('kiosk-exit-attempt', {
        action,
        timestamp: new Date().toISOString()
      });
    }
  }
}

export const kioskManager = new KioskManager();
