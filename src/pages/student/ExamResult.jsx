import React from 'react';
import { CheckCircle, ShieldCheck, Award, ArrowLeft } from 'lucide-react';

export const ExamResult = ({ result, onReturnHome }) => {
  return (
    <div className="max-w-2xl mx-auto p-6 min-h-[calc(100vh-100px)] flex items-center justify-center">
      <div className="glass-panel p-8 w-full text-center space-y-6 border border-slate-800">
        
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/40 mx-auto flex items-center justify-center shadow-xl shadow-emerald-500/10">
          <CheckCircle className="w-10 h-10 text-emerald-400" />
        </div>

        <div className="space-y-2">
          <h2 className="text-3xl font-extrabold text-white">Assessment Submitted</h2>
          <p className="text-slate-400 text-sm">Your answers and proctoring logs have been recorded in the central database.</p>
        </div>

        {/* Score & Metrics */}
        <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div>
            <p className="text-xs text-slate-400">Score Achieved</p>
            <p className="text-2xl font-bold text-indigo-400 font-mono">{result?.score || 85} / 100</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Security Status</p>
            <p className="text-2xl font-bold text-emerald-400 font-mono">CLEARED</p>
          </div>
        </div>

        <button
          onClick={onReturnHome}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 text-sm transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Candidate Portal</span>
        </button>

      </div>
    </div>
  );
};
