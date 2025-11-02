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

