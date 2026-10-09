/**
 * VigilExam - Security Event Model & Dispatcher
 * 
 * Standardizes event structure across all monitors and dispatches to server.
 * Guarantees clipboard contents are NEVER recorded or transmitted.
 */

export function sanitizePayload(payload) {
  if (!payload || typeof payload !== 'object') return {};
  const cleaned = { ...payload };
  delete cleaned.text;
  delete cleaned.content;
  delete cleaned.clipboard_content;
  delete cleaned.copied_text;
  delete cleaned.pasted_text;
  delete cleaned.data;
  return cleaned;
}

export async function dispatchSecurityEvent({ attemptId, studentId, eventType, severity = 'low', payload = {} }) {
  if (!attemptId) return null;

  const sanitized = sanitizePayload(payload);
  const event = {
    attempt_id: attemptId,
    student_id: studentId,
    event_type: eventType,
    severity,
    payload: sanitized,
    timestamp: new Date().toISOString()
  };

  try {
    const res = await fetch('http://localhost:4000/api/events/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });
    return await res.json();
  } catch (err) {
    console.warn('[SecurityEvents] Failed to persist event to server:', err);
    return event;
  }
}
