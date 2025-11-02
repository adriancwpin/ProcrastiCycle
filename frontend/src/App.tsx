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
  const [fadeSpotify] = useState(false);

  const [calendarVisible, setCalendarVisible] = useState(true);
  const [fadeCalendar] = useState(false);

  const [startVisible, setStartVisible] = useState(false);

  // Stopwatch states
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<number | null>(null);

  // Music features logger interval
  const musicLoggerRef = useRef<number | null>(null);

  // Tab logger interval
  const tabLoggerRef = useRef<number | null>(null); // for tab URL logging

  // 🆕 Activity tracking interval
  const activityLoggerRef = useRef<number | null>(null);

  // Load visibility & stopwatch states on mount, calculate elapsedSeconds if running
  useEffect(() => {
    chrome.storage.local.get(
      [
        "spotifyAuthorized",
        "calendarAuthorized",
        "spotifyPending",
        "calendarPending",
        "spotifyVisible",
        "calendarVisible",
        "stopwatchRunning",
        "elapsedSeconds",
        "stopwatchLastTimestamp",
      ],
      (result: any) => {
        // Load authorization states
        const spotifyAuth = result.spotifyAuthorized || false;
        const calendarAuth = result.calendarAuthorized || false;
        const spotifyPend = result.spotifyPending || false;
        const calendarPend = result.calendarPending || false;
        
        setSpotifyAuthorized(spotifyAuth);
        setCalendarAuthorized(calendarAuth);
        setSpotifyPending(spotifyPend);
        setCalendarPending(calendarPend);
        
        // If authorized or pending, hide the box
        setSpotifyVisible(!spotifyAuth && !spotifyPend);
        setCalendarVisible(!calendarAuth && !calendarPend);

        if (result.isRunning && result.startTimestamp) {
          setIsRunning(true);

          // Calculate elapsed seconds from stored startTimestamp
          const now = Date.now();
          const elapsed = Math.floor((now - result.startTimestamp) / 1000);
          setElapsedSeconds(elapsed);
        } else {
          // Not running, use stored elapsedSeconds or 0
          setIsRunning(false);
          setElapsedSeconds(result.elapsedSeconds || 0);
        }
      }
    );
  }, []);


  // Poll for authorization completion if pending
  useEffect(() => {
    if (spotifyPending && !spotifyAuthorized) {
      const checkAuth = setInterval(async () => {
        try {
          const res = await fetch("http://127.0.0.1:8888/get_track_info");
          if (res.ok) {
            // Authorization complete!
            clearInterval(checkAuth);
            setSpotifyAuthorized(true);
            setSpotifyPending(false);
            chrome.storage.local.set({ 
              spotifyAuthorized: true, 
              spotifyPending: false 
            });
            setStatus("Spotify Authorized!");
          }
        } catch (err) {
          // Still waiting
        }
      }, 2000);

      // Stop checking after 2 minutes
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

  // Similar polling for calendar (if you implement it)
  useEffect(() => {
    if (calendarPending && !calendarAuthorized) {
      const checkAuth = setInterval(async () => {
        try {
          // Replace with your calendar check endpoint
          const res = await fetch("http://127.0.0.1:8888/check_calendar_auth");
          if (res.ok) {
            clearInterval(checkAuth);
            setCalendarAuthorized(true);
            setCalendarPending(false);
            chrome.storage.local.set({ 
              calendarAuthorized: true, 
              calendarPending: false 
            });
            setStatus("Google Calendar Authorized!");
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

  // Show Start button only if both services are authorized AND both boxes are hidden
  useEffect(() => {
    const bothAuthorized = spotifyAuthorized && calendarAuthorized;
    const bothHidden = !spotifyVisible && !calendarVisible;
    
    if (bothAuthorized && bothHidden) {
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
    setStatus("Session started! 🚀");
    
    // Send message to background to start monitoring
    chrome.runtime.sendMessage({ action: "startSession" }, (response: any) => {
      console.log("Session started:", response);
    });
  };

  const handleStopClick = () => {
    setIsRunning(false);
    setStatus("Session stopped");
    
    // Send message to background to stop monitoring
    chrome.runtime.sendMessage({ action: "stopSession" }, (response: any) => {
      console.log("Session stopped:", response);
    });
  };

  const spotify_click = async () => {
    setStatus("Opening Spotify authorization...");
    
    // Mark as pending immediately
    setSpotifyPending(true);
    setSpotifyVisible(false);
    
    // Save pending state
    chrome.storage.local.set({ 
      spotifyPending: true,
      spotifyVisible: false
    });
    
    try {
      const res = await fetch("http://127.0.0.1:8888/open_spotify");
      if (res.ok) {
        setStatus("Waiting for Spotify authorization...");
      } else {
        setStatus("Error: Backend not responding");
        // Reset on error
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
      // Reset on error
      setSpotifyPending(false);
      setSpotifyVisible(true);
      chrome.storage.local.set({ 
        spotifyPending: false,
        spotifyVisible: true
      });
    }
  };

  const calendar_click = async () => {
    setStatus("Opening Google Calendar authorization...");
    
    // Mark as pending immediately
    setCalendarPending(true);
    setCalendarVisible(false);
    
    // Save pending state
    chrome.storage.local.set({ 
      calendarPending: true,
      calendarVisible: false
    });
    
    try {
      const res = await fetch("http://127.0.0.1:8888/open_calendar");
      if (res.ok) {
        setStatus("Waiting for Google Calendar authorization...");
      } else {
        setStatus("Error: Backend not responding");
        // Reset on error
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
      // Reset on error
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
        <div
          className={`factor ${fadeSpotify ? "fade-out" : ""}`}
          onClick={spotify_click}
        >
          <FontAwesomeIcon icon={faSpotify} size="3x" color="#1DB954" />
          <h2>Spotify</h2>
        </div>
      )}

      {spotifyPending && !spotifyAuthorized && (
        <div className="factor pending">
          <FontAwesomeIcon icon={faSpotify} size="3x" color="#1DB954" />
          <h2>Spotify - Authorizing...</h2>
          <p className="pending-text">Complete authorization in the browser tab</p>
        </div>
      )}

      {calendarVisible && (
        <div
          className={`factor ${fadeCalendar ? "fade-out" : ""}`}
          onClick={calendar_click}
        >
          <FontAwesomeIcon icon={faCalendarDays} size="3x" color="#4285F4" />
          <h2>Google Calendar</h2>
        </div>
      )}

      {calendarPending && !calendarAuthorized && (
        <div className="factor pending">
          <FontAwesomeIcon icon={faCalendarDays} size="3x" color="#4285F4" />
          <h2>Calendar - Authorizing...</h2>
          <p className="pending-text">Complete authorization in the browser tab</p>
        </div>
      )}

      {startVisible && (
        <div className="factor start-button">
          {!isRunning ? (
            <button onClick={handleStartClick}>▶️ Start Session</button>
          ) : (
            <>
              <p className="timer">⏱️ {formatTime(elapsedSeconds)}</p>
              <button onClick={handleStopClick}>⏹️ Stop Session</button>
            </>
          )}
        </div>
      )}

      {status && <p className="status-message">{status}</p>}
    </div>
  );
}

export default App;
