class Homepage {
    constructor() {
        this.storage = new StorageManager();
        this.bookmarks = [];
        this.folders = [];
        this.currentFolderId = 'main';
        this.settings = {
            backgroundUrl: '',
            backgroundFile: null,
            backgroundFilename: null,
            iconSize: 64,
            titleSize: 14,
            titleColor: '#ffffff',
            gridPosition: 'center-middle',
            maxAppsWidth: 10
        };
        this.draggedElement = null;
        this.draggedIndex = -1;
        this.isDragging = false;
        this.currentEditingIndex = -1;
        this.currentEditingFilename = null;
        this.currentBackgroundFilename = null;
        this.currentEditingFolderId = null;
        this.draggedTab = null;
        this.draggedTabIndex = -1;
        
        this.init();
    }

    async init() {
        try {
            // Initialize storage manager with persistence
            const isPersisted = await this.storage.initialize();
            
            
            await this.loadData();
            await this.migrateToFolders();
            this.setupEventListeners();
            this.renderFolderTabs();
            this.renderBookmarks();
            this.applySettings();
            
            // Add window resize listener for responsive grid
            window.addEventListener('resize', () => {
                this.applyGridSettings();
            });
            
            // Show storage usage info
            const usage = await this.storage.getStorageUsage();
            if (usage) {
            }
        } catch (error) {
            console.error('Initialization failed:', error);
            this.showError('Failed to initialize extension. Please refresh the page.');
        }
    }

    async createBackup() {
        try {
            // This is now handled by the storage manager during migration
            // The storage manager creates backups automatically
        } catch (error) {
            console.error('Error with backup:', error);
        }
    }

    async loadData() {
        try {
            this.bookmarks = await this.storage.get('bookmarks') || [];
            this.folders = await this.storage.get('folders') || [];
            const settings = await this.storage.get('settings', 'main');
            this.settings = { ...this.settings, ...settings };
            
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    async migrateToFolders() {
        try {
            // Check if migration is needed
            if (this.folders.length === 0 && this.bookmarks.length > 0) {
                
                // Create Main folder with current settings
                const mainFolder = {
                    id: 'main',
                    name: 'Main',
                    order: 0,
                    isDefault: true,
                    backgroundFile: this.settings.backgroundFile || null,
                    backgroundFilename: this.settings.backgroundFilename || null,
                    backgroundUrl: this.settings.backgroundUrl || '',
                    inheritBackground: false
                };
                
                this.folders = [mainFolder];
                
                // Assign all existing bookmarks to Main folder and ensure they have IDs
                this.bookmarks.forEach((bookmark, index) => {
                    if (!bookmark.folderId) {
                        bookmark.folderId = 'main';
                    }
                    // Ensure bookmark has an ID for sorting
                    if (!bookmark.id) {
                        bookmark.id = `migrated-${Date.now()}-${index}`;
                    }
                });
                
                // Save migration
                await this.saveData();
            } else if (this.folders.length === 0) {
                // No bookmarks, just create Main folder
                const mainFolder = {
                    id: 'main',
                    name: 'Main',
                    order: 0,
                    isDefault: true,
                    backgroundFile: this.settings.backgroundFile || null,
                    backgroundFilename: this.settings.backgroundFilename || null,
                    backgroundUrl: this.settings.backgroundUrl || '',
                    inheritBackground: false
                };
                
                this.folders = [mainFolder];
                await this.saveData();
            }
        } catch (error) {
            console.error('Error during migration:', error);
        }
    }

    async saveData() {
        try {
            await this.storage.set('bookmarks', this.bookmarks);
            await this.storage.set('folders', this.folders);
            await this.storage.set('settings', this.settings, 'main');
        } catch (error) {
            console.error('Error saving data:', error);
        }
    }

    setupEventListeners() {
        // Context menu
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            
            // Check if right-clicking on a bookmark
            const bookmark = e.target.closest('.bookmark');
            if (bookmark && bookmark.dataset.index !== undefined) {
                this.currentEditingIndex = parseInt(bookmark.dataset.index);
                this.showAppContextMenu(e.clientX, e.clientY);
            } else {
                this.showContextMenu(e.clientX, e.clientY);
            }
        });

        document.addEventListener('click', () => {
            this.hideContextMenu();
            this.hideAppContextMenu();
            this.hideFolderTabContextMenu();
        });

        // Homepage context menu items
        document.getElementById('addBookmarkMenu').addEventListener('click', () => {
            this.showAddBookmarkModal();
        });

        document.getElementById('homepageSettingsMenu').addEventListener('click', () => {
            this.showHomepageSettingsModal();
        });

        document.getElementById('addNewFolderMenu').addEventListener('click', () => {
            this.showCreateFolderModal();
        });

        document.getElementById('sortCurrentFolderMenu').addEventListener('click', () => {
            this.sortFolderBookmarks(this.currentFolderId);
        });

        document.getElementById('currentFolderSettingsMenu').addEventListener('click', () => {
            // For Main folder, open Homepage Settings instead of Folder Settings
            if (this.currentFolderId === 'main') {
                this.showHomepageSettingsModal();
            } else {
                // Set the current folder as the one being edited and open settings
                this.currentEditingFolderId = this.currentFolderId;
                this.showFolderSettingsModal();
            }
        });

        // App context menu items
        document.getElementById('editAppMenu').addEventListener('click', () => {
            this.showEditBookmarkModal();
        });

        document.getElementById('deleteAppMenu').addEventListener('click', () => {
            this.deleteBookmark(this.currentEditingIndex);
        });


        // Folder creation modal
        document.getElementById('createFolderForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createFolder();
        });

