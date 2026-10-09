/**
 * VigilExam - Process Guard & Safe Background Application Cleaner
 * 
 * Enforces strict Windows background application security:
 * - Identifies non-essential user applications (Discord, Spotify, Telegram, Chrome, etc.)
 * - Protects critical Windows system processes (smss, csrss, winlogon, explorer, etc.)
 * - Protects VigilExam application processes and dependencies
 * - Gracefully requests termination first, then safely forces exit if needed
 * - NEVER runs blind commands like "taskkill /F /IM *"
 */

import { exec } from 'child_process';
import os from 'os';

// 1. Critical Windows System Processes (NEVER TERMINATE)
export const SYSTEM_PROTECTED_PROCESSES = new Set([
  'system',
  'system idle process',
  'registry',
  'smss.exe',
  'csrss.exe',
  'wininit.exe',
  'winlogon.exe',
  'services.exe',
  'lsass.exe',
  'svchost.exe',
  'fontdrvhost.exe',
  'dwm.exe',
  'explorer.exe',
  'sihost.exe',
  'taskhostw.exe',
  'spoolsv.exe',
  'audiodg.exe',
  'ctfmon.exe',
  'securityhealthservice.exe',
  'securityhealthsystray.exe',
  'smartscreen.exe',
  'msmpeng.exe',
  'nissrv.exe',
  'searchhost.exe',
  'startmenuexperiencehost.exe',
  'shellexperiencehost.exe',
  'runtimebroker.exe',
  'applicationframehost.exe',
  'wlanext.exe',
  'conhost.exe',
  'dashost.exe',
  'searchindexer.exe',
  'memory compression',
  'secure system'
]);

// 2. VigilExam & Node System Processes (NEVER TERMINATE)
export const VIGILEXAM_PROTECTED_PROCESSES = new Set([
  'vigilexam.exe',
  'electron.exe',
  'node.exe',
  'git.exe',
  'cmd.exe',
  'powershell.exe'
]);

// 3. Known Forbidden & Prohibited Tools (Must be closed)
export const FORBIDDEN_PROCESSES = new Set([
  'anydesk.exe',
  'teamviewer.exe',
  'vnc.exe',
  'vncviewer.exe',
  'remotedesktop.exe',
  'mstsc.exe',
  'parsec.exe',
  'logmein.exe',
  'splashtop.exe',
  'rustdesk.exe',
  'ultraviewer.exe',
  'ammyy.exe',
  'supremo.exe',
  'vboxservice.exe',
  'vboxtray.exe',
  'virtualbox.exe',
  'virtualboxvm.exe',
  'vmtoolsd.exe',
  'vmware.exe',
  'vmware-tray.exe',
  'wireshark.exe',
  'charles.exe',
  'fiddler.exe',
  'obs64.exe',
  'obs32.exe',
  'obs.exe',
  'discord.exe',
  'slack.exe',
  'telegram.exe',
  'whatsapp.exe',
  'skype.exe',
  'zoom.exe',
  'teams.exe'
]);

// 4. Known User Applications (Non-essential desktop applications)
export const USER_APPLICATIONS = new Set([
  'chrome.exe',
  'msedge.exe',
  'firefox.exe',
  'opera.exe',
  'brave.exe',
  'spotify.exe',
  'notepad.exe',
  'notepad++.exe',
  'code.exe',
  'steam.exe',
  'epicgameslauncher.exe',
  'vlc.exe',
  'wordpad.exe',
  'winword.exe',
  'excel.exe',
  'powerpnt.exe',
  'calculatorapp.exe',
  'calculator.exe'
]);

/**
 * Classifies a process based on name and system status.
 * @returns {"SYSTEM_PROTECTED" | "VIGILEXAM_REQUIRED" | "BLOCKED_FORBIDDEN" | "USER_APPLICATION" | "UNKNOWN"}
 */
export function classifyProcess(procName, pid, vigilPids = new Set()) {
  const normalized = (procName || '').toLowerCase().trim();

  if (vigilPids.has(Number(pid))) {
    return 'VIGILEXAM_REQUIRED';
  }

  if (SYSTEM_PROTECTED_PROCESSES.has(normalized)) {
    return 'SYSTEM_PROTECTED';
  }

  if (VIGILEXAM_PROTECTED_PROCESSES.has(normalized)) {
    // If it's node/electron running this app, protect it
    return 'VIGILEXAM_REQUIRED';
  }

  if (FORBIDDEN_PROCESSES.has(normalized)) {
    return 'BLOCKED_FORBIDDEN';
  }

  if (USER_APPLICATIONS.has(normalized)) {
    return 'USER_APPLICATION';
  }

  return 'UNKNOWN';
}

/**
 * Validates whether a process is protected from termination.
 */
