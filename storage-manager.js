/**
 * Unified Storage Manager for Chrome Extension
 * Replaces chrome.storage.local with IndexedDB for unlimited capacity and persistence
 */
class StorageManager {
    constructor() {
        this.db = null;
        this.cache = new Map(); // Memory cache for performance
        this.dbName = 'CodeSplashHomepageDB';
        this.dbVersion = 1;
    }

    /**
     * Initialize storage with persistent storage request
     * @returns {Promise<boolean>} Whether persistent storage was granted
     */
    async initialize() {
        try {
            // 1. Request persistent storage (one-time, guarantees ALL storage)
            let isPersisted = false;
            if (navigator.storage && navigator.storage.persist) {
                isPersisted = await navigator.storage.persist();
            }

            if (!isPersisted) {
                // Don't show warning here - will be handled by main app if needed
            }

            // 2. Check available space
            if (navigator.storage && navigator.storage.estimate) {
                const {usage, quota} = await navigator.storage.estimate();
            }

            // 3. Open IndexedDB
            this.db = await this.openDatabase();

            // 4. Migrate from chrome.storage if needed
            await this.migrateFromChromeStorage();

            return isPersisted;
        } catch (error) {
            console.error('Storage initialization failed:', error);
            throw error;
        }
    }

    /**
     * Open IndexedDB database
     * @returns {Promise<IDBDatabase>}
     */
    async openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object stores
                if (!db.objectStoreNames.contains('bookmarks')) {
                    const bookmarksStore = db.createObjectStore('bookmarks', { keyPath: 'id' });
                    bookmarksStore.createIndex('folderId', 'folderId', { unique: false });
                }
                if (!db.objectStoreNames.contains('folders')) {
                    const foldersStore = db.createObjectStore('folders', { keyPath: 'id' });
                    foldersStore.createIndex('order', 'order', { unique: false });
                }
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings');
                }
                if (!db.objectStoreNames.contains('images')) {
                    db.createObjectStore('images');
                }
                if (!db.objectStoreNames.contains('metadata')) {
                    db.createObjectStore('metadata');
                }

            };

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                console.error('IndexedDB open failed:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Get data from storage with caching
     * @param {string} storeName - Object store name
     * @param {string|null} key - Specific key or null for all
     * @returns {Promise<any>}
     */
    async get(storeName, key = null) {
        try {
            const cacheKey = key ? `${storeName}:${key}` : storeName;
            
            // Check cache first
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            // Load from IndexedDB
            const tx = this.db.transaction([storeName], 'readonly');
            const store = tx.objectStore(storeName);
            
            let data;
            if (key) {
                data = await this.promisifyRequest(store.get(key));
            } else {
                data = await this.promisifyRequest(store.getAll());
            }

            // Cache for performance
            this.cache.set(cacheKey, data);
            return data;
        } catch (error) {
            console.error(`Error getting ${storeName}:`, error);
            return key ? null : [];
        }
    }

    /**
     * Save data to storage
     * @param {string} storeName - Object store name
     * @param {any} value - Data to save
     * @param {string|null} key - Specific key for non-array data
     */
    async set(storeName, value, key = null) {
        try {
            const cacheKey = key ? `${storeName}:${key}` : storeName;
            
            // Update cache
            this.cache.set(cacheKey, value);

            // Save to IndexedDB
            const tx = this.db.transaction([storeName], 'readwrite');
            const store = tx.objectStore(storeName);

            if (Array.isArray(value)) {
                // Clear and rebuild for arrays
                await this.promisifyRequest(store.clear());
                for (const item of value) {
                    await this.promisifyRequest(store.add(item));
                }
            } else if (key) {
                await this.promisifyRequest(store.put(value, key));
            } else {
                await this.promisifyRequest(store.put(value));
            }

        } catch (error) {
            console.error(`Error saving ${storeName}:`, error);
            throw error;
        }
    }

    /**
     * Image-specific methods
     */
    async saveImage(id, blob) {
        try {
            const tx = this.db.transaction(['images'], 'readwrite');
            await this.promisifyRequest(tx.objectStore('images').put(blob, id));
        } catch (error) {
            console.error(`Error saving image ${id}:`, error);
            throw error;
        }
    }

    async getImage(id) {
        try {
            const tx = this.db.transaction(['images'], 'readonly');
            const blob = await this.promisifyRequest(tx.objectStore('images').get(id));
            if (blob) {
                const url = URL.createObjectURL(blob);
                return url;
            } else {
                console.warn('No blob found for ID:', id);
                return null;
            }
        } catch (error) {
            console.error(`Error getting image ${id}:`, error);
            return null;
        }
    }

    async deleteImage(id) {
        try {
            const tx = this.db.transaction(['images'], 'readwrite');
            await this.promisifyRequest(tx.objectStore('images').delete(id));
        } catch (error) {
            console.error(`Error deleting image ${id}:`, error);
        }
    }

    /**
     * Migration from chrome.storage.local to IndexedDB
     */
    async migrateFromChromeStorage() {
        try {
            // Check if already migrated
            const migrationData = await this.get('metadata', 'migration');
            if (migrationData?.completed) {
                return;
            }


            // Load all data from chrome.storage
            const oldData = await chrome.storage.local.get(null);

            if (Object.keys(oldData).length === 0) {
                await this.setMigrationComplete();
                return;
            }

            // Create backup before migration
            await this.createMigrationBackup(oldData);

            // Migrate bookmarks
            if (oldData.bookmarks && oldData.bookmarks.length > 0) {
                await this.set('bookmarks', oldData.bookmarks);
            }

            // Migrate folders and convert base64 images to blobs
            if (oldData.folders && oldData.folders.length > 0) {
                
                for (const folder of oldData.folders) {
                    // Convert background images from base64 to blob
                    if (folder.backgroundFile) {
                        try {
                            const blob = await this.base64ToBlob(folder.backgroundFile);
                            const imageId = `bg-${folder.id}`;
                            await this.saveImage(imageId, blob);
                            folder.backgroundImageId = imageId;
                            delete folder.backgroundFile; // Remove base64 data
                            delete folder.backgroundFilename; // Clean up
                        } catch (error) {
                            console.error(`Failed to convert background for folder ${folder.name}:`, error);
                        }
                    }
                }
                
                await this.set('folders', oldData.folders);
            }

            // Migrate settings (excluding backgroundFile if present)
            if (oldData.settings) {
                const settings = { ...oldData.settings };
                // Remove old global background settings since we now use per-folder backgrounds
                delete settings.backgroundFile;
                delete settings.backgroundFilename;
                delete settings.backgroundUrl;
                
                await this.set('settings', settings, 'main');
            }

            // Mark migration as complete
            await this.setMigrationComplete();

            // Clear chrome.storage to free space (keep backup for safety)
            const backupData = { migrationBackup: oldData, migrationDate: Date.now() };
            await chrome.storage.local.clear();
            await chrome.storage.local.set(backupData);


        } catch (error) {
            console.error('Migration failed:', error);
            throw error;
        }
    }

    async createMigrationBackup(data) {
        try {
            const backup = {
                timestamp: new Date().toISOString(),
                version: '1.0',
                data: data
            };
            
            await this.set('metadata', backup, 'pre-migration-backup');
        } catch (error) {
            console.error('Failed to create migration backup:', error);
        }
    }

    async setMigrationComplete() {
        const migrationInfo = {
            completed: true,
            timestamp: Date.now(),
            version: '2.0'
        };
        
        await this.set('metadata', migrationInfo, 'migration');
    }

    /**
     * Convert base64 string to Blob
     * @param {string} base64 - Base64 data URL
     * @returns {Promise<Blob>}
     */
    async base64ToBlob(base64) {
        try {
            const response = await fetch(base64);
            return await response.blob();
        } catch (error) {
            console.error('Failed to convert base64 to blob:', error);
            throw error;
        }
    }

    /**
     * Storage monitoring utilities
     */
    async getStorageUsage() {
        try {
            if (navigator.storage && navigator.storage.estimate) {
                const {usage, quota} = await navigator.storage.estimate();
                return {
                    used: usage,
                    total: quota,
                    usedMB: (usage / 1024 / 1024).toFixed(2),
                    totalMB: (quota / 1024 / 1024).toFixed(2),
                    percentUsed: ((usage / quota) * 100).toFixed(1)
                };
            }
            return null;
        } catch (error) {
            console.error('Failed to get storage usage:', error);
            return null;
        }
    }

    /**
     * Clear cache - useful for testing
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Show warning if persistent storage not granted (removed - handled by main app)
     */
    showPersistenceWarning() {
        // Warning handling moved to main application
    }

    /**
     * Convert IDBRequest to Promise
     * @param {IDBRequest} request
     * @returns {Promise}
     */
    promisifyRequest(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}

// Export for ES6 modules or make globally available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageManager;
} else {
    globalThis.StorageManager = StorageManager;
}