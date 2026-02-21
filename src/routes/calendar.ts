import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types';
import { createSuccessResponse, createErrorResponse } from '../utils/helpers';
import { CalendarEvent } from '../models/CalendarEvent';

const router = Router();

// Get calendar events
router.get('/events', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { start, end, view = 'month' } = req.query;
    const userId = req.user!._id;

    // Construire la requÃƒÂªte MongoDB
    const query: any = { userId };
    
    // Filter par plage de dates si fournie
    if (start && end) {
      const startDate = new Date(start as string);
      const endDate = new Date(end as string);
      query.start = { $gte: startDate, $lte: endDate };
    }

    // RÃƒÂ©cupÃƒÂ©rer les ÃƒÂ©vÃƒÂ©nements depuis MongoDB
    const events = await CalendarEvent.find(query)
      .sort({ start: 1 });

    res.json(createSuccessResponse(events, 'Calendar events retrieved successfully'));
    return;
  } catch (error: any) {
    logger.error('Calendar events error', error);
    res.status(500).json(createErrorResponse('Failed to retrieve calendar events', error.message));
    return;
  }
});

// Create calendar event
router.post('/events', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const {
      title,
      description,
      start,
      end,
      type = 'meeting',
      location,
      attendees = [],
      reminders = []
    } = req.body;
    
    const userId = req.user!._id;

    if (!title || !start || !end) {
      return res.status(400).json(createErrorResponse('Title, start and end dates are required'));
    }

    const newEvent = await CalendarEvent.create({
      userId,
      title,
      description,
      start: new Date(start),
      end: new Date(end),
      type,
      status: 'confirmed',
      location,
      attendees,
      reminders,
      createdBy: userId
    });

    res.status(201).json(createSuccessResponse(newEvent, 'Event created successfully'));
    return;
  } catch (error: any) {
    logger.error('Create event error', error);
    res.status(500).json(createErrorResponse('Failed to create event', error.message));
    return;
  }
});

// Update calendar event
router.put('/events/:eventId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { eventId } = req.params;
    const updates = req.body;
    const userId = req.user!._id;

    const event = await CalendarEvent.findOne({ _id: eventId, userId }).exec();
    
    if (!event) {
      return res.status(404).json(createErrorResponse('Event not found'));
    }

    Object.assign(event, updates);
    await event.save();

    res.json(createSuccessResponse(event, 'Event updated successfully'));
    return;
  } catch (error: any) {
    logger.error('Update event error', error);
    res.status(500).json(createErrorResponse('Failed to update event', error.message));
    return;
  }
});

// Delete calendar event
router.delete('/events/:eventId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { eventId } = req.params;
    const userId = req.user!._id;

    const event = await CalendarEvent.findOneAndDelete({ _id: eventId, userId });
    
    if (!event) {
      return res.status(404).json(createErrorResponse('Event not found'));
    }

    res.json(createSuccessResponse({ id: eventId }, 'Event deleted successfully'));
    return;
  } catch (error: any) {
    logger.error('Delete event error', error);
    res.status(500).json(createErrorResponse('Failed to delete event', error.message));
    return;
  }
});

// Get available time slots
router.get('/availability', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { date, duration = 60 } = req.query;
    
    if (!date) {
      return res.status(400).json(createErrorResponse('Date is required'));
    }

    // Mock availability calculation
    const slots = [
      { start: '09:00', end: '10:00', available: true },
      { start: '10:00', end: '11:00', available: false },
      { start: '11:00', end: '12:00', available: true },
      { start: '14:00', end: '15:00', available: true },
      { start: '15:00', end: '16:00', available: true },
      { start: '16:00', end: '17:00', available: false },
      { start: '17:00', end: '18:00', available: true }
    ];

    res.json(createSuccessResponse({
      date,
      duration: Number(duration),
      slots
    }, 'Availability retrieved successfully'));
    return;
  } catch (error: any) {
    logger.error('Get availability error', error);
    res.status(500).json(createErrorResponse('Failed to retrieve availability', error.message));
    return;
  }
});

export default router;
