/**
 * VigilExam - Centralized Clipboard & Copy/Paste Security Handler
 * 
 * Enforces strict examination clipboard restrictions across:
 * - copy / cut / paste events
 * - beforeinput events (insertFromPaste, insertFromDrop, deleteByCut)
 * - contextmenu events (right-click inspections/copy/paste menus)
 * - drag and drop events (dragstart, dragover, drop)
 * - keyboard shortcut events (Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A, Ctrl+Insert, Shift+Insert)
 * 
 * Records metadata only. NEVER records or transmits clipboard contents.
 */

export const DEFAULT_CLIPBOARD_POLICY = {
  block_copy: true,
  block_paste: true,
  block_cut: true,
  block_context_menu: true,
  block_drag_drop: true,
  clear_clipboard_on_exam_start: true,
  clear_clipboard_on_exam_end: true,
  log_attempts: true
};

/**
 * Normalizes exam security policy into a standardized clipboard_policy object.
 * Supports both nested security_policy.clipboard format and flat clipboard_policy format.
 */
export function normalizeClipboardPolicy(rawPolicy) {
  if (!rawPolicy) {
    return { ...DEFAULT_CLIPBOARD_POLICY };
  }

  // Handle nested test.security_policy.clipboard format
  const clip = rawPolicy.clipboard || rawPolicy;

  return {
    block_copy: clip.copy !== undefined ? !clip.copy : (clip.block_copy ?? DEFAULT_CLIPBOARD_POLICY.block_copy),
    block_paste: clip.paste !== undefined ? !clip.paste : (clip.block_paste ?? DEFAULT_CLIPBOARD_POLICY.block_paste),
    block_cut: clip.cut !== undefined ? !clip.cut : (clip.block_cut ?? DEFAULT_CLIPBOARD_POLICY.block_cut),
    block_context_menu: clip.context_menu !== undefined ? !clip.context_menu : (clip.block_context_menu ?? DEFAULT_CLIPBOARD_POLICY.block_context_menu),
    block_drag_drop: clip.drag_drop !== undefined ? !clip.drag_drop : (clip.block_drag_drop ?? DEFAULT_CLIPBOARD_POLICY.block_drag_drop),
    clear_clipboard_on_exam_start: clip.clear_on_start ?? (clip.clear_clipboard_on_exam_start ?? DEFAULT_CLIPBOARD_POLICY.clear_clipboard_on_exam_start),
    clear_clipboard_on_exam_end: clip.clear_on_end ?? (clip.clear_clipboard_on_exam_end ?? DEFAULT_CLIPBOARD_POLICY.clear_clipboard_on_exam_end),
    log_attempts: clip.log_attempts ?? DEFAULT_CLIPBOARD_POLICY.log_attempts
  };
}

/**
 * Attaches centralized security event listeners to prevent unauthorized clipboard
 * actions and log non-sensitive security metadata.
 * 
 * @param {Object} options
 * @param {Object} options.policy Exam clipboard policy
 * @param {string} options.attemptId Current exam attempt ID
 * @param {string} options.studentId Current student ID
 * @param {Function} options.onWarning Callback for displaying non-blocking UI warnings: (message, type) => void
 * @param {Function} options.onViolation Callback to record security metadata: (eventType, metadata, severity) => void
 * @param {Function|boolean} options.isExamActive Predicate or boolean indicating if exam is active (in_progress)
 * @param {EventTarget} options.target Target DOM element to bind to (defaults to window)
 * @returns {Object} { cleanup, updatePolicy, recordAttempt }
 */
