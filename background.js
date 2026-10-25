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
  const value = String(source || "").toLowerCase();
  if (value.includes("schema")) return 6;
  if (value.includes("labelled")) return 5;
  if (value.includes("element")) return 4;
  if (value.includes("semantic")) return 3;
  if (value.includes("inline")) return 2;
  if (value.includes("fallback") || value.includes("fulltext")) return 1;
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

async function recoverFromBrowserError(tabId, requestedUrl, timeoutMs) {
  let tab = await chrome.tabs.get(tabId);
  if (!String(tab.url || "").startsWith("chrome-error://")) return tab;

  const fallbackUrl = new URL(requestedUrl);
  if (fallbackUrl.protocol !== "https:") {
    throw new Error("The website could not be loaded in the browser.");
  }
  fallbackUrl.protocol = "http:";
  await chrome.tabs.update(tabId, { url: fallbackUrl.href });
  await waitForTabComplete(tabId, timeoutMs);
  tab = await chrome.tabs.get(tabId);
  if (!/^https?:\/\//i.test(tab.url || "")) {
    throw new Error("The website could not be loaded over HTTPS or HTTP.");
  }
  return tab;
}

async function extractFetchedPage(tabId, pageUrl, renderIfAddressMissing = false) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  let response;
  let html = "";

  try {
    response = await fetch(pageUrl, { credentials: "omit", signal: controller.signal });
    if (response.ok) {
      html = await response.text();
    }
  } catch (e) {
    // Ignore fetch errors (like CORS or blocked requests) and proceed to tab fallback
  } finally {
    clearTimeout(timer);
  }

  let result = null;

  // Only process raw HTML if the fetch was successful
  if (html.length >= 200) {
    try {
      const [{ result: extracted }] = await chrome.scripting.executeScript({
        target: { tabId },
        func: (markup, url) => {
          if (typeof Extractor === "undefined") throw new Error("Extractor engine unavailable in target tab.");
          const doc = new DOMParser().parseFromString(markup, "text/html");
          return Extractor.extractFromDocument(doc, Extractor.getElementText(doc.body), url);
        },
        args: [html, response?.url || pageUrl]
      });
      result = extracted;
    } catch (e) {
      result = null;
    }
  }

  // Force a rendered tab fallback if ANY critical field is missing OR if fetch failed
  if ((result?.companyAddress && result?.countryName && result?.emailId && result?.state !== "N") || !renderIfAddressMissing) {
    return result;
  }

  let renderedTab;
  try {
    renderedTab = await chrome.tabs.create({ url: response?.url || pageUrl, active: false });
    await waitForTabComplete(renderedTab.id, 15000);
    renderedTab = await recoverFromBrowserError(
      renderedTab.id,
      response?.url || pageUrl,
      15000
    );

    const [{ result: extractorLoaded }] = await chrome.scripting.executeScript({
      target: { tabId: renderedTab.id },
      func: () => typeof window.Extractor !== "undefined"
    });
    if (!extractorLoaded) {
      await chrome.scripting.executeScript({
        target: { tabId: renderedTab.id },
        files: ["extractor.js"]
      });
    }

    const [{ result: renderedResult }] = await chrome.scripting.executeScript({
      target: { tabId: renderedTab.id },
      func: async (url) => {
        const extract = () => Extractor.extractFromDocument(
          document,
          Extractor.getElementText(document.body || document.documentElement),
          window.location.href || url
        );
        let data = extract();
        const deadline = Date.now() + 8000;
        while (!data.companyAddress && Date.now() < deadline) {
          await new Promise(resolve => setTimeout(resolve, 300));
          data = extract();
        }
        return data;
      },
      args: [response?.url || pageUrl]
    });
    return renderedResult || result;
  } catch (err) {
    console.log("Rendered tab fallback note:", err);
    return result;
  } finally {
    if (renderedTab?.id) {
      try {
        await chrome.tabs.remove(renderedTab.id);
      } catch {}
    }
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
    await waitForTabComplete(tab.id, timeoutMs);
    tab = await recoverFromBrowserError(tab.id, normUrl, timeoutMs);

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
      func: async (pageUrl) => {
        const extract = () => Extractor.extractFromDocument(
          document,
          document.body?.innerText || Extractor.getElementText(document.body),
          window.location.href || pageUrl
        );
        let data = extract();
        const deadline = Date.now() + 8000;
        while (!data.companyAddress && Date.now() < deadline) {
          await new Promise(resolve => setTimeout(resolve, 300));
          data = extract();
        }
        return data;
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

    // Crawl only contact URLs discovered in the page, not guessed routes.
    let contactCandidates = [];
    try {
      const u = new URL(tab.url || normUrl);
      const hostCandidates = [...(mainData.contactUrls || []), mainData.contactUrl];
      contactCandidates = [...new Set(hostCandidates.filter(Boolean).map(candidate => {
        try {
          const candidateUrl = new URL(candidate, u);
          const sameHost = candidateUrl.hostname.replace(/^www\./i, "").toLowerCase() ===
            u.hostname.replace(/^www\./i, "").toLowerCase();
          if (sameHost && u.protocol === "https:" && candidateUrl.protocol === "http:") {
            candidateUrl.protocol = "https:";
          }
          return candidateUrl.href;
        } catch {
          return null;
        }
      }).filter(Boolean))].filter(candidate => {
        const candidateUrl = new URL(candidate);
        const sameHost = candidateUrl.hostname.replace(/^www\./i, "").toLowerCase() ===
          u.hostname.replace(/^www\./i, "").toLowerCase();
        const samePath = candidateUrl.pathname.replace(/\/+$/, "") === u.pathname.replace(/\/+$/, "");
        return !(sameHost && samePath && candidateUrl.search === u.search);
      });
    } catch {}

    let footerAddressTakenFromContactPage = false;
    let bestContactAddressPriority = -1;
    let contactEmailPrioritySet = false;

    for (const contactUrl of contactCandidates) {
      try {
        const isDiscoveredContactUrl = contactUrl === mainData.contactUrl ||
          (mainData.contactUrls || []).includes(contactUrl) ||
          contactUrl.includes("?p=contact") ||
          contactUrl.includes("contact");
        const contactData = await extractFetchedPage(tab.id, contactUrl, isDiscoveredContactUrl);

        if (contactData && !contactData.error) {
          const contactAddr = contactData.companyAddress || "";
          const mainAddr = mainData.companyAddress || "";
          const contactPriority = contactAddressSourcePriority(contactData.addressSource);
          const mainPriority = contactAddressSourcePriority(mainData.addressSource);
          const isMainFooter = String(mainData.addressSource || "").startsWith("footer-");
          const isContactFooter = String(contactData.addressSource || "").startsWith("footer-");

          let shouldTakeContactAddress = false;
          if (contactAddr.length >= 10) {
            if (!mainAddr || mainAddr.length < 10) {
              shouldTakeContactAddress = true;
            } else if (isMainFooter && !isContactFooter) {
              shouldTakeContactAddress = true;
            } else if (isContactFooter && !isMainFooter) {
              shouldTakeContactAddress = false;
            } else if (contactPriority > mainPriority) {
              shouldTakeContactAddress = true;
            } else if (contactPriority >= mainPriority && contactPriority > bestContactAddressPriority) {
              shouldTakeContactAddress = true;
            } else if (contactPriority === mainPriority && contactAddr.split(",").length > mainAddr.split(",").length) {
              shouldTakeContactAddress = true;
            }
          }

          if (shouldTakeContactAddress) {
            mainData.companyAddress = contactData.companyAddress;
            mainData.addressSource = contactData.addressSource;
            bestContactAddressPriority = Math.max(bestContactAddressPriority, contactPriority);
            if (isContactFooter) footerAddressTakenFromContactPage = true;

            // Re-validate state & city from updated contact page address
            const { state, city } = Extractor.detectStateAndCity(contactData.companyAddress);
            if (["Y", "Available"].includes(state)) mainData.state = state;
            if (["Y", "Available"].includes(city)) mainData.city = city;

            // Authoritative address country from contact page
            if (contactData.countryName) {
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

          // Merge Country, State, City, Profile, Phone
          if (contactData.countryName && (!mainData.countryName || mainData.countryName === "Not Available" || mainData.countryName === "United States Of America")) {
            mainData.countryName = contactData.countryName;
          }
          if (["Y", "Available"].includes(contactData.state) && !["Y", "Available"].includes(mainData.state)) mainData.state = contactData.state;
          if (["Y", "Available"].includes(contactData.city) && !["Y", "Available"].includes(mainData.city)) mainData.city = contactData.city;
          if (contactData.companyProfile === "Y" && mainData.companyProfile !== "Y") mainData.companyProfile = "Y";
          const isDummyPhone = num => !num || /^(?:0123456789|1234567890|12345678910|2345678910|123456789|12345678|1234567|9876543210|987654321|(\d)\1{6,})$/.test(num);
          if (contactData.phoneNumber && (isDummyPhone(mainData.phoneNumber) || !mainData.phoneNumber)) mainData.phoneNumber = contactData.phoneNumber;

          // Double check address city/capital against CITY_STATE_COUNTRY_MAP to guarantee address country consistency
          if (mainData.companyAddress) {
            for (const m of Extractor.CITY_STATE_COUNTRY_MAP || []) {
              if (m.regex.test(mainData.companyAddress)) {
                mainData.countryName = m.country;
                const { state, city } = Extractor.detectStateAndCity(mainData.companyAddress);
                if (["Y", "Available"].includes(state)) mainData.state = state;
                if (["Y", "Available"].includes(city)) mainData.city = city;
                break;
              }
            }
          }

          // A contact-detail address must not be replaced by a later page's footer.
          if (bestContactAddressPriority >= 150 && mainData.countryName && mainData.emailId && mainData.phoneNumber) {
            break;
          }
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
