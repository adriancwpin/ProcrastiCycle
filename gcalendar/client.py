from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from datetime import datetime, timedelta
from gcalendar.auth import calendarAuth

class client:
    def  __init__(self):
        self.auth = calendarAuth()
        self.service = None
        
    
    def get_service(self):
        #Create or get calendar API service
        if not self.service:
            creds = self.auth.load_credentials()
            if not creds:
                return None
            
            try:
                self.service = build('calendar', 'v3', credentials=creds)
            except Exception as e:
                print(f"Failed to build service: {str(e)}")
                return None
            
        return self.service
    
    def is_authenticated(self):
        return self.auth.is_authenticated()
    
    def get_upcoming_events(self, max_results = 10, hours_ahead = 24):
        #Get upcoming events for the next N hours
        try:
            service = self.get_service()
            if not service:
                return{"error": "Not Authenticated"}
            
            now = datetime.utcnow().isoformat() + 'Z'
            end_time = (datetime.utcnow() + timedelta(hours = hours_ahead)).isoformat() + 'Z' #'Z' tells its UTC time 

            events_result = service.events().list(
                calendarId = 'primary', #fetch the user's main event
                timeMin = now,
                timeMax = end_time,
                maxResults = max_results,
                singleEvent = True,
                orderBy = 'startTime'
            ).execute()

            events = events_result.get('item', [])

            return{
                "status": "success",
                "events": self._format_events(events),
                "count": len(events)
            }
        except HttpError as e:
            return{"error": f"Calendar API error: {str(e)}"}
        except Exception as e:
            return {"error": f"Failed to fetch events: {str(e)}"}
    
    def get_today_event(self):
        try:
            service = self.get_service()
            if not service:
                return{"error": "Not Authenticated"}
            
            today = datetime.now().replace(hour = 0 , minute = 0 , second = 0, microsecond = 0)
            tomorrow = today + timedelta(days = 1)

            event_result = service.events().list(
                calendarId='primary',
                timeMin=today.isoformat() + 'Z',
                timeMax=tomorrow.isoformat() + 'Z',
                singleEvents=True,
                orderBy='startTime'
            ).execute()

            events =  events_result.get('items', [])

            return {
                "status": "success",
                 "events": self._format_events(events),
                "count": len(events)
            }
        
        except Exception as e:
            return {"error": f"Failed to fetch today's events: {str(e)}"}
    

    def get_next_event(self):
        try:
            service = self.get_service()
            if not service:
                return{"error" : "Not authenticated"}
            
            now = datetime.utcnow().isoformat() + 'Z'

            events_result = service.events().list(
                calendarId='primary',
                timeMin=now,
                maxResults=1,
                singleEvents=True,
                orderBy='startTime'
            ).execute()

            events = events_result.get('items', [])

            if not events:
                return{
                    "status": "success",
                    "event": None,
                    "message": "No upcoming events"
                }
            event = events[0]
            start = event['start'].get('dateTime', event['start'].get('date'))
            minutes_until = self.calculate_minutes_until(start)

            return {
                "status": "success",
                "event": self._format_event(event),
                "minutes_until": minutes_until
            }
        
        except Exception as e:
            return {"error": f"Failed to fetch next event: {str(e)}"}
    
    def calculate_minutes_until(self, event_time):
        try:
            if 'T' in event_time:#Date time format
                event_dt = datetime.fromisoformat(event_time.replace('Z', '+00:00'))
            else:  # Date format (all-day event)
                event_dt = datetime.fromisoformat(event_time)
            
            now = datetime.utcnow()
            if event_dt.tzinfo:
                from datetime import timezone
                now = now.replace(tzinfo=timezone.utc)
            
            delta = event_dt - now
            return int(delta.total_seconds() / 60)
        
        except Exception as e:
            print(f"Error calculating time: {str(e)}")
            return None
    
    def format_events(self, events):
        #format events for consistent output
        formatted = []
        for event in events:
            formatted.append(self.format_event(event))
        return formatted
    
    def format_event(self, event):
        #format a single event
        start = event['start'].get('dateTime', event['start'].get('date'))
        end = event['end'].get('dateTime', event['end'].get('date'))

        return{
            "id" : event.get('id'),
            "summary" : event.get('summary', 'No Title'),
            "description" : event.get('description', ''),
            "start" : start,
            "end" : end,
            "location": event.get('location', ''),
            "is_all_day": 'date' in event['start']
        }
      
        



        


