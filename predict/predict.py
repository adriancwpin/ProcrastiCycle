from flask import Flask, request, jsonify
import joblib
import pandas as pd

app = Flask(__name__)

# Load trained model
model = joblib.load('procrastination_model.pkl')

# Define the expected features (must match training order)
FEATURE_COLUMNS = [
    'Hour',
    'Minute',
    'Day of week',
    'Keystrokes per min',
    'Mouse moves per min',
    'Mouse clicks per min',
    'Productivity of Active Chrome Tabs',
    'Total Minutes of Events Before',
    'Total Minutes of Events After',
    'Total Minutes to Next Event',
    'Spotify',
    'Danceability',
    'Tempo',
    'Energy',
    'Minutes_Into_Day'
]

@app.route('/predict', methods=['POST'])
def predict():
    # Parse JSON body directly (root-level features)
    data = request.get_json()

    # Create a single-row DataFrame
    df = pd.DataFrame([data])[FEATURE_COLUMNS]

    # Predict using the model
    proba = model.predict_proba(df)[0][0]

    # Return a single integer prediction
    return jsonify({"prediction": float(proba)})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
