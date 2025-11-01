import { useState } from 'react';
import './App.css';

function App() {
  const [status, setStatus] = useState('');

  const spotify_click = async () => {
    setStatus('Authorizing...');
    try {
      const res = await fetch("http://127.0.0.1:5000/open_spotify");
      if (res.ok) {
        setStatus('Opening Spotify...');
      } else {
        setStatus('Error: Backend not responding');
      }
    } catch (err) {
      console.error(err);
      setStatus('Error: Could not reach backend');
    }
  };

  return (
    <div className="popup">
      <h1>Procrastination Police 👮‍♀️</h1>
      <div className="factor" onClick={spotify_click}>
        <h2>Spotify</h2>
        <p>Click to authorize Spotify</p>
      </div>
      {status && <p>{status}</p>}
    </div>
  );
}

export default App;

