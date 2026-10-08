import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { Shield, Clock, Camera, AlertTriangle, CheckCircle, ArrowRight, ArrowLeft, Bookmark, Code, Send, ExternalLink, ShieldAlert, Cpu } from 'lucide-react';
import { preventClipboardActions, normalizeClipboardPolicy } from '../../utils/clipboardSecurity';

export const ExamKiosk = ({ test, attempt, onExamFinished }) => {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [bookmarks, setBookmarks] = useState([]);
  const [timeLeft, setTimeLeft] = useState((test.duration_minutes || 30) * 60);

  const [warnings, setWarnings] = useState([]);
  const [activeWarning, setActiveWarning] = useState(null);
  const [isTerminated, setIsTerminated] = useState(false);
  const [terminationReason, setTerminationReason] = useState("");
  const [clipboardToast, setClipboardToast] = useState(null);
  const clipboardToastTimer = useRef(null);

  const [simulatedAnomaly, setSimulatedAnomaly] = useState(null);
  const videoRef = useRef(null);

  const showClipboardToast = (message, type = 'paste') => {
    setClipboardToast({ message, type });
    clearTimeout(clipboardToastTimer.current);
    clipboardToastTimer.current = setTimeout(() => {
      setClipboardToast(null);
    }, 2500);
  };

  useEffect(() => {
    console.info('[ExamFlow] ExamKiosk mounted', {
      examId: test?.id ?? null,
      examStatus: test?.is_active ? 'active' : 'inactive',
      attemptId: attempt?.id ?? null,
      attemptExamId: attempt?.test_id ?? null,
      attemptStatus: attempt?.status ?? null,
      attemptStudentId: attempt?.student_id ?? null,
      authenticatedStudentId: user?.id ?? null,
      authenticated: Boolean(user),
      durationMinutes: test?.duration_minutes ?? null,
    });
    return () => {
      console.info('[ExamFlow] ExamKiosk unmounted', {
        examId: test?.id ?? null,
        attemptId: attempt?.id ?? null,
        attemptStatus: attempt?.status ?? null,
      });
    };
  }, [test?.id, attempt?.id, user?.id]);

  // Enable Kiosk Mode, Centralized Security, & Socket Room Join
  useEffect(() => {
    const clipboardPolicy = normalizeClipboardPolicy(test?.security_policy);

    if (window.vigilNative?.enableKioskMode) {
      window.vigilNative.enableKioskMode();
    }

    // Join candidate socket room
    if (socket && attempt) {
      socket.emit('join_student_room', attempt.id);

      // Listen for proctor warnings
      socket.on('proctor_warning_received', (data) => {
        setWarnings(prev => [...prev, data]);
        setActiveWarning(data.message);
      });

      // Listen for exam termination
      socket.on('exam_terminated', (data) => {
        console.warn('[ExamFlow] Termination event received', {
          attemptId: attempt.id,
          reason: data?.reason ?? null,
          terminatedAt: data?.terminated_at ?? null,
        });
        setIsTerminated(true);
        setTerminationReason(data.reason);
        window.vigilNative?.setExamClipboardSecurity?.({ active: false, policy: clipboardPolicy });
        if (window.vigilNative?.disableKioskMode) {
          window.vigilNative.disableKioskMode();
        }
      });
    }

    // Activate strict security in Electron's trusted main process
    window.vigilNative?.setExamClipboardSecurity?.({
      active: true,
      policy: clipboardPolicy,
    });

    // Centralized security handler for copy, paste, cut, beforeinput, contextmenu, drag/drop, keydown
    const securityManager = preventClipboardActions({
      policy: clipboardPolicy,
      attemptId: attempt?.id,
      studentId: user?.id,
      isExamActive: () => !isTerminated,
      onWarning: (msg, type) => showClipboardToast(msg, type),
      onViolation: (eventType, metadata, severity) => {
        logViolation(eventType, metadata, severity);
      },
    });

    // Listen for shortcuts intercepted at native Electron level
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

    // Listen to Window Blur (Tab Switch)
    const handleBlur = () => {
      logViolation('TAB_SWITCH', { description: 'Candidate switched window or tab' }, 'medium');
    };
    window.addEventListener('blur', handleBlur);

    // Start Webcam Feed
    navigator.mediaDevices?.getUserMedia?.({ video: true }).then(stream => {
      if (videoRef.current) videoRef.current.srcObject = stream;
    }).catch(() => {});

    return () => {
      securityManager.cleanup();
      if (unbindShortcutBlocked) unbindShortcutBlocked();
      window.removeEventListener('blur', handleBlur);
      clearTimeout(clipboardToastTimer.current);
      window.vigilNative?.setExamClipboardSecurity?.({
        active: false,
        policy: clipboardPolicy,
      });
      if (window.vigilNative?.disableKioskMode) {
        window.vigilNative.disableKioskMode();
      }
    };
  }, [attempt, socket, test]);

  // Timer Countdown
  useEffect(() => {
    if (timeLeft <= 0) {
      handleSubmitExam("Time Limit Expired");
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  // Helper to log security violation (records metadata only, never clipboard content)
  const logViolation = async (eventType, payload, severity) => {
    if (!attempt) return;
    try {
      await fetch('http://localhost:4000/api/events/log', {
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
    } catch (e) {
      console.error("Failed to log violation:", e);
    }
  };

  // Simulate Security Violations (for testing & demo)
  const triggerSimulation = (type) => {
    setSimulatedAnomaly(type);
    if (type === 'process') {
      logViolation('UNAUTHORIZED_PROCESS', { app: 'AnyDesk.exe', pid: 4892 }, 'critical');
    } else if (type === 'no_face') {
      logViolation('FACE_NOT_FOUND', { durationSec: 4 }, 'high');
    } else if (type === 'multi_face') {
      logViolation('MULTIPLE_FACES', { faceCount: 2 }, 'high');
    }
    setTimeout(() => setSimulatedAnomaly(null), 3000);
  };

  const handleOptionSelect = (qId, val) => {
    setAnswers(prev => ({ ...prev, [qId]: val }));
  };

  const toggleBookmark = (qId) => {
    setBookmarks(prev => 
      prev.includes(qId) ? prev.filter(id => id !== qId) : [...prev, qId]
    );
  };

  const handleSubmitExam = async (reason = "User submitted") => {
    console.warn('[ExamFlow] Submission requested', {
      reason,
      examId: test?.id ?? null,
      attemptId: attempt?.id ?? null,
      attemptStatus: attempt?.status ?? null,
      timeLeft,
    });
    if (window.vigilNative?.disableKioskMode) {
      window.vigilNative.disableKioskMode();
    }
    const clipboardPolicy = normalizeClipboardPolicy(test?.security_policy);
    await window.vigilNative?.setExamClipboardSecurity?.({
      active: false,
      policy: clipboardPolicy,
    });

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
      console.info('[ExamFlow] Submission API response', {
        httpStatus: res.status,
        attemptId: data?.id ?? attempt?.id ?? null,
        status: data?.status ?? null,
      });
      if (!res.ok) throw new Error(data?.error || 'Exam submission failed');
      onExamFinished(data);
    } catch (err) {
      console.error("Submit error:", err);
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Render Terminated View if force closed by proctor
  if (isTerminated) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 select-none">
        <div className="glass-panel glass-panel-danger max-w-md w-full p-8 text-center space-y-6">
          <ShieldAlert className="w-16 h-16 text-rose-500 mx-auto animate-bounce" />
          <h2 className="text-2xl font-extrabold text-rose-400">Examination Session Terminated</h2>
          <p className="text-sm text-slate-300">
            {terminationReason || "Your assessment session was terminated by the Exam Supervisor due to security violations."}
          </p>
          <button
            onClick={() => onExamFinished({ status: 'terminated' })}
            className="w-full bg-rose-600 hover:bg-rose-500 text-white font-semibold py-3 rounded-xl transition-all"
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
      
      {/* Kiosk Header */}
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-3 flex items-center justify-between sticky top-0 z-40 select-none exam-content-unselectable">
        
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">{test.title}</h2>
            <span className="text-xs text-indigo-400 font-mono">KIOSK LOCKDOWN & CLIPBOARD GUARD ACTIVE</span>
          </div>
        </div>

        {/* Timer */}
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-slate-900 border border-slate-800">
          <Clock className="w-4 h-4 text-amber-400" />
          <span className="text-xs text-slate-400 font-medium">Time Remaining:</span>
          <span className="text-sm font-mono font-bold text-amber-400">{formatTime(timeLeft)}</span>
        </div>

        <button
          onClick={() => handleSubmitExam("Student submitted")}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-600/20"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Submit Assessment</span>
        </button>

      </header>

      {/* Proctor Warning Toast Overlay */}
      {activeWarning && (
        <div className="bg-amber-500/90 text-slate-950 font-bold px-6 py-3 flex items-center justify-between text-sm shadow-xl z-50 animate-pulse select-none">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-slate-950 shrink-0" />
            <span>PROCTOR WARNING: {activeWarning}</span>
          </div>
          <button
            onClick={() => setActiveWarning(null)}
            className="px-3 py-1 rounded bg-slate-950 text-amber-400 text-xs font-semibold"
          >
            Acknowledge
          </button>
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
          <span>{clipboardToast.message || "Paste is disabled during this examination."}</span>
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
                <span className="font-mono text-emerald-400">VigilExam Security Guard Running</span>
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
              <div className="glass-panel p-8 space-y-6 max-w-4xl mx-auto exam-content-unselectable select-none">
                
                {/* Question Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800 select-none">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-mono text-xs font-bold">
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

                {/* Question Text (Strictly Unselectable) */}
                <h3 className="text-lg font-bold text-white leading-relaxed select-none exam-content-unselectable">
                  {currentQ.question}
                </h3>

                {/* Question Input Type */}
                {currentQ.type === 'mcq' ? (
                  <div className="space-y-3 pt-2 select-none exam-content-unselectable">
                    {currentQ.options.map((opt, i) => (
                      <label
                        key={i}
                        className={`p-4 rounded-xl border flex items-center gap-3 cursor-pointer transition-all select-none ${
                          answers[currentQ.id] === opt 
                            ? 'border-indigo-500 bg-indigo-500/10 text-white' 
                            : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`q-${currentQ.id}`}
                          checked={answers[currentQ.id] === opt}
                          onChange={() => handleOptionSelect(currentQ.id, opt)}
                          className="w-4 h-4 accent-indigo-500"
                        />
                        <span className="text-sm font-medium select-none">{opt}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between text-xs text-slate-400 select-none">
                      <span className="flex items-center gap-1.5 font-mono">
                        <Code className="w-4 h-4 text-indigo-400" />
                        Code Response Editor (Typing enabled, Clipboard protected)
                      </span>
                    </div>
                    {/* Textarea allows normal typing, editing, indentation with Tab key, but blocks paste/copy/cut */}
                    <textarea
                      rows={8}
                      value={answers[currentQ.id] || currentQ.code_template || ""}
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
                      className="w-full exam-answer-field select-text bg-slate-950 border border-slate-800 rounded-xl p-4 code-font text-sm text-indigo-300 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}

                {/* Question Navigation Controls */}
                <div className="flex items-center justify-between pt-6 border-t border-slate-800 select-none">
                  <button
                    onClick={() => setCurrentQIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentQIndex === 0}
                    className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 text-xs font-semibold flex items-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </button>

                  <button
                    onClick={() => setCurrentQIndex(prev => Math.min(questions.length - 1, prev + 1))}
                    disabled={currentQIndex === questions.length - 1}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 text-xs font-semibold flex items-center gap-2 shadow"
                  >
                    <span>Next Question</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

              </div>
            )
          )}

        </div>

        {/* Right Side: AI Camera & Question Palette */}
        <div className="w-80 border-l border-slate-800 bg-slate-950 p-6 flex flex-col justify-between space-y-6 select-none exam-content-unselectable">
          
          <div className="space-y-6">
            
            {/* AI Webcam Monitor Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-indigo-400" />
                  AI Camera Feed
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">LIVE</span>
              </div>

              <div className="relative aspect-video rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100" />
                <div className="camera-scanline" />
                {simulatedAnomaly && (
                  <div className="absolute inset-0 bg-rose-500/30 backdrop-blur-sm flex items-center justify-center p-2 text-center text-xs font-bold text-white">
                    {simulatedAnomaly.toUpperCase()} DETECTED
                  </div>
                )}
              </div>
            </div>

            {/* Simulated Anomaly Triggers (For Demonstration) */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                <span>Simulate Security Events</span>
              </p>
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                <button
                  onClick={() => triggerSimulation('process')}
                  className="p-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold"
                >
                  AnyDesk App
                </button>
                <button
                  onClick={() => triggerSimulation('no_face')}
                  className="p-1.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold"
                >
                  Face Missing
                </button>
                <button
                  onClick={() => triggerSimulation('multi_face')}
                  className="p-1.5 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold"
                >
                  Multiple Faces
                </button>
                <button
                  onClick={() => logViolation('TAB_SWITCH', { description: 'Alt-Tab pressed' }, 'medium')}
                  className="p-1.5 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold"
                >
                  Tab Switch
                </button>
              </div>
            </div>

            {/* Question Palette */}
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
                          isCurrent ? 'ring-2 ring-indigo-500 bg-indigo-600 text-white' :
                          isAnswered ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                          'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700'
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
            <p>Candidate ID: <span className="font-mono text-slate-300">{user.student_id || "STUDENT"}</span></p>
            <p>Session Token: <span className="font-mono text-indigo-400">{attempt?.kiosk_token || "KTK-9901"}</span></p>
          </div>

        </div>

      </div>

    </div>
  );
};
