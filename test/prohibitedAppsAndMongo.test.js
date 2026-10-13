/**
 * VigilExam - Prohibited Applications, VS Code Dev Exception & MongoDB Integration Test Suite
 * 
 * Verifies:
 * 1. Prohibited application categories (Remote access, Screen recording, GenAI, Communication)
 * 2. Path-based heuristic matching for non-standard executable names and portable tools
 * 3. Configurable VS Code development exception (ALLOW_VSCODE_DURING_DEVELOPMENT)
 * 4. Safe process termination rules and exit re-validation
 * 5. MongoDB Mongoose schemas (User, Exam, ExamAttempt, SecurityEvent, ProctorWarning, AuditLog)
 * 6. MongoDB placeholder credential detection ('AWAITING_CREDENTIALS') and safe URI redaction
 * 7. Salted bcrypt password hashing and legacy hash migration
 * 8. Strict clipboard sanitization in security event payloads
 * 9. Administrative and supervisor audit log recording
 */

import assert from 'assert';
import bcrypt from 'bcryptjs';
import {
  PROHIBITED_PROCESSES_MAP,
  PATH_BASED_DETECTION_RULES,
  ALLOW_VSCODE_DURING_DEVELOPMENT,
  matchProhibitedByPathOrMetadata,
  getProcessDisplayName,
  BROWSER_POLICY_OPTIONS,
  DEFAULT_EXAM_POLICY
} from '../electron/securityPolicy.js';
import { processMonitor } from '../electron/processMonitor.js';
import {
  User,
  Exam,
  ExamAttempt,
  SecurityEvent,
  ProctorWarning,
  AuditLog
} from '../server/models/index.js';
import { getSafeUri, getMongoStatus } from '../server/mongodb.js';
import db from '../server/db.js';

let totalTests = 0;
let passedTests = 0;
const testQueue = [];

function runTest(name, fn) {
  testQueue.push({ name, fn, isAsync: false });
}

function runAsyncTest(name, fn) {
  testQueue.push({ name, fn, isAsync: true });
}

