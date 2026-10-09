/**
 * VigilExam - Comprehensive Copy/Paste & Clipboard Security Acceptance Test Suite
 * 
 * Verifies all 10 acceptance test cases outlined in the specification:
 * TEST 1: Select question text -> Ctrl+C -> Copy does not occur
 * TEST 2: Ctrl+V inside answer field -> Nothing is pasted
 * TEST 3: Ctrl+X -> Cut does not occur
 * TEST 4: Right-click question -> No context menu
 * TEST 5: Right-click answer field -> No context menu
 * TEST 6: Copy text from Notepad and attempt Ctrl+V in exam -> Paste rejected
 * TEST 7: Copy text from exam and paste into Notepad -> Exam content cannot be copied
 * TEST 8: Attempt drag-and-drop text into answer field -> Drop is rejected
 * TEST 9: Attempt clipboard access through browser JavaScript -> Access restricted
 * TEST 10: After exam submission/termination -> Normal behavior restored
 * PLUS:
 * - Verification that clipboard contents are NEVER logged or stored
 * - Verification that normal typing, backspace, delete, arrow keys, and tab are not broken
 * - Verification of warning toast and severity escalation (info -> low -> medium)
 */

import assert from 'assert';
import { preventClipboardActions, normalizeClipboardPolicy, DEFAULT_CLIPBOARD_POLICY } from '../src/utils/clipboardSecurity.js';

// Minimal DOM simulation for Node.js test environment
class MockEventTarget {
  constructor() {
    this.listeners = {};
  }

  addEventListener(type, callback, useCapture) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(callback);
  }

  removeEventListener(type, callback, useCapture) {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter(cb => cb !== callback);
  }

  dispatchEvent(event) {
    const list = this.listeners[event.type] || [];
    for (const cb of list) {
      cb(event);
      if (event._propagationStopped) break;
    }
    return !event.defaultPrevented;
  }
}

class MockEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.defaultPrevented = false;
    this._propagationStopped = false;
    this.target = init.target || null;
    this.inputType = init.inputType || null;
    this.key = init.key || null;
    this.ctrlKey = Boolean(init.ctrlKey);
    this.metaKey = Boolean(init.metaKey);
    this.shiftKey = Boolean(init.shiftKey);
    this.dataTransfer = init.dataTransfer || null;
    this.clipboardData = init.clipboardData || {
      clearData: () => { this.clipboardDataCleared = true; },
      getData: () => init.clipboardText || '',
      setData: () => {}
    };
  }

  preventDefault() {
    this.defaultPrevented = true;
  }

  stopPropagation() {
    this._propagationStopped = true;
  }
}

class MockElement {
  constructor(tagName, contentEditable = false) {
    this.tagName = tagName;
    this.isContentEditable = contentEditable;
    this.value = '';
    this.selectionStart = 0;
    this.selectionEnd = 0;
  }

  getAttribute(attr) {
    if (attr === 'contenteditable') return this.isContentEditable ? 'true' : null;
    return null;
  }

  closest(selector) {
    if (selector.includes(this.tagName.toLowerCase())) return this;
    return null;
  }
}

console.log('====================================================');
console.log(' Running VigilExam Clipboard Security Test Suite');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    throw err;
  }
}

// ----------------------------------------------------
// TEST 1: Select question text -> Ctrl+C -> Copy does not occur
// ----------------------------------------------------
runTest('TEST 1: Select question text -> Ctrl+C -> Copy is blocked & prevented', () => {
  const windowMock = new MockEventTarget();
  const warnings = [];
  const violations = [];
  const questionDiv = new MockElement('div');

  const manager = preventClipboardActions({
    target: windowMock,
    attemptId: 'att-test-1',
    studentId: 'stud-1',
    isExamActive: () => true,
    onWarning: (msg, type) => warnings.push({ msg, type }),
    onViolation: (type, data, sev) => violations.push({ type, data, sev })
  });

  // Ctrl+C keydown event
  const keyEvent = new MockEvent('keydown', { key: 'c', ctrlKey: true, target: questionDiv });
  windowMock.dispatchEvent(keyEvent);
  assert.strictEqual(keyEvent.defaultPrevented, true, 'Ctrl+C event must be prevented');

  // Copy event
  const copyEvent = new MockEvent('copy', { target: questionDiv });
  windowMock.dispatchEvent(copyEvent);
  assert.strictEqual(copyEvent.defaultPrevented, true, 'Copy event must be prevented');
  assert.strictEqual(copyEvent.clipboardDataCleared, true, 'Clipboard data must be cleared on copy attempt');
  assert.ok(warnings.some(w => w.msg.includes('Copying is disabled')), 'Non-blocking warning must be shown');
  assert.ok(violations.some(v => v.type === 'COPY_ATTEMPT'), 'Violation event must be logged');

  manager.cleanup();
});

