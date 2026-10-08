import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { db } from './db.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

// --- REST API ENDPOINTS ---

// Auth Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }
  const user = db.getUserByEmail(email);
  if (!user || user.password !== password) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  res.json({
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    role: user.role,
    student_id: user.student_id || null,
    department: user.department || "CSE"
  });
});

// Get Tests
app.get('/api/tests', (req, res) => {
  res.json(db.getTests());
});

// Get Assigned Tests for Student
app.get('/api/tests/student/:studentId', (req, res) => {
  const tests = db.getAssignmentsByStudent(req.params.studentId);
  res.json(tests);
});

// Get Test Details
app.get('/api/tests/:id', (req, res) => {
  const test = db.getTestById(req.params.id);
  if (!test) return res.status(404).json({ error: "Test not found" });
  res.json(test);
});

// Create Test (Admin)
app.post('/api/tests', (req, res) => {
  const { title, description, duration_minutes, total_marks, external_link, security_policy, questions, created_by } = req.body;
  const newTest = {
    id: `test-${Date.now()}`,
    title: title || "New Examination",
    description: description || "",
    duration_minutes: Number(duration_minutes) || 30,
    total_marks: Number(total_marks) || 100,
    external_link: external_link || "",
    is_active: true,
    created_by: created_by || "u-admin-1",
    created_at: new Date().toISOString(),
    security_policy: security_policy || {
      strict_kiosk: true,
      process_scanning: true,
      detect_remote_desktop: true,
      detect_vm: true,
      ai_camera_proctoring: true,
      max_tab_switches: 2
    },
    questions: questions || []
  };
  const created = db.createTest(newTest);
  res.status(201).json(created);
});

// Start Exam Attempt
app.post('/api/attempts/start', (req, res) => {
  const { test_id, student_id } = req.body;
  const test = db.getTestById(test_id);
  const student = db.getUserById(student_id);

  if (!test || !student) {
    return res.status(404).json({ error: "Test or Student not found" });
  }

  const attempt = {
    id: `att-${Date.now()}`,
    test_id,
    test_title: test.title,
    student_id,
    student_name: student.full_name,
    student_code: student.student_id || "STUDENT",
    status: "in_progress",
    started_at: new Date().toISOString(),
    ended_at: null,
    ended_reason: null,
    risk_score: 0,
    violation_count: 0,
    answers: {},
    score: 0,
    kiosk_token: `ktk-${Math.random().toString(36).substring(2, 10)}`
  };

  db.createAttempt(attempt);

  // Notify proctors via Socket.io
  io.to('proctor:live').emit('student_started_exam', attempt);

  res.status(201).json(attempt);
});

// Submit Exam Attempt
app.post('/api/attempts/submit', (req, res) => {
  const { attempt_id, answers } = req.body;
  const attempt = db.getAttemptById(attempt_id);
  if (!attempt) return res.status(404).json({ error: "Attempt not found" });

  const test = db.getTestById(attempt.test_id);
  let totalScore = 0;

  // Auto-grade MCQs if questions exist
  if (test && test.questions && test.questions.length > 0) {
    test.questions.forEach(q => {
      if (q.type === 'mcq' && answers && answers[q.id] === q.correct_answer) {
        totalScore += q.points || 20;
      } else if (q.type === 'coding' && answers && answers[q.id] && answers[q.id].length > 10) {
        // Simple heuristic score for completed coding answers
        totalScore += q.points || 40;
      }
    });
  } else {
    totalScore = 85; // Default demo score for external link tests
  }

  const updated = db.updateAttempt(attempt_id, {
    status: "completed",
    ended_at: new Date().toISOString(),
    ended_reason: "Student submitted examination",
    answers: answers || {},
    score: totalScore
  });

  io.to('proctor:live').emit('student_submitted_exam', updated);

  res.json(updated);
});

// Terminate Exam Attempt (Proctor Action)
app.post('/api/attempts/:id/terminate', (req, res) => {
  const { reason, proctor_id } = req.body;
  const attemptId = req.params.id;

  const updated = db.updateAttempt(attemptId, {
    status: "terminated",
    ended_at: new Date().toISOString(),
    ended_reason: reason || "Terminated by Exam Supervisor due to security violations"
  });

  if (!updated) return res.status(404).json({ error: "Attempt not found" });

  // Broadcast terminate event to student socket room
  io.to(`attempt:${attemptId}`).emit('exam_terminated', {
    reason: updated.ended_reason,
    terminated_at: updated.ended_at
  });

  io.to('proctor:live').emit('student_terminated_exam', updated);

  res.json(updated);
});

// Get Active Attempts (Proctor Dashboard)
app.get('/api/attempts/active', (req, res) => {
  const allAttempts = db.getAllAttempts();
  const active = allAttempts.filter(a => a.status === 'in_progress');
  res.json(active);
});

