import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import datetime
import webbrowser
from flask import Flask, jsonify, request
from flask_cors import CORS
from spotify import auth
from GC.auth import calendarAuth
from GC.client import calendarClient
import google.generativeai as genai
import requests

app = Flask(__name__)
CORS(app)

auth_storage = {}

genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

def analyze_tabs_with_gemini(urls: list) -> float:
    """
    Analyze productivity of tab URLs using Gemini.
    Returns average score between 0 and 1.
    """
    if not os.getenv("GOOGLE_API_KEY"):
        print("⚠️ No Gemini API key, returning default score")
        return 0.5
    
    try:
        # Format URLs as a list
        urls_text = "\n".join([f"- {url}" for url in urls])
        
        prompt = f"""Analyze these browser tabs and rate overall productivity from 0.0 to 1.0.

Tabs:
{urls_text}

Scoring:
- 0.0 = Completely unproductive (games, entertainment, social media)
- 0.5 = Neutral (news, email, general browsing)
- 1.0 = Highly productive (work tools, documentation, coding, learning)

Return ONLY a single number between 0.0 and 1.0, nothing else.
Example: 0.73"""

        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        response = model.generate_content(prompt)
        
        # Extract the number
        response_text = response.text.strip()
        
        # Try to parse as float
        try:
            score = float(response_text)
        except ValueError:
            # Find first number in response
            numbers = re.findall(r'0?\.\d+|1\.0|0|1', response_text)
            if numbers:
                score = float(numbers[0])
            else:
                print(f"⚠️ Could not parse score from: {response_text}")
                return 0.5
        
        # Ensure it's within bounds
        score = max(0.0, min(1.0, score))
        
        print(f"✅ Productivity score: {score}")
        return score
        
    except Exception as e:
        print(f"❌ Gemini error: {e}")
        return 0.5


@app.route('/open_spotify', methods=['GET'])
def start_auth():
    auth_url = auth.get_auth_url()
    webbrowser.open(auth_url)

    return jsonify({"message": "Opened Spotify auth URL", "url": auth_url})


@app.route('/callback', methods=['GET'])
def callback():
    code = request.args.get('code')
    error = request.args.get('error')
    
    if error:
        return f"""
        <html>
            <body style="text-align: center; padding: 50px; font-family: Arial;">
                <h1>❌ Error</h1>
                <p>{error}</p>
                <p>You can close this tab.</p>
            </body>
        </html>
        """, 400
    
    if not code:
        return "<h1>No code received</h1>", 400
    
    # Exchange code for token using your functions
    token = auth.get_token_from_code(code)
    
    if token:
        # Store token temporarily
        auth_storage['token'] = token
        auth_storage['ready'] = True
        
        try:
            # Get currently playing
            print("\n--- Currently Playing ---")
            currently_playing = auth.get_currently_playing(token)
            
            if currently_playing and "item" in currently_playing:
                track = currently_playing["item"]
                print(f"Track: {track['name']}")
                print(f"Artist: {track['artists'][0]['name']}")
                print(f"ID: {track['id']}")
                
            else:
                print("No track currently playing")
            
            # Get queue
            print("\n--- Queue ---")
            queue = auth.get_current_queue(token)
            if queue and "queue" in queue:
                print(f"Number of tracks in queue: {len(queue['queue'])}")
                for i, track in enumerate(queue["queue"][:10], 1):  # Show first 10
                    print(f"{i}. {track['name']} - {track['artists'][0]['name']}")
            else:
                print("No queue data available")
                
        except Exception as e:
            print(f"\n❌ Error calling Spotify functions: {e}")
        
        return """
        <html>
            <body style="text-align: center; padding: 50px; font-family: Arial;">
                <h1>✅ Success!</h1>
                <p>Authentication complete. You can close this tab.</p>
            </body>
        </html>
        """
    else:
        return "<h1>Failed to get token</h1>", 400


    
@app.route('/get_track_info', methods=['GET'])
def get_track_info():
    """
    API endpoint to check if Spotify is authorized and get current track info.
    Frontend uses this to check if authorization is complete.
    """
    # Check if we have a token
    if 'token' not in auth_storage:
        return jsonify({"error": "Not authenticated"}), 401
    
    token = auth_storage['token']
    
    try:
        # Get currently playing track
        currently_playing = auth.get_currently_playing(token)
        
        if currently_playing and "item" in currently_playing:
            track = currently_playing["item"]
            
            # Get AI-generated audio features
            music_features = auth.analyze_track_with_gemini(
                track['name'], 
                track['artists'][0]['name']
            )
            
            # Return track info and features
            return jsonify({
                "authenticated": True,
                "track": {
                    "name": track['name'],
                    "artist": track['artists'][0]['name'],
                    "id": track['id'],
                    "album": track['album']['name'] if 'album' in track else None,
                },
                "features": music_features
            }), 200
        else:
            # No track playing, but still authenticated
            return jsonify({
                "authenticated": True,
                "track": None,
                "message": "No track currently playing"
            }), 200
            
    except Exception as e:
        print(f"Error in get_track_info: {e}")
        return jsonify({
            "error": str(e),
            "authenticated": False
        }), 500
    
