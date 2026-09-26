# Chrome Web Store Description

Copy the text inside the code block below into the Chrome Web Store listing description field.

```
**Single Purpose Description**: CodeSplash Homepage replaces your new tab page with a customizable homepage where you can organize your favorite bookmarks with custom icons, folders, and background images.

**Storage**: CodeSplash Homepage stores bookmarks, folders, settings, and uploaded images locally in IndexedDB. chrome.storage.local stores the installed version and pending release-note state. The bookmark collection and uploaded images are not uploaded. Favicon requests use bookmarked domains; public release-note requests contain no bookmarks or browsing history.

**Unlimited Storage**: Users can upload custom background images and bookmark icons, which are stored as
binary Blobs in IndexedDB. The default storage limit is insufficient for multiple high-resolution
images, so unlimited storage ensures users can personalize their homepage without hitting size
constraints.

**Context Menus**: CodeSplash adds a single right-click menu item — "Add to Homepage" — that lets users
quickly bookmark the current page directly to their homepage without opening the extension popup.

**Active Tab**: When a user clicks "Add to Homepage" (via context menu or popup), the extension reads the
current tab's URL and title to create the bookmark entry. No other tab data is accessed.

**Remote Code**

No. All JavaScript is bundled within the extension package. There are no external script tags, no
references to external modules, no eval(), and no WebAssembly. External requests fetch
favicons from Google's favicon API (https://www.google.com/s2/favicons), public release-note JSON
from https://codesplash.ai/updates/feed/homepage, and optional release-note images. These responses
are data and images, not executable code.

**User Data Collection**

Select these categories to disclose actual data handling, including local storage:
- Web history: URLs and titles of pages the user chooses to bookmark; no background history monitoring.
- Website content: saved links, titles, icons, and user-uploaded images used by the homepage.
- Location: IP addresses exposed to servers by favicon and release-note requests; no GPS/device-location access.

Leave other categories unchecked. Bookmarks, settings, and uploaded images are stored locally.
Favicon requests include bookmarked domains. Release-note requests include no bookmarks,
browsing history, or account identifier. These declarations describe existing behavior;
they do not add tracking or data collection code.

Reference: https://developer.chrome.com/docs/webstore/program-policies/user-data-faq
(question 3 requires disclosure even for locally processed or stored data).

**Certification**

Review the store certification against the request behavior described above:
- I do not sell user data. The extension requests favicons from Google using bookmarked domains; see the external-request disclosure above.
- I do not use or transfer user data for unrelated purposes — Data is only used to display the user's
custom homepage.
- I do not use or transfer user data to determine creditworthiness or for lending purposes — Not
applicable
```
