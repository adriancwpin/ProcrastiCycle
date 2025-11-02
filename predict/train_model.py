import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
import joblib

def main():
    productivity_data = pd.read_csv('productivity_data_enhanced.csv')

    feature_columns = [
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
    
    X = productivity_data[feature_columns].copy()
    y = productivity_data['Focus']

    # Handle -1 values (when Spotify is off)
    X['Danceability'] = X['Danceability'].replace(-1, 0)
    X['Tempo'] = X['Tempo'].replace(-1, 0)
    X['Energy'] = X['Energy'].replace(-1, 0)

    model = Pipeline([
    ('scaler', StandardScaler()),
    ('model', RandomForestClassifier(
        n_estimators=100, max_depth=10, min_samples_split=5, random_state=42))
    ])
    
    model.fit(X, y)

    # Save trained model
    joblib.dump(model, 'procrastination_model.pkl')

if __name__ == "__main__":
    main()