        document.getElementById('cancelCreateFolder').addEventListener('click', () => {
            this.hideCreateFolderModal();
        });

        // Folder settings modal
        document.getElementById('folderSettingsForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveFolderSettings();
        });

        document.getElementById('cancelFolderSettings').addEventListener('click', () => {
            this.hideFolderSettingsModal();
        });

        // Folder background file input
        document.getElementById('folderBackgroundFile').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                document.getElementById('folderBackgroundChooseButton').textContent = file.name;
                const reader = new FileReader();
                reader.onload = (event) => {
                    this.updateFolderBackgroundPreview(event.target.result);
                };
                reader.readAsDataURL(file);
            }
        });

        document.getElementById('folderBackgroundChooseButton').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            document.getElementById('folderBackgroundFile').click();
        });

        // Persistent storage request button
        document.getElementById('requestPersistentStorage').addEventListener('click', async () => {
            await this.requestPersistentStorage();
        });

        // Folder context menu items
        document.getElementById('renameFolderMenu').addEventListener('click', () => {
            this.showFolderSettingsModal();
        });

        document.getElementById('folderSettingsMenu').addEventListener('click', () => {
            this.showFolderSettingsModal();
        });

        document.getElementById('sortFolderMenu').addEventListener('click', () => {
            this.sortFolderBookmarks(this.currentEditingFolderId);
        });

        document.getElementById('deleteFolderMenu').addEventListener('click', () => {
            this.deleteFolder(this.currentEditingFolderId);
        });

        // Add bookmark modal
        document.getElementById('addBookmarkForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addBookmark();
        });

        document.getElementById('cancelAdd').addEventListener('click', () => {
            this.hideAddBookmarkModal();
        });

        // Edit bookmark modal
        document.getElementById('editBookmarkForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveEditBookmark();
        });

        document.getElementById('cancelEdit').addEventListener('click', () => {
            this.hideEditBookmarkModal();
        });

        // Homepage settings modal
        document.getElementById('saveHomepageSettings').addEventListener('click', () => {
            this.saveHomepageSettings();
        });

        document.getElementById('cancelHomepageSettings').addEventListener('click', () => {
            this.hideHomepageSettingsModal();
        });

        // Settings inputs
        document.getElementById('iconSize').addEventListener('input', (e) => {
            document.getElementById('iconSizeValue').textContent = e.target.value + 'px';
        });

        document.getElementById('titleSize').addEventListener('input', (e) => {
            document.getElementById('titleSizeValue').textContent = e.target.value + 'px';
        });

        document.getElementById('maxAppsWidth').addEventListener('input', (e) => {
            document.getElementById('maxAppsWidthValue').textContent = e.target.value;
        });

        // Background file input
        document.getElementById('backgroundFile').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.currentBackgroundFilename = file.name;
                document.getElementById('backgroundChooseButton').textContent = file.name;
                const reader = new FileReader();
                reader.onload = (event) => {
                    this.settings.backgroundFile = event.target.result;
                    this.settings.backgroundUrl = ''; // Clear URL when file is selected
                    this.updateBackgroundPreview(event.target.result);
                };
                reader.readAsDataURL(file);
            }
        });

        // Background choose button
        document.getElementById('backgroundChooseButton').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            document.getElementById('backgroundFile').click();
        });

        // Edit bookmark icon file input
        document.getElementById('editBookmarkIcon').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.currentEditingFilename = file.name;
                document.getElementById('editIconDisplay').textContent = file.name;
                const reader = new FileReader();
                reader.onload = (event) => {
                    this.updateEditIconPreview(event.target.result);
                };
                reader.readAsDataURL(file);
            }
        });

        // Edit bookmark icon choose button
        document.getElementById('editIconDisplay').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            document.getElementById('editBookmarkIcon').click();
        });

        // Add bookmark icon file input
        document.getElementById('addBookmarkIcon').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                document.getElementById('addIconDisplay').textContent = file.name;
                const reader = new FileReader();
                reader.onload = (event) => {
                    this.updateAddIconPreview(event.target.result);
                };
                reader.readAsDataURL(file);
            }
        });

        // Add bookmark icon choose button
        document.getElementById('addIconDisplay').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            document.getElementById('addBookmarkIcon').click();
        });

        // Close modals on outside click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });
    }

    renderFolderTabs() {
        const tabsContainer = document.getElementById('folderTabs');
        tabsContainer.innerHTML = '';

        // Sort folders by order
        const sortedFolders = [...this.folders].sort((a, b) => a.order - b.order);

        sortedFolders.forEach(folder => {
            const tab = this.createFolderTab(folder);
            tabsContainer.appendChild(tab);
        });

        // Apply folder background
        this.applyFolderBackground();
    }

    createFolderTab(folder) {
        const tab = document.createElement('div');
        tab.className = `folder-tab ${folder.id === this.currentFolderId ? 'active' : ''}`;
        tab.dataset.folderId = folder.id;
        tab.draggable = true;

        // Count bookmarks in this folder
        const bookmarkCount = this.bookmarks.filter(b => b.folderId === folder.id).length;

        tab.innerHTML = `
            <span class="folder-tab-name">${folder.name}</span>
            <span class="bookmark-count-badge">${bookmarkCount}</span>
            ${folder.id === this.currentFolderId ? '<div class="custom-background-indicator"></div>' : ''}
        `;

        // Tab click event
        tab.addEventListener('click', () => {
            if (!this.draggedTab) {
                this.switchToFolder(folder.id);
            }
        });

        // Tab context menu
        tab.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showFolderTabContextMenu(e.clientX, e.clientY, folder.id);
        });

        // Tab drag and drop for reordering
        tab.addEventListener('dragstart', (e) => {
            this.draggedTab = tab;
            this.draggedTabIndex = this.folders.findIndex(f => f.id === folder.id);
            tab.style.opacity = '0.5';
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', folder.id);
        });

        tab.addEventListener('dragend', () => {
            tab.style.opacity = '';
            this.draggedTab = null;
            this.draggedTabIndex = -1;
            
            // Remove all drag-over classes
            document.querySelectorAll('.folder-tab').forEach(t => {
                t.classList.remove('drag-over');
            });
        });

        // Drag and drop for moving bookmarks to folder OR reordering tabs
        tab.addEventListener('dragover', (e) => {
            e.preventDefault();
            
            if (this.draggedTab && this.draggedTab !== tab) {
                // Reordering tabs
                e.dataTransfer.dropEffect = 'move';
                
                // Visual feedback for tab reordering
                const rect = tab.getBoundingClientRect();
                const midpoint = rect.left + rect.width / 2;
                
                if (e.clientX < midpoint) {
                    tab.style.borderLeft = '2px solid rgba(255, 255, 255, 0.6)';
                    tab.style.borderRight = '';
                } else {
                    tab.style.borderRight = '2px solid rgba(255, 255, 255, 0.6)';
                    tab.style.borderLeft = '';
                }
            } else if (this.draggedElement && folder.id !== this.currentFolderId) {
                // Moving bookmark to folder
                e.dataTransfer.dropEffect = 'move';
                tab.classList.add('drag-over');
            }
        });

        tab.addEventListener('dragleave', () => {
            tab.classList.remove('drag-over');
            tab.style.borderLeft = '';
            tab.style.borderRight = '';
        });

        tab.addEventListener('drop', (e) => {
            e.preventDefault();
            
            if (this.draggedTab && this.draggedTab !== tab) {
                // Handle tab reordering
                const targetIndex = this.folders.findIndex(f => f.id === folder.id);
                this.reorderFolderTabs(this.draggedTabIndex, targetIndex);
            } else if (this.draggedElement && this.draggedIndex >= 0) {
                // Handle bookmark moving to folder
                this.moveBookmarkToFolder(this.draggedIndex, folder.id);
            }
            
            tab.classList.remove('drag-over');
            tab.style.borderLeft = '';
            tab.style.borderRight = '';
        });

        return tab;
    }

    switchToFolder(folderId) {
        this.currentFolderId = folderId;
        this.renderFolderTabs();
        this.renderBookmarks();
        this.applyFolderBackground();
    }

    reorderFolderTabs(fromIndex, toIndex) {
        if (fromIndex === toIndex) return;
        
        // Remove the folder from its current position
        const [movedFolder] = this.folders.splice(fromIndex, 1);
        
        // Insert it at the new position
        this.folders.splice(toIndex, 0, movedFolder);
        
        // Update order property for all folders
        this.folders.forEach((folder, index) => {
            folder.order = index;
        });
        
        // Save and re-render
        this.saveData();
        this.renderFolderTabs();
    }

    renderBookmarks() {
        const grid = document.getElementById('bookmarksGrid');
        
        // Clear existing bookmarks
        grid.innerHTML = '';

        // Apply grid settings
        this.applyGridSettings();

        // Filter bookmarks by current folder and sort by order property
        const folderBookmarks = this.bookmarks
            .filter(bookmark => bookmark.folderId === this.currentFolderId)
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        folderBookmarks.forEach((bookmark, index) => {
            const originalIndex = this.bookmarks.indexOf(bookmark);
            const bookmarkElement = this.createBookmarkElement(bookmark, originalIndex);
            grid.appendChild(bookmarkElement);
        });
    }

    applyGridSettings() {
        const grid = document.getElementById('bookmarksGrid');
        const itemWidth = Math.max(100, this.settings.iconSize + 30);
        const gap = 30;
        
        // Use the user's exact setting - no screen width limitations
        const actualColumns = this.settings.maxAppsWidth;
        
        // Set CSS custom properties with user's exact settings
        grid.style.setProperty('--actual-columns', actualColumns);
        grid.style.setProperty('--item-width', `${itemWidth}px`);
        grid.style.setProperty('--gap', `${gap}px`);
        
        // Apply grid position class
        grid.className = `bookmarks-grid ${this.settings.gridPosition}`;
    }

    createBookmarkElement(bookmark, index) {
        const element = document.createElement('a');
        element.className = 'bookmark';
        element.href = bookmark.url;
        element.draggable = true;
        element.dataset.index = index;

        element.innerHTML = `
            <div class="bookmark-icon">
                <img src="${bookmark.icon}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" alt="">
                <div class="fallback-icon" style="display: none;">🌐</div>
            </div>
            <div class="bookmark-title">${bookmark.title}</div>
        `;

        // Prevent default link behavior during drag
        element.addEventListener('click', (e) => {
            if (this.isDragging) {
                e.preventDefault();
            }
        });

        // Drag and drop events
        element.addEventListener('dragstart', (e) => {
            this.isDragging = true;
            this.draggedElement = element;
            this.draggedIndex = index;
            element.classList.add('dragging');
            document.getElementById('bookmarksGrid').classList.add('dragging');
            
            // Create drag preview
            const rect = element.getBoundingClientRect();
            e.dataTransfer.setDragImage(element, rect.width / 2, rect.height / 2);
            e.dataTransfer.effectAllowed = 'move';
            
            setTimeout(() => {
                element.style.opacity = '0.5';
            }, 0);
        });

        element.addEventListener('dragend', () => {
            this.isDragging = false;
            element.classList.remove('dragging');
            document.getElementById('bookmarksGrid').classList.remove('dragging');
            element.style.opacity = '';
            this.draggedElement = null;
            this.draggedIndex = -1;
            
            // Remove drag-over class from all elements
            document.querySelectorAll('.bookmark').forEach(el => {
                el.classList.remove('drag-over');
            });
        });

        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (this.draggedElement && this.draggedElement !== element) {
                e.dataTransfer.dropEffect = 'move';
                element.classList.add('drag-over');
            }
        });

        element.addEventListener('dragleave', () => {
            element.classList.remove('drag-over');
        });

        element.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (this.draggedElement && this.draggedElement !== element) {
                const targetIndex = parseInt(element.dataset.index);
                this.moveBookmark(this.draggedIndex, targetIndex);
            }
            
            element.classList.remove('drag-over');
        });

        return element;
    }

    moveBookmarkToFolder(bookmarkIndex, targetFolderId) {
        if (bookmarkIndex >= 0 && bookmarkIndex < this.bookmarks.length) {
            this.bookmarks[bookmarkIndex].folderId = targetFolderId;
            this.saveData();
            this.renderFolderTabs();
            this.renderBookmarks();
        }
    }

    moveBookmark(fromIndex, toIndex) {
        if (fromIndex === toIndex) return;
        
        // Get the current folder's bookmarks in display order
        const folderBookmarks = this.bookmarks
            .filter(bookmark => bookmark.folderId === this.currentFolderId)
            .sort((a, b) => (a.order || 0) - (b.order || 0));
        
        // Get the bookmarks being moved
        const fromBookmark = this.bookmarks[fromIndex];
        const toBookmark = this.bookmarks[toIndex];
        
        // Find their positions in the sorted folder view
        const fromFolderIndex = folderBookmarks.findIndex(b => b === fromBookmark);
        const toFolderIndex = folderBookmarks.findIndex(b => b === toBookmark);
        
        if (fromFolderIndex === -1 || toFolderIndex === -1) return;
        
        // Reorder within the folder bookmarks array
        const [movedBookmark] = folderBookmarks.splice(fromFolderIndex, 1);
        folderBookmarks.splice(toFolderIndex, 0, movedBookmark);
        
        // Update order properties for all bookmarks in this folder
        folderBookmarks.forEach((bookmark, index) => {
            bookmark.order = index;
        });
        
        this.saveData();
        this.renderBookmarks();
    }

    async addBookmark() {
        const title = document.getElementById('bookmarkTitle').value.trim();
        const url = document.getElementById('bookmarkUrl').value.trim();
        const iconFile = document.getElementById('addBookmarkIcon').files[0];

        if (!title || !url) return;

        let icon;
        let customIcon = false;
        let iconFilename = null;
        
        // Use custom icon if provided, otherwise get favicon
        if (iconFile) {
            try {
                icon = await this.fileToBase64(iconFile);
                customIcon = true;
                iconFilename = iconFile.name;
            } catch (error) {
                console.error('Error converting icon to base64:', error);
                icon = await this.getFavicon(url);
            }
        } else {
            icon = await this.getFavicon(url);
        }

        const bookmark = {
            id: Date.now().toString(),
            title,
            url,
            icon,
            customIcon,
            iconFilename,
            folderId: this.currentFolderId,
            order: this.bookmarks.length
        };

        this.bookmarks.push(bookmark);
        await this.saveData();
        this.renderBookmarks();
        this.hideAddBookmarkModal();
    }

    async getFavicon(url) {
        try {
            const domain = new URL(url).hostname;
            return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
        } catch {
            return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>';
        }
    }

    deleteBookmark(index) {
        if (confirm('Are you sure you want to delete this bookmark?')) {
            this.bookmarks.splice(index, 1);
            this.saveData();
            this.renderBookmarks();
        }
    }

    showContextMenu(x, y) {
        const menu = document.getElementById('contextMenu');
        menu.style.display = 'block';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        // Adjust position if menu goes off screen
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = (x - rect.width) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = (y - rect.height) + 'px';
        }
    }

    hideContextMenu() {
        document.getElementById('contextMenu').style.display = 'none';
    }

    showAppContextMenu(x, y) {
        const menu = document.getElementById('appContextMenu');
        menu.style.display = 'block';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        // Adjust position if menu goes off screen
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = (x - rect.width) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = (y - rect.height) + 'px';
        }
    }

    hideAppContextMenu() {
        document.getElementById('appContextMenu').style.display = 'none';
    }

    showAddBookmarkModal() {
        document.getElementById('addBookmarkModal').style.display = 'flex';
        document.getElementById('bookmarkTitle').focus();
        
        // Reset form and preview
        document.getElementById('addBookmarkForm').reset();
        document.getElementById('addIconDisplay').textContent = 'No file chosen';
        this.updateAddIconPreview(null);
    }

    hideAddBookmarkModal() {
        document.getElementById('addBookmarkModal').style.display = 'none';
        document.getElementById('addBookmarkForm').reset();
        document.getElementById('addIconDisplay').textContent = 'No file chosen';
        this.updateAddIconPreview(null);
    }

    updateAddIconPreview(imageSrc) {
        const preview = document.getElementById('addIconPreview');
        if (imageSrc) {
            preview.innerHTML = `<img src="${imageSrc}" alt="Icon preview">`;
        } else {
            preview.innerHTML = '<div class="placeholder">📷</div>';
        }
    }

    showEditBookmarkModal() {
        if (this.currentEditingIndex >= 0 && this.currentEditingIndex < this.bookmarks.length) {
            const bookmark = this.bookmarks[this.currentEditingIndex];
            document.getElementById('editBookmarkTitle').value = bookmark.title;
            document.getElementById('editBookmarkUrl').value = bookmark.url;
            
            // Reset file input
            document.getElementById('editBookmarkIcon').value = '';
            this.currentEditingFilename = null;
            
            // Show appropriate text based on whether bookmark has custom icon
            if (bookmark.customIcon && bookmark.iconFilename) {
                document.getElementById('editIconDisplay').textContent = bookmark.iconFilename;
            } else if (bookmark.customIcon) {
                document.getElementById('editIconDisplay').textContent = 'Custom icon set';
            } else {
                document.getElementById('editIconDisplay').textContent = 'Using website favicon';
            }
            
            this.updateEditIconPreview(bookmark.icon);
            
            document.getElementById('editBookmarkModal').style.display = 'flex';
            document.getElementById('editBookmarkTitle').focus();
        }
    }

    hideEditBookmarkModal() {
        document.getElementById('editBookmarkModal').style.display = 'none';
        document.getElementById('editBookmarkForm').reset();
        document.getElementById('editIconDisplay').textContent = 'No file chosen';
        this.currentEditingFilename = null;
        this.updateEditIconPreview(null);
    }

    updateEditIconPreview(imageSrc) {
        const preview = document.getElementById('editIconPreview');
        if (imageSrc) {
            preview.innerHTML = `<img src="${imageSrc}" alt="Icon preview">`;
        } else {
            preview.innerHTML = '<div class="placeholder">📷</div>';
        }
    }

    async saveEditBookmark() {
        const title = document.getElementById('editBookmarkTitle').value.trim();
        const url = document.getElementById('editBookmarkUrl').value.trim();
        const iconFile = document.getElementById('editBookmarkIcon').files[0];

        if (!title || !url || this.currentEditingIndex < 0) return;

        const bookmark = this.bookmarks[this.currentEditingIndex];
        bookmark.title = title;
        bookmark.url = url;

        // Update icon if a new one was provided
        if (iconFile) {
            try {
                bookmark.icon = await this.fileToBase64(iconFile);
                bookmark.customIcon = true;
                bookmark.iconFilename = this.currentEditingFilename;
            } catch (error) {
                console.error('Error converting icon to base64:', error);
            }
        } else {
            // If no new file selected, keep existing icon
            // Only update favicon if the URL changed and it's not a custom icon
            if (!bookmark.customIcon) {
                bookmark.icon = await this.getFavicon(url);
            }
        }

        await this.saveData();
        this.renderBookmarks();
        this.hideEditBookmarkModal();
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async showHomepageSettingsModal() {
        // Get Main folder settings
        const mainFolder = this.folders.find(f => f.isDefault);
        if (!mainFolder) {
            console.error('Main folder not found');
            return;
        }

        document.getElementById('iconSize').value = this.settings.iconSize;
        document.getElementById('titleSize').value = this.settings.titleSize;
        document.getElementById('titleColor').value = this.settings.titleColor;
        document.getElementById('gridPosition').value = this.settings.gridPosition;
        document.getElementById('maxAppsWidth').value = this.settings.maxAppsWidth;
        document.getElementById('iconSizeValue').textContent = this.settings.iconSize + 'px';
        document.getElementById('titleSizeValue').textContent = this.settings.titleSize + 'px';
        document.getElementById('maxAppsWidthValue').textContent = this.settings.maxAppsWidth;
        
        // Reset file input
        document.getElementById('backgroundFile').value = '';
        this.currentBackgroundFilename = null;
        
        // Show Main folder background status
        if (mainFolder.backgroundImageId) {
            document.getElementById('backgroundChooseButton').textContent = 'Custom background image set';
            this.updateBackgroundPreviewFromId(mainFolder.backgroundImageId);
        } else {
            document.getElementById('backgroundChooseButton').textContent = 'Using default background';
            this.updateBackgroundPreview(null);
        }
        
        // Update storage usage info
        await this.updateStorageUsageDisplay();
        
        document.getElementById('homepageSettingsModal').style.display = 'flex';
    }

    updateBackgroundPreview(imageSrc) {
        const preview = document.getElementById('backgroundPreview');
        if (imageSrc) {
            preview.innerHTML = `<img src="${imageSrc}" alt="Background preview">`;
        } else {
            preview.innerHTML = '<div class="placeholder">🖼️</div>';
        }
    }

    async updateBackgroundPreviewFromId(imageId) {
        try {
            const imageUrl = await this.storage.getImage(imageId);
            this.updateBackgroundPreview(imageUrl);
        } catch (error) {
            console.error('Error loading background preview:', error);
            this.updateBackgroundPreview(null);
        }
    }

    hideHomepageSettingsModal() {
        document.getElementById('homepageSettingsModal').style.display = 'none';
        this.currentBackgroundFilename = null;
    }

    async saveHomepageSettings() {
        const mainFolder = this.folders.find(f => f.isDefault);
        if (!mainFolder) {
            console.error('Main folder not found');
            return;
        }

        // Handle background file if selected
        const fileInput = document.getElementById('backgroundFile');
        if (fileInput.files[0]) {
            try {
                const file = fileInput.files[0];
                const imageId = `bg-main-${Date.now()}`;
                
                // Save image as blob to IndexedDB
                await this.storage.saveImage(imageId, file);
                
                // Delete old image if exists
                if (mainFolder.backgroundImageId) {
                    await this.storage.deleteImage(mainFolder.backgroundImageId);
                }
                
                mainFolder.backgroundImageId = imageId;
            } catch (error) {
                console.error('Error saving background image:', error);
                this.showError('Failed to save background image: ' + error.message);
            }
        }

        this.finalizeHomepageSettings();
    }

    finalizeHomepageSettings() {
        this.settings.iconSize = parseInt(document.getElementById('iconSize').value);
        this.settings.titleSize = parseInt(document.getElementById('titleSize').value);
        this.settings.titleColor = document.getElementById('titleColor').value;
        this.settings.gridPosition = document.getElementById('gridPosition').value;
        this.settings.maxAppsWidth = parseInt(document.getElementById('maxAppsWidth').value);
        
        this.saveData();
        this.applySettings();
        this.hideHomepageSettingsModal();
    }

    async applyFolderBackground() {
        const body = document.body;
        const currentFolder = this.folders.find(f => f.id === this.currentFolderId);
        
        if (currentFolder) {
            if (currentFolder.isDefault) {
                // Main folder: use its own background or default
                if (currentFolder.backgroundImageId || currentFolder.backgroundUrl) {
                    await this.applyBackground(currentFolder);
                } else {
                    this.applyDefaultBackground();
                }
            } else {
                // Non-main folder: use custom background if set, otherwise inherit from Main
                if (currentFolder.backgroundImageId) {
                    await this.applyBackground(currentFolder);
                } else {
                    const mainFolder = this.folders.find(f => f.isDefault);
                    if (mainFolder && (mainFolder.backgroundImageId || mainFolder.backgroundUrl)) {
                        await this.applyBackground(mainFolder);
                    } else {
                        this.applyDefaultBackground();
                    }
                }
            }
        } else {
            this.applyDefaultBackground();
        }
    }

    async applyBackground(folder) {
        const body = document.body;
        if (folder.backgroundImageId) {
            // Get blob URL from IndexedDB
            const imageUrl = await this.storage.getImage(folder.backgroundImageId);
            if (imageUrl) {
                // Preload the image before applying it to avoid white flash
                await this.preloadAndApplyBackground(imageUrl);
            } else {
                console.warn('Failed to load image from IndexedDB');
                this.applyDefaultBackground();
            }
        } else if (folder.backgroundUrl) {
            // Preload external URL before applying
            await this.preloadAndApplyBackground(folder.backgroundUrl);
        } else {
            this.applyDefaultBackground();
        }
    }

    async preloadAndApplyBackground(imageUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => {
                // Image is loaded, now apply it instantly
                const body = document.body;
                body.style.backgroundImage = `url(${imageUrl})`;
                body.style.backgroundSize = 'cover';
                body.style.backgroundPosition = 'center';
                body.style.backgroundAttachment = 'fixed';
                resolve();
            };
            
            img.onerror = () => {
                console.warn('Failed to preload background image:', imageUrl);
                this.applyDefaultBackground();
                resolve(); // Still resolve to not block the UI
            };
            
            // Start loading the image
            img.src = imageUrl;
        });
    }

    applyDefaultBackground() {
        const body = document.body;
        body.style.backgroundImage = 'url(backgrounds/blue-body-water.jpg)';
        body.style.backgroundSize = 'cover';
        body.style.backgroundPosition = 'center';
        body.style.backgroundAttachment = 'fixed';
    }

    applySettings() {
        // Apply folder-specific background instead of global background
        this.applyFolderBackground();

        // Apply icon size and title styles
        const style = document.createElement('style');
        style.textContent = `
            .bookmark-icon {
                width: ${this.settings.iconSize}px !important;
                height: ${this.settings.iconSize}px !important;
            }
            .bookmark-title {
                font-size: ${this.settings.titleSize}px !important;
                color: ${this.settings.titleColor} !important;
            }
        `;
        
        // Remove previous style
        const prevStyle = document.querySelector('style[data-settings]');
        if (prevStyle) prevStyle.remove();
        
        style.setAttribute('data-settings', 'true');
        document.head.appendChild(style);

        // Apply grid settings if bookmarks are rendered
        if (document.getElementById('bookmarksGrid').children.length > 0) {
            this.applyGridSettings();
        }
    }

    // Folder Management Methods
    showCreateFolderModal() {
        document.getElementById('createFolderModal').style.display = 'flex';
        document.getElementById('folderName').focus();
        document.getElementById('folderName').value = '';
    }

    hideCreateFolderModal() {
        document.getElementById('createFolderModal').style.display = 'none';
    }

    async createFolder() {
        const name = document.getElementById('folderName').value.trim();

        if (!name) return;

        // Check if folder name already exists
        if (this.folders.some(f => f.name.toLowerCase() === name.toLowerCase())) {
            alert('A folder with this name already exists.');
            return;
        }

        const folder = {
            id: Date.now().toString(),
            name: name,
            order: this.folders.length,
            isDefault: false,
            backgroundFile: null,
            backgroundFilename: null,
            backgroundUrl: '',
            inheritBackground: true // Always inherit by default
        };

        this.folders.push(folder);
        await this.saveData();
        this.renderFolderTabs();
        this.hideCreateFolderModal();
    }

    showFolderTabContextMenu(x, y, folderId) {
        this.currentEditingFolderId = folderId;
        const menu = document.getElementById('folderTabContextMenu');
        menu.style.display = 'block';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        // Adjust position if menu goes off screen
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = (x - rect.width) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = (y - rect.height) + 'px';
        }
    }

    hideFolderTabContextMenu() {
        document.getElementById('folderTabContextMenu').style.display = 'none';
    }

    showFolderSettingsModal() {
        const folder = this.folders.find(f => f.id === this.currentEditingFolderId);
        if (!folder) {
            console.error('Cannot find folder with ID:', this.currentEditingFolderId);
            return;
        }

        document.getElementById('editFolderName').value = folder.name;

        // Show background status and preview
        if (folder.backgroundImageId) {
            document.getElementById('folderBackgroundChooseButton').textContent = 'Custom background image set';
            this.updateFolderBackgroundPreviewFromId(folder.backgroundImageId);
        } else {
            document.getElementById('folderBackgroundChooseButton').textContent = 'Inheriting from Main folder';
            this.updateFolderBackgroundPreview(null);
        }
        
        document.getElementById('folderSettingsModal').style.display = 'flex';
        document.getElementById('editFolderName').focus();
    }

    hideFolderSettingsModal() {
        document.getElementById('folderSettingsModal').style.display = 'none';
        document.getElementById('folderBackgroundFile').value = '';
    }

    updateFolderBackgroundPreview(imageSrc) {
        const preview = document.getElementById('folderBackgroundPreview');
        if (imageSrc) {
            preview.innerHTML = `<img src="${imageSrc}" alt="Background preview">`;
        } else {
            preview.innerHTML = '<div class="placeholder">🖼️</div>';
        }
    }

    async updateFolderBackgroundPreviewFromId(imageId) {
        try {
            const imageUrl = await this.storage.getImage(imageId);
            this.updateFolderBackgroundPreview(imageUrl);
        } catch (error) {
            console.error('Error loading background preview:', error);
            this.updateFolderBackgroundPreview(null);
        }
    }

    async saveFolderSettings() {
        const folder = this.folders.find(f => f.id === this.currentEditingFolderId);
        if (!folder) {
            console.error('No folder found for ID:', this.currentEditingFolderId);
            return;
        }

        const name = document.getElementById('editFolderName').value.trim();
        const fileInput = document.getElementById('folderBackgroundFile');

        if (!name) return;

        // Check if folder name already exists (excluding current folder)
        if (this.folders.some(f => f.id !== folder.id && f.name.toLowerCase() === name.toLowerCase())) {
            alert('A folder with this name already exists.');
            return;
        }

        folder.name = name;

        // Handle background file if selected
        if (fileInput.files[0]) {
            try {
                const file = fileInput.files[0];
                const imageId = `bg-${folder.id}-${Date.now()}`;
                
                // Save image as blob to IndexedDB
                await this.storage.saveImage(imageId, file);
                
                // Delete old image if exists
                if (folder.backgroundImageId) {
                    await this.storage.deleteImage(folder.backgroundImageId);
                }
                
                folder.backgroundImageId = imageId;
            } catch (error) {
                console.error('Error saving background image:', error);
                this.showError('Failed to save background image: ' + error.message);
            }
        }

        await this.saveData();
        this.renderFolderTabs();
        if (folder.id === this.currentFolderId) {
            this.applyFolderBackground();
        }
        this.hideFolderSettingsModal();
    }

    async deleteFolder(folderId) {
        const folder = this.folders.find(f => f.id === folderId);
        if (!folder || folder.isDefault) return;

        if (confirm(`Are you sure you want to delete the "${folder.name}" folder? All bookmarks will be moved to the Main folder.`)) {
            // Move all bookmarks to Main folder
            this.bookmarks.forEach(bookmark => {
                if (bookmark.folderId === folderId) {
                    bookmark.folderId = 'main';
                }
            });

            // Remove folder
            this.folders = this.folders.filter(f => f.id !== folderId);

            // Switch to Main folder if current folder was deleted
            if (this.currentFolderId === folderId) {
                this.currentFolderId = 'main';
            }

            await this.saveData();
            this.renderFolderTabs();
            this.renderBookmarks();
        }
    }

    sortFolderBookmarks(folderId) {
        // Separate bookmarks: current folder vs others
        const folderBookmarks = [];
        const otherBookmarks = [];
        
        this.bookmarks.forEach(bookmark => {
            if (bookmark.folderId === folderId) {
                folderBookmarks.push(bookmark);
            } else {
                otherBookmarks.push(bookmark);
            }
        });
        
        // Sort folder bookmarks alphabetically by title
        folderBookmarks.sort((a, b) => a.title.localeCompare(b.title));
        
        // Update order property for sorted bookmarks
        folderBookmarks.forEach((bookmark, index) => {
            bookmark.order = index;
        });
        
        // Rebuild the bookmarks array: others + sorted folder bookmarks
        this.bookmarks = [...otherBookmarks, ...folderBookmarks];

        this.saveData();
        this.renderBookmarks();
    }

    // Storage and error handling methods

    showError(message) {
        console.error(message);
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 0, 0, 0.9);
            color: white;
            padding: 20px;
            border-radius: 8px;
            font-size: 16px;
            z-index: 2000;
            max-width: 400px;
            text-align: center;
        `;
        const errorButton = document.createElement('button');
        errorButton.style.cssText = 'margin-top: 10px; padding: 5px 10px; background: white; color: black; border: none; border-radius: 3px; cursor: pointer;';
        errorButton.textContent = 'OK';
        errorButton.onclick = () => errorDiv.remove();
        
        errorDiv.innerHTML = `<div>${message}</div>`;
        errorDiv.appendChild(errorButton);
        document.body.appendChild(errorDiv);
    }

    async updateStorageUsageDisplay() {
        const storageInfo = document.getElementById('storageUsageInfo');
        const persistButton = document.getElementById('requestPersistentStorage');
        
        try {
            const usage = await this.storage.getStorageUsage();
            const isPersisted = await navigator.storage.persisted();
            
            if (usage) {
                const usageBar = ((usage.used / usage.total) * 100).toFixed(1);
                const persistentStatus = isPersisted ? 
                    '✅ Persistent and safe' : 
                    '🛡️ Protected by extension permissions';
                
                storageInfo.innerHTML = `
                    <div style="margin-bottom: 8px;">
                        <strong>Storage:</strong> ${usage.usedMB} MB used of ${usage.totalMB} MB (${usage.percentUsed}%)
                    </div>
                    <div style="background: rgba(255,255,255,0.2); height: 8px; border-radius: 4px; overflow: hidden;">
                        <div style="background: ${usage.percentUsed > 80 ? '#ff4757' : '#4ade80'}; height: 100%; width: ${usage.percentUsed}%; transition: width 0.3s ease;"></div>
                    </div>
                    <div style="margin-top: 8px; font-size: 12px; opacity: 0.8;">
                        Bookmarks: ${this.bookmarks.length} • Folders: ${this.folders.length}
                        <br>${persistentStatus}
                    </div>
                `;
                
                // Hide button - extension storage is already protected
                persistButton.style.display = 'none';
            } else {
                storageInfo.innerHTML = '<div>Storage information not available</div>';
                persistButton.style.display = 'none';
            }
        } catch (error) {
            console.error('Error getting storage usage:', error);
            storageInfo.innerHTML = '<div>Error loading storage information</div>';
            persistButton.style.display = 'none';
        }
    }

    async requestPersistentStorage() {
        try {
            if (navigator.storage && navigator.storage.persist) {
                const isPersisted = await navigator.storage.persist();
                
                if (isPersisted) {
                    this.showSuccessMessage('🔒 Persistent storage enabled! Your data is now protected from automatic cleanup.');
                    await this.updateStorageUsageDisplay();
                } else {
                    this.showError('Browser denied persistent storage request. Your data is still safe but may be cleared under extreme disk pressure.');
                }
            } else {
                this.showError('Persistent storage API not available in this browser.');
            }
        } catch (error) {
            console.error('Error requesting persistent storage:', error);
            this.showError('Failed to request persistent storage: ' + error.message);
        }
    }

    showSuccessMessage(message) {
        const successDiv = document.createElement('div');
        successDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(76, 175, 80, 0.95);
            color: white;
            padding: 20px;
            border-radius: 8px;
            font-size: 16px;
            z-index: 2000;
            max-width: 400px;
            text-align: center;
        `;
        const successButton = document.createElement('button');
        successButton.style.cssText = 'margin-top: 10px; padding: 5px 10px; background: white; color: #4caf50; border: none; border-radius: 3px; cursor: pointer;';
        successButton.textContent = 'OK';
        successButton.onclick = () => successDiv.remove();
        
        successDiv.innerHTML = `<div>${message}</div>`;
        successDiv.appendChild(successButton);
        document.body.appendChild(successDiv);
    }
}

// Initialize the Homepage
const homepage = new Homepage();

// Export for global access (needed for delete buttons)
window.homepage = homepage;