import React, { useState } from 'react';
import {
  CheckCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Award,
  ArrowLeft,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  ShieldCheck
} from 'lucide-react';

export const ExamResult = ({ result, onReturnHome }) => {
  const [showDetailedReview, setShowDetailedReview] = useState(true);

  // Exact real marks calculation
  const score = result?.score !== undefined && result?.score !== null ? Number(result.score) : 0;
  const totalMarks = result?.total_marks !== undefined && result?.total_marks !== null ? Number(result.total_marks) : 100;
  const percentage = result?.percentage !== undefined
    ? Number(result.percentage)
    : (totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0);

  const correctCount = result?.correct_count ?? 0;
  const totalQuestions = result?.total_questions ?? (result?.question_results?.length || 0);
  const questionResults = result?.question_results || [];

  const isPassed = percentage >= 40;

  return (
    <div className="max-w-4xl mx-auto p-6 min-h-[calc(100vh-100px)] flex flex-col justify-center space-y-6">
      <div className="glass-panel p-8 w-full space-y-6 border border-slate-800 bg-slate-950/80 shadow-2xl">
        
        {/* Status Header Icon & Title */}
        <div className="text-center space-y-3">
          <div
            className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center shadow-xl ${
              isPassed
                ? 'bg-emerald-500/20 border border-emerald-500/40 shadow-emerald-500/10'
                : 'bg-rose-500/20 border border-rose-500/40 shadow-rose-500/10'
            }`}
          >
            {isPassed ? (
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-10 h-10 text-rose-400" />
            )}
          </div>

          <div className="space-y-1">
            <h2 className="text-3xl font-extrabold text-white tracking-tight">Assessment Submitted & Graded</h2>
            <p className="text-slate-400 text-sm">
              Your examination answers have been evaluated and real marks calculated against the answer key.
            </p>
          </div>
        </div>

        {/* Real Performance Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-center p-3 rounded-xl bg-slate-950/80 border border-slate-850">
            <p className="text-xs text-slate-400 font-medium">Real Score Achieved</p>
            <p className="text-2xl font-black text-indigo-400 font-mono mt-1">
              {score} <span className="text-xs font-normal text-slate-500">/ {totalMarks}</span>
            </p>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5 font-bold">Marks Earned</p>
          </div>

          <div className="text-center p-3 rounded-xl bg-slate-950/80 border border-slate-850">
            <p className="text-xs text-slate-400 font-medium">Percentage</p>
            <p
              className={`text-2xl font-black font-mono mt-1 ${
                percentage >= 70
                  ? 'text-emerald-400'
                  : percentage >= 40
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {percentage}%
            </p>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5 font-bold">
              {percentage >= 70 ? 'Distinction' : percentage >= 40 ? 'Passing Grade' : 'Below Threshold'}
            </p>
          </div>

          <div className="text-center p-3 rounded-xl bg-slate-950/80 border border-slate-850">
            <p className="text-xs text-slate-400 font-medium">Questions Accuracy</p>
            <p className="text-2xl font-black text-cyan-400 font-mono mt-1">
              {correctCount} <span className="text-xs font-normal text-slate-500">/ {totalQuestions}</span>
            </p>
            <p className="text-[10px] text-cyan-400/80 font-mono mt-0.5 font-bold">Correct Answers</p>
          </div>

          <div className="text-center p-3 rounded-xl bg-slate-950/80 border border-slate-850">
            <p className="text-xs text-slate-400 font-medium">Security Status</p>
            <p className="text-2xl font-black text-emerald-400 font-mono mt-1">
              CLEARED
            </p>
            <p className="text-[10px] text-emerald-400/80 font-mono mt-0.5 font-bold">
              Risk: {result?.risk_score ?? 0}%
            </p>
          </div>
        </div>

        {/* Detailed Question Review Breakdown */}
        {questionResults.length > 0 && (
          <div className="space-y-3 pt-2 text-left">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-violet-400" />
                <span>Question-by-Question Evaluation Breakdown ({questionResults.length})</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowDetailedReview(!showDetailedReview)}
                className="text-xs font-bold text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors"
              >
                <span>{showDetailedReview ? 'Collapse Review' : 'Expand Review'}</span>
                {showDetailedReview ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {showDetailedReview && (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {questionResults.map((q, idx) => {
                  const hasAnswered = q.student_answer !== null && q.student_answer !== undefined;
                  const isCorrect = q.is_correct;

                  return (
                    <div
                      key={q.id || idx}
                      className={`p-4 rounded-xl border space-y-2.5 transition-all ${
                        isCorrect
                          ? 'border-emerald-500/30 bg-emerald-950/10'
                          : hasAnswered
                          ? 'border-rose-500/30 bg-rose-950/10'
                          : 'border-slate-800 bg-slate-900/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-xs font-bold text-white leading-relaxed">
                          <span className="text-violet-400 font-mono mr-1.5">Q{idx + 1}.</span>
                          {q.question}
                        </p>
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase shrink-0 ${
                            isCorrect
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : hasAnswered
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}
                        >
                          {isCorrect
                            ? `+${q.earned_points} / ${q.points} Marks`
                            : `0 / ${q.points} Marks`}
                        </span>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-2 text-xs pt-1">
                        {/* Student's Selected Answer */}
                        <div
                          className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                            isCorrect
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                              : hasAnswered
                              ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                              : 'border-slate-800 bg-slate-950 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {isCorrect ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : hasAnswered ? (
                              <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                            ) : (
                              <HelpCircle className="w-4 h-4 text-slate-500 shrink-0" />
                            )}
                            <span className="text-[11px] truncate">
                              <strong className="text-slate-400 mr-1">Your Choice:</strong>
                              {hasAnswered ? q.student_answer : 'Unanswered / Skipped'}
                            </span>
                          </div>
                        </div>

                        {/* Correct Key */}
                        <div className="p-2.5 rounded-lg border border-emerald-500/40 bg-slate-950 text-emerald-300 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 truncate">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span className="text-[11px] truncate">
                              <strong className="text-slate-400 mr-1">Correct Key:</strong>
                              {q.correct_answer || 'N/A'}
                            </span>
                          </div>
                          <span className="text-[9px] font-mono uppercase bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold shrink-0">
                            Key
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <button
          onClick={onReturnHome}
          className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-xs transition-all shadow-lg shadow-violet-600/20"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Candidate Portal</span>
        </button>

      </div>
    </div>
  );
};
