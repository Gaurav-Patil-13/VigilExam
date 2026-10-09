/**
 * VigilExam - Display Monitor Service
 * 
 * Verifies single-monitor policy and detects dynamic secondary display attachments during exam.
 */

import { screen } from 'electron';

class DisplayMonitor {
  constructor() {
    this.mainWindow = null;
    this.isListening = false;
  }

  setWindow(win) {
    this.mainWindow = win;
    this.initListeners();
  }

  getDisplays() {
    try {
      const displays = screen.getAllDisplays();
      return {
        success: true,
        displayCount: displays.length,
        isSingleDisplay: displays.length === 1,
        displays: displays.map((d) => ({
          id: d.id,
          bounds: d.bounds,
          scaleFactor: d.scaleFactor,
          isPrimary: d.id === screen.getPrimaryDisplay()?.id
        }))
      };
    } catch (err) {
      return {
        success: false,
        displayCount: 1,
        isSingleDisplay: true,
        displays: []
      };
    }
  }

  initListeners() {
    if (this.isListening) return;
    this.isListening = true;

    screen.on('display-added', (event, newDisplay) => {
      const count = screen.getAllDisplays().length;
      console.warn(`[DisplayMonitor] Secondary display connected! Total: ${count}`);
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('display-configuration-changed', {
          type: 'MULTIPLE_DISPLAY_CONNECTED',
          displayCount: count,
          newDisplayId: newDisplay.id,
          timestamp: new Date().toISOString()
        });
      }
    });

    screen.on('display-removed', (event, oldDisplay) => {
      const count = screen.getAllDisplays().length;
      console.info(`[DisplayMonitor] Display removed. Total: ${count}`);
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('display-configuration-changed', {
          type: 'DISPLAY_REMOVED',
          displayCount: count,
          removedDisplayId: oldDisplay.id,
          timestamp: new Date().toISOString()
        });
      }
    });
  }
}

export const displayMonitor = new DisplayMonitor();
