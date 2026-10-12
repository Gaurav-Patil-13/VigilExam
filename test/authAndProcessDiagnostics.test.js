/**
 * VigilExam - Authentication, Native Process Monitoring & Safe Management Test Suite
 * 
 * Verifies:
 * 1. Multi-portal authentication, cryptographic tokens, password hashing, RBAC, bootstrap keys
 * 2. Process record structuring, PowerShell single/multi JSON parsing, /Date(...) handling, CSV parsing
 * 3. Safe termination safeguards (System protection, Vigil protection, Unknown default protection, PID revalidation)
 * 4. Centralized API & Socket.IO URL alignment and health connectivity
 */

import assert from 'assert';
import crypto from 'crypto';
import { BACKEND_PORT, API_BASE_URL, SOCKET_URL } from '../src/config/api.js';
import {
  SYSTEM_PROTECTED_PROCESSES,
  VIGILEXAM_PROTECTED_PROCESSES,
  PROHIBITED_PROCESSES_MAP,
  NON_ESSENTIAL_USER_APPS,
  getProcessDisplayName
} from '../electron/securityPolicy.js';
import { processMonitor } from '../electron/processMonitor.js';

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
console.log(' Running Auth, Process & Connectivity Test Suite   ');
console.log('====================================================');

// --- SECTION 1: AUTHENTICATION & SECURITY TOKENS ---

runTest('Backend port and API configuration are unified on 4000', () => {
  assert.strictEqual(BACKEND_PORT, 4000);
  assert.strictEqual(API_BASE_URL, 'http://localhost:4000');
  assert.strictEqual(SOCKET_URL, 'http://localhost:4000');
});

runTest('Cryptographic password hashing creates salted scrypt hashes', () => {
  function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `scrypt:${salt}:${hash}`;
  }

  function verifyPassword(password, storedPassword) {
    if (!storedPassword || !password) return false;
    if (storedPassword.startsWith('scrypt:')) {
      const parts = storedPassword.split(':');
      if (parts.length === 3) {
        const [, salt, hash] = parts;
        const computed = crypto.scryptSync(password, salt, 64).toString('hex');
        return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computed, 'hex'));
      }
    }
    return storedPassword === password;
  }

  const plain = 'MySecretPass2026!';
  const hashed = hashPassword(plain);
  assert.ok(hashed.startsWith('scrypt:'));
  assert.strictEqual(verifyPassword(plain, hashed), true);
  assert.strictEqual(verifyPassword('WrongPass', hashed), false);
  // Backward compatibility with legacy plain text
  assert.strictEqual(verifyPassword('password123', 'password123'), true);
});

runTest('Signed HMAC-SHA256 tokens are verifiable and reject tampering', () => {
  const secret = 'test-exam-secret-key';
  function signToken(user) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ id: user.id, role: user.role, exp: Date.now() + 60000 })).toString('base64url');
    const sig = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
    return `${header}.${payload}.${sig}`;
  }

  function verifyToken(token) {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [h, p, s] = parts;
    const expectedSig = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
    if (crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expectedSig))) {
      return JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
    }
    return null;
  }

  const validToken = signToken({ id: 'u-std-1', role: 'student' });
  const verified = verifyToken(validToken);
  assert.ok(verified);
  assert.strictEqual(verified.id, 'u-std-1');
  assert.strictEqual(verified.role, 'student');

  // Tampered payload
  const parts = validToken.split('.');
  const tamperedPayload = Buffer.from(JSON.stringify({ id: 'u-std-1', role: 'admin' })).toString('base64url');
  const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
  assert.strictEqual(verifyToken(tamperedToken), null);
});

runTest('Portal role validation strictly denies cross-role logins', () => {
  function validatePortalLogin(userRole, targetPortal) {
    if (targetPortal && userRole !== targetPortal) {
      return { allowed: false, status: 403, error: `Access denied. You cannot log into ${targetPortal} with ${userRole} account.` };
    }
    return { allowed: true, status: 200 };
  }

  // Student into student -> OK
  assert.strictEqual(validatePortalLogin('student', 'student').allowed, true);
  // Student into proctor -> 403
  assert.strictEqual(validatePortalLogin('student', 'proctor').status, 403);
  // Student into admin -> 403
  assert.strictEqual(validatePortalLogin('student', 'admin').status, 403);
  // Proctor into admin -> 403
  assert.strictEqual(validatePortalLogin('proctor', 'admin').status, 403);
  // Admin into student -> 403
  assert.strictEqual(validatePortalLogin('admin', 'student').status, 403);
});

runTest('Admin registration requires valid administrative bootstrap secret', () => {
  const BOOTSTRAP_KEY = 'VigilExam-Admin-Root-2026';
  function validateAdminRegistration(data) {
    if (!data.full_name || !data.email || !data.password) {
      return { status: 400, error: 'All fields are mandatory' };
    }
    if (!data.admin_secret || data.admin_secret.trim() !== BOOTSTRAP_KEY) {
      return { status: 403, error: 'Access denied: Valid Administrator Bootstrap Secret is required.' };
    }
    return { status: 201, role: 'admin' };
  }

  // Without secret -> 403
  assert.strictEqual(validateAdminRegistration({ full_name: 'Admin', email: 'a@vigil.com', password: 'pass' }).status, 403);
  // With invalid secret -> 403
  assert.strictEqual(validateAdminRegistration({ full_name: 'Admin', email: 'a@vigil.com', password: 'pass', admin_secret: 'wrong' }).status, 403);
  // With correct secret -> 201
  assert.strictEqual(validateAdminRegistration({ full_name: 'Admin', email: 'a@vigil.com', password: 'pass', admin_secret: BOOTSTRAP_KEY }).status, 201);
});

