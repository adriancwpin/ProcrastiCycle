import { useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpotify } from "@fortawesome/free-brands-svg-icons";
import { faCalendarDays } from "@fortawesome/free-solid-svg-icons";
import "./App.css";
declare const chrome: any;

interface ActivityData {
  keystrokes_per_minute: number;
  mouse_moves_per_minute: number;
  mouse_clicks_per_minute: number;
  timestamp: number;
}

function App() {
  const [status, setStatus] = useState<string>("");

  const [spotifyAuthorized, setSpotifyAuthorized] = useState(false);
  const [calendarAuthorized, setCalendarAuthorized] = useState(false);

  const [spotifyPending, setSpotifyPending] = useState(false);
  const [calendarPending, setCalendarPending] = useState(false);

  const [spotifyVisible, setSpotifyVisible] = useState(true);
  const [calendarVisible, setCalendarVisible] = useState(true);

  const [startVisible, setStartVisible] = useState(false);

  // Session & Timer states (read from background)
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<number | null>(null);

  // Music features logger interval
  const musicLoggerRef = useRef<number | null>(null);

  // Tab logger interval
  const tabLoggerRef = useRef<number | null>(null); // for tab URL logging

  // 🆕 Activity tracking interval
  const activityLoggerRef = useRef<number | null>(null);

  // Load states on mount
  useEffect(() => {
    chrome.storage.local.get(
      [
        "spotifyAuthorized",
        "calendarAuthorized",
        "spotifyPending",
        "calendarPending",
        "spotifyVisible",
        "calendarVisible",
        "session_active",
        "elapsed_seconds"
      ],
      (result: any) => {
        // Authorization states
        const spotifyAuth = result.spotifyAuthorized || false;
        const calendarAuth = result.calendarAuthorized || false;
        const spotifyPend = result.spotifyPending || false;
        const calendarPend = result.calendarPending || false;
        
        setSpotifyAuthorized(spotifyAuth);
        setCalendarAuthorized(calendarAuth);
        setSpotifyPending(spotifyPend);
        setCalendarPending(calendarPend);
        
        // Visibility
        setSpotifyVisible(!spotifyAuth && !spotifyPend);
        setCalendarVisible(!calendarAuth && !calendarPend);

        // Session status
        const sessionActive = result.session_active || false;
        setIsRunning(sessionActive);
        
        if (sessionActive) {
          setElapsedSeconds(result.elapsed_seconds || 0);
        }
      }
    );
  }, []);

  // Update timer every second by reading from storage
  useEffect(() => {
    if (isRunning) {
      const timerUpdate = setInterval(() => {
        chrome.storage.local.get(['elapsed_seconds'], (result: any) => {
          setElapsedSeconds(result.elapsed_seconds || 0);
        });
      }, 1000);

      return () => clearInterval(timerUpdate);
    }
  }, [isRunning]);

  // Poll for Spotify authorization
  useEffect(() => {
    if (spotifyPending && !spotifyAuthorized) {
      const checkAuth = setInterval(async () => {
        try {
          const res = await fetch("http://127.0.0.1:8888/get_track_info");
          if (res.ok) {
            clearInterval(checkAuth);
            setSpotifyAuthorized(true);
            setSpotifyPending(false);
            chrome.storage.local.set({ 
              spotifyAuthorized: true, 
              spotifyPending: false 
            });
            setStatus("Spotify Authorised!");
          }
        } catch (err) {
          // Still waiting
        }
      }, 2000);

      setTimeout(() => {
        clearInterval(checkAuth);
        if (!spotifyAuthorized) {
          setSpotifyPending(false);
          chrome.storage.local.set({ spotifyPending: false });
        }
      }, 120000);

      return () => clearInterval(checkAuth);
    }
  }, [spotifyPending, spotifyAuthorized]);

  // Poll for Calendar authorization
  useEffect(() => {
    if (calendarPending && !calendarAuthorized) {
      const checkAuth = setInterval(async () => {
        try {
          const res = await fetch("http://127.0.0.1:8888/check_calendar_auth");
          if (res.ok) {
            clearInterval(checkAuth);
            setCalendarAuthorized(true);
            setCalendarPending(false);
            chrome.storage.local.set({ 
              calendarAuthorized: true, 
              calendarPending: false 
            });
            setStatus("Google Calendar Authorised!");
          }
        } catch (err) {
          // Still waiting
        }
      }, 2000);

      setTimeout(() => {
        clearInterval(checkAuth);
        if (!calendarAuthorized) {
          setCalendarPending(false);
          chrome.storage.local.set({ calendarPending: false });
        }
      }, 120000);

      return () => clearInterval(checkAuth);
    }
  }, [calendarPending, calendarAuthorized]);

  // Show Start button logic
  useEffect(() => {
    const bothAuthorized = spotifyAuthorized && calendarAuthorized;
    const bothHidden = !spotifyVisible && !calendarVisible;
    
    // IMPORTANT: Don't show start button if session is already running
    if (bothAuthorized && bothHidden && !isRunning) {
      setStartVisible(true);
      setStatus("");
    } else {
      setStartVisible(false);
    }
  }, [spotifyAuthorized, calendarAuthorized, spotifyVisible, calendarVisible]);

  // 🆕 Function to fetch activity data from Flask API
  const fetchActivityData = async () => {
    try {
      const response = await fetch('http://127.0.0.1:5000/api/activity');
      
      if (response.ok) {
        const data: ActivityData = await response.json();
        
        // Log to console
        console.log('⌨️ Activity Data:', {
          keystrokes: data.keystrokes_per_minute,
          mouse_moves: data.mouse_moves_per_minute,
          mouse_clicks: data.mouse_clicks_per_minute,
          timestamp: new Date(data.timestamp * 1000).toLocaleTimeString()
        });
        
        // Save to chrome storage for later use
        chrome.storage.local.set({ 
          latest_activity_data: data,
          activity_data_timestamp: Date.now()
        });

      } else {
        console.error('Failed to fetch activity data');
      }
    } catch (err) {
      console.error("Error fetching activity data:", err);
    }
  };

  // Stopwatch timer effect to update elapsedSeconds every second
  useEffect(() => {
    if (isRunning) {
      chrome.storage.local.set({
        stopwatchRunning: true,
        stopwatchLastTimestamp: Date.now(),
        elapsedSeconds,
      });

      timerRef.current = window.setInterval(() => {
        setElapsedSeconds((prev) => {
          const newVal = prev + 1;
          chrome.storage.local.set({ elapsedSeconds: newVal, stopwatchLastTimestamp: Date.now() });
          return newVal;
        });
      }, 1000);

      const fetchMusicFeatures = async () => {
        try {
          const response = await fetch('http://127.0.0.1:8888/get_music_features');
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.success) {
              console.log('🎵 Current Music Features:', data);
              console.log(`Track: ${data.track_name} by ${data.artist}`);
              console.log(`Danceability: ${data.features.danceability}`);
              console.log(`Tempo: ${data.features.tempo}`);
              console.log(`Energy: ${data.features.energy}`);
              
              // Save to chrome storage for background script or later use
              chrome.storage.local.set({ 
                latest_music_features: data,
                music_features_timestamp: Date.now()
              });
            } else {
              console.log('No music playing or error:', data.error);
            }
          }
        } catch (err) {
          console.error("Error fetching music features:", err);
        }
      };

      // Fetch immediately when session starts
      fetchMusicFeatures();

      // Then fetch every 60 seconds
      musicLoggerRef.current = window.setInterval(fetchMusicFeatures, 60000);

      // Record open tab URLs every 1 minute and send to Flask
    tabLoggerRef.current = window.setInterval(() => {
      chrome.tabs.query({}, async (tabs: any[]) => {
        const urls = tabs.map((tab) => tab.url).filter(Boolean);

        try {
          const response = await fetch('http://127.0.0.1:8888/analyze-tabs', {  // Flask endpoint
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ urls }),
          });
          return await response.json();
        } catch (err) {
          console.error("Error sending tabs to Flask:", err);
        }
      });
    }, 60000);

    // 🆕 Fetch activity data immediately when session starts
      fetchActivityData();

    // 🆕 Then fetch every 60 seconds (1 minute)
    activityLoggerRef.current = window.setInterval(fetchActivityData, 60000);

    } else {
      // Stop all timers
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      if (musicLoggerRef.current !== null) {
        clearInterval(musicLoggerRef.current);
        musicLoggerRef.current = null;
      }

      if (tabLoggerRef.current !== null) {
        clearInterval(tabLoggerRef.current);
        tabLoggerRef.current = null;
      }

      // 🆕 Stop activity tracking
      if (activityLoggerRef.current !== null) {
        clearInterval(activityLoggerRef.current);
        activityLoggerRef.current = null;
      }

      chrome.storage.local.set({
        stopwatchRunning: false,
        stopwatchLastTimestamp: null,
        elapsedSeconds,
      });
    }

    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
      }
      if (musicLoggerRef.current !== null) {
        clearInterval(musicLoggerRef.current);
      }
      if (tabLoggerRef.current !== null) {
        clearInterval(tabLoggerRef.current);
      }
      // 🆕 Cleanup activity tracker
      if (activityLoggerRef.current !== null) {
        clearInterval(activityLoggerRef.current);
      }
    };
  }, [isRunning, elapsedSeconds]);

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  const handleStartClick = () => {
    setIsRunning(true);
    setStatus("locking in");
    
    // Tell background to start session
    chrome.runtime.sendMessage({ action: "startSession" }, (response: any) => {
      console.log("Session started:", response);
    });
  };

  const handleStopClick = () => {
    setIsRunning(false);
    setStatus("Session stopped");
    
    // Tell background to stop session
    chrome.runtime.sendMessage({ action: "stopSession" }, (response: any) => {
      console.log("Session stopped:", response);
    });
  };

  const spotify_click = async () => {
    setStatus("Opening Spotify authorisation...");
    setSpotifyPending(true);
    setSpotifyVisible(false);
    
    chrome.storage.local.set({ 
      spotifyPending: true,
      spotifyVisible: false
    });
    
    try {
      const res = await fetch("http://127.0.0.1:8888/open_spotify");
      if (res.ok) {
        setStatus("Waiting for Spotify authorisation...");
      } else {
        setStatus("Error: Backend not responding");
        setSpotifyPending(false);
        setSpotifyVisible(true);
        chrome.storage.local.set({ 
          spotifyPending: false,
          spotifyVisible: true
        });
      }
    } catch (err) {
      console.error(err);
      setStatus("Error: Could not reach backend");
      setSpotifyPending(false);
      setSpotifyVisible(true);
      chrome.storage.local.set({ 
        spotifyPending: false,
        spotifyVisible: true
      });
    }
  };

  const calendar_click = async () => {
    setStatus("Opening Google Calendar authorisation...");
    setCalendarPending(true);
    setCalendarVisible(false);
    
    chrome.storage.local.set({ 
      calendarPending: true,
      calendarVisible: false
    });
    
    try {
      const res = await fetch("http://127.0.0.1:8888/open_calendar");
      if (res.ok) {
        setStatus("Waiting for Google Calendar authorisation...");
      } else {
        setStatus("Error: Backend not responding");
        setCalendarPending(false);
        setCalendarVisible(true);
        chrome.storage.local.set({ 
          calendarPending: false,
          calendarVisible: true
        });
      }
    } catch (err) {
      console.error(err);
      setStatus("Error: Could not reach backend");
      setCalendarPending(false);
      setCalendarVisible(true);
      chrome.storage.local.set({ 
        calendarPending: false,
        calendarVisible: true
      });
    }
  };

  return (
    <div className="popup">
      <h1>Procrastination Police 👮‍♀️</h1>

      {spotifyVisible && (
        <div className="factor" onClick={spotify_click}>
          <FontAwesomeIcon icon={faSpotify} size="3x" color="#1DB954" />
          <h2>Spotify</h2>
        </div>
      )}

      {spotifyPending && !spotifyAuthorized && (
        <div className="factor pending">
          <FontAwesomeIcon icon={faSpotify} size="3x" color="#1DB954" />
          <h2>Spotify - Authorising...</h2>
          <p className="pending-text">Complete authorisation</p>
        </div>
      )}

      {calendarVisible && (
        <div className="factor" onClick={calendar_click}>
          <FontAwesomeIcon icon={faCalendarDays} size="3x" color="#4285F4" />
          <h2>Google Calendar</h2>
        </div>
      )}

      {calendarPending && !calendarAuthorized && (
        <div className="factor pending">
          <FontAwesomeIcon icon={faCalendarDays} size="3x" color="#4285F4" />
          <h2>Calendar - Authorising...</h2>
          <p className="pending-text">Complete authorisation </p>
        </div>
      )}

      {/* Show Start button OR Running session */}
      {(startVisible || isRunning) && (
        <div className="start-controls">
          {!isRunning ? (
            <button onClick={handleStartClick} className="session-btn">START </button>
          ) : (
            <div className="running-session">
              <p className="timer"> {formatTime(elapsedSeconds)}</p>
              <button onClick={handleStopClick} className="session-btn stop-btn">STOP</button>
            </div>
          )}
        </div>
      )}
  {status && (
    <p
      id={status === "locking in" ? "locking-in" : undefined}
      className="status-message"
    >
      {status}
    </p>
  )}

    </div>
  );
}

export default App;