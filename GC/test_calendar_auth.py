# test_calendar_auth.py
"""
Interactive test for Google Calendar API integration.
Run this file: python test_calendar_auth.py
"""

import os
from GC.auth import calendarAuth
from GC.client import calendarClient

# Allow OAuth on localhost (HTTP instead of HTTPS)
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'


def print_section(title):
    print("\n" + "=" * 70)
    print(f"🔹 {title}")
    print("=" * 70)


def main():
    print("🔮 === Google Calendar Auth + Client Test ===")

    # Step 1: Authenticate user
    print_section("Step 1: Google Authentication Flow")
    auth = calendarAuth()

    if not os.path.exists("credentials.json"):
        print("❌ credentials.json not found — please add your Google OAuth credentials.")
        return

    if not auth.is_authenticated():
        print("You are not authenticated yet.")
        auth_info = auth.get_auth_url()

        if "error" in auth_info:
            print(f"❌ Error generating auth URL: {auth_info['error']}")
            return

        print("✅ Open this link in your browser to authenticate:")
        print(auth_info["auth_url"])
        print("\nAfter granting access, Google will redirect you to a URL like:")
        print("👉 http://localhost:8000/api/calendar/callback?code=XXXX&scope=...")

        authorization_response = input("\nPaste the entire redirect URL here:\n> ").strip()

        print("\n[2] Exchanging code for tokens...")
        result = auth.handle_callback(authorization_response)
        print(result)

        if result.get("status") != "success":
            print("❌ Authentication failed.")
            return

        print("✅ Credentials saved successfully!")
    else:
        print("✅ Already authenticated!")

    # Step 2: Create client and verify API access
    print_section("Step 2: Testing Calendar Client Functions")
    client = calendarClient()

    if not client.is_authenticated():
        print("❌ Client not authenticated. Check your token.json.")
        return
    else:
        print("🔓 Authenticated successfully with Calendar API!")

    # Test: Fetch next event
    print_section("Testing: get_next_event()")
    next_event_result = client.get_next_event()
    if "error" in next_event_result:
        print(f"❌ Error: {next_event_result['error']}")
    else:
        event = next_event_result.get("event")
        if event:
            print(f"✅ Next event: {event['summary']}")
            print(f"   Starts at: {event['start']}")
            minutes = next_event_result.get('minutes_until')
            if minutes is not None:
                print(f"   In {minutes} minutes")
        else:
            print("ℹ️  No upcoming events found")

    # Test: Fetch today's events
    print_section("Testing: get_todays_events()")
    today_result = client.get_todays_events()
    if "error" in today_result:
        print(f"❌ Error: {today_result['error']}")
    else:
        count = today_result.get("count", 0)
        print(f"✅ Found {count} events today")
        for ev in today_result["events"]:
            print(f"   • {ev['summary']} ({ev['start']})")

    # Test: Fetch upcoming events (next 48 hours)
    print_section("Testing: get_upcoming_events()")
    upcoming_result = client.get_upcoming_events(max_results=5, hours_ahead=48)
    if "error" in upcoming_result:
        print(f"❌ Error: {upcoming_result['error']}")
    else:
        count = upcoming_result.get("count", 0)
        print(f"✅ Found {count} upcoming events")
        for i, ev in enumerate(upcoming_result["events"], 1):
            print(f"{i}. {ev['summary']} | Start: {ev['start']}")

    print_section("✅ All tests complete!")
    print("If you see event details above, your Calendar API integration works perfectly! 🎉")


if __name__ == "__main__":
    main()