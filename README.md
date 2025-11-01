# ProcrastiCycle

ProcrastiCycle/
│
├── app.py                      # Main Flask application (entry point)
├── .env                        # Environment variables
├── requirements.txt            # Dependencies
│
├── config.py                   # Configuration settings
│
├── models.py                   # Database models
│
├── spotify/                    # Spotify-related code (module)
│   ├── __init__.py
│   ├── auth.py                # OAuth authentication logic
│   ├── client.py              # Spotify API client wrapper
│   └── analyzer.py            # Data analysis & procrastination detection
│
├── routes/                     # Route handlers
│   ├── __init__.py
│   ├── main.py                # Main routes (index, dashboard)
│   ├── auth.py                # Auth routes (login, callback, logout)
│   └── api.py                 # API endpoints for Chrome extension
│
├── templates/                  # HTML templates
│   ├── index.html
│   ├── dashboard.html
│   └── error.html
│
└── static/                     # Static files
    ├── css/
    ├── js/
    └── images/