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
  startCalendarFetching();
  
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
  stopCalendarFetching();
  
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

async function fetchActiveTabs() {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`\n🌐 [${timestamp}] Fetching active tabs...`);
  
  try {
    // Get all tabs
    const tabs = await chrome.tabs.query({});
    
    // Extract domains and remove duplicates
    const urlSet = new Set();
    
    tabs.forEach(tab => {
      if (tab.url && !tab.url.startsWith('chrome://')) {
        try {
          const urlObj = new URL(tab.url);
          
          // Get domain + first path segment
          const pathParts = urlObj.pathname.split('/').filter(p => p);
          const firstPath = pathParts.length > 0 ? '/' + pathParts[0] : '';
          
          const shortUrl = urlObj.hostname + firstPath;
          urlSet.add(shortUrl);
          
        } catch (e) {
          // Invalid URL, skip
        }
      }
    });
    
    const urls = Array.from(urlSet);
    
    if (urls.length === 0) {
      console.log('⚠️ No valid URLs to analyze');
      return;
    }
    
    console.log(`   📑 ${tabs.length} tabs → ${urls.length} unique domains`);
    console.log(`   📋 Domains:`, urls.slice(0, 10).join(', '));
    
    // Send to Flask backend
    const response = await fetch('http://127.0.0.1:8888/get_active_tabs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ urls })
    });
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Tab Analysis Retrieved:');
        console.log(`   📊 Average Score: ${data.average_score}`);
        console.log(`   📈 Productivity: ${(data.average_score * 100).toFixed(0)}%`);
        console.log('');
        
        // Save to storage
        chrome.storage.local.get(['tab_history'], (result) => {
          const history = result.tab_history || [];
          
          history.push({
            average_score: data.average_score,
            urls_count: data.urls_count,
            unique_domains: urls.length,
            total_tabs: tabs.length,
            timestamp: Date.now(),
            time_string: timestamp
          });
          
          if (history.length > 100) {
            history.shift();
          }
          
          chrome.storage.local.set({ 
            latest_tab_analysis: data,
            tab_analysis_timestamp: Date.now(),
            tab_history: history
          });
        });
        
        console.log('📄 Full JSON:', data);
        
      } else {
        console.log('⚠️ Error:', data.error);
      }
    } else {
      console.log(`❌ Failed to fetch. Status: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Error fetching tab analysis:', error);
  }
}

// Update startMusicFeaturesFetching to also fetch tabs
function startMusicFeaturesFetching() {
  console.log('🎵 Starting music features monitoring...');
  console.log('🌐 Starting tab analysis monitoring...');
  
  // Fetch immediately
  fetchMusicFeatures();
  fetchActiveTabs();
  
  // Then fetch every 60 seconds
  musicFeaturesInterval = setInterval(() => {
    fetchMusicFeatures();
    fetchActiveTabs();
  }, 60000);
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

//=========================================================================================
// CALENDAR
//========================================================================================
//=========================================================================================
// CALENDAR FUNCTIONS
//========================================================================================
// ============================================
// GOOGLE CALENDAR FETCHING
// ============================================

let calendarInterval = null;

function startCalendarFetching() {
  console.log('📅 Starting Google Calendar monitoring...');

  fetchCalendarEvents(); // fetch immediately

  // Fetch every 5 minutes (300000 ms)
  calendarInterval = setInterval(() => {
    fetchCalendarEvents();
  }, 300000);
}

function stopCalendarFetching() {
  if (calendarInterval) {
    clearInterval(calendarInterval);
    calendarInterval = null;
    console.log('🛑 Stopped Google Calendar monitoring');
  }
}

async function fetchCalendarEvents() {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`\n📅 [${timestamp}] Fetching calendar events...`);

  try {
    const response = await fetch('http://127.0.0.1:8888/get_calendar_events');
    const data = await response.json();

    if (response.ok && data.status === 'success') {
      console.log(`✅ Retrieved ${data.count} calendar events`);
      
      // Store in local storage
      chrome.storage.local.get(['calendar_history'], (result) => {
        const history = result.calendar_history || [];
        history.push({
          events: data.events,
          count: data.count,
          timestamp: Date.now(),
          time_string: timestamp
        });

        if (history.length > 50) history.shift();

        chrome.storage.local.set({
          latest_calendar_events: data,
          calendar_history: history
        });
      });
    } else {
      console.log(`⚠️ Calendar error: ${data.error || 'Unknown'}`);
      chrome.storage.local.set({
        latest_calendar_events: null,
        calendar_last_error: data.error || 'No data'
      });
    }
  } catch (error) {
    console.error('❌ Error fetching calendar events:', error);
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