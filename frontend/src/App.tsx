import { useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpotify } from "@fortawesome/free-brands-svg-icons";
import { faCalendarDays } from "@fortawesome/free-solid-svg-icons";
import "./App.css";
declare const chrome: any;

function App() {
  const [status, setStatus] = useState<string>("");

  const [spotifyVisible, setSpotifyVisible] = useState(true);
  const [fadeSpotify, setFadeSpotify] = useState(false);

  const [calendarVisible, setCalendarVisible] = useState(true);
  const [fadeCalendar, setFadeCalendar] = useState(false);

  const [startVisible, setStartVisible] = useState(false);

  // Stopwatch states
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const timerRef = useRef<number | null>(null);

  // Load all saved states from chrome storage on mount
  useEffect(() => {
    chrome.storage.local.get(
      [
        "spotifyVisible",
        "calendarVisible",
        "stopwatchRunning",
        "elapsedSeconds",
        "stopwatchLastTimestamp",
      ],
      (result: any) => {
        setSpotifyVisible(result.spotifyVisible !== false);
        setCalendarVisible(result.calendarVisible !== false);

        // Load elapsed time
        let savedElapsed = result.elapsedSeconds ?? 0;

        // If stopwatch was running, calculate elapsed time including offline time
        if (result.stopwatchRunning) {
          const lastTimestamp = result.stopwatchLastTimestamp ?? Date.now();
          const now = Date.now();
          const diffSeconds = Math.floor((now - lastTimestamp) / 1000);
          savedElapsed += diffSeconds;
          setIsRunning(true);
          setElapsedSeconds(savedElapsed);
        } else {
          setIsRunning(false);
          setElapsedSeconds(savedElapsed);
        }
      }
    );
  }, []);

  // Show Start button if both Spotify and Calendar are hidden
  useEffect(() => {
    if (!spotifyVisible && !calendarVisible) {
      setStartVisible(true);
      setStatus("");
    } else {
      setStartVisible(false);
      // Reset stopwatch if you want on re-showing boxes
      setIsRunning(false);
      setElapsedSeconds(0);
      // Also clear stored stopwatch state when boxes reappear
      chrome.storage.local.set({
        stopwatchRunning: false,
        elapsedSeconds: 0,
        stopwatchLastTimestamp: null,
      });
    }
  }, [spotifyVisible, calendarVisible]);

  // Stopwatch timer effect
  useEffect(() => {
    if (isRunning) {
      // Save start time
      chrome.storage.local.set({
        stopwatchRunning: true,
        stopwatchLastTimestamp: Date.now(),
        elapsedSeconds,
      });

      timerRef.current = window.setInterval(() => {
        setElapsedSeconds((prev) => {
          const newVal = prev + 1;
          // Save updated elapsed time every second
          chrome.storage.local.set({ elapsedSeconds: newVal, stopwatchLastTimestamp: Date.now() });
          return newVal;
        });
      }, 1000);
    } else {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      // Save stopped state
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
    };
  }, [isRunning]);

  // Format seconds into mm:ss
  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  const handleStartClick = () => {
    setIsRunning(true);
    setStatus("Stopwatch started");
  };

  const handleStopClick = () => {
    setIsRunning(false);
    setStatus("Stopwatch stopped");
  };

 const spotify_click = async () => {
    setStatus("Authorizing Spotify...");
    try {
      const res = await fetch("http://127.0.0.1:8888/open_spotify");
      if (res.ok) {
        setStatus("Spotify Authorized!");
        setFadeSpotify(true);
        setTimeout(() => {
          setSpotifyVisible(false);
          setFadeSpotify(false);
        }, 2000);
      } else {
        setStatus("Error: Backend not responding");
      }
    } catch (err) {
      console.error(err);
      setStatus("Error: Could not reach backend");
    }
  };

  const calendar_click = async () => {
    setStatus("Authorizing Google Calendar...");
    try {
      const res = await fetch("http://127.0.0.1:8888/open_calendar");
      if (res.ok) {
        setStatus("Google Calendar Authorized!");
        setFadeCalendar(true);
        setTimeout(() => {
          setCalendarVisible(false);
          setFadeCalendar(false);
        }, 2000);
      } else {
        setStatus("Error: Backend not responding");
      }
    } catch (err) {
      console.error(err);
      setStatus("Error: Could not reach backend");
    }
  };

  // Send test message to background on mount (optional)
  useEffect(() => {
    if (chrome?.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ action: "ping" }, (response: any) => {
        console.log("Background response:", response);
      });
    }
  }, []);

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

      {calendarVisible && (
        <div
          className={`factor ${fadeCalendar ? "fade-out" : ""}`}
          onClick={calendar_click}
        >
          <FontAwesomeIcon icon={faCalendarDays} size="3x" color="#4285F4" />
          <h2>Google Calendar</h2>
        </div>
      )}

      {startVisible && (
        <div className="factor">
          {!isRunning ? (
            <button onClick={handleStartClick}>Start</button>
          ) : (
            <>
              <p>Elapsed Time: {formatTime(elapsedSeconds)}</p>
              <button onClick={handleStopClick}>Stop</button>
            </>
          )}
        </div>
      )}

      {status && <p>{status}</p>}
    </div>
  );
}

export default App;

