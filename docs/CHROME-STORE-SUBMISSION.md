# CodeSplash Homepage — Chrome Web Store Submission Plan

## Context

CodeSplash Homepage is a Chrome extension (Manifest V3) that replaces the new tab page with a customizable bookmark homepage. The goal is to submit it to the Chrome Web Store. After reviewing the repo against Chrome Web Store developer policies, there are **4 blocking issues** that would likely cause rejection, **1 functional bug**, and several required submission steps.

---

## Part 1: Code Changes Required Before Submission

### 1. Remove broad host_permissions (CRITICAL — #1 rejection reason)

**File:** `manifest.json`

The extension currently requests `https://*/*` and `http://*/*` host permissions. This is the single biggest cause of Chrome Web Store rejections (~60%) and triggers a 3+ week manual review.

**Why it's unnecessary:** The extension only needs tab URL/title when the user explicitly clicks "Add to Homepage" (context menu) or "Add Current Page" (popup). The `activeTab` permission covers both cases since they require a user gesture.

**Changes:**
- Remove the entire `host_permissions` block (lines 13-16)
- Change `"tabs"` to `"activeTab"` in permissions (line 11)

### 2. Fix redundant tabs.query in background.js

**File:** `background.js` (lines 14-23)

The context menu listener already receives the `tab` parameter, but the code ignores it and makes a redundant `chrome.tabs.query()` call. Use the `tab` param directly — it works with `activeTab` since the context menu click is a user gesture.

**Change:** Replace the `chrome.tabs.query()` block with direct use of the `tab` parameter.

### 3. Fix broken notifications call

**File:** `background.js` (lines 56-61)

`chrome.notifications.create()` is called without the `notifications` permission in the manifest, so it silently fails. The icon path `'icon48.png'` is also wrong (actual path: `icons/icon-48.png`).

**Change:** Remove the notification block entirely. The popup already shows its own success message, and adding another permission increases review scrutiny. Removing it keeps permissions minimal.

### 4. Remove dead code

**File:** `background.js` (lines 67-71)

`chrome.action.onClicked` never fires when a `default_popup` is set in the manifest. This is dead code.

**Change:** Remove the `chrome.action.onClicked` listener.

### 5. Fix storage inconsistency (FUNCTIONAL BUG)

**Files:** `background.js`, `popup.js`, `storage-manager.js`

The new tab page reads bookmarks from **IndexedDB** (via `StorageManager`), but `background.js` and `popup.js` write bookmarks to **`chrome.storage.local`**. After the IndexedDB migration runs, `chrome.storage.local` gets cleared. This means:

- Bookmarks added via the context menu or popup **will not appear** on the homepage
- The popup's bookmark count will show 0

**Change:** Have `background.js` and `popup.js` import and use `StorageManager` to write directly to IndexedDB. Since service workers and popups can't use ES module `import`, we'll need to either:
- Use `importScripts('storage-manager.js')` in background.js
- Add `<script src="storage-manager.js">` before `<script src="popup.js">` in popup.html

Both `background.js` and `popup.js` will then instantiate `StorageManager`, call `initialize()`, and use its `set()` method.

### 6. Add missing `folderId` in popup.js

**File:** `popup.js` (line 75)

Bookmarks created via the popup are missing `folderId: 'main'`, while `background.js` includes it. Without this, bookmarks won't appear in any folder.

**Change:** Add `folderId: 'main'` to the bookmark object in `popup.js`.

### 7. Fix manifest description typo

**File:** `manifest.json` (line 6)

"wtih" should be "with". Also rewrite the description to clearly state the extension's single purpose (required by policy).

**Change:** Update to: `"Replace your new tab page with a customizable homepage featuring bookmarks, folders, custom icons, and background images."`

---

## Part 2: Assets & Documents Needed

### 8. Create a privacy policy

Chrome Web Store requires a privacy policy URL if the extension handles any user data. This extension stores bookmarks and images locally in IndexedDB.

**Approach:** Create a simple privacy policy stating all data is stored locally on the user's device, nothing is collected or transmitted. Host it via GitHub Pages, a simple webpage, or a public GitHub gist.

