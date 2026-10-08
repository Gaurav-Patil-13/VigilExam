import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, Mail, ArrowRight, CheckCircle2, Cpu, Eye, ShieldAlert } from 'lucide-react';

export const Login = () => {
  const { login, loading, error } = useAuth();
  const [email, setEmail] = useState('student@vigilexam.com');
  const [password, setPassword] = useState('password123');

  const handleSubmit = (e) => {
    e.preventDefault();
    login(email, password);
  };

  const handleQuickFill = (role) => {
    if (role === 'student') {
      setEmail('student@vigilexam.com');
      setPassword('password123');
    } else if (role === 'proctor') {
      setEmail('proctor@vigilexam.com');
      setPassword('password123');
    } else if (role === 'admin') {
      setEmail('admin@vigilexam.com');
      setPassword('password123');
    }
  };

  return (
    <div className="min-h-[calc(100vh-70px)] flex items-center justify-center p-6 relative overflow-hidden bg-[#080C14]">
      
      {/* Background Decorative Gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-indigo-600/20 via-purple-600/10 to-pink-500/0 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full glass-panel p-8 relative z-10 shadow-2xl border border-slate-800">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 mx-auto flex items-center justify-center shadow-xl shadow-indigo-500/25 mb-4">
            <Shield className="w-9 h-9 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white font-sans">Welcome to VigilExam</h2>
          <p className="text-slate-400 text-sm mt-1">System-Level Online Examination & Proctoring Platform</p>
        </div>

        {/* Quick Role Selection Buttons */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-2 text-center">Quick Login As</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickFill('student')}
              className={`p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                email.includes('student') ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300' : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
              }`}
            >
              <UserRoleIcon role="student" />
              <span>Student</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('proctor')}
              className={`p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                email.includes('proctor') ? 'border-amber-500 bg-amber-500/10 text-amber-300' : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
              }`}
            >
              <UserRoleIcon role="proctor" />
              <span>Proctor</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('admin')}
              className={`p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                email.includes('admin') ? 'border-purple-500 bg-purple-500/10 text-purple-300' : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
              }`}
            >
              <UserRoleIcon role="admin" />
              <span>Admin</span>
            </button>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                placeholder="name@vigilexam.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold py-3 rounded-xl shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {loading ? "Authenticating..." : "Sign In to Workspace"}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        {/* Security Footer Notice */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 text-center">
          <div className="inline-flex items-center gap-1.5 text-xs text-slate-400">
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            <span>Protected by VigilExam Native OS Process Scanner</span>
          </div>
        </div>

      </div>
    </div>
  );
};

const UserRoleIcon = ({ role }) => {
  if (role === 'proctor') return <Eye className="w-4 h-4 text-amber-400" />;
  if (role === 'admin') return <Cpu className="w-4 h-4 text-purple-400" />;
  return <CheckCircle2 className="w-4 h-4 text-indigo-400" />;
};
