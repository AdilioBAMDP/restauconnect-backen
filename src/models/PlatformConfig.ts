import mongoose, { Schema, Document } from 'mongoose';

export interface IPlatformConfig extends Document {
  key: string;
  value: any;
  description?: string;
  updatedAt: Date;
}

const PlatformConfigSchema = new Schema<IPlatformConfig>({
  key: { type: String, required: true, unique: true },
  value: { type: Schema.Types.Mixed, required: true },
  description: { type: String },
  updatedAt: { type: Date, default: Date.now }
});

export const PlatformConfig = mongoose.model<IPlatformConfig>('PlatformConfig', PlatformConfigSchema);
