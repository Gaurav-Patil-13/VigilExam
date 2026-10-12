import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Shield,
  Lock,
  Mail,
  User,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Eye,
  ShieldAlert,
  GraduationCap,
  Sparkles,
  KeyRound,
  IdCard,
  Building
} from 'lucide-react';

export const Login = () => {
  const { login, registerStudent, registerProctor, registerAdmin, loading, error } = useAuth();

  // Active portal: 'student', 'proctor', 'admin'
  const [activePortal, setActivePortal] = useState('student');
  // Mode: 'login' or 'register'
  const [authMode, setAuthMode] = useState('login');

  // Common Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');

  // Role-Specific Fields
  const [studentId, setStudentId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment] = useState('CSE');
  const [adminSecret, setAdminSecret] = useState('');

  const [formError, setFormError] = useState(null);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setStudentId('');
    setEmployeeId('');
    setAdminSecret('');
    setFormError(null);
  };

  const handlePortalSwitch = (portal) => {
    setActivePortal(portal);
    setAuthMode('login');
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    try {
      if (authMode === 'login') {
        // Authenticate into specific portal
        await login(email, password, activePortal);
      } else {
        // Registration
        if (password !== confirmPassword) {
          setFormError('Passwords do not match');
          return;
        }

        if (activePortal === 'student') {
          if (!studentId.trim()) {
            setFormError('Student ID is required');
            return;
          }
          await registerStudent({
            full_name: fullName,
            student_id: studentId,
            email,
            password,
            confirm_password: confirmPassword
          });
        } else if (activePortal === 'proctor') {
          if (!employeeId.trim()) {
            setFormError('Faculty/Employee ID is required');
            return;
          }
          await registerProctor({
            full_name: fullName,
            employee_id: employeeId,
            department,
            email,
            password,
            confirm_password: confirmPassword
          });
        } else if (activePortal === 'admin') {
          if (!adminSecret.trim()) {
            setFormError('Administrator Bootstrap Secret Key is required.');
            return;
          }
          await registerAdmin({
            full_name: fullName,
            department,
            email,
            password,
            confirm_password: confirmPassword,
            admin_secret: adminSecret
          });
        }
      }
    } catch (err) {
      setFormError(err.message);
    }
  };

  // Portal Theme Styles
  const portalStyles = {
    student: {
      accentColor: 'cyan',
      borderColor: 'border-cyan-500/30',
      bgGlow: 'from-cyan-600/20 via-teal-600/10 to-transparent',
      title: 'Student Examination Portal',
      subtitle: 'Authenticate to access secure testing workspace & camera verification',
      buttonBg: 'bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black shadow-cyan-600/30',
      icon: <GraduationCap className="w-8 h-8 text-cyan-400" />
    },
    proctor: {
      accentColor: 'amber',
      borderColor: 'border-amber-500/30',
      bgGlow: 'from-amber-600/20 via-orange-600/10 to-transparent',
      title: 'Proctor Surveillance Portal',
      subtitle: 'Operations console for real-time video surveillance & exam supervisor controls',
      buttonBg: 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-amber-500/30',
      icon: <Eye className="w-8 h-8 text-amber-400" />
    },
    admin: {
      accentColor: 'violet',
      borderColor: 'border-violet-500/30',
      bgGlow: 'from-violet-600/20 via-purple-600/10 to-transparent',
      title: 'Administrator Governance Portal',
      subtitle: 'Executive management studio for policies, exam profiles & audit reports',
      buttonBg: 'bg-violet-600 hover:bg-violet-500 text-white font-bold shadow-violet-600/30',
      icon: <Cpu className="w-8 h-8 text-violet-400" />
    }
  };

  const currentTheme = portalStyles[activePortal];

  return (
    <div className="min-h-[calc(100vh-70px)] flex flex-col items-center justify-center p-6 relative overflow-hidden bg-[#080C14]">
      {/* Background Glow */}
      <div
        className={`absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-tr ${currentTheme.bgGlow} rounded-full blur-3xl pointer-events-none transition-all duration-700`}
      />

      {/* PORTAL SELECTOR BAR */}
      <div className="max-w-md w-full mb-6 relative z-10">
        <div className="flex bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
          <button
            type="button"
            onClick={() => handlePortalSwitch('student')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activePortal === 'student'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Student</span>
          </button>

          <button
            type="button"
            onClick={() => handlePortalSwitch('proctor')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activePortal === 'proctor'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>Proctor</span>
          </button>

          <button
            type="button"
            onClick={() => handlePortalSwitch('admin')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activePortal === 'admin'
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40 shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Admin</span>
          </button>
        </div>
      </div>

      {/* AUTH CARD */}
      <div className={`max-w-md w-full glass-panel p-8 relative z-10 shadow-2xl border ${currentTheme.borderColor} bg-slate-950/90 transition-all duration-300`}>
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 mx-auto flex items-center justify-center shadow-xl mb-3">
            {currentTheme.icon}
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">{currentTheme.title}</h2>
          <p className="text-slate-400 text-xs mt-1">{currentTheme.subtitle}</p>
        </div>

        {/* Mode Tabs (Login vs Register) */}
        <div className="flex bg-slate-900/90 p-1 rounded-xl border border-slate-800 mb-6 text-xs">
          <button
            type="button"
            onClick={() => {
              setAuthMode('login');
              setFormError(null);
            }}
            className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${
              authMode === 'login'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('register');
              setFormError(null);
            }}
            className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${
              authMode === 'register'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Register Account
          </button>
        </div>

        {/* Form Error Display */}
        {(formError || error) && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{formError || error}</span>
          </div>
        )}

        {/* Authentication Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Registration Fields */}
          {authMode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Legal Name</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="e.g. Gaurav Patil"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {activePortal === 'student' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Student Roll / ID Number</label>
                  <div className="relative">
                    <IdCard className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
                    <input
                      type="text"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      required
                      placeholder="e.g. 23510040"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                    />
                  </div>
                </div>
              )}

              {activePortal === 'proctor' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Faculty / Employee ID</label>
                  <div className="relative">
                    <IdCard className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
                    <input
                      type="text"
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      required
                      placeholder="e.g. FAC-CSE-104"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                </div>
              )}

              {(activePortal === 'proctor' || activePortal === 'admin') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Academic Department</label>
                  <div className="relative">
                    <Building className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Computer Science & Engineering"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-700"
                    />
                  </div>
                </div>
              )}

              {activePortal === 'admin' && (
                <div>
                  <label className="block text-xs font-semibold text-violet-300 mb-1 flex items-center justify-between">
                    <span>Admin Bootstrap Secret Key</span>
                    <span className="text-[10px] text-violet-400/80 font-mono">Authorization Key</span>
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 absolute left-3.5 top-3.5 text-violet-400" />
                    <input
                      type="password"
                      value={adminSecret}
                      onChange={(e) => setAdminSecret(e.target.value)}
                      required
                      placeholder="Enter Admin Bootstrap Secret"
                      className="w-full bg-slate-900 border border-violet-500/40 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-400 font-mono"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    * Required for initial administrative bootstrap.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Email Address */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder={
                  activePortal === 'student'
                    ? 'student@vigilexam.com'
                    : activePortal === 'proctor'
                    ? 'proctor@vigilexam.com'
                    : 'admin@vigilexam.com'
                }
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Confirm Password (Register Mode) */}
          {authMode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm Password</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full mt-2 py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-lg ${currentTheme.buttonBg}`}
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : authMode === 'login' ? (
              <>
                <span>Sign In to {activePortal.toUpperCase()} Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>Complete {activePortal.toUpperCase()} Registration</span>
                <CheckCircle2 className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Security Footer Notice */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 text-center text-[10px] text-slate-500 font-mono flex items-center justify-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-cyan-500" />
          <span>VigilExam Strict Role-Based Access Control Enforced</span>
        </div>
      </div>
    </div>
  );
};
