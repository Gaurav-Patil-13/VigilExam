import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Cpu, Plus, BookOpen, Users, FileText, ShieldCheck, CheckCircle, ExternalLink, Settings, Download, Trash2, Award } from 'lucide-react';

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

  useEffect(() => {
    fetchSummary();
    fetchTests();
    fetchUsers();
  }, []);

  const fetchSummary = async () => {
    try {
      const res = await fetch('http://localhost:4000/api/reports/summary');
      const data = await res.json();
      setSummary(data);
    } catch (e) {
      console.error("Failed to load summary:", e);
    }
  };

  const fetchTests = async () => {
    try {
      const res = await fetch('http://localhost:4000/api/tests');
      const data = await res.json();
      setTests(data);
    } catch (e) {
      console.error("Failed to load tests:", e);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('http://localhost:4000/api/tests');
      // Simple mock user list load
      setUsersList([
        { id: "u-student-1", name: "Gaurav Patil", role: "Student", student_id: "23510040" },
        { id: "u-student-2", name: "Amit Rane", role: "Student", student_id: "23510064" },
        { id: "u-student-3", name: "Ritesh Jagtap", role: "Student", student_id: "23510101" },
        { id: "u-proctor-1", name: "Prof. Swapnali A. Aitwade", role: "Proctor", department: "CSE" },
        { id: "u-admin-1", name: "Rugved Ganapule", role: "Admin", department: "CSE" }
      ]);
    } catch (e) {}
  };

  const handleCreateTest = async (e) => {
    e.preventDefault();
    if (!newTitle) return;

    try {
      await fetch('http://localhost:4000/api/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          description: newDesc,
          duration_minutes: newDuration,
          total_marks: 100,
          external_link: newLink,
          created_by: user.id
        })
      });
      setNewTitle('');
      setNewDesc('');
      setNewLink('');
      fetchTests();
      fetchSummary();
      setActiveTab('exams');
    } catch (e) {
      console.error("Failed to create test:", e);
    }
  };

  const COLORS = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#8B5CF6'];

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      
      {/* Header */}
      <div className="glass-panel p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30 text-xs font-semibold">
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            <span>Administrator Management Hub</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white mt-1">VigilExam Control & Analytics Studio</h1>
          <p className="text-xs text-slate-400">Configure examination rules, manage candidate rosters, and analyze post-exam cheating audit reports.</p>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              activeTab === 'analytics' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Audit Analytics
          </button>
          <button
            onClick={() => setActiveTab('exams')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              activeTab === 'exams' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Exam Studio
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              activeTab === 'users' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            User Roster
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="glass-panel p-4 space-y-1">
            <p className="text-xs text-slate-400">Total Exams</p>
            <p className="text-2xl font-bold text-white font-mono">{summary.metrics.totalExams}</p>
          </div>
          <div className="glass-panel p-4 space-y-1">
            <p className="text-xs text-slate-400">Total Candidates</p>
            <p className="text-2xl font-bold text-indigo-400 font-mono">{summary.metrics.totalStudents}</p>
          </div>
          <div className="glass-panel p-4 space-y-1">
            <p className="text-xs text-slate-400">Total Attempts</p>
            <p className="text-2xl font-bold text-cyan-400 font-mono">{summary.metrics.totalAttempts}</p>
          </div>
          <div className="glass-panel p-4 space-y-1">
            <p className="text-xs text-slate-400">Violations Flagged</p>
            <p className="text-2xl font-bold text-amber-400 font-mono">{summary.metrics.totalViolations}</p>
          </div>
          <div className="glass-panel p-4 space-y-1">
            <p className="text-xs text-slate-400">Average Cheating Risk</p>
            <p className="text-2xl font-bold text-rose-400 font-mono">{summary.metrics.avgRiskScore}%</p>
          </div>
        </div>
      )}

      {/* Tab 1: Audit Analytics */}
      {activeTab === 'analytics' && summary && (
        <div className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            
            {/* Chart 1: Violation Types Breakdown */}
            <div className="glass-panel p-6 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span>Security Violation Types Breakdown</span>
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.violationBreakdown}>
                    <XAxis dataKey="name" stroke="#64748B" fontSize={11} />
                    <YAxis stroke="#64748B" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }} />
                    <Bar dataKey="count" fill="#6366F1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Recent Attempts Audit Log */}
            <div className="glass-panel p-6 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Recent Examination Attempts Audit</span>
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {summary.recentAttempts.map((att) => (
                  <div key={att.id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-white">{att.student_name}</p>
                      <p className="text-[11px] text-slate-400">{att.test_title}</p>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        att.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {att.status}
                      </span>
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5">Risk: {att.risk_score || 0}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Tab 2: Exam Studio & Creator */}
      {activeTab === 'exams' && (
        <div className="grid lg:grid-cols-3 gap-6">
          
          {/* Exam Config Creator */}
          <div className="glass-panel p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-400" />
              <span>Configure New Examination</span>
            </h3>

            <form onSubmit={handleCreateTest} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300">Exam Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Operating Systems Final Exam 2026"
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Description</label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Brief summary of test topics..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Duration (Minutes)</label>
                <input
                  type="number"
                  value={newDuration}
                  onChange={(e) => setNewDuration(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
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
                  placeholder="https://www.hackerrank.com/..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-amber-300 focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow"
              >
                <Plus className="w-4 h-4" />
                <span>Save Examination Config</span>
              </button>
            </form>
          </div>

          {/* Exam List */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-400" />
              <span>Configured Examinations ({tests.length})</span>
            </h3>

            <div className="space-y-3">
              {tests.map(test => (
                <div key={test.id} className="glass-panel p-5 space-y-2 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white">{test.title}</h4>
                    <span className="text-xs text-indigo-400 font-mono">{test.duration_minutes} Mins</span>
                  </div>
                  <p className="text-xs text-slate-400">{test.description}</p>
                  {test.external_link && (
                    <span className="inline-block text-[11px] text-amber-400 font-mono">
                      External: {test.external_link}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* Tab 3: User Roster */}
      {activeTab === 'users' && (
        <div className="glass-panel p-6 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <span>Registered Platform Users & Roster</span>
          </h3>

          <div className="space-y-2">
            {usersList.map(u => (
              <div key={u.id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-white">{u.name}</p>
                  <p className="text-[11px] text-slate-400">{u.role} {u.student_id ? `(ID: ${u.student_id})` : ''}</p>
                </div>
                <span className="px-2.5 py-1 rounded bg-slate-800 text-indigo-300 font-mono font-semibold">
                  Active
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
