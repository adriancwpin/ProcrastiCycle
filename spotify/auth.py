from dotenv import load_dotenv
import os
import base64
from requests import post, get
from urllib.parse import urlencode
import json
import webbrowser

load_dotenv()

client_id = os.getenv("SPOTIFY_CLIENT_ID")
client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
redirect_uri = "http://127.0.0.1:8888/callback"

# Define what permissions you're requesting
scopes = "user-read-playback-state user-read-currently-playing"

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
    return {"Authorization" : "Bearer " + token}

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
    
def get_audio_features(token, id="4qG7hWhljsqqENL5PaLA2z"):
    url = "https://api.spotify.com/v1/audio-features/" + id
    headers = get_auth_header(token)
    result = get(url, headers=headers)

    if result.status_code == 200:
        json_result = json.loads(result.content)
        return json_result
    else:
        print(f"Error {result.status_code}: {result.content}")
        return None
    
def get_client_token():
    """Get token using Client Credentials (for public data like audio features)"""
    auth_string = client_id + ":" + client_secret
    auth_bytes = auth_string.encode("utf-8")
    auth_base64 = str(base64.b64encode(auth_bytes), "utf-8")

    url = "https://accounts.spotify.com/api/token"
    headers = {
        "Authorization": "Basic " + auth_base64,
        "Content-Type": "application/x-www-form-urlencoded"
    }

    data = {"grant_type": "client_credentials"}
    result = post(url, headers=headers, data=data)
    json_result = json.loads(result.content)
    
    if "access_token" in json_result:
        return json_result["access_token"]
    else:
        print("Error:", json_result)
        return None
    


# Step 1: Get authorization URL
auth_url = get_auth_url()
print("Please visit this URL to authorize the app:")
print(auth_url)
webbrowser.open(auth_url)  # Opens browser automatically

# Step 2: User will be redirected to redirect_uri with a code parameter
print("\nAfter authorizing, copy the 'code' parameter from the URL")
print("Example: http://localhost:8888/callback?code=XXXXXXXX")
auth_code = input("\nPaste the authorization code here: ")

# Step 3: Exchange code for access token
token = get_token_from_code(auth_code)


if token:
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


        # Debug: Print the full track object to see what's there
        print(f"\nDEBUG - Track object keys: {track.keys()}")

        # Get client credentials token for audio features
        client_token = get_client_token()

        music_id = get_audio_features(client_token, track['id'])
        if client_token:
            print(f"\nClient token: {client_token[:20]}...")
            print(f"Trying to get features for track ID: {track['id']}")
            music_features = get_audio_features(client_token, track['id'])
            
            if music_features:
                print(f"\n--- Audio Features ---")
                print(f"Energy: {music_features['energy']}")
                print(f"Danceability: {music_features['danceability']}")
                print(f"Valence (happiness): {music_features['valence']}")
                print(f"Tempo: {music_features['tempo']} BPM")
                print(f"Acousticness: {music_features['acousticness']}")
                print(f"Instrumentalness: {music_features['instrumentalness']}")
    else:
        print("No track currently playing")
    
    # Test: Get queue
    print("\n--- Queue ---")
    queue = get_current_queue(token)
    if queue and "queue" in queue:
        print(f"Number of tracks in queue: {len(queue['queue'])}")
        for i, track in enumerate(queue["queue"][:10], 1):  # Show first 5
            print(f"{i}. {track['name']} - {track['artists'][0]['name']}")