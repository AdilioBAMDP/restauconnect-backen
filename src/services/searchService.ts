import { CalendarEvent, CalendarEventDocument } from '../models/CalendarEvent';
import { SavedSearch, SavedSearchDocument } from '../models/SavedSearch';
import { User } from '../models/User';
import { logger } from '../utils/logger';

class SearchService {
  // Execute saved search and check for new results
  async executeSearch(searchId: string): Promise<{
    results: any[];
    newResultsCount: number;
  }> {
    try {
      const savedSearch = await SavedSearch.findById(searchId);
      if (!savedSearch) {
        throw new Error('Saved search not found');
      }

      // Mock search execution - in real app, this would query the actual database
      const mockResults = [
        { id: '1', title: 'New Restaurant Job', type: 'listing', createdAt: new Date() },
        { id: '2', title: 'Chef Position Available', type: 'listing', createdAt: new Date() },
        { id: '3', title: 'Restaurant Partner', type: 'user', createdAt: new Date() }
      ];

      // Filter results based on saved search criteria
      const filteredResults = mockResults.filter(result => {
        // Apply filters based on savedSearch.filters
        return true; // Simplified for demo
      });

      // Count new results since last check
      const newResultsCount = filteredResults.length;
      
      // Update saved search with new results count
      savedSearch.newResultsCount = newResultsCount;
      await savedSearch.save();

      return {
        results: filteredResults,
        newResultsCount
      };
    } catch (error) {
      logger.error('Execute search error', error);
      throw error;
    }
  }

  // Send alerts for saved searches
  async processSearchAlerts(): Promise<void> {
    try {
      const searchesReadyForAlerts = await SavedSearch.find({
        alertsEnabled: true,
        isActive: true,
        newResultsCount: { $gt: 0 }
      }).populate('userId', 'name email preferences');

      for (const search of searchesReadyForAlerts) {
        if ((search as any).shouldSendAlert()) {
          await this.sendSearchAlert(search);
          await (search as any).markAlertSent();
        }
      }
    } catch (error) {
      logger.error('Process search alerts error', error);
    }
  }

  private async sendSearchAlert(search: SavedSearchDocument): Promise<void> {
    try {
      const user = await User.findById(search.userId);
      if (!user) return;

      const subject = `Nouvelles offres pour votre recherche: ${search.name}`;
      logger.info(`Alert sent to ${user.email}: ${subject}`);
      
      // Dans une vraie application, ici on enverrait un email et une notification push
      // Pour le moment, on se contente de logger
    } catch (error) {
      logger.error('Send search alert error', error);
    }
  }
}

class CalendarService {
  // Get upcoming events for a user
  async getUpcomingEvents(userId: string, limit = 5): Promise<CalendarEventDocument[]> {
    try {
      return await CalendarEvent.find({
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
    } catch (error) {
      logger.error('Get upcoming events error', error);
      throw error;
    }
  }

  // Check for conflicting events
  async checkConflicts(
    userId: string, 
    start: Date, 
    end: Date, 
    excludeEventId?: string
  ): Promise<CalendarEventDocument[]> {
    try {
      const query: any = {
        $or: [
          { createdBy: userId },
          { attendees: userId }
        ],
        start: { $lt: end },
        end: { $gt: start },
        status: { $in: ['confirmed', 'pending'] }
      };

      if (excludeEventId) {
        query._id = { $ne: excludeEventId };
      }

      return await CalendarEvent.find(query);
    } catch (error) {
      logger.error('Check conflicts error', error);
      throw error;
    }
  }

  // Send event reminders
  async processEventReminders(): Promise<void> {
    try {
      const now = new Date();
      const nextHour = new Date(now.getTime() + 60 * 60 * 1000);

      // Find events starting within the next hour that have reminders
      const upcomingEvents = await CalendarEvent.find({
        start: { $gte: now, $lte: nextHour },
        status: 'confirmed',
        'reminders.0': { $exists: true }
      }).populate('createdBy attendees', 'name email preferences');

      for (const event of upcomingEvents) {
        for (const reminder of event.reminders) {
          const reminderTime = new Date(event.start.getTime() - reminder.minutes * 60 * 1000);
          
          if (reminderTime <= now && reminderTime > new Date(now.getTime() - 5 * 60 * 1000)) {
            await this.sendEventReminder(event, reminder);
          }
        }
      }
    } catch (error) {
      logger.error('Process event reminders error', error);
    }
  }

  private async sendEventReminder(
    event: CalendarEventDocument, 
    reminder: { type: string; minutes: number }
  ): Promise<void> {
    try {
      const timeUntilEvent = Math.round((event.start.getTime() - Date.now()) / (1000 * 60));
      const subject = `Rappel: ${event.title} dans ${timeUntilEvent} minutes`;
      
      logger.info(`Event reminder: ${subject}`);
      // Dans une vraie application, ici on enverrait les rappels par email/notification
    } catch (error) {
      logger.error('Send event reminder error', error);
    }
  }

  // Generate calendar view data
  async getCalendarView(
    userId: string, 
    start: Date, 
    end: Date, 
    view: 'month' | 'week' | 'day' = 'month'
  ): Promise<{
    events: CalendarEventDocument[];
    summary: {
      totalEvents: number;
      upcomingEvents: number;
      completedEvents: number;
      busyDays: number;
    };
  }> {
    try {
      const events = await CalendarEvent.find({
        $or: [
          { createdBy: userId },
          { attendees: userId }
        ],
        start: { $lte: end },
        end: { $gte: start }
      }).sort({ start: 1 });
      
      const now = new Date();
      const summary = {
        totalEvents: events.length,
        upcomingEvents: events.filter((e: any) => e.start > now).length,
        completedEvents: events.filter((e: any) => e.end < now).length,
        busyDays: new Set(events.map((e: any) => e.start.toDateString())).size
      };

      return { events, summary };
    } catch (error) {
      logger.error('Get calendar view error', error);
      throw error;
    }
  }
}

export const searchService = new SearchService();
export const calendarService = new CalendarService();

