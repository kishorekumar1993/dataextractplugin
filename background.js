/**
 * Background Service Worker (Manifest V3)
 * Orchestrates tab-based background crawling so DOMParser and dynamic JavaScript
 * are executed reliably inside real tab contexts without service-worker limitations.
 */

// Helper to normalize URL
function normalizeUrl(raw) {
  try {
    let s = (raw || "").trim();
    if (!s) return null;
    if (!/^https?:\/\//i.test(s)) {
      s = "http://" + s;
    }
    const u = new URL(s);
    return ["http:", "https:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}

// Perform reliable crawling inside a background tab
async function crawlInTab(targetUrl, timeoutMs = 30000) {
  const normUrl = normalizeUrl(targetUrl);
  if (!normUrl) {
    return { success: false, error: "Please enter a valid website URL." };
  }

  let tab = null;
  try {
    // 1. Create hidden background tab
    tab = await chrome.tabs.create({ url: normUrl, active: false });

    // 2. Wait for page load
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error("Website load timed out. Check if site is accessible."));
      }, timeoutMs);

      function listener(tabId, info) {
        if (tabId === tab.id && info.status === "complete") {
          clearTimeout(timer);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      }
      chrome.tabs.onUpdated.addListener(listener);
    });

    // Small delay to ensure client-side JS renders
    await new Promise(r => setTimeout(r, 1200));

    // 3. Inject extractor.js into the tab only if not already loaded
    const [{ result: alreadyLoaded }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => typeof window.Extractor !== "undefined"
    });

    if (!alreadyLoaded) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["extractor.js"]
      });
    }

    // 4. Run extraction inside tab context
    const [{ result: mainData }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (pageUrl) => {
        return Extractor.extractFromDocument(document, document.body?.innerText || Extractor.getElementText(document.body), pageUrl);
      },
      args: [normUrl]
    });

    if (!mainData) {
      throw new Error("Could not extract details from rendered page.");
    }

    // 5. English Subpage Crawling (for international companies with /en)
    let enCandidates = [];
    try {
      const u = new URL(normUrl);
      const hostCandidates = [
        mainData.enUrl,
        `${u.origin}/en`,
        `${u.origin}/en/`,
        `${u.origin}/english`,
        `${u.origin}/eng`,
        `${u.origin}/global-en`
      ];
      enCandidates = [...new Set(hostCandidates.filter(Boolean))].filter(c => c !== normUrl);
    } catch {}

    for (const candidateEnUrl of enCandidates) {
      try {
        const [{ result: enData }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: async (enUrl) => {
            try {
              const res = await fetch(enUrl);
              if (!res.ok) return null;
              const html = await res.text();
              if (html.length < 200) return null;
              const doc = new DOMParser().parseFromString(html, "text/html");
              const enT = Extractor.getElementText(doc.body);
              return Extractor.extractFromDocument(doc, enT, enUrl);
            } catch {
              return null;
            }
          },
          args: [candidateEnUrl]
        });

        if (enData && !enData.error) {
          // Only override if original company name lacks Latin letters (Issue 13)
          if (enData.companyName && /[a-zA-Z]{3,}/.test(enData.companyName) &&
              (!mainData.companyName || !/[a-zA-Z]{3,}/.test(mainData.companyName))) {
            mainData.companyName = enData.companyName;
          }
          // If English address has Latin letters, prefer it
          if (enData.companyAddress && /[a-zA-Z]{5,}/.test(enData.companyAddress)) {
            mainData.companyAddress = enData.companyAddress;
          }
          // Email priorities
          if (enData.emailId && enData.emailId !== mainData.emailId) {
            if (mainData.emailId) mainData.secondaryEmailId = mainData.emailId;
            mainData.emailId = enData.emailId;
          }
          if (enData.countryName && !mainData.countryName) {
            mainData.countryName = enData.countryName;
          }
          if (["Y", "Available"].includes(enData.state) && !["Y", "Available"].includes(mainData.state)) {
            mainData.state = enData.state;
          }
          if (["Y", "Available"].includes(enData.city) && !["Y", "Available"].includes(mainData.city)) {
            mainData.city = enData.city;
          }
          if (enData.phoneNumber && !mainData.phoneNumber) {
            mainData.phoneNumber = enData.phoneNumber;
          }
          break; // successfully merged from first responding candidate
        }
      } catch (err) {
        console.log("English subpage candidate note:", err);
      }
    }

    // 6. Dynamic Contact Page Address Check (User requirement: mostly address take from contact info check and update)
    // Step 6: Dynamic Contact Page Check (Checks if email is missing or address is incomplete/missing)
    const needsContactCheck = !mainData.emailId ||
                              !mainData.companyAddress ||
                              mainData.companyAddress.split(",").length < 3 ||
                              !mainData.phoneNumber;

    if (needsContactCheck) {
      let contactCandidates = [];
      try {
        const u = new URL(normUrl);
        const candidates = [
          mainData.contactUrl,
          `${u.origin}/contact`,
          `${u.origin}/contact-us`,
          `${u.origin}/contactus`,
          `${u.origin}/contact.html`,
          `${u.origin}/contact.php`,
          `${u.origin}/contact-us.html`,
          `${u.origin}/about/contact`,
          `${u.origin}/about-us`,
          `${u.origin}/about.html`,
          `${u.origin}/location`,
          `${u.origin}/reach-us`,
          `${u.origin}/en/contact`,
          `${u.origin}/en/contact-us`
        ];
        contactCandidates = [...new Set(candidates.filter(Boolean))].filter(c => c !== normUrl);
      } catch {}

      for (const contactUrl of contactCandidates) {
        try {
          const [{ result: contactData }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: async (url) => {
              try {
                const res = await fetch(url);
                if (!res.ok) return null;
                const html = await res.text();
                if (html.length < 200) return null;
                const doc = new DOMParser().parseFromString(html, "text/html");
                const enT = Extractor.getElementText(doc.body);
                return Extractor.extractFromDocument(doc, enT, url);
              } catch { return null; }
            },
            args: [contactUrl]
          });

          if (contactData && !contactData.error) {
            // Merge Email ID & Secondary Email ID
            if (contactData.emailId) {
              if (!mainData.emailId) {
                mainData.emailId = contactData.emailId;
                if (contactData.secondaryEmailId) mainData.secondaryEmailId = contactData.secondaryEmailId;
              } else if (contactData.emailId !== mainData.emailId && !mainData.secondaryEmailId) {
                mainData.secondaryEmailId = contactData.emailId;
              }
            }

            // Merge Address (prefer more complete/detailed address from contact page)
            if (contactData.companyAddress) {
              const cParts = contactData.companyAddress.split(",").map(p => p.trim()).filter(Boolean);
              const mParts = (mainData.companyAddress || "").split(",").map(p => p.trim()).filter(Boolean);
              if (!mainData.companyAddress || cParts.length >= mParts.length || contactData.companyAddress.length > mainData.companyAddress.length) {
                mainData.companyAddress = contactData.companyAddress;
                const { state, city } = Extractor.detectStateAndCity(contactData.companyAddress);
                if (["Y", "Available"].includes(state)) mainData.state = state;
                if (["Y", "Available"].includes(city)) mainData.city = city;
              }
            }

            // Merge Country, State, City, Phone
            if (contactData.countryName && !mainData.countryName) mainData.countryName = contactData.countryName;
            if (["Y", "Available"].includes(contactData.state) && !["Y", "Available"].includes(mainData.state)) mainData.state = contactData.state;
            if (["Y", "Available"].includes(contactData.city) && !["Y", "Available"].includes(mainData.city)) mainData.city = contactData.city;
            if (contactData.phoneNumber && !mainData.phoneNumber) mainData.phoneNumber = contactData.phoneNumber;

            // Stop early if both email and multi-segment address are now resolved
            if (mainData.emailId && mainData.companyAddress && mainData.companyAddress.split(",").length >= 2) {
              break;
            }
          }
        } catch (err) {
          console.log("Contact subpage candidate note:", err);
        }
      }
    }

    return {
      success: true,
      data: mainData
    };

  } catch (err) {
    return {
      success: false,
      error: err.message || String(err)
    };
  } finally {
    // Always close background tab
    if (tab?.id) {
      chrome.tabs.remove(tab.id).catch(() => {});
    }
  }
}

// Runtime Message Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "CRAWL_AND_EXTRACT") {
    crawlInTab(request.url)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ success: false, error: err.message || String(err) }));
    return true; // Keep async response channel open
  }
});
