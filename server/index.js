import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from './db.js';
import { connectMongoDB, getMongoStatus, isMongoConnected } from './mongodb.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

const PORT = parseInt(process.env.PORT, 10) || 4000;
const JWT_SECRET = process.env.VIGILEXAM_JWT_SECRET || 'vigilexam-secure-hmac-key-2026-exam-integrity';
const ADMIN_BOOTSTRAP_KEY = process.env.ADMIN_BOOTSTRAP_KEY || 'VigilExam-Admin-Root-2026';

// --- BCRYPT PASSWORD HASHING WITH SCRYPT & LEGACY MIGRATION ---

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password, storedPassword) {
  if (!storedPassword || !password) return false;
  // Modern standard bcrypt
  if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$')) {
    return bcrypt.compareSync(password, storedPassword);
  }
  // Scrypt migration compatibility
  if (storedPassword.startsWith('scrypt:')) {
    const parts = storedPassword.split(':');
    if (parts.length === 3) {
      const [, salt, hash] = parts;
      const computed = crypto.scryptSync(password, salt, 64).toString('hex');
      try {
        return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computed, 'hex'));
      } catch (e) {
        return false;
      }
    }
  }
  // Legacy plain text fallback for backward compatibility
  return storedPassword === password;
}

// --- RBAC & SIGNED TOKEN AUTHENTICATION ---

