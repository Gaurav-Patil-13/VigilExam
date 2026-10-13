import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Search,
  PowerOff,
  Trash2,
  Lock,
  Layers,
  HelpCircle,
  X,
  AlertCircle,
  ShieldCheck,
  Check
} from 'lucide-react';

export const ProcessManagementPanel = ({ onScanComplete, compact = false, readOnly = false }) => {
  const [processes, setProcesses] = useState([]);
  const [summary, setSummary] = useState({
    totalCount: 0,
    prohibitedCount: 0,
    userAppCount: 0,
    protectedCount: 0,
    unknownCount: 0,
    devToolCount: 0,
    lastScanTime: null
  });

  // Explicit Examination Process Status states:
  // 'SCANNING' | 'PROHIBITED APPS FOUND' | 'CLOSING APPLICATIONS' | 'RESCANNING' | 'SECURE ENVIRONMENT READY' | 'BLOCKED — PROHIBITED APPLICATIONS STILL RUNNING'
  const [panelStatus, setPanelStatus] = useState('SCANNING');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL' | 'PROHIBITED' | 'USER_APP' | 'PROTECTED' | 'UNKNOWN'
  const [selectedPids, setSelectedPids] = useState(new Set());
  const [actionInProgress, setActionInProgress] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    type: 'single', // 'single' | 'bulk' | 'all_prohibited'
    target: null
  });

  const runScan = async (isRescan = false) => {
    setLoading(true);
    setError(null);
    if (isRescan) {
      setPanelStatus('RESCANNING');
    } else {
      setPanelStatus('SCANNING');
    }

    try {
      if (window.vigilNative?.scanProcesses) {
        const res = await window.vigilNative.scanProcesses();
        if (res && res.success) {
          const list = res.processes || [];
          const prohibited = (res.suspicious && res.suspicious.length > 0)
            ? res.suspicious
            : list.filter((p) => p.isProhibited);
          const userApps = (res.userApps && res.userApps.length > 0)
            ? res.userApps
            : list.filter((p) => p.category === 'NORMAL_USER_APPLICATION');
          const protectedApps = (res.protectedProcesses && res.protectedProcesses.length > 0)
            ? res.protectedProcesses
            : list.filter((p) => p.isProtected && p.category !== 'UNKNOWN');
          const unknownApps = (res.unknownProcesses && res.unknownProcesses.length > 0)
            ? res.unknownProcesses
            : list.filter((p) => p.category === 'UNKNOWN');
          const devTools = (res.devTools && res.devTools.length > 0)
            ? res.devTools
            : list.filter((p) => p.category === 'DEVELOPMENT_TOOL');

          setProcesses(list);
          const newSummary = {
            totalCount: res.totalCount || list.length,
            prohibitedCount: prohibited.length,
            userAppCount: userApps.length,
            protectedCount: protectedApps.length,
            unknownCount: unknownApps.length,
            devToolCount: devTools.length,
            lastScanTime: res.timestamp || new Date().toISOString()
          };
          setSummary(newSummary);
          setSelectedPids(new Set());

          const isBgAllowed = res.allowBackgroundProcesses !== false;
          if (prohibited.length > 0) {
            setPanelStatus(isRescan ? 'BLOCKED — PROHIBITED APPLICATIONS STILL RUNNING' : 'PROHIBITED APPS FOUND');
          } else if (!isBgAllowed && userApps.length > 0) {
            setPanelStatus('USER APPLICATIONS RUNNING');
          } else {
            setPanelStatus('SECURE ENVIRONMENT READY');
          }

          if (onScanComplete) {
            onScanComplete({
              ...res,
              suspicious: prohibited,
              userApps: userApps,
              prohibitedCount: prohibited.length,
              panelStatus: prohibited.length > 0
                ? (isRescan ? 'BLOCKED — PROHIBITED APPLICATIONS STILL RUNNING' : 'PROHIBITED APPS FOUND')
                : (!isBgAllowed && userApps.length > 0 ? 'USER APPLICATIONS RUNNING' : 'SECURE ENVIRONMENT READY')
            });
          }
        } else {
          const errText = res?.error || 'Process scanning failed to query the operating system.';
          setError(errText);
          setPanelStatus('BLOCKED — PROHIBITED APPLICATIONS STILL RUNNING');
          if (onScanComplete) {
            onScanComplete({ success: false, error: errText, suspicious: [], userApps: [] });
          }
        }
      } else {
        // Fallback in web preview mode without native bridge
        const mockTime = new Date().toISOString();
        setSummary({
          totalCount: 0,
          prohibitedCount: 0,
          userAppCount: 0,
          protectedCount: 0,
          unknownCount: 0,
          devToolCount: 0,
          lastScanTime: mockTime
        });
        setPanelStatus('SECURE ENVIRONMENT READY');
        if (onScanComplete) {
          onScanComplete({ success: true, suspicious: [], userApps: [] });
        }
      }
    } catch (err) {
      const errText = err.message || 'Error occurred while querying native process monitor.';
      setError(errText);
      setPanelStatus('BLOCKED — PROHIBITED APPLICATIONS STILL RUNNING');
      if (onScanComplete) {
        onScanComplete({ success: false, error: errText, suspicious: [], userApps: [] });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runScan();
  }, []);

  // Prohibited processes list
  const prohibitedProcesses = useMemo(() => {
    return processes.filter((p) => p.isProhibited);
  }, [processes]);

  // Filtered processes based on search and active tab
  const filteredProcesses = useMemo(() => {
    return processes.filter((proc) => {
      // Tab filter
      if (activeFilter === 'PROHIBITED' && !proc.isProhibited) return false;
      if (activeFilter === 'USER_APP' && proc.category !== 'NORMAL_USER_APPLICATION') return false;
      if (activeFilter === 'PROTECTED' && (!proc.isProtected || proc.category === 'UNKNOWN')) return false;
      if (activeFilter === 'UNKNOWN' && proc.category !== 'UNKNOWN') return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (proc.name || '').toLowerCase().includes(q);
        const displayMatch = (proc.displayName || '').toLowerCase().includes(q);
        const pidMatch = String(proc.pid).includes(q);
        const reasonMatch = (proc.reason || '').toLowerCase().includes(q);
        return nameMatch || displayMatch || pidMatch || reasonMatch;
      }

      return true;
    });
  }, [processes, activeFilter, searchQuery]);

  // Eligible targets for termination (never protected system, never vigil runtime, never dev tool)
  const isEligibleForTermination = (proc) => {
    if (proc.isProtected || proc.category === 'DEVELOPMENT_TOOL') return false;
    return proc.isProhibited || proc.category === 'NORMAL_USER_APPLICATION';
  };

  const eligibleInFiltered = useMemo(() => {
    return filteredProcesses.filter(isEligibleForTermination);
  }, [filteredProcesses]);

  const toggleSelectPid = (pid) => {
    setSelectedPids((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) {
        next.delete(pid);
      } else {
        next.add(pid);
      }
      return next;
    });
  };

  const toggleSelectAllEligible = () => {
    if (selectedPids.size >= eligibleInFiltered.length && eligibleInFiltered.length > 0) {
      setSelectedPids(new Set());
    } else {
      const next = new Set();
      eligibleInFiltered.forEach((p) => next.add(p.pid));
      setSelectedPids(next);
    }
  };

  // Close Single Application
  const promptCloseSingle = (proc) => {
    setConfirmModal({
      open: true,
      type: 'single',
      target: proc
    });
  };

  // Close Bulk Selected Applications
  const promptCloseBulk = () => {
    const targets = processes.filter((p) => selectedPids.has(p.pid) && isEligibleForTermination(p));
    if (targets.length === 0) return;
    setConfirmModal({
      open: true,
      type: 'bulk',
      target: targets
    });
  };

  // Close All Prohibited Applications (Mandatory Clearance)
  const promptCloseAllProhibited = () => {
    if (prohibitedProcesses.length === 0) return;
    setConfirmModal({
      open: true,
      type: 'all_prohibited',
      target: prohibitedProcesses
    });
  };

  const executeConfirmedTermination = async () => {
    const { type, target } = confirmModal;
    setConfirmModal({ open: false, type: 'single', target: null });
    setFeedback(null);
    setPanelStatus('CLOSING APPLICATIONS');

    if (type === 'single' && target) {
      setActionInProgress(target.pid);
      try {
        if (window.vigilNative?.terminateApprovedProcess) {
          const res = await window.vigilNative.terminateApprovedProcess(target.pid, target.name);
          if (res?.success) {
            setFeedback({
              type: 'success',
              text: `Application "${target.displayName || target.name}" (PID ${target.pid}) closed successfully.`
            });
          } else {
            setFeedback({
              type: 'error',
              text: `Could not close "${target.displayName || target.name}": ${res?.reason || 'Access denied'}`
            });
          }
        }
      } catch (err) {
        setFeedback({ type: 'error', text: err.message });
      } finally {
        setActionInProgress(null);
        await runScan(true);
      }
    } else if (type === 'all_prohibited') {
      setActionInProgress('all_prohibited');
      try {
        if (window.vigilNative?.closeAllProhibitedApplications) {
          const res = await window.vigilNative.closeAllProhibitedApplications();
          setFeedback({
            type: res?.isClean ? 'success' : 'error',
            text: `Clearance complete: ${res?.closedCount || 0} prohibited application(s) closed. ${
              res?.remainingProhibited?.length || 0
            } remaining.`
          });
        }
      } catch (err) {
        setFeedback({ type: 'error', text: err.message });
      } finally {
        setActionInProgress(null);
        await runScan(true);
      }
    } else if (type === 'bulk' && Array.isArray(target)) {
      setActionInProgress('bulk');
      let closedCount = 0;
      let failedCount = 0;

      for (const item of target) {
        try {
          if (window.vigilNative?.terminateApprovedProcess) {
            const res = await window.vigilNative.terminateApprovedProcess(item.pid, item.name);
            if (res?.success) {
              closedCount++;
            } else {
              failedCount++;
            }
          }
        } catch (e) {
          failedCount++;
        }
      }

      setFeedback({
        type: closedCount > 0 ? 'success' : 'error',
        text: `Batch closure complete: ${closedCount} application(s) closed, ${failedCount} failed.`
      });

      setActionInProgress(null);
      await runScan(true);
    }
  };

  const getStatusBadgeComponent = () => {
    switch (panelStatus) {
      case 'SCANNING':
        return (
          <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold font-mono animate-pulse flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
            <span>SCANNING</span>
          </span>
        );
      case 'PROHIBITED APPS FOUND':
        return (
          <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold font-mono flex items-center gap-1.5 animate-bounce">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>PROHIBITED APPS FOUND</span>
          </span>
        );
      case 'CLOSING APPLICATIONS':
        return (
          <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold font-mono flex items-center gap-1.5 animate-pulse">
            <PowerOff className="w-3.5 h-3.5 text-amber-400" />
            <span>CLOSING APPLICATIONS</span>
          </span>
        );
      case 'RESCANNING':
        return (
          <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-bold font-mono flex items-center gap-1.5 animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
            <span>RESCANNING</span>
          </span>
        );
      case 'SECURE ENVIRONMENT READY':
        return (
          <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold font-mono flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>SECURE ENVIRONMENT READY</span>
          </span>
        );
      case 'USER APPLICATIONS RUNNING':
        return (
          <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold font-mono flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>USER APPLICATIONS RUNNING</span>
          </span>
        );
      case 'BLOCKED — PROHIBITED APPLICATIONS STILL RUNNING':
      default:
        return (
          <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold font-mono flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>BLOCKED — PROHIBITED APPLICATIONS STILL RUNNING</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Real-time Status Strip */}
      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">Audit Clearance Status:</span>
          {getStatusBadgeComponent()}
        </div>

        {summary.prohibitedCount > 0 && !readOnly && (
          <button
            onClick={promptCloseAllProhibited}
            disabled={actionInProgress !== null}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 transition-all"
          >
            <PowerOff className="w-3.5 h-3.5" />
            <span>Close All Prohibited Applications ({summary.prohibitedCount})</span>
          </button>
        )}
      </div>

      {/* MANDATORY PROHIBITED APPLICATIONS TABLE (Displayed prominently when violations exist) */}
      {prohibitedProcesses.length > 0 && (
        <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
              <h4 className="text-sm font-black text-rose-200 uppercase tracking-wide">
                Prohibited Applications Detected ({prohibitedProcesses.length})
              </h4>
            </div>
            <span className="text-[11px] text-rose-400/90 font-mono">
              Exam entry strictly blocked until resolved
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-rose-900/40 bg-slate-950/80">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-rose-900/40 text-[11px] text-rose-300 font-mono bg-rose-950/40">
                  <th className="py-2.5 px-3">Application</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-right">PID</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-900/20">
                {prohibitedProcesses.map((proc) => {
                  const isClosing = actionInProgress === proc.pid || actionInProgress === 'all_prohibited';
                  return (
                    <tr key={`${proc.pid}-${proc.name}`} className="hover:bg-rose-950/30 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-white flex items-center gap-2">
                        <div className="p-1 rounded bg-rose-500/20 text-rose-400">
                          <ShieldAlert className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span>{proc.displayName || proc.name}</span>
                          <span className="block text-[10px] text-slate-400 font-mono">{proc.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-rose-300 text-[11px]">
                        {proc.subCategoryLabel || proc.categoryLabel}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300 font-bold">{proc.pid}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                            isClosing
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {isClosing ? 'CLOSING...' : 'RUNNING'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {!readOnly ? (
                          <button
                            onClick={() => promptCloseSingle(proc)}
                            disabled={actionInProgress !== null}
                            className="px-3 py-1 rounded-lg bg-rose-500 hover:bg-rose-400 disabled:opacity-40 text-slate-950 font-black text-xs transition-all shadow-sm flex items-center gap-1 ml-auto"
                          >
                            <PowerOff className="w-3 h-3" />
                            <span>Close</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-mono">Blocked</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Metric Counters Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-slate-400 font-medium">Total Scanned</p>
            <p className="text-xl font-black text-white font-mono">{summary.totalCount}</p>
          </div>
          <Layers className="w-5 h-5 text-slate-500" />
        </div>

        <div className="p-3 rounded-xl bg-slate-900/80 border border-rose-500/20 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-rose-300 font-medium">Prohibited</p>
            <p className="text-xl font-black text-rose-400 font-mono">{summary.prohibitedCount}</p>
          </div>
          <ShieldAlert className="w-5 h-5 text-rose-400" />
        </div>

        <div className="p-3 rounded-xl bg-slate-900/80 border border-amber-500/20 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-amber-300 font-medium">User Apps</p>
            <p className="text-xl font-black text-amber-400 font-mono">{summary.userAppCount}</p>
          </div>
          <AlertTriangle className="w-5 h-5 text-amber-400" />
        </div>

        <div className="p-3 rounded-xl bg-slate-900/80 border border-cyan-500/20 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-cyan-300 font-medium">Protected System</p>
            <p className="text-xl font-black text-cyan-400 font-mono">{summary.protectedCount}</p>
          </div>
          <Lock className="w-5 h-5 text-cyan-400" />
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="p-1 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Toolbar & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search process by name, PID, or reason..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-1 rounded-xl text-xs overflow-x-auto">
          <button
            onClick={() => setActiveFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeFilter === 'ALL'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All ({summary.totalCount})
          </button>
          <button
            onClick={() => setActiveFilter('PROHIBITED')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1 ${
              activeFilter === 'PROHIBITED'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-sm'
                : 'text-rose-400/80 hover:text-rose-300'
            }`}
          >
            Prohibited ({summary.prohibitedCount})
          </button>
          <button
            onClick={() => setActiveFilter('USER_APP')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1 ${
              activeFilter === 'USER_APP'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                : 'text-amber-400/80 hover:text-amber-300'
            }`}
          >
            User Apps ({summary.userAppCount})
          </button>
          <button
            onClick={() => setActiveFilter('PROTECTED')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1 ${
              activeFilter === 'PROTECTED'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                : 'text-cyan-400/80 hover:text-cyan-300'
            }`}
          >
            Protected ({summary.protectedCount})
          </button>
          <button
            onClick={() => setActiveFilter('UNKNOWN')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeFilter === 'UNKNOWN'
                ? 'bg-slate-800 text-slate-200 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Unknown ({summary.unknownCount})
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {!readOnly && selectedPids.size > 0 && (
            <button
              onClick={promptCloseBulk}
              disabled={actionInProgress !== null}
              className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <PowerOff className="w-3.5 h-3.5" />
              <span>Close Selected ({selectedPids.size})</span>
            </button>
          )}

          <button
            onClick={() => runScan(true)}
            disabled={loading}
            title="Refresh running processes"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-slate-700 transition-all disabled:opacity-50 flex items-center gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            <span className="hidden sm:inline">{loading ? 'Scanning...' : 'Rescan'}</span>
          </button>
        </div>
      </div>

      {/* Process Table Header & List */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/70">
        <div className="p-3 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-semibold">
          <div className="flex items-center gap-3">
            {!readOnly && eligibleInFiltered.length > 0 && (
              <input
                type="checkbox"
                checked={selectedPids.size >= eligibleInFiltered.length && eligibleInFiltered.length > 0}
                onChange={toggleSelectAllEligible}
                className="rounded border-slate-700 text-cyan-500 focus:ring-0 focus:ring-offset-0 bg-slate-900 cursor-pointer"
                title="Select all eligible applications"
              />
            )}
            <span>Application & Process Identity</span>
          </div>
          <div className="flex items-center gap-6">
            <span className="hidden md:inline">Category & Reason</span>
            <span>Action</span>
          </div>
        </div>

        {/* Process Items Scroll Container */}
        <div className={`overflow-y-auto divide-y divide-slate-850 ${compact ? 'max-h-64' : 'max-h-96'}`}>
          {loading && processes.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
              <span>Querying Windows processes via PowerShell...</span>
            </div>
          ) : filteredProcesses.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No matching applications found.
            </div>
          ) : (
            filteredProcesses.map((proc) => {
              const eligible = isEligibleForTermination(proc);
              const isSelected = selectedPids.has(proc.pid);
              const isWorking = actionInProgress === proc.pid || actionInProgress === 'bulk';

              return (
                <div
                  key={`${proc.pid}-${proc.name}`}
                  className={`p-3 flex items-center justify-between text-xs hover:bg-slate-900/40 transition-colors ${
                    proc.isProhibited ? 'bg-rose-950/15' : ''
                  }`}
                >
                  {/* Left: Checkbox & Name/PID */}
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    {!readOnly && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!eligible || isWorking}
                        onChange={() => toggleSelectPid(proc.pid)}
                        className={`rounded border-slate-700 text-cyan-500 focus:ring-0 focus:ring-offset-0 bg-slate-900 ${
                          !eligible ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'
                        }`}
                      />
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white truncate max-w-[220px] sm:max-w-xs">
                          {proc.displayName || proc.name}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase ${
                            proc.isProhibited
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : proc.category === 'NORMAL_USER_APPLICATION'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : proc.category === 'DEVELOPMENT_TOOL'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : proc.category === 'WINDOWS_SYSTEM'
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                              : proc.category === 'VIGILEXAM_REQUIRED'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {proc.categoryLabel || proc.category}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                        <span>{proc.name}</span>
                        <span>●</span>
                        <span>PID: {proc.pid}</span>
                        {proc.startTime && (
                          <>
                            <span className="hidden sm:inline">●</span>
                            <span className="hidden sm:inline">
                              Started: {new Date(proc.startTime).toLocaleTimeString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Reason & Action Button */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="hidden md:block text-right max-w-xs">
                      <p
                        className={`text-[11px] truncate ${
                          proc.isProhibited
                            ? 'text-rose-400 font-semibold'
                            : proc.category === 'NORMAL_USER_APPLICATION'
                            ? 'text-amber-400/90'
                            : proc.category === 'DEVELOPMENT_TOOL'
                            ? 'text-blue-300 font-medium'
                            : 'text-slate-400'
                        }`}
                      >
                        {proc.reason}
                      </p>
                    </div>

                    <div>
                      {eligible && !readOnly ? (
                        <button
                          onClick={() => promptCloseSingle(proc)}
                          disabled={isWorking}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-slate-800 hover:border-rose-500/30 text-xs font-semibold flex items-center gap-1 transition-all disabled:opacity-40"
                          title="Close this application safely"
                        >
                          <PowerOff className="w-3 h-3 text-rose-400" />
                          <span>Close</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                          <Lock className="w-3 h-3 text-slate-600" />
                          <span>Protected</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Meta */}
        <div className="p-2.5 bg-slate-900/40 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <span>
            Last scan:{' '}
            {summary.lastScanTime ? new Date(summary.lastScanTime).toLocaleTimeString() : 'Never'}
          </span>
          <span>* System kernel and VigilExam runtime processes cannot be terminated</span>
        </div>
      </div>

      {/* Confirmation Modal Dialog */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <PowerOff className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Confirm Application Closure</h3>
                <p className="text-xs text-slate-400">Review selected applications before proceeding</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-850 text-xs text-slate-300 space-y-2">
              <p>
                Closing a running application terminates its active memory process. It does{' '}
                <strong>NOT</strong> delete any files, program data, or software installations.
              </p>

              {confirmModal.type === 'single' && confirmModal.target && (
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono">
                  <div className="text-white font-bold">
                    {confirmModal.target.displayName || confirmModal.target.name}
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    PID: {confirmModal.target.pid} ● {confirmModal.target.name}
                  </div>
                </div>
              )}

              {confirmModal.type === 'all_prohibited' && Array.isArray(confirmModal.target) && (
                <div>
                  <p className="text-rose-400 font-bold mb-1">
                    All {confirmModal.target.length} prohibited application(s) will be closed:
                  </p>
                  <div className="max-h-28 overflow-y-auto space-y-1 font-mono text-[11px] text-rose-300">
                    {confirmModal.target.map((t) => (
                      <div key={t.pid} className="truncate">
                        • {t.displayName || t.name} (PID {t.pid})
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {confirmModal.type === 'bulk' && Array.isArray(confirmModal.target) && (
                <div>
                  <p className="text-slate-400 mb-1">
                    The following {confirmModal.target.length} application(s) will be closed:
                  </p>
                  <div className="max-h-28 overflow-y-auto space-y-1 font-mono text-[11px] text-amber-300">
                    {confirmModal.target.map((t) => (
                      <div key={t.pid} className="truncate">
                        • {t.displayName || t.name} (PID {t.pid})
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmModal({ open: false, type: 'single', target: null })}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={executeConfirmedTermination}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition-all shadow-lg shadow-rose-600/20"
              >
                Confirm & Close Application
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
