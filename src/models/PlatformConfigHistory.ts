import mongoose, { Schema, Document } from 'mongoose';

export interface IPlatformConfigHistory extends Document {
  key: string;
  oldValue: any;
  newValue: any;
  performedBy?: mongoose.Types.ObjectId | string;
  performedByRole?: string;
  createdAt: Date;
}

const PlatformConfigHistorySchema = new Schema<IPlatformConfigHistory>({
  key: { type: String, required: true, index: true },
  oldValue: { type: Schema.Types.Mixed },
  newValue: { type: Schema.Types.Mixed },
  // Accept both ObjectId and String for performedBy (for test users)
  performedBy: { type: Schema.Types.Mixed },
  performedByRole: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export const PlatformConfigHistory = mongoose.model<IPlatformConfigHistory>('PlatformConfigHistory', PlatformConfigHistorySchema);
