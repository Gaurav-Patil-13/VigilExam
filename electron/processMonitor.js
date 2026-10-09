/**
 * VigilExam - Windows Native Process Monitor & Security Guard
 * 
 * Provides real-time OS-level process enumeration, baseline comparison,
 * suspicious application detection, safe targeted process termination, and
 * continuous in-exam monitoring.
 */

import { exec, spawn } from 'child_process';
import os from 'os';
import {
  SYSTEM_PROTECTED_PROCESSES,
  VIGILEXAM_PROTECTED_PROCESSES,
  PROHIBITED_PROCESSES_MAP,
  NON_ESSENTIAL_USER_APPS
} from './securityPolicy.js';

class ProcessMonitor {
  constructor() {
    this.vigilPids = new Set([process.pid]);
    this.baselineProcesses = new Map(); // pid -> process object
    this.currentProcesses = new Map();  // pid -> process object
    this.monitorTimer = null;
    this.isMonitoring = false;
    this.eventListeners = new Set();
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
      return { category: 'VIGILEXAM_REQUIRED', isProtected: true, isProhibited: false };
    }

    if (SYSTEM_PROTECTED_PROCESSES.has(norm) || numPid <= 4) {
      return { category: 'WINDOWS_SYSTEM', isProtected: true, isProhibited: false };
    }

    if (VIGILEXAM_PROTECTED_PROCESSES.has(norm)) {
      return { category: 'VIGILEXAM_REQUIRED', isProtected: true, isProhibited: false };
    }

    if (PROHIBITED_PROCESSES_MAP[norm]) {
      const meta = PROHIBITED_PROCESSES_MAP[norm];
      return {
        category: 'PROHIBITED_APPLICATION',
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
        subCategory: 'USER_APP',
        severity: 'low',
        reason: 'Non-essential desktop user application',
        displayName: norm,
        isProtected: false,
        isProhibited: false
      };
    }

    return {
      category: 'UNKNOWN',
      isProtected: false,
      isProhibited: false
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
   * Enumerates active OS processes with PID, executable name, path, and start time where available.
   */
  scanProcesses() {
    return new Promise((resolve) => {
      const isWin = os.platform() === 'win32';
      
      // PowerShell script to retrieve Id, ProcessName, Path, StartTime
      const psCommand = `Get-Process | Select-Object Id, ProcessName, Path, StartTime | ConvertTo-Json -Compress`;
      const fallbackCmd = isWin ? 'tasklist /FO CSV /V /NH' : 'ps -ef';

      exec(`powershell.exe -NoProfile -NonInteractive -Command "${psCommand}"`, { maxBuffer: 10 * 1024 * 1024 }, (psErr, psStdout) => {
        if (!psErr && psStdout) {
          try {
            let data = JSON.parse(psStdout);
            if (!Array.isArray(data)) data = [data];

            const processes = [];
            const suspicious = [];
            const userApps = [];

            data.forEach((p) => {
              if (!p || !p.Id) return;
              const rawName = (p.ProcessName || '').trim();
              const exeName = rawName.toLowerCase().endsWith('.exe') ? rawName.toLowerCase() : `${rawName.toLowerCase()}.exe`;
              const pid = Number(p.Id);
              const pathStr = p.Path || '';
              const startTimeStr = p.StartTime ? new Date(p.StartTime).toISOString() : null;

              const classification = this.classifyProcess(exeName, pid);
              const procObj = {
                pid,
                name: exeName,
                displayName: classification.displayName || rawName,
                path: pathStr,
                startTime: startTimeStr,
                category: classification.category,
                subCategory: classification.subCategory || null,
                severity: classification.severity || 'low',
                reason: classification.reason || null,
                isProtected: classification.isProtected,
                isProhibited: classification.isProhibited
              };

              processes.push(procObj);
              if (classification.isProhibited) {
                suspicious.push(procObj);
              } else if (classification.category === 'NORMAL_USER_APPLICATION') {
                userApps.push(procObj);
              }
            });

            return resolve({
              success: true,
              totalCount: processes.length,
              processes,
              suspicious,
              userApps,
              timestamp: new Date().toISOString()
            });
          } catch (jsonErr) {
            // Fall through to tasklist
          }
        }

        // Fallback to tasklist /FO CSV
        exec(fallbackCmd, { maxBuffer: 10 * 1024 * 1024 }, (cmdErr, cmdStdout) => {
          if (cmdErr || !cmdStdout) {
            return resolve({ success: false, totalCount: 0, processes: [], suspicious: [], userApps: [] });
          }

          const lines = cmdStdout.split('\n');
          const processes = [];
          const suspicious = [];
          const userApps = [];
          const seenPids = new Set();

          lines.forEach((line) => {
            const parts = line.split('","');
            if (parts.length >= 2) {
              const exeName = parts[0].replace(/"/g, '').trim().toLowerCase();
              const pid = parseInt(parts[1].replace(/"/g, '').trim(), 10) || 0;

              if (pid && !seenPids.has(pid)) {
                seenPids.add(pid);
                const classification = this.classifyProcess(exeName, pid);
                const procObj = {
                  pid,
                  name: exeName,
                  displayName: classification.displayName || exeName,
                  path: '',
                  startTime: null,
                  category: classification.category,
                  subCategory: classification.subCategory || null,
                  severity: classification.severity || 'low',
                  reason: classification.reason || null,
                  isProtected: classification.isProtected,
                  isProhibited: classification.isProhibited
                };

                processes.push(procObj);
                if (classification.isProhibited) {
                  suspicious.push(procObj);
                } else if (classification.category === 'NORMAL_USER_APPLICATION') {
                  userApps.push(procObj);
                }
              }
            }
          });

          resolve({
            success: true,
            totalCount: processes.length,
            processes,
            suspicious,
            userApps,
            timestamp: new Date().toISOString()
          });
        });
      });
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
      isClean: scan.suspicious.length === 0
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
   * NEVER runs wildcard commands or kills system protected processes.
   */
  terminateApprovedProcess(pid, processName = '') {
    return new Promise((resolve) => {
      const numPid = Number(pid);
      if (!numPid || numPid <= 4) {
        return resolve({ success: false, reason: 'Invalid or protected system PID' });
      }

      if (this.vigilPids.has(numPid)) {
        return resolve({ success: false, reason: 'Cannot terminate VigilExam application process' });
      }

      const procObj = this.currentProcesses.get(numPid);
      const name = processName || (procObj ? procObj.name : '');

      if (this.isProtectedProcess(name, numPid)) {
        console.warn(`[ProcessMonitor] Termination rejected for protected process: ${name} (PID: ${numPid})`);
        return resolve({ success: false, reason: 'Process is protected by system security policy' });
      }

      const isWin = os.platform() === 'win32';
      const gracefulCmd = isWin ? `taskkill /PID ${numPid}` : `kill -15 ${numPid}`;

      exec(gracefulCmd, (gracefulErr) => {
        setTimeout(() => {
          const forceCmd = isWin ? `taskkill /F /PID ${numPid}` : `kill -9 ${numPid}`;
          exec(forceCmd, (forceErr) => {
            const success = !forceErr || (forceErr && forceErr.code === 128); // 128 = process already terminated
            if (success) {
              this.currentProcesses.delete(numPid);
            }
            resolve({
              success,
              pid: numPid,
              name,
              reason: success ? 'Application closed successfully' : 'Failed to terminate process'
            });
          });
        }, 600);
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
