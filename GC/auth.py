# Handles Google Calendar OAuth authentication

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request
import os
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'
import json


class calendarAuth:
    def __init__(self):
        self.creds = None  # Not logged in yet
        self.credentials = 'credentials.json'
        self.scopes = ['https://www.googleapis.com/auth/calendar.events.readonly']  
        self.token = 'token.json'
        self.redirect_uri = os.getenv('GOOGLE_REDIRECT_URI', 'http://127.0.0.1:8888/calendar/callback')

    def get_auth_url(self):
        """Call when the user clicks 'Connect Calendar'"""
        try:
            # Check if credentials.json exists
            if not os.path.exists(self.credentials):
                return {
                    "error": "credentials.json not found. Please add Google OAuth credentials."
                }
            
            flow = Flow.from_client_secrets_file(
                self.credentials,
                scopes=self.scopes,
                redirect_uri=self.redirect_uri
            )

            authorization_url, state = flow.authorization_url(
                access_type='offline',  # Get refresh token for long-term access
                include_granted_scopes='true',
                prompt='consent'
            )
            
            return {
                "auth_url": authorization_url,
                "state": state
            }
            
        except Exception as e:
            return {"error": f"Failed to generate an authorized URL: {str(e)}"}

    def handle_callback(self, authorization_response):
        """Handle OAuth callback and exchange code for credentials"""
        try:
            if not os.path.exists(self.credentials):
                return {"error": "credentials.json not found"}
            
            flow = Flow.from_client_secrets_file(
                self.credentials,
                scopes=self.scopes,
                redirect_uri=self.redirect_uri
            )

            # Exchange authorization code for credentials
            flow.fetch_token(authorization_response=authorization_response)
            self.creds = flow.credentials

            self.save_credentials()  # Save for future uses

            return {
                "status": "success",
                "message": "Calendar connected successfully!"
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to handle callback: {str(e)}"
            }
    
    def save_credentials(self):
        """Save credentials into token.json"""
        try:
            with open(self.token, 'w') as token:
                token.write(self.creds.to_json())
            return True
        except Exception as e:
            print(f"Failed to save credentials: {str(e)}")
            return False
    
    def load_credentials(self):
        """Load credentials from token and return credentials object"""
        try:
            # ✅ Check if token file exists
            if not os.path.exists(self.token):
                return None
            
            # ✅ Load credentials from file
            creds = Credentials.from_authorized_user_file(self.token, self.scopes)
            
            # ✅ Check if credentials are valid
            if creds and creds.valid:
                self.creds = creds  # Store in memory too
                return creds
            
            # ✅ Refresh if expired
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
                self.creds = creds
                self.save_credentials()
                return creds
            
            return None
            
        except Exception as e:
            print(f"Failed to load credentials: {str(e)}")
            import traceback
            traceback.print_exc()
            return None
    
    def is_authenticated(self):
        """Check if user has valid credentials"""
        # ✅ Load from file, don't just check self.creds
        creds = self.load_credentials()
        return creds is not None
    
    def revoke_credentials(self):
        """User log out"""
        try:
            if os.path.exists(self.token):
                os.remove(self.token)  # ✅ Fixed: os.path.remove → os.remove
            
            self.creds = None  # Clear memory
            
            return {
                "status": "success",
                "message": "Calendar disconnected"
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to disconnect: {str(e)}"
            }