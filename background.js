// Background script for Chrome extension
importScripts('storage-manager.js');

chrome.runtime.onInstalled.addListener((details) => {
    console.log('CodeSplash Homepage extension installed');

    // Flag an update so the new tab page can show what's new
    if (details.reason === 'update' && details.previousVersion) {
        chrome.storage.local.set({ whatsNewPendingFrom: details.previousVersion });
    }

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
        addBookmarkFromTab(tab);
    }
});

async function addBookmarkFromTab(tab) {
    try {
        const storage = new StorageManager();
        await storage.initialize();

        // Get existing bookmarks
        const bookmarks = await storage.get('bookmarks') || [];

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

        // Save to IndexedDB
        await storage.set('bookmarks', bookmarks);

    } catch (error) {
        console.error('Error adding bookmark:', error);
    }
}
