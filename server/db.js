import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isMongoConnected, getMongoStatus } from './mongodb.js';
import { User, Exam, ExamAttempt, SecurityEvent, ProctorWarning, AuditLog } from './models/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.VIGILEXAM_DATA_DIR || __dirname;

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, 'vigilexam_store.json');

// Default Seed Data based on Project Synopsis
export const initialData = {
  users: [
    {
      id: "u-student-1",
      full_name: "Gaurav Patil",
      email: "student@vigilexam.com",
      password: "password123",
      role: "student",
      student_id: "23510040",
      department: "CSE",
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      id: "u-student-2",
      full_name: "Amit Rane",
      email: "amit@vigilexam.com",
      password: "password123",
      role: "student",
      student_id: "23510064",
      department: "CSE",
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      id: "u-student-3",
      full_name: "Ritesh Jagtap",
      email: "ritesh@vigilexam.com",
      password: "password123",
      role: "student",
      student_id: "23510101",
      department: "CSE",
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      id: "u-proctor-1",
      full_name: "Prof. Swapnali A. Aitwade",
      email: "proctor@vigilexam.com",
      password: "password123",
      role: "proctor",
      department: "CSE",
      employee_id: "EMP-CSE-001",
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      id: "u-admin-1",
      full_name: "Rugved Ganapule",
      email: "admin@vigilexam.com",
      password: "password123",
      role: "admin",
      department: "CSE Administration",
      employee_id: "ADM-CSE-001",
      is_active: true,
      created_at: new Date().toISOString()
    }
  ],
  tests: [
    {
      id: "test-101",
      title: "B.Tech Computer Science Comprehensive Assessment 2026",
      description: "Evaluation covering Data Structures, Operating Systems, Computer Networks, and AI Proctoring Security concepts.",
      duration_minutes: 30,
      total_marks: 100,
      external_link: "",
      is_active: true,
      created_by: "u-admin-1",
      created_at: new Date().toISOString(),
      security_policy: {
        strict_kiosk: true,
        single_display_only: true,
        process_cleanup: true,
        process_scanning: true,
        continuous_process_monitoring: true,
        detect_remote_desktop: true,
        detect_vm: true,
        ai_camera_proctoring: true,
        max_tab_switches: 2,
        allow_vscode_dev: true,
        browser_policy: "warn",
        clipboard: {
          copy: false,
          paste: false,
          cut: false,
          context_menu: false,
          drag_drop: false,
          clear_on_start: true,
          clear_on_end: true,
          log_attempts: true
        }
      },
      questions: [
        {
          id: "q1",
          type: "mcq",
          question: "Which monitoring layer in VigilExam detects unauthorized background tools such as AnyDesk, TeamViewer, or UltraViewer?",
          options: [
            "Browser DOM Mutation Observer",
            "System-Level OS Process Scanning Engine",
            "HTML5 Canvas Renderer",
            "WebRTC Peer Connection"
          ],
          correct_answer: "System-Level OS Process Scanning Engine",
          points: 20
        },
        {
          id: "q2",
          type: "mcq",
          question: "What primary vulnerability in browser-only proctoring tools does VigilExam address?",
          options: [
            "Lack of CSS styling support",
            "Inability to detect background OS processes and virtual machines",
            "High network usage during web browsing",
            "Slow database query execution"
          ],
          correct_answer: "Inability to detect background OS processes and virtual machines",
          points: 20
        },
        {
          id: "q3",
          type: "mcq",
          question: "In the VigilExam architecture, which protocol is utilized to send instant cheating alerts from candidate nodes to the supervisor's proctor dashboard?",
          options: [
            "FTP (File Transfer Protocol)",
            "WebSockets / Real-time Event Socket Stream",
            "SMTP Mail Server",
            "DNS Lookup Queries"
          ],
          correct_answer: "WebSockets / Real-time Event Socket Stream",
          points: 20
        },
        {
          id: "q4",
          type: "coding",
          question: "Write a function `detectAnomalies(processList)` in JavaScript/Python that filters out unauthorized remote desktop process names from an array.",
          code_template: "function detectAnomalies(processList) {\n  // Return list of suspicious process names\n  const forbidden = ['anydesk.exe', 'teamviewer.exe', 'ultraviewer.exe', 'rustdesk.exe'];\n  return processList.filter(p => forbidden.includes(p.toLowerCase()));\n}",
          points: 40
        }
      ]
    },
    {
      id: "test-102",
      title: "HackerRank Advanced Systems Coding Assessment",
      description: "External integrated assessment hosted on HackerRank. VigilExam acts as the secure OS desktop proctoring wrapper.",
      duration_minutes: 45,
      total_marks: 100,
      external_link: "https://www.hackerrank.com/",
      is_active: true,
      created_by: "u-admin-1",
      created_at: new Date().toISOString(),
      security_policy: {
        strict_kiosk: true,
        single_display_only: true,
        process_scanning: true,
        continuous_process_monitoring: true,
        detect_remote_desktop: true,
        detect_vm: true,
        ai_camera_proctoring: true,
        max_tab_switches: 1,
        allow_vscode_dev: true,
        browser_policy: "warn",
        clipboard: {
          copy: false,
          paste: false,
          cut: false,
          context_menu: false,
          drag_drop: false,
          clear_on_start: true,
          clear_on_end: true,
          log_attempts: true
        }
      },
      questions: []
    }
  ],
  assignments: [
    {
      id: "asg-1",
      test_id: "test-101",
      student_id: "u-student-1",
      assigned_by: "u-admin-1",
      assigned_at: new Date().toISOString()
    },
    {
      id: "asg-2",
      test_id: "test-102",
      student_id: "u-student-1",
      assigned_by: "u-admin-1",
      assigned_at: new Date().toISOString()
    },
    {
      id: "asg-3",
      test_id: "test-101",
      student_id: "u-student-2",
      assigned_by: "u-admin-1",
      assigned_at: new Date().toISOString()
    }
  ],
  test_attempts: [],
  behavior_events: [],
  proctor_warnings: [],
  audit_logs: []
};

