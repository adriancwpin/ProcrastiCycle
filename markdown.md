ProcrastiCycle/
│
├── frontend/                 # React or Svelte website
│   ├── src/
│   │   ├── components/       # UI elements
│   │   ├── api/              # JS functions calling Flask
│   │   └── pages/
│   └── package.json
│
├── backend/                  # Flask or FastAPI app
│   ├── app.py                # main server file
│   ├── spotify_client.py     # Spotify API integration
│   ├── calendar_client.py    # Google Calendar API integration
│   ├── keystroke_handler.py  # endpoint for typing data
│   ├── tab_handler.py        # endpoint for browser tabs
│   ├── predictor.py          # ML or heuristic logic
│   └── requirements.txt
│
├── extension/                # (optional) Chrome extension
│   ├── manifest.json
│   ├── background.js
│   └── popup.html
│
└── README.md