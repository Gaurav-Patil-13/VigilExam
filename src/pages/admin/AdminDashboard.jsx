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
  CheckCircle2,
  XCircle,
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
  Sparkles,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ListPlus,
  ListOrdered,
  ListChecks
} from 'lucide-react';

export const AdminDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('analytics'); // 'analytics', 'exams', 'users', 'audit'
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

  // Draft MCQ Questions for New Exam
  const [newQuestions, setNewQuestions] = useState([]);
  const [draftQText, setDraftQText] = useState('');
  const [draftOptions, setDraftOptions] = useState(['', '', '', '']);
  const [draftCorrectIdx, setDraftCorrectIdx] = useState(0);
  const [draftPoints, setDraftPoints] = useState(20);
  const [draftError, setDraftError] = useState('');
  const [showQuestionBuilder, setShowQuestionBuilder] = useState(false);

  // Existing Exam Question Management
  const [expandedExamId, setExpandedExamId] = useState(null);
  const [existingExamQText, setExistingExamQText] = useState('');
  const [existingExamOptions, setExistingExamOptions] = useState(['', '', '', '']);
  const [existingExamCorrectIdx, setExistingExamCorrectIdx] = useState(0);
  const [existingExamPoints, setExistingExamPoints] = useState(20);
  const [existingExamError, setExistingExamError] = useState('');
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);

  const [dbStatus, setDbStatus] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);

  useEffect(() => {
    fetchSummary();
    fetchTests();
    fetchUsers();
    fetchDbStatus();
    fetchAuditLogs();
  }, []);

  const fetchDbStatus = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/database/status`);
      if (res.ok) {
        const data = await res.json();
        setDbStatus(data);
      }
    } catch (e) {}
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/audit/logs`);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch (e) {}
  };

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
      if (res.ok) {
        const data = await res.json();
        setTests(Array.isArray(data) ? data : []);
      }
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

  // Draft Question Handlers for New Exam
  const handleAddDraftOption = () => {
    if (draftOptions.length >= 6) return;
    setDraftOptions([...draftOptions, '']);
  };

  const handleRemoveDraftOption = (idx) => {
    if (draftOptions.length <= 2) return;
    const next = draftOptions.filter((_, i) => i !== idx);
    setDraftOptions(next);
    if (draftCorrectIdx >= next.length) {
      setDraftCorrectIdx(0);
    }
  };

  const handleDraftOptionChange = (idx, val) => {
    const next = [...draftOptions];
    next[idx] = val;
    setDraftOptions(next);
  };

  const handleAddDraftQuestion = () => {
    setDraftError('');
    if (!draftQText.trim()) {
      setDraftError('Please enter the question statement.');
      return;
    }
    const cleanOptions = draftOptions.map((o) => o.trim());
    if (cleanOptions.some((o) => !o)) {
      setDraftError('All options must have non-empty text.');
      return;
    }
    if (cleanOptions.length < 2) {
      setDraftError('At least 2 options are required.');
      return;
    }
    const correctAns = cleanOptions[draftCorrectIdx];
    if (!correctAns) {
      setDraftError('Please select which option is the correct answer.');
      return;
    }

    const questionObj = {
      id: `q-${Date.now()}-${newQuestions.length + 1}`,
      type: 'mcq',
      question: draftQText.trim(),
      options: cleanOptions,
      correct_answer: correctAns,
      points: Number(draftPoints) || 20
    };

    setNewQuestions([...newQuestions, questionObj]);
    setDraftQText('');
    setDraftOptions(['', '', '', '']);
    setDraftCorrectIdx(0);
    setDraftPoints(20);
    setDraftError('');
  };

  const handleRemoveDraftQuestion = (index) => {
    setNewQuestions(newQuestions.filter((_, i) => i !== index));
  };

  // Handlers for Questions in Existing Exams
  const handleAddExistingOption = () => {
    if (existingExamOptions.length >= 6) return;
    setExistingExamOptions([...existingExamOptions, '']);
  };

  const handleRemoveExistingOption = (idx) => {
    if (existingExamOptions.length <= 2) return;
    const next = existingExamOptions.filter((_, i) => i !== idx);
    setExistingExamOptions(next);
    if (existingExamCorrectIdx >= next.length) {
      setExistingExamCorrectIdx(0);
    }
  };

  const handleExistingOptionChange = (idx, val) => {
    const next = [...existingExamOptions];
    next[idx] = val;
    setExistingExamOptions(next);
  };

  const handleSaveQuestionToExistingExam = async (examId) => {
    setExistingExamError('');
    if (!existingExamQText.trim()) {
      setExistingExamError('Please enter the question statement.');
      return;
    }
    const cleanOptions = existingExamOptions.map((o) => o.trim());
    if (cleanOptions.some((o) => !o)) {
      setExistingExamError('All options must have non-empty text.');
      return;
    }
    if (cleanOptions.length < 2) {
      setExistingExamError('At least 2 options are required.');
      return;
    }
    const correctAns = cleanOptions[existingExamCorrectIdx];
    if (!correctAns) {
      setExistingExamError('Please select which option is the correct answer.');
      return;
    }

    setIsSavingQuestion(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/tests/${examId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: existingExamQText.trim(),
          options: cleanOptions,
          correct_answer: correctAns,
          points: Number(existingExamPoints) || 20,
          type: 'mcq'
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add question');
      }

      setExistingExamQText('');
      setExistingExamOptions(['', '', '', '']);
      setExistingExamCorrectIdx(0);
      setExistingExamPoints(20);
      setExistingExamError('');
      await fetchTests();
      await fetchSummary();
    } catch (err) {
      setExistingExamError(err.message);
    } finally {
      setIsSavingQuestion(false);
    }
  };

  const handleDeleteQuestionFromExam = async (examId, questionId) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/tests/${examId}/questions/${questionId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await fetchTests();
        await fetchSummary();
      }
    } catch (e) {
      console.error('Failed to delete question:', e);
    }
  };

  const handleDeleteExam = async (examId, examTitle) => {
    if (!window.confirm(`Are you sure you want to delete the exam "${examTitle}"?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/tests/${examId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        if (expandedExamId === examId) setExpandedExamId(null);
        await fetchTests();
        await fetchSummary();
      }
    } catch (e) {
      console.error('Failed to delete exam:', e);
    }
  };

  const handleCreateTest = async (e) => {
    e.preventDefault();
    if (!newTitle) return;

    try {
      const calculatedTotalMarks = newQuestions.length > 0
        ? newQuestions.reduce((sum, q) => sum + (Number(q.points) || 20), 0)
        : 100;

      await fetch(`${API_BASE_URL}/api/tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          description: newDesc,
          duration_minutes: Number(newDuration),
          total_marks: calculatedTotalMarks,
          external_link: newLink,
          created_by: user?.id || 'u-admin-1',
          questions: newQuestions,
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
      setNewQuestions([]);
      setShowQuestionBuilder(false);
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
            Configure examination lockdown policies, author manual MCQ question banks, enforce Windows kiosk environments, and review violation analytics.
          </p>
        </div>

        {/* Controls and Tab Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {dbStatus && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono">
              <span className={`w-2 h-2 rounded-full ${dbStatus.isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="text-slate-400">Database:</span>
              <span className={dbStatus.isConnected ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                {dbStatus.isConnected ? 'Atlas Connected' : `MongoDB: ${dbStatus.status}`}
              </span>
            </div>
          )}

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
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-4 py-2 rounded-lg font-bold transition-all ${
                activeTab === 'audit'
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Audit Trail
            </button>
          </div>
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

      {/* TAB 2: EXAM STUDIO WITH INTERACTIVE SECURITY POLICY TOGGLES & MANUAL QUESTION AUTHORING */}
      {activeTab === 'exams' && (
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Create Exam Form (5 cols on lg) */}
          <div className="lg:col-span-5 glass-panel p-6 space-y-5 border border-violet-500/20 bg-slate-900/60">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-violet-400" />
                <span>Create New Examination Profile</span>
              </h3>
              <span className="text-[10px] font-mono bg-violet-500/10 text-violet-300 border border-violet-500/20 px-2 py-0.5 rounded">
                {newQuestions.length} Questions Drafted
              </span>
            </div>

            <form onSubmit={handleCreateTest} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300">Exam Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Operating Systems & Cloud Security Final 2026"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-violet-500 mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Description</label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Evaluation scope, instructions, and syllabus..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-violet-500 mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Duration (Minutes)</label>
                  <input
                    type="number"
                    min="5"
                    max="300"
                    value={newDuration}
                    onChange={(e) => setNewDuration(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-violet-500 mt-1 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300">Total Marks</label>
                  <input
                    type="number"
                    readOnly
                    value={newQuestions.length > 0 ? newQuestions.reduce((s, q) => s + (Number(q.points) || 20), 0) : 100}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-xs text-emerald-400 font-mono mt-1 cursor-not-allowed"
                    title="Calculated automatically from drafted questions"
                  />
                </div>
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-amber-300 focus:outline-none focus:border-amber-500 mt-1"
                />
              </div>

              {/* MANUAL MCQ QUESTIONS SECTION */}
              <div className="pt-3 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-violet-300">
                    <ListChecks className="w-4 h-4 text-violet-400" />
                    <span>Manual MCQ Questions ({newQuestions.length})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowQuestionBuilder(!showQuestionBuilder)}
                    className="text-[11px] font-bold text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors"
                  >
                    <span>{showQuestionBuilder ? 'Collapse Builder' : '+ Add Questions'}</span>
                    {showQuestionBuilder ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Draft Questions List Preview */}
                {newQuestions.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {newQuestions.map((q, idx) => (
                      <div
                        key={q.id || idx}
                        className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-start justify-between gap-2 text-xs"
                      >
                        <div className="space-y-1">
                          <p className="font-semibold text-white">
                            <span className="text-violet-400 font-mono mr-1.5">Q{idx + 1}.</span>
                            {q.question}
                          </p>
                          <div className="flex flex-wrap items-center gap-1 text-[10px]">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                              ✓ Correct: {q.correct_answer}
                            </span>
                            <span className="text-slate-500">|</span>
                            <span className="text-slate-400 font-mono">{q.points || 20} Pts</span>
                            <span className="text-slate-500">|</span>
                            <span className="text-slate-400">{q.options?.length} Options</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveDraftQuestion(idx)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition-colors shrink-0"
                          title="Remove question"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Question Authoring Form Box */}
                {showQuestionBuilder && (
                  <div className="p-3.5 rounded-xl bg-slate-950/90 border border-violet-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-violet-400" />
                        <span>Author Question #{newQuestions.length + 1}</span>
                      </span>
                      <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
                        Allocated: {draftPoints} Marks
                      </span>
                    </div>

                    {/* DEDICATED SECTION: QUESTION MARKS / POINTS ALLOCATION */}
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-white flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5 text-amber-400" />
                          <span>Question Marks (Score Value for Correct Answer):</span>
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={draftPoints}
                            onChange={(e) => setDraftPoints(Math.max(1, Number(e.target.value) || 1))}
                            className="w-16 bg-slate-950 border border-amber-500/40 rounded-lg p-1.5 text-xs text-amber-300 font-mono font-bold text-center focus:outline-none focus:border-amber-400"
                          />
                          <span className="text-xs text-amber-400 font-bold font-mono">Marks</span>
                        </div>
                      </div>

                      {/* Quick Presets */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span className="text-[10px] text-slate-500 font-mono">Presets:</span>
                        {[5, 10, 15, 20, 25, 50].map((pts) => (
                          <button
                            key={pts}
                            type="button"
                            onClick={() => setDraftPoints(pts)}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                              Number(draftPoints) === pts
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm'
                                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {pts} Marks
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-300">Question Text</label>
                      <textarea
                        rows={2}
                        value={draftQText}
                        onChange={(e) => setDraftQText(e.target.value)}
                        placeholder="e.g. Which monitoring module detects unauthorized applications in VigilExam?"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-violet-500 mt-1"
                      />
                    </div>

                    {/* Options Authoring with Correct vs Wrong Selector */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-slate-300">
                          Answer Options & Correct Key:
                        </label>
                        <span className="text-[10px] text-slate-400">
                          (Select the radio button for the <span className="text-emerald-400 font-bold">Correct Answer</span>)
                        </span>
                      </div>

                      {draftOptions.map((opt, oIdx) => {
                        const isCorrect = draftCorrectIdx === oIdx;
                        return (
                          <div key={oIdx} className="flex items-center gap-2">
                            <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                              <input
                                type="radio"
                                name="draft_correct_option"
                                checked={isCorrect}
                                onChange={() => setDraftCorrectIdx(oIdx)}
                                className="w-4 h-4 accent-emerald-500 cursor-pointer"
                              />
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                                  isCorrect
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {isCorrect ? 'CORRECT' : 'WRONG'}
                              </span>
                            </label>

                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => handleDraftOptionChange(oIdx, e.target.value)}
                              placeholder={`Option ${String.fromCharCode(65 + oIdx)} ${isCorrect ? '(Correct Answer)' : '(Distractor)'}`}
                              className={`flex-1 bg-slate-900 border rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none ${
                                isCorrect ? 'border-emerald-500/60 bg-emerald-950/10' : 'border-slate-700'
                              }`}
                            />

                            {draftOptions.length > 2 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveDraftOption(oIdx)}
                                className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                                title="Remove option"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}

                      <div className="flex items-center justify-between pt-1">
                        {draftOptions.length < 6 ? (
                          <button
                            type="button"
                            onClick={handleAddDraftOption}
                            className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add Option Choice</span>
                          </button>
                        ) : <span />}

                        <button
                          type="button"
                          onClick={handleAddDraftQuestion}
                          className="bg-violet-600 hover:bg-violet-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow-md shadow-violet-600/30 transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add to Question List</span>
                        </button>
                      </div>

                      {draftError && (
                        <p className="text-[11px] text-rose-400 font-semibold bg-rose-500/10 p-2 rounded border border-rose-500/30">
                          {draftError}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* SECURITY POLICY TOGGLES SECTION */}
              <div className="space-y-3 pt-3 border-t border-slate-800">
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
                <span>Publish Examination Profile ({newQuestions.length} Questions)</span>
              </button>
            </form>
          </div>

          {/* Configured Exams List & Question Bank Manager (7 cols on lg) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-violet-400" />
                <span>Configured Examinations ({tests.length})</span>
              </h3>
              <span className="text-xs text-slate-400">
                Click <span className="text-violet-400 font-bold">Manage Questions</span> to inspect or add questions
              </span>
            </div>

            <div className="space-y-4">
              {(Array.isArray(tests) ? tests : []).map((test) => {
                const pol = test.security_policy || {};
                const qCount = test.questions?.length || 0;
                const isExpanded = expandedExamId === test.id;

                return (
                  <div
                    key={test.id}
                    className={`glass-panel p-5 space-y-3 border transition-all ${
                      isExpanded
                        ? 'border-violet-500 bg-slate-900/90 shadow-xl shadow-violet-500/10'
                        : 'border-slate-800 bg-slate-900/60 hover:border-violet-500/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-white">{test.title}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">{test.description || 'No description provided.'}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs px-2.5 py-1 rounded-lg bg-violet-500/10 text-violet-300 border border-violet-500/20 font-mono font-bold flex items-center gap-1.5">
                          <HelpCircle className="w-3.5 h-3.5 text-violet-400" />
                          <span>{qCount} {qCount === 1 ? 'Question' : 'Questions'}</span>
                        </span>
                        <span className="text-xs text-cyan-400 font-mono font-bold px-2 py-1 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                          {test.duration_minutes} Mins
                        </span>
                      </div>
                    </div>

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
                          Single Screen
                        </span>
                      )}

                      {pol.process_cleanup && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono">
                          <Cpu className="w-3 h-3" />
                          Process Guard
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono">
                        <ShieldCheck className="w-3 h-3" />
                        Clipboard Guard
                      </span>

                      {pol.ai_camera_proctoring && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                          <Eye className="w-3 h-3" />
                          AI Biometrics
                        </span>
                      )}

                      {test.external_link && (
                        <span className="inline-block text-[10px] text-amber-400 font-mono">
                          External: {test.external_link}
                        </span>
                      )}
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => setExpandedExamId(isExpanded ? null : test.id)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                          isExpanded
                            ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                            : 'bg-slate-800 text-violet-300 hover:bg-slate-700'
                        }`}
                      >
                        <ListChecks className="w-3.5 h-3.5" />
                        <span>{isExpanded ? 'Hide Questions' : 'Manage Questions'}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5 ml-0.5" /> : <ChevronDown className="w-3.5 h-3.5 ml-0.5" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteExam(test.id, test.title)}
                        className="text-xs text-slate-500 hover:text-rose-400 font-semibold flex items-center gap-1 transition-colors px-2 py-1"
                        title="Delete this examination profile"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Exam</span>
                      </button>
                    </div>

                    {/* EXPANDED QUESTION BANK DRAWER */}
                    {isExpanded && (
                      <div className="pt-3 border-t border-violet-500/30 space-y-4">
                        {/* Current Questions in this Exam */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h5 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                              <HelpCircle className="w-3.5 h-3.5 text-violet-400" />
                              <span>Configured Questions ({qCount})</span>
                            </h5>
                            <span className="text-[11px] text-emerald-400 font-mono">
                              Total Marks: {test.total_marks || (test.questions || []).reduce((s, q) => s + (Number(q.points) || 20), 0)}
                            </span>
                          </div>

                          {(!test.questions || test.questions.length === 0) ? (
                            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-1">
                              <p className="text-xs text-amber-300 font-semibold">No questions added to this exam yet.</p>
                              <p className="text-[11px] text-slate-400">
                                Use the authoring form below to add MCQ questions. Candidates taking this exam will see them in their secure kiosk.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                              {(test.questions || []).map((q, idx) => (
                                <div
                                  key={q.id || idx}
                                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="font-bold text-white leading-relaxed">
                                      <span className="text-violet-400 font-mono mr-1.5">Q{idx + 1}.</span>
                                      {q.question}
                                    </p>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                                        {q.points || 20} Pts
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteQuestionFromExam(test.id, q.id)}
                                        className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                                        title="Delete this question"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* MCQ Options Display: Green for Correct, Slate for Wrong */}
                                  <div className="grid sm:grid-cols-2 gap-1.5 pt-1">
                                    {(q.options || []).map((opt, oIdx) => {
                                      const isCorrect = opt === q.correct_answer;
                                      return (
                                        <div
                                          key={oIdx}
                                          className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                                            isCorrect
                                              ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200'
                                              : 'border-slate-800/80 bg-slate-900/60 text-slate-400'
                                          }`}
                                        >
                                          <div className="flex items-center gap-1.5 truncate">
                                            {isCorrect ? (
                                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                            ) : (
                                              <XCircle className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                                            )}
                                            <span className="font-mono text-[10px] text-slate-400">
                                              {String.fromCharCode(65 + oIdx)}.
                                            </span>
                                            <span className="truncate">{opt}</span>
                                          </div>
                                          <span
                                            className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${
                                              isCorrect
                                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                : 'text-slate-500'
                                            }`}
                                          >
                                            {isCorrect ? 'Correct Answer' : 'Wrong Answer'}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Add New Question to This Exam Form */}
                        <div className="p-4 rounded-xl bg-slate-950 border border-violet-500/30 space-y-3">
                          <div className="flex items-center justify-between">
                            <h6 className="text-xs font-bold text-violet-300 flex items-center gap-1.5">
                              <Plus className="w-3.5 h-3.5 text-violet-400" />
                              <span>Add New MCQ Question to "{test.title}"</span>
                            </h6>
                            <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
                              Allocated: {existingExamPoints} Marks
                            </span>
                          </div>

                          {/* DEDICATED SECTION: QUESTION MARKS / POINTS ALLOCATION */}
                          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-bold text-white flex items-center gap-1.5">
                                <Award className="w-3.5 h-3.5 text-amber-400" />
                                <span>Question Marks (Score Value for Correct Answer):</span>
                              </label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min="1"
                                  max="100"
                                  value={existingExamPoints}
                                  onChange={(e) => setExistingExamPoints(Math.max(1, Number(e.target.value) || 1))}
                                  className="w-16 bg-slate-950 border border-amber-500/40 rounded-lg p-1.5 text-xs text-amber-300 font-mono font-bold text-center focus:outline-none focus:border-amber-400"
                                />
                                <span className="text-xs text-amber-400 font-bold font-mono">Marks</span>
                              </div>
                            </div>

                            {/* Quick Presets */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                              <span className="text-[10px] text-slate-500 font-mono">Presets:</span>
                              {[5, 10, 15, 20, 25, 50].map((pts) => (
                                <button
                                  key={pts}
                                  type="button"
                                  onClick={() => setExistingExamPoints(pts)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                                    Number(existingExamPoints) === pts
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm'
                                      : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                                  }`}
                                >
                                  {pts} Marks
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="text-[11px] font-semibold text-slate-300">Question Statement</label>
                            <textarea
                              rows={2}
                              value={existingExamQText}
                              onChange={(e) => setExistingExamQText(e.target.value)}
                              placeholder="e.g. Which algorithm is used for dead-lock avoidance in operating systems?"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-violet-500 mt-1"
                            />
                          </div>

                          {/* Options with Correct vs Wrong Selector */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-semibold text-slate-300">
                                Options & Key (Select the radio button for the <span className="text-emerald-400 font-bold">Correct Answer</span>):
                              </label>
                            </div>

                            {existingExamOptions.map((opt, oIdx) => {
                              const isCorrect = existingExamCorrectIdx === oIdx;
                              return (
                                <div key={oIdx} className="flex items-center gap-2">
                                  <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                                    <input
                                      type="radio"
                                      name={`existing_correct_opt_${test.id}`}
                                      checked={isCorrect}
                                      onChange={() => setExistingExamCorrectIdx(oIdx)}
                                      className="w-4 h-4 accent-emerald-500 cursor-pointer"
                                    />
                                    <span
                                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                                        isCorrect
                                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                          : 'bg-slate-800 text-slate-400'
                                      }`}
                                    >
                                      {isCorrect ? 'CORRECT' : 'WRONG'}
                                    </span>
                                  </label>

                                  <input
                                    type="text"
                                    value={opt}
                                    onChange={(e) => handleExistingOptionChange(oIdx, e.target.value)}
                                    placeholder={`Option ${String.fromCharCode(65 + oIdx)} ${isCorrect ? '(Correct Answer)' : '(Distractor / Wrong Answer)'}`}
                                    className={`flex-1 bg-slate-900 border rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none ${
                                      isCorrect ? 'border-emerald-500/60 bg-emerald-950/10' : 'border-slate-700'
                                    }`}
                                  />

                                  {existingExamOptions.length > 2 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveExistingOption(oIdx)}
                                      className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                                      title="Remove option"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              );
                            })}

                            <div className="flex items-center justify-between pt-1">
                              {existingExamOptions.length < 6 ? (
                                <button
                                  type="button"
                                  onClick={handleAddExistingOption}
                                  className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Add Option Choice</span>
                                </button>
                              ) : <span />}

                              <button
                                type="button"
                                disabled={isSavingQuestion}
                                onClick={() => handleSaveQuestionToExistingExam(test.id)}
                                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>{isSavingQuestion ? 'Saving Question...' : 'Save Question to Exam'}</span>
                              </button>
                            </div>

                            {existingExamError && (
                              <p className="text-[11px] text-rose-400 font-semibold bg-rose-500/10 p-2 rounded border border-rose-500/30">
                                {existingExamError}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
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

      {/* TAB 4: AUDIT TRAIL LOGS */}
      {activeTab === 'audit' && (
        <div className="glass-panel p-6 space-y-4 border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-violet-400" />
              <span>Administrative Audit Trail & Security Event Logs</span>
            </h3>
            <button
              onClick={fetchAuditLogs}
              className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Refresh audit logs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {auditLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No audit log records recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] text-slate-400 font-mono bg-slate-900/40">
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Actor Role</th>
                    <th className="py-2.5 px-3">Actor ID</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px]">
                        {new Date(log.timestamp || log.created_at || Date.now()).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-violet-300 uppercase">{log.actor_role}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-300">{log.actor_id}</td>
                      <td className="py-2.5 px-3 font-mono text-cyan-300 font-semibold">{log.action}</td>
                      <td className="py-2.5 px-3 text-slate-400">{log.target_resource || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
