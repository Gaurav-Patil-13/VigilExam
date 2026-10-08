import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Shield, ShieldAlert, User, LogOut, Cpu, Monitor, Sparkles } from 'lucide-react';

export const Navbar = ({ currentView, setCurrentView }) => {
  const { user, logout, login } = useAuth();
  const { connected } = useSocket();
  const isDesktop = window.vigilNative?.isDesktopApp || false;

  const quickSwitchRole = async (role) => {
    let email = "student@vigilexam.com";
    if (role === 'proctor') email = "proctor@vigilexam.com";
    if (role === 'admin') email = "admin@vigilexam.com";
    await login(email, "password123");
  };

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        
        {/* Brand Logo */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentView('default')}>
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white font-sans">
                Vigil<span className="text-indigo-400">Exam</span>
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono font-medium">
                v1.0 Desktop
              </span>
            </div>
            <p className="text-xs text-slate-400">Secure Online Proctoring Platform</p>
          </div>
        </div>

        {/* System Health Status Badges */}
        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span>OS Engine:</span>
            <span className="font-semibold text-emerald-400">{isDesktop ? "Native Electron" : "Browser Web"}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
            <span>Realtime Socket:</span>
            <span className={`font-semibold ${connected ? 'text-emerald-400' : 'text-rose-400'}`}>
              {connected ? "Connected" : "Offline"}
            </span>
          </div>
        </div>

        {/* User Profile & Demo Switcher */}
        {user ? (
          <div className="flex items-center gap-4">
            
            {/* Demo Quick Switcher */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1">
              <button
                onClick={() => quickSwitchRole('student')}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                  user.role === 'student' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Student
              </button>
              <button
                onClick={() => quickSwitchRole('proctor')}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                  user.role === 'proctor' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Proctor
              </button>
              <button
                onClick={() => quickSwitchRole('admin')}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                  user.role === 'admin' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Admin
              </button>
            </div>

            {/* Current User Info */}
            <div className="flex items-center gap-3 pl-2 border-l border-slate-800">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-200">{user.full_name}</p>
                <div className="flex items-center justify-end gap-1.5">
                  <span className={`text-[11px] px-1.5 py-0.2 uppercase font-bold tracking-wide rounded ${
                    user.role === 'admin' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                    user.role === 'proctor' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                    'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  }`}>
                    {user.role}
                  </span>
                  {user.student_id && <span className="text-xs text-slate-400 font-mono">({user.student_id})</span>}
                </div>
              </div>

              <button
                onClick={logout}
                title="Sign Out"
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-400 border border-slate-800 transition-all"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

          </div>
        ) : (
          <div className="text-xs text-slate-400 flex items-center gap-1">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>Select a role to test</span>
          </div>
        )}

      </div>
    </header>
  );
};
