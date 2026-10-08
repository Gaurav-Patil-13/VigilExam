import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { Shield, Eye, AlertTriangle, Send, XCircle, CheckCircle, Search, Filter, RefreshCw, Cpu, Activity, UserX, MessageSquare } from 'lucide-react';

export const ProctorDashboard = () => {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [activeCandidates, setActiveCandidates] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningMsg, setWarningMsg] = useState('');
  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [terminateReason, setTerminateReason] = useState('Repeated unauthorized background process detections');

  // Load Active Attempts & Setup Socket Listeners
  useEffect(() => {
    fetchActiveAttempts();

    if (socket) {
      socket.emit('join_proctor_room');

      // Listen for new candidate starting exam
      socket.on('student_started_exam', (attempt) => {
        setActiveCandidates(prev => {
          if (!prev.find(c => c.id === attempt.id)) {
            return [attempt, ...prev];
          }
          return prev;
        });
      });

      // Listen for incoming security alert
      socket.on('new_security_alert', (data) => {
        const { event, student_name, test_title, current_risk } = data;
        
        // Add incident to live feed
        setIncidents(prev => [{
          ...event,
          student_name,
          test_title
        }, ...prev]);

        // Update candidate risk score in grid
        setActiveCandidates(prev => prev.map(c => {
          if (c.id === event.attempt_id) {
            return {
              ...c,
              risk_score: current_risk,
              violation_count: (c.violation_count || 0) + 1
            };
          }
          return c;
        }));
      });

      // Listen for exam submission
      socket.on('student_submitted_exam', (updated) => {
        setActiveCandidates(prev => prev.map(c => c.id === updated.id ? updated : c));
      });

      // Listen for exam termination
      socket.on('student_terminated_exam', (updated) => {
        setActiveCandidates(prev => prev.map(c => c.id === updated.id ? updated : c));
      });
    }

    return () => {
      if (socket) {
        socket.off('student_started_exam');
        socket.off('new_security_alert');
        socket.off('student_submitted_exam');
        socket.off('student_terminated_exam');
      }
    };
  }, [socket]);

  const fetchActiveAttempts = async () => {
    try {
      const res = await fetch('http://localhost:4000/api/attempts/all');
      const data = await res.json();
      setActiveCandidates(data);
    } catch (e) {
      console.error("Failed to fetch attempts:", e);
    }
  };

  const handleSendWarning = async () => {
    if (!selectedCandidate || !warningMsg) return;
    try {
      await fetch('http://localhost:4000/api/proctor/warning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attempt_id: selectedCandidate.id,
          proctor_id: user.id,
          message: warningMsg,
          severity: "warning"
        })
      });
      setShowWarningModal(false);
      setWarningMsg('');
    } catch (e) {
      console.error("Failed to send warning:", e);
    }
  };

  const handleTerminateCandidate = async () => {
    if (!selectedCandidate) return;
    try {
      await fetch(`http://localhost:4000/api/attempts/${selectedCandidate.id}/terminate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: terminateReason,
          proctor_id: user.id
        })
      });
      setShowTerminateModal(false);
      fetchActiveAttempts();
    } catch (e) {
      console.error("Failed to terminate candidate:", e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      
      {/* Header Banner */}
      <div className="glass-panel p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-semibold">
            <Eye className="w-3.5 h-3.5 text-amber-400" />
            <span>Central Proctor Command Console</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">Live Examination Surveillance</h1>
          <p className="text-xs text-slate-400">Monitoring real-time candidate video feeds, process security events, and AI anomaly alerts.</p>
        </div>

        <button
          onClick={fetchActiveAttempts}
          className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4 text-indigo-400" />
          <span>Refresh Candidates</span>
        </button>
      </div>

      {/* Main Grid: Candidates Grid + Live Incident Feed */}
      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* Active Candidates Grid (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400" />
              <span>Active Candidates Grid ({activeCandidates.length})</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {activeCandidates.length === 0 ? (
              <div className="md:col-span-2 glass-panel p-8 text-center text-slate-400 text-xs">
                No candidate sessions active at this moment.
              </div>
            ) : (
              activeCandidates.map((candidate) => {
                const isHighRisk = (candidate.risk_score || 0) >= 40;
                const isTerminated = candidate.status === 'terminated';
                const isCompleted = candidate.status === 'completed';

                return (
                  <div
                    key={candidate.id}
                    className={`glass-panel p-5 space-y-4 border transition-all ${
                      isTerminated ? 'glass-panel-danger' :
                      isHighRisk ? 'glass-panel-warning pulse-alert' :
                      'border-slate-800'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                          {candidate.student_name}
                        </h3>
                        <span className="text-[11px] font-mono text-slate-400">
                          ID: {candidate.student_code}
                        </span>
                      </div>

                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
                        isTerminated ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' :
                        isCompleted ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                        isHighRisk ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                        'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                      }`}>
                        {candidate.status}
                      </span>
                    </div>

                    {/* Stream Preview & Risk Meter */}
                    <div className="relative aspect-video rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
                      <div className="text-center p-2">
                        <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 mx-auto flex items-center justify-center mb-1">
                          <Eye className="w-5 h-5 text-indigo-400" />
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono">Live Video Stream</p>
                      </div>

                      {/* Risk Badge Overlay */}
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-slate-900/90 border border-slate-800 backdrop-blur text-[10px] font-mono">
                        Risk Score: <span className={isHighRisk ? "text-rose-400 font-bold" : "text-emerald-400"}>{candidate.risk_score || 0}%</span>
                      </div>
                    </div>

                    {/* Exam & Violations count */}
                    <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                      <span className="truncate max-w-[160px]">{candidate.test_title}</span>
                      <span className="font-mono text-rose-400 font-semibold">
                        {candidate.violation_count || 0} Alert(s)
                      </span>
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
                          <span>Warn Candidate</span>
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

        {/* Real-Time Security Incident Stream (1 col) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-rose-400" />
              <span>Real-Time Incident Stream</span>
            </h2>
            <span className="text-xs text-rose-400 font-mono font-bold animate-pulse">● LIVE</span>
          </div>

          <div className="glass-panel p-4 space-y-3 max-h-[600px] overflow-y-auto">
            {incidents.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                No security violation alerts triggered yet. Monitoring clean session stream...
              </div>
            ) : (
              incidents.map((incident) => (
                <div key={incident.id} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase ${
                      incident.severity === 'critical' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                      incident.severity === 'high' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                      'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    }`}>
                      {incident.event_type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(incident.event_time).toLocaleTimeString()}
                    </span>
                  </div>

                  <p className="text-xs font-bold text-white">{incident.student_name}</p>

                  <div className="text-[11px] text-slate-400 bg-slate-950 p-2 rounded border border-slate-800/80 font-mono">
                    {incident.payload ? JSON.stringify(incident.payload) : "Security Anomaly Flagged"}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Warning Modal */}
      {showWarningModal && selectedCandidate && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full p-6 space-y-4 border border-slate-800">
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
                placeholder="e.g. Please refrain from looking away from the camera feed or closing windows."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex gap-2 text-xs">
              <button
                onClick={() => setWarningMsg("Refrain from looking off-screen.")}
                className="px-2.5 py-1 rounded bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              >
                Off-screen Gaze
              </button>
              <button
                onClick={() => setWarningMsg("Close all background applications immediately.")}
                className="px-2.5 py-1 rounded bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              >
                Close Apps
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
                className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20"
              >
                Dispatch Warning
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terminate Session Modal */}
      {showTerminateModal && selectedCandidate && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel glass-panel-danger max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-rose-400 flex items-center gap-2">
              <UserX className="w-5 h-5 text-rose-500" />
              <span>Force Terminate Candidate Session</span>
            </h3>

            <p className="text-xs text-slate-300">
              This action will immediately lock candidate <strong className="text-white">{selectedCandidate.student_name}</strong> out of their examination kiosk.
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
                className="px-4 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs shadow-lg shadow-rose-600/20"
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
