# test_calendar.py
"""
Test script to verify Google Calendar integration works
Run this with: python test_calendar.py
"""

from GC.auth import calendarAuth
from GC.client import calendarClient
import os

def print_separator():
    print("\n" + "="*60 + "\n")

def test_imports():
    """Test 0: Check if modules can be imported"""
    print("📦 TEST 0: Module Imports")
    print_separator()
    
    try:
        from GC import calendarAuth, calendarClient
        print("✅ CalendarAuth imported successfully")
        print("✅ CalendarClient imported successfully")
        return True
    except ImportError as e:
        print(f"❌ Import error: {str(e)}")
        return False

def test_auth_module():
    """Test 1: Check if auth module works"""
    print("🔐 TEST 1: Auth Module")
    print_separator()
    
    try:
        auth = calendarAuth()
        print("✅ CalendarAuth class instantiated successfully")
        
        # Check if credentials.json exists
        if os.path.exists('credentials.json'):
            print("✅ credentials.json found")
        else:
            print("❌ credentials.json NOT found")
            print("   → Download from Google Cloud Console")
            print("   → Place in project root directory")
            return False
        
        # Try to generate auth URL
        result = auth.get_auth_url()
        if "error" in result:
            print(f"❌ Error generating auth URL: {result['error']}")
            return False
        else:
            print("✅ Auth URL generated successfully")
            print(f"   Auth URL: {result['auth_url'][:80]}...")
            print(f"   State token: {result['state'][:20]}...")
        
        # Check if already authenticated
        if auth.is_authenticated():
            print("✅ Already authenticated (token.json exists and is valid)")
            
            # Try loading credentials
            creds = auth.load_credentials()
            if creds:
                print("✅ Credentials loaded successfully")
                print(f"   Token valid: {creds.valid}")
                print(f"   Has refresh token: {creds.refresh_token is not None}")
            else:
                print("⚠️  Could not load credentials")
        else:
            print("⚠️  Not authenticated yet")
            if os.path.exists('token.json'):
                print("   → token.json exists but may be invalid/expired")
            else:
                print("   → token.json not found")
            print("   → To connect:")
            print("      1. Run: python app.py")
            print("      2. Visit: http://localhost:5000/connect/calendar")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_client_module():
    """Test 2: Check if client module works"""
    print("📅 TEST 2: Client Module")
    print_separator()
    
    try:
        client = calendarClient()
        print("✅ CalendarClient class instantiated successfully")
        
        if not client.is_authenticated():
            print("❌ Not authenticated")
            print("   → Connect calendar first:")
            print("   → 1. Run: python app.py")
            print("   → 2. Visit: http://localhost:5000/connect/calendar")
            return False
        
        print("✅ User is authenticated!")
        
        # Try to get service
        service = client.get_service()
        if service:
            print("✅ Calendar API service created successfully")
        else:
            print("❌ Failed to create Calendar API service")
            return False
        
        # Try to get upcoming events
        print("\n📋 Fetching upcoming events...")
        result = client.get_upcoming_events(max_results=5, hours_ahead=168)  # Next week
        
        if "error" in result:
            print(f"❌ Error fetching events: {result['error']}")
            return False
        
        events = result.get('events', [])
        count = result.get('count', 0)
        
        print(f"✅ Successfully fetched {count} events")
        
        if count == 0:
            print("\n   ℹ️  No events found in the next week")
            print("   → Add some events to your Google Calendar to test further")
        else:
            print("\n   📋 Events found:")
            for i, event in enumerate(events, 1):
                print(f"\n   {i}. 📌 {event['summary']}")
                print(f"      ⏰ Start: {event['start']}")
                if event['location']:
                    print(f"      📍 Location: {event['location']}")
                if event['is_all_day']:
                    print(f"      🌅 All-day event")
                else:
                    print(f"      ⏱️  Timed event")
                if event['attendees'] > 0:
                    print(f"      👥 Attendees: {event['attendees']}")
        
        # Test get_todays_events
        print("\n📅 Fetching today's events...")
        today_result = client.get_todays_events()
        
        if "error" not in today_result:
            today_count = today_result.get('count', 0)
            print(f"✅ Found {today_count} events today")
            
            if today_count > 0:
                print("   Today's events:")
                for event in today_result['events']:
                    print(f"   • {event['summary']}")
        else:
            print(f"❌ Error: {today_result['error']}")
        
        # Test get_next_event
        print("\n🔜 Getting next upcoming event...")
        next_result = client.get_next_event()
        
        if "error" in next_result:
            print(f"❌ Error: {next_result['error']}")
        elif next_result.get('event'):
            event = next_result['event']
            minutes = next_result.get('minutes_until')
            print(f"✅ Next event: {event['summary']}")
            
            if minutes is not None:
                if minutes < 0:
                    print(f"   ⏰ Started {abs(minutes)} minutes ago")
                elif minutes == 0:
                    print(f"   ⏰ Happening now!")
                elif minutes < 60:
                    print(f"   ⏰ In {minutes} minutes")
                else:
                    hours = minutes // 60
                    mins = minutes % 60
                    print(f"   ⏰ In {hours}h {mins}m")
        else:
            print("   ℹ️  No upcoming events")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_integration():
    """Test 3: Basic integration test"""
    print("🎯 TEST 3: Basic Integration")
    print_separator()
    
    try:
        # Create components
        auth = calendarAuth()
        client = calendarClient()
        
        if not client.is_authenticated():
            print("❌ Cannot run integration test - not authenticated")
            return False
        
        print("Simulating basic ProcrastiCycle workflow...\n")
        
        # Step 1: Check authentication
        print("1️⃣ Checking authentication...")
        if auth.is_authenticated():
            print("   ✅ User is authenticated")
        else:
            print("   ❌ Authentication failed")
            return False
        
        # Step 2: Fetch today's events
        print("\n2️⃣ Fetching today's events...")
        today_result = client.get_todays_events()
        if "error" not in today_result:
            print(f"   ✅ Found {today_result['count']} events today")
        else:
            print(f"   ⚠️  Error: {today_result['error']}")
        
        # Step 3: Get next event
        print("\n3️⃣ Getting next event...")
        next_result = client.get_next_event()
        if next_result.get('event'):
            print(f"   ✅ Next: {next_result['event']['summary']}")
        else:
            print("   ℹ️  No upcoming events")
        
        # Step 4: Get upcoming events
        print("\n4️⃣ Getting upcoming events...")
        upcoming_result = client.get_upcoming_events(max_results=10)
        if "error" not in upcoming_result:
            print(f"   ✅ Found {upcoming_result['count']} upcoming events")
        else:
            print(f"   ⚠️  Error: {upcoming_result['error']}")
        
        print("\n🎉 Basic integration test PASSED!")
        return True
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests"""
    print("\n" + "🔮 PROCRASTICYCLE - CALENDAR INTEGRATION TEST 🔮".center(60))
    print("="*60)
    
    results = []
    
    # Run tests
    results.append(("Module Imports", test_imports()))
    results.append(("Auth Module", test_auth_module()))
    results.append(("Client Module", test_client_module()))
    results.append(("Basic Integration", test_integration()))
    
    # Summary
    print_separator()
    print("📊 TEST SUMMARY")
    print_separator()
    
    passed = 0
    failed = 0
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name:<25} {status}")
        if result:
            passed += 1
        else:
            failed += 1
    
    print_separator()
    print(f"Total: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("\n🎉 All tests passed! Your calendar integration is working! 🎉")
        print("\n✨ Your gcalendar module is ready to use!")
    else:
        print("\n⚠️  Some tests failed. Check the output above for details.")
        
        if not os.path.exists('credentials.json'):
            print("\n💡 NEXT STEP: Download credentials.json")
            print("   1. Go to: https://console.cloud.google.com/")
            print("   2. Create OAuth 2.0 credentials")
            print("   3. Download as 'credentials.json'")
            print("   4. Place in project root")
        
        if not os.path.exists('token.json'):
            print("\n💡 NEXT STEP: Connect your calendar")
            print("   1. Run: python app.py")
            print("   2. Visit: http://localhost:5000/connect/calendar")
            print("   3. Log in with Google and approve")
    
    print_separator()

if __name__ == "__main__":
    main()