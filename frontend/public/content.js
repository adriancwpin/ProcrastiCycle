chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "highlightText") {
    document.body.style.backgroundColor = "yellow";
    sendResponse({ success: true });
  }
});
