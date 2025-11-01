import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpotify } from '@fortawesome/free-brands-svg-icons';
import { faCalendarDays } from '@fortawesome/free-solid-svg-icons';
import './App.css';

function App() {
  const [status, setStatus] = useState('');

  const [spotifyVisible, setSpotifyVisible] = useState(true);
  const [fadeSpotify, setFadeSpotify] = useState(false);

  const [calendarVisible, setCalendarVisible] = useState(true);
  const [fadeCalendar, setFadeCalendar] = useState(false);

  const [startVisible, setStartVisible] = useState(false);

  const checkShowStart = () => {
    // Delay to ensure state updates completed
    setTimeout(() => {
      if (!spotifyVisible && !calendarVisible) {
        setStartVisible(true);
        setStatus('');
      }
    }, 0);
  };

  const spotify_click = async () => {
    setStatus('Authorizing Spotify...');
    try {
      const res = await fetch("http://127.0.0.1:8888/open_spotify");
      if (res.ok) {
        setStatus('Spotify Authorized!');
        setFadeSpotify(true);
        setTimeout(() => {
          setSpotifyVisible(false);
          checkShowStart();
        }, 2000); // match animation duration
      } else {
        setStatus('Error: Backend not responding');
      }
    } catch (err) {
      console.error(err);
      setStatus('Error: Could not reach backend');
    }
  };

  const calendar_click = () => {
    setStatus('Authorizing Google Calendar...');
    setFadeCalendar(true);
    setTimeout(() => {
      setCalendarVisible(false);
      checkShowStart();
    }, 2000);
  };

  return (
    <div className="popup">
      <h1>Procrastination Police 👮‍♀️</h1>

      {spotifyVisible && (
        <div
          className={`factor ${fadeSpotify ? 'fade-out' : ''}`}
          onClick={spotify_click}
        >
          <FontAwesomeIcon icon={faSpotify} size="3x" color="#1DB954" />
          <h2>Spotify</h2>
        </div>
      )}

      {calendarVisible && (
        <div
          className={`factor ${fadeCalendar ? 'fade-out' : ''}`}
          onClick={calendar_click}
        >
          <FontAwesomeIcon icon={faCalendarDays} size="3x" color="#4285F4" />
          <h2>Google Calendar</h2>
        </div>
      )}

      {startVisible && (
        <div className="factor">
          <h2>Start</h2>
        </div>
      )}

      {status && <p>{status}</p>}
    </div>
  );
}

export default App;