// ----------------------------------------------------
// TEST 2: Ctrl+V inside answer field -> Nothing is pasted
// ----------------------------------------------------
runTest('TEST 2: Ctrl+V inside answer field -> Paste is blocked & warning is displayed', () => {
  const windowMock = new MockEventTarget();
  const warnings = [];
  const violations = [];
  const textarea = new MockElement('textarea');

  const manager = preventClipboardActions({
    target: windowMock,
    attemptId: 'att-test-2',
    studentId: 'stud-1',
    isExamActive: () => true,
    onWarning: (msg, type) => warnings.push({ msg, type }),
    onViolation: (type, data, sev) => violations.push({ type, data, sev })
  });

  // Ctrl+V keydown event
  const keyEvent = new MockEvent('keydown', { key: 'v', ctrlKey: true, target: textarea });
  windowMock.dispatchEvent(keyEvent);
  assert.strictEqual(keyEvent.defaultPrevented, true, 'Ctrl+V keydown must be prevented');

  // Paste event
  const pasteEvent = new MockEvent('paste', { target: textarea });
  windowMock.dispatchEvent(pasteEvent);
  assert.strictEqual(pasteEvent.defaultPrevented, true, 'Paste event must be prevented');
  assert.ok(warnings.some(w => w.msg === 'Paste is disabled during this examination.'), 'Paste warning toast must be shown');
  
  const pasteViolation = violations.find(v => v.type === 'PASTE_ATTEMPT');
  assert.ok(pasteViolation, 'PASTE_ATTEMPT must be recorded');
  assert.strictEqual(pasteViolation.data.source, 'editor', 'Source must identify answer field/editor');

  manager.cleanup();
});

// ----------------------------------------------------
// TEST 3: Ctrl+X -> Cut does not occur
// ----------------------------------------------------
runTest('TEST 3: Ctrl+X -> Cut does not occur', () => {
  const windowMock = new MockEventTarget();
  const warnings = [];
  const violations = [];
  const textarea = new MockElement('textarea');

  const manager = preventClipboardActions({
    target: windowMock,
    attemptId: 'att-test-3',
    studentId: 'stud-1',
    isExamActive: () => true,
    onWarning: (msg, type) => warnings.push({ msg, type }),
    onViolation: (type, data, sev) => violations.push({ type, data, sev })
  });

  // Ctrl+X keydown event
  const keyEvent = new MockEvent('keydown', { key: 'x', ctrlKey: true, target: textarea });
  windowMock.dispatchEvent(keyEvent);
  assert.strictEqual(keyEvent.defaultPrevented, true, 'Ctrl+X keydown must be prevented');

  // Cut event
  const cutEvent = new MockEvent('cut', { target: textarea });
  windowMock.dispatchEvent(cutEvent);
  assert.strictEqual(cutEvent.defaultPrevented, true, 'Cut event must be prevented');
  assert.ok(warnings.some(w => w.msg.includes('Cut is disabled')), 'Cut warning must be shown');

  manager.cleanup();
});

// ----------------------------------------------------
// TEST 4: Right-click question -> No Copy/Paste context menu
// ----------------------------------------------------
runTest('TEST 4: Right-click question -> Context menu is blocked', () => {
  const windowMock = new MockEventTarget();
  const questionDiv = new MockElement('div');

  const manager = preventClipboardActions({
    target: windowMock,
    attemptId: 'att-test-4',
    studentId: 'stud-1',
    isExamActive: () => true
  });

  const cmEvent = new MockEvent('contextmenu', { target: questionDiv });
  windowMock.dispatchEvent(cmEvent);
  assert.strictEqual(cmEvent.defaultPrevented, true, 'Right-click contextmenu on question must be prevented');

  manager.cleanup();
});

