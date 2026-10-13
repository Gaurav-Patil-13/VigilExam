import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    actor_id: { type: String, required: true, index: true },
    actor_role: { type: String, required: true, index: true },
    action: { type: String, required: true, index: true },
    target_resource: { type: String, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  {
    timestamps: { createdAt: 'timestamp', updatedAt: false }
  }
);

export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