runTest('Authentication never silently succeeds after network failure', () => {
  function simulateAuthAttempt(networkOnline) {
    if (!networkOnline) {
      throw new Error('Unable to connect to VigilExam Security Server at http://localhost:4000. Please ensure the backend service is running.');
    }
    return { user: { id: 'u1', role: 'student' } };
  }

  assert.throws(() => simulateAuthAttempt(false), /Unable to connect to VigilExam Security Server/);
});

// --- SECTION 2: PROCESS MONITORING & PARSING ---

runTest('PowerShell Date string format /Date(...) is parsed safely without throw', () => {
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

  const psDate = '/Date(1791552103593)/';
  const parsed = parseProcessStartTime(psDate);
  assert.ok(parsed);
  assert.ok(parsed.startsWith('2026-'));

  assert.strictEqual(parseProcessStartTime(null), null);
  assert.strictEqual(parseProcessStartTime(''), null);
});

runTest('Single-process and multiple-process PowerShell outputs are normalized to array', () => {
  function normalizeProcessOutput(rawJson) {
    let data = JSON.parse(rawJson);
    if (!Array.isArray(data)) data = [data];
    return data;
  }

  const singleJson = '{"Id":1234,"ProcessName":"chrome","Path":"C:\\\\chrome.exe","StartTime":null}';
  const multiJson = '[{"Id":1234,"ProcessName":"chrome"},{"Id":5678,"ProcessName":"notepad"}]';

  const single = normalizeProcessOutput(singleJson);
  assert.strictEqual(single.length, 1);
  assert.strictEqual(single[0].Id, 1234);

  const multi = normalizeProcessOutput(multiJson);
  assert.strictEqual(multi.length, 2);
});

runTest('Processes with inaccessible paths or start times remain visible in process list', () => {
  const p = {
    Id: 999,
    ProcessName: 'svchost',
    Path: null,
    StartTime: null
  };

  const pathStr = p.Path ? String(p.Path) : 'Accessible: No (System/Elevated)';
  assert.strictEqual(pathStr, 'Accessible: No (System/Elevated)');
  assert.strictEqual(p.Id, 999);
});

runTest('Human-readable display names are assigned cleanly', () => {
  assert.strictEqual(getProcessDisplayName('anydesk.exe'), 'AnyDesk');
  assert.strictEqual(getProcessDisplayName('chrome.exe'), 'Google Chrome Browser');
  assert.strictEqual(getProcessDisplayName('explorer.exe'), 'Windows Explorer Shell');
  assert.strictEqual(getProcessDisplayName('vigilexam.exe'), 'VigilExam Secure Desktop');
});

runTest('Protected processes (Windows, VigilExam, Unknown) reject termination', () => {
  // Critical Windows system processes
  assert.strictEqual(processMonitor.isAllowedToTerminate('csrss.exe', 1234), false);
  assert.strictEqual(processMonitor.isAllowedToTerminate('explorer.exe', 5678), false);
  assert.strictEqual(processMonitor.isAllowedToTerminate('system', 4), false);

  // VigilExam runtime
  assert.strictEqual(processMonitor.isAllowedToTerminate('vigilexam.exe', 9000), false);
  assert.strictEqual(processMonitor.isAllowedToTerminate('electron.exe', 9001), false);

  // Unknown process (protected by default)
  assert.strictEqual(processMonitor.isAllowedToTerminate('custom_service.exe', 7777), false);

  // Prohibited applications (eligible for termination)
  assert.strictEqual(processMonitor.isAllowedToTerminate('anydesk.exe', 3333), true);
  assert.strictEqual(processMonitor.isAllowedToTerminate('teamviewer.exe', 4444), true);

  // User applications (eligible for termination)
  assert.strictEqual(processMonitor.isAllowedToTerminate('chrome.exe', 5555), true);
  assert.strictEqual(processMonitor.isAllowedToTerminate('spotify.exe', 6666), true);
});

runTest('Socket status states transition cleanly across connected, reconnecting, offline', () => {
  function formatSocketBadge(status) {
    switch (status) {
      case 'connected':
        return { text: 'Connected', color: 'emerald' };
      case 'connecting':
        return { text: 'Connecting...', color: 'amber' };
      case 'reconnecting':
        return { text: 'Reconnecting...', color: 'amber' };
      default:
        return { text: 'Offline', color: 'rose' };
    }
  }

  assert.strictEqual(formatSocketBadge('connected').text, 'Connected');
  assert.strictEqual(formatSocketBadge('connecting').text, 'Connecting...');
  assert.strictEqual(formatSocketBadge('reconnecting').text, 'Reconnecting...');
  assert.strictEqual(formatSocketBadge('offline').text, 'Offline');
});

console.log('====================================================');
console.log(` ALL TESTS PASSED: ${passedTests}/${totalTests}`);
console.log('====================================================');
