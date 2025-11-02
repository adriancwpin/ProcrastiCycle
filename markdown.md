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
│
│
├── GC/                        # 🆕 Google Calendar integration
│   ├── __init__.py
│   ├── auth.py                # Google OAuth authentication
│   ├── client.py              # Calendar API client wrapper
│
|
├── routes/                     # Route handlers
│   ├── __init__.py
│   ├── main.py                # Main routes (index, dashboard)
│
│
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