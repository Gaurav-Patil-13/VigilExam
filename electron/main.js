import { app, BrowserWindow, ipcMain, screen, clipboard, Menu } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import os from "os";

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
      // Disable the application menu and window menu
      mainWindow.setMenu(null);
      Menu.setApplicationMenu(null);
      mainWindow.webContents.send("exam-clipboard-security-state", {
        active: true,
        policy: currentClipboardPolicy,
      });
    }
    console.info("Exam clipboard security activated with strict policy");
  } else {
    examClipboardSecurityActive = false;
    if (policy.clear_clipboard_on_exam_end) {
      clipboard.clear();
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      // Restore normal application menu
      mainWindow.setMenu(defaultAppMenu);
      Menu.setApplicationMenu(defaultAppMenu);
      mainWindow.webContents.send("exam-clipboard-security-state", {
        active: false,
        policy: currentClipboardPolicy,
      });
    }
    console.info("Exam clipboard security deactivated; normal menu restored");
  }

  return { active: examClipboardSecurityActive, policy: currentClipboardPolicy };
}

// Blacklisted Processes from Synopsis
const FORBIDDEN_PROCESSES = [
  "anydesk.exe",
  "teamviewer.exe",
  "vnc.exe",
  "remotedesktop.exe",
  "parsec.exe",
  "logmein.exe",
  "splashtop.exe",
  "rustdesk.exe",
  "vboxservice.exe",
  "vboxtray.exe",
  "vmtoolsd.exe",
  "vmware.exe",
  "wireshark.exe",
  "charles.exe",
  "fiddler.exe",
  "obs64.exe",
  "discord.exe",
];

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

    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      webviewTag: true,
    },
  });

  console.info("[ElectronLifecycle] BrowserWindow created", {
    pid: process.pid,
    packaged: app.isPackaged,
  });

  mainWindow.webContents.on("did-start-loading", () =>
    console.info("[ElectronLifecycle] Renderer started loading")
  );
  mainWindow.webContents.on("did-finish-load", () =>
    console.info("[ElectronLifecycle] Renderer finished loading")
  );
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("[ElectronLifecycle] Renderer process exited", details);
  });
  mainWindow.on("closed", () => {
    console.info("[ElectronLifecycle] BrowserWindow closed");
    mainWindow = null;
  });

  // Intercept before-input-event at Electron browser level
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (!examClipboardSecurityActive || input.type !== "keyDown") return;

    const key = input.key ? input.key.toLowerCase() : "";
    const mod = input.control || input.meta;

    const isCopy = (mod && key === "c") || (input.control && key === "insert");
    const isPaste = (mod && key === "v") || (input.shift && key === "insert");
    const isCut = mod && key === "x";
    const isSelectAll = mod && key === "a";

    let blockedType = null;
    if (isPaste && currentClipboardPolicy.block_paste) {
      blockedType = "PASTE_ATTEMPT";
    } else if (isCopy && currentClipboardPolicy.block_copy) {
      blockedType = "COPY_ATTEMPT";
    } else if (isCut && currentClipboardPolicy.block_cut) {
      blockedType = "CUT_ATTEMPT";
    } else if (isSelectAll && currentClipboardPolicy.block_copy) {
      blockedType = "SELECT_ALL_ATTEMPT";
    }

    if (blockedType) {
      event.preventDefault();
      // Forward blocked shortcut event metadata to renderer for UI toast and metadata logging
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("exam-shortcut-blocked", {
          type: blockedType,
          key: input.key,
          source: "keyboard",
          timestamp: new Date().toISOString(),
        });
      }
    }
  });

  // Intercept browser context-menu event at Electron level
  mainWindow.webContents.on("context-menu", (event) => {
    if (examClipboardSecurityActive && currentClipboardPolicy.block_context_menu) {
      event.preventDefault();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("exam-shortcut-blocked", {
          type: "CLIPBOARD_ACCESS_ATTEMPT",
          source: "context_menu",
          timestamp: new Date().toISOString(),
        });
      }
    }
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

  // Detect window losing focus (tab/window switch)
  mainWindow.on("blur", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("window-blur-event", {
        timestamp: new Date().toISOString(),
      });
    }
  });
}

