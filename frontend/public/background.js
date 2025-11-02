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

async function startSession() {
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
  
// Start activity tracker via main server (same server!)
  try {
    const response = await fetch('http://127.0.0.1:8888/api/start_activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Activity tracker started:', data.message);
    } else {
      console.log('⚠️ Could not start activity tracker');
    }
  } catch (error) {
    console.warn('⚠️ Activity tracker error:', error.message);
  }

  // Start fetching music features
  startMusicFeaturesFetching();
  startCalendarFetching();
  
  // Show notification
  if (chrome.notifications) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'Session Started',
      message: 'Monitoring your productivity! 🎵'
    });
  }
}

async function stopSession() {
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
  
  // Stop activity tracker via main server
  try {
    const response = await fetch('http://127.0.0.1:8888/api/stop_activity', {
      method: 'POST'
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Activity tracker stopped:', data.message);
    }
  } catch (error) {
    console.error('❌ Error stopping activity tracker:', error);
  }

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
      iconUrl: 'icon.png',
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


function startMusicFeaturesFetching() {
  console.log('🎵 Starting music features monitoring...');
  console.log('🌐 Starting tab analysis monitoring...');
  console.log('⌨️  Starting activity monitoring...');
  console.log('🤖 Starting procrastination prediction...');
  
  // Fetch immediately
  fetchMusicFeatures();
  fetchActiveTabs();
  fetchCalendarEvents();
  fetchActivityStats();

  setTimeout(() => {
    makeProcrastinationPrediction();
  }, 5000); // Wait 5 seconds for data to populate
  
  // Then fetch every 60 seconds
  musicFeaturesInterval = setInterval(() => {
    fetchMusicFeatures();
    fetchActiveTabs();
    fetchCalendarEvents();

    setTimeout(() => {
      makeProcrastinationPrediction();
    }, 3000); // Wait 3 seconds for all data to arrive
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

      if (response.ok && data.status === 'success') {
        console.log(`✅ Retrieved ${data.count} calendar events`);

        if (data.next_event) {
          console.log(`📅 Next event: ${data.next_event.summary}`);
          if (data.minutes_until !== undefined)
            console.log(`⏰ Starts in: ${data.minutes_until} minutes`);
        } else {
            console.log("ℹ️ No upcoming events found");
        }

  // (keep your chrome.storage.local saving code here)
}

      
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

async function makeProcrastinationPrediction() {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`\n🤖 [${timestamp}] Making procrastination prediction...`);
  
  try {
    // Gather all data from Chrome storage
    const data = await new Promise((resolve) => {
      chrome.storage.local.get([
        'latest_music_features',
        'latest_tab_analysis',
        'latest_calendar_events',
        'activity_stats'  // You'll need to store this from your activity tracker
      ], (result) => {
        resolve(result);
      });
    });
    
    // Get current time info
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
    const minutesIntoDay = hour * 60 + minute;
    
    // Extract music features
    const musicData = data.latest_music_features;
    const hasSpotify = musicData && musicData.success ? 1 : 0;
    const danceability = musicData?.features?.danceability || 0;
    const tempo = musicData?.features?.tempo || 0;
    const energy = musicData?.features?.energy || 0;
    
    // Extract tab productivity
    const tabData = data.latest_tab_analysis;
    const tabProductivity = tabData?.average_score || 0.5;
    
    // Extract calendar data
    const calendarData = data.latest_calendar_events;
    const minutesBefore = calculateMinutesBefore(calendarData);
    const minutesAfter = calculateMinutesAfter(calendarData);
    const minutesToNext = calculateMinutesToNext(calendarData);
    
    // Extract activity data (keystrokes, mouse moves, clicks)
    const activityData = data.activity_stats || {};
    const keystrokes = activityData.keystrokes_per_minute || 0;
    const mouseMoves = activityData.mouse_moves_per_minute || 0;
    const mouseClicks = activityData.mouse_clicks_per_minute || 0;
    
    // Build feature object matching ML model's expected format
    const features = {
      'Hour': hour,
      'Minute': minute,
      'Day of week': dayOfWeek,
      'Keystrokes per min': keystrokes,
      'Mouse moves per min': mouseMoves,
      'Mouse clicks per min': mouseClicks,
      'Productivity of Active Chrome Tabs': tabProductivity,
      'Total Minutes of Events Before': minutesBefore,
      'Total Minutes of Events After': minutesAfter,
      'Total Minutes to Next Event': minutesToNext,
      'Spotify': hasSpotify,
      'Danceability': danceability,
      'Tempo': tempo,
      'Energy': energy,
      'Minutes_Into_Day': minutesIntoDay
    };
    
    console.log('📊 Features collected:');
    console.log(`   Time: ${hour}:${minute}, Day: ${dayOfWeek}`);
    console.log(`   Activity: ${keystrokes} keys, ${mouseClicks} clicks`);
    console.log(`   Tab productivity: ${(tabProductivity * 100).toFixed(0)}%`);
    console.log(`   Music: ${hasSpotify ? 'Yes' : 'No'}`);
    console.log(`   Calendar: ${minutesToNext}min to next event`);
    
    // Send to Flask backend for prediction
    const response = await fetch('http://127.0.0.1:8888/get_procrastination_prediction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(features)
    });
    
    if (response.ok) {
      const result = await response.json();
      
      if (result.success) {
        const prediction = result.prediction;
        const isProcrastinating = result.procrastinating;
        
        console.log('✅ Prediction Retrieved:');
        console.log(`   🎯 Score: ${prediction.toFixed(3)}`);
        console.log(`   📊 Probability: ${(prediction * 100).toFixed(1)}%`);
        console.log(`   🚨 Status: ${isProcrastinating ? 'PROCRASTINATING' : 'Productive'}`);
        console.log('');
        
        // Save to storage
        chrome.storage.local.get(['prediction_history'], (storageResult) => {
          const history = storageResult.prediction_history || [];
          
          history.push({
            prediction: prediction,
            procrastinating: isProcrastinating,
            features: features,
            timestamp: Date.now(),
            time_string: timestamp
          });
          
          if (history.length > 100) {
            history.shift();
          }
          
          chrome.storage.local.set({ 
            latest_prediction: result,
            prediction_timestamp: Date.now(),
            prediction_history: history
          });
        });
        
        // Show notification if procrastinating
        if (isProcrastinating && chrome.notifications) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon.png',
            title: '🚨 Procrastination Alert!',
            message: `${(prediction * 100).toFixed(0)}% chance you're procrastinating! Get back to work!`,
            priority: 2
          });
        }
        
      } else {
        console.log('⚠️ Prediction error:', result.error);
      }
    } else {
      console.log(`❌ Failed to get prediction. Status: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Error making prediction:', error);
  }
}

function calculateMinutesBefore(calendarData) {
  if (!calendarData || !calendarData.events) return 0;
  
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  
  let totalMinutes = 0;
  
  calendarData.events.forEach(event => {
    const eventDate = event.start.split('T')[0];
    if (eventDate === todayStr) {
      const eventTime = new Date(event.start);
      if (eventTime < now) {
        // Event was earlier today
        const duration = event.duration || 60; // Assume 60 min if not specified
        totalMinutes += duration;
      }
    }
  });
  
  return totalMinutes;
}

function calculateMinutesAfter(calendarData) {
  if (!calendarData || !calendarData.events) return 0;
  
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  
  let totalMinutes = 0;
  
  calendarData.events.forEach(event => {
    const eventDate = event.start.split('T')[0];
    if (eventDate === todayStr) {
      const eventTime = new Date(event.start);
      if (eventTime > now) {
        // Event is later today
        const duration = event.duration || 60;
        totalMinutes += duration;
      }
    }
  });
  
  return totalMinutes;
}

function calculateMinutesToNext(calendarData) {
  if (!calendarData || !calendarData.next_event) return 999; // Large number if no events
  
  if (calendarData.minutes_until !== undefined) {
    return calendarData.minutes_until;
  }
  
  const now = new Date();
  const nextEventTime = new Date(calendarData.next_event.start);
  const diffMs = nextEventTime - now;
  const diffMinutes = Math.floor(diffMs / 60000);
  
  return Math.max(0, diffMinutes);
}

// Update startMusicFeaturesFetching to also call prediction
function startMusicFeaturesFetching() {
  console.log('🎵 Starting music features monitoring...');
  console.log('🌐 Starting tab analysis monitoring...');
  console.log('🤖 Starting procrastination prediction...');
  
  // Fetch immediately
  fetchMusicFeatures();
  fetchActiveTabs();
  fetchCalendarEvents();
  fetchActivityStats();
  
  // Wait a bit for data to be collected, then make first prediction
  setTimeout(() => {
    makeProcrastinationPrediction();
  }, 10000); // Wait 5 seconds for data to populate
  
  // Then fetch every 60 seconds
  musicFeaturesInterval = setInterval(() => {
    fetchMusicFeatures();
    fetchActiveTabs();
    fetchCalendarEvents();
    fetchActivityStats();
    
    // Make prediction after data is collected
    setTimeout(() => {
      makeProcrastinationPrediction();
    }, 10000); // Wait 3 seconds for all data to arrive
  }, 60000);
}

async function fetchActivityStats() {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`\n⌨️ [${timestamp}] Fetching activity stats...`);
  
  try {
    const response = await fetch('http://127.0.0.1:8888/api/activity');
    
    if (response.ok) {
      const data = await response.json();
      
      console.log('✅ Activity Stats Retrieved:');
      console.log(`   ⌨️  Keystrokes/min: ${data.keystrokes_per_minute}`);
      console.log(`   🖱️  Mouse moves/min: ${data.mouse_moves_per_minute}`);
      console.log(`   🖱️  Mouse clicks/min: ${data.mouse_clicks_per_minute}`);
      console.log('');
      
      // Save to storage
      chrome.storage.local.set({ 
        activity_stats: {
          keystrokes_per_minute: data.keystrokes_per_minute,
          mouse_moves_per_minute: data.mouse_moves_per_minute,
          mouse_clicks_per_minute: data.mouse_clicks_per_minute,
          timestamp: Date.now(),
          time_string: timestamp
        }
      });
      
    } else {
      console.log(`⚠️ Activity API returned status: ${response.status}`);
    }
  } catch (error) {
    console.warn('⚠️ Could not fetch activity stats:', error.message);
    // Save default values
    chrome.storage.local.set({ 
      activity_stats: {
        keystrokes_per_minute: 0,
        mouse_moves_per_minute: 0,
        mouse_clicks_per_minute: 0,
        timestamp: Date.now(),
        available: false
      }
    });
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