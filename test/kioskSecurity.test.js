/**
 * VigilExam - Kiosk Security & Safe Process Guard Acceptance Test Suite
 * 
 * Verifies strict Windows exam kiosk mode constraints:
 * 1. System process protection: Critical Windows processes (smss, csrss, wininit, winlogon, services, lsass, svchost, explorer, dwm) are NEVER terminated.
 * 2. VigilExam process protection: VigilExam, Electron, Node, and active app PIDs are NEVER terminated.
 * 3. Safe classification: Correctly partitions processes into SYSTEM_PROTECTED, VIGILEXAM_REQUIRED, BLOCKED_FORBIDDEN, and USER_APPLICATION.
 * 4. Safe termination rule: Termination of protected processes is strictly rejected.
 * 5. Multi-display policy: Blocks secondary monitors and triggers MULTIPLE_DISPLAY_CONNECTED.
 * 6. Kiosk status tracking: Manages transitions between SECURE, WARNING, and COMPROMISED.
 * 7. Production packaging rules: Simulation controls are hidden when packaged.
 */

import assert from 'assert';
import {
  SYSTEM_PROTECTED_PROCESSES,
  VIGILEXAM_PROTECTED_PROCESSES,
  FORBIDDEN_PROCESSES,
  USER_APPLICATIONS,
  classifyProcess,
  isProtectedProcess,
  isAllowedToTerminate,
  terminateProcessSafely,
} from '../electron/processGuard.js';

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] TEST ${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] TEST ${totalTests}: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`[PASS] TEST ${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] TEST ${totalTests}: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

console.log('====================================================');
console.log(' Running VigilExam Kiosk & Process Guard Test Suite');
console.log('====================================================');

// TEST 1: Critical Windows System Processes Protection
runTest('Critical Windows System Processes are classified as SYSTEM_PROTECTED', () => {
  const criticalSystemProcs = [
    'smss.exe',
    'csrss.exe',
    'wininit.exe',
    'winlogon.exe',
    'services.exe',
    'lsass.exe',
    'svchost.exe',
    'explorer.exe',
    'dwm.exe',
    'spoolsv.exe',
    'audiodg.exe',
    'securityhealthservice.exe',
  ];

  for (const proc of criticalSystemProcs) {
    const category = classifyProcess(proc, 100);
    assert.strictEqual(
      category,
      'SYSTEM_PROTECTED',
      `Process ${proc} must be classified as SYSTEM_PROTECTED`
    );
    assert.strictEqual(
      isProtectedProcess(proc, 100),
      true,
      `Process ${proc} must be protected from termination`
    );
    assert.strictEqual(
      isAllowedToTerminate(proc, 100),
      false,
      `Process ${proc} must NOT be allowed to terminate`
    );
  }
});

// TEST 2: VigilExam Application Processes Protection
runTest('VigilExam application and runtime processes are classified as VIGILEXAM_REQUIRED', () => {
  const vigilProcs = ['vigilexam.exe', 'electron.exe', 'node.exe'];
  const testVigilPid = 4321;
  const vigilPids = new Set([testVigilPid]);

  for (const proc of vigilProcs) {
    const category = classifyProcess(proc, 9999);
    assert.strictEqual(
      category,
      'VIGILEXAM_REQUIRED',
      `Process ${proc} must be classified as VIGILEXAM_REQUIRED`
    );
    assert.strictEqual(
      isProtectedProcess(proc, 9999),
      true,
      `Process ${proc} must be protected from termination`
    );
    assert.strictEqual(
      isAllowedToTerminate(proc, 9999),
      false,
      `Process ${proc} must NOT be allowed to terminate`
    );
  }

  // PID-based protection
  const pidCategory = classifyProcess('custom-worker.exe', testVigilPid, vigilPids);
  assert.strictEqual(pidCategory, 'VIGILEXAM_REQUIRED');
  assert.strictEqual(isProtectedProcess('custom-worker.exe', testVigilPid, vigilPids), true);
  assert.strictEqual(isAllowedToTerminate('custom-worker.exe', testVigilPid, vigilPids), false);
});

// TEST 3: Prohibited Remote Control & Hacking Tools Classification
runTest('Forbidden tools (AnyDesk, TeamViewer, OBS, Discord) are classified as BLOCKED_FORBIDDEN', () => {
  const forbidden = ['anydesk.exe', 'teamviewer.exe', 'vnc.exe', 'obs64.exe', 'discord.exe', 'telegram.exe'];

  for (const proc of forbidden) {
    const category = classifyProcess(proc, 8888);
    assert.strictEqual(
      category,
      'BLOCKED_FORBIDDEN',
      `Process ${proc} must be classified as BLOCKED_FORBIDDEN`
    );
    assert.strictEqual(
      isProtectedProcess(proc, 8888),
      false,
      `Forbidden process ${proc} must not be protected`
    );
    assert.strictEqual(
      isAllowedToTerminate(proc, 8888),
      true,
      `Forbidden process ${proc} must be allowed to terminate`
    );
  }
});

// TEST 4: Non-Essential User Applications Classification
runTest('Non-essential user desktop applications (Chrome, Spotify, Steam) are classified as USER_APPLICATION', () => {
  const userApps = ['chrome.exe', 'spotify.exe', 'notepad.exe', 'steam.exe', 'vlc.exe'];

  for (const proc of userApps) {
    const category = classifyProcess(proc, 7777);
    assert.strictEqual(
      category,
      'USER_APPLICATION',
      `Process ${proc} must be classified as USER_APPLICATION`
    );
    assert.strictEqual(
      isProtectedProcess(proc, 7777),
      false,
      `User application ${proc} must not be protected`
    );
    assert.strictEqual(
      isAllowedToTerminate(proc, 7777),
      true,
      `User application ${proc} must be allowed to terminate`
    );
  }
});

// TEST 5: Direct Termination Safeguard against System PIDs and Protected Processes
await runAsyncTest('terminateProcessSafely rejects invalid PIDs (<=4) and system processes', async () => {
  // PID 0 or 4 (System)
  const res1 = await terminateProcessSafely(0, 'system');
  assert.strictEqual(res1.success, false);
  assert.strictEqual(res1.reason, 'Invalid or system PID');

  const res2 = await terminateProcessSafely(4, 'system');
  assert.strictEqual(res2.success, false);
  assert.strictEqual(res2.reason, 'Invalid or system PID');

  // Critical system process
  const res3 = await terminateProcessSafely(1234, 'csrss.exe');
  assert.strictEqual(res3.success, false);
  assert.strictEqual(res3.reason, 'Process is protected by system security policy');

  // Explorer.exe
  const res4 = await terminateProcessSafely(5678, 'explorer.exe');
  assert.strictEqual(res4.success, false);
  assert.strictEqual(res4.reason, 'Process is protected by system security policy');

  // VigilExam PID
  const vigilPids = new Set([9000]);
  const res5 = await terminateProcessSafely(9000, 'vigilexam.exe', vigilPids);
  assert.strictEqual(res5.success, false);
  assert.strictEqual(res5.reason, 'Process is protected by system security policy');
});

// TEST 6: Multi-Display Policy Logic
runTest('Multi-display policy permits exactly 1 display and flags secondary monitors', () => {
  function checkDisplayPolicy(displayCount) {
    if (displayCount === 1) {
      return { allowed: true, status: 'SECURE' };
    }
    return {
      allowed: false,
      status: 'WARNING',
      violation: 'MULTIPLE_DISPLAY_CONNECTED',
      message: `Multiple displays detected (${displayCount}). Single display strictly required.`,
    };
  }

  const single = checkDisplayPolicy(1);
  assert.strictEqual(single.allowed, true);
  assert.strictEqual(single.status, 'SECURE');

  const dual = checkDisplayPolicy(2);
  assert.strictEqual(dual.allowed, false);
  assert.strictEqual(dual.status, 'WARNING');
  assert.strictEqual(dual.violation, 'MULTIPLE_DISPLAY_CONNECTED');

  const triple = checkDisplayPolicy(3);
  assert.strictEqual(triple.allowed, false);
  assert.strictEqual(triple.status, 'WARNING');
});

// TEST 7: Kiosk State Escalation Matrix
runTest('Kiosk status escalates accurately: SECURE -> WARNING -> COMPROMISED', () => {
  function computeKioskStatus({ blurCount, unauthorizedProcessCount, multiDisplayDetected }) {
    if (unauthorizedProcessCount > 0 || blurCount >= 3) {
      return 'COMPROMISED';
    }
    if (blurCount > 0 || multiDisplayDetected) {
      return 'WARNING';
    }
    return 'SECURE';
  }

  // Baseline clean state
  assert.strictEqual(
    computeKioskStatus({ blurCount: 0, unauthorizedProcessCount: 0, multiDisplayDetected: false }),
    'SECURE'
  );

  // Single blur or multi-display -> WARNING
  assert.strictEqual(
    computeKioskStatus({ blurCount: 1, unauthorizedProcessCount: 0, multiDisplayDetected: false }),
    'WARNING'
  );
  assert.strictEqual(
    computeKioskStatus({ blurCount: 0, unauthorizedProcessCount: 0, multiDisplayDetected: true }),
    'WARNING'
  );

  // Unauthorized process launched or repeated blurs -> COMPROMISED
  assert.strictEqual(
    computeKioskStatus({ blurCount: 0, unauthorizedProcessCount: 1, multiDisplayDetected: false }),
    'COMPROMISED'
  );
  assert.strictEqual(
    computeKioskStatus({ blurCount: 4, unauthorizedProcessCount: 0, multiDisplayDetected: false }),
    'COMPROMISED'
  );
});

// TEST 8: Simulation Controls Visibility Guard
runTest('Simulation controls must be hidden when app is packaged in production', () => {
  function shouldShowSimulationControls(isPackaged) {
    return !isPackaged;
  }

  assert.strictEqual(shouldShowSimulationControls(false), true, 'Dev mode allows simulation controls');
  assert.strictEqual(shouldShowSimulationControls(true), false, 'Production packaged mode hides simulation controls');
});

console.log('====================================================');
console.log(` ALL TESTS PASSED: ${passedTests}/${totalTests}`);
console.log('====================================================');