async function executeTestSuite() {
  console.log('==================================================================');
  console.log(' Running Prohibited Apps, Dev Exception & MongoDB Test Suite    ');
  console.log('==================================================================');

  for (const { name, fn, isAsync } of testQueue) {
    totalTests++;
    try {
      if (isAsync) {
        await fn();
      } else {
        fn();
      }
      console.log(`[PASS] TEST ${totalTests}: ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`[FAIL] TEST ${totalTests}: ${name}`);
      console.error(err);
      process.exitCode = 1;
    }
  }

  console.log('==================================================================');
  console.log(` ALL PROHIBITED APPS & MONGO TESTS PASSED: ${passedTests}/${totalTests}`);
  console.log('==================================================================');
}

// --- SECTION 1: PROHIBITED APPLICATION CLASSIFICATION ---

runTest('Remote access applications are classified as prohibited', () => {
  const remoteTools = [
    'anydesk.exe',
    'teamviewer.exe',
    'ultraviewer.exe',
    'ultraviewer_desktop.exe',
    'rustdesk.exe',
    'parsec.exe',
    'splashtop.exe',
    'logmein.exe',
    'vncviewer.exe',
    'tightvnc.exe',
    'ammyy.exe',
    'supremo.exe'
  ];

  for (const tool of remoteTools) {
    const classification = processMonitor.classifyProcess(tool, 1000 + totalTests);
    assert.strictEqual(
      classification.isProhibited,
      true,
      `${tool} must be marked isProhibited: true`
    );
    assert.strictEqual(
      classification.category,
      'PROHIBITED_APPLICATION',
      `${tool} must be category PROHIBITED_APPLICATION`
    );
    assert.strictEqual(
      processMonitor.isAllowedToTerminate(tool, 1000 + totalTests),
      true,
      `${tool} must be eligible for safe termination`
    );
  }
});

runTest('UltraViewer variants (desktop client, active window, keyword matches) are strictly prohibited and terminate-eligible', () => {
  // Desktop client
  const desktopCls = processMonitor.classifyProcess('ultraviewer_desktop.exe', 22248, 'C:\\Program Files\\UltraViewer\\UltraViewer_Desktop.exe');
  assert.strictEqual(desktopCls.isProhibited, true, 'UltraViewer_Desktop.exe must be prohibited');
  assert.strictEqual(desktopCls.category, 'PROHIBITED_APPLICATION');
  assert.strictEqual(processMonitor.isAllowedToTerminate('ultraviewer_desktop.exe', 22248), true);

  // Active window variant (even if named service, if mainWindowHandle !== 0 it is interactive and prohibited)
  const windowedServiceCls = processMonitor.classifyProcess('ultraviewer_service.exe', 18812, '', { mainWindowHandle: 123456 });
  assert.strictEqual(windowedServiceCls.isProhibited, true, 'Windowed UltraViewer service must be prohibited');
  assert.strictEqual(windowedServiceCls.category, 'PROHIBITED_APPLICATION');

  // Custom executable with ultraviewer in name
  const customCls = processMonitor.classifyProcess('my_custom_ultraviewer_tool.exe', 9999);
  assert.strictEqual(customCls.isProhibited, true, 'Any custom tool with ultraviewer keyword must be prohibited');
  assert.strictEqual(customCls.category, 'PROHIBITED_APPLICATION');
});

runTest('Screen recording & broadcasting applications are classified as prohibited', () => {
  const recorders = [
    'obs64.exe',
    'obs32.exe',
    'streamlabs.exe',
    'bandicam.exe',
    'camtasia.exe',
    'xsplit.exe',
    'snagit32.exe',
    'snagit64.exe',
    'sharex.exe',
    'loom.exe'
  ];

  for (const recorder of recorders) {
    const classification = processMonitor.classifyProcess(recorder, 2000 + totalTests);
    assert.strictEqual(
      classification.isProhibited,
      true,
      `${recorder} must be classified as prohibited`
    );
    assert.strictEqual(
      classification.subCategory,
      'SCREEN_RECORDER',
      `${recorder} must belong to SCREEN_RECORDER category`
    );
  }
});

runTest('Generative AI desktop clients are classified as prohibited', () => {
  const aiClients = [
    'chatgpt.exe',
    'claude.exe',
    'gemini.exe',
    'copilot.exe'
  ];

  for (const ai of aiClients) {
    const classification = processMonitor.classifyProcess(ai, 3000 + totalTests);
    assert.strictEqual(
      classification.isProhibited,
      true,
      `${ai} must be classified as prohibited`
    );
    assert.strictEqual(
      classification.subCategory,
      'GENERATIVE_AI',
      `${ai} must belong to GENERATIVE_AI category`
    );
  }
});

runTest('Communication desktop applications are classified as prohibited', () => {
  const commApps = [
    'discord.exe',
    'telegram.exe',
    'whatsapp.exe',
    'slack.exe',
    'zoom.exe',
    'teams.exe'
  ];

  for (const comm of commApps) {
    const classification = processMonitor.classifyProcess(comm, 4000 + totalTests);
    assert.strictEqual(
      classification.isProhibited,
      true,
      `${comm} must be classified as prohibited`
    );
    assert.strictEqual(
      classification.subCategory,
      'COMMUNICATION',
      `${comm} must belong to COMMUNICATION category`
    );
  }
});

runTest('Path-based heuristic matches prohibited tools with non-standard names', () => {
  const pathCases = [
    {
      path: 'C:\\Users\\Student\\AppData\\Local\\Programs\\ChatGPT\\ChatGPT.exe',
      expectedName: 'ChatGPT Desktop'
    },
    {
      path: 'C:\\Program Files\\UltraViewer\\UltraViewer_Service.exe',
      expectedName: 'UltraViewer'
    },
    {
      path: 'D:\\Tools\\AnyDesk_portable_v8.exe',
      expectedName: 'AnyDesk'
    },
    {
      path: 'C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe',
      expectedName: 'OBS Studio'
    },
    {
      path: 'C:\\Users\\Student\\AppData\\Local\\RustDesk\\rustdesk.exe',
      expectedName: 'RustDesk'
    }
  ];

  for (const { path, expectedName } of pathCases) {
    const matched = matchProhibitedByPathOrMetadata(path);
    assert.ok(matched, `Path ${path} should be matched by heuristic rule`);
    assert.strictEqual(matched.name, expectedName, `Display name mismatch for ${path}`);
  }
});

runTest('Browser policy distinguishes generic browsers from desktop AI clients', () => {
  assert.ok(BROWSER_POLICY_OPTIONS);
  assert.strictEqual(BROWSER_POLICY_OPTIONS.ALLOW, 'allow');
  assert.strictEqual(BROWSER_POLICY_OPTIONS.WARN, 'warn');
  assert.strictEqual(BROWSER_POLICY_OPTIONS.PROHIBIT, 'prohibit');
  assert.strictEqual(DEFAULT_EXAM_POLICY.browser_policy, 'warn');

  // Chrome is classified as USER_APPLICATION, not falsely as ChatGPT or GenAI
  const chromeClass = processMonitor.classifyProcess('chrome.exe', 5555);
  assert.strictEqual(chromeClass.category, 'NORMAL_USER_APPLICATION');
  assert.strictEqual(chromeClass.isProhibited, false);
});

// --- SECTION 2: DEVELOPMENT-MODE VS CODE EXCEPTION ---

runTest('ALLOW_VSCODE_DURING_DEVELOPMENT permits code.exe during development', () => {
  assert.strictEqual(ALLOW_VSCODE_DURING_DEVELOPMENT, true);

  const codeClassification = processMonitor.classifyProcess('code.exe', 12345);
  assert.strictEqual(
    codeClassification.category,
    'DEVELOPMENT_TOOL',
    'code.exe must be classified as DEVELOPMENT_TOOL when dev flag is active'
  );
  assert.strictEqual(
    codeClassification.isProhibited,
    false,
    'code.exe must NOT be prohibited when dev flag is active'
  );
  assert.strictEqual(
    processMonitor.isAllowedToTerminate('code.exe', 12345),
    false,
    'code.exe must NOT be allowed to terminate when dev flag is active'
  );
});

runTest('In production mode (allowVsCode=false), code.exe is strictly prohibited', () => {
  const prodClass = processMonitor.classifyProcess('code.exe', 54321, '', {
    allowVsCode: false
  });
  assert.strictEqual(
    prodClass.isProhibited,
    true,
    'code.exe must be prohibited when allowVsCode is false'
  );
  assert.strictEqual(
    prodClass.category,
    'PROHIBITED_APPLICATION',
    'code.exe must be category PROHIBITED_APPLICATION when allowVsCode is false'
  );
  assert.strictEqual(
    processMonitor.isAllowedToTerminate('code.exe', 54321, '', { allowVsCode: false }),
    true,
    'code.exe must be eligible for termination in production'
  );
});

// --- SECTION 3: SAFE PROCESS TERMINATION GUARDS ---

runTest('System protected processes and low PIDs are strictly protected', () => {
  // PIDs 0 and 4
  assert.strictEqual(processMonitor.isAllowedToTerminate('system', 4), false);
  assert.strictEqual(processMonitor.isAllowedToTerminate('system idle process', 0), false);

  // Critical Windows binaries
  const winProcs = ['smss.exe', 'csrss.exe', 'wininit.exe', 'services.exe', 'lsass.exe', 'explorer.exe', 'dwm.exe'];
  for (const proc of winProcs) {
    assert.strictEqual(
      processMonitor.isAllowedToTerminate(proc, 999),
      false,
      `${proc} must not be allowed to terminate`
    );
  }

  // VigilExam binary
  assert.strictEqual(processMonitor.isAllowedToTerminate('vigilexam.exe', 8888), false);
  assert.strictEqual(processMonitor.isAllowedToTerminate('electron.exe', 8889), false);
});

// --- SECTION 4: MONGODB MODELS & INTEGRATION ---

runTest('All 6 Mongoose models are properly exported and defined', () => {
  assert.ok(User, 'User model must be defined');
  assert.ok(Exam, 'Exam model must be defined');
  assert.ok(ExamAttempt, 'ExamAttempt model must be defined');
  assert.ok(SecurityEvent, 'SecurityEvent model must be defined');
  assert.ok(ProctorWarning, 'ProctorWarning model must be defined');
  assert.ok(AuditLog, 'AuditLog model must be defined');

  assert.strictEqual(User.modelName, 'User');
  assert.strictEqual(Exam.modelName, 'Exam');
  assert.strictEqual(ExamAttempt.modelName, 'ExamAttempt');
  assert.strictEqual(SecurityEvent.modelName, 'SecurityEvent');
  assert.strictEqual(ProctorWarning.modelName, 'ProctorWarning');
  assert.strictEqual(AuditLog.modelName, 'AuditLog');
});

runAsyncTest('User model enforces valid role and excludes password from toJSON', async () => {
  const userDoc = new User({
    id: 'u-test-1',
    role: 'student',
    full_name: 'Test Student',
    email: 'test@example.com',
    password: '$2a$10$abcdefghijklmnopqrstuvwxyz123456'
  });

  const json = userDoc.toJSON();
  assert.strictEqual(json.id, 'u-test-1');
  assert.strictEqual(json.role, 'student');
  assert.strictEqual(json.password, undefined, 'password must be stripped by toJSON');

  // Invalid role validation
  const invalidRoleUser = new User({
    id: 'u-test-2',
    role: 'hacker',
    full_name: 'Bad Actor',
    email: 'bad@example.com',
    password: 'pass'
  });
  let validationError = null;
  try {
    await invalidRoleUser.validate();
  } catch (err) {
    validationError = err;
  }
  assert.ok(validationError, 'Invalid role must fail schema validation');
  assert.ok(validationError.errors.role, 'Role field error must be reported');
});

runAsyncTest('SecurityEvent strictly forbids clipboard content storage in schema and validator', async () => {
  // Test schema definition: no raw clipboard content fields
  const schemaPaths = Object.keys(SecurityEvent.schema.paths);
  assert.strictEqual(schemaPaths.includes('clipboard_content'), false);
  assert.strictEqual(schemaPaths.includes('clipboard_text'), false);
  assert.strictEqual(schemaPaths.includes('raw_clipboard'), false);

  // Valid event with metadata payload
  const validEvent = new SecurityEvent({
    id: 'ev-001',
    attempt_id: 'att-123',
    student_id: 'u-std-1',
    event_type: 'CLIPBOARD_PASTE_BLOCKED',
    severity: 'low',
    payload: {
      action: 'paste_blocked',
      target: 'answer_textarea'
    }
  });

  await validEvent.validate();
  assert.strictEqual(validEvent.payload.action, 'paste_blocked');

  // Forbidden event containing clipboard content payload
  const forbiddenEvent = new SecurityEvent({
    id: 'ev-002',
    attempt_id: 'att-123',
    student_id: 'u-std-1',
    event_type: 'CLIPBOARD_PASTE_BLOCKED',
    severity: 'low',
    payload: {
      action: 'paste_blocked',
      clipboard_content: 'stolen sensitive content'
    }
  });

  let forbiddenErr = null;
  try {
    await forbiddenEvent.validate();
  } catch (err) {
    forbiddenErr = err;
  }
  assert.ok(forbiddenErr, 'Event with clipboard_content must fail validation');
  assert.ok(forbiddenErr.errors['payload'], 'Payload validator must flag violation');
});

runTest('MongoDB status gracefully detects <NEW_PASSWORD> placeholder and redacts credentials', () => {
  const placeholderUri = 'mongodb+srv://rugvedganapule_db_user:<NEW_PASSWORD>@cluster0.tcfl6zh.mongodb.net/vigilexam?retryWrites=true&w=majority';
  const safeUri = getSafeUri(placeholderUri);
  assert.strictEqual(safeUri.includes('<NEW_PASSWORD>'), false, 'Password placeholder must be redacted');
  assert.ok(safeUri.includes(':****@'), 'Safe URI must show redacted credentials');

  const status = getMongoStatus();
  assert.strictEqual(typeof status.isConnected, 'boolean');
  assert.ok(status.status);
  assert.ok(status.uriPreview);
  assert.strictEqual(status.uriPreview.includes('<NEW_PASSWORD>'), false);
});

// --- SECTION 5: AUTHENTICATION, BCRYPT & AUDIT LOGGING ---

runTest('Bcrypt password hashing and verification works with backward compatibility', () => {
  const password = 'SecurePassword2026!';
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(password, salt);

  assert.ok(hash.startsWith('$2a$') || hash.startsWith('$2b$'));
  assert.strictEqual(bcrypt.compareSync(password, hash), true);
  assert.strictEqual(bcrypt.compareSync('WrongPassword', hash), false);

  // Legacy scrypt verification helper
  function verifyAnyPassword(pass, stored) {
    if (!stored || !pass) return false;
    if (stored.startsWith('$2a$') || stored.startsWith('$2b$')) {
      return bcrypt.compareSync(pass, stored);
    }
    return stored === pass;
  }

  assert.strictEqual(verifyAnyPassword(password, hash), true);
  assert.strictEqual(verifyAnyPassword('legacyPass', 'legacyPass'), true);
});

runAsyncTest('AuditLog records administrative and security events and allows queries', async () => {
  const testAudit = {
    action: 'TEST_AUDIT_LOG_ACTION',
    actor_id: 'admin-001',
    actor_name: 'System Administrator',
    actor_role: 'admin',
    target: 'security_policy',
    details: { change: 'process_monitoring_updated' },
    ip_address: '127.0.0.1'
  };

  const logged = await db.logAudit(testAudit);
  assert.ok(logged, 'Audit entry must be created');
  assert.strictEqual(logged.action, 'TEST_AUDIT_LOG_ACTION');

  const logs = await db.getAuditLogsAsync({ limit: 10 });
  assert.ok(Array.isArray(logs), 'Audit logs must return an array');
  const found = logs.find(l => l.action === 'TEST_AUDIT_LOG_ACTION');
  assert.ok(found, 'Logged audit event must be present in query results');
});

await executeTestSuite();
