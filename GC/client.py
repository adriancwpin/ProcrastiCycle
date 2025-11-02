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
    
    def get_day_schedule_analysis(self, date=None):  # ✅ Fixed: Use : not {
        """
        Get all events for a specific day and calculate total event time
    
        Args:
        date: datetime object (defaults to today if None)
    
        Returns:
        {
            "date": "2025-11-01",
            "events": [...],
            "total_events": 5,
            "total_minutes": 240,
            "total_hours": 4.0,
            "busy_percentage": 16.67,
            "free_time_minutes": 1200,
            "breakdown": {
                "meetings": 3,
                "deadlines": 1,
                "other": 1
            }
        }
    """
        try:
            service = self.get_service()
            if not service:
                return {"error": "Not Authenticated"}
            
            # If no date then use today
            if date is None:
                target_date = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)  # ✅ Fixed typo: target_data
            else:
                target_date = date.replace(hour=0, minute=0, second=0, microsecond=0)
            
            # Get start and end of the day
            day_start = target_date  # ✅ Fixed indentation
            day_end = target_date + timedelta(days=1)
            
            # Fetch all events for this day
            events_result = service.events().list(
                calendarId='primary',
                timeMin=day_start.isoformat().replace('+00:00', 'Z'),
                timeMax=day_end.isoformat().replace('+00:00', 'Z'),
                singleEvents=True,
                orderBy='startTime'
            ).execute()
            
            events = events_result.get('items', [])
            formatted_events = self.format_events(events)
            
            # Calculate total time
            total_minutes = 0
            breakdown = {  # ✅ Added: You removed this variable!
                "meetings": 0,
                "deadlines": 0,
                "other": 0
            }
            
            for event in events:
                # Calculate duration for each event
                start_str = event['start'].get('dateTime', event['start'].get('date'))
                end_str = event['end'].get('dateTime', event['end'].get('date'))
                
                # Skip all-day events for time calculation
                if 'T' not in start_str or 'T' not in end_str:
                    continue
                
                # Parse times
                try:
                    start_time = datetime.fromisoformat(start_str.replace('Z', '+00:00'))
                    end_time = datetime.fromisoformat(end_str.replace('Z', '+00:00'))
                    
                    # Calculate duration in minutes
                    duration = (end_time - start_time).total_seconds() / 60
                    total_minutes += duration
                    
                    # ✅ Added: Categorize event
                    summary = event.get('summary', '').lower()
                    if any(word in summary for word in ['meeting', 'call', 'standup', 'sync']):
                        breakdown['meetings'] += 1
                    elif any(word in summary for word in ['deadline', 'due', 'submit']):
                        breakdown['deadlines'] += 1
                    else:
                        breakdown['other'] += 1
                        
                except Exception as e:
                    print(f"Error calculating duration for event: {e}")
                    continue
            
            # Calculate statistics
            total_hours = total_minutes / 60
            minutes_in_day = 24 * 60
            busy_percentage = (total_minutes / minutes_in_day) * 100 if minutes_in_day > 0 else 0
            free_time_minutes = minutes_in_day - total_minutes
            
            return {
                "status": "success",
                "date": target_date.date().isoformat(),
                "events": formatted_events,
                "total_events": len(events),
                "total_minutes": round(total_minutes, 2),
                "total_hours": round(total_hours, 2),
                "busy_percentage": round(busy_percentage, 2),
                "free_time_minutes": round(free_time_minutes, 2),
                "free_time_hours": round(free_time_minutes / 60, 2),
                "breakdown": breakdown
            }
            
        except Exception as e:
            return {"error": f"Failed to analyze day schedule: {str(e)}"}
        # ✅ Removed: Extra } at the end