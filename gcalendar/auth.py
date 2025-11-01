#Handles Google Calendar OAuth authentication

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request
import os
import json

class calendarAuth:
    def __init__(self):
        self.creds = None # Not logged in yet
        self.credentials = 'credentials.json'
        self.scopes = 'https://www.googleapis.com/auth/calendar.events.readonly' #get permission to view the event 
        self.token = 'token.json'
        self.redirect_uri = os.getenv('GOOGLE_REDIRECT_URI', 'http://localhost:8000/api/calendar/callback')

    def get_auth_url(self): #call when the user click 'Connect Calendar' 
        try:
            #check if credentials.json exists
            if not os.path.exists(self.credentials):
                return{
                    "error": "credentials.json not found. Please add Google OAuth credentials."
                }
            
            flow = Flow.from_client_secrets_file(
                self.credentials,
                scopes = self.scopes,
                redirect_uri = self.redirect_uri
            )

            authorization_url, state = flow.authorization_url(
                access_type = 'offline', #Get refresh token for long-term access
                include_granted_scopes = 'true',
                prompt = 'consent'
            )
            return{
                "auth_url" : authorization_url,
                "state" : state
            }
            
        except Exception as e:
            return{"error" :f"Failed to generate an autorized URL: {str(e)}"}
        
    
    #Handle OAuth callback and exchange code for credentials
    def handle_callback(self, authorization_response):
        try:
            if not os.path.exits(self.credentials):
                 return {"error": "credentials.json not found"}
            
            flow = Flow.from_client_secrets_file(
                self.credentials_file,
                scopes=self.scopes,
                redirect_uri = self.redirect_uri
            )

            #Exchange authorization code for credentials
            flow.fetch_token(authorization_response = authorization_response)
            self.creds = flow.credentials

            self.save_credentials() #save for future uses

            return{
                "status" : "success",
                "message": "Calendar connected successfully!"
            }
        except Exception as e:
            return{
                "status" : "error",
                "message": f"Failed to handle callback: {str(e)}"
            }
        
    def save_credentials(self):
        try: #save credentials into token.json
            with open(self.token, 'w') as token:
                token.write(self.creds.to_json())
            return True
        except Exception as e:
            print(f"Failed to save credentials: {str(e)}")
            return False
    
    def load_credentials(self):
        #load credentials from token
        try:
            if not os.path.exits(self.token):
                self.creds = Credentials.from_authorized_user_file(self.token, self.scopes)

                #check if credentials are valid
                if self.creds and self.creds.valid:
                    return True
                
                #refresh if expired
                if self.creds and self.cred.expired and self.creds.refresh_tokens:
                    from google.auth.transport.requests import Request
                    self.creds.refresh(Request())
                    self.save_credentials()
                    return True
                return False
        except Exception as e:
            print(f"Failed to load credentials: {str(e)}")
            return False
    
    def is_authenticated(self):
        return self.creds  is not None and self.creds.valid


    def revoke_credentials(self):
        #user log out 
        try:
            if os.path.exists(self.token):
                os.path.remove(self.token)
            
            return{
                "status" : "success",
                "message": "Calendar disconnected"
            }
        except Exception as e:
            return{
                "status" : "error",
                "message": f"Failed to disconnect: {str(e)}"
            }