// --------------------------------------------------
// START BACKEND
// --------------------------------------------------

async function startBackend() {
  if (!app.isPackaged) {
    return;
  }

  try {
    process.env.VIGILEXAM_DATA_DIR = path.join(app.getPath("userData"), "data");
    console.log("VigilExam data directory:", process.env.VIGILEXAM_DATA_DIR);
    await import("../server/index.js");
    console.log("VigilExam backend started.");
  } catch (error) {
    console.error("Failed to start VigilExam backend:", error);
  }
}

// --------------------------------------------------
// IPC HANDLERS
// --------------------------------------------------

ipcMain.handle("scan-active-processes", async () => {
  return new Promise((resolve) => {
    const isWin = os.platform() === "win32";
    const cmd = isWin ? "tasklist /FO CSV /NH" : "ps aux";

    exec(cmd, (err, stdout) => {
      if (err || !stdout) {
        return resolve({
          success: false,
          processes: [],
          forbiddenDetected: [],
        });
      }

      const lines = stdout.split("\n");
      const processNames = [];
      const forbiddenDetected = [];

      lines.forEach((line) => {
        let pName = "";
        if (isWin) {
          const parts = line.split('","');
          if (parts.length > 0) {
            pName = parts[0].replace(/"/g, "").trim().toLowerCase();
          }
        } else {
          const parts = line.trim().split(/\s+/);
          if (parts.length > 10) {
            pName = parts[10].toLowerCase();
          }
        }

        if (pName) {
          processNames.push(pName);
          if (
            FORBIDDEN_PROCESSES.includes(pName) &&
            !forbiddenDetected.includes(pName)
          ) {
            forbiddenDetected.push(pName);
          }
        }
      });

      resolve({
        success: true,
        totalCount: processNames.length,
        forbiddenDetected,
        scannedAt: new Date().toISOString(),
      });
    });
  });
});

ipcMain.handle("get-system-diagnostics", async () => {
  const displays = screen.getAllDisplays();
  const memoryFreeGB = (os.freemem() / (1024 * 1024 * 1024)).toFixed(2);
  const memoryTotalGB = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(2);
  const cpuModel = os.cpus()[0]?.model || "Intel/AMD Processor";

  return {
    osPlatform: os.platform(),
    osRelease: os.release(),
    cpuModel,
    memoryFreeGB,
    memoryTotalGB,
    displayCount: displays.length,
    isMultiDisplay: displays.length > 1,
    scannedAt: new Date().toISOString(),
  };
});

ipcMain.handle("enable-kiosk-mode", async () => {
  console.log("Kiosk mode requested");
  if (mainWindow && !mainWindow.isDestroyed()) {
    // In production, keep window full screen or kiosk if enabled
    try {
      mainWindow.setKiosk(true);
      mainWindow.setAlwaysOnTop(true, "screen-saver");
    } catch (e) {
      console.warn("Could not set full kiosk flags:", e);
    }
  }
  return { kiosk: true };
});

ipcMain.handle("disable-kiosk-mode", async () => {
  console.log("Disable kiosk mode requested");
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.setKiosk(false);
      mainWindow.setAlwaysOnTop(false);
    } catch (e) {
      console.warn("Could not disable kiosk flags:", e);
    }
  }
  return { kiosk: false };
});

ipcMain.handle("set-exam-clipboard-security", (event, options) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    return { active: false, policy: currentClipboardPolicy };
  }
  return setExamClipboardSecurity(options);
});

ipcMain.handle("get-exam-clipboard-security", (event) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    return { active: false, policy: currentClipboardPolicy };
  }
  return { active: examClipboardSecurityActive, policy: currentClipboardPolicy };
});

// --------------------------------------------------
// ELECTRON LIFECYCLE
// --------------------------------------------------

app.whenReady().then(async () => {
  console.log("Electron is ready.");
  await startBackend();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