@app.route('/get_music_features', methods=['GET'])
def get_music_features():
    if 'token' not in auth_storage:
        return jsonify({"error": "Not authenticated"}), 401
    
    token = auth_storage['token']

    try: 
        currently_playing = auth.get_currently_playing(token)

        if currently_playing and "item" in currently_playing:
            track = currently_playing["item"]

            music_features = auth.analyze_track_with_gemini(
                track['name'], 
                track['artists'][0]['name']
            )

            if music_features:
                # Return ONLY the requested features
                return jsonify({
                    "success": True,
                    "track_name": track['name'],
                    "artist": track['artists'][0]['name'],
                    "features": {
                        "danceability": music_features.get('danceability', 0),
                        "tempo": music_features.get('tempo', 0),
                        "energy": music_features.get('energy', 0)
                    }
                }), 200
            else:
                return jsonify({
                    "success": False,
                    "error": "Could not generate music features"
                }), 500
        else:
            return jsonify({
                "success": False,
                "error": "No track currently playing"
            }), 404
            
    except Exception as e:
        print(f"Error in get_music_features: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500
    
@app.route('/get_active_tabs', methods=['POST'])
def get_active_tabs():
    """Analyze tab productivity"""
    try:
        data = request.get_json()
        
        if not data or 'urls' not in data:
            return jsonify({'success': False, 'error': 'No URLs provided'}), 400
        
        urls = [url for url in data['urls'] if url and isinstance(url, str)]
        
        if not urls:
            return jsonify({'success': False, 'error': 'No valid URLs'}), 400
        
        print(f"\n📊 Analyzing {len(urls)} tabs...")
        
        # Get score from Gemini
        score = analyze_tabs_with_gemini(urls)
        
        print(f"   Score: {score} ({(score * 100):.0f}% productive)\n")
        
        return jsonify({
            'success': True,
            'average_score': score,
            'urls_count': len(urls),
            'timestamp': datetime.datetime.now().isoformat()
        }), 200
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    
@app.route('/check_calendar_auth', methods=['GET'])
def check_calendar_auth():
    """
    Frontend endpoint: checks if Google Calendar is authenticated.
    Returns 200 if valid token, 401 if missing/invalid.
    """
    try:
        token_path = calendar_auth.token 

        if not os.path.exists(token_path):
            return jsonify({
                "authenticated": False,
                "message": "No calendar token found"
            }), 401

        if calendar_auth.is_authenticated():
            return jsonify({
                "authenticated": True,
                "message": "Google Calendar connected"
            }), 200
        else:
            return jsonify({
                "authenticated": False,
                "message": "Token invalid or expired"
            }), 401

    except Exception as e:
        print(f"❌ Error checking calendar auth: {e}")
        return jsonify({
            "authenticated": False,
            "error": str(e)
        }), 500
#=======================================================================================================================================
#GOOGLE CALENDAR ROUTE
#=======================================================================================================================================
#initialize calendar path
calendar_auth = calendarAuth()
calendar_client = calendarClient()

@app.route('/open_calendar', methods = ['GET'])
def start_calendar_auth():
    result = calendar_auth.get_auth_url()

    if "error" in result:
        return jsonify(result), 400
    
    #Open auth URL in browser
    webbrowser.open(result['auth_url'])

    return jsonify({
        "message" : "Opened Google Calendar auth URL",
        "url": result['auth_url']
    })

@app.route('/calendar/callback', methods = ['GET'])
def calendar_callback():
    #Get full callback  URL
    authorization_response = request.url

    #Verify state
    code = request.args.get('code')
    error = request.args.get('error')  

    if error:
        return f"""
        <html>
            <body style = "text-align: center;  padding: 50px; font-family: Arial;">
                <h1> ❌ Calendar Error</h1>
                <p>{error}</p>
                <p>You can close this tab.</p>
            </body>
        </html>
        """, 400
    
    if not code:
        return "<h1>No code received</h1>", 400
    
    #Exchange code for credentials
    result = calendar_auth.handle_callback(authorization_response)

    if result.get("status") == "success":
        auth_storage['calendar_ready'] = True

        try:
            print("\n📅 --- Google Calendar Events ---")

            #Get new event
            next_event_result = calendar_client.get_next_event()

            if next_event_result.get("event"):
                event = next_event_result["event"]
                minutes = next_event_result.get("minutes_until")
                print(f"Next event: {event['summary']}")
                print(f"Starts in: {minutes} minutes")
            else:
                print("No upcoming events")
            
            # Get today's events
            today_result = calendar_client.get_todays_events()
            if today_result.get("status") == "success":
                print(f"Events today: {today_result['count']}")
                for ev in today_result['events'][:5]:  # Show first 5
                    print(f"  • {ev['summary']} at {ev['start']}")
        except Exception as e:
            print(f"❌ Error with Calendar: {e}")
        
        return """
        <html>
            <body style="text-align: center; padding: 50px; font-family: Arial;">
                <h1>✅ Calendar Connected!</h1>
                <p>Authentication complete. You can close this tab.</p>
            </body>
        </html>
        """
    else:
        return f"""
        <html>
            <body style="text-align: center; padding: 50px; font-family: Arial;">
                <h1>❌ Failed to Connect Calendar</h1>
                <p>{result.get('message', 'Unknown error')}</p>
            </body>
        </html>
        """, 400   

@app.route('/get_calendar_analysis', methods=['GET'])
def get_calendar_analysis():
    """Get calendar schedule analysis for procrastination detection"""
    if not calendar_client.is_authenticated():
        return jsonify({"error": "Not authenticated"}), 401
    
    try:
        # Get day schedule analysis
        day_analysis = calendar_client.get_day_schedule_analysis()
        
        if day_analysis.get("status") == "success":
            # Get next event
            next_event = calendar_client.get_next_event()
            
            # Build response
            response = {
                "success": True,
                "date": day_analysis['date'],
                "schedule": {
                    "total_events": day_analysis['total_events'],
                    "total_hours": day_analysis['total_hours'],
                    "busy_percentage": day_analysis['busy_percentage'],
                    "free_hours": day_analysis['free_time_hours'],
                    "breakdown": day_analysis['breakdown']
                }
            }
            
            # Add next event if exists
            if next_event.get("event"):
                response["next_event"] = {
                    "summary": next_event["event"]["summary"],
                    "start": next_event["event"]["start"],
                    "minutes_until": next_event.get("minutes_until")
                }
            else:
                response["next_event"] = None
            
            return jsonify(response), 200
        else:
            return jsonify({
                "success": False,
                "error": day_analysis.get("error", "Failed to analyze schedule")
            }), 500
            
    except Exception as e:
        print(f"Error in get_calendar_analysis: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/get_next_event', methods=['GET'])
def get_next_event_route():
    """Get only the next upcoming event"""
    if not calendar_client.is_authenticated():
        return jsonify({"error": "Not authenticated"}), 401
    
    try:
        next_event_result = calendar_client.get_next_event()
        
        if next_event_result.get("event"):
            event = next_event_result["event"]
            return jsonify({
                "success": True,
                "event": {
                    "summary": event["summary"],
                    "start": event["start"],
                    "end": event["end"],
                    "location": event.get("location", ""),
                    "is_all_day": event["is_all_day"]
                },
                "minutes_until": next_event_result.get("minutes_until")
            }), 200
        else:
            return jsonify({
                "success": False,
                "message": "No upcoming events"
            }), 404
            
    except Exception as e:
        print(f"Error in get_next_event: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/get_today_schedule', methods=['GET'])
def get_today_schedule():
    """Get simplified today's schedule"""
    if not calendar_client.is_authenticated():
        return jsonify({"error": "Not authenticated"}), 401
    
    try:
        today_result = calendar_client.get_todays_events()
        
        if today_result.get("status") == "success":
            return jsonify({
                "success": True,
                "count": today_result["count"],
                "events": [
                    {
                        "summary": ev["summary"],
                        "start": ev["start"],
                        "is_all_day": ev["is_all_day"]
                    }
                    for ev in today_result["events"]
                ]
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": today_result.get("error", "Failed to fetch events")
            }), 500
            
    except Exception as e:
        print(f"Error in get_today_schedule: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/check_calendar_status', methods=['GET'])
def check_calendar_status():
    """Check if calendar is connected (like checking Spotify auth)"""
    is_connected = calendar_client.is_authenticated()
    
    return jsonify({
        "success": True,
        "connected": is_connected,
        "message": "Calendar connected" if is_connected else "Calendar not connected"
    }), 200    


if __name__ == '__main__':
    print("Starting Flask server on http://127.0.0.1:8888")
    app.run(host='127.0.0.1', port=8888, debug=True)