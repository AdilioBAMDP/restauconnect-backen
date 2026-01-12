import mongoose, { Schema, Document } from 'mongoose';

export interface AuditLogDocument extends Document {
  action: string; // ex: 'approve_review', 'delete_offer', 'change_role', etc.
  targetType: string; // 'user', 'message', 'offer', 'review', etc.
  targetId: string;
  performedBy: mongoose.Types.ObjectId;
  performedByRole: string;
  details?: any;
  createdAt: Date;
}

const AuditLogSchema = new Schema<AuditLogDocument>({
  action: { type: String, required: true },
  targetType: { type: String, required: true },
  targetId: { type: String, required: true },
  performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  performedByRole: { type: String, required: true },
  details: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now }
});

AuditLogSchema.index({ targetType: 1, targetId: 1 });
AuditLogSchema.index({ performedBy: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLog = (mongoose.models.AuditLog || mongoose.model<AuditLogDocument>('AuditLog', AuditLogSchema)) as mongoose.Model<AuditLogDocument>;
