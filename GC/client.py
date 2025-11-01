from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from datetime import datetime, timedelta, timezone
from .auth import calendarAuth

class calendarClient:
    def __init__(self):
        self.auth = calendarAuth()
        self.service = None

    def get_service(self):
        """Create or get Google Calendar API service."""
        if not self.service:
            creds = self.auth.load_credentials()
            if not creds:
                print("[DEBUG] No valid credentials loaded.")
                return None
            try:
                self.service = build('calendar', 'v3', credentials=creds)
                print("[DEBUG] Calendar API service built successfully.")
            except Exception as e:
                print(f"Failed to build service: {str(e)}")
                return None
        return self.service

    def is_authenticated(self):
        return self.auth.is_authenticated()

    def get_upcoming_events(self, max_results=10, hours_ahead=24):
        """Fetch upcoming events within the next N hours."""
        try:
            service = self.get_service()
            if not service:
                return {"error": "Not Authenticated"}

            # ✅ FIXED: Use timezone-aware datetime
            now = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
            end_time = (datetime.now(timezone.utc) + timedelta(hours=hours_ahead)).isoformat().replace('+00:00', 'Z')

            events_result = service.events().list(
                calendarId='primary',
                timeMin=now,
                timeMax=end_time,
                maxResults=max_results,
                singleEvents=True,
                orderBy='startTime'
            ).execute()

            events = events_result.get('items', [])
            return {
                "status": "success",
                "events": self.format_events(events),
                "count": len(events)
            }

        except HttpError as e:
            return {"error": f"Calendar API error: {str(e)}"}
        except Exception as e:
            return {"error": f"Failed to fetch events: {str(e)}"}

    def get_todays_events(self):
        """Fetch all events happening today."""
        try:
            service = self.get_service()
            if not service:
                return {"error": "Not Authenticated"}

            # ✅ FIXED: Use timezone-aware datetime
            today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
            tomorrow = today + timedelta(days=1)

            events_result = service.events().list(
                calendarId='primary',
                timeMin=today.isoformat().replace('+00:00', 'Z'),
                timeMax=tomorrow.isoformat().replace('+00:00', 'Z'),
                singleEvents=True,
                orderBy='startTime'
            ).execute()

            events = events_result.get('items', [])
            return {
                "status": "success",
                "events": self.format_events(events),
                "count": len(events)
            }

        except Exception as e:
            return {"error": f"Failed to fetch today's events: {str(e)}"}

    def get_next_event(self):
        """Fetch the user's very next calendar event."""
        try:
            service = self.get_service()
            if not service:
                return {"error": "Not authenticated"}

            # ✅ FIXED: Use timezone-aware datetime
            now = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
            
            events_result = service.events().list(
                calendarId='primary',
                timeMin=now,
                maxResults=1,
                singleEvents=True,
                orderBy='startTime'
            ).execute()

            events = events_result.get('items', [])
            if not events:
                return {"status": "success", "event": None, "message": "No upcoming events"}

            event = events[0]
            start = event['start'].get('dateTime', event['start'].get('date'))
            minutes_until = self.calculate_minutes_until(start)

            return {
                "status": "success",
                "event": self.format_event(event),
                "minutes_until": minutes_until
            }

        except Exception as e:
            return {"error": f"Failed to fetch next event: {str(e)}"}

    def calculate_minutes_until(self, event_time):
        """Calculate minutes until an event starts."""
        try:
            if 'T' in event_time:  # DateTime format
                event_dt = datetime.fromisoformat(event_time.replace('Z', '+00:00'))
            else:  # All-day event
                event_dt = datetime.fromisoformat(event_time)

            # ✅ FIXED: Use timezone-aware datetime
            now = datetime.now(timezone.utc)
            
            delta = event_dt - now
            return int(delta.total_seconds() / 60)
        except Exception as e:
            print(f"Error calculating time: {str(e)}")
            return None

    def format_events(self, events):
        """Format multiple events."""
        return [self.format_event(e) for e in events]

    def format_event(self, event):
        """Format a single event into a consistent dictionary."""
        start = event['start'].get('dateTime', event['start'].get('date'))
        end = event['end'].get('dateTime', event['end'].get('date'))
        return {
            "id": event.get('id'),
            "summary": event.get('summary', 'No Title'),
            "description": event.get('description', ''),
            "start": start,
            "end": end,
            "location": event.get('location', ''),
            "is_all_day": 'date' in event['start']
        }