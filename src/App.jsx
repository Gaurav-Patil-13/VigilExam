import React, { useEffect, useRef, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { Navbar } from './components/Navbar';
import { Login } from './pages/Login';
import { StudentDashboard } from './pages/student/StudentDashboard';
import { PreCheckRoom } from './pages/student/PreCheckRoom';
import { ExamKiosk } from './pages/student/ExamKiosk';
import { ExamResult } from './pages/student/ExamResult';
import { ProctorDashboard } from './pages/proctor/ProctorDashboard';
import { AdminDashboard } from './pages/admin/AdminDashboard';

const MainApp = () => {
  const { user } = useAuth();

  // Student Navigation Flow
  const [studentState, setStudentState] = useState('dashboard'); // 'dashboard', 'precheck', 'exam', 'result'
  const [selectedTest, setSelectedTest] = useState(null);
  const [activeAttempt, setActiveAttempt] = useState(null);
  const [examResult, setExamResult] = useState(null);
  const previousStudentState = useRef(studentState);

  useEffect(() => {
    if (previousStudentState.current !== studentState) {
      console.info('[ExamFlow] Student view changed', {
        from: previousStudentState.current,
        to: studentState,
        examId: selectedTest?.id ?? null,
        attemptId: activeAttempt?.id ?? null,
        attemptStatus: activeAttempt?.status ?? null,
        studentId: user?.id ?? null,
        role: user?.role ?? null,
      });
      previousStudentState.current = studentState;
    }
  }, [studentState, selectedTest, activeAttempt, user]);

  useEffect(() => {
    console.info('[ExamFlow] Authentication state', {
      authenticated: Boolean(user),
      studentId: user?.id ?? null,
      role: user?.role ?? null,
    });
  }, [user]);

  const handleStartPreCheck = (test) => {
    setSelectedTest(test);
    setStudentState('precheck');
  };

  const handleProceedToExam = async () => {
    console.info('[ExamFlow] Start requested', {
      examId: selectedTest?.id ?? null,
      studentId: user?.id ?? null,
      authenticated: Boolean(user),
      examStatus: selectedTest?.is_active ? 'active' : 'inactive',
    });
    if (!selectedTest || !user) {
      console.error('[ExamFlow] Start aborted: selected exam or authenticated user is missing');
      return;
    }
    try {
      const res = await fetch('http://localhost:4000/api/attempts/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_id: selectedTest.id,
          student_id: user.id
        })
      });
      const attemptData = await res.json();
      console.info('[ExamFlow] Start API response', {
        httpStatus: res.status,
        examId: selectedTest.id,
        responseExamId: attemptData.test_id ?? null,
        studentId: user.id,
        responseStudentId: attemptData.student_id ?? null,
        attemptId: attemptData.id ?? null,
        examStatus: attemptData.status ?? null,
      });
      if (!res.ok || attemptData.test_id !== selectedTest.id ||
          attemptData.student_id !== user.id || attemptData.status !== 'in_progress') {
        throw new Error(attemptData.error || 'The server did not create a valid active exam attempt.');
      }
      setActiveAttempt(attemptData);
      setStudentState('exam');
    } catch (e) {
      console.error('[ExamFlow] Failed to start exam attempt; remaining on pre-check', e);
    }
  };

  const handleExamFinished = (resultData) => {
    console.info('[ExamFlow] Exam finished', {
      attemptId: activeAttempt?.id ?? null,
      resultStatus: resultData?.status ?? null,
      reason: resultData?.ended_reason ?? resultData?.reason ?? 'submission completed',
    });
    setExamResult(resultData);
    setStudentState('result');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#080C14] text-slate-100 flex flex-col">
        <Navbar />
        <Login />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080C14] text-slate-100 flex flex-col">
      <Navbar currentView={studentState} setCurrentView={setStudentState} />

      <main className="flex-1">
        {user.role === 'student' && (
          <>
            {studentState === 'dashboard' && (
              <StudentDashboard onStartPreCheck={handleStartPreCheck} />
            )}
            {studentState === 'precheck' && selectedTest && (
              <PreCheckRoom
                test={selectedTest}
                onProceedToExam={handleProceedToExam}
                onCancel={() => setStudentState('dashboard')}
              />
            )}
            {studentState === 'exam' && selectedTest && activeAttempt && (
              <ExamKiosk
                test={selectedTest}
                attempt={activeAttempt}
                onExamFinished={handleExamFinished}
              />
            )}
            {studentState === 'result' && (
              <ExamResult
                result={examResult}
                onReturnHome={() => setStudentState('dashboard')}
              />
            )}
          </>
        )}

        {user.role === 'proctor' && <ProctorDashboard />}
        {user.role === 'admin' && <AdminDashboard />}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <MainApp />
      </SocketProvider>
    </AuthProvider>
  );
}
