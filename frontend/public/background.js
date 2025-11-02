console.log("🎯 Background service worker running");

let sessionActive = false;
let musicFeaturesInterval = null;
let timerInterval = null;
let sessionStartTime = null;

// Listen to messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Original saveState functionality
  if (message.action === "saveState") {
    chrome.storage.local.set(message.data, () => {
      sendResponse({ status: "saved" });
    });
    return true;
  }

  // Original ping functionality
  if (message.action === "ping") {
    sendResponse({ status: "pong" });
    return true;
  }

  // Session management
  if (message.action === 'startSession') {
    startSession();
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'stopSession') {
    stopSession();
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'getSessionStatus') {
    chrome.storage.local.get(['session_active', 'session_start_time', 'elapsed_seconds'], (result) => {
      let currentElapsed = result.elapsed_seconds || 0;
      
      // Calculate current elapsed time if session is running
      if (result.session_active && result.session_start_time) {
        const now = Date.now();
        currentElapsed = Math.floor((now - result.session_start_time) / 1000);
      }
      
      sendResponse({ 
        active: result.session_active || false,
        elapsed_seconds: currentElapsed,
        session_start_time: result.session_start_time
      });
    });
    return true;
  }
  
  // Auth management
  if (message.action === 'checkAuth') {
    chrome.storage.local.get(['spotifyAuthorized'], (result) => {
      sendResponse({ authenticated: result.spotifyAuthorized || false });
    });
    return true;
  }
  
  if (message.action === 'setAuth') {
    chrome.storage.local.set({ spotifyAuthorized: true }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// ============================================
// SESSION MANAGEMENT WITH TIMER
// ============================================

function startSession() {
  if (sessionActive) {
    console.log('⚠️ Session already active');
    return;
  }
  
  console.log('🚀 Starting session...');
  sessionActive = true;
  sessionStartTime = Date.now();
  
  // Save to storage
  chrome.storage.local.set({ 
    session_active: true,
    session_start_time: sessionStartTime,
    elapsed_seconds: 0
  });
  
  // Start timer
  startTimer();
  
  // Start fetching music features
  startMusicFeaturesFetching();
  
  // Show notification
  if (chrome.notifications) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Session Started',
      message: 'Monitoring your productivity! 🎵'
    });
  }
}

function stopSession() {
  if (!sessionActive) {
    console.log('⚠️ No active session');
    return;
  }
  
  console.log('🛑 Stopping session...');
  
  // Calculate final duration
  const duration = Date.now() - sessionStartTime;
  const minutes = Math.floor(duration / 60000);
  const totalSeconds = Math.floor(duration / 1000);
  
  sessionActive = false;
  
  // Stop timer
  stopTimer();
  
  // Stop music features
  stopMusicFeaturesFetching();
  
  // Save to storage
  chrome.storage.local.set({ 
    session_active: false,
    session_start_time: null,
    elapsed_seconds: totalSeconds,
    last_session_duration: minutes
  });
  
  // Show notification with duration
  if (chrome.notifications) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Session Ended',
      message: `Great work! Session lasted ${minutes} minutes. 🎉`
    });
  }
}

// ============================================
// TIMER LOGIC (Runs in Background)
// ============================================

function startTimer() {
  console.log('⏱️ Starting background timer...');
  
  // Update every second
  timerInterval = setInterval(() => {
    if (sessionActive && sessionStartTime) {
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - sessionStartTime) / 1000);
      
      // Save to storage so popup can read it
      chrome.storage.local.set({ 
        elapsed_seconds: elapsedSeconds 
      });
      
      // Log every minute
      if (elapsedSeconds % 60 === 0) {
        const minutes = Math.floor(elapsedSeconds / 60);
        console.log(`⏱️ Session running: ${minutes} minutes`);
      }
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
    console.log('⏸️ Timer stopped');
  }
}

// ============================================
// MUSIC FEATURES FETCHING
// ============================================

