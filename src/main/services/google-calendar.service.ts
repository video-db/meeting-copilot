/**
 * Google Calendar Service
 *
 * Fetches calendar events from Google Calendar API.
 */

import { logger } from '../lib/logger';
import { getValidAccessToken } from './google-auth.service';
import type { CalendarEvent, UpcomingMeeting } from '../../shared/types/calendar.types';

const log = logger.child({ module: 'google-calendar' });

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

// Error types for callers to handle
export class CalendarAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalendarAuthError';
  }
}

export class CalendarApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'CalendarApiError';
  }
}

/**
 * Make an authenticated request to Google Calendar API
 */
async function calendarFetch(endpoint: string): Promise<Response> {
  const token = await getValidAccessToken();
  if (!token) {
    throw new CalendarAuthError('NOT_AUTHENTICATED');
  }

  const url = `${CALENDAR_API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    throw new CalendarAuthError('UNAUTHORIZED');
  }

  if (!response.ok) {
    const errorBody = await response.text();
    log.error({ status: response.status, errorBody }, 'Calendar API request failed');
    throw new CalendarApiError(`Calendar API error: ${response.status} - ${errorBody}`, response.status);
  }

  return response;
}

/**
 * Fetch events from a calendar
 */
async function fetchEvents(options: {
  calendarId?: string;
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
}): Promise<CalendarEvent[]> {
  const {
    calendarId = 'primary',
    timeMin,
    timeMax,
    maxResults = 50,
  } = options;

  const params = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: String(maxResults),
  });

  if (timeMin) params.set('timeMin', timeMin);
  if (timeMax) params.set('timeMax', timeMax);

  const endpoint = `/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
  const response = await calendarFetch(endpoint);
  const data = await response.json() as { items?: CalendarEvent[] };

  return data.items || [];
}

/**
 * Convert CalendarEvent to UpcomingMeeting
 */
function toUpcomingMeeting(event: CalendarEvent): UpcomingMeeting | null {
  const isAllDay = !event.start.dateTime;

  let startTime: Date;
  let endTime: Date;

  if (event.start.dateTime) {
    startTime = new Date(event.start.dateTime);
    endTime = new Date(event.end.dateTime || event.start.dateTime);
  } else if (event.start.date) {
    // All-day event
    startTime = new Date(event.start.date);
    endTime = new Date(event.end.date || event.start.date);
  } else {
    return null;
  }

  const now = Date.now();
  const minutesUntil = Math.ceil((startTime.getTime() - now) / 60_000);

  // Extract meet link from various sources
  let meetLink = event.hangoutLink;
  if (!meetLink && event.conferenceData?.entryPoints) {
    const videoEntry = event.conferenceData.entryPoints.find(e => e.entryPointType === 'video');
    meetLink = videoEntry?.uri;
  }

  return {
    id: event.id,
    summary: event.summary || 'No title',
    startTime,
    endTime,
    minutesUntil,
    meetLink,
    location: event.location,
    htmlLink: event.htmlLink,
    isAllDay,
  };
}

/**
 * Fetch upcoming events within the specified time window
 */
export async function fetchUpcomingEvents(hoursAhead: number = 24): Promise<UpcomingMeeting[]> {
  const now = new Date();
  const later = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  log.debug({ hoursAhead }, 'Fetching upcoming events');

  const events = await fetchEvents({
    timeMin: now.toISOString(),
    timeMax: later.toISOString(),
  });

  const meetings = events
    .map(toUpcomingMeeting)
    .filter((m): m is UpcomingMeeting => m !== null)
    // Filter out cancelled events
    .filter(m => {
      const originalEvent = events.find(e => e.id === m.id);
      return originalEvent?.status !== 'cancelled';
    });

  log.debug({ count: meetings.length }, 'Fetched upcoming meetings');

  return meetings;
}

/**
 * Fetch today's events
 */
export async function fetchTodayEvents(): Promise<UpcomingMeeting[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const events = await fetchEvents({
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
  });

  return events
    .map(toUpcomingMeeting)
    .filter((m): m is UpcomingMeeting => m !== null);
}

/**
 * Get list of calendars the user has access to
 */
export async function fetchCalendarList(): Promise<Array<{ id: string; summary: string; primary?: boolean }>> {
  const response = await calendarFetch('/users/me/calendarList');
  const data = await response.json() as {
    items?: Array<{ id: string; summary: string; primary?: boolean }>;
  };

  return data.items || [];
}
