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

function contactAddressSourcePriority(source) {
  const value = String(source || "");
  if (value.includes("schema")) return 5;
  if (value.includes("labelled")) return 4;
  if (value.includes("element")) return 3;
  if (value.includes("semantic")) return 2;
  if (value.includes("inline")) return 1;
  return 0;
}

function waitForTabComplete(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
    };
    const finish = error => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };
    const timer = setTimeout(() => {
      finish(new Error("Website load timed out. Check if site is accessible."));
    }, timeoutMs);
    function listener(updatedTabId, info) {
      if (updatedTabId === tabId && info.status === "complete") finish();
    }
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then(tab => {
      if (tab.status === "complete") finish();
    }).catch(finish);
  });
}

async function extractFetchedPage(tabId, pageUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  let response;
  let html;
  try {
    response = await fetch(pageUrl, { credentials: "omit", signal: controller.signal });
    if (!response.ok) return null;
    html = await response.text();
  } finally {
    clearTimeout(timer);
  }
  if (html.length < 200) return null;

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (markup, url) => {
      if (typeof Extractor === "undefined") throw new Error("Extractor engine unavailable in target tab.");
      const doc = new DOMParser().parseFromString(markup, "text/html");
      return Extractor.extractFromDocument(doc, Extractor.getElementText(doc.body), url);
    },
    args: [html, response.url || pageUrl]
  });
  return result || null;
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
    await waitForTabComplete(tab.id, timeoutMs);

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
        const enData = await extractFetchedPage(tab.id, candidateEnUrl);

        if (enData && !enData.error) {
          // Only override if original company name lacks Latin letters (Issue 13)
          if (enData.companyName && /[a-zA-Z]{3,}/.test(enData.companyName) &&
              (!mainData.companyName || !/[a-zA-Z]{3,}/.test(mainData.companyName))) {
            mainData.companyName = enData.companyName;
          }
          // If English address has Latin letters, prefer it
          if (enData.companyAddress && /[a-zA-Z]{5,}/.test(enData.companyAddress) &&
              !String(mainData.addressSource || "").startsWith("contact-detail-")) {
            mainData.companyAddress = enData.companyAddress;
            mainData.addressSource = enData.addressSource;
          }
          // Email priorities
          const englishEmails = Extractor.mergeContactEmails(
            mainData.emailId,
            enData.emailId || enData.secondaryEmailId,
            "",
            mainData.secondaryEmailId
          );
          mainData.emailId = englishEmails.emailId;
          mainData.secondaryEmailId = englishEmails.secondaryEmailId;
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

    // Step 6: Dedicated Contact Page Crawl (User Requirement: Address should be taken from Contact page!)
    // Always check Contact page candidates to prioritize official corporate headquarters/contact address
    let contactCandidates = [];
    try {
      const u = new URL(tab.url || normUrl);
      const hostCandidates = [
        ...(mainData.contactUrls || []),
        mainData.contactUrl,
        `${u.origin}/contact-us`,
        `${u.origin}/contact`,
        `${u.origin}/contactus`,
        `${u.origin}/contact-us.html`,
        `${u.origin}/contact.html`,
        `${u.origin}/contact.php`,
        `${u.origin}/location`,
        `${u.origin}/locations`,
        `${u.origin}/reach-us`,
        `${u.origin}/about/contact`,
        `${u.origin}/about-us/contact`,
        `${u.origin}/en/contact`,
        `${u.origin}/en/contact-us`
      ];
      contactCandidates = [...new Set(hostCandidates.filter(Boolean))].filter(c => c !== normUrl && c !== tab.url);
    } catch {}

    let footerAddressTakenFromContactPage = false;
    let bestContactAddressPriority = -1;
    let contactEmailPrioritySet = false;

    for (const contactUrl of contactCandidates) {
      try {
        const contactData = await extractFetchedPage(tab.id, contactUrl);

        if (contactData && !contactData.error) {
          const hasContactDetailAddress = String(contactData.addressSource || "").startsWith("contact-detail-");
          const hasFooterAddress = String(contactData.addressSource || "").startsWith("footer-");
          const currentHasContactDetailAddress = String(mainData.addressSource || "").startsWith("contact-detail-");
          const takeFooterFallback = hasFooterAddress &&
            !currentHasContactDetailAddress &&
            !footerAddressTakenFromContactPage;
          const contactPriority = contactAddressSourcePriority(contactData.addressSource);
          const takeContactDetail = hasContactDetailAddress && contactPriority > bestContactAddressPriority;

          if (contactData.companyAddress && contactData.companyAddress.length >= 10 &&
              (takeContactDetail || takeFooterFallback)) {
            mainData.companyAddress = contactData.companyAddress;
            mainData.addressSource = contactData.addressSource;
            if (takeContactDetail) bestContactAddressPriority = contactPriority;
            if (takeFooterFallback) footerAddressTakenFromContactPage = true;

            // Re-validate state & city from updated contact page address
            const { state, city } = Extractor.detectStateAndCity(contactData.companyAddress);
            if (["Y", "Available"].includes(state)) mainData.state = state;
            if (["Y", "Available"].includes(city)) mainData.city = city;

            // Update country from contact page if missing or generic
            if (contactData.countryName && (!mainData.countryName || mainData.countryName === "Not Available")) {
              mainData.countryName = contactData.countryName;
            }
          }

          // Merge Email ID & Secondary Email ID
          const contactEmails = contactEmailPrioritySet
            ? Extractor.mergeContactEmails(
                mainData.emailId,
                mainData.secondaryEmailId,
                "",
                contactData.emailId || contactData.secondaryEmailId
              )
            : Extractor.mergeContactEmails(
                mainData.emailId,
                mainData.secondaryEmailId,
                contactData.emailId,
                contactData.secondaryEmailId
              );
          if (!contactEmailPrioritySet && contactData.emailId) contactEmailPrioritySet = true;
          mainData.emailId = contactEmails.emailId;
          mainData.secondaryEmailId = contactEmails.secondaryEmailId;

          // Merge Country, State, City, Phone
          if (contactData.countryName && !mainData.countryName) mainData.countryName = contactData.countryName;
          if (["Y", "Available"].includes(contactData.state) && !["Y", "Available"].includes(mainData.state)) mainData.state = contactData.state;
          if (["Y", "Available"].includes(contactData.city) && !["Y", "Available"].includes(mainData.city)) mainData.city = contactData.city;
          if (contactData.phoneNumber && !mainData.phoneNumber) mainData.phoneNumber = contactData.phoneNumber;

          // A contact-detail address must not be replaced by a later page's footer.
        }
      } catch (err) {
        console.log("Contact subpage candidate note:", err);
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
