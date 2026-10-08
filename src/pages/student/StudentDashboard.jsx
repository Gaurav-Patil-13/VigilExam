import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { BookOpen, Clock, ShieldCheck, Play, CheckCircle, ExternalLink, AlertTriangle, Layers } from 'lucide-react';

export const StudentDashboard = ({ onStartPreCheck }) => {
  const { user } = useAuth();
  const [assignedTests, setAssignedTests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`http://localhost:4000/api/tests/student/${user.id}`)
      .then(res => res.json())
      .then(data => {
        setAssignedTests(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load assigned tests:", err);
        setLoading(false);
      });
  }, [user]);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      
      {/* Welcome Banner */}
      <div className="glass-panel p-8 relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span>Candidate Examination Portal</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white">
            Welcome back, <span className="text-indigo-400">{user.full_name}</span>
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Select an assigned assessment below to launch the pre-examination system check. VigilExam will audit your system environment before opening the exam kiosk.
          </p>
        </div>
      </div>

      {/* Assigned Tests Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            <span>Assigned Examinations</span>
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            {assignedTests.length} Assessment(s) Available
          </span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400 text-sm">Loading assigned assessments...</div>
        ) : assignedTests.length === 0 ? (
          <div className="glass-panel p-8 text-center text-slate-400">
            No examinations assigned to your account at this time.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {assignedTests.map((test) => (
              <div key={test.id} className="glass-panel p-6 glass-panel-hover flex flex-col justify-between space-y-6">
                
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">
                        {test.title}
                      </h3>
                      {test.external_link && (
                        <div className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-medium">
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>External Integration: HackerRank</span>
                        </div>
                      )}
                    </div>
                    <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 text-xs font-mono font-medium">
                      {test.total_marks} Marks
                    </span>
                  </div>

                  <p className="text-sm text-slate-400 line-clamp-2">
                    {test.description}
                  </p>
                </div>

                {/* Security Flags Summary */}
                <div className="pt-4 border-t border-slate-800/80 space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-indigo-400" />
                      <span>Duration: {test.duration_minutes} Mins</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Process Scanner: Active</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onStartPreCheck(test)}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold py-3 rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>Launch Pre-Exam Check & Start</span>
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
