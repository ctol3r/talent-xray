# Local browser companion

TalentOS accepts explicitly saved links through `/capture`. Keep the standalone application running on `http://127.0.0.1:3000` (or your chosen local port). This feature does not require a model API key or a migration.

## Any browser

Open the local `/capture` page beside your browser and paste a URL and title. Choose a search and either its research references or an existing candidate. Review the exact URL, including any query parameters, then click **Save reviewed link**. Opening the form does not save data. Saved links reopen from the same page and the connected workspace.

The companion page also provides bookmarklet code using its current local address. Create a browser bookmark named “Save to TalentOS”, paste the code into the bookmark’s URL field, then invoke it on an HTTP(S) page. The bookmarklet sends only the current URL and title in a URL fragment. The receiving form removes that fragment immediately; it never appears in the server request. Browser history may momentarily contain the incoming fragment before the page loads. Some browser policies, page content-security policies, or popup settings block bookmarklets; manual paste remains the fallback.

## Optional unpacked Chrome extension

1. Open `chrome://extensions` in Chrome and enable Developer mode.
2. Choose **Load unpacked** and select this app’s `browser-extension` directory.
3. Pin **TalentOS companion** to the toolbar.
4. While viewing an HTTP(S) page, click the extension, enter the local TalentOS address, and choose **Review link in TalentOS**.
5. Review and explicitly save the reference in TalentOS.

The extension requests only `activeTab`, with no host permissions, content scripts, scripting permission, background worker, or network interception. Chrome grants temporary tab metadata access in response to the user invoking the extension; the popup reads only URL and title when its button is clicked. It saves only the selected local app address in extension storage. See the official [activeTab documentation](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab).

The extension opens a regular local browser tab. It is an unpacked companion, not a Chrome Web Store release, native desktop application, or installed background service. Safari/Firefox extension packages and browser-native side panels are not part of this implementation.

## Persistence and boundaries

Candidate captures use the existing `candidate_sources` table with `added_via=browser_capture`; research/exposure references use `research_sources` with `source=browser_capture`. The save operation validates the search/candidate relationship and HTTP(S) URL, rejects embedded credentials, and deduplicates the exact URL within the selected owner without overwriting previous metadata. A separate source owner can intentionally reference the same URL. The title is a label, not extracted evidence. Page text, snippets, screenshots, and resume content are never obtained by the companion. Saving does not move a candidate, create a candidate, verify a qualification, or treat a reference as CV text.

The capture route and save action accept only `localhost` or `127.0.0.1`; cross-origin save requests are rejected in addition to Next.js server-action origin protection. The local app must be running for capture to load. Do not expose this single-user application on a public host.
