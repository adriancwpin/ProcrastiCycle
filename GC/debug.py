# debug_events.py
"""
Comprehensive debug script to find out why events aren't showing
"""
from GC.client import calendarClient
from datetime import datetime, timezone, timedelta

print("🔍 COMPREHENSIVE EVENT DEBUG")
print("="*70)

# Step 1: Check authentication
print("\n1️⃣ AUTHENTICATION CHECK")
client = calendarClient()

if not client.is_authenticated():
    print("❌ Not authenticated!")
    print("Run: python test_calendar_auth.py")
    exit()
else:
    print("✅ Authenticated")

# Step 2: Check current time
print("\n2️⃣ CURRENT TIME CHECK")
now_utc = datetime.now(timezone.utc)
print(f"Current UTC time: {now_utc}")
print(f"ISO format: {now_utc.isoformat()}")

# Step 3: Try getting service
print("\n3️⃣ SERVICE CHECK")
service = client.get_service()
if not service:
    print("❌ Failed to get service")
    exit()
else:
    print("✅ Service created")

# Step 4: Get calendar list (which calendar are we searching?)
print("\n4️⃣ CALENDAR LIST")
try:
    calendar_list = service.calendarList().list().execute()
    calendars = calendar_list.get('items', [])
    print(f"Found {len(calendars)} calendars:")
    for cal in calendars[:5]:  # Show first 5
        is_primary = '⭐ PRIMARY' if cal.get('primary') else ''
        print(f"  • {cal.get('summary')} {is_primary}")
        print(f"    ID: {cal['id']}")
except Exception as e:
    print(f"❌ Error listing calendars: {e}")

# Step 5: Search with VERY wide time window
print("\n5️⃣ WIDE SEARCH (Past 1 year + Future 1 year)")
try:
    start_time = (now_utc - timedelta(days=365)).isoformat()
    end_time = (now_utc + timedelta(days=365)).isoformat()
    
    print(f"From: {start_time}")
    print(f"To:   {end_time}")
    
    events_result = service.events().list(
        calendarId='primary',
        timeMin=start_time,
        timeMax=end_time,
        maxResults=50,
        singleEvents=True,
        orderBy='startTime'
    ).execute()
    
    all_events = events_result.get('items', [])
    print(f"\n✅ Found {len(all_events)} total events in 2-year window")
    
    if len(all_events) > 0:
        print("\n📅 All Events Found:")
        for i, event in enumerate(all_events[:10], 1):  # Show first 10
            start = event['start'].get('dateTime', event['start'].get('date'))
            print(f"{i}. {event.get('summary', 'No Title')}")
            print(f"   Start: {start}")
        
        if len(all_events) > 10:
            print(f"   ... and {len(all_events) - 10} more events")
    else:
        print("❌ No events found in entire 2-year window!")
        print("\nPossible reasons:")
        print("  1. Events are on a different calendar (not 'primary')")
        print("  2. Calendar is empty")
        print("  3. Wrong Google account authenticated")
        
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

# Step 6: Categorize events by time
print("\n6️⃣ EVENT TIMELINE ANALYSIS")
if len(all_events) > 0:
    past_events = []
    upcoming_events = []
    
    for event in all_events:
        start_str = event['start'].get('dateTime', event['start'].get('date'))
        
        # Parse start time
        try:
            if 'T' in start_str:
                event_time = datetime.fromisoformat(start_str.replace('Z', '+00:00'))
            else:
                event_time = datetime.fromisoformat(start_str).replace(tzinfo=timezone.utc)
            
            if event_time < now_utc:
                past_events.append(event)
            else:
                upcoming_events.append(event)
        except:
            pass
    
    print(f"Past events:     {len(past_events)}")
    print(f"Upcoming events: {len(upcoming_events)}")
    
    if upcoming_events:
        print("\n🔜 UPCOMING EVENTS:")
        for event in upcoming_events[:5]:
            start = event['start'].get('dateTime', event['start'].get('date'))
            print(f"  • {event.get('summary')} - {start}")
    else:
        print("\n⚠️  All events are in the PAST!")
        print("Your calendar screenshot shows events from 2024.")
        print("Today is November 2025.")
        print("\n💡 Solution: Add new events for November 2025")

# Step 7: Test the actual function
print("\n7️⃣ TESTING get_upcoming_events() FUNCTION")
print("Searching next 30 days...")
result = client.get_upcoming_events(max_results=10, hours_ahead=720)

if "error" in result:
    print(f"❌ Error: {result['error']}")
else:
    print(f"✅ Function returned {result['count']} events")
    if result['count'] > 0:
        for event in result['events']:
            print(f"  • {event['summary']} - {event['start']}")

print("\n" + "="*70)
print("🏁 DEBUG COMPLETE")