console.log("Background service worker running");

// Listen to messages from popup to save state persistently
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "saveState") {
    chrome.storage.local.set(message.data, () => {
      sendResponse({ status: "saved" });
    });
    return true; // Indicates async sendResponse
  }

  if (message.action === "ping") {
    sendResponse({ status: "pong" });
  }
});

// Optional: detect navigation to login/auth pages
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.url.includes("login") || details.url.includes("auth")) {
    console.log("User navigated to login/auth page:", details.url);
    // You can trigger saving or other actions here if needed
    // For example, you might want to notify popup or save extra state
  }
}, { url: [{ urlMatches: ".*" }] });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle getTabs
  if (message.action === "getTabs") {
    chrome.tabs.query({}, async (tabs) => {
      const tabData = tabs.map((tab) => ({
        id: tab.id,
        title: tab.title,
        url: tab.url,
      }));

      // Send to AI backend
      try {
        const response = await fetch("http://127.0.0.1:8888/analyze_tabs", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tabs: tabData }),
        });

        const result = await response.json();

        console.log("AI analysis result:", result);
        sendResponse({ tabs: tabData, aiResult: result });
      } catch (error) {
        console.error("Failed to send tab data to backend:", error);
        sendResponse({ error: "Backend connection failed" });
      }
    });

    // Return true to keep sendResponse async
    return true;
  }

  // Start/stop session handlers (optional)
  if (message.action === "startSession") {
    console.log("Session started");
    sendResponse({ success: true });
  }

  if (message.action === "stopSession") {
    console.log("Session stopped");
    sendResponse({ success: true });
  }
});



