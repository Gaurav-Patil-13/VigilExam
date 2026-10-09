import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Shield, User, LogOut, Cpu, Radio, Sparkles } from 'lucide-react';

export const Navbar = ({ currentView, setCurrentView }) => {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const isDesktop = window.vigilNative?.isDesktopApp || false;

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md sticky top-0 z-50 px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo */}
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => setCurrentView && setCurrentView('dashboard')}
        >
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-white font-sans">
                Vigil<span className="text-cyan-400">Exam</span>
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono font-bold">
                Windows Desktop
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Secure Online Examination & Proctoring System</p>
          </div>
        </div>

        {/* System Health Status Badges */}
        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span>Process Guard:</span>
            <span className="font-semibold text-emerald-400">{isDesktop ? 'Active (Native)' : 'Web Mode'}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <Radio className={`w-3.5 h-3.5 ${connected ? 'text-emerald-400 animate-pulse' : 'text-rose-400'}`} />
            <span>Socket:</span>
            <span className={`font-semibold ${connected ? 'text-emerald-400' : 'text-rose-400'}`}>
              {connected ? 'Connected' : 'Offline'}
            </span>
          </div>
        </div>

        {/* User Profile & Sign Out (NO role switching buttons) */}
        {user ? (
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-white">{user.full_name}</p>
              <div className="flex items-center justify-end gap-1.5">
                <span
                  className={`text-[10px] px-2 py-0.5 uppercase font-mono font-bold rounded ${
                    user.role === 'admin'
                      ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                      : user.role === 'proctor'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {user.role}
                </span>
                {user.student_id && (
                  <span className="text-[11px] text-slate-400 font-mono">({user.student_id})</span>
                )}
                {user.employee_id && (
                  <span className="text-[11px] text-slate-400 font-mono">({user.employee_id})</span>
                )}
              </div>
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/30 transition-all flex items-center gap-1.5 text-xs font-semibold"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        ) : (
          <div className="text-xs text-slate-500 font-mono">Secure Auth Gateway</div>
        )}
      </div>
    </header>
  );
};
