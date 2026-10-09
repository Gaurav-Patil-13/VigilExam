/**
 * VigilExam - Central Security Risk Engine
 * 
 * Computes calibrated risk scores based on graduated event severity weights.
 * Capped strictly at 100.
 */

export const RISK_WEIGHTS = {
  FACE_NOT_DETECTED: 10,
  MULTIPLE_FACES_DETECTED: 25,
  MULTIPLE_FACES: 25,
  PROHIBITED_PROCESS_DETECTED: 25,
  REMOTE_ACCESS_DETECTED: 40,
  SCREEN_RECORDER_DETECTED: 35,
  MULTIPLE_DISPLAY_CONNECTED: 20,
  MULTIPLE_DISPLAY: 20,
  WINDOW_BLUR: 10,
  CLIPBOARD_ATTEMPT: 5,
  COPY_ATTEMPT: 5,
  PASTE_ATTEMPT: 5,
  CUT_ATTEMPT: 5,
  KIOSK_EXIT_ATTEMPT: 30,
  NETWORK_DISCONNECTED: 5
};

export function getRiskLevel(score) {
  if (score >= 70) return 'CRITICAL';
  if (score >= 40) return 'HIGH';
  if (score >= 20) return 'MEDIUM';
  return 'LOW';
}

export function calculateNewRisk(currentScore, eventType) {
  const weight = RISK_WEIGHTS[eventType] || 5;
  const newScore = Math.min(100, Math.max(0, (currentScore || 0) + weight));
  return {
    score: newScore,
    level: getRiskLevel(newScore),
    addedWeight: weight
  };
}

export function evaluateKioskSecurityState(currentRisk, activeViolations = {}) {
  const {
    unauthorizedProcessActive,
    multiDisplayActive,
    blurCount = 0,
    kioskExitAttempts = 0
  } = activeViolations;

  if (unauthorizedProcessActive || kioskExitAttempts > 0 || currentRisk >= 70) {
    return 'COMPROMISED';
  }

  if (multiDisplayActive || blurCount > 0 || currentRisk >= 30) {
    return 'WARNING';
  }

  return 'SECURE';
}
