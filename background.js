// Background script for Chrome extension
chrome.runtime.onInstalled.addListener(() => {
    console.log('CodeSplash Homepage extension installed');
    
    // Create context menu items
    chrome.contextMenus.create({
        id: 'addBookmark',
        title: 'Add to Homepage',
        contexts: ['page']
    });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'addBookmark') {
        // Get the current tab's info and add it as a bookmark
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const currentTab = tabs[0];
            if (currentTab) {
                addBookmarkFromTab(currentTab);
            }
        });
    }
});

async function addBookmarkFromTab(tab) {
    try {
        // Get existing bookmarks
        const result = await chrome.storage.local.get(['bookmarks']);
        const bookmarks = result.bookmarks || [];
        
        // Get favicon URL
        const domain = new URL(tab.url).hostname;
        const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
        
        // Create new bookmark (default to main folder)
        const newBookmark = {
            id: Date.now().toString(),
            title: tab.title,
            url: tab.url,
            icon: favicon,
            customIcon: false,
            iconFilename: null,
            folderId: 'main',
            order: bookmarks.length
        };
        
        // Add to bookmarks array
        bookmarks.push(newBookmark);
        
        // Save to storage
        await chrome.storage.local.set({ bookmarks });
        
        
        // Show notification
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon48.png',
            title: 'Bookmark Added',
            message: `Added "${tab.title}" to Homepage`
        });
        
    } catch (error) {
    }
}

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
    // Open new tab page
    chrome.tabs.create({ url: 'chrome://newtab/' });
});