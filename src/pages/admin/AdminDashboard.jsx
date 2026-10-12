import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../config/api.js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Cpu,
  Plus,
  BookOpen,
  Users,
  FileText,
  ShieldCheck,
  CheckCircle,
  ExternalLink,
  Settings,
  Download,
  Trash2,
  Award,
  Shield,
  Monitor,
  Lock,
  Eye,
  Sliders,
  AlertTriangle,
  AlertOctagon,
  Sparkles
} from 'lucide-react';

export const AdminDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('analytics'); // 'analytics', 'exams', 'users'
  const [summary, setSummary] = useState(null);
  const [tests, setTests] = useState([]);
  const [usersList, setUsersList] = useState([]);

  // New Exam Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDuration, setNewDuration] = useState(30);
  const [newLink, setNewLink] = useState('');

  // Interactive Security Policy Configuration Toggles
  const [policyStrictKiosk, setPolicyStrictKiosk] = useState(true);
  const [policySingleDisplay, setPolicySingleDisplay] = useState(true);
  const [policyProcessCleanup, setPolicyProcessCleanup] = useState(true);
  const [policyClipboardGuard, setPolicyClipboardGuard] = useState(true);
  const [policyAiProctoring, setPolicyAiProctoring] = useState(true);
  const [policyMaxSwitches, setPolicyMaxSwitches] = useState(2);

  useEffect(() => {
    fetchSummary();
    fetchTests();
    fetchUsers();
  }, []);

  const fetchSummary = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/reports/summary`);
      const data = await res.json();
      setSummary(data);
    } catch (e) {
      console.error('Failed to load summary:', e);
    }
  };

  const fetchTests = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/tests`);
      const data = await res.json();
      setTests(data);
    } catch (e) {
      console.error('Failed to load tests:', e);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users`);
      if (res.ok) {
        const data = await res.json();
        setUsersList(data);
      }
    } catch (e) {
      console.warn('Failed to load users from API:', e);
    }
  };

  const handleCreateTest = async (e) => {
    e.preventDefault();
    if (!newTitle) return;

    try {
      await fetch(`${API_BASE_URL}/api/tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          description: newDesc,
          duration_minutes: Number(newDuration),
          total_marks: 100,
          external_link: newLink,
          created_by: user?.id || 'u-admin-1',
          security_policy: {
            strict_kiosk: policyStrictKiosk,
            single_display_only: policySingleDisplay,
            process_cleanup: policyProcessCleanup,
            process_scanning: policyProcessCleanup,
            detect_remote_desktop: true,
            detect_vm: true,
            ai_camera_proctoring: policyAiProctoring,
            max_tab_switches: Number(policyMaxSwitches),
            clipboard: {
              copy: !policyClipboardGuard,
              paste: !policyClipboardGuard,
              cut: !policyClipboardGuard,
              context_menu: !policyClipboardGuard,
              drag_drop: !policyClipboardGuard,
              clear_on_start: policyClipboardGuard,
              clear_on_end: policyClipboardGuard,
              log_attempts: true,
            },
          },
        }),
      });

      setNewTitle('');
      setNewDesc('');
      setNewLink('');
      fetchTests();
      fetchSummary();
      setActiveTab('exams');
    } catch (e) {
      console.error('Failed to create test:', e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* EXECUTIVE HEADER BANNER */}
      <div className="glass-panel p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-violet-500/20 bg-slate-950/90 shadow-2xl">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/30 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            <span>EXECUTIVE ANALYTICS & POLICY STUDIO</span>
            <span className="text-[10px] text-violet-400/80 font-mono">● ENTERPRISE v1.0</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            VigilExam Governance & Security Orchestration
          </h1>
          <p className="text-xs text-slate-400">
            Configure examination lockdown policies, enforce Windows kiosk environments, review violation analytics, and manage academic cohorts.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-lg font-bold transition-all ${
              activeTab === 'analytics'
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Audit Analytics
          </button>
          <button
            onClick={() => setActiveTab('exams')}
            className={`px-4 py-2 rounded-lg font-bold transition-all ${
              activeTab === 'exams'
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Exam Studio
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg font-bold transition-all ${
              activeTab === 'users'
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            User Roster
          </button>
        </div>
      </div>

      {/* EXECUTIVE METRICS BANNER */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="glass-panel p-4 bg-slate-900/60 border border-slate-800/80 space-y-1">
            <p className="text-xs text-slate-400">Configured Exams</p>
            <p className="text-2xl font-black text-white font-mono">{summary.metrics?.totalExams || 0}</p>
            <p className="text-[10px] text-slate-500 font-mono">Academic Assessments</p>
          </div>
          <div className="glass-panel p-4 bg-slate-900/60 border border-slate-800/80 space-y-1">
            <p className="text-xs text-slate-400">Enrolled Candidates</p>
            <p className="text-2xl font-black text-violet-400 font-mono">{summary.metrics?.totalStudents || 0}</p>
            <p className="text-[10px] text-violet-500/80 font-mono">Active Student Accounts</p>
          </div>
          <div className="glass-panel p-4 bg-slate-900/60 border border-slate-800/80 space-y-1">
            <p className="text-xs text-slate-400">Total Attempts Logged</p>
            <p className="text-2xl font-black text-cyan-400 font-mono">{summary.metrics?.totalAttempts || 0}</p>
            <p className="text-[10px] text-cyan-500/80 font-mono">Surveilled Sessions</p>
          </div>
          <div className="glass-panel p-4 bg-amber-950/20 border border-amber-500/30 space-y-1">
            <p className="text-xs text-amber-300">Violations Flagged</p>
            <p className="text-2xl font-black text-amber-300 font-mono">{summary.metrics?.totalViolations || 0}</p>
            <p className="text-[10px] text-amber-500/80 font-mono">Kiosk / Process / Clipboard</p>
          </div>
          <div className="glass-panel p-4 bg-rose-950/20 border border-rose-500/30 space-y-1">
            <p className="text-xs text-rose-300">Average Risk Score</p>
            <p className="text-2xl font-black text-rose-400 font-mono">{summary.metrics?.avgRiskScore || 0}%</p>
            <p className="text-[10px] text-rose-500/80 font-mono">Cohort Cheating Index</p>
          </div>
        </div>
      )}

      {/* TAB 1: AUDIT ANALYTICS */}
      {activeTab === 'analytics' && summary && (
        <div className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Chart: Violation Breakdown */}
            <div className="glass-panel p-6 space-y-4 border border-slate-800 bg-slate-900/60">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-violet-400" />
                <span>Security Violation Types Breakdown</span>
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.violationBreakdown || []}>
                    <XAxis dataKey="name" stroke="#64748B" fontSize={11} />
                    <YAxis stroke="#64748B" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="count" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Candidate Recent Incident Audit Feed */}
            <div className="glass-panel p-6 space-y-4 border border-slate-800 bg-slate-900/60">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-400" />
                <span>Recent Exam Attempts Overview</span>
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {(summary.recentAttempts || []).map((att) => (
                  <div
                    key={att.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-white">
                        {att.student_name} ({att.student_code})
                      </p>
                      <p className="text-[11px] text-slate-400">{att.test_title}</p>
                    </div>
                    <div className="text-right space-y-0.5">
                      <div className="flex items-center gap-1.5 justify-end">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            att.status === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : att.status === 'terminated'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                          }`}
                        >
                          {att.status?.toUpperCase()}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            (att.kiosk_status || 'SECURE') === 'SECURE'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : att.kiosk_status === 'WARNING'
                              ? 'bg-amber-500/10 text-amber-300'
                              : 'bg-rose-500/10 text-rose-400'
                          }`}
                        >
                          {att.kiosk_status || 'SECURE'}
                        </span>
                      </div>
                      <p className="text-[11px] text-rose-400 font-mono">Risk: {att.risk_score || 0}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EXAM STUDIO WITH INTERACTIVE SECURITY POLICY TOGGLES */}
      {activeTab === 'exams' && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Create Exam Form (1 col) */}
          <div className="glass-panel p-6 space-y-4 border border-violet-500/20 bg-slate-900/60">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-violet-400" />
              <span>Create New Examination Profile</span>
            </h3>

            <form onSubmit={handleCreateTest} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300">Exam Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Distributed Operating Systems Final 2026"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Description</label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Evaluation scope and instructions..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Duration (Minutes)</label>
                <input
                  type="number"
                  min="5"
                  max="300"
                  value={newDuration}
                  onChange={(e) => setNewDuration(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                  <span>External Integration Link (Optional)</span>
                </label>
                <input
                  type="url"
                  value={newLink}
                  onChange={(e) => setNewLink(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-amber-300 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* SECURITY POLICY TOGGLES SECTION */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="flex items-center gap-1.5 text-xs font-bold text-violet-300">
                  <Shield className="w-4 h-4 text-violet-400" />
                  <span>Security Lockdown Policies</span>
                </div>

                {/* Toggle 1: Strict Kiosk Mode */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="space-y-0.5 pr-2">
                    <p className="text-xs font-semibold text-white flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5 text-cyan-400" /> Strict Windows Kiosk
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Fullscreen, always-on-top, blocks minimize/close/Alt+Tab/DevTools
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={policyStrictKiosk}
                    onChange={(e) => setPolicyStrictKiosk(e.target.checked)}
                    className="w-4 h-4 accent-violet-600 rounded"
                  />
                </div>

                {/* Toggle 2: Single Display Only */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="space-y-0.5 pr-2">
                    <p className="text-xs font-semibold text-white flex items-center gap-1">
                      <Monitor className="w-3.5 h-3.5 text-cyan-400" /> Single Display Only
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Blocks multi-display / secondary monitors
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={policySingleDisplay}
                    onChange={(e) => setPolicySingleDisplay(e.target.checked)}
                    className="w-4 h-4 accent-violet-600 rounded"
                  />
                </div>

                {/* Toggle 3: Background Process Cleanup */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="space-y-0.5 pr-2">
                    <p className="text-xs font-semibold text-white flex items-center gap-1">
                      <Cpu className="w-3.5 h-3.5 text-cyan-400" /> Process Cleanup & Guard
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Audits & closes non-essential user applications before exam
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={policyProcessCleanup}
                    onChange={(e) => setPolicyProcessCleanup(e.target.checked)}
                    className="w-4 h-4 accent-violet-600 rounded"
                  />
                </div>

                {/* Toggle 4: Strict Clipboard Security */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="space-y-0.5 pr-2">
                    <p className="text-xs font-semibold text-white flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> Strict Clipboard Guard
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Blocks Copy, Paste, Cut, Drop & clears clipboard
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={policyClipboardGuard}
                    onChange={(e) => setPolicyClipboardGuard(e.target.checked)}
                    className="w-4 h-4 accent-violet-600 rounded"
                  />
                </div>

                {/* Toggle 5: AI Biometric Proctoring */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="space-y-0.5 pr-2">
                    <p className="text-xs font-semibold text-white flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5 text-cyan-400" /> AI Video Proctoring
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Detects multiple persons, off-screen gaze, and head movement
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={policyAiProctoring}
                    onChange={(e) => setPolicyAiProctoring(e.target.checked)}
                    className="w-4 h-4 accent-violet-600 rounded"
                  />
                </div>

                {/* Switch tolerance */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-300">
                    Max Allowed Window Switches / Blurs:
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={policyMaxSwitches}
                    onChange={(e) => setPolicyMaxSwitches(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-violet-500 mt-1 font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Publish Examination Config</span>
              </button>
            </form>
          </div>

          {/* Configured Exams List (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-violet-400" />
              <span>Configured Examinations ({tests.length})</span>
            </h3>

            <div className="space-y-3">
              {tests.map((test) => {
                const pol = test.security_policy || {};
                return (
                  <div
                    key={test.id}
                    className="glass-panel p-5 space-y-3 border border-slate-800 bg-slate-900/60 hover:border-violet-500/40 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-white">{test.title}</h4>
                      <span className="text-xs text-violet-400 font-mono font-bold">
                        {test.duration_minutes} Mins
                      </span>
                    </div>

                    <p className="text-xs text-slate-400">{test.description}</p>

                    {/* Security Policy Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {pol.strict_kiosk && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20 font-mono">
                          <Lock className="w-3 h-3" />
                          Kiosk: Strict Lockdown
                        </span>
                      )}

                      {pol.single_display_only && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono">
                          <Monitor className="w-3 h-3" />
                          Display: Single Screen
                        </span>
                      )}

                      {pol.process_cleanup && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono">
                          <Cpu className="w-3 h-3" />
                          Process Guard: Active
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono">
                        <ShieldCheck className="w-3 h-3" />
                        Clipboard: Locked
                      </span>

                      {pol.ai_camera_proctoring && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                          <Eye className="w-3 h-3" />
                          AI Biometrics: Active
                        </span>
                      )}

                      {test.external_link && (
                        <span className="inline-block text-[10px] text-amber-400 font-mono">
                          External: {test.external_link}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: USER ROSTER */}
      {activeTab === 'users' && (
        <div className="glass-panel p-6 space-y-4 border border-slate-800 bg-slate-900/60">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-violet-400" />
            <span>Enrolled Academic Roster & Authorized Users</span>
          </h3>

          <div className="space-y-2">
            {usersList.map((u) => (
              <div
                key={u.id}
                className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-bold text-white">{u.full_name || u.name}</p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {u.role?.toUpperCase()} {u.student_id ? `| Roll No: ${u.student_id}` : ''} {u.employee_id ? `| Emp ID: ${u.employee_id}` : ''} | Dept: {u.department || 'CSE'}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20 font-mono font-semibold">
                  Authorized
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
