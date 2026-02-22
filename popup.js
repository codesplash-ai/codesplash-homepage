class PopupManager {
    constructor() {
        this.init();
    }

    async init() {
        await this.loadStats();
        this.setupEventListeners();
    }

    async loadStats() {
        try {
            const result = await chrome.storage.local.get(['bookmarks', 'lastUpdated']);
            const bookmarks = result.bookmarks || [];
            const lastUpdated = result.lastUpdated;

            // Update bookmark count
            document.getElementById('bookmarkCount').textContent = bookmarks.length;

            // Update last updated time
            if (lastUpdated) {
                const date = new Date(lastUpdated);
                document.getElementById('lastUpdated').textContent = date.toLocaleDateString();
            } else {
                document.getElementById('lastUpdated').textContent = 'Never';
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    setupEventListeners() {
        // Open new tab with homepage
        document.getElementById('openNewTab').addEventListener('click', () => {
            chrome.tabs.create({ url: 'chrome://newtab/' });
            window.close();
        });

        // Add current page as bookmark
        document.getElementById('addCurrentPage').addEventListener('click', async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                await this.addBookmarkFromTab(tab);
                await this.loadStats(); // Refresh stats
            } catch (error) {
                console.error('Error adding current page:', error);
            }
        });

        // Open settings (just opens new tab for now)
        document.getElementById('openSettings').addEventListener('click', () => {
            chrome.tabs.create({ url: 'chrome://newtab/' });
            window.close();
        });
    }

    async addBookmarkFromTab(tab) {
        try {
            // Get existing bookmarks
            const result = await chrome.storage.local.get(['bookmarks']);
            const bookmarks = result.bookmarks || [];
            
            // Check if bookmark already exists
            const existingBookmark = bookmarks.find(bookmark => bookmark.url === tab.url);
            if (existingBookmark) {
                this.showMessage('Bookmark already exists!');
                return;
            }
            
            // Get favicon URL
            const domain = new URL(tab.url).hostname;
            const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
            
            // Create new bookmark
            const newBookmark = {
                id: Date.now().toString(),
                title: tab.title,
                url: tab.url,
                icon: favicon,
                customIcon: false,
                iconFilename: null,
                order: bookmarks.length
            };
            
            // Add to bookmarks array
            bookmarks.push(newBookmark);
            
            // Save to storage with timestamp
            await chrome.storage.local.set({ 
                bookmarks,
                lastUpdated: Date.now()
            });
            
            this.showMessage('Bookmark added successfully!');
            
        } catch (error) {
            console.error('Error adding bookmark:', error);
            this.showMessage('Error adding bookmark');
        }
    }

    showMessage(message) {
        // Create a temporary message element
        const messageEl = document.createElement('div');
        messageEl.style.cssText = `
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(255, 255, 255, 0.9);
            color: #333;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 1000;
        `;
        messageEl.textContent = message;
        document.body.appendChild(messageEl);

        // Remove after 2 seconds
        setTimeout(() => {
            messageEl.remove();
        }, 2000);
    }
}

// Initialize when popup loads
document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});