chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "quickmeme-image",
    title: "Open with QuickMeme",
    contexts: ["image"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "quickmeme-image") {
    await chrome.storage.local.set({
      currentImageUrl: info.srcUrl,
    });

    try {
      await chrome.action.openPopup();
    } catch (error) {
      console.log(
        "Please click the QuickMeme extension icon to open the editor"
      );
    }
  }
});