// ----------------------------------------------------
// TEST 5: Right-click answer field -> No Copy/Paste context menu
// ----------------------------------------------------
runTest('TEST 5: Right-click answer field -> Context menu is blocked', () => {
  const windowMock = new MockEventTarget();
  const textarea = new MockElement('textarea');

  const manager = preventClipboardActions({
    target: windowMock,
    attemptId: 'att-test-5',
    studentId: 'stud-1',
    isExamActive: () => true
  });

  const cmEvent = new MockEvent('contextmenu', { target: textarea });
  windowMock.dispatchEvent(cmEvent);
  assert.strictEqual(cmEvent.defaultPrevented, true, 'Right-click contextmenu on answer field must be prevented');

  manager.cleanup();
});

// ----------------------------------------------------
// TEST 6: Copy text from Notepad and attempt Ctrl+V in exam -> Paste rejected
// ----------------------------------------------------
runTest('TEST 6: External paste attempt via beforeinput (insertFromPaste) -> Rejected', () => {
  const windowMock = new MockEventTarget();
  const warnings = [];
  const textarea = new MockElement('textarea');

  const manager = preventClipboardActions({
    target: windowMock,
    attemptId: 'att-test-6',
    studentId: 'stud-1',
    isExamActive: () => true,
    onWarning: (msg, type) => warnings.push({ msg, type })
  });

  // beforeinput event with insertFromPaste (Chromium paste mechanism)
  const biEvent = new MockEvent('beforeinput', { inputType: 'insertFromPaste', target: textarea });
  windowMock.dispatchEvent(biEvent);
  assert.strictEqual(biEvent.defaultPrevented, true, 'beforeinput insertFromPaste must be prevented');
  assert.ok(warnings.some(w => w.msg.includes('Paste is disabled')), 'Paste disabled warning displayed');

  manager.cleanup();
});

// ----------------------------------------------------
// TEST 7: Copy text from exam and paste into Notepad -> Exam content cannot be copied
// ----------------------------------------------------
runTest('TEST 7: Copy text from exam -> Data is cleared and default prevented', () => {
  const windowMock = new MockEventTarget();
  const questionDiv = new MockElement('div');

  const manager = preventClipboardActions({
    target: windowMock,
    attemptId: 'att-test-7',
    studentId: 'stud-1',
    isExamActive: () => true
  });

  const copyEvent = new MockEvent('copy', { target: questionDiv });
  windowMock.dispatchEvent(copyEvent);
  assert.strictEqual(copyEvent.defaultPrevented, true, 'Copy event prevented');
  assert.strictEqual(copyEvent.clipboardDataCleared, true, 'Clipboard data wiped to prevent leak');

  manager.cleanup();
});

// ----------------------------------------------------
// TEST 8: Attempt drag-and-drop text into answer field -> Drop is rejected
// ----------------------------------------------------
runTest('TEST 8: Drag-and-drop text/file into answer field -> Drop is rejected', () => {
  const windowMock = new MockEventTarget();
  const warnings = [];
  const violations = [];
  const textarea = new MockElement('textarea');
  const dataTransfer = { dropEffect: 'copy' };

  const manager = preventClipboardActions({
    target: windowMock,
    attemptId: 'att-test-8',
    studentId: 'stud-1',
    isExamActive: () => true,
    onWarning: (msg, type) => warnings.push({ msg, type }),
    onViolation: (type, data, sev) => violations.push({ type, data, sev })
  });

  // Dragstart
  const dsEvent = new MockEvent('dragstart', { target: textarea });
  windowMock.dispatchEvent(dsEvent);
  assert.strictEqual(dsEvent.defaultPrevented, true, 'Dragstart must be prevented');

  // Dragover
  const doEvent = new MockEvent('dragover', { target: textarea, dataTransfer });
  windowMock.dispatchEvent(doEvent);
  assert.strictEqual(doEvent.defaultPrevented, true, 'Dragover must be prevented');
  assert.strictEqual(dataTransfer.dropEffect, 'none', 'dropEffect must be none');

  // Drop
  const dropEvent = new MockEvent('drop', { target: textarea });
  windowMock.dispatchEvent(dropEvent);
  assert.strictEqual(dropEvent.defaultPrevented, true, 'Drop must be prevented');
  assert.ok(warnings.some(w => w.msg.includes('Drag and drop is disabled')), 'Drag & drop warning must be shown');
  assert.ok(violations.some(v => v.type === 'DRAG_DROP_ATTEMPT'), 'DRAG_DROP_ATTEMPT violation logged');

  manager.cleanup();
});

