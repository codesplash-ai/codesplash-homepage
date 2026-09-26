# Chrome Web Store Description

Copy the text inside the code block below into the Chrome Web Store listing description field.

```
**Single Purpose Description**: CodeSplash Homepage replaces your new tab page with a customizable homepage where you can organize your favorite bookmarks with custom icons, folders, and background images.

**Storage**: CodeSplash Homepage stores user-created bookmarks, folder organization, layout preferences,
and custom icons locally on the device using IndexedDB. The bookmark collection and uploaded images are not uploaded to a server.

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

All answers: No
- Personally identifiable information 
- Health information
- Financial and payment information
- Authentication information
- Personal communications
- Location
- Web history
- User activity
- Website content

Bookmarks, settings, and uploaded images are stored locally. Favicon requests include the bookmarked
site's domain. Release-note requests include no bookmarks, browsing history, or account identifier.
The receiving servers see ordinary connection information, such as the IP address.

**Certification**

Review the store certification against the request behavior described above:
- I do not sell user data. The extension requests favicons from Google using bookmarked domains; see the external-request disclosure above.
- I do not use or transfer user data for unrelated purposes — Data is only used to display the user's
custom homepage.
- I do not use or transfer user data to determine creditworthiness or for lending purposes — Not
applicable
```
