import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import webbrowser
from flask import Flask, jsonify, request
from flask_cors import CORS
from spotify import auth

app = Flask(__name__)
CORS(app)

auth_storage = {}

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
        
        return """
        <html>
            <body style="text-align: center; padding: 50px; font-family: Arial;">
                <h1>✅ Success!</h1>
                <p>Authentication complete. You can close this tab.</p>
                <script>
                    setTimeout(() => window.close(), 2000);
                </script>
            </body>
        </html>
        """
    else:
        return "<h1>Failed to get token</h1>", 400


if __name__ == '__main__':
    print("Starting Flask server on http://127.0.0.1:8888")
    app.run(host='127.0.0.1', port=8888, debug=True)