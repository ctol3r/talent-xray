/* global chrome */
const originInput = document.getElementById("origin");
const status = document.getElementById("status");
try {
  originInput.value =
    localStorage.getItem("talentos-origin") || originInput.value;
} catch {
  /* An address can still be entered when storage is disabled. */
}

document.getElementById("capture").addEventListener("submit", async (event) => {
  event.preventDefault();
  status.textContent = "";
  try {
    const origin = new URL(originInput.value);
    if (
      origin.protocol !== "http:" ||
      !["localhost", "127.0.0.1"].includes(origin.hostname) ||
      origin.username ||
      origin.password ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash
    )
      throw new Error("Use a local address such as http://127.0.0.1:3000.");
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const url = new URL(tab?.url || "");
    if (!/^https?:$/.test(url.protocol) || url.username || url.password)
      throw new Error(
        "This tab has no supported HTTP(S) link. Open TalentOS and paste a source URL manually.",
      );
    const target = `${origin.origin}/capture#${new URLSearchParams({ url: tab.url, title: (tab.title || "").slice(0, 500) })}`;
    try {
      localStorage.setItem("talentos-origin", origin.origin);
    } catch {
      /* No source content is stored by this extension. */
    }
    await chrome.tabs.create({ url: target });
    window.close();
  } catch (error) {
    status.textContent =
      error instanceof Error
        ? error.message
        : "Could not open TalentOS. Check its local address and keep the app running.";
  }
});