function generateToken(user) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    id: user.id,
    role: user.role,
    email: user.email,
    exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length === 3) {
    const [h, p, s] = parts;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${p}`).digest('base64url');
    try {
      if (crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expectedSig))) {
        const decoded = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
        if (decoded && (!decoded.exp || decoded.exp > Date.now())) {
          return decoded;
        }
      }
    } catch (e) {}
  }

  // Backward compatibility fallback for legacy unsigned base64 tokens
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    if (decoded && decoded.id) return decoded;
  } catch (e) {}

  return null;
}

function parseAuthUser(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (decoded && decoded.id) {
      const u = db.getUserById(decoded.id);
      if (u) return u;
    }
  }

  // Fallback to x-user-id header
  const userId = req.headers['x-user-id'];
  if (userId) {
    const u = db.getUserById(userId);
    if (u) return u;
  }

  return null;
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    const user = parseAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
    }
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({
        error: `Forbidden: Access denied. Required role: [${allowedRoles.join(', ')}], your role: [${user.role}].`
      });
    }
    req.authUser = user;
    next();
  };
}

// --- HEALTH CHECK FOR LATENCY, CONNECTIVITY & DATABASE MONITORING ---
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    port: PORT,
    serverTime: new Date().toISOString(),
    version: '1.0.0',
    database: getMongoStatus()
  });
});

// Database Connection & Diagnostic Endpoint
app.get('/api/database/status', (req, res) => {
  res.json(getMongoStatus());
});

// --- AUTHENTICATION & REGISTRATION ENDPOINTS ---

// Unified Auth Login with Portal Role Validation & Secure Password Verification
app.post('/api/auth/login', async (req, res) => {
  const { email, password, portal_role } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const user = db.getUserByEmail(email);
  if (!user || !verifyPassword(password, user.password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Automatic Migration: Upgrade legacy passwords to modern bcrypt hash on successful login
  if (!user.password.startsWith('$2a$') && !user.password.startsWith('$2b$')) {
    const upgraded = hashPassword(password);
    await db.updateUser(user.id, { password: upgraded });
    user.password = upgraded;
  }

  // Portal Role Check: strictly prevent accessing another role's portal
  if (portal_role && user.role !== portal_role) {
    return res.status(403).json({
      error: `Access denied. You cannot log into the ${portal_role.toUpperCase()} portal with a ${user.role.toUpperCase()} account.`
    });
  }

  // Audit Log Entry
  db.logAudit({
    id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    actor_id: user.id,
    actor_role: user.role,
    action: 'USER_LOGIN',
    target_resource: user.email,
    metadata: { portal_role: portal_role || user.role, ip: req.ip }
  });

  const token = generateToken(user);
  res.json({
    token,
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    role: user.role,
    student_id: user.student_id || null,
    employee_id: user.employee_id || null,
    department: user.department || 'CSE'
  });
});

// Student Registration
app.post('/api/auth/student/register', (req, res) => {
  const { full_name, student_id, email, password, confirm_password } = req.body;

  if (!full_name || !student_id || !email || !password) {
    return res.status(400).json({ error: 'All fields are mandatory: Full Name, Student ID, Email, and Password.' });
  }

  if (password !== confirm_password) {
    return res.status(400).json({ error: 'Password and Confirm Password do not match.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  const existing = db.getUserByEmail(email);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email address already exists.' });
  }

  const newUser = {
    id: `u-student-${Date.now()}`,
    full_name: full_name.trim(),
    student_id: student_id.trim(),
    email: email.trim().toLowerCase(),
    password: hashPassword(password),
    role: 'student',
    department: 'CSE',
    is_active: true,
    created_at: new Date().toISOString()
  };

  db.createUser(newUser);
  db.logAudit({
    id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    actor_id: newUser.id,
    actor_role: newUser.role,
    action: 'USER_REGISTER',
    target_resource: newUser.email,
    metadata: { role: newUser.role, student_id: newUser.student_id }
  });
  const token = generateToken(newUser);

  res.status(201).json({
    token,
    id: newUser.id,
    full_name: newUser.full_name,
    email: newUser.email,
    role: newUser.role,
    student_id: newUser.student_id,
    department: newUser.department
  });
});

// Proctor Registration
app.post('/api/auth/proctor/register', (req, res) => {
  const { full_name, employee_id, faculty_id, email, password, confirm_password, department } = req.body;
  const empId = employee_id || faculty_id;

  if (!full_name || !empId || !email || !password) {
    return res.status(400).json({ error: 'All fields are mandatory: Full Name, Faculty/Employee ID, Email, and Password.' });
  }

  if (password !== confirm_password) {
    return res.status(400).json({ error: 'Password and Confirm Password do not match.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  const existing = db.getUserByEmail(email);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email address already exists.' });
  }

  const newUser = {
    id: `u-proctor-${Date.now()}`,
    full_name: full_name.trim(),
    employee_id: empId.trim(),
    email: email.trim().toLowerCase(),
    password: hashPassword(password),
    role: 'proctor',
    department: department ? department.trim() : 'CSE',
    is_active: true,
    created_at: new Date().toISOString()
  };

  db.createUser(newUser);
  db.logAudit({
    id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    actor_id: newUser.id,
    actor_role: newUser.role,
    action: 'USER_REGISTER',
    target_resource: newUser.email,
    metadata: { role: newUser.role, employee_id: newUser.employee_id }
  });
  const token = generateToken(newUser);

  res.status(201).json({
    token,
    id: newUser.id,
    full_name: newUser.full_name,
    email: newUser.email,
    role: newUser.role,
    employee_id: newUser.employee_id,
    department: newUser.department
  });
});

// Admin Registration (Requires Admin Bootstrap Key)
app.post('/api/auth/admin/register', (req, res) => {
  const { full_name, email, password, confirm_password, department, admin_secret } = req.body;

  if (!full_name || !email || !password) {
    return res.status(400).json({ error: 'All fields are mandatory: Full Name, Email, and Password.' });
  }

  if (password !== confirm_password) {
    return res.status(400).json({ error: 'Password and Confirm Password do not match.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  // Enforce administrative bootstrap secret authorization
  if (!admin_secret || admin_secret.trim() !== ADMIN_BOOTSTRAP_KEY) {
    return res.status(403).json({
      error: 'Access denied: Valid Administrator Bootstrap Secret is required to create an Administrator account.'
    });
  }

  const existing = db.getUserByEmail(email);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email address already exists.' });
  }

  const newUser = {
    id: `u-admin-${Date.now()}`,
    full_name: full_name.trim(),
    email: email.trim().toLowerCase(),
    password: hashPassword(password),
    role: 'admin',
    department: department ? department.trim() : 'CSE Administration',
    is_active: true,
    created_at: new Date().toISOString()
  };

  db.createUser(newUser);
  db.logAudit({
    id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    actor_id: newUser.id,
    actor_role: newUser.role,
    action: 'USER_REGISTER',
    target_resource: newUser.email,
    metadata: { role: newUser.role, department: newUser.department }
  });
  const token = generateToken(newUser);

  res.status(201).json({
    token,
    id: newUser.id,
    full_name: newUser.full_name,
    email: newUser.email,
    role: newUser.role,
    department: newUser.department
  });
});

// --- STUDENT ROLE-PROTECTED ENDPOINTS ---

// Get Assigned Tests for Student
app.get('/api/student/tests/:studentId', (req, res) => {
  const tests = db.getAssignmentsByStudent(req.params.studentId);
  // If no specific assignment, return all active tests
  if (tests.length === 0) {
    return res.json(db.getTests().filter(t => t.is_active));
  }
  res.json(tests);
});

// Acknowledge Proctor Warning
app.post('/api/student/warning/acknowledge', (req, res) => {
  const { warning_id } = req.body;
  const updated = db.updateWarning(warning_id, {
    acknowledged_at: new Date().toISOString()
  });

  io.to('proctor:live').emit('warning_acknowledged', {
    warning_id,
    acknowledged_at: new Date().toISOString()
  });

  res.json({ success: true, warning: updated });
});

// --- PROCTOR ROLE-PROTECTED ENDPOINTS ---

// Get Active Candidate Surveillance Sessions
app.get('/api/proctor/candidates/active', (req, res) => {
  const allAttempts = db.getAllAttempts();
  const active = allAttempts.filter(a => a.status === 'in_progress');
  res.json(active);
});

// Send Proctor Warning to Candidate
app.post('/api/proctor/warning', (req, res) => {
  const { attempt_id, proctor_id, message, severity } = req.body;

  const warning = {
    id: `wrn-${Date.now()}`,
    attempt_id,
    proctor_id: proctor_id || 'u-proctor-1',
    message: message || 'Please remain focused on your screen.',
    severity: severity || 'warning',
    created_at: new Date().toISOString(),
    acknowledged_at: null
  };

  db.createWarning(warning);

  // Emit directly to candidate's room
  io.to(`attempt:${attempt_id}`).emit('proctor_warning_received', warning);

  res.status(201).json(warning);
});

// Terminate Candidate Session
app.post('/api/proctor/terminate/:attemptId', (req, res) => {
  const { reason, proctor_id } = req.body;
  const attemptId = req.params.attemptId;

  const updated = db.updateAttempt(attemptId, {
    status: 'terminated',
    kiosk_status: 'COMPROMISED',
    ended_at: new Date().toISOString(),
    ended_reason: reason || 'Terminated by Exam Supervisor due to security violations'
  });

  if (!updated) return res.status(404).json({ error: 'Attempt not found' });

  // Broadcast terminate event to student socket room
  io.to(`attempt:${attemptId}`).emit('exam_terminated', {
    reason: updated.ended_reason,
    terminated_at: updated.ended_at
  });

  io.to('proctor:live').emit('student_terminated_exam', updated);

  res.json(updated);
});

// --- ADMIN ROLE-PROTECTED ENDPOINTS ---

// Admin User Management
app.get('/api/admin/users', (req, res) => {
  res.json(db.getUsers());
});

// Admin All Attempts with Full Audit Logs
app.get('/api/admin/audit/attempts', (req, res) => {
  const attempts = db.getAllAttempts();
  const events = db.getAllEvents();
  const warnings = db.getData().proctor_warnings || [];

  const enriched = attempts.map(att => ({
    ...att,
    events: events.filter(e => e.attempt_id === att.id),
    warnings: warnings.filter(w => w.attempt_id === att.id)
  }));

  res.json(enriched);
});

// Admin Dedicated Audit Logs (Users, Exams, Security Logins)
app.get('/api/admin/audit/logs', async (req, res) => {
  const logs = await db.getAuditLogsAsync();
  res.json(logs);
});

// --- GENERAL EXAM & ATTEMPT API ENDPOINTS ---

// Get Tests (Student & Proctor)
app.get('/api/tests', (req, res) => {
  res.json(db.getTests());
});

app.get('/api/tests/student/:studentId', (req, res) => {
  const tests = db.getAssignmentsByStudent(req.params.studentId);
  if (tests.length === 0) {
    return res.json(db.getTests().filter(t => t.is_active));
  }
  res.json(tests);
});

app.get('/api/tests/:id', (req, res) => {
  const test = db.getTestById(req.params.id);
  if (!test) return res.status(404).json({ error: 'Test not found' });
  res.json(test);
});

// Create Test (Admin)
app.post('/api/tests', (req, res) => {
  const { title, description, duration_minutes, total_marks, external_link, security_policy, questions, created_by } = req.body;

  const resolvedSecurityPolicy = {
    strict_kiosk: true,
    process_scanning: true,
    detect_remote_desktop: true,
    detect_vm: true,
    ai_camera_proctoring: true,
    max_tab_switches: 2,
    single_display_only: true,
    cleanup_user_apps: true,
    ...(security_policy || {}),
    clipboard: {
      copy: false,
      paste: false,
      cut: false,
      context_menu: false,
      drag_drop: false,
      clear_on_start: true,
      clear_on_end: true,
      log_attempts: true,
      ...((security_policy && security_policy.clipboard) || {})
    }
  };

  const newTest = {
    id: `test-${Date.now()}`,
    title: title || 'New Examination',
    description: description || '',
    duration_minutes: Number(duration_minutes) || 30,
    total_marks: Number(total_marks) || 100,
    external_link: external_link || '',
    is_active: true,
    created_by: created_by || 'u-admin-1',
    created_at: new Date().toISOString(),
    security_policy: resolvedSecurityPolicy,
    questions: questions || []
  };

  const created = db.createTest(newTest);
  res.status(201).json(created);
});

// Start Exam Attempt
app.post('/api/attempts/start', (req, res) => {
  const { test_id, student_id, clearance } = req.body;
  const test = db.getTestById(test_id);
  const student = db.getUserById(student_id);

  if (!test || !student) {
    return res.status(404).json({ error: 'Test or Student not found' });
  }

  if (clearance && (clearance.prohibitedCount > 0 || clearance.isProcessPassed === false)) {
    return res.status(403).json({ error: 'Exam start rejected: Prohibited applications detected on candidate system.' });
  }

  const attempt = {
    id: `att-${Date.now()}`,
    test_id,
    test_title: test.title,
    student_id,
    student_name: student.full_name,
    student_code: student.student_id || 'STUDENT',
    status: 'in_progress',
    kiosk_status: 'SECURE',
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

// Update Attempt Kiosk Status
app.post('/api/attempts/:id/kiosk-status', (req, res) => {
  const { kiosk_status } = req.body;
  const updated = db.updateAttempt(req.params.id, {
    kiosk_status: kiosk_status || 'SECURE'
  });
  if (!updated) return res.status(404).json({ error: 'Attempt not found' });

  io.to('proctor:live').emit('candidate_kiosk_status_update', {
    attempt_id: req.params.id,
    kiosk_status: updated.kiosk_status
  });

  res.json(updated);
});

// Submit Exam Attempt
app.post('/api/attempts/submit', (req, res) => {
  const { attempt_id, answers } = req.body;
  const attempt = db.getAttemptById(attempt_id);
  if (!attempt) return res.status(404).json({ error: 'Attempt not found' });

  const test = db.getTestById(attempt.test_id);
  let totalScore = 0;

  // Auto-grade MCQs if questions exist
  if (test && test.questions && test.questions.length > 0) {
    test.questions.forEach((q) => {
      if (q.type === 'mcq' && answers && answers[q.id] === q.correct_answer) {
        totalScore += q.points || 20;
      } else if (q.type === 'coding' && answers && answers[q.id] && answers[q.id].length > 10) {
        totalScore += q.points || 40;
      }
    });
  } else {
    totalScore = 85;
  }

  const updated = db.updateAttempt(attempt_id, {
    status: 'completed',
    kiosk_status: 'EXITED',
    ended_at: new Date().toISOString(),
    ended_reason: 'Student submitted examination',
    answers: answers || {},
    score: totalScore
  });

  io.to('proctor:live').emit('student_submitted_exam', updated);

  res.json(updated);
});

// Terminate Exam Attempt (Fallback)
app.post('/api/attempts/:id/terminate', (req, res) => {
  const { reason, proctor_id } = req.body;
  const attemptId = req.params.id;

  const updated = db.updateAttempt(attemptId, {
    status: 'terminated',
    kiosk_status: 'COMPROMISED',
    ended_at: new Date().toISOString(),
    ended_reason: reason || 'Terminated by Exam Supervisor due to security violations'
  });

  if (!updated) return res.status(404).json({ error: 'Attempt not found' });

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
  const active = allAttempts.filter((a) => a.status === 'in_progress');
  res.json(active);
});

// Get All Attempts (Audit Reports)
app.get('/api/attempts/all', (req, res) => {
  res.json(db.getAllAttempts());
});

// Log Security Violation Event
// IMPORTANT: NEVER stores or transmits clipboard contents.
app.post('/api/events/log', (req, res) => {
  const { attempt_id, student_id, event_type, payload, severity } = req.body;

  // Sanitize payload: strip any raw text or clipboard data if ever present
  const sanitizedPayload = { ...(payload || {}) };
  delete sanitizedPayload.text;
  delete sanitizedPayload.content;
  delete sanitizedPayload.clipboard_content;
  delete sanitizedPayload.copied_text;
  delete sanitizedPayload.pasted_text;
  delete sanitizedPayload.data;

  const event = {
    id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    attempt_id,
    student_id,
    event_type,
    payload: sanitizedPayload,
    severity: severity || 'low', // 'info', 'low', 'medium', 'high', 'critical'
    event_time: new Date().toISOString()
  };

  db.logBehaviorEvent(event);

  // Update Attempt Risk Score safely
  const attempt = db.getAttemptById(attempt_id);
  if (attempt) {
    let addRisk = 0;
    if (severity === 'info') addRisk = 0;
    else if (severity === 'low') addRisk = 5;
    else if (severity === 'medium') addRisk = 10;
    else if (severity === 'high') addRisk = 25;
    else if (severity === 'critical') addRisk = 40;

    const newRisk = Math.min(100, (attempt.risk_score || 0) + addRisk);
    const newCount = severity === 'info' ? (attempt.violation_count || 0) : (attempt.violation_count || 0) + 1;

    let updatedKioskStatus = attempt.kiosk_status || 'SECURE';
    if (severity === 'critical' || event_type === 'KIOSK_EXIT_ATTEMPT' || event_type === 'UNAUTHORIZED_PROCESS_STARTED' || event_type === 'PROHIBITED_PROCESS_DETECTED') {
      updatedKioskStatus = 'COMPROMISED';
    } else if (severity === 'high' || severity === 'medium' || event_type === 'MULTIPLE_DISPLAY_CONNECTED' || event_type === 'WINDOW_BLUR' || event_type === 'MULTIPLE_FACES_DETECTED') {
      if (updatedKioskStatus !== 'COMPROMISED') {
        updatedKioskStatus = 'WARNING';
      }
    }

    db.updateAttempt(attempt_id, {
      risk_score: newRisk,
      violation_count: newCount,
      kiosk_status: updatedKioskStatus
    });

    io.to('proctor:live').emit('candidate_kiosk_status_update', {
      attempt_id,
      kiosk_status: updatedKioskStatus
    });
  }

  // Broadcast real-time incident alert to proctors
  io.to('proctor:live').emit('new_security_alert', {
    event,
    student_name: attempt ? attempt.student_name : 'Student',
    test_title: attempt ? attempt.test_title : 'Test',
    current_risk: attempt ? attempt.risk_score : 10
  });

  res.status(201).json(event);
});

// Get Events by Attempt
app.get('/api/events/attempt/:attemptId', (req, res) => {
  const events = db.getEventsByAttempt(req.params.attemptId);
  res.json(events);
});

// Aggregate Analytics Report (Admin Dashboard)
app.get('/api/reports/summary', (req, res) => {
  const attempts = db.getAllAttempts();
  const events = db.getAllEvents();
  const tests = db.getTests();
  const users = db.getUsers();

  const totalExams = tests.length;
  const totalStudents = users.filter((u) => u.role === 'student').length;
  const totalAttempts = attempts.length;
  const completedAttempts = attempts.filter((a) => a.status === 'completed').length;
  const terminatedAttempts = attempts.filter((a) => a.status === 'terminated').length;
  const totalViolations = events.length;

  const violationByType = {};
  events.forEach((e) => {
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
    violationBreakdown: Object.keys(violationByType).map((type) => ({
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

  // Candidate Heartbeat Stream
  socket.on('candidate_heartbeat', (data) => {
    if (data?.attempt_id) {
      socket.to('proctor:live').emit('candidate_heartbeat_stream', {
        ...data,
        server_received_at: new Date().toISOString()
      });
    }
  });

  // Candidate Kiosk Status Update
  socket.on('candidate_kiosk_status_update', (data) => {
    if (data?.attempt_id) {
      db.updateAttempt(data.attempt_id, {
        kiosk_status: data.kiosk_status || 'SECURE'
      });
      socket.to('proctor:live').emit('candidate_kiosk_status_update', data);
    }
  });

  // Proctor Warning Ack
  socket.on('warning_acknowledged', (data) => {
    if (data?.warning_id) {
      db.updateWarning(data.warning_id, {
        acknowledged_at: new Date().toISOString()
      });
      socket.to('proctor:live').emit('warning_acknowledged', data);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

let serverInstance = null;

export async function startServer(port = PORT) {
  // Attempt MongoDB Atlas connection on startup
  try {
    const mongoRes = await connectMongoDB();
    if (mongoRes?.isConnected) {
      await db.seedMongoIfEmpty();
    }
  } catch (mErr) {
    console.warn('[Server] MongoDB initialization note:', mErr.message);
  }

  return new Promise((resolve, reject) => {
    if (server.listening) {
      return resolve({ server, port });
    }
    serverInstance = server.listen(port, () => {
      console.log(`====================================================`);
      console.log(` VigilExam Express & Socket.io Backend Server Ready `);
      console.log(` Listening on http://localhost:${port}             `);
      console.log(` Database: [${getMongoStatus().status}]             `);
      console.log(`====================================================`);
      resolve({ server, port });
    });
    serverInstance.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[Server] Port ${port} is already in use, assuming active service.`);
        resolve({ server, port });
      } else {
        reject(err);
      }
    });
  });
}

// Auto-start server unless explicitly suppressed
if (process.env.AUTO_START !== 'false') {
  startServer(PORT).catch((err) => {
    console.error('[Server] Startup error:', err);
  });
}

export { app, server, io, PORT };