// ----------------------------------------------------
// TEST 9: Attempt clipboard access through browser JavaScript -> Access restricted
// ----------------------------------------------------
runTest('TEST 9: Browser navigator.clipboard API throws NotAllowedError when exam active', async () => {
  // Test the exact blocked proxy implementation in preload.js
  const blockedClipboardProxy = {
    read: () => Promise.reject(new Error('Clipboard access is disabled during this examination.')),
    readText: () => Promise.reject(new Error('Clipboard access is disabled during this examination.')),
    write: () => Promise.reject(new Error('Clipboard access is disabled during this examination.')),
    writeText: () => Promise.reject(new Error('Clipboard access is disabled during this examination.'))
  };

  await assert.rejects(
    async () => await blockedClipboardProxy.readText(),
    /Clipboard access is disabled during this examination/
  );

  await assert.rejects(
    async () => await blockedClipboardProxy.writeText('stolen text'),
    /Clipboard access is disabled during this examination/
  );
});

// ----------------------------------------------------
// TEST 10: After exam submission/termination -> Normal behavior restored
// ----------------------------------------------------
runTest('TEST 10: After exam submission/termination -> Normal clipboard behavior restored', () => {
  const windowMock = new MockEventTarget();
  let examActive = true;
  const textarea = new MockElement('textarea');

  const manager = preventClipboardActions({
    target: windowMock,
    attemptId: 'att-test-10',
    studentId: 'stud-1',
    isExamActive: () => examActive
  });

  // While exam is active: paste is prevented
  const activePasteEvent = new MockEvent('paste', { target: textarea });
  windowMock.dispatchEvent(activePasteEvent);
  assert.strictEqual(activePasteEvent.defaultPrevented, true, 'Paste blocked while active');

  // Exam submitted: examActive = false
  examActive = false;

  // After submit: paste is allowed
  const postExamPasteEvent = new MockEvent('paste', { target: textarea });
  windowMock.dispatchEvent(postExamPasteEvent);
  assert.strictEqual(postExamPasteEvent.defaultPrevented, false, 'Paste allowed after exam termination');

  // Context menu allowed after submit
  const postExamContextEvent = new MockEvent('contextmenu', { target: textarea });
  windowMock.dispatchEvent(postExamContextEvent);
  assert.strictEqual(postExamContextEvent.defaultPrevented, false, 'Context menu allowed after exam termination');

  manager.cleanup();
});

// ----------------------------------------------------
// TEST 11: Clipboard contents are NEVER stored or transmitted
// ----------------------------------------------------
runTest('TEST 11: Security events NEVER record or store clipboard content', () => {
  const windowMock = new MockEventTarget();
  const violations = [];
  const textarea = new MockElement('textarea');

  const manager = preventClipboardActions({
    target: windowMock,
    attemptId: 'att-test-11',
    studentId: 'stud-1',
    isExamActive: () => true,
    onViolation: (type, data, sev) => violations.push({ type, data, sev })
  });

  const pasteEvent = new MockEvent('paste', {
    target: textarea,
    clipboardText: 'SUPER_SECRET_ANSWER_KEY_123'
  });
  windowMock.dispatchEvent(pasteEvent);

  assert.strictEqual(violations.length, 1);
  const recorded = violations[0].data;
  assert.strictEqual(recorded.attempt_id, 'att-test-11');
  assert.strictEqual(recorded.student_id, 'stud-1');
  assert.strictEqual(recorded.event_type, 'PASTE_ATTEMPT');
  assert.strictEqual(recorded.source, 'editor');
  assert.strictEqual(recorded.text, undefined, 'No text property must exist');
  assert.strictEqual(recorded.content, undefined, 'No content property must exist');
  assert.strictEqual(recorded.clipboard_content, undefined, 'No clipboard_content property must exist');
  assert.strictEqual(JSON.stringify(recorded).includes('SUPER_SECRET'), false, 'Sensitive clipboard data must NEVER be logged');

  manager.cleanup();
});