// Get All Attempts (Audit Reports)
app.get('/api/attempts/all', (req, res) => {
  res.json(db.getAllAttempts());
});

// Log Security Violation Event
app.post('/api/events/log', (req, res) => {
  const { attempt_id, student_id, event_type, payload, severity } = req.body;
  
  const event = {
    id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    attempt_id,
    student_id,
    event_type, // 'UNAUTHORIZED_PROCESS', 'REMOTE_DESKTOP_DETECTED', 'FACE_NOT_FOUND', 'MULTIPLE_FACES', 'TAB_SWITCH', 'VM_DETECTED'
    payload: payload || {},
    severity: severity || "medium", // 'low', 'medium', 'high', 'critical'
    event_time: new Date().toISOString()
  };

  db.logBehaviorEvent(event);

  // Update Attempt Risk Score
  const attempt = db.getAttemptById(attempt_id);
  if (attempt) {
    let addRisk = 10;
    if (severity === 'high') addRisk = 25;
    if (severity === 'critical') addRisk = 45;

    const newRisk = Math.min(100, (attempt.risk_score || 0) + addRisk);
    const newCount = (attempt.violation_count || 0) + 1;

    db.updateAttempt(attempt_id, {
      risk_score: newRisk,
      violation_count: newCount
    });
  }

  // Broadcast real-time incident alert to proctors
  io.to('proctor:live').emit('new_security_alert', {
    event,
    student_name: attempt ? attempt.student_name : "Student",
    test_title: attempt ? attempt.test_title : "Test",
    current_risk: attempt ? Math.min(100, (attempt.risk_score || 0) + 15) : 25
  });

  res.status(201).json(event);
});

// Get Events by Attempt
app.get('/api/events/attempt/:attemptId', (req, res) => {
  const events = db.getEventsByAttempt(req.params.attemptId);
  res.json(events);
});

// Send Proctor Warning
app.post('/api/proctor/warning', (req, res) => {
  const { attempt_id, proctor_id, message, severity } = req.body;
  
  const warning = {
    id: `wrn-${Date.now()}`,
    attempt_id,
    proctor_id: proctor_id || "u-proctor-1",
    message: message || "Please remain focused on your screen.",
    severity: severity || "warning",
    created_at: new Date().toISOString()
  };

  db.createWarning(warning);

  // Emit directly to candidate's room
  io.to(`attempt:${attempt_id}`).emit('proctor_warning_received', warning);

  res.status(201).json(warning);
});

// Aggregate Analytics Report (Admin Dashboard)
app.get('/api/reports/summary', (req, res) => {
  const attempts = db.getAllAttempts();
  const events = db.getAllEvents();
  const tests = db.getTests();
  const users = db.getUsers();

  const totalExams = tests.length;
  const totalStudents = users.filter(u => u.role === 'student').length;
  const totalAttempts = attempts.length;
  const completedAttempts = attempts.filter(a => a.status === 'completed').length;
  const terminatedAttempts = attempts.filter(a => a.status === 'terminated').length;
  const totalViolations = events.length;

  const violationByType = {};
  events.forEach(e => {
    violationByType[e.event_type] = (violationByType[e.event_type] || 0) + 1;
  });

  res.json({
    metrics: {
      totalExams,
      totalStudents,
      totalAttempts,
      completedAttempts,
      terminatedAttempts,
      totalViolations,
      avgRiskScore: attempts.length > 0 ? (attempts.reduce((acc, a) => acc + (a.risk_score || 0), 0) / attempts.length).toFixed(1) : 0
    },
    violationBreakdown: Object.keys(violationByType).map(type => ({
      name: type.replace(/_/g, ' '),
      count: violationByType[type]
    })),
    recentAttempts: attempts.slice(-10).reverse()
  });
});

// --- SOCKET.IO REAL-TIME CONNECTION HANDLING ---
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // Room subscriptions
  socket.on('join_proctor_room', () => {
    socket.join('proctor:live');
    console.log(`[Socket] Client ${socket.id} joined proctor:live room`);
  });

  socket.on('join_student_room', (attemptId) => {
    socket.join(`attempt:${attemptId}`);
    console.log(`[Socket] Candidate client ${socket.id} joined room attempt:${attemptId}`);
  });

  // Pulse stream from candidate desktop
  socket.on('candidate_pulse', (data) => {
    // Forward pulse (camera snapshot/frame summary, active process status) to proctors
    socket.to('proctor:live').emit('candidate_pulse_stream', {
      ...data,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` VigilExam Express & Socket.io Backend Server Ready `);
  console.log(` Listening on http://localhost:${PORT}             `);
  console.log(`====================================================`);
});
