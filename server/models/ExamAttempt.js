import mongoose from 'mongoose';

const examAttemptSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    test_id: { type: String, required: true, index: true },
    test_title: { type: String, required: true },
    student_id: { type: String, required: true, index: true },
    student_name: { type: String, required: true },
    student_code: { type: String, default: 'STUDENT' },
    status: {
      type: String,
      enum: ['in_progress', 'completed', 'terminated'],
      default: 'in_progress',
      index: true
    },
    kiosk_status: {
      type: String,
      enum: ['SECURE', 'WARNING', 'COMPROMISED', 'EXITED'],
      default: 'SECURE'
    },
    started_at: { type: Date, default: Date.now },
    ended_at: { type: Date, default: null },
    ended_reason: { type: String, default: null },
    risk_score: { type: Number, default: 0, min: 0, max: 100 },
    violation_count: { type: Number, default: 0 },
    answers: { type: mongoose.Schema.Types.Mixed, default: {} },
    score: { type: Number, default: 0 },
    kiosk_token: { type: String, default: '' }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

export const ExamAttempt = mongoose.models.ExamAttempt || mongoose.model('ExamAttempt', examAttemptSchema);
