import { app, BrowserWindow, ipcMain, screen, clipboard, Menu } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";
import { processMonitor } from "./processMonitor.js";
import { kioskManager } from "./kioskManager.js";
import { displayMonitor } from "./displayMonitor.js";
import { systemMonitor } from "./systemMonitor.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let defaultAppMenu = null;
let examClipboardSecurityActive = false;

const DEFAULT_CLIPBOARD_POLICY = {
  block_copy: true,
  block_paste: true,
  block_cut: true,
  block_context_menu: true,
  block_drag_drop: true,
  clear_clipboard_on_exam_start: true,
  clear_clipboard_on_exam_end: true,
  log_attempts: true,
};

let currentClipboardPolicy = { ...DEFAULT_CLIPBOARD_POLICY };

// Asynchronous embedded backend launcher for production packaged mode
let serverReadyPromise = null;

async function ensureEmbeddedServer() {
  if (app.isPackaged) {
    if (!serverReadyPromise) {
      serverReadyPromise = (async () => {
        try {
          process.env.PORT = "4000";
          const srv = await import("../server/index.js");
          if (srv.startServer) {
            await srv.startServer(4000);
          }
          console.info(
            "[ElectronLifecycle] Embedded Express & Socket.io server ready on port 4000",
          );
        } catch (err) {
          console.warn(
            "[ElectronLifecycle] Embedded server start warning:",
            err.message,
          );
        }
      })();
    }
    await serverReadyPromise;
  }
}

/**
 * Normalizes input policy and activates/deactivates system-level clipboard security.
 * NEVER stores or transmits clipboard contents.
 */
function setExamClipboardSecurity(options) {
  let active = false;
  let policy = { ...DEFAULT_CLIPBOARD_POLICY };

  if (typeof options === "boolean") {
    active = options;
  } else if (options && typeof options === "object") {
    active = Boolean(options.active);
    if (options.policy) {
      policy = {
        ...DEFAULT_CLIPBOARD_POLICY,
        ...options.policy,
      };
    }
  }

  currentClipboardPolicy = policy;

  if (active) {
    examClipboardSecurityActive = true;
    if (policy.clear_clipboard_on_exam_start) {
      clipboard.clear();
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setMenu(null);
      Menu.setApplicationMenu(null);
      mainWindow.webContents.send("exam-clipboard-security-state", {
        active: true,
        policy: currentClipboardPolicy,
      });
    }
    console.info("[ClipboardSecurity] Activated with strict policy");
  } else {
    examClipboardSecurityActive = false;
    if (policy.clear_clipboard_on_exam_end) {
      clipboard.clear();
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setMenu(defaultAppMenu);
      Menu.setApplicationMenu(defaultAppMenu);
      mainWindow.webContents.send("exam-clipboard-security-state", {
        active: false,
        policy: currentClipboardPolicy,
      });
    }
    console.info("[ClipboardSecurity] Deactivated; normal menu restored");
  }

  return {
    active: examClipboardSecurityActive,
    policy: currentClipboardPolicy,
  };
}

// --------------------------------------------------
// CREATE ELECTRON WINDOW
// --------------------------------------------------

function createWindow() {
  defaultAppMenu = Menu.getApplicationMenu();

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 700,
    title: "VigilExam - Secure Online Examination & Proctoring System",
    autoHideMenuBar: true,
    backgroundColor: "#080C14",

    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      devTools: !app.isPackaged,
    },
  });

  // Register main window with managers
  kioskManager.setWindow(mainWindow);
  displayMonitor.setWindow(mainWindow);
  processMonitor.registerVigilPid(process.pid);
  if (mainWindow.webContents.getOSProcessId) {
    processMonitor.registerVigilPid(mainWindow.webContents.getOSProcessId());
  }

  // Forward process watcher violations directly to renderer
  processMonitor.eventListeners.add((event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("process-violation-event", event);
    }
  });

  console.info("[ElectronLifecycle] BrowserWindow created", {
    pid: process.pid,
    packaged: app.isPackaged,
  });

  // Packaged EXE
  if (app.isPackaged) {
    const indexPath = path.join(app.getAppPath(), "dist", "index.html");
    console.log("Loading production UI:", indexPath);
    mainWindow.loadFile(indexPath).catch((error) => {
      console.error("Failed to load production UI:", error);
    });
  } else {
    // Development
    const devUrl = "http://localhost:5173";
    console.log("Loading development UI:", devUrl);
    mainWindow.loadURL(devUrl).catch((error) => {
      console.error("Failed to load Vite:", error);
    });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
    processMonitor.stopProcessMonitoring();
  });
}

// --------------------------------------------------
// IPC HANDLERS
// --------------------------------------------------

// Process Audit & Monitoring
ipcMain.handle("audit-processes", async () => {
  return await processMonitor.scanProcesses();
});

ipcMain.handle("get-suspicious-processes", async () => {
  return await processMonitor.getSuspiciousProcesses();
});

ipcMain.handle("capture-process-baseline", async () => {
  return await processMonitor.captureBaseline();
});

ipcMain.handle("start-process-monitoring", async (_event, intervalMs) => {
  processMonitor.startProcessMonitoring(intervalMs || 1500);
  return { success: true };
});

ipcMain.handle("stop-process-monitoring", async () => {
  processMonitor.stopProcessMonitoring();
  return { success: true };
});

ipcMain.handle("terminate-approved-process", async (_event, pid, name) => {
  return await processMonitor.terminateApprovedProcess(pid, name);
});

ipcMain.handle("close-non-essential-apps", async () => {
  return await processMonitor.closeNonEssentialApplications();
});

ipcMain.handle("close-all-prohibited-apps", async () => {
  return await processMonitor.closeAllProhibitedApplications();
});

// Display APIs
ipcMain.handle("get-display-info", async () => {
  return displayMonitor.getDisplays();
});

// Kiosk Lockdown APIs
ipcMain.handle("enable-kiosk-mode", async () => {
  return kioskManager.enableKioskLockdown();
});

ipcMain.handle("disable-kiosk-mode", async () => {
  return kioskManager.disableKioskLockdown();
});

ipcMain.handle("get-kiosk-state", async () => {
  return kioskManager.getKioskState();
});

// System Diagnostics
ipcMain.handle("get-system-diagnostics", async () => {
  return systemMonitor.getDiagnostics();
});

// Clipboard Security
ipcMain.handle("set-exam-clipboard-security", async (_event, options) => {
  return setExamClipboardSecurity(options);
});

// App Environment Sync
ipcMain.on("is-packaged-sync", (event) => {
  event.returnValue = app.isPackaged;
});

// --------------------------------------------------
// APP LIFECYCLE
// --------------------------------------------------

app.whenReady().then(async () => {
  await ensureEmbeddedServer();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  processMonitor.stopProcessMonitoring();
  if (process.platform !== "darwin") {
    app.quit();
  }
});
