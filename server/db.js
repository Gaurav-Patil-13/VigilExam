import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.VIGILEXAM_DATA_DIR || __dirname;

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, 'vigilexam_store.json');

// Default Seed Data based on Project Synopsis
const initialData = {
  users: [
    {
      id: "u-student-1",
      full_name: "Gaurav Patil",
      email: "student@vigilexam.com",
      password: "password123",
      role: "student",
      student_id: "23510040",
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
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      id: "u-admin-1",
      full_name: "Rugved Ganapule",
      email: "admin@vigilexam.com",
      password: "password123",
      role: "admin",
      department: "CSE",
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
        process_scanning: true,
        detect_remote_desktop: true,
        detect_vm: true,
        ai_camera_proctoring: true,
        max_tab_switches: 2,
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
          question: "Which monitoring layer in VigilExam detects unauthorized background tools such as AnyDesk or TeamViewer?",
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
          code_template: "function detectAnomalies(processList) {\n  // Return list of suspicious process names\n  const forbidden = ['anydesk.exe', 'teamviewer.exe', 'vnc.exe'];\n  return processList.filter(p => forbidden.includes(p.toLowerCase()));\n}",
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
        process_scanning: true,
        detect_remote_desktop: true,
        detect_vm: true,
        ai_camera_proctoring: true,
        max_tab_switches: 1,
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
  proctor_warnings: []
};

class DBManager {
  constructor() {
    this.initDB();
  }

  initDB() {
    if (!fs.existsSync(DB_FILE)) {
      this.saveData(initialData);
    } else {
      // Ensure existing tests in the database file include clipboard security policy
      try {
        const data = this.getData();
        let modified = false;
        if (data && Array.isArray(data.tests)) {
          data.tests.forEach((test) => {
            if (!test.security_policy) {
              test.security_policy = { ...initialData.tests[0].security_policy };
              modified = true;
            } else if (!test.security_policy.clipboard) {
              test.security_policy.clipboard = {
                copy: false,
                paste: false,
                cut: false,
                context_menu: false,
                drag_drop: false,
                clear_on_start: true,
                clear_on_end: true,
                log_attempts: true
              };
              modified = true;
            }
          });
        }
        if (modified) {
          this.saveData(data);
        }
      } catch (err) {
        console.error("Error migrating database tests:", err);
      }
    }
  }

  getData() {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      console.error("Error reading database file, re-initializing:", err);
      this.saveData(initialData);
      return initialData;
    }
  }

  saveData(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  }

  // Helper Methods
  getUserByEmail(email) {
    const db = this.getData();
    return db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  getUserById(id) {
    const db = this.getData();
    return db.users.find(u => u.id === id);
  }

  getUsers() {
    return this.getData().users;
  }

  createUser(userData) {
    const db = this.getData();
    db.users.push(userData);
    this.saveData(db);
    return userData;
  }

  getTests() {
    return this.getData().tests;
  }

  getTestById(id) {
    const db = this.getData();
    return db.tests.find(t => t.id === id);
  }

  createTest(testObj) {
    const db = this.getData();
    db.tests.push(testObj);
    this.saveData(db);
    return testObj;
  }

  getAssignmentsByStudent(studentId) {
    const db = this.getData();
    const assignedTestIds = db.assignments.filter(a => a.student_id === studentId).map(a => a.test_id);
    return db.tests.filter(t => assignedTestIds.includes(t.id));
  }

  createAttempt(attemptData) {
    const db = this.getData();
    db.test_attempts.push(attemptData);
    this.saveData(db);
    return attemptData;
  }

  getAttemptById(attemptId) {
    const db = this.getData();
    return db.test_attempts.find(a => a.id === attemptId);
  }

  updateAttempt(attemptId, updateFields) {
    const db = this.getData();
    const index = db.test_attempts.findIndex(a => a.id === attemptId);
    if (index !== -1) {
      db.test_attempts[index] = { ...db.test_attempts[index], ...updateFields };
      this.saveData(db);
      return db.test_attempts[index];
    }
    return null;
  }

  getAllAttempts() {
    return this.getData().test_attempts;
  }

  logBehaviorEvent(eventData) {
    const db = this.getData();
    db.behavior_events.push(eventData);
    this.saveData(db);
    return eventData;
  }

  getEventsByAttempt(attemptId) {
    const db = this.getData();
    return db.behavior_events.filter(e => e.attempt_id === attemptId);
  }

  getAllEvents() {
    return this.getData().behavior_events;
  }

  createWarning(warningData) {
    const db = this.getData();
    db.proctor_warnings.push(warningData);
    this.saveData(db);
    return warningData;
  }

  getWarningsByAttempt(attemptId) {
    const db = this.getData();
    return db.proctor_warnings.filter(w => w.attempt_id === attemptId);
  }
}

export const db = new DBManager();