export function preventClipboardActions(options = {}) {
  let policy = normalizeClipboardPolicy(options.policy);
  const attemptId = options.attemptId || null;
  const studentId = options.studentId || null;
  const onWarning = options.onWarning || (() => {});
  const onViolation = options.onViolation || (() => {});
  const isExamActive = typeof options.isExamActive === 'function'
    ? options.isExamActive
    : () => (options.isExamActive !== undefined ? Boolean(options.isExamActive) : true);
  const target = options.target || (typeof window !== 'undefined' ? window : null);

  if (!target) {
    return {
      cleanup: () => {},
      updatePolicy: () => {},
      recordAttempt: () => {}
    };
  }

  // Attempt counters for severity escalation
  const attemptCounts = {
    PASTE_ATTEMPT: 0,
    COPY_ATTEMPT: 0,
    CUT_ATTEMPT: 0,
    CLIPBOARD_ACCESS_ATTEMPT: 0,
    DRAG_DROP_ATTEMPT: 0,
    SELECT_ALL_ATTEMPT: 0
  };

  // Determine severity based on attempt frequency
  const calculateSeverity = (eventType) => {
    const count = attemptCounts[eventType] || 1;
    if (count === 1) return 'info';
    if (count <= 3) return 'low';
    return 'medium';
  };

  /**
   * Safely logs security metadata without recording clipboard or text contents.
   */
  const logSecurityMetadata = (eventType, source = 'keyboard') => {
    attemptCounts[eventType] = (attemptCounts[eventType] || 0) + 1;
    const severity = calculateSeverity(eventType);

    if (policy.log_attempts && onViolation) {
      const eventMetadata = {
        attempt_id: attemptId,
        student_id: studentId,
        event_type: eventType,
        timestamp: new Date().toISOString(),
        source: source // "keyboard" | "context_menu" | "editor" | "drag_drop"
      };

      onViolation(eventType, eventMetadata, severity);
    }
  };

  // Helper to determine if target is an editable input or code editor
  const isEditorTarget = (element) => {
    if (!element) return false;
    const tagName = element.tagName ? element.tagName.toLowerCase() : '';
    if (tagName === 'textarea' || tagName === 'input') return true;
    if (element.isContentEditable || element.getAttribute?.('contenteditable') === 'true') return true;
    if (element.closest?.('.monaco-editor, .code-editor, textarea, input, [contenteditable="true"]')) return true;
    return false;
  };

  // 1. COPY Handler
  const handleCopy = (event) => {
    if (!isExamActive() || !policy.block_copy) return;
    event.preventDefault();
    if (event.clipboardData) {
      try {
        event.clipboardData.clearData();
      } catch (e) {
        // Ignore clipboard clear errors
      }
    }
    const source = isEditorTarget(event.target) ? 'editor' : 'keyboard';
    logSecurityMetadata('COPY_ATTEMPT', source);
    onWarning('Copying is disabled during this examination.', 'copy');
  };

  // 2. CUT Handler
  const handleCut = (event) => {
    if (!isExamActive() || !policy.block_cut) return;
    event.preventDefault();
    if (event.clipboardData) {
      try {
        event.clipboardData.clearData();
      } catch (e) {
        // Ignore clipboard clear errors
      }
    }
    const source = isEditorTarget(event.target) ? 'editor' : 'keyboard';
    logSecurityMetadata('CUT_ATTEMPT', source);
    onWarning('Cut is disabled during this examination.', 'cut');
  };

  // 3. PASTE Handler
  const handlePaste = (event) => {
    if (!isExamActive() || !policy.block_paste) return;
    event.preventDefault();
    const source = isEditorTarget(event.target) ? 'editor' : 'keyboard';
    logSecurityMetadata('PASTE_ATTEMPT', source);
    onWarning('Paste is disabled during this examination.', 'paste');
  };

  // 4. BEFOREINPUT Handler (Catches simulated inputs, edit actions, and drag drops)
  const handleBeforeInput = (event) => {
    if (!isExamActive()) return;

    if (event.inputType === 'insertFromPaste' || event.inputType === 'insertFromPasteAsQuotation') {
      if (policy.block_paste) {
        event.preventDefault();
        logSecurityMetadata('PASTE_ATTEMPT', isEditorTarget(event.target) ? 'editor' : 'keyboard');
        onWarning('Paste is disabled during this examination.', 'paste');
      }
    } else if (event.inputType === 'deleteByCut') {
      if (policy.block_cut) {
        event.preventDefault();
        logSecurityMetadata('CUT_ATTEMPT', isEditorTarget(event.target) ? 'editor' : 'keyboard');
        onWarning('Cut is disabled during this examination.', 'cut');
      }
    } else if (event.inputType === 'insertFromDrop') {
      if (policy.block_drag_drop) {
        event.preventDefault();
        logSecurityMetadata('DRAG_DROP_ATTEMPT', 'drag_drop');
        onWarning('Drag and drop is disabled during this examination.', 'drag_drop');
      }
    }
    // All normal inputs (insertText, deleteContentBackward, insertLineBreak, etc.) pass through smoothly!
  };

  // 5. CONTEXT MENU Handler
  const handleContextMenu = (event) => {
    if (!isExamActive() || !policy.block_context_menu) return;
    event.preventDefault();
    logSecurityMetadata('CLIPBOARD_ACCESS_ATTEMPT', 'context_menu');
  };

  // 6. DRAG & DROP Handlers
  const handleDragStart = (event) => {
    if (!isExamActive() || !policy.block_drag_drop) return;
    // Prevent dragging question text or UI components
    event.preventDefault();
  };

  const handleDragOver = (event) => {
    if (!isExamActive() || !policy.block_drag_drop) return;
    // Explicitly reject drop
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'none';
    }
  };

  const handleDrop = (event) => {
    if (!isExamActive() || !policy.block_drag_drop) return;
    event.preventDefault();
    logSecurityMetadata('DRAG_DROP_ATTEMPT', 'drag_drop');
    onWarning('Drag and drop is disabled during this examination.', 'drag_drop');
  };

  // 7. KEYBOARD SHORTCUTS Handler (Renderer level protection)
  const handleKeyDown = (event) => {
    if (!isExamActive()) return;

    const key = event.key ? event.key.toLowerCase() : '';
    const isCtrlOrMeta = event.ctrlKey || event.metaKey;

    // Block Ctrl+C and Ctrl+Insert (Copy)
    if ((isCtrlOrMeta && key === 'c') || (event.ctrlKey && event.key === 'Insert')) {
      if (policy.block_copy) {
        event.preventDefault();
        const source = isEditorTarget(event.target) ? 'editor' : 'keyboard';
        logSecurityMetadata('COPY_ATTEMPT', source);
        onWarning('Copying is disabled during this examination.', 'copy');
      }
    }

    // Block Ctrl+V and Shift+Insert (Paste)
    else if ((isCtrlOrMeta && key === 'v') || (event.shiftKey && event.key === 'Insert')) {
      if (policy.block_paste) {
        event.preventDefault();
        const source = isEditorTarget(event.target) ? 'editor' : 'keyboard';
        logSecurityMetadata('PASTE_ATTEMPT', source);
        onWarning('Paste is disabled during this examination.', 'paste');
      }
    }

    // Block Ctrl+X (Cut)
    else if (isCtrlOrMeta && key === 'x') {
      if (policy.block_cut) {
        event.preventDefault();
        const source = isEditorTarget(event.target) ? 'editor' : 'keyboard';
        logSecurityMetadata('CUT_ATTEMPT', source);
        onWarning('Cut is disabled during this examination.', 'cut');
      }
    }

    // Block Ctrl+A (Select All across exam)
    else if (isCtrlOrMeta && key === 'a') {
      // If student is inside an answer field, allow selecting inside field if permitted,
      // but if policy blocks select all or student is on exam content, block it!
      if (!isEditorTarget(event.target)) {
        event.preventDefault();
        logSecurityMetadata('SELECT_ALL_ATTEMPT', 'keyboard');
      }
    }

    // Block DevTools shortcuts
    else if (event.key === 'F12' || (event.ctrlKey && event.shiftKey && key === 'i')) {
      event.preventDefault();
    }
  };

  // Attach event listeners in capture phase for maximum interception reliability
  target.addEventListener('copy', handleCopy, true);
  target.addEventListener('cut', handleCut, true);
  target.addEventListener('paste', handlePaste, true);
  target.addEventListener('beforeinput', handleBeforeInput, true);
  target.addEventListener('contextmenu', handleContextMenu, true);
  target.addEventListener('dragstart', handleDragStart, true);
  target.addEventListener('dragover', handleDragOver, true);
  target.addEventListener('drop', handleDrop, true);
  target.addEventListener('keydown', handleKeyDown, true);

  return {
    cleanup: () => {
      target.removeEventListener('copy', handleCopy, true);
      target.removeEventListener('cut', handleCut, true);
      target.removeEventListener('paste', handlePaste, true);
      target.removeEventListener('beforeinput', handleBeforeInput, true);
      target.removeEventListener('contextmenu', handleContextMenu, true);
      target.removeEventListener('dragstart', handleDragStart, true);
      target.removeEventListener('dragover', handleDragOver, true);
      target.removeEventListener('drop', handleDrop, true);
      target.removeEventListener('keydown', handleKeyDown, true);
    },
    updatePolicy: (newPolicy) => {
      policy = normalizeClipboardPolicy(newPolicy);
    },
    recordAttempt: (eventType, source = 'keyboard') => {
      logSecurityMetadata(eventType, source);
    }
  };
}
