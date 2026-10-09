/**
 * VigilExam - Clipboard Security Guard Module
 * 
 * Re-exports and integrates strict copy/paste/cut/drop restrictions.
 */

export {
  preventClipboardActions,
  normalizeClipboardPolicy,
  DEFAULT_CLIPBOARD_POLICY,
  formatClipboardSecurityEvent
} from '../utils/clipboardSecurity.js';
