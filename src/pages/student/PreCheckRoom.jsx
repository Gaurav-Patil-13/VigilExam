import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Camera,
  Mic,
  Cpu,
  Monitor,
  Wifi,
  ArrowRight,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  XCircle,
  Trash2,
  Lock,
  PowerOff,
  UserCheck,
  UserX,
  Users
} from 'lucide-react';
import { faceMonitor } from '../../security/faceMonitor';
import { ProcessManagementPanel } from '../../components/ProcessManagementPanel';
import { API_BASE_URL } from '../../config/api.js';

export const PreCheckRoom = ({ test, onProceedToExam, onCancel }) => {
  // Check statuses: 'checking', 'passed', 'failed', 'warning'
  const [cameraStatus, setCameraStatus] = useState('checking');
  const [micStatus, setMicStatus] = useState('checking');
  const [faceStatus, setFaceStatus] = useState('checking');
  const [processStatus, setProcessStatus] = useState('checking');
  const [displayStatus, setDisplayStatus] = useState('checking');
  const [networkStatus, setNetworkStatus] = useState('checking');

  // Diagnostic Data
  const [faceCount, setFaceCount] = useState(0);
  const [stableFaceSeconds, setStableFaceSeconds] = useState(0);
  const [forbiddenApps, setForbiddenApps] = useState([]);
  const [userApps, setUserApps] = useState([]);
  const [displayInfo, setDisplayInfo] = useState({ displayCount: 1 });
  const [latencyMs, setLatencyMs] = useState(0);
  const [isClosingApps, setIsClosingApps] = useState(false);
  const [allowBackgroundProcesses, setAllowBackgroundProcesses] = useState(true);
  const [kioskActivationError, setKioskActivationError] = useState(null);

  const videoRef = useRef(null);
  const stabilityTimerRef = useRef(null);

  useEffect(() => {
    runAllDiagnostics();

    // Listen to live display changes during pre-check
    const unbindDisplay = window.vigilNative?.onDisplayConfigurationChanged?.(() => {
      runDisplayAudit();
    });

    // Auto-rescan processes periodically (every 2500ms) to detect externally closed prohibited applications
    const processPollTimer = setInterval(() => {
      runProcessDiagnostic();
    }, 2500);

    return () => {
      faceMonitor.stopCamera();
      if (processPollTimer) {
        clearInterval(processPollTimer);
      }
      if (stabilityTimerRef.current) {
        clearInterval(stabilityTimerRef.current);
      }
      if (unbindDisplay) unbindDisplay();
    };
  }, []);

  const runAllDiagnostics = async () => {
    await runCameraAndFaceDiagnostic();
    await runProcessDiagnostic();
    await runDisplayAudit();
    await runNetworkDiagnostic();
  };

  // 1. REAL CAMERA, AUDIO & FACIAL BIOMETRIC DIAGNOSTIC
  const runCameraAndFaceDiagnostic = async () => {
    setCameraStatus('checking');
    setMicStatus('checking');
    setFaceStatus('checking');
    setStableFaceSeconds(0);

    if (!videoRef.current) return;

    try {
      const camResult = await faceMonitor.startCamera(videoRef.current);
      if (camResult.success) {
        setCameraStatus('passed');
        setMicStatus(camResult.hasAudioTrack ? 'passed' : 'warning');

        // Start continuous face monitoring with real elapsed-time calibration & jitter tolerance
        faceMonitor.startMonitoring(150, (event) => {
          setFaceCount(event.faceCount);

          if (event.calibrated) {
            setStableFaceSeconds(2);
            setFaceStatus('passed');
          } else if (event.faceCount === 1 || event.isJitterGrace) {
            const sec = event.stableSeconds || 0;
            setStableFaceSeconds(sec);
            setFaceStatus(sec >= 2 ? 'passed' : 'checking');
          } else {
            setStableFaceSeconds(0);
            setFaceStatus('failed');
          }
        });
      } else {
        console.error('[PreCheckRoom] Camera initialization failed:', camResult.error);
        setCameraStatus('failed');
        setMicStatus('failed');
        setFaceStatus('failed');
      }
    } catch (err) {
      console.error('[PreCheckRoom] Camera and face diagnostic error:', err);
      setCameraStatus('failed');
      setMicStatus('failed');
      setFaceStatus('failed');
    }
  };

  // 2. REAL NATIVE WINDOWS PROCESS AUDIT
  const runProcessDiagnostic = async () => {
    setProcessStatus('checking');
    if (window.vigilNative?.scanProcesses) {
      try {
        const procResult = await window.vigilNative.scanProcesses();
        if (!procResult || !procResult.success) {
          setProcessStatus(window.vigilNative?.isDesktopApp ? 'failed' : 'passed');
          setForbiddenApps([]);
          return;
        }
        const isBgAllowed = procResult.allowBackgroundProcesses !== false;
        setAllowBackgroundProcesses(isBgAllowed);

        const list = procResult.processes || [];
        const forbidden = (procResult.suspicious && procResult.suspicious.length > 0)
          ? procResult.suspicious
          : list.filter((p) => p.isProhibited);
        const users = (procResult.userApps && procResult.userApps.length > 0)
          ? procResult.userApps
          : list.filter((p) => p.category === 'NORMAL_USER_APPLICATION');

        setForbiddenApps(forbidden);
        setUserApps(users);

        if (forbidden.length > 0) {
          setProcessStatus('failed');
        } else if (!isBgAllowed && users.length > 0) {
          setProcessStatus('warning');
        } else {
          setProcessStatus('passed');
        }
      } catch (e) {
        console.warn('Process scan error:', e);
        setProcessStatus('failed');
      }
    } else {
      setProcessStatus('passed');
    }
  };

  // 3. REAL SINGLE DISPLAY AUDIT
  const runDisplayAudit = async () => {
    setDisplayStatus('checking');
    if (window.vigilNative?.getDisplays) {
      try {
        const diag = await window.vigilNative.getDisplays();
        setDisplayInfo(diag);
        if (diag.displayCount > 1 || !diag.isSingleDisplay) {
          setDisplayStatus('warning');
        } else {
          setDisplayStatus('passed');
        }
      } catch (e) {
        setDisplayStatus('warning');
      }
    } else {
      setDisplayStatus('passed');
    }
  };

  // 4. REAL NETWORK LATENCY DIAGNOSTIC
  const runNetworkDiagnostic = async () => {
    setNetworkStatus('checking');
    try {
      const start = performance.now();
      const res = await fetch(`${API_BASE_URL}/api/health`, { cache: 'no-store' });
      const elapsed = Math.round(performance.now() - start);
      if (res.ok) {
        setLatencyMs(elapsed);
        setNetworkStatus('passed');
      } else {
        setNetworkStatus('failed');
      }
    } catch (e) {
      setNetworkStatus('failed');
    }
  };

  // Safe Close All Non-Essential Applications
  const handleCloseAllApps = async () => {
    setIsClosingApps(true);
    try {
      if (window.vigilNative?.closeNonEssentialApplications) {
        await window.vigilNative.closeNonEssentialApplications();
      }
      await runProcessDiagnostic();
    } catch (err) {
      console.error('Error closing non-essential applications:', err);
    } finally {
      setIsClosingApps(false);
    }
  };

  // Safe Close Single Application
  const handleCloseSingleApp = async (pid, name) => {
    try {
      if (window.vigilNative?.terminateApprovedProcess) {
        await window.vigilNative.terminateApprovedProcess(pid, name);
      } else if (window.vigilNative?.closeApplication) {
        await window.vigilNative.closeApplication(pid, name);
      }
      await runProcessDiagnostic();
    } catch (err) {
      console.error('Error closing application:', err);
    }
  };

  // Real Verification Matrix
  const isCameraPassed = cameraStatus === 'passed';
  const isMicPassed = micStatus === 'passed' || micStatus === 'warning';
  const isFacePassed = faceStatus === 'passed';
  const isProcessPassed = processStatus === 'passed' && forbiddenApps.length === 0 && (allowBackgroundProcesses || userApps.length === 0);
  const isDisplayPassed = displayStatus === 'passed' || displayStatus === 'warning';
  const isNetworkPassed = networkStatus === 'passed';

  const allMandatoryPassed =
    isCameraPassed && isMicPassed && isFacePassed && isProcessPassed && isDisplayPassed && isNetworkPassed;

  const pendingChecks = [];
  if (!isCameraPassed) pendingChecks.push('Webcam Video Feed');
  if (!isFacePassed) pendingChecks.push(`Single Face Calibrated (${stableFaceSeconds}/2s continuous presence)`);
  if (!isProcessPassed) {
    if (forbiddenApps.length > 0) {
      pendingChecks.push(`${forbiddenApps.length} Prohibited Application(s) Running`);
    } else if (processStatus === 'failed') {
      pendingChecks.push('Native Process Guard Audit Failed');
    } else {
      pendingChecks.push('Background Applications');
    }
  }
  if (displayStatus === 'failed') pendingChecks.push('Single Display Policy');
  if (!isNetworkPassed) pendingChecks.push('Network Latency Check');

  // Handle Enter Exam Kiosk
  const handleEnterKiosk = async () => {
    // 0. HARD SECURITY ENFORCEMENT: Never allow entering exam kiosk if ANY prohibited app is running or process check failed
    if (forbiddenApps.length > 0 || processStatus !== 'passed') {
      setProcessStatus('failed');
      setKioskActivationError(
        forbiddenApps.length > 0
          ? `BLOCKED: ${forbiddenApps.length} prohibited application(s) detected (${forbiddenApps.map((f) => f.displayName || f.name).join(', ')}). You must close all prohibited applications before entering.`
          : 'BLOCKED: Native process security clearance has not passed.'
      );
      return;
    }

    if (!allMandatoryPassed) return;
    setKioskActivationError(null);

    // 1. Immediate pre-entry re-validation against race conditions right before kiosk lockdown
    if (window.vigilNative?.scanProcesses) {
      try {
        const recheck = await window.vigilNative.scanProcesses();
        if (!recheck || !recheck.success) {
          setProcessStatus('failed');
          setKioskActivationError('Security scan failed to verify operating system state. Please rescan before entering.');
          return;
        }

        const freshList = recheck.processes || [];
        const freshForbidden = (recheck.suspicious && recheck.suspicious.length > 0)
          ? recheck.suspicious
          : freshList.filter((p) => p.isProhibited);
        const freshUsers = (recheck.userApps && recheck.userApps.length > 0)
          ? recheck.userApps
          : freshList.filter((p) => p.category === 'NORMAL_USER_APPLICATION');

        setForbiddenApps(freshForbidden);
        setUserApps(freshUsers);

        if (freshForbidden.length > 0) {
          setProcessStatus('failed');
          setKioskActivationError(
            `BLOCKED — ${freshForbidden.length} PROHIBITED APPLICATION(S) DETECTED (${freshForbidden.map((f) => f.displayName || f.name).join(', ')}). You must close all prohibited applications before entering.`
          );
          return;
        }

        if (!allowBackgroundProcesses && freshUsers.length > 0) {
          setProcessStatus('warning');
          setKioskActivationError('Background user applications detected. Close user applications to proceed.');
          return;
        }
      } catch (err) {
        setProcessStatus('failed');
        setKioskActivationError('Security scan error during pre-entry verification. Please rescan.');
        return;
      }
    }

    // 1. Activate strict Electron Kiosk mode
    if (window.vigilNative?.enableKioskMode) {
      try {
        await window.vigilNative.enableKioskMode();
      } catch (kErr) {
        console.warn('[PreCheckRoom] Kiosk mode activation note:', kErr.message);
      }
    }

    // 2. Capture baseline processes snapshot
    if (window.vigilNative?.captureProcessBaseline) {
      try {
        await window.vigilNative.captureProcessBaseline();
      } catch (bErr) {}
    }

    // 3. Stop pre-check local video stream before entering exam
    try {
      faceMonitor.stopCamera();
    } catch (cErr) {}

    // 4. Smooth transition into examination
    if (onProceedToExam) {
      try {
        await onProceedToExam({
          prohibitedCount: forbiddenApps.length,
          isProcessPassed: processStatus === 'passed' && forbiddenApps.length === 0
        });
      } catch (startErr) {
        console.error('[PreCheckRoom] Failed to start exam attempt:', startErr);
        setKioskActivationError(`Failed to enter exam: ${startErr.message || 'Server error'}`);
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header Banner */}
      <div className="glass-panel p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 bg-slate-950/80">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-xs font-semibold">
            <Lock className="w-3.5 h-3.5 text-cyan-400" />
            <span>MANDATORY PRE-EXAMINATION CLEARANCE</span>
            <span className="text-[10px] text-cyan-400/80 font-mono">● HARDWARE & INTEGRITY AUDIT</span>
          </div>
          <h1 className="text-2xl font-black text-white mt-1">Pre-Exam Security Clearance</h1>
          <p className="text-xs text-slate-400">
            Verifying live camera stream, microphone, facial presence, background process security, and single display policy for "{test.title}"
          </p>
        </div>

        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-xs font-semibold transition-all self-start md:self-auto"
        >
          Cancel & Back to Dashboard
        </button>
      </div>

      {kioskActivationError && (
        <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span className="font-semibold">{kioskActivationError}</span>
        </div>
      )}

      {/* Diagnostics Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left Card: Camera, Audio & AI Face Detector */}
        <div className="glass-panel p-6 space-y-4 flex flex-col justify-between border border-slate-800 bg-slate-900/60">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Camera className="w-5 h-5 text-cyan-400" />
                <span>Webcam & Biometric Sensor</span>
              </h3>
              <StatusBadge status={faceStatus === 'passed' ? 'passed' : faceStatus} />
            </div>

            {/* Video Preview */}
            <div className="relative aspect-video rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />

              {cameraStatus === 'checking' && (
                <p className="text-xs text-slate-400 animate-pulse">Connecting to optical sensor...</p>
              )}

              {cameraStatus === 'failed' && (
                <div className="text-center p-4 space-y-2">
                  <XCircle className="w-8 h-8 text-rose-500 mx-auto" />
                  <p className="text-xs text-rose-400 font-bold">Camera Connection Failed</p>
                  <p className="text-[11px] text-slate-500">Please connect a working webcam to proceed.</p>
                </div>
              )}

              {/* Real-time Face Badge Overlay */}
              {cameraStatus === 'passed' && (
                <div className="absolute bottom-3 left-3 flex items-center gap-2">
                  {faceCount === 1 ? (
                    <div className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold backdrop-blur flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Single Face Calibrated ({stableFaceSeconds}/2s)</span>
                    </div>
                  ) : faceCount === 0 ? (
                    <div className="px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold backdrop-blur flex items-center gap-1.5 animate-pulse">
                      <UserX className="w-3.5 h-3.5 text-rose-400" />
                      <span>No Face Detected — Face Camera Directly</span>
                    </div>
                  ) : (
                    <div className="px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold backdrop-blur flex items-center gap-1.5 animate-pulse">
                      <Users className="w-3.5 h-3.5 text-rose-400" />
                      <span>Multiple Faces Detected ({faceCount})</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Hardware Status Strip */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-cyan-400" /> Video Feed:
                </span>
                <span className={cameraStatus === 'passed' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {cameraStatus === 'passed' ? 'CONNECTED' : 'FAILED'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-cyan-400" /> Microphone:
                </span>
                <span className={micStatus === 'passed' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {micStatus === 'passed' ? 'CONNECTED' : 'FAILED'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <p className="font-bold text-slate-300">Biometric Verification Rule:</p>
            <p>
              MediaPipe BlazeFace requires exactly <strong>one face</strong> present continuously for 2 seconds. Zero faces or multiple persons will prohibit entry.
            </p>
          </div>
        </div>

        {/* Right Card: Display Lockdown & Network Telemetry */}
        <div className="glass-panel p-6 space-y-4 flex flex-col justify-between border border-slate-800 bg-slate-900/60">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-cyan-400" />
                <span>Hardware & Perimeter Integrity</span>
              </h3>
              <button
                onClick={runAllDiagnostics}
                className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-cyan-400 transition-all"
                title="Re-run Diagnostics"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Display Monitor Audit */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <Monitor className="w-5 h-5 text-cyan-400 shrink-0" />
                <div>
                  <p className="font-bold text-slate-200">Display Monitor Policy</p>
                  <p className="text-[11px] text-slate-400">
                    {displayInfo.displayCount} Monitor(s) Detected (Single display mandatory)
                  </p>
                </div>
              </div>
              <StatusBadge status={displayStatus} />
            </div>

            {displayStatus === 'failed' && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>Multiple Displays Detected ({displayInfo.displayCount})</span>
                </p>
                <p className="text-[11px]">
                  Secondary monitors must be disconnected before entering the secure kiosk.
                </p>
              </div>
            )}

            {/* Network Health */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <Wifi className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="font-bold text-slate-200">Audit Server & Telemetry Network</p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Round-trip latency: <strong className="text-white">{latencyMs}ms</strong>
                  </p>
                </div>
              </div>
              <StatusBadge status={networkStatus} />
            </div>

            {/* Process Security Clearance Summary */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <Cpu className="w-5 h-5 text-cyan-400 shrink-0" />
                <div>
                  <p className="font-bold text-slate-200">Process Security Status</p>
                  <p className="text-[11px] text-slate-400">
                    {forbiddenApps.length > 0
                      ? `${forbiddenApps.length} prohibited application(s) detected`
                      : 'Zero prohibited applications running'}
                  </p>
                </div>
              </div>
              <StatusBadge status={processStatus} />
            </div>
          </div>

          <div className="pt-2">
            <p className="text-[10px] text-slate-500">
              * Critical Windows system processes and VigilExam runtime processes are strictly protected.
            </p>
          </div>
        </div>
      </div>

      {/* Dedicated Native Process Management Panel */}
      <div className="glass-panel p-6 space-y-4 border border-slate-800 bg-slate-900/60 rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Native Windows Process Guard & Safe Management</span>
              </h3>
              <p className="text-xs text-slate-400">
                Audit active background applications and safely close unauthorized or unnecessary tools before entering the examination kiosk.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => runProcessDiagnostic()}
              className="p-1.5 px-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-cyan-400 transition-all flex items-center gap-1.5 text-xs font-semibold"
              title="Rescan System Processes"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Rescan</span>
            </button>
            <StatusBadge status={processStatus} />
          </div>
        </div>

        <ProcessManagementPanel
          onScanComplete={(res) => {
            if (!res || !res.success) {
              setProcessStatus(window.vigilNative?.isDesktopApp ? 'failed' : 'passed');
              return;
            }
            const list = res.processes || [];
            const suspicious = (res.suspicious && res.suspicious.length > 0)
              ? res.suspicious
              : list.filter((p) => p.isProhibited);
            const users = (res.userApps && res.userApps.length > 0)
              ? res.userApps
              : list.filter((p) => p.category === 'NORMAL_USER_APPLICATION');
            const isBgAllowed = res.allowBackgroundProcesses !== false;
            setAllowBackgroundProcesses(isBgAllowed);
            setForbiddenApps(suspicious);
            setUserApps(users);
            if (suspicious.length > 0) {
              setProcessStatus('failed');
            } else if (!isBgAllowed && users.length > 0) {
              setProcessStatus('warning');
            } else {
              setProcessStatus('passed');
            }
          }}
        />
      </div>

      {/* Action Footer */}
      <div className="glass-panel p-6 space-y-4 border-t border-slate-800 bg-slate-950/80">
        {!allMandatoryPassed && (
          <div className="w-full p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Clearance required to proceed:</strong> {pendingChecks.length > 0 ? pendingChecks.join(' • ') : 'Calibrating system parameters...'}
              </span>
            </div>
            {forbiddenApps.length > 0 && (
              <span className="text-[11px] font-bold text-rose-400 shrink-0 bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20">
                {forbiddenApps.length} PROHIBITED APPLICATION{forbiddenApps.length > 1 ? 'S' : ''} MUST BE CLOSED
              </span>
            )}
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1 text-xs text-slate-400">
            <p className="flex items-center gap-2 text-slate-300 font-bold">
              <Lock className="w-4 h-4 text-cyan-400" />
              <span>Strict Kiosk Lockdown Ready:</span>
            </p>
            <p className="text-[11px]">
              Entering kiosk mode occupies the entire screen, keeps the exam topmost, locks window minimize/resize, and restricts clipboard operations.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleEnterKiosk}
              disabled={!allMandatoryPassed}
              className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black px-8 py-3.5 rounded-xl shadow-xl shadow-cyan-500/25 flex items-center justify-center gap-2 text-sm transition-all"
            >
              <span>ENTER SECURE EXAM KIOSK</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatusBadge = ({ status }) => {
  if (status === 'passed') {
    return (
      <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold flex items-center gap-1 font-mono">
        <CheckCircle className="w-3.5 h-3.5" />
        <span>PASSED</span>
      </span>
    );
  }
  if (status === 'warning') {
    return (
      <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold flex items-center gap-1 font-mono">
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>PENDING ACTION</span>
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-bold flex items-center gap-1 font-mono">
        <XCircle className="w-3.5 h-3.5" />
        <span>BLOCKED</span>
      </span>
    );
  }
  return (
    <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 text-xs font-bold animate-pulse font-mono">
      CHECKING...
    </span>
  );
};
