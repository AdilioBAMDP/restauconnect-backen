import mongoose, { Schema, Document } from 'mongoose';

export interface CalendarEvent {
  _id?: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  type: 'meeting' | 'interview' | 'training' | 'delivery' | 'reminder' | 'other';
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed';
  location?: string;
  attendees: string[]; // User IDs
  reminders: {
    type: 'email' | 'notification' | 'sms';
    minutes: number; // Minutes before event
  }[];
  createdBy: string; // User ID
  color?: string;
  isRecurring?: boolean;
  recurrenceRule?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    endDate?: Date;
    daysOfWeek?: number[]; // 0-6, Sunday = 0
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CalendarEventDocument extends Omit<CalendarEvent, '_id'>, Document {}

const ReminderSchema = new Schema({
  type: {
    type: String,
    enum: ['email', 'notification', 'sms'],
    required: true
  },
  minutes: {
    type: Number,
    required: true,
    min: 0
  }
});

const RecurrenceRuleSchema = new Schema({
  frequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly'],
    required: true
  },
  interval: {
    type: Number,
    required: true,
    min: 1
  },
  endDate: Date,
  daysOfWeek: [{
    type: Number,
    min: 0,
    max: 6
  }]
});

const CalendarEventSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  start: {
    type: Date,
    required: true
  },
  end: {
    type: Date,
    required: true,
    validate: {
      validator: function(this: CalendarEventDocument, value: Date) {
        return value > this.start;
      },
      message: 'End date must be after start date'
    }
  },
  type: {
    type: String,
    enum: ['meeting', 'interview', 'training', 'delivery', 'reminder', 'other'],
    default: 'meeting'
  },
  status: {
    type: String,
    enum: ['confirmed', 'pending', 'cancelled', 'completed'],
    default: 'confirmed'
  },
  location: {
    type: String,
    trim: true,
    maxlength: 300
  },
  attendees: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  reminders: [ReminderSchema],
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  color: {
    type: String,
    match: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
    default: '#3b82f6'
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurrenceRule: RecurrenceRuleSchema
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
CalendarEventSchema.index({ start: 1, end: 1 });
CalendarEventSchema.index({ createdBy: 1, start: 1 });
CalendarEventSchema.index({ attendees: 1, start: 1 });
CalendarEventSchema.index({ type: 1, status: 1 });

// Virtual for duration in minutes
CalendarEventSchema.virtual('duration').get(function(this: CalendarEventDocument) {
  return Math.round((this.end.getTime() - this.start.getTime()) / (1000 * 60));
});

// Methods
CalendarEventSchema.methods.isUpcoming = function(this: CalendarEventDocument): boolean {
  return this.start > new Date();
};

CalendarEventSchema.methods.isPast = function(this: CalendarEventDocument): boolean {
  return this.end < new Date();
};

CalendarEventSchema.methods.isToday = function(this: CalendarEventDocument): boolean {
  const today = new Date();
  const eventDate = new Date(this.start);
  return eventDate.toDateString() === today.toDateString();
};

CalendarEventSchema.methods.conflictsWith = function(
  this: CalendarEventDocument, 
  other: { start: Date; end: Date }
): boolean {
  return (this.start < other.end && this.end > other.start);
};

// Static methods
CalendarEventSchema.statics.findByDateRange = function(
  start: Date, 
  end: Date, 
  userId?: string
) {
  const query: any = {
    start: { $lte: end },
    end: { $gte: start }
  };
  
  if (userId) {
    query.$or = [
      { createdBy: userId },
      { attendees: userId }
    ];
  }
  
  return this.find(query).sort({ start: 1 });
};

CalendarEventSchema.statics.findUpcoming = function(userId: string, limit = 10) {
  return this.find({
    $or: [
      { createdBy: userId },
      { attendees: userId }
    ],
    start: { $gte: new Date() },
    status: { $in: ['confirmed', 'pending'] }
  })
  .sort({ start: 1 })
  .limit(limit)
  .populate('attendees', 'name email avatar')
  .populate('createdBy', 'name email avatar');
};

export const CalendarEvent = mongoose.model<CalendarEventDocument>('CalendarEvent', CalendarEventSchema);
