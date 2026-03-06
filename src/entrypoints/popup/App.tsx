import { useEffect } from "react";
import { isSummarizerAvailable } from "@/lib/summarizer/validation";

export function App() {
  useEffect(() => {
    async function checkAvailability() {
      try {
        const available = await isSummarizerAvailable();
        if (available) {
          // Utilizes chrome.sidePanel API to open the side panel natively (Requires sidePanel permissions in manifest)
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.windowId) {
            await chrome.sidePanel.open({ windowId: tab.windowId });
            window.close(); // Close the popup after successful interaction
          }
        } else {
          // If not available, open options page to guide the user to enable AI flags
          chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
          window.close();
        }
      } catch (err) {
        console.error(err);
        chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
        window.close();
      }
    }

    checkAvailability();
  }, []);

  return (
    <main style={{ minWidth: 280, padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <p style={{ margin: 0, fontSize: 14 }}>Checking Summarizer API...</p>
    </main>
  );
}
