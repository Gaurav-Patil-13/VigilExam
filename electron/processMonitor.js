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
  getProcessDisplayName
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
   * Classify a process based on name and system status.
   */
  classifyProcess(name, pid) {
    const norm = (name || '').toLowerCase().trim();
    const numPid = Number(pid) || 0;

    if (this.vigilPids.has(numPid)) {
      return {
        category: 'VIGILEXAM_REQUIRED',
        categoryLabel: 'VigilExam',
        displayName: 'VigilExam Secure Desktop',
        isProtected: true,
        isProhibited: false,
        reason: 'Active VigilExam application runtime process',
        severity: 'info'
      };
    }

    if (SYSTEM_PROTECTED_PROCESSES.has(norm) || numPid <= 4) {
      return {
        category: 'WINDOWS_SYSTEM',
        categoryLabel: 'Protected System',
        displayName: getProcessDisplayName(norm),
        isProtected: true,
        isProhibited: false,
        reason: 'Critical Windows kernel & operating system service',
        severity: 'info'
      };
    }

    if (VIGILEXAM_PROTECTED_PROCESSES.has(norm)) {
      return {
        category: 'VIGILEXAM_REQUIRED',
        categoryLabel: 'VigilExam',
        displayName: getProcessDisplayName(norm),
        isProtected: true,
        isProhibited: false,
        reason: 'Essential runtime and development dependency',
        severity: 'info'
      };
    }

    if (PROHIBITED_PROCESSES_MAP[norm]) {
      const meta = PROHIBITED_PROCESSES_MAP[norm];
      return {
        category: 'PROHIBITED_APPLICATION',
        categoryLabel: 'Prohibited',
        subCategory: meta.category,
        severity: meta.severity,
        reason: meta.reason,
        displayName: meta.name,
        isProtected: false,
        isProhibited: true
      };
    }

    if (NON_ESSENTIAL_USER_APPS.has(norm)) {
      return {
        category: 'NORMAL_USER_APPLICATION',
        categoryLabel: 'User Application',
        subCategory: 'USER_APP',
        severity: 'low',
        reason: 'Non-essential desktop user application',
        displayName: getProcessDisplayName(norm),
        isProtected: false,
        isProhibited: false
      };
    }

    return {
      category: 'UNKNOWN',
      categoryLabel: 'Unknown',
      displayName: getProcessDisplayName(norm),
      isProtected: true, // Unknown processes are protected by default from arbitrary termination
      isProhibited: false,
      reason: 'Background system process or helper service (Protected by default)',
      severity: 'info'
    };
  }

  isProtectedProcess(name, pid) {
    const classification = this.classifyProcess(name, pid);
    return classification.isProtected;
  }

  isAllowedToTerminate(name, pid) {
    const classification = this.classifyProcess(name, pid);
    if (classification.isProtected) return false;
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
        `Get-Process -Id ${pid} -ErrorAction SilentlyContinue | Select-Object Id, ProcessName | ConvertTo-Json -Compress`
      ], { timeout: 3000 }, (err, stdout) => {
        if (!err && stdout && stdout.trim()) {
          try {
            const p = JSON.parse(stdout);
            if (p && p.Id) {
              const raw = (p.ProcessName || '').trim();
              const exe = raw.toLowerCase().endsWith('.exe') ? raw.toLowerCase() : `${raw.toLowerCase()}.exe`;
              return resolve({
                pid: Number(p.Id),
                name: exe,
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
   * Enumerates active OS processes with PID, executable name, path, and start time where available.
   */
  scanProcesses() {
    return new Promise((resolve) => {
      const isWin = os.platform() === 'win32';
      const psCommand = `Get-Process | Select-Object Id, ProcessName, Path, StartTime | ConvertTo-Json -Compress`;

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

                const classification = this.classifyProcess(exeName, pid);
                const displayName = classification.displayName || getProcessDisplayName(exeName, rawName);

                const procObj = {
                  pid,
                  name: exeName,
                  displayName,
                  path: pathStr,
                  startTime: startTimeStr,
                  category: classification.category,
                  categoryLabel: classification.categoryLabel,
                  subCategory: classification.subCategory || null,
                  severity: classification.severity || 'low',
                  reason: classification.reason || 'Background operating system process',
                  isProtected: classification.isProtected,
                  isProhibited: classification.isProhibited,
                  timestamp: new Date().toISOString()
                };

                processes.push(procObj);
                if (classification.isProhibited) {
                  suspicious.push(procObj);
                } else if (classification.category === 'NORMAL_USER_APPLICATION') {
                  userApps.push(procObj);
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
                processes,
                suspicious,
                userApps,
                protectedProcesses: protectedList,
                unknownProcesses: unknownList,
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
                    severity: classification.severity || 'low',
                    reason: classification.reason || 'Background operating system process',
                    isProtected: classification.isProtected,
                    isProhibited: classification.isProhibited,
                    timestamp: new Date().toISOString()
                  };

                  processes.push(procObj);
                  if (classification.isProhibited) {
                    suspicious.push(procObj);
                  } else if (classification.category === 'NORMAL_USER_APPLICATION') {
                    userApps.push(procObj);
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
              processes,
              suspicious,
              userApps,
              protectedProcesses: protectedList,
              unknownProcesses: unknownList,
              timestamp: this.lastScanTime
            });
          });
        });
      } else {
        // Non-Windows (Development / macOS / Linux)
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
                const classification = this.classifyProcess(exeName, pid);
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
   * Retrieves active suspicious/prohibited processes.
   */
  async getSuspiciousProcesses() {
    const scan = await this.scanProcesses();
    return {
      success: scan.success,
      prohibitedCount: scan.suspicious.length,
      userAppCount: scan.userApps.length,
      prohibited: scan.suspicious,
      userApps: scan.userApps,
      isClean: scan.suspicious.length === 0,
      totalCount: scan.totalCount,
      timestamp: scan.timestamp
    };
  }

  /**
   * Captures baseline process snapshot right before student enters the exam.
   */
  async captureBaseline() {
    const scan = await this.scanProcesses();
    this.baselineProcesses.clear();
    scan.processes.forEach((p) => {
      this.baselineProcesses.set(p.pid, p);
    });
    console.info(`[ProcessMonitor] Baseline snapshot captured (${this.baselineProcesses.size} processes)`);
    return {
      success: true,
      baselineCount: this.baselineProcesses.size,
      capturedAt: new Date().toISOString()
    };
  }

  /**
   * Starts continuous process watcher scanning every intervalMs (default 1500ms).
   * Emits only delta events (new prohibited app, process started/stopped) to callbacks.
   */
  startProcessMonitoring(intervalMs = 1500, onEventCallback) {
    if (this.isMonitoring) return;
    this.isMonitoring = true;
    if (onEventCallback) {
      this.eventListeners.add(onEventCallback);
    }

    console.info(`[ProcessMonitor] Continuous process monitoring started (Interval: ${intervalMs}ms)`);

    // Initialize current process snapshot
    this.scanProcesses().then((initial) => {
      this.currentProcesses.clear();
      initial.processes.forEach((p) => this.currentProcesses.set(p.pid, p));
    });

    this.monitorTimer = setInterval(async () => {
      try {
        const scan = await this.scanProcesses();
        const nextMap = new Map();
        scan.processes.forEach((p) => nextMap.set(p.pid, p));

        // Detect newly started processes
        for (const [pid, proc] of nextMap.entries()) {
          if (!this.currentProcesses.has(pid)) {
            // Process started
            const isBaseline = this.baselineProcesses.has(pid);
            if (!isBaseline) {
              if (proc.isProhibited) {
                this.emitEvent({
                  type: 'PROHIBITED_PROCESS_DETECTED',
                  process: proc,
                  severity: proc.severity || 'critical',
                  message: `Unauthorized prohibited application launched: ${proc.displayName || proc.name} (PID ${proc.pid})`,
                  timestamp: new Date().toISOString()
                });
              } else if (proc.category === 'NORMAL_USER_APPLICATION') {
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

        // Detect stopped processes
        for (const [pid, proc] of this.currentProcesses.entries()) {
          if (!nextMap.has(pid)) {
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
        console.warn('[ProcessMonitor] Process scan tick error:', err);
      }
    }, intervalMs);
  }

  stopProcessMonitoring() {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }
    this.isMonitoring = false;
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
   * Strictly enforces security policies:
   * - Never kills Windows system processes
   * - Never kills VigilExam processes
   * - Never kills unknown processes by default
   * - Never uses wildcards
   * - Revalidates target PID and real identity before termination
   */
  async terminateApprovedProcess(pid, processName = '') {
    const numPid = Number(pid);
    if (!numPid || numPid <= 4) {
      return { success: false, reason: 'Invalid or protected system PID' };
    }

    if (this.vigilPids.has(numPid) || numPid === process.pid) {
      return { success: false, reason: 'Cannot terminate VigilExam application process' };
    }

    // Pre-validate target name against protected lists
    const candidateName = (processName || '').toLowerCase().trim();
    if (candidateName && this.isProtectedProcess(candidateName, numPid)) {
      console.warn(`[ProcessMonitor] Termination rejected for protected process: ${candidateName} (PID: ${numPid})`);
      return { success: false, reason: 'Process is protected by system security policy' };
    }

    // Revalidate live OS identity of the target PID
    const verifiedProc = await this.getRealProcess(numPid);
    if (!verifiedProc) {
      this.currentProcesses.delete(numPid);
      return { success: false, reason: `Process with PID ${numPid} is not currently running` };
    }

    const realExe = verifiedProc.name.toLowerCase();
    if (this.isProtectedProcess(realExe, numPid)) {
      console.warn(`[ProcessMonitor] Termination rejected for protected process: ${realExe} (PID: ${numPid})`);
      return { success: false, reason: 'Process is protected by system security policy' };
    }

    if (!this.isAllowedToTerminate(realExe, numPid)) {
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
          const forceArgs = isWin ? ['/F', '/PID', String(numPid)] : ['-9', String(numPid)];

          execFile(forceCmd, forceArgs, (forceErr) => {
            const success = !forceErr || (forceErr && forceErr.code === 128); // 128 = already dead
            if (success) {
              this.currentProcesses.delete(numPid);
            }
            resolve({
              success: Boolean(success),
              pid: numPid,
              name: realExe,
              displayName: verifiedProc.displayName,
              reason: success ? 'Application closed successfully' : (forceErr ? forceErr.message : 'Termination failed')
            });
          });
        }, 500);
      });
    });
  }

  /**
   * Safely closes all detected prohibited tools and non-essential applications.
   */
  async closeNonEssentialApplications() {
    const scan = await this.getSuspiciousProcesses();
    const targets = [...scan.prohibited, ...scan.userApps];

    const results = [];
    for (const target of targets) {
      if (this.isAllowedToTerminate(target.name, target.pid)) {
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
