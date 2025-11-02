import joblib
import pandas as pd

# Load the trained model
model = joblib.load("procrastination_model.pkl")

# Example: create a single test input
example = pd.DataFrame([{
    'Hour': 9,
    'Minute': 30,
    'Day of week': 1,
    'Keystrokes per min': 70,
    'Mouse moves per min': 120,
    'Mouse clicks per min': 150,
    'Productivity of Active Chrome Tabs': 0.9,
    'Total Minutes of Events Before': 50,
    'Total Minutes of Events After': 10, 
    'Total Minutes to Next Event': 5,
    'Spotify': 1,
    'Danceability': 0.3,
    'Tempo': 80,
    'Energy': 0.3,
    'Minutes_Into_Day': 570
}])

# Make a prediction
prediction = model.predict(example)
probability = model.predict_proba(example)[0]
print("Predicted focus level:", prediction)
print("Probability of procrastination:", probability)
