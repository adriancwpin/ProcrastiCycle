// background.js

console.log("Background service worker running");

chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.url.includes("login") || details.url.includes("auth")) {
    console.log("User navigated to login/auth page:", details.url);
    // You can add more logic here if needed,
    // e.g., keep auth state, notify popup, etc.
  }
}, { url: [{ urlMatches: ".*" }] });

// Example listener for messages from popup (optional)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "ping") {
    sendResponse({ status: "pong" });
  }
});
