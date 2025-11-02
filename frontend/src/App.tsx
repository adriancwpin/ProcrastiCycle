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

  // Load visibility & stopwatch states on mount, calculate elapsedSeconds if running
  useEffect(() => {
    chrome.storage.local.get(
      ["spotifyVisible", "calendarVisible", "isRunning", "startTimestamp", "elapsedSeconds"],
      (result: any) => {
        setSpotifyVisible(result.spotifyVisible !== false);
        setCalendarVisible(result.calendarVisible !== false);

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
      // Clear startTimestamp from storage since timer reset
      chrome.storage.local.remove(["startTimestamp", "elapsedSeconds", "isRunning"]);
    }
  }, [spotifyVisible, calendarVisible]);

  // Stopwatch timer effect to update elapsedSeconds every second
  useEffect(() => {
    if (isRunning) {
      timerRef.current = window.setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning]);

  // Save visibility states whenever they change
  useEffect(() => {
    chrome.storage.local.set({
      spotifyVisible,
      calendarVisible,
    });
  }, [spotifyVisible, calendarVisible]);

  // Save stopwatch state whenever isRunning or elapsedSeconds changes
  useEffect(() => {
    if (isRunning) {
      // Save startTimestamp and isRunning
      const startTimestamp = Date.now() - elapsedSeconds * 1000;
      chrome.storage.local.set({ startTimestamp, isRunning: true });
    } else {
      // Save elapsedSeconds and isRunning false
      chrome.storage.local.set({ elapsedSeconds, isRunning: false });
      // Remove startTimestamp if stopped
      chrome.storage.local.remove("startTimestamp");
    }
  }, [isRunning, elapsedSeconds]);

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
