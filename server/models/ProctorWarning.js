import mongoose from 'mongoose';

const proctorWarningSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    attempt_id: { type: String, required: true, index: true },
    student_id: { type: String, default: null, index: true },
    proctor_id: { type: String, required: true, index: true },
    message: { type: String, required: true, trim: true },
    severity: { type: String, default: 'warning', trim: true },
    acknowledged_at: { type: Date, default: null }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

export const ProctorWarning = mongoose.models.ProctorWarning || mongoose.model('ProctorWarning', proctorWarningSchema);
