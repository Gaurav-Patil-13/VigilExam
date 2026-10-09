import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import {
  Shield,
  Clock,
  Camera,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Bookmark,
  Code,
  Send,
  ExternalLink,
  ShieldAlert,
  Cpu,
  Lock,
  PowerOff,
  UserCheck,
  UserX,
  Users
} from 'lucide-react';
import { preventClipboardActions, normalizeClipboardPolicy } from '../../utils/clipboardSecurity';
import { faceMonitor } from '../../security/faceMonitor';
import { useSecurityMonitor } from '../../hooks/useSecurityMonitor';
import { calculateNewRisk, evaluateKioskSecurityState } from '../../security/riskEngine';

export const ExamKiosk = ({ test, attempt, onExamFinished }) => {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [bookmarks, setBookmarks] = useState([]);
  const [timeLeft, setTimeLeft] = useState((test.duration_minutes || 30) * 60);

  // Security & Kiosk States
  const [kioskStatus, setKioskStatus] = useState('SECURE'); // 'SECURE' | 'WARNING' | 'COMPROMISED'
  const [riskScore, setRiskScore] = useState(0);
  const [unauthorizedAppDetected, setUnauthorizedAppDetected] = useState(null);
  const [multiDisplayAlert, setMultiDisplayAlert] = useState(false);
  const [faceAlertMessage, setFaceAlertMessage] = useState(null);

  // Biometric Tracking
  const [faceState, setFaceState] = useState('ONE_FACE');
  const [faceCount, setFaceCount] = useState(1);
  const [isCameraActive, setIsCameraActive] = useState(true);

  // Termination State
  const [isTerminated, setIsTerminated] = useState(false);
  const [terminationReason, setTerminationReason] = useState('');

  // Clipboard Toast
  const [clipboardToast, setClipboardToast] = useState(null);
  const clipboardToastTimer = useRef(null);

  const videoRef = useRef(null);
  const blurCooldownTimer = useRef(null);

  const showClipboardToast = (message, type = 'paste') => {
    setClipboardToast({ message, type });
    clearTimeout(clipboardToastTimer.current);
    clipboardToastTimer.current = setTimeout(() => {
      setClipboardToast(null);
    }, 2500);
  };

  // Helper to log security violation to backend and update risk score
  const logViolation = useCallback(
    async (eventType, payload = {}, severity = 'low') => {
      if (!attempt) return;
      try {
        const res = await fetch('http://localhost:4000/api/events/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attempt_id: attempt.id,
            student_id: user.id,
            event_type: eventType,
            payload,
            severity
          })
        });

        // Compute local risk increment
        setRiskScore((prev) => {
          const calc = calculateNewRisk(prev, eventType);
          return calc.score;
        });
      } catch (e) {
        console.error('Failed to log violation:', e);
      }
    },
    [attempt, user.id]
  );

  // Update Kiosk Status and sync to server & socket
  const updateKioskSecurityStatus = useCallback(
    (status) => {
      setKioskStatus(status);
      if (attempt?.id) {
        fetch(`http://localhost:4000/api/attempts/${attempt.id}/kiosk-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kiosk_status: status })
        }).catch(() => {});
      }
      if (socket && attempt) {
        socket.emit('candidate_kiosk_status_update', {
          attempt_id: attempt.id,
          kiosk_status: status
        });
      }
    },
    [attempt, socket]
  );

  // Real-time Candidate Heartbeat & Proctor Warning Hook
  const { activeWarning, acknowledgeWarning } = useSecurityMonitor({
    attempt,
    student: user,
    telemetry: {
      cameraActive: isCameraActive,
      hasAudioTrack: true,
      faceState,
      displayCount: multiDisplayAlert ? 2 : 1,
      unauthorizedApp: unauthorizedAppDetected,
      isOnline: navigator.onLine,
      kioskStatus,
      riskScore
    },
    onProctorWarning: (warn) => {
      logViolation('PROCTOR_WARNING_RECEIVED', { message: warn.message }, 'medium');
      updateKioskSecurityStatus('WARNING');
    },
    onExamTerminated: (termData) => {
      setIsTerminated(true);
      setTerminationReason(termData.reason);
      cleanupExamEnvironment();
    }
  });

  // Safe Environment Cleanup
  const cleanupExamEnvironment = useCallback(() => {
    faceMonitor.stopCamera();
    if (window.vigilNative?.stopProcessMonitoring) {
      window.vigilNative.stopProcessMonitoring();
    }
    if (window.vigilNative?.disableKioskMode) {
      window.vigilNative.disableKioskMode();
    }
    window.vigilNative?.setExamClipboardSecurity?.({ active: false });
  }, []);

  // Main Kiosk Lockdown & Continuous Security Listeners Effect
  useEffect(() => {
    const clipboardPolicy = normalizeClipboardPolicy(test?.security_policy);

    // 1. Enable strict Electron Fullscreen Kiosk mode
    if (window.vigilNative?.enableKioskMode) {
      window.vigilNative.enableKioskMode();
    }

    // 2. Activate strict clipboard protection
    window.vigilNative?.setExamClipboardSecurity?.({
      active: true,
      policy: clipboardPolicy
    });

    // 3. Centralized clipboard handler
    const securityManager = preventClipboardActions({
      policy: clipboardPolicy,
      attemptId: attempt?.id,
      studentId: user?.id,
      isExamActive: () => !isTerminated,
      onWarning: (msg, type) => showClipboardToast(msg, type),
      onViolation: (eventType, metadata, severity) => {
        logViolation(eventType, metadata, severity);
      }
    });

    // 4. Start Native Continuous Process Watcher (scans every 1.5 seconds)
    if (window.vigilNative?.startProcessMonitoring) {
      window.vigilNative.startProcessMonitoring(1500);
    }

    const unbindProcessViolation = window.vigilNative?.onProcessViolation?.((event) => {
      if (event.type === 'PROHIBITED_PROCESS_DETECTED') {
        const proc = event.process || {};
        setUnauthorizedAppDetected(proc);
        logViolation(
          'PROHIBITED_PROCESS_DETECTED',
          { name: proc.name, pid: proc.pid, category: proc.subCategory },
          'critical'
        );
        updateKioskSecurityStatus('COMPROMISED');
      } else if (event.type === 'PROHIBITED_PROCESS_STOPPED') {
        setUnauthorizedAppDetected(null);
        updateKioskSecurityStatus('SECURE');
      }
    });

    // 5. Native Electron Listeners (Kiosk Exit, Displays, Blur)
    const unbindKioskExit = window.vigilNative?.onKioskExitAttempt?.((data) => {
      logViolation('KIOSK_EXIT_ATTEMPT', { action: data.action, timestamp: data.timestamp }, 'critical');
      updateKioskSecurityStatus('COMPROMISED');
    });

    const unbindDisplay = window.vigilNative?.onDisplayConfigurationChanged?.((data) => {
      if (data.displayCount > 1) {
        setMultiDisplayAlert(true);
        logViolation('MULTIPLE_DISPLAY_CONNECTED', { displayCount: data.displayCount }, 'high');
        updateKioskSecurityStatus('WARNING');
      } else {
        setMultiDisplayAlert(false);
      }
    });

    const unbindBlur = window.vigilNative?.onWindowBlur?.(() => {
      if (!blurCooldownTimer.current) {
        logViolation('WINDOW_BLUR', { description: 'Candidate lost window focus or attempted tab switch' }, 'medium');
        updateKioskSecurityStatus('WARNING');
        blurCooldownTimer.current = setTimeout(() => {
          blurCooldownTimer.current = null;
        }, 2000);
      }
    });

    const unbindFocus = window.vigilNative?.onWindowFocus?.(() => {
      logViolation('WINDOW_FOCUS_RETURNED', { description: 'Candidate returned focus to examination window' }, 'info');
    });

    const unbindShortcutBlocked = window.vigilNative?.onShortcutBlocked?.((data) => {
      if (data?.type === 'PASTE_ATTEMPT') {
        showClipboardToast('Paste is disabled during this examination.', 'paste');
      } else if (data?.type === 'COPY_ATTEMPT') {
        showClipboardToast('Copying is disabled during this examination.', 'copy');
      } else if (data?.type === 'CUT_ATTEMPT') {
        showClipboardToast('Cut is disabled during this examination.', 'cut');
      }
      if (clipboardPolicy.log_attempts) {
        securityManager.recordAttempt(data?.type || 'PASTE_ATTEMPT', data?.source || 'keyboard');
      }
    });

    // 6. Start Real Camera & MediaPipe Face Detection
    if (videoRef.current) {
      faceMonitor.startCamera(videoRef.current).then((camRes) => {
        if (camRes.success) {
          setIsCameraActive(true);
          faceMonitor.startMonitoring(350, (event) => {
            if (event.type === 'ONE_FACE') {
              setFaceState('ONE_FACE');
              setFaceCount(1);
              setFaceAlertMessage(null);
            } else if (event.type === 'NO_FACE') {
              setFaceState('NO_FACE');
              setFaceCount(0);
              if (event.absentSeconds > 4) {
                setFaceAlertMessage(`Candidate face absent for ${event.absentSeconds}s. Please face camera.`);
                logViolation('FACE_NOT_DETECTED', { absentSeconds: event.absentSeconds }, event.severity);
                updateKioskSecurityStatus('WARNING');
              }
            } else if (event.type === 'MULTIPLE_FACES_DETECTED') {
              setFaceState('MULTIPLE_FACES');
              setFaceCount(event.faceCount || 2);
              setFaceAlertMessage(`Multiple persons detected in camera frame (${event.faceCount} faces).`);
              logViolation('MULTIPLE_FACES_DETECTED', { faceCount: event.faceCount }, 'critical');
              updateKioskSecurityStatus('COMPROMISED');
            } else if (event.type === 'CAMERA_DISCONNECTED') {
              setIsCameraActive(false);
              setFaceAlertMessage('Camera disconnected. Please reconnect camera immediately.');
              logViolation('CAMERA_DISCONNECTED', { error: event.message }, 'critical');
              updateKioskSecurityStatus('COMPROMISED');
            }
          });
        } else {
          setIsCameraActive(false);
          logViolation('CAMERA_DISCONNECTED', { error: camRes.error }, 'critical');
        }
      });
    }

    return () => {
      securityManager.cleanup();
      cleanupExamEnvironment();
      if (unbindProcessViolation) unbindProcessViolation();
      if (unbindKioskExit) unbindKioskExit();
      if (unbindDisplay) unbindDisplay();
      if (unbindBlur) unbindBlur();
      if (unbindFocus) unbindFocus();
      if (unbindShortcutBlocked) unbindShortcutBlocked();
      clearTimeout(clipboardToastTimer.current);
      clearTimeout(blurCooldownTimer.current);
    };
  }, [attempt, socket, test, isTerminated, logViolation, updateKioskSecurityStatus, cleanupExamEnvironment, user.id]);

  // Safe Close of Unauthorized Process from in-exam warning banner
  const handleCloseUnauthorizedApp = async (pid, name) => {
    if (window.vigilNative?.terminateApprovedProcess) {
      await window.vigilNative.terminateApprovedProcess(pid, name);
      setUnauthorizedAppDetected(null);
      updateKioskSecurityStatus('SECURE');
    } else if (window.vigilNative?.closeApplication) {
      await window.vigilNative.closeApplication(pid, name);
      setUnauthorizedAppDetected(null);
      updateKioskSecurityStatus('SECURE');
    }
  };

  // Timer Countdown
  useEffect(() => {
    if (timeLeft <= 0) {
      handleSubmitExam('Time Limit Expired');
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleOptionSelect = (qId, val) => {
    setAnswers((prev) => ({ ...prev, [qId]: val }));
  };

  const toggleBookmark = (qId) => {
    setBookmarks((prev) =>
      prev.includes(qId) ? prev.filter((id) => id !== qId) : [...prev, qId]
    );
  };

  const handleSubmitExam = async (reason = 'User submitted') => {
    cleanupExamEnvironment();

    try {
      const res = await fetch('http://localhost:4000/api/attempts/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attempt_id: attempt.id,
          answers
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Exam submission failed');
      onExamFinished(data);
    } catch (err) {
      console.error('Submit error:', err);
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (isTerminated) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 select-none">
        <div className="glass-panel glass-panel-danger max-w-md w-full p-8 text-center space-y-6 border border-rose-500/50 shadow-2xl">
          <ShieldAlert className="w-16 h-16 text-rose-500 mx-auto animate-bounce" />
          <h2 className="text-2xl font-black text-rose-400">Examination Session Terminated</h2>
          <p className="text-xs text-slate-300">
            {terminationReason ||
              'Your examination session was terminated by the Exam Supervisor due to security violations.'}
          </p>
          <button
            onClick={() => onExamFinished({ status: 'terminated' })}
            className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 rounded-xl transition-all"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const questions = test.questions || [];
  const currentQ = questions[currentQIndex];

  return (
    <div className="min-h-screen bg-[#070A10] text-slate-100 flex flex-col select-none selection:bg-none">
      {/* Strict Kiosk Lockdown Header */}
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-3 flex items-center justify-between sticky top-0 z-40 select-none exam-content-unselectable">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-600/30">
            <Lock className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">{test.title}</h2>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-cyan-400 font-mono font-bold">FULLSCREEN KIOSK LOCKDOWN</span>
              <span
                className={`text-[9px] px-2 py-0.5 rounded-full font-mono font-black uppercase ${
                  kioskStatus === 'SECURE'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : kioskStatus === 'WARNING'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-bounce'
                }`}
              >
                KIOSK: {kioskStatus}
              </span>
            </div>
          </div>
        </div>

        {/* Real Countdown Timer */}
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-slate-900 border border-slate-800">
          <Clock className="w-4 h-4 text-amber-400" />
          <span className="text-xs text-slate-400 font-medium">Time Left:</span>
          <span className="text-sm font-mono font-bold text-amber-400">{formatTime(timeLeft)}</span>
        </div>

        {/* ONLY Normal Visible Exit: SUBMIT EXAM */}
        <button
          onClick={() => handleSubmitExam('Student submitted')}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-600/20"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Submit Assessment</span>
        </button>
      </header>

      {/* Unauthorized Application Detected Warning Banner */}
      {unauthorizedAppDetected && (
        <div className="bg-rose-600 text-white font-bold px-6 py-3 flex items-center justify-between text-xs shadow-2xl z-50 animate-pulse">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-white shrink-0" />
            <span>
              SECURITY WARNING: Unauthorized background application running (
              {unauthorizedAppDetected.name || unauthorizedAppDetected.displayName} - PID: {unauthorizedAppDetected.pid}
              ). Please close it immediately.
            </span>
          </div>
          <button
            onClick={() => handleCloseUnauthorizedApp(unauthorizedAppDetected.pid, unauthorizedAppDetected.name)}
            className="px-3 py-1.5 rounded-lg bg-slate-950 text-rose-300 hover:text-white font-bold text-[11px] border border-rose-400/40 flex items-center gap-1 shadow-lg"
          >
            <PowerOff className="w-3.5 h-3.5" />
            <span>Close Application</span>
          </button>
        </div>
      )}

      {/* Multi-Display Warning Banner */}
      {multiDisplayAlert && (
        <div className="bg-amber-500 text-slate-950 font-bold px-6 py-2.5 flex items-center justify-between text-xs shadow-xl z-50 animate-pulse">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-slate-950 shrink-0" />
            <span>EXTERNAL MONITOR DETECTED: Secondary display connection is prohibited. Please disconnect immediately.</span>
          </div>
        </div>
      )}

      {/* Real Facial Anomaly Warning Banner */}
      {faceAlertMessage && (
        <div className="bg-rose-500 text-slate-950 font-bold px-6 py-2.5 flex items-center justify-between text-xs shadow-xl z-50 animate-pulse">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-slate-950 shrink-0" />
            <span>BIOMETRIC ALERT: {faceAlertMessage}</span>
          </div>
        </div>
      )}

      {/* Proctor Warning Modal Overlay with Acknowledge Button */}
      {activeWarning && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full p-6 space-y-4 border border-amber-500/50 bg-slate-950 shadow-2xl animate-bounce">
            <h3 className="text-lg font-black text-amber-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <span>PROCTOR WARNING RECEIVED</span>
            </h3>

            <p className="text-xs text-slate-200 bg-slate-900 p-4 rounded-xl border border-slate-800 font-mono">
              "{activeWarning.message}"
            </p>

            <p className="text-[11px] text-slate-400">
              Please comply with the examination guidelines immediately. Continued anomalies may lead to session termination.
            </p>

            <div className="flex justify-end pt-2">
              <button
                onClick={acknowledgeWarning}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20"
              >
                Acknowledge Warning
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Non-Blocking Clipboard Warning Toast */}
      {clipboardToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs shadow-2xl border border-amber-300/80 animate-bounce"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 text-slate-950" />
          <span>{clipboardToast.message || 'Paste is disabled during this examination.'}</span>
        </div>
      )}

      {/* Main Kiosk Work Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Question Canvas / External Webview */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {test.external_link ? (
            <div className="h-full flex flex-col space-y-4">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs text-slate-300 select-none">
                <div className="flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-amber-400" />
                  <span>External Examination Platform Integration Active (HackerRank)</span>
                </div>
                <span className="font-mono text-emerald-400">VigilExam Kiosk Guard Running</span>
              </div>
              <div className="flex-1 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden relative min-h-[500px]">
                <iframe
                  src={test.external_link}
                  title="External Exam Platform"
                  className="w-full h-full border-none"
                  allowpopups
                />
              </div>
            </div>
          ) : (
            currentQ && (
              <div className="glass-panel p-8 space-y-6 max-w-4xl mx-auto exam-content-unselectable select-none border border-slate-800 bg-slate-950/60">
                {/* Question Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800 select-none">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono text-xs font-bold">
                      Question {currentQIndex + 1} of {questions.length}
                    </span>
                    <span className="text-xs text-slate-400">({currentQ.points} Points)</span>
                  </div>

                  <button
                    onClick={() => toggleBookmark(currentQ.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      bookmarks.includes(currentQ.id)
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>{bookmarks.includes(currentQ.id) ? 'Bookmarked' : 'Bookmark'}</span>
                  </button>
                </div>

                {/* Question Text (user-select: none enforced) */}
                <h3 className="text-lg font-bold text-white leading-relaxed select-none exam-content-unselectable">
                  {currentQ.question}
                </h3>

                {/* MCQ vs Code Response */}
                {currentQ.type === 'mcq' ? (
                  <div className="space-y-3 pt-2 select-none exam-content-unselectable">
                    {currentQ.options.map((opt, i) => (
                      <label
                        key={i}
                        className={`p-4 rounded-xl border flex items-center gap-3 cursor-pointer transition-all select-none ${
                          answers[currentQ.id] === opt
                            ? 'border-cyan-500 bg-cyan-500/10 text-white'
                            : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`q-${currentQ.id}`}
                          checked={answers[currentQ.id] === opt}
                          onChange={() => handleOptionSelect(currentQ.id, opt)}
                          className="w-4 h-4 accent-cyan-500"
                        />
                        <span className="text-sm font-medium select-none">{opt}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between text-xs text-slate-400 select-none">
                      <span className="flex items-center gap-1.5 font-mono">
                        <Code className="w-4 h-4 text-cyan-400" />
                        Code Response Editor (Typing enabled, clipboard paste blocked)
                      </span>
                    </div>
                    <textarea
                      rows={8}
                      value={answers[currentQ.id] || currentQ.code_template || ''}
                      onChange={(e) => handleOptionSelect(currentQ.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Tab') {
                          e.preventDefault();
                          const start = e.target.selectionStart;
                          const end = e.target.selectionEnd;
                          const val = e.target.value;
                          const nextVal = val.substring(0, start) + '  ' + val.substring(end);
                          handleOptionSelect(currentQ.id, nextVal);
                          requestAnimationFrame(() => {
                            e.target.selectionStart = e.target.selectionEnd = start + 2;
                          });
                        }
                      }}
                      className="w-full exam-answer-field select-text bg-slate-950 border border-slate-800 rounded-xl p-4 code-font text-sm text-cyan-300 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                )}

                {/* Navigation Controls */}
                <div className="flex items-center justify-between pt-6 border-t border-slate-800 select-none">
                  <button
                    onClick={() => setCurrentQIndex((prev) => Math.max(0, prev - 1))}
                    disabled={currentQIndex === 0}
                    className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 text-xs font-semibold flex items-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </button>

                  <button
                    onClick={() => setCurrentQIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                    disabled={currentQIndex === questions.length - 1}
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold disabled:opacity-40 text-xs flex items-center gap-2 shadow"
                  >
                    <span>Next Question</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          )}
        </div>

        {/* Right Side: Real Camera Stream & Navigation Palette (NO SIMULATION BUTTONS) */}
        <div className="w-80 border-l border-slate-800 bg-slate-950 p-6 flex flex-col justify-between space-y-6 select-none exam-content-unselectable">
          <div className="space-y-6">
            {/* Real Camera Feed */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-cyan-400" />
                  AI Camera Telemetry
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono font-bold">
                  LIVE
                </span>
              </div>

              <div className="relative aspect-video rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />

                {/* Real Face Detection Badge */}
                <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-slate-950/80 backdrop-blur text-[10px] font-mono border border-slate-800">
                  {faceCount === 1 ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <UserCheck className="w-3 h-3" /> Face Present
                    </span>
                  ) : faceCount === 0 ? (
                    <span className="text-rose-400 flex items-center gap-1 font-bold">
                      <UserX className="w-3 h-3" /> No Face
                    </span>
                  ) : (
                    <span className="text-rose-400 flex items-center gap-1 font-bold">
                      <Users className="w-3 h-3" /> {faceCount} Faces
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Question Navigator */}
            {!test.external_link && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Question Navigator</h4>
                <div className="grid grid-cols-4 gap-2">
                  {questions.map((q, idx) => {
                    const isAnswered = answers[q.id] !== undefined;
                    const isBookmarked = bookmarks.includes(q.id);
                    const isCurrent = currentQIndex === idx;

                    return (
                      <button
                        key={q.id}
                        onClick={() => setCurrentQIndex(idx)}
                        className={`h-10 rounded-xl font-mono text-xs font-bold transition-all relative ${
                          isCurrent
                            ? 'ring-2 ring-cyan-500 bg-cyan-500 text-slate-950 font-black'
                            : isAnswered
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {idx + 1}
                        {isBookmarked && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Kiosk Footer Info */}
          <div className="text-[11px] text-slate-400 pt-4 border-t border-slate-900 space-y-1">
            <p>
              Candidate ID: <span className="font-mono text-slate-300">{user.student_id || 'STUDENT'}</span>
            </p>
            <p>
              Session Token: <span className="font-mono text-cyan-400">{attempt?.kiosk_token || 'KTK-9901'}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