export function isProtectedProcess(procName, pid, vigilPids = new Set()) {
  const category = classifyProcess(procName, pid, vigilPids);
  return category === 'SYSTEM_PROTECTED' || category === 'VIGILEXAM_REQUIRED';
}

/**
 * Validates whether a process is allowed to be closed before or during an exam.
 */
export function isAllowedToTerminate(procName, pid, vigilPids = new Set()) {
  const category = classifyProcess(procName, pid, vigilPids);
  return category === 'BLOCKED_FORBIDDEN' || category === 'USER_APPLICATION';
}

/**
 * Scans active OS processes and returns classified list with details.
 */
export function scanClassifiedProcesses(vigilPids = new Set()) {
  return new Promise((resolve) => {
    const isWin = os.platform() === 'win32';
    const cmd = isWin ? 'tasklist /FO CSV /NH' : 'ps -ef';

    exec(cmd, (err, stdout) => {
      if (err || !stdout) {
        return resolve({
          success: false,
          processes: [],
          userApps: [],
          forbiddenApps: [],
          totalCount: 0
        });
      }

      const lines = stdout.split('\n');
      const allProcesses = [];
      const userApps = [];
      const forbiddenApps = [];
      const seenPids = new Set();

      lines.forEach((line) => {
        let pName = '';
        let pid = 0;

        if (isWin) {
          const parts = line.split('","');
          if (parts.length >= 2) {
            pName = parts[0].replace(/"/g, '').trim().toLowerCase();
            pid = parseInt(parts[1].replace(/"/g, '').trim(), 10) || 0;
          }
        } else {
          const parts = line.trim().split(/\s+/);
          if (parts.length > 7) {
            pName = parts[7].toLowerCase();
            pid = parseInt(parts[1], 10) || 0;
          }
        }

        if (pName && pid && !seenPids.has(pid)) {
          seenPids.add(pid);
          const category = classifyProcess(pName, pid, vigilPids);

          const item = {
            name: pName,
            pid,
            category
          };

          allProcesses.push(item);

          if (category === 'BLOCKED_FORBIDDEN') {
            forbiddenApps.push(item);
          } else if (category === 'USER_APPLICATION') {
            userApps.push(item);
          }
        }
      });

      resolve({
        success: true,
        totalCount: allProcesses.length,
        userApps,
        forbiddenApps,
        requiresCleanup: userApps.length > 0 || forbiddenApps.length > 0,
        scannedAt: new Date().toISOString()
      });
    });
  });
}

/**
 * Safely terminates a single process with strict safety verification.
 */
export function terminateProcessSafely(pid, procName, vigilPids = new Set()) {
  return new Promise((resolve) => {
    if (!pid || pid <= 4) {
      return resolve({ success: false, reason: 'Invalid or system PID' });
    }

    if (isProtectedProcess(procName, pid, vigilPids)) {
      console.warn(`[ProcessGuard] REJECTED termination of protected process: ${procName} (PID ${pid})`);
      return resolve({ success: false, reason: 'Process is protected by system security policy' });
    }

    const isWin = os.platform() === 'win32';
    // Step 1: Graceful termination first
    const gracefulCmd = isWin ? `taskkill /PID ${pid}` : `kill -15 ${pid}`;

    exec(gracefulCmd, (gracefulErr) => {
      // Step 2: Allow 600ms for graceful shutdown, then verify or force
      setTimeout(() => {
        // Step 3: Force termination if still active
        const forceCmd = isWin ? `taskkill /F /PID ${pid}` : `kill -9 ${pid}`;
        exec(forceCmd, (forceErr) => {
          resolve({
            success: !forceErr || (forceErr && forceErr.code === 128), // 128 = process not found (already exited)
            pid,
            name: procName
          });
        });
      }, 600);
    });
  });
}

/**
 * Safely closes non-essential user applications and forbidden tools.
 * NEVER kills protected system processes or VigilExam processes.
 */
export async function closeNonEssentialApplications(vigilPids = new Set()) {
  const scan = await scanClassifiedProcesses(vigilPids);
  const targetsToClose = [...scan.forbiddenApps, ...scan.userApps];

  const results = [];
  for (const target of targetsToClose) {
    if (isAllowedToTerminate(target.name, target.pid, vigilPids)) {
      const res = await terminateProcessSafely(target.pid, target.name, vigilPids);
      results.push({ ...target, closed: res.success });
    }
  }

  // Rescan after termination
  const postScan = await scanClassifiedProcesses(vigilPids);

  return {
    closedCount: results.filter(r => r.closed).length,
    remainingUserApps: postScan.userApps,
    remainingForbiddenApps: postScan.forbiddenApps,
    isClean: postScan.userApps.length === 0 && postScan.forbiddenApps.length === 0,
    results
  };
}