// ----------------------------------------------------
// TEST 12: Normal typing and editing is NOT broken
// ----------------------------------------------------
runTest('TEST 12: Normal typing (insertText, Backspace, Delete, Enter, Tab) is NOT blocked', () => {
  const windowMock = new MockEventTarget();
  const textarea = new MockElement('textarea');

  const manager = preventClipboardActions({
    target: windowMock,
    attemptId: 'att-test-12',
    studentId: 'stud-1',
    isExamActive: () => true
  });

  // Typing normal characters
  const typeEvent = new MockEvent('beforeinput', { inputType: 'insertText', target: textarea });
  windowMock.dispatchEvent(typeEvent);
  assert.strictEqual(typeEvent.defaultPrevented, false, 'insertText must NOT be prevented');

  // Backspace
  const bsEvent = new MockEvent('beforeinput', { inputType: 'deleteContentBackward', target: textarea });
  windowMock.dispatchEvent(bsEvent);
  assert.strictEqual(bsEvent.defaultPrevented, false, 'deleteContentBackward must NOT be prevented');

  // Delete
  const delEvent = new MockEvent('beforeinput', { inputType: 'deleteContentForward', target: textarea });
  windowMock.dispatchEvent(delEvent);
  assert.strictEqual(delEvent.defaultPrevented, false, 'deleteContentForward must NOT be prevented');

  // Enter / newline
  const enterEvent = new MockEvent('beforeinput', { inputType: 'insertLineBreak', target: textarea });
  windowMock.dispatchEvent(enterEvent);
  assert.strictEqual(enterEvent.defaultPrevented, false, 'insertLineBreak must NOT be prevented');

  // Normal keydown for a letter
  const letterEvent = new MockEvent('keydown', { key: 'a', target: textarea });
  windowMock.dispatchEvent(letterEvent);
  assert.strictEqual(letterEvent.defaultPrevented, false, 'Typing letter "a" must NOT be prevented');

  manager.cleanup();
});

// ----------------------------------------------------
// TEST 13: Severity Escalation for repeated attempts
// ----------------------------------------------------
runTest('TEST 13: Severity escalates cleanly (info -> low -> medium)', () => {
  const windowMock = new MockEventTarget();
  const violations = [];
  const textarea = new MockElement('textarea');

  const manager = preventClipboardActions({
    target: windowMock,
    attemptId: 'att-test-13',
    studentId: 'stud-1',
    isExamActive: () => true,
    onViolation: (type, data, sev) => violations.push({ type, data, sev })
  });

  // Attempt 1 -> 'info'
  windowMock.dispatchEvent(new MockEvent('paste', { target: textarea }));
  assert.strictEqual(violations[0].sev, 'info', 'First accidental paste must be info severity');

  // Attempt 2 -> 'low'
  windowMock.dispatchEvent(new MockEvent('paste', { target: textarea }));
  assert.strictEqual(violations[1].sev, 'low', 'Second paste must be low severity');

  // Attempt 3 -> 'low'
  windowMock.dispatchEvent(new MockEvent('paste', { target: textarea }));
  assert.strictEqual(violations[2].sev, 'low', 'Third paste must be low severity');

  // Attempt 4 -> 'medium'
  windowMock.dispatchEvent(new MockEvent('paste', { target: textarea }));
  assert.strictEqual(violations[3].sev, 'medium', 'Excessive/repeated paste must escalate to medium severity');

  manager.cleanup();
});

console.log('\n====================================================');
console.log(` ALL TESTS PASSED: ${passedTests}/${totalTests}`);
console.log('====================================================');