class DBManager {
  constructor() {
    this.memoryCache = null;
    this.initFileStore();
  }

  initFileStore() {
    if (!fs.existsSync(DB_FILE)) {
      this.saveLocalData(initialData);
    }
  }

  getLocalData() {
    try {
      if (this.memoryCache) return this.memoryCache;
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        this.memoryCache = JSON.parse(raw);
        return this.memoryCache;
      }
      return initialData;
    } catch (err) {
      console.error("[DBManager] Error reading file store:", err.message);
      return initialData;
    }
  }

  saveLocalData(data) {
    try {
      this.memoryCache = data;
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error("[DBManager] Error saving file store:", err.message);
    }
  }

  /**
   * Seed MongoDB Atlas collections with baseline initial records if empty.
   */
  async seedMongoIfEmpty() {
    if (!isMongoConnected()) return;
    try {
      const localStore = this.getLocalData();
      const userCount = await User.countDocuments();
      if (userCount === 0) {
        console.info('[MongoDB] Seeding initial users into MongoDB Atlas...');
        await User.insertMany(localStore.users || initialData.users);
      } else {
        // Upsert any missing local users into Atlas
        for (const u of (localStore.users || [])) {
          const exists = await User.findOne({ $or: [{ id: u.id }, { email: u.email }] });
          if (!exists) {
            await User.create(u).catch(() => {});
          }
        }
      }

      const examCount = await Exam.countDocuments();
      if (examCount === 0) {
        console.info('[MongoDB] Seeding initial exams into MongoDB Atlas...');
        await Exam.insertMany(localStore.tests || initialData.tests);
      } else {
        for (const t of (localStore.tests || [])) {
          const exists = await Exam.findOne({ id: t.id });
          if (!exists) {
            await Exam.create(t).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.warn('[MongoDB] Seeding note:', err.message);
    }
  }

  // --- USER OPERATIONS ---

  async getUserByEmailAsync(email) {
    if (isMongoConnected()) {
      return await User.findOne({ email: email.toLowerCase().trim() }).lean();
    }
    const store = this.getLocalData();
    return store.users.find((u) => u.email.toLowerCase() === email.toLowerCase().trim()) || null;
  }

  getUserByEmail(email) {
    // Synchronous contract for existing synchronous middleware / lookups
    const store = this.getLocalData();
    return store.users.find((u) => u.email.toLowerCase() === email.toLowerCase().trim()) || null;
  }

  async getUserByIdAsync(id) {
    if (isMongoConnected()) {
      return await User.findOne({ id }).lean();
    }
    const store = this.getLocalData();
    return store.users.find((u) => u.id === id) || null;
  }

  getUserById(id) {
    const store = this.getLocalData();
    return store.users.find((u) => u.id === id) || null;
  }

  async getUsersAsync() {
    if (isMongoConnected()) {
      return await User.find({}).lean();
    }
    return this.getLocalData().users;
  }

  getUsers() {
    return this.getLocalData().users;
  }

  async createUser(userData) {
    // Write to memory/file cache immediately for synchronous lookup consistency
    const store = this.getLocalData();
    store.users.push(userData);
    this.saveLocalData(store);

    if (isMongoConnected()) {
      try {
        await User.create(userData);
      } catch (err) {
        console.error('[MongoDB] Error persisting User:', err.message);
        throw err;
      }
    }
    return userData;
  }

  async updateUser(userId, updateFields) {
    const store = this.getLocalData();
    const index = store.users.findIndex((u) => u.id === userId);
    let updated = null;
    if (index !== -1) {
      store.users[index] = { ...store.users[index], ...updateFields };
      this.saveLocalData(store);
      updated = store.users[index];
    }

    if (isMongoConnected()) {
      try {
        await User.findOneAndUpdate({ id: userId }, { $set: updateFields });
      } catch (err) {
        console.error('[MongoDB] Error updating User:', err.message);
      }
    }
    return updated;
  }

  // --- EXAM / TEST OPERATIONS ---

  async getTestsAsync() {
    if (isMongoConnected()) {
      return await Exam.find({ is_active: true }).lean();
    }
    return this.getLocalData().tests.filter((t) => t.is_active);
  }

  getTests() {
    return this.getLocalData().tests;
  }

  async getTestByIdAsync(id) {
    if (isMongoConnected()) {
      return await Exam.findOne({ id }).lean();
    }
    return this.getLocalData().tests.find((t) => t.id === id) || null;
  }

  getTestById(id) {
    return this.getLocalData().tests.find((t) => t.id === id) || null;
  }

  async createTest(testObj) {
    const store = this.getLocalData();
    store.tests.push(testObj);
    this.saveLocalData(store);

    if (isMongoConnected()) {
      try {
        await Exam.create(testObj);
      } catch (err) {
        console.error('[MongoDB] Error creating Exam:', err.message);
        throw err;
      }
    }
    return testObj;
  }

  getAssignmentsByStudent(studentId) {
    const db = this.getLocalData();
    const assignedTestIds = (db.assignments || [])
      .filter((a) => a.student_id === studentId)
      .map((a) => a.test_id);
    return db.tests.filter((t) => assignedTestIds.includes(t.id));
  }

  // --- EXAM ATTEMPT OPERATIONS ---

  async createAttempt(attemptData) {
    const store = this.getLocalData();
    store.test_attempts.push(attemptData);
    this.saveLocalData(store);

    if (isMongoConnected()) {
      try {
        await ExamAttempt.create(attemptData);
      } catch (err) {
        console.error('[MongoDB] Error creating ExamAttempt:', err.message);
        throw err;
      }
    }
    return attemptData;
  }

  async getAttemptByIdAsync(attemptId) {
    if (isMongoConnected()) {
      return await ExamAttempt.findOne({ id: attemptId }).lean();
    }
    return this.getLocalData().test_attempts.find((a) => a.id === attemptId) || null;
  }

  getAttemptById(attemptId) {
    return this.getLocalData().test_attempts.find((a) => a.id === attemptId) || null;
  }

  async updateAttempt(attemptId, updateFields) {
    const store = this.getLocalData();
    const index = store.test_attempts.findIndex((a) => a.id === attemptId);
    let updated = null;
    if (index !== -1) {
      store.test_attempts[index] = { ...store.test_attempts[index], ...updateFields };
      this.saveLocalData(store);
      updated = store.test_attempts[index];
    }

    if (isMongoConnected()) {
      try {
        await ExamAttempt.findOneAndUpdate({ id: attemptId }, { $set: updateFields });
      } catch (err) {
        console.error('[MongoDB] Error updating ExamAttempt:', err.message);
      }
    }
    return updated;
  }

  async getAllAttemptsAsync() {
    if (isMongoConnected()) {
      return await ExamAttempt.find({}).lean();
    }
    return this.getLocalData().test_attempts;
  }

  getAllAttempts() {
    return this.getLocalData().test_attempts;
  }

  // --- SECURITY EVENT OPERATIONS ---

  async logBehaviorEvent(eventData) {
    const store = this.getLocalData();
    store.behavior_events.push(eventData);
    this.saveLocalData(store);

    if (isMongoConnected()) {
      try {
        await SecurityEvent.create(eventData);
      } catch (err) {
        console.error('[MongoDB] Error persisting SecurityEvent:', err.message);
        throw err;
      }
    }
    return eventData;
  }

  async getEventsByAttemptAsync(attemptId) {
    if (isMongoConnected()) {
      return await SecurityEvent.find({ attempt_id: attemptId }).lean();
    }
    return this.getLocalData().behavior_events.filter((e) => e.attempt_id === attemptId);
  }

  getEventsByAttempt(attemptId) {
    return this.getLocalData().behavior_events.filter((e) => e.attempt_id === attemptId);
  }

  async getAllEventsAsync() {
    if (isMongoConnected()) {
      return await SecurityEvent.find({}).lean();
    }
    return this.getLocalData().behavior_events;
  }

  getAllEvents() {
    return this.getLocalData().behavior_events;
  }

  // --- PROCTOR WARNING OPERATIONS ---

  async createWarning(warningData) {
    const store = this.getLocalData();
    store.proctor_warnings.push(warningData);
    this.saveLocalData(store);

    if (isMongoConnected()) {
      try {
        await ProctorWarning.create(warningData);
      } catch (err) {
        console.error('[MongoDB] Error persisting ProctorWarning:', err.message);
        throw err;
      }
    }
    return warningData;
  }

  async getWarningsByAttemptAsync(attemptId) {
    if (isMongoConnected()) {
      return await ProctorWarning.find({ attempt_id: attemptId }).lean();
    }
    return this.getLocalData().proctor_warnings.filter((w) => w.attempt_id === attemptId);
  }

  getWarningsByAttempt(attemptId) {
    return this.getLocalData().proctor_warnings.filter((w) => w.attempt_id === attemptId);
  }

  async updateWarning(warningId, updateFields) {
    const store = this.getLocalData();
    const index = store.proctor_warnings.findIndex((w) => w.id === warningId);
    let updated = null;
    if (index !== -1) {
      store.proctor_warnings[index] = { ...store.proctor_warnings[index], ...updateFields };
      this.saveLocalData(store);
      updated = store.proctor_warnings[index];
    }

    if (isMongoConnected()) {
      try {
        await ProctorWarning.findOneAndUpdate({ id: warningId }, { $set: updateFields });
      } catch (err) {
        console.error('[MongoDB] Error updating ProctorWarning:', err.message);
      }
    }
    return updated;
  }

  // --- AUDIT LOG OPERATIONS ---

  async logAudit(auditData) {
    const store = this.getLocalData();
    if (!store.audit_logs) store.audit_logs = [];
    store.audit_logs.push(auditData);
    this.saveLocalData(store);

    if (isMongoConnected()) {
      try {
        await AuditLog.create(auditData);
      } catch (err) {
        console.error('[MongoDB] Error creating AuditLog:', err.message);
      }
    }
    return auditData;
  }

  async getAuditLogsAsync() {
    if (isMongoConnected()) {
      return await AuditLog.find({}).sort({ timestamp: -1 }).limit(100).lean();
    }
    return (this.getLocalData().audit_logs || []).slice(-100).reverse();
  }

  // Helper method for legacy tests
  getData() {
    return this.getLocalData();
  }

  saveData(data) {
    this.saveLocalData(data);
  }
}

export const db = new DBManager();
export default db;
