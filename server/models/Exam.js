import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: { type: String, enum: ['mcq', 'coding', 'subjective'], default: 'mcq' },
    question: { type: String, required: true },
    options: [{ type: String }],
    correct_answer: { type: String },
    points: { type: Number, default: 20 },
    code_template: { type: String, default: '' }
  },
  { _id: false }
);

const examSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    duration_minutes: { type: Number, required: true, default: 30 },
    total_marks: { type: Number, required: true, default: 100 },
    external_link: { type: String, default: '' },
    is_active: { type: Boolean, default: true, index: true },
    created_by: { type: String, default: 'u-admin-1' },
    security_policy: {
      strict_kiosk: { type: Boolean, default: true },
      single_display_only: { type: Boolean, default: true },
      process_cleanup: { type: Boolean, default: true },
      process_scanning: { type: Boolean, default: true },
      continuous_process_monitoring: { type: Boolean, default: true },
      detect_remote_desktop: { type: Boolean, default: true },
      detect_vm: { type: Boolean, default: true },
      ai_camera_proctoring: { type: Boolean, default: true },
      max_tab_switches: { type: Number, default: 2 },
      allow_vscode_dev: { type: Boolean, default: true },
      browser_policy: { type: String, enum: ['allow', 'warn', 'prohibit'], default: 'warn' },
      clipboard: {
        copy: { type: Boolean, default: false },
        paste: { type: Boolean, default: false },
        cut: { type: Boolean, default: false },
        context_menu: { type: Boolean, default: false },
        drag_drop: { type: Boolean, default: false },
        clear_on_start: { type: Boolean, default: true },
        clear_on_end: { type: Boolean, default: true },
        log_attempts: { type: Boolean, default: true }
      }
    },
    questions: [questionSchema],
    assigned_students: [{ type: String, index: true }],
    assigned_proctors: [{ type: String, index: true }]
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

export const Exam = mongoose.models.Exam || mongoose.model('Exam', examSchema);
