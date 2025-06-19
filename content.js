chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "openQuickMeme") {
    chrome.runtime.sendMessage({
      action: "openMemeEditor",
      imageUrl: request.imageUrl,
    });
  }
});
