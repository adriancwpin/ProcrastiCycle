from dotenv import load_dotenv
import os
import base64
from requests import post, get
from urllib.parse import urlencode
import json
import webbrowser
import google.generativeai as genai

load_dotenv()

genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

client_id = os.getenv("SPOTIFY_CLIENT_ID")
client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
redirect_uri = "http://127.0.0.1:8888/callback"

# Define what permissions you're requesting
scopes = "user-read-playback-state user-read-currently-playing user-read-email"


def analyze_track_with_gemini(track_name, artist_name):
    """Use Gemini to analyze track characteristics"""
    
    prompt = f"""Analyze the song "{track_name}" by {artist_name}.

Provide the following metrics as numbers between 0.0 and 1.0:
- energy: How energetic/intense the song is (0=calm, 1=high energy)
- danceability: How suitable for dancing (0=not danceable, 1=very danceable)
- tempo: Estimated BPM (beats per minute) as a number between 60-200

Return ONLY a valid JSON object with these exact keys, no other text or explanation:
{{"energy": 0.0, "danceability": 0.0, "tempo": 120}}"""

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(prompt)
        
        # Extract JSON from response
        response_text = response.text.strip()
        
        # Remove markdown code blocks if present
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0]
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0]
        
        response_text = response_text.strip()
        
        audio_features = json.loads(response_text)
        return audio_features
    except Exception as e:
        print(f"Error analyzing with Gemini: {e}")
        print(f"Response was: {response.text if 'response' in locals() else 'No response'}")
        return None
    
def list_available_models():
    """List all available Gemini models"""
    print("Available models:")
    for model in genai.list_models():
        if 'generateContent' in model.supported_generation_methods:
            print(f"- {model.name}")

def get_auth_url():
    auth_params = {
        "client_id": client_id,
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "scope": scopes
    }
    auth_url = "https://accounts.spotify.com/authorize?" + urlencode(auth_params)
    return auth_url

def get_token_from_code(auth_code):
    auth_string = client_id + ":" + client_secret
    auth_bytes = auth_string.encode("utf-8")
    auth_base64 = str(base64.b64encode(auth_bytes), "utf-8")

    url = "https://accounts.spotify.com/api/token"
    headers = {
        "Authorization" : "Basic " + auth_base64,
        "Content-Type" : "application/x-www-form-urlencoded"
    }

    data = {
        "grant_type": "authorization_code",
        "code": auth_code,
        "redirect_uri": redirect_uri    
    }
    result = post(url, headers= headers, data= data)
    json_result = json.loads(result.content)
    
    if "access_token" in json_result:
        return json_result["access_token"]
    else:
        print("Error:", json_result)
        return None

def get_auth_header(token):
    return {"Authorization" : f"Bearer {token}"}

def get_current_queue(token):
    url = "https://api.spotify.com/v1/me/player/queue"
    headers = get_auth_header(token)
    result = get(url, headers = headers)
    
    if result.status_code == 200:
        json_result = json.loads(result.content)
        return json_result
    else:
        print(f"Error {result.status_code}: {result.content}")
        return None
    
def get_currently_playing(token):
    url = "https://api.spotify.com/v1/me/player/currently-playing"
    headers = get_auth_header(token)
    result = get(url, headers=headers)

    if result.status_code == 200:
        json_result = json.loads(result.content)
        return json_result
    else:
        print(f"Error {result.status_code}: {result.content}")
        return None
    
def get_client_token():
    import requests, base64

    auth_url = "https://accounts.spotify.com/api/token"
    auth_header = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    headers = {"Authorization": f"Basic {auth_header}"}
    data = {"grant_type": "client_credentials"}

    result = requests.post(auth_url, headers=headers, data=data)
    token = result.json().get("access_token")
    return token


#list_available_models()

# Step 1: Get authorization URL
#auth_url = get_auth_url()
#print("Please visit this URL to authorize the app:")
#print(auth_url)
#webbrowser.open(auth_url)  # Opens browser automatically

# Step 2: User will be redirected to redirect_uri with a code parameter
#print("\nAfter authorizing, copy the 'code' parameter from the URL")
#print("Example: http://localhost:8888/callback?code=XXXXXXXX")
#auth_code = input("\nPaste the authorization code here: ")

# Step 3: Exchange code for access token
#token = get_token_from_code(auth_code)


#if token:
    print("\nAccess Token obtained successfully!")
    print(f"Token: {token[:20]}...")
    
    # Test: Get currently playing
    print("\n--- Currently Playing ---")
    currently_playing = get_currently_playing(token)
    if currently_playing and "item" in currently_playing:
        track = currently_playing["item"]
        print(f"Track: {track['name']}")
        print(f"Artist: {track['artists'][0]['name']}")
        print(f"id: {track['id']}")

     # Use Gemini to analyze the track
        print("\n--- AI-Generated Audio Features (Gemini) ---")
        music_features = analyze_track_with_gemini(track['name'], track['artists'][0]['name'])
        
        if music_features:
            print("✓ Audio features generated by Gemini!")
            print(f"Energy: {music_features['energy']}")
            print(f"Danceability: {music_features['danceability']}")
            print(f"Valence (happiness): {music_features['valence']}")
            print(f"Tempo: {music_features['tempo']} BPM")
            print(f"Acousticness: {music_features['acousticness']}")
            print(f"Instrumentalness: {music_features['instrumentalness']}")
        else:
            print("Could not generate audio features")
    
    # Test: Get queue
    print("\n--- Queue ---")
    queue = get_current_queue(token)
    if queue and "queue" in queue:
        print(f"Number of tracks in queue: {len(queue['queue'])}")
        for i, track in enumerate(queue["queue"][:10], 1):  # Show first 5
            print(f"{i}. {track['name']} - {track['artists'][0]['name']}")