function startMusicFeaturesFetching() {
  console.log('🎵 Starting music features monitoring...');
  
  // Fetch immediately
  fetchMusicFeatures();
  
  // Then fetch every 60 seconds
  musicFeaturesInterval = setInterval(() => {
    fetchMusicFeatures();
  }, 60000);
}

function stopMusicFeaturesFetching() {
  if (musicFeaturesInterval) {
    clearInterval(musicFeaturesInterval);
    musicFeaturesInterval = null;
    console.log('⏸️ Stopped music features monitoring');
  }
}

async function fetchMusicFeatures() {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`\n📊 [${timestamp}] Fetching music features...`);
  
  try {
    const response = await fetch('http://127.0.0.1:8888/get_music_features');
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Music Features Retrieved:');
        console.log(`   🎵 Track: "${data.track_name}" by ${data.artist}`);
        console.log(`   💃 Danceability: ${data.features.danceability}`);
        console.log(`   🎹 Tempo: ${data.features.tempo} BPM`);
        console.log(`   ⚡ Energy: ${data.features.energy}`);
        console.log('');
        
        // Save to storage with history
        chrome.storage.local.get(['music_history'], (result) => {
          const history = result.music_history || [];
          
          history.push({
            ...data,
            timestamp: Date.now(),
            time_string: timestamp
          });
          
          if (history.length > 100) {
            history.shift();
          }
          
          chrome.storage.local.set({ 
            latest_music_features: data,
            music_features_timestamp: Date.now(),
            music_history: history
          });
        });
        
        console.log('📄 Full JSON:', data);
        
      } else {
        console.log('⚠️ No music playing or error:', data.error);
        
        chrome.storage.local.set({ 
          latest_music_features: null,
          music_features_timestamp: Date.now()
        });
      }
    } else {
      console.log(`❌ Failed to fetch. Status: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Error fetching music features:', error);
  }
}

// ============================================
// WEB NAVIGATION MONITORING
// ============================================

if (chrome.webNavigation) {
  chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    if (details.url.includes("login") || details.url.includes("auth")) {
      console.log("User navigated to login/auth page:", details.url);
      
      chrome.storage.local.get(['auth_navigation_history'], (result) => {
        const history = result.auth_navigation_history || [];
        history.push({
          url: details.url,
          timestamp: Date.now()
        });
        
        if (history.length > 20) {
          history.shift();
        }
        
        chrome.storage.local.set({ auth_navigation_history: history });
      });
    }
  }, { url: [{ urlMatches: ".*" }] });
}

// ============================================
// INITIALIZATION & PERSISTENCE
// ============================================

chrome.runtime.onInstalled.addListener(() => {
  console.log('🚀 Procrastination Police extension installed/updated');
  
  // Check if there was an active session
  chrome.storage.local.get(['session_active', 'session_start_time'], (result) => {
    if (result.session_active && result.session_start_time) {
      console.log('📌 Resuming previous session...');
      sessionActive = true;
      sessionStartTime = result.session_start_time;
      startTimer();
      startMusicFeaturesFetching();
    }
  });
});

chrome.runtime.onStartup.addListener(() => {
  console.log('🔄 Browser started, extension loaded');
  
  // Resume session if it was active
  chrome.storage.local.get(['session_active', 'session_start_time'], (result) => {
    if (result.session_active && result.session_start_time) {
      console.log('📌 Resuming session from previous browser session...');
      sessionActive = true;
      sessionStartTime = result.session_start_time;
      startTimer();
      startMusicFeaturesFetching();
    }
  });
});

// Keep service worker alive
setInterval(() => {
  chrome.storage.local.get(['session_active', 'session_start_time'], (result) => {
    if (result.session_active && !sessionActive) {
      console.log('⚠️ Service worker was suspended. Restarting session...');
      sessionActive = true;
      sessionStartTime = result.session_start_time;
      startTimer();
      startMusicFeaturesFetching();
    }
  });
}, 30000);

console.log('✅ Background service worker fully initialized and ready!');