import mongoose from 'mongoose';

const securityEventSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    attempt_id: { type: String, required: true, index: true },
    student_id: { type: String, required: true, index: true },
    event_type: { type: String, required: true, index: true },
    severity: {
      type: String,
      enum: ['info', 'low', 'medium', 'high', 'critical'],
      default: 'low',
      index: true
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      validate: {
        validator: function (v) {
          if (!v || typeof v !== 'object') return true;
          // Security constraint: Never store clipboard contents or raw copied text
          return !v.text && !v.content && !v.clipboard_content && !v.copied_text && !v.pasted_text;
        },
        message: 'Security event payload must not store raw clipboard or sensitive content'
      }
    },
    event_time: { type: Date, default: Date.now, index: true }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

export const SecurityEvent = mongoose.models.SecurityEvent || mongoose.model('SecurityEvent', securityEventSchema);