### 9. Prepare store listing screenshots

**Required:** 1-5 screenshots at 1280x800 or 640x400 pixels.

**Suggested screenshots:**
1. Main homepage with bookmarks displayed
2. Settings modal showing customization options
3. Folder tabs with multiple folders
4. Right-click context menu "Add to Homepage"
5. Custom background image applied

### 10. Prepare promotional tile (optional but recommended)

**Size:** 440x280 pixels — appears on Chrome Web Store browse pages.

### 11. Write detailed store description

The manifest description is short. The store listing allows up to 16,000 characters. Suggested content:

> CodeSplash Homepage replaces your Chrome new tab page with a fully customizable homepage for your favorite bookmarks.
>
> Features:
> - Organize bookmarks into folder tabs
> - Drag and drop to reorder bookmarks and folders
> - Upload custom icons or use automatic favicons
> - Set custom background images per folder
> - Adjustable icon sizes, grid layout, and text colors
> - Right-click any page to quickly add it to your homepage
> - All data stored locally — nothing leaves your browser
>
> Simple, fast, and private. No account required, no data collection.

---

## Part 3: Submission Steps

### 12. Register as a Chrome Web Store developer
- Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
- Pay the **$5 one-time registration fee**
- Enable **2-Step Verification** (required before publishing)

### 13. Package the extension
- Create a ZIP of the extension directory
- **Exclude:** `.git/`, `.DS_Store`, `.gitignore`
- **Include:** `manifest.json`, `background.js`, `newtab.html`, `newtab.js`, `storage-manager.js`, `popup.html`, `popup.js`, `icons/`

### 14. Upload and fill out listing
- Click "New Item" in the Developer Dashboard
- Upload the ZIP file
- Fill in **Store Listing** tab: title, detailed description, category ("Productivity"), screenshots, promo image
- Fill in **Privacy** tab: privacy policy URL, data handling declarations, permission justifications:
  - `storage` — Stores user bookmarks, folders, and settings locally
  - `unlimitedStorage` — Stores custom icons and background images uploaded by the user
  - `contextMenus` — Provides right-click "Add to Homepage" for quick bookmarking
  - `activeTab` — Reads current tab URL/title when the user adds a bookmark via popup or context menu
- Fill in **Distribution** tab: geographic availability, pricing (free)

### 15. Submit for review
- Click "Submit for Review"
- **Expected timeline:** 1-3 business days with the cleaned-up permissions (vs. 3+ weeks with the original broad permissions)
- Monitor the dashboard for status updates; you'll get email notifications

### 16. Publish
- Once approved, click "Publish" (you have 30 days before it reverts to draft)

---

## Verification Plan

After making code changes, test the following before packaging:

1. Load the unpacked extension at `chrome://extensions` (enable Developer Mode)
2. Open a new tab — verify the homepage loads correctly
3. Right-click on any webpage → "Add to Homepage" → open new tab → verify the bookmark appears
4. Click extension icon → "Add Current Page" → open new tab → verify the bookmark appears
5. Test folder creation, bookmark drag-and-drop, and folder reordering
6. Test custom background image upload (per-folder)
7. Test settings changes (icon size, title size, grid position, colors)
8. Test on a fresh Chrome profile with no pre-existing extension data
9. Verify no console errors in the extension's service worker, popup, or new tab page

---

## Summary of Files to Modify

| File | Changes |
|------|---------|
| `manifest.json` | Remove `host_permissions`, change `tabs` → `activeTab`, fix description typo |
| `background.js` | Use `tab` param directly, remove notifications, remove dead `onClicked` listener, use `StorageManager` for IndexedDB |
| `popup.js` | Use `StorageManager` for IndexedDB, add `folderId: 'main'` to bookmarks |
| `popup.html` | Add `<script src="storage-manager.js">` before popup.js |
| New: Privacy Policy | Create and host externally |
| New: Screenshots | 1-5 at 1280x800 px |
| New: Promo tile | 440x280 px (optional) |
