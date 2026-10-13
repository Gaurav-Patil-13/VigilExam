/**
 * VigilExam - Windows Native Process Monitor & Security Guard
 * 
 * Provides real-time OS-level process enumeration, baseline comparison,
 * suspicious application detection, safe targeted process termination, and
 * continuous in-exam monitoring.
 */

import { execFile, exec } from 'child_process';
import os from 'os';
import {
  SYSTEM_PROTECTED_PROCESSES,
  VIGILEXAM_PROTECTED_PROCESSES,
  PROHIBITED_PROCESSES_MAP,
  NON_ESSENTIAL_USER_APPS,
  FRIENDLY_PROCESS_NAMES,
  getProcessDisplayName,
  ALLOW_VSCODE_DURING_DEVELOPMENT,
  ALLOW_BACKGROUND_PROCESSES,
  SECURITY_ENVIRONMENT_CONFIG,
  matchProhibitedByPathOrMetadata
} from './securityPolicy.js';

function parseProcessStartTime(val) {
  if (!val) return null;
  if (typeof val === 'string') {
    const match = /\/Date\((\d+)\)\//.exec(val);
    if (match) {
      const ms = parseInt(match[1], 10);
      if (!isNaN(ms)) return new Date(ms).toISOString();
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  if (typeof val === 'number') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

function parseCsvLine(line) {
  const result = [];
  const regex = /(?:^|,)(?:"([^"]*(?:""[^"]*)*)"|([^,]*))/g;
  let match;
  while ((match = regex.exec(line)) !== null) {
    if (match.index === regex.lastIndex) regex.lastIndex++;
    const val = match[1] !== undefined ? match[1].replace(/""/g, '"') : match[2];
    result.push(val ? val.trim() : '');
  }
  return result;
}

class ProcessMonitor {
  constructor() {
    this.vigilPids = new Set([process.pid]);
    this.baselineProcesses = new Map(); // pid -> process object
    this.currentProcesses = new Map();  // pid -> process object
    this.alertedPids = new Set();       // pid of prohibited apps already alerted to avoid spam
    this.monitorTimer = null;
    this.isMonitoring = false;
    this.eventListeners = new Set();
    this.lastScanTime = null;
    this.lastScanError = null;
  }

  registerVigilPid(pid) {
    if (pid && typeof pid === 'number') {
      this.vigilPids.add(pid);
    }
  }

  /**
   * Classify a process based on name, PID, path, and system policy.
   */
  classifyProcess(name, pid, pathStr = '', options = {}) {
    const norm = (name || '').toLowerCase().trim();
    const numPid = Number(pid) || 0;
    const allowVsCode = (options.allowVsCode !== undefined) ? options.allowVsCode : ALLOW_VSCODE_DURING_DEVELOPMENT;

    // 1. VigilExam Runtime Application Processes
    if (this.vigilPids.has(numPid)) {
      return {
        category: 'VIGILEXAM_REQUIRED',
        categoryLabel: 'VigilExam',
        displayName: 'VigilExam Secure Desktop',
        isProtected: true,
        isProhibited: false,
        canTerminate: false,
        reason: 'Active VigilExam application runtime process',
        severity: 'info'
      };
    }

    // 2. Critical Windows Operating System & System Idle Processes
    if (SYSTEM_PROTECTED_PROCESSES.has(norm) || numPid <= 4) {
      return {
        category: 'WINDOWS_SYSTEM',
        categoryLabel: 'Protected System',
        displayName: getProcessDisplayName(norm),
        isProtected: true,
        isProhibited: false,
        canTerminate: false,
        reason: 'Critical Windows kernel & operating system service',
        severity: 'info'
      };
    }

    // 3. VigilExam Support Runtimes (Node.js, Electron, Git, CLI)
    if (VIGILEXAM_PROTECTED_PROCESSES.has(norm)) {
      return {
        category: 'VIGILEXAM_REQUIRED',
        categoryLabel: 'VigilExam',
        displayName: getProcessDisplayName(norm),
        isProtected: true,
        isProhibited: false,
        canTerminate: false,
        reason: 'Essential runtime and development dependency',
        severity: 'info'
      };
    }

    // 4. Visual Studio Code Development-Mode Exception
    // Only applies to exact Code.exe when development flag is enabled
    if (norm === 'code.exe' || norm === 'code') {
      if (allowVsCode) {
        return {
          category: 'DEVELOPMENT_TOOL',
          categoryLabel: 'Development Tool (Allowed)',
          displayName: 'Visual Studio Code (Dev Mode)',
          isProtected: true, // Protected from termination during dev
          isProhibited: false,
          canTerminate: false,
          reason: 'Active project development environment (Explicitly allowed during development)',
          severity: 'info'
        };
      }
    }

    const mainWindowHandle = options.mainWindowHandle !== undefined && options.mainWindowHandle !== null
      ? Number(options.mainWindowHandle)
      : null;

    // 4b. Background Windows Services (When ALLOW_BACKGROUND_PROCESSES is enabled)
    // Note: Pure Session 0 background services without active GUI windows cannot be terminated without Windows Administrator rights.
    // They are permitted only when background processes are allowed AND mainWindowHandle === 0.
    // Interactive desktop clients (e.g. UltraViewer_Desktop.exe, UltraViewer.exe, TeamViewer.exe, or any window > 0) remain strictly prohibited.
    if (ALLOW_BACKGROUND_PROCESSES && mainWindowHandle === 0 && (norm === 'ultraviewer_service.exe' || norm === 'ultraviewservice.exe' || norm === 'teamviewer_service.exe' || norm === 'lmiguardiansvc.exe')) {
      return {
        category: 'BACKGROUND_SERVICE',
        categoryLabel: 'Background Service',
        displayName: getProcessDisplayName(norm),
        isProtected: true,
        isProhibited: false,
        canTerminate: false,
        reason: 'Windows background service (Permitted when background processes are enabled)',
        severity: 'info'
      };
    }

    // 4c. Windows Store (UWP) Background Brokers without active window
    // When the user closes a UWP app (e.g. WhatsApp Desktop from Windows Store), Windows
    // retains the background push/lifecycle broker with MainWindowHandle === 0.
    // If background processes are permitted and the window is closed, do not flag as an active prohibited app.
    if (ALLOW_BACKGROUND_PROCESSES && (norm === 'whatsapp.root.exe' || norm === 'whatsapp.exe') && mainWindowHandle === 0) {
      return {
        category: 'BACKGROUND_SERVICE',
        categoryLabel: 'Background Service',
        displayName: 'WhatsApp Background Broker',
        isProtected: false,
        isProhibited: false,
        canTerminate: true,
        reason: 'Windows background notification broker (Window closed; permitted when background processes are enabled)',
        severity: 'info'
      };
    }

    // 5. Explicit Prohibited Process Match
    if (PROHIBITED_PROCESSES_MAP[norm]) {
      const meta = PROHIBITED_PROCESSES_MAP[norm];
      return {
        category: 'PROHIBITED_APPLICATION',
        categoryLabel: 'Prohibited',
        subCategory: meta.category,
        subCategoryLabel: meta.categoryLabel || meta.category,
        severity: meta.severity,
        reason: meta.reason,
        displayName: meta.name,
        isProtected: false,
        isProhibited: true,
        canTerminate: true
      };
    }

    // 5b. Keyword Heuristic Match for UltraViewer and remote tools
    if (
      norm.includes('ultraviewer') ||
      norm.includes('teamviewer') ||
      norm.includes('anydesk') ||
      norm.includes('rustdesk')
    ) {
      return {
        category: 'PROHIBITED_APPLICATION',
        categoryLabel: 'Prohibited',
        subCategory: 'REMOTE_ACCESS',
        subCategoryLabel: 'Remote Access',
        severity: 'critical',
        reason: 'Remote desktop / screen sharing application detected',
        displayName: getProcessDisplayName(norm),
        isProtected: false,
        isProhibited: true,
        canTerminate: true
      };
    }

    // 6. Path-Based and Heuristic Prohibited Match
    const heuristicMatch = matchProhibitedByPathOrMetadata(pathStr, norm);
    if (heuristicMatch) {
      return {
        category: 'PROHIBITED_APPLICATION',
        categoryLabel: 'Prohibited',
        subCategory: heuristicMatch.category,
        subCategoryLabel: heuristicMatch.categoryLabel || heuristicMatch.category,
        severity: heuristicMatch.severity,
        reason: heuristicMatch.reason,
        displayName: heuristicMatch.name,
        isProtected: false,
        isProhibited: true,
        canTerminate: true
      };
    }

    // 7. Non-Essential Desktop User Applications
    if (NON_ESSENTIAL_USER_APPS.has(norm)) {
      return {
        category: 'NORMAL_USER_APPLICATION',
        categoryLabel: 'User Application',
        subCategory: 'USER_APP',
        severity: 'low',
        reason: 'Non-essential desktop user application',
        displayName: getProcessDisplayName(norm),
        isProtected: false,
        isProhibited: false,
        canTerminate: true
      };
    }

    // 8. Unknown Background Processes (Protected by default to prevent OS instability)
    return {
      category: 'UNKNOWN',
      categoryLabel: 'Unknown',
      displayName: getProcessDisplayName(norm),
      isProtected: true,
      isProhibited: false,
      canTerminate: false,
      reason: 'Background system process or helper service (Protected by default)',
      severity: 'info'
    };
  }

  isProtectedProcess(name, pid, pathStr = '') {
    const classification = this.classifyProcess(name, pid, pathStr);
    return classification.isProtected;
  }

  isAllowedToTerminate(name, pid, pathStr = '', options = {}) {
    const classification = this.classifyProcess(name, pid, pathStr, options);
    if (classification.isProtected || classification.category === 'DEVELOPMENT_TOOL') {
      return false;
    }
    return classification.category === 'PROHIBITED_APPLICATION' || classification.category === 'NORMAL_USER_APPLICATION';
  }

  /**
   * Helper to inspect real running process on Windows by PID.
   */
  getRealProcess(pid) {
    return new Promise((resolve) => {
      const isWin = os.platform() === 'win32';
      if (!isWin) return resolve(null);

      execFile('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Get-Process -Id ${pid} -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, Path | ConvertTo-Json -Compress`
      ], { timeout: 3000 }, (err, stdout) => {
        if (!err && stdout && stdout.trim()) {
          try {
            const p = JSON.parse(stdout);
            if (p && p.Id) {
              const raw = (p.ProcessName || '').trim();
              const exe = raw.toLowerCase().endsWith('.exe') ? raw.toLowerCase() : `${raw.toLowerCase()}.exe`;
              const pathStr = p.Path ? String(p.Path) : 'Accessible: No (System/Elevated)';
              return resolve({
                pid: Number(p.Id),
                name: exe,
                path: pathStr,
                displayName: getProcessDisplayName(exe, raw)
              });
            }
          } catch (e) {}
        }

        // Fallback to tasklist
        execFile('tasklist.exe', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { timeout: 3000 }, (tErr, tStdout) => {
          if (!tErr && tStdout && tStdout.trim()) {
            const parts = parseCsvLine(tStdout.trim());
            if (parts.length >= 2) {
              const raw = parts[0].trim();
              if (raw && raw.toLowerCase() !== 'info:') {
                const exe = raw.toLowerCase().endsWith('.exe') ? raw.toLowerCase() : `${raw.toLowerCase()}.exe`;
                return resolve({
                  pid,
                  name: exe,
                  path: 'Accessible: No (System/Elevated)',
                  displayName: getProcessDisplayName(exe, raw)
                });
              }
            }
          }
          resolve(null);
        });
      });
    });
  }

  /**
   * Checks if PID is currently alive on OS.
   */
  isPidAlive(pid) {
    return new Promise((resolve) => {
      if (os.platform() === 'win32') {
        execFile('tasklist.exe', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { timeout: 2000 }, (err, stdout) => {
          if (err || !stdout) return resolve(false);
          if (stdout.toLowerCase().includes('no tasks')) return resolve(false);
          const hasPid = stdout.includes(`"${pid}"`) || stdout.includes(`,${pid},`);
          resolve(hasPid);
        });
      } else {
        try {
          process.kill(pid, 0);
          resolve(true);
        } catch (e) {
          resolve(false);
        }
      }
    });
  }

  /**
   * Enumerates active OS processes with PID, executable name, path, start time, and window presence.
   */
  scanProcesses() {
    return new Promise((resolve) => {
      const isWin = os.platform() === 'win32';
      const psCommand = `Get-Process | Select-Object Id, ProcessName, Path, StartTime, MainWindowHandle | ConvertTo-Json -Compress`;

      if (isWin) {
        execFile('powershell.exe', [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          psCommand
        ], { maxBuffer: 25 * 1024 * 1024, timeout: 8000 }, (psErr, psStdout) => {
          if (!psErr && psStdout && psStdout.trim()) {
            try {
              let data = JSON.parse(psStdout);
              if (!Array.isArray(data)) data = [data];

              const processes = [];
              const suspicious = [];
              const userApps = [];
              const protectedList = [];
              const unknownList = [];
              const devTools = [];
              const seenPids = new Set();

              data.forEach((p) => {
                if (!p || p.Id === undefined || p.Id === null) return;
                const pid = Number(p.Id);
                if (seenPids.has(pid)) return;
                seenPids.add(pid);

                const rawName = (p.ProcessName || '').trim();
                if (!rawName) return;
                const exeName = rawName.toLowerCase().endsWith('.exe') ? rawName.toLowerCase() : `${rawName.toLowerCase()}.exe`;
                const pathStr = p.Path ? String(p.Path) : 'Accessible: No (System/Elevated)';
                const startTimeStr = parseProcessStartTime(p.StartTime);
                const mainWindowHandle = p.MainWindowHandle ? Number(p.MainWindowHandle) : 0;

                const classification = this.classifyProcess(exeName, pid, pathStr, { mainWindowHandle });
                const displayName = classification.displayName || getProcessDisplayName(exeName, rawName);

                const procObj = {
                  pid,
                  name: exeName,
                  displayName,
                  path: pathStr,
                  startTime: startTimeStr,
                  mainWindowHandle,
                  hasWindow: mainWindowHandle !== 0,
                  category: classification.category,
                  categoryLabel: classification.categoryLabel,
                  subCategory: classification.subCategory || null,
                  subCategoryLabel: classification.subCategoryLabel || classification.categoryLabel,
                  severity: classification.severity || 'low',
                  reason: classification.reason || 'Background operating system process',
                  isProtected: classification.isProtected,
                  isProhibited: classification.isProhibited,
                  canTerminate: classification.canTerminate || false,
                  timestamp: new Date().toISOString()
                };

                processes.push(procObj);
                if (classification.isProhibited) {
                  suspicious.push(procObj);
                } else if (classification.category === 'NORMAL_USER_APPLICATION') {
                  userApps.push(procObj);
                } else if (classification.category === 'DEVELOPMENT_TOOL') {
                  devTools.push(procObj);
                } else if (classification.isProtected && classification.category !== 'UNKNOWN') {
                  protectedList.push(procObj);
                } else if (classification.category === 'UNKNOWN') {
                  unknownList.push(procObj);
                }
              });

              this.lastScanTime = new Date().toISOString();
              this.lastScanError = null;

              return resolve({
                success: true,
                totalCount: processes.length,
                prohibitedCount: suspicious.length,
                userAppCount: userApps.length,
                protectedCount: protectedList.length,
                unknownCount: unknownList.length,
                devToolCount: devTools.length,
                processes,
                suspicious,
                userApps,
                protectedProcesses: protectedList,
                unknownProcesses: unknownList,
                devTools,
                allowBackgroundProcesses: ALLOW_BACKGROUND_PROCESSES,
                timestamp: this.lastScanTime
              });
            } catch (jsonErr) {
              console.warn('[ProcessMonitor] PowerShell JSON parse note, falling back to tasklist:', jsonErr.message);
            }
          }

          // Fallback to tasklist /FO CSV
          execFile('tasklist.exe', ['/FO', 'CSV', '/NH'], { maxBuffer: 25 * 1024 * 1024, timeout: 8000 }, (cmdErr, cmdStdout) => {
            if (cmdErr || !cmdStdout) {
              this.lastScanError = cmdErr ? cmdErr.message : 'No output from process query';
              return resolve({
                success: false,
                totalCount: 0,
                prohibitedCount: 0,
                userAppCount: 0,
                protectedCount: 0,
                unknownCount: 0,
                processes: [],
                suspicious: [],
                userApps: [],
                protectedProcesses: [],
                unknownProcesses: [],
                error: this.lastScanError,
                timestamp: new Date().toISOString()
              });
            }

            const lines = cmdStdout.split(/\r?\n/);
            const processes = [];
            const suspicious = [];
            const userApps = [];
            const protectedList = [];
            const unknownList = [];
            const devTools = [];
            const seenPids = new Set();

            lines.forEach((line) => {
              if (!line || !line.trim()) return;
              const parts = parseCsvLine(line.trim());
              if (parts.length >= 2) {
                const rawExe = parts[0].trim();
                if (!rawExe || rawExe.toLowerCase() === 'image name') return;
                const exeName = rawExe.toLowerCase().endsWith('.exe') ? rawExe.toLowerCase() : `${rawExe.toLowerCase()}.exe`;
                const pid = parseInt(parts[1].replace(/,/g, '').trim(), 10) || 0;

                if (pid && !seenPids.has(pid)) {
                  seenPids.add(pid);
                  const classification = this.classifyProcess(exeName, pid);
                  const displayName = classification.displayName || getProcessDisplayName(exeName, rawExe);
                  const procObj = {
                    pid,
                    name: exeName,
                    displayName,
                    path: 'Accessible: No (System/Elevated)',
                    startTime: null,
                    category: classification.category,
                    categoryLabel: classification.categoryLabel,
                    subCategory: classification.subCategory || null,
                    subCategoryLabel: classification.subCategoryLabel || classification.categoryLabel,
                    severity: classification.severity || 'low',
                    reason: classification.reason || 'Background operating system process',
                    isProtected: classification.isProtected,
                    isProhibited: classification.isProhibited,
                    canTerminate: classification.canTerminate || false,
                    timestamp: new Date().toISOString()
                  };

                  processes.push(procObj);
                  if (classification.isProhibited) {
                    suspicious.push(procObj);
                  } else if (classification.category === 'NORMAL_USER_APPLICATION') {
                    userApps.push(procObj);
                  } else if (classification.category === 'DEVELOPMENT_TOOL') {
                    devTools.push(procObj);
                  } else if (classification.isProtected && classification.category !== 'UNKNOWN') {
                    protectedList.push(procObj);
                  } else if (classification.category === 'UNKNOWN') {
                    unknownList.push(procObj);
                  }
                }
              }
            });

            this.lastScanTime = new Date().toISOString();
            this.lastScanError = null;

            resolve({
              success: true,
              totalCount: processes.length,
              prohibitedCount: suspicious.length,
              userAppCount: userApps.length,
              protectedCount: protectedList.length,
              unknownCount: unknownList.length,
              devToolCount: devTools.length,
              processes,
              suspicious,
              userApps,
              protectedProcesses: protectedList,
              unknownProcesses: unknownList,
              devTools,
              allowBackgroundProcesses: ALLOW_BACKGROUND_PROCESSES,
              timestamp: this.lastScanTime
            });
          });
        });
      } else {
        // Non-Windows (macOS / Linux Development Environment)
        exec('ps -ef', (psErr, psStdout) => {
          if (psErr || !psStdout) {
            return resolve({
              success: false,
              totalCount: 0,
              prohibitedCount: 0,
              userAppCount: 0,
              protectedCount: 0,
              unknownCount: 0,
              processes: [],
              suspicious: [],
              userApps: [],
              protectedProcesses: [],
              unknownProcesses: [],
              timestamp: new Date().toISOString()
            });
          }

          const lines = psStdout.split('\n').slice(1);
          const processes = [];
          lines.forEach((line) => {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 8) {
              const pid = parseInt(parts[1], 10);
              const cmd = parts[7];
              const exeName = (cmd.split('/').pop() || '').toLowerCase();
              if (pid) {
                const classification = this.classifyProcess(exeName, pid, cmd);
                processes.push({
                  pid,
                  name: exeName,
                  displayName: classification.displayName || exeName,
                  path: cmd,
                  startTime: null,
                  category: classification.category,
                  categoryLabel: classification.categoryLabel,
                  severity: classification.severity || 'low',
                  reason: classification.reason || 'Process',
                  isProtected: classification.isProtected,
                  isProhibited: classification.isProhibited,
                  canTerminate: classification.canTerminate || false,
                  timestamp: new Date().toISOString()
                });
              }
            }
          });

          resolve({
            success: true,
            totalCount: processes.length,
            prohibitedCount: 0,
            userAppCount: 0,
            protectedCount: 0,
            unknownCount: 0,
            processes,
            suspicious: [],
            userApps: [],
            protectedProcesses: [],
            unknownProcesses: [],
            timestamp: new Date().toISOString()
          });
        });
      }
    });
  }

  /**
   * Retrieves active prohibited/suspicious processes.
   */
  async getSuspiciousProcesses() {
    const scan = await this.scanProcesses();
    return {
      success: scan.success,
      prohibitedCount: (scan.suspicious || []).length,
      userAppCount: (scan.userApps || []).length,
      prohibited: scan.suspicious || [],
      userApps: scan.userApps || [],
      isClean: (scan.suspicious || []).length === 0,
      totalCount: scan.totalCount || 0,
      timestamp: scan.timestamp
    };
  }

  /**
   * Captures baseline process snapshot right before student enters the exam.
   */
  async captureBaseline() {
    const scan = await this.scanProcesses();
    this.baselineProcesses.clear();
    (scan.processes || []).forEach((p) => {
      this.baselineProcesses.set(p.pid, p);
    });
    this.alertedPids.clear();
    console.info(`[ProcessMonitor] Baseline snapshot captured (${this.baselineProcesses.size} processes)`);
    return {
      success: true,
      baselineCount: this.baselineProcesses.size,
      capturedAt: new Date().toISOString()
    };
  }

  /**
   * Starts continuous process watcher scanning every intervalMs (default 1500ms).
   * Emits only deduplicated alerts to avoid flood of duplicate events.
   */
  startProcessMonitoring(intervalMs = 1500, onEventCallback) {
    if (this.isMonitoring) return;
    this.isMonitoring = true;
    if (onEventCallback) {
      this.eventListeners.add(onEventCallback);
    }

    console.info(`[ProcessMonitor] Continuous process monitoring started (Interval: ${intervalMs}ms)`);

    // Capture initial snapshot
    this.scanProcesses().then((initial) => {
      this.currentProcesses.clear();
      (initial.processes || []).forEach((p) => this.currentProcesses.set(p.pid, p));
    });

    this.monitorTimer = setInterval(async () => {
      try {
        const scan = await this.scanProcesses();
        if (!scan.success) return;

        const nextMap = new Map();
        (scan.processes || []).forEach((p) => nextMap.set(p.pid, p));

        // 1. Detect prohibited processes (newly launched or already active)
        for (const [pid, proc] of nextMap.entries()) {
          if (proc.isProhibited) {
            // Check if already alerted
            if (!this.alertedPids.has(pid)) {
              this.alertedPids.add(pid);
              this.emitEvent({
                type: 'PROHIBITED_PROCESS_DETECTED',
                process: proc,
                severity: proc.severity || 'critical',
                message: `Unauthorized prohibited application detected: ${proc.displayName || proc.name} (PID ${proc.pid})`,
                timestamp: new Date().toISOString()
              });
            }
          } else if (proc.category === 'NORMAL_USER_APPLICATION') {
            if (!this.currentProcesses.has(pid) && !this.baselineProcesses.has(pid)) {
              if (!this.alertedPids.has(pid)) {
                this.alertedPids.add(pid);
                this.emitEvent({
                  type: 'PROCESS_STARTED',
                  process: proc,
                  severity: 'low',
                  message: `User application started during exam: ${proc.displayName || proc.name} (PID ${proc.pid})`,
                  timestamp: new Date().toISOString()
                });
              }
            }
          }
        }

        // 2. Detect stopped processes
        for (const [pid, proc] of this.currentProcesses.entries()) {
          if (!nextMap.has(pid)) {
            if (this.alertedPids.has(pid)) {
              this.alertedPids.delete(pid);
            }
            if (proc.isProhibited) {
              this.emitEvent({
                type: 'PROHIBITED_PROCESS_STOPPED',
                process: proc,
                severity: 'info',
                message: `Prohibited application closed: ${proc.displayName || proc.name} (PID ${proc.pid})`,
                timestamp: new Date().toISOString()
              });
            }
          }
        }

        this.currentProcesses = nextMap;
      } catch (err) {
        console.warn('[ProcessMonitor] Process scan tick error:', err.message);
      }
    }, intervalMs);
  }

  stopProcessMonitoring() {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }
    this.isMonitoring = false;
    this.alertedPids.clear();
    this.eventListeners.clear();
    console.info('[ProcessMonitor] Continuous process monitoring stopped');
  }

  emitEvent(event) {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('[ProcessMonitor] Listener callback error:', e);
      }
    }
  }

  /**
   * Safely terminates an approved process by PID.
   * Enforces strict safeguards:
   * - Never kills Windows critical processes (smss, csrss, dwm, etc.)
   * - Never kills VigilExam processes
   * - Never kills unknown or development processes by default
   * - Requests graceful termination first, then force termination
   * - Revalidates target PID and verifies exit before reporting success
   */
  async terminateApprovedProcess(pid, processName = '') {
    const numPid = Number(pid);
    if (!numPid || numPid <= 4) {
      return { success: false, reason: 'Invalid or protected system PID' };
    }

    if (this.vigilPids.has(numPid) || numPid === process.pid) {
      return { success: false, reason: 'Cannot terminate VigilExam application process' };
    }

    const candidateName = (processName || '').toLowerCase().trim();
    if (candidateName && this.isProtectedProcess(candidateName, numPid)) {
      console.warn(`[ProcessMonitor] Termination rejected for protected process: ${candidateName} (PID: ${numPid})`);
      return { success: false, reason: 'Process is protected by system security policy' };
    }

    // Live OS identity re-validation
    const verifiedProc = await this.getRealProcess(numPid);
    if (!verifiedProc) {
      this.currentProcesses.delete(numPid);
      this.alertedPids.delete(numPid);
      return { success: false, reason: `Process with PID ${numPid} is not currently running` };
    }

    const realExe = verifiedProc.name.toLowerCase();
    if (this.isProtectedProcess(realExe, numPid, verifiedProc.path)) {
      console.warn(`[ProcessMonitor] Termination rejected for protected process: ${realExe} (PID: ${numPid})`);
      return { success: false, reason: 'Process is protected by system security policy' };
    }

    if (!this.isAllowedToTerminate(realExe, numPid, verifiedProc.path)) {
      return {
        success: false,
        reason: `Process ${realExe} is not eligible for termination under exam security policy`
      };
    }

    const isWin = os.platform() === 'win32';

    return new Promise((resolve) => {
      // 1. Graceful termination request first
      const gracefulCmd = isWin ? 'taskkill.exe' : 'kill';
      const gracefulArgs = isWin ? ['/PID', String(numPid)] : ['-15', String(numPid)];

      execFile(gracefulCmd, gracefulArgs, () => {
        // Wait 500ms for graceful exit
        setTimeout(() => {
          // 2. Force termination if still alive
          const forceCmd = isWin ? 'taskkill.exe' : 'kill';
          const forceArgs = isWin ? ['/F', '/T', '/PID', String(numPid)] : ['-9', String(numPid)];

          execFile(forceCmd, forceArgs, async () => {
            // Verify whether process actually exited
            let stillAlive = await this.isPidAlive(numPid);

            // Secondary Windows fallback for stubborn / UWP store apps
            if (stillAlive && isWin) {
              await new Promise((psResolve) => {
                execFile('powershell.exe', [
                  '-NoProfile',
                  '-NonInteractive',
                  '-Command',
                  `Stop-Process -Id ${numPid} -Force -ErrorAction SilentlyContinue`
                ], { timeout: 3000 }, () => psResolve());
              });
              stillAlive = await this.isPidAlive(numPid);
            }

            const success = !stillAlive;

            if (success) {
              this.currentProcesses.delete(numPid);
              this.alertedPids.delete(numPid);
            }

            resolve({
              success,
              pid: numPid,
              name: realExe,
              displayName: verifiedProc.displayName,
              reason: success
                ? 'Application closed successfully'
                : 'Process could not be terminated (Still active in operating system)'
            });
          });
        }, 500);
      });
    });
  }

  /**
   * Safely closes all detected prohibited tools.
   */
  async closeAllProhibitedApplications() {
    const scan = await this.getSuspiciousProcesses();
    const targets = scan.prohibited || [];

    const results = [];
    for (const target of targets) {
      if (this.isAllowedToTerminate(target.name, target.pid, target.path)) {
        const res = await this.terminateApprovedProcess(target.pid, target.name);
        results.push({ ...target, closed: res.success, error: res.reason });
      }
    }

    const postScan = await this.getSuspiciousProcesses();
    return {
      closedCount: results.filter((r) => r.closed).length,
      remainingProhibited: postScan.prohibited,
      isClean: postScan.isClean,
      results
    };
  }

  /**
   * Safely closes all non-essential desktop applications.
   */
  async closeNonEssentialApplications() {
    const scan = await this.getSuspiciousProcesses();
    const targets = [...(scan.prohibited || []), ...(scan.userApps || [])];

    const results = [];
    for (const target of targets) {
      if (this.isAllowedToTerminate(target.name, target.pid, target.path)) {
        const res = await this.terminateApprovedProcess(target.pid, target.name);
        results.push({ ...target, closed: res.success });
      }
    }

    const postScan = await this.getSuspiciousProcesses();
    return {
      closedCount: results.filter((r) => r.closed).length,
      remainingProhibited: postScan.prohibited,
      remainingUserApps: postScan.userApps,
      isClean: postScan.isClean && postScan.userApps.length === 0,
      results
    };
  }
}

export const processMonitor = new ProcessMonitor();
