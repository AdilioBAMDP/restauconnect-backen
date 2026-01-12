// backend/src/models/SupportTicket.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface SupportTicketDocument extends Document {
  createdBy: string; // userId
  assignedTo?: string; // adminId
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'closed';
  messages: Array<{
    sender: string;
    content: string;
    date: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const SupportTicketSchema = new Schema<SupportTicketDocument>({
  createdBy: { type: String, required: true },
  assignedTo: { type: String },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  status: { type: String, enum: ['open', 'in_progress', 'closed'], default: 'open' },
  messages: [
    {
      sender: { type: String, required: true },
      content: { type: String, required: true },
      date: { type: Date, default: Date.now }
    }
  ]
}, { timestamps: true });

export const SupportTicket = mongoose.model<SupportTicketDocument>('SupportTicket', SupportTicketSchema);
