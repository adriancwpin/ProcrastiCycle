import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpotify } from "@fortawesome/free-brands-svg-icons";
import { faCalendarDays } from "@fortawesome/free-solid-svg-icons";
import "./App.css";
declare const chrome: any;

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
            setStatus("Spotify Authorized!");
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
  }, [spotifyAuthorized, calendarAuthorized, spotifyVisible, calendarVisible, isRunning]);

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
    setStatus("Opening Spotify authorization...");
    setSpotifyPending(true);
    setSpotifyVisible(false);
    
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
    setStatus("Opening Google Calendar authorization...");
    setCalendarPending(true);
    setCalendarVisible(false);
    
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
          <h2>Spotify - Authorizing...</h2>
          <p className="pending-text">Complete authorization in the browser tab</p>
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
          <h2>Calendar - Authorizing...</h2>
          <p className="pending-text">Complete authorization in the browser tab</p>
        </div>
      )}

      {/* Show Start button OR Running session */}
      {(startVisible || isRunning) && (
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