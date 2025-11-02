console.log("🎯 Background service worker running");

let sessionActive = false;
let musicFeaturesInterval = null;

// Listen to messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Original saveState functionality
  if (message.action === "saveState") {
    chrome.storage.local.set(message.data, () => {
      sendResponse({ status: "saved" });
    });
    return true; // Indicates async sendResponse
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
    sendResponse({ 
      active: sessionActive,
      timestamp: Date.now()
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
// SESSION MANAGEMENT
// ============================================

function startSession() {
  if (sessionActive) {
    console.log('⚠️ Session already active');
    return;
  }
  
  console.log('🚀 Starting session...');
  sessionActive = true;
  
  chrome.storage.local.set({ 
    session_active: true,
    session_start_time: Date.now()
  });
  
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
  sessionActive = false;
  
  chrome.storage.local.get(['session_start_time'], (result) => {
    const duration = Date.now() - (result.session_start_time || Date.now());
    const minutes = Math.floor(duration / 60000);
    
    chrome.storage.local.set({ 
      session_active: false,
      last_session_duration: minutes
    });
    
    // Stop fetching music features
    stopMusicFeaturesFetching();
    
    // Show notification with duration
    if (chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Session Ended',
        message: `Great work! Session lasted ${minutes} minutes. 🎉`
      });
    }
  });
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
  }, 60000); // 1 minute
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
          
          // Add current features to history
          history.push({
            ...data,
            timestamp: Date.now(),
            time_string: timestamp
          });
          
          // Keep only last 100 entries
          if (history.length > 100) {
            history.shift();
          }
          
          chrome.storage.local.set({ 
            latest_music_features: data,
            music_features_timestamp: Date.now(),
            music_history: history
          });
        });
        
        // Log full JSON (can be collapsed in console)
        console.log('📄 Full JSON:', data);
        
      } else {
        console.log('⚠️ No music playing or error:', data.error);
        
        // Save null to indicate no music
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

// Optional: detect navigation to login/auth pages
if (chrome.webNavigation) {
  chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    if (details.url.includes("login") || details.url.includes("auth")) {
      console.log("User navigated to login/auth page:", details.url);
      // Save navigation event
      chrome.storage.local.get(['auth_navigation_history'], (result) => {
        const history = result.auth_navigation_history || [];
        history.push({
          url: details.url,
          timestamp: Date.now()
        });
        
        // Keep only last 20
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
  
  // Check if there was an active session before update
  chrome.storage.local.get(['session_active'], (result) => {
    if (result.session_active) {
      console.log('📌 Resuming previous session...');
      startSession();
    }
  });
});

chrome.runtime.onStartup.addListener(() => {
  console.log('🔄 Browser started, extension loaded');
  
  // Resume session if it was active
  chrome.storage.local.get(['session_active'], (result) => {
    if (result.session_active) {
      console.log('📌 Resuming session from previous browser session...');
      startSession();
    }
  });
});

// Keep service worker alive (Chrome can sometimes suspend it)
setInterval(() => {
  chrome.storage.local.get(['session_active'], (result) => {
    // Just a keepalive check
    if (result.session_active && !sessionActive) {
      console.log('⚠️ Service worker was suspended. Restarting session...');
      startSession();
    }
  });
}, 30000); // Check every 30 seconds

console.log('✅ Background service worker fully initialized and ready!');