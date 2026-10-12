import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { API_BASE_URL } from '../../config/api.js';
import {
  Shield,
  Eye,
  AlertTriangle,
  Send,
  XCircle,
  CheckCircle,
  Search,
  Filter,
  RefreshCw,
  Cpu,
  Activity,
  UserX,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
  Monitor,
  Terminal,
  Lock,
  AlertOctagon,
  Radio,
  Sliders,
  ChevronRight,
  X,
  FileText
} from 'lucide-react';

export const ProctorDashboard = () => {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [activeCandidates, setActiveCandidates] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [inspectionCandidate, setInspectionCandidate] = useState(null);

  const [filterKioskStatus, setFilterKioskStatus] = useState('ALL'); // ALL, SECURE, WARNING, COMPROMISED, TERMINATED
  const [searchQuery, setSearchQuery] = useState('');

  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningMsg, setWarningMsg] = useState('');
  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [terminateReason, setTerminateReason] = useState('Repeated unauthorized background process or kiosk breach');

  // Load Active Attempts & Setup Socket Listeners
  useEffect(() => {
    fetchActiveAttempts();

    if (socket) {
      socket.emit('join_proctor_room');

      // Listen for new candidate starting exam
      socket.on('student_started_exam', (attempt) => {
        setActiveCandidates((prev) => {
          if (!prev.find((c) => c.id === attempt.id)) {
            return [attempt, ...prev];
          }
          return prev;
        });
      });

      // Listen for incoming security alert
      socket.on('new_security_alert', (data) => {
        const { event, student_name, test_title, current_risk } = data;

        // Add incident to live feed
        setIncidents((prev) => [
          {
            ...event,
            student_name,
            test_title,
          },
          ...prev,
        ]);

        // Update candidate risk score & violations count in grid
        setActiveCandidates((prev) =>
          prev.map((c) => {
            if (c.id === event.attempt_id) {
              return {
                ...c,
                risk_score: current_risk,
                violation_count: (c.violation_count || 0) + 1,
              };
            }
            return c;
          })
        );
      });

      // Listen for real-time candidate kiosk status changes (SECURE, WARNING, COMPROMISED)
      socket.on('candidate_kiosk_status_update', (data) => {
        if (!data?.attempt_id) return;
        setActiveCandidates((prev) =>
          prev.map((c) => {
            if (c.id === data.attempt_id) {
              return {
                ...c,
                kiosk_status: data.kiosk_status || 'SECURE',
              };
            }
            return c;
          })
        );

        // Update inspection panel candidate if currently selected
        setInspectionCandidate((prev) => {
          if (prev && prev.id === data.attempt_id) {
            return {
              ...prev,
              kiosk_status: data.kiosk_status || 'SECURE',
            };
          }
          return prev;
        });
      });

      // Listen for candidate heartbeat stream
      socket.on('candidate_heartbeat_stream', (data) => {
        if (!data?.attempt_id) return;
        setActiveCandidates((prev) =>
          prev.map((c) => {
            if (c.id === data.attempt_id) {
              return {
                ...c,
                camera_status: data.camera_status || c.camera_status || 'LIVE',
                microphone_status: data.microphone_status || c.microphone_status || 'LIVE',
                face_status: data.face_status || c.face_status || 'ONE_FACE',
                display_status: data.display_status || c.display_status || '1 DISPLAY',
                process_status: data.process_status || c.process_status || 'CLEAN',
                network_status: data.network_status || c.network_status || 'CONNECTED',
                kiosk_status: data.kiosk_status || c.kiosk_status || 'SECURE',
                risk_score: data.risk_score !== undefined ? data.risk_score : c.risk_score,
                last_heartbeat: new Date().toLocaleTimeString()
              };
            }
            return c;
          })
        );
      });

      // Listen for exam submission
      socket.on('student_submitted_exam', (updated) => {
        setActiveCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      });

      // Listen for exam termination
      socket.on('student_terminated_exam', (updated) => {
        setActiveCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      });
    }

    return () => {
      if (socket) {
        socket.off('student_started_exam');
        socket.off('new_security_alert');
        socket.off('candidate_kiosk_status_update');
        socket.off('candidate_heartbeat_stream');
        socket.off('student_submitted_exam');
        socket.off('student_terminated_exam');
      }
    };
  }, [socket]);

  const fetchActiveAttempts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/attempts/all`);
      const data = await res.json();
      setActiveCandidates(data);
    } catch (e) {
      console.error('Failed to fetch attempts:', e);
    }
  };

  const handleSendWarning = async () => {
    if (!selectedCandidate || !warningMsg) return;
    try {
      await fetch(`${API_BASE_URL}/api/proctor/warning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attempt_id: selectedCandidate.id,
          proctor_id: user.id,
          message: warningMsg,
          severity: 'warning',
        }),
      });
      setShowWarningModal(false);
      setWarningMsg('');
    } catch (e) {
      console.error('Failed to send warning:', e);
    }
  };

  const handleTerminateCandidate = async () => {
    if (!selectedCandidate) return;
    try {
      await fetch(`${API_BASE_URL}/api/attempts/${selectedCandidate.id}/terminate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: terminateReason,
          proctor_id: user.id,
        }),
      });
      setShowTerminateModal(false);
      if (inspectionCandidate?.id === selectedCandidate.id) {
        setInspectionCandidate(null);
      }
      fetchActiveAttempts();
    } catch (e) {
      console.error('Failed to terminate candidate:', e);
    }
  };

  // Filtered candidate list
  const filteredCandidates = useMemo(() => {
    return activeCandidates.filter((cand) => {
      const matchesSearch =
        searchQuery === '' ||
        cand.student_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cand.student_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cand.test_title?.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (filterKioskStatus === 'ALL') return true;
      if (filterKioskStatus === 'TERMINATED') return cand.status === 'terminated';
      if (filterKioskStatus === 'SECURE') return (cand.kiosk_status || 'SECURE') === 'SECURE' && cand.status !== 'terminated';
      if (filterKioskStatus === 'WARNING') return cand.kiosk_status === 'WARNING' && cand.status !== 'terminated';
      if (filterKioskStatus === 'COMPROMISED') return cand.kiosk_status === 'COMPROMISED' && cand.status !== 'terminated';

      return true;
    });
  }, [activeCandidates, filterKioskStatus, searchQuery]);

  // Aggregate metrics
  const telemetryStats = useMemo(() => {
    const total = activeCandidates.length;
    const secure = activeCandidates.filter((c) => (c.kiosk_status || 'SECURE') === 'SECURE' && c.status === 'in_progress').length;
    const warning = activeCandidates.filter((c) => c.kiosk_status === 'WARNING' && c.status === 'in_progress').length;
    const compromised = activeCandidates.filter((c) => c.kiosk_status === 'COMPROMISED' && c.status === 'in_progress').length;
    const terminated = activeCandidates.filter((c) => c.status === 'terminated').length;

    return { total, secure, warning, compromised, terminated };
  }, [activeCandidates]);

  // Filter incidents for inspection candidate
  const candidateIncidents = useMemo(() => {
    if (!inspectionCandidate) return [];
    return incidents.filter((inc) => inc.attempt_id === inspectionCandidate.id);
  }, [incidents, inspectionCandidate]);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* OPERATIONS COMMAND CENTER HEADER */}
      <div className="glass-panel p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-cyan-500/20 bg-slate-950/80 shadow-2xl">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-xs font-semibold tracking-wide">
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>OPERATIONS COMMAND CENTER</span>
            <span className="text-[10px] text-cyan-400/70 font-mono">● LIVE SURVEILLANCE MATRIX</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Examination Telemetry & Kiosk Security Monitor
          </h1>
          <p className="text-xs text-slate-400">
            Real-time biometric video analysis, Windows kiosk lockdown verification, safe process guard audits, and clipboard enforcement.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchActiveAttempts}
            className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
          >
            <RefreshCw className="w-4 h-4 text-cyan-400" />
            <span>Refresh Feeds</span>
          </button>
        </div>
      </div>

      {/* COMMAND TELEMETRY METRIC STRIP */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="glass-panel p-4 bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Candidates</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{telemetryStats.total}</div>
          <div className="text-[10px] text-slate-500 font-mono">Active Examination Sessions</div>
        </div>

        <div className="glass-panel p-4 bg-emerald-950/20 border border-emerald-500/30 space-y-1">
          <div className="flex items-center justify-between text-xs text-emerald-400">
            <span>Kiosks Secure</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-300 font-mono">{telemetryStats.secure}</div>
          <div className="text-[10px] text-emerald-500/80 font-mono">100% Locked & Isolated</div>
        </div>

        <div className="glass-panel p-4 bg-amber-950/20 border border-amber-500/30 space-y-1">
          <div className="flex items-center justify-between text-xs text-amber-300">
            <span>Kiosks Warning</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-300 font-mono">{telemetryStats.warning}</div>
          <div className="text-[10px] text-amber-500/80 font-mono">Anomalies / Blur Detected</div>
        </div>

        <div className="glass-panel p-4 bg-rose-950/20 border border-rose-500/30 space-y-1">
          <div className="flex items-center justify-between text-xs text-rose-300">
            <span>Compromised</span>
            <AlertOctagon className="w-4 h-4 text-rose-400 animate-pulse" />
          </div>
          <div className="text-2xl font-black text-rose-400 font-mono">{telemetryStats.compromised}</div>
          <div className="text-[10px] text-rose-400/80 font-mono">Process / Exit Attempts</div>
        </div>

        <div className="glass-panel p-4 bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Terminated</span>
            <UserX className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-slate-400 font-mono">{telemetryStats.terminated}</div>
          <div className="text-[10px] text-slate-500 font-mono">Locked by Proctor / Rule</div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="glass-panel p-3.5 bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Status Filters */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            onClick={() => setFilterKioskStatus('ALL')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              filterKioskStatus === 'ALL'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            All Candidates ({telemetryStats.total})
          </button>
          <button
            onClick={() => setFilterKioskStatus('SECURE')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              filterKioskStatus === 'SECURE'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-emerald-300 hover:bg-slate-800'
            }`}
          >
            ● Kiosk Secure ({telemetryStats.secure})
          </button>
          <button
            onClick={() => setFilterKioskStatus('WARNING')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              filterKioskStatus === 'WARNING'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800'
            }`}
          >
            ● Warning ({telemetryStats.warning})
          </button>
          <button
            onClick={() => setFilterKioskStatus('COMPROMISED')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              filterKioskStatus === 'COMPROMISED'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                : 'text-slate-400 hover:text-rose-300 hover:bg-slate-800'
            }`}
          >
            ● Compromised ({telemetryStats.compromised})
          </button>
          <button
            onClick={() => setFilterKioskStatus('TERMINATED')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              filterKioskStatus === 'TERMINATED'
                ? 'bg-slate-800 text-slate-200 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800'
            }`}
          >
            Terminated ({telemetryStats.terminated})
          </button>
        </div>

        {/* Search input */}
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidate name or ID..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* MAIN TWO-COLUMN MONITORING LAYOUT */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* CANDIDATES SURVEILLANCE GRID (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              <span>Surveillance Grid ({filteredCandidates.length} Displayed)</span>
            </h2>
            <span className="text-[11px] text-slate-400 font-mono">
              Auto-updating via WebSocket (proctor:live)
            </span>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {filteredCandidates.length === 0 ? (
              <div className="md:col-span-2 glass-panel p-12 text-center text-slate-400 text-xs border border-slate-800">
                <Shield className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                <p>No candidate sessions matching the selected filter.</p>
              </div>
            ) : (
              filteredCandidates.map((candidate) => {
                const kStatus = candidate.kiosk_status || 'SECURE';
                const isHighRisk = (candidate.risk_score || 0) >= 40;
                const isTerminated = candidate.status === 'terminated';
                const isCompleted = candidate.status === 'completed';
                const isCompromised = kStatus === 'COMPROMISED';
                const isWarning = kStatus === 'WARNING';

                return (
                  <div
                    key={candidate.id}
                    className={`glass-panel p-5 space-y-3.5 border transition-all relative ${
                      isTerminated
                        ? 'border-slate-800 bg-slate-950/60 opacity-75'
                        : isCompromised
                        ? 'border-rose-500/50 bg-rose-950/20 shadow-lg shadow-rose-950/30'
                        : isWarning || isHighRisk
                        ? 'border-amber-500/50 bg-amber-950/20 shadow-lg shadow-amber-950/30'
                        : 'border-slate-800/90 bg-slate-900/60 hover:border-cyan-500/40'
                    }`}
                  >
                    {/* Header: Candidate Info & Kiosk Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                          {candidate.student_name}
                        </h3>
                        <span className="text-[11px] font-mono text-cyan-400/90">
                          ID: {candidate.student_code}
                        </span>
                      </div>

                      {/* REAL-TIME KIOSK STATUS BADGE */}
                      <div className="flex flex-col items-end gap-1">
                        {isTerminated ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            TERMINATED
                          </span>
                        ) : isCompleted ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase bg-slate-800 text-slate-400 border border-slate-700">
                            COMPLETED
                          </span>
                        ) : isCompromised ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-mono font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                            <AlertOctagon className="w-3 h-3 text-rose-400" />
                            KIOSK COMPROMISED
                          </span>
                        ) : isWarning ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-mono font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            KIOSK WARNING
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-mono font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            KIOSK SECURE
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stream Preview & Risk Meter */}
                    <div className="relative aspect-video rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
                      <div className="text-center p-2">
                        <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 mx-auto flex items-center justify-center mb-1">
                          <Eye className="w-5 h-5 text-cyan-400" />
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono">Live Video Telemetry</p>
                      </div>

                      {/* Risk Badge Overlay */}
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-slate-900/90 border border-slate-800 backdrop-blur text-[10px] font-mono">
                        Risk Score:{' '}
                        <span className={isHighRisk ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                          {candidate.risk_score || 0}%
                        </span>
                      </div>

                      {/* Exam Title Overlay */}
                      <div className="absolute bottom-2 left-2 max-w-[80%] truncate text-[10px] text-slate-400 bg-slate-900/90 px-2 py-0.5 rounded border border-slate-800 font-mono">
                        {candidate.test_title}
                      </div>
                    </div>

                    {/* LIVE CANDIDATE SURVEILLANCE TELEMETRY PILLS */}
                    <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono text-slate-400 pt-1">
                      <div className="flex items-center gap-1 bg-slate-950/80 px-2 py-1 rounded border border-slate-800">
                        <Eye className="w-3 h-3 text-cyan-400" />
                        <span className="truncate">Camera: {candidate.camera_status || 'LIVE'}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-slate-950/80 px-2 py-1 rounded border border-slate-800">
                        <ShieldCheck className="w-3 h-3 text-cyan-400" />
                        <span className="truncate">Face: {candidate.face_status || 'ONE FACE'}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-slate-950/80 px-2 py-1 rounded border border-slate-800">
                        <Monitor className="w-3 h-3 text-cyan-400" />
                        <span className="truncate">Display: {candidate.display_status || '1'}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-slate-950/80 px-2 py-1 rounded border border-slate-800">
                        <Cpu className="w-3 h-3 text-cyan-400" />
                        <span className="truncate">Process: {candidate.process_status || 'CLEAN'}</span>
                      </div>
                    </div>

                    {/* Exam Violations Count */}
                    <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                      <span className="text-[11px] text-slate-400">
                        Alerts Recorded: <strong className="text-white">{candidate.violation_count || 0}</strong>
                      </span>
                      <button
                        onClick={() => setInspectionCandidate(candidate)}
                        className="text-cyan-400 hover:text-cyan-300 text-xs font-semibold flex items-center gap-0.5"
                      >
                        <span>Telemetry Detail</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Action Controls */}
                    {!isTerminated && !isCompleted && (
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
                        <button
                          onClick={() => {
                            setSelectedCandidate(candidate);
                            setShowWarningModal(true);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center justify-center gap-1 transition-all"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Warn</span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedCandidate(candidate);
                            setShowTerminateModal(true);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center justify-center gap-1 transition-all"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span>Terminate</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* REAL-TIME SECURITY INCIDENT STREAM (1 Col) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
              <span>Real-Time Incident Stream</span>
            </h2>
            <span className="text-xs text-rose-400 font-mono font-bold animate-pulse">● LIVE</span>
          </div>

          <div className="glass-panel p-4 space-y-3 max-h-[620px] overflow-y-auto border border-slate-800 bg-slate-900/60">
            {incidents.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-xs space-y-2">
                <ShieldCheck className="w-8 h-8 text-emerald-500/40 mx-auto" />
                <p>No security violation alerts triggered yet.</p>
                <p className="text-[10px] text-slate-600 font-mono">Monitoring clean session stream...</p>
              </div>
            ) : (
              incidents.map((incident, idx) => (
                <div
                  key={incident.id || idx}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase ${
                        incident.severity === 'critical'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : incident.severity === 'high'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      }`}
                    >
                      {incident.event_type?.replace(/_/g, ' ') || 'SECURITY EVENT'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(incident.event_time || Date.now()).toLocaleTimeString()}
                    </span>
                  </div>

                  <p className="text-xs font-bold text-white flex items-center justify-between">
                    <span>{incident.student_name || 'Candidate'}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {incident.attempt_id?.substring(0, 10)}
                    </span>
                  </p>

                  <div className="text-[11px] text-slate-300 bg-slate-900/80 p-2 rounded border border-slate-800/80 font-mono break-words">
                    {incident.payload
                      ? typeof incident.payload === 'object'
                        ? JSON.stringify(incident.payload)
                        : incident.payload
                      : 'Security Anomaly Flagged'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* CANDIDATE TELEMETRY INSPECTION DRAWER / MODAL */}
      {inspectionCandidate && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-panel max-w-2xl w-full p-6 space-y-5 border border-cyan-500/30 bg-slate-950 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Drawer Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-xs font-mono">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  <span>CANDIDATE TELEMETRY INSPECTION</span>
                </div>
                <h3 className="text-xl font-black text-white mt-1">
                  {inspectionCandidate.student_name}
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  ID: {inspectionCandidate.student_code} | Attempt: {inspectionCandidate.id}
                </p>
              </div>

              <button
                onClick={() => setInspectionCandidate(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* KIOSK STATUS OVERVIEW */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 font-mono uppercase">Kiosk State</span>
                <p className="text-xs font-bold font-mono">
                  {(inspectionCandidate.kiosk_status || 'SECURE') === 'SECURE' ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> SECURE
                    </span>
                  ) : (inspectionCandidate.kiosk_status || '') === 'WARNING' ? (
                    <span className="text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> WARNING
                    </span>
                  ) : (
                    <span className="text-rose-400 flex items-center gap-1">
                      <AlertOctagon className="w-3.5 h-3.5" /> COMPROMISED
                    </span>
                  )}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 font-mono uppercase">Risk Level</span>
                <p className="text-xs font-bold font-mono text-cyan-300">
                  {inspectionCandidate.risk_score || 0}% / 100%
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 font-mono uppercase">Alert Count</span>
                <p className="text-xs font-bold font-mono text-rose-400">
                  {inspectionCandidate.violation_count || 0} Incidents
                </p>
              </div>
            </div>

            {/* DETAILED DIAGNOSTIC TELEMETRY */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span>Security Diagnostics Telemetry</span>
              </h4>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">Window Lockdown:</span>
                  <span className="text-emerald-400 font-bold">Topmost (screen-saver)</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">Display Policy:</span>
                  <span className="text-emerald-400 font-bold">Single Display Active</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">Process Guard:</span>
                  <span className="text-emerald-400 font-bold">Clean Baseline Monitored</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">Clipboard Restriction:</span>
                  <span className="text-emerald-400 font-bold">Strict Copy/Paste Locked</span>
                </div>
              </div>
            </div>

            {/* CANDIDATE INCIDENT LOG */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-white flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <span>Violation Audit History ({candidateIncidents.length})</span>
                </span>
              </h4>

              <div className="max-h-40 overflow-y-auto space-y-2">
                {candidateIncidents.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-500 rounded bg-slate-900 border border-slate-800">
                    No violations recorded for this candidate.
                  </div>
                ) : (
                  candidateIncidents.map((inc, i) => (
                    <div key={i} className="p-2.5 rounded bg-slate-900 border border-slate-800 text-xs font-mono">
                      <div className="flex justify-between text-slate-400">
                        <span className="text-rose-400 font-bold">{inc.event_type}</span>
                        <span>{new Date(inc.event_time).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-slate-300 mt-1">
                        {typeof inc.payload === 'object' ? JSON.stringify(inc.payload) : inc.payload}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* FOOTER ACTIONS */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                onClick={() => setInspectionCandidate(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white text-xs font-semibold"
              >
                Close Inspector
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedCandidate(inspectionCandidate);
                    setShowWarningModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Dispatch Warning</span>
                </button>
                <button
                  onClick={() => {
                    setSelectedCandidate(inspectionCandidate);
                    setShowTerminateModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-rose-600/20"
                >
                  <UserX className="w-3.5 h-3.5" />
                  <span>Terminate Session</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WARNING MODAL */}
      {showWarningModal && selectedCandidate && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full p-6 space-y-4 border border-amber-500/30 bg-slate-950">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-amber-400" />
              <span>Issue Proctor Warning to {selectedCandidate.student_name}</span>
            </h3>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Warning Message</label>
              <textarea
                rows={3}
                value={warningMsg}
                onChange={(e) => setWarningMsg(e.target.value)}
                placeholder="e.g. Please refrain from attempting to switch windows or close the exam kiosk."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Quick preset buttons */}
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => setWarningMsg('Refrain from looking off-screen. Maintain focus on camera.')}
                className="px-2.5 py-1 rounded bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              >
                Off-screen Gaze
              </button>
              <button
                type="button"
                onClick={() => setWarningMsg('Close all background applications immediately or session will be terminated.')}
                className="px-2.5 py-1 rounded bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              >
                Close Apps
              </button>
              <button
                type="button"
                onClick={() => setWarningMsg('Clipboard and copy-paste operations are strictly forbidden.')}
                className="px-2.5 py-1 rounded bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              >
                Clipboard Alert
              </button>
              <button
                type="button"
                onClick={() => setWarningMsg('Do not attempt to exit kiosk or minimize the examination window.')}
                className="px-2.5 py-1 rounded bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              >
                Kiosk Exit Alert
              </button>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => setShowWarningModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-slate-400 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSendWarning}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20"
              >
                Dispatch Warning
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TERMINATE SESSION MODAL */}
      {showTerminateModal && selectedCandidate && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel glass-panel-danger max-w-md w-full p-6 space-y-4 border border-rose-500/40 bg-slate-950">
            <h3 className="text-lg font-bold text-rose-400 flex items-center gap-2">
              <UserX className="w-5 h-5 text-rose-500" />
              <span>Force Terminate Candidate Session</span>
            </h3>

            <p className="text-xs text-slate-300">
              This action will immediately lock candidate{' '}
              <strong className="text-white">{selectedCandidate.student_name}</strong> out of their examination kiosk
              and mark their attempt as terminated.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Termination Reason</label>
              <textarea
                rows={3}
                value={terminateReason}
                onChange={(e) => setTerminateReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-rose-300 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => setShowTerminateModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-slate-400 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleTerminateCandidate}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/20"
              >
                Confirm Termination
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
