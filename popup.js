/**
 * Website Scraping & QC Helper - Popup Controller v2.2
 * Self-contained direct execution: Does not rely on service-worker messaging,
 * preventing any "Receiving end does not exist" connection errors.
 */

const $ = id => document.getElementById(id);

let portalTabId = null;
let currentExtractedData = null;

const ALL_FIELD_KEYS = [
  "websiteStatus",
  "businessType",
  "companyProfile",
  "companyName",
  "companyAddress",
  "countryName",
  "state",
  "city",
  "emailId",
  "secondaryEmailId",
  "phoneNumber",
  "numberOfProduct",
  "imageProduct",
  "noOfProductDescription"
];
const PORTAL_FIELD_COUNT = ALL_FIELD_KEYS.length + 1;

// Display status banner
function setStatus(msg, type = "info") {
  const el = $("status-banner");
  el.className = `status-banner ${type}`;
  el.textContent = msg;
}

// Normalize URL
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

function mergeFrameExtractionResults(results) {
  const records = (results || []).map(item => item?.result).filter(data => data && !data.error);
  if (!records.length) {
    const frameErrors = (results || [])
      .map(item => item?.result?.error)
      .filter(Boolean)
      .map(error => String(error));
    return frameErrors.length
      ? { error: `Page extraction failed: ${frameErrors.slice(0, 3).join("; ")}` }
      : null;
  }
  const completeness = data => ["companyName", "companyAddress", "countryName", "emailId", "phoneNumber"]
    .reduce((score, key) => score + (data[key] ? 1 : 0), 0);
  records.sort((a, b) => completeness(b) - completeness(a));
  const merged = { ...records[0] };
  for (const data of records.slice(1)) {
    for (const key of ["companyName", "countryName", "emailId", "secondaryEmailId", "phoneNumber", "enUrl", "contactUrl"]) {
      if (!merged[key] && data[key]) merged[key] = data[key];
    }
    if (data.companyAddress) {
      const currentPriority = contactAddressSourcePriority(merged.addressSource);
      const incomingPriority = contactAddressSourcePriority(data.addressSource);
      if (!merged.companyAddress || incomingPriority > currentPriority ||
          (incomingPriority === currentPriority && data.companyAddress.split(",").length > merged.companyAddress.split(",").length)) {
        merged.companyAddress = data.companyAddress;
        merged.addressSource = data.addressSource;
        if (data.countryName) merged.countryName = data.countryName;
      }
    }
    if (["Available", "Y"].includes(data.state)) merged.state = "Available";
    if (["Available", "Y"].includes(data.city)) merged.city = "Available";
    merged.contactUrls = [...new Set([...(merged.contactUrls || []), ...(data.contactUrls || [])])];
  }
  return merged;
}

// Get active tab in current window
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("Could not identify active browser tab.");
  return tab;
}

// Detect URL directly from active portal tab using executeScript
async function detectPortalUrl() {
  try {
    const tab = await getActiveTab();
    portalTabId = tab.id;

    const title = tab.title ? tab.title.slice(0, 24) : "Portal Connected";
    $("portal-tab-name").textContent = title;

    // Direct script execution into active tab with allFrames: true (handles iframes)
    const execResults = await chrome.scripting.executeScript({
      target: { tabId: portalTabId, allFrames: true },
      func: () => {
        const controls = [...document.querySelectorAll("input:not([type=hidden]), textarea")];
        for (const c of controls) {
          const str = [c.name, c.id, c.placeholder, c.getAttribute("aria-label"), c.parentElement?.innerText].join(" ").toLowerCase();
          if (str.includes("website") || str.includes("url")) {
            if (c.value && c.value.trim()) return c.value.trim();
          }
        }
        for (const c of controls) {
          if (/^https?:\/\//i.test(c.value || "")) return c.value.trim();
        }
        return "";
      }
    });

    const result = execResults?.find(r => r?.result)?.result || "";

    if (result) {
      $("url").value = result;
      $("btn-clear-url").style.display = "block";
      setStatus(`Detected URL: ${result}`, "ok");
      return result;
    }
  } catch (err) {
    console.log("Portal URL detection note:", err);
  }
  return "";
}

// Wait for tab load completion
function waitForTabComplete(tabId, timeoutMs = 25000) {
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
      finish(new Error("Website load timed out."));
    }, timeoutMs);

    function listener(id, info) {
      if (id === tabId && info.status === "complete") {
        finish();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then(tab => {
      if (tab.status === "complete") finish();
    }).catch(finish);
  });
}

async function recoverFromBrowserError(tabId, requestedUrl, timeoutMs = 25000) {
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
  const timer = setTimeout(() => controller.abort(), 6000);
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
  if ((result?.companyAddress && result?.countryName && result?.emailId && !["N", "Not Available"].includes(result?.state)) || !renderIfAddressMissing) {
    return result;
  }

  let renderedTab;
  try {
    renderedTab = await chrome.tabs.create({ url: response?.url || pageUrl, active: false });
    await waitForTabComplete(renderedTab.id, 10000);
    renderedTab = await recoverFromBrowserError(
      renderedTab.id,
      response?.url || pageUrl,
      10000
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
        const deadline = Date.now() + 2500;
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

// Main crawl uses a background tab for the rendered homepage; subpages are fetched
// by the extension context so host permissions cover cross-origin contact links.
async function crawlAndExtractDirect(targetUrl) {
  const normUrl = normalizeUrl(targetUrl);
  if (!normUrl) {
    throw new Error("Please enter a valid website URL.");
  }

  setStatus("Opening website in background tab...", "info");

  let tab = null;
  try {
    // Step 1: Create background tab and navigate to URL
    tab = await chrome.tabs.create({ url: normUrl, active: false });
    setStatus("Waiting for page to load...", "info");
    await waitForTabComplete(tab.id, 15000);
    tab = await recoverFromBrowserError(tab.id, normUrl, 15000);

    // Extra wait for JS-rendered SPAs (React/Vue/Angular)
    await new Promise(r => setTimeout(r, 400));

    // Step 2: Inject extractor.js if not already present
    const [{ result: alreadyLoaded }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => typeof window.Extractor !== "undefined"
    });

    if (!alreadyLoaded) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ["extractor.js"]
      });
    }

    // Step 3: Run extraction INSIDE the live tab with full DOM access
    // This gives us properly rendered HTML, all dynamic elements, and correct document.title
    setStatus("Extracting company details from page...", "info");
    const frameResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: async (pageUrl) => {
        try {
          const baseHost = new URL(pageUrl).hostname.replace(/^www\./i, "").toLowerCase();
          const frameHost = window.location.hostname.replace(/^www\./i, "").toLowerCase();
          if (baseHost && frameHost && baseHost !== frameHost &&
              !baseHost.endsWith(`.${frameHost}`) && !frameHost.endsWith(`.${baseHost}`)) return null;
          // Use live document — not a DOMParser copy — for best company name detection
          const extract = () => Extractor.extractFromDocument(
            document,
            Extractor.getElementText(document.body),
            window.location.href || pageUrl
          );
          let data = extract();
          const deadline = Date.now() + 3000;
          while (!data.companyAddress && Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, 300));
            data = extract();
          }
          return data;
        } catch (e) {
          return { error: String(e) };
        }
      },
      args: [tab.url || normUrl]  // use final redirected URL from tab
    });
    let mainData = mergeFrameExtractionResults(frameResults);

    // If script extraction failed in every frame, try the site's source HTML.
    // This recovers pages whose live frames block or interrupt script execution.
    if (!mainData || mainData.error) {
      const frameError = mainData?.error;
      const fetchedData = await extractFetchedPage(tab.id, tab.url || normUrl);
      if (fetchedData && !fetchedData.error) mainData = fetchedData;
      else if (fetchedData?.error) mainData = fetchedData;
      else if (frameError) mainData = { error: frameError };
    }

    if (!mainData || mainData.error) {
      throw new Error(mainData?.error || "Could not extract details from page.");
    }

    // Step 4: English subpage fallback (Issue 16: Retry candidates when English subpage fails)
    let enCandidates = [];
    try {
      const u = new URL(tab.url || normUrl);
      const needsEnglishFallback = !mainData.companyName || !/[a-zA-Z]{3,}/.test(mainData.companyName) ||
        !mainData.companyAddress || !/[a-zA-Z]{5,}/.test(mainData.companyAddress);
      const hostCandidates = needsEnglishFallback
        ? [mainData.enUrl || `${u.origin}/en`]
        : [];
      enCandidates = [...new Set(hostCandidates.filter(Boolean))].filter(candidate => candidate !== normUrl && candidate !== tab.url);
    } catch {}

    for (const testUrl of enCandidates) {
      try {
        setStatus("Checking English version of site...", "info");
        const enData = await extractFetchedPage(tab.id, testUrl);

        if (enData && !enData.error) {
          // Prefer Latin-alphabet company name from English subpage
          if (enData.companyName && /[a-zA-Z]{3,}/.test(enData.companyName) &&
              (!mainData.companyName || !/[a-zA-Z]{3,}/.test(mainData.companyName))) {
            mainData.companyName = enData.companyName;
            mainData.companyNameRaw = enData.companyNameRaw || enData.companyName;
          }
          // Prefer Latin address from English subpage
          if (enData.companyAddress && /[a-zA-Z]{5,}/.test(enData.companyAddress) &&
              !String(mainData.addressSource || "").startsWith("contact-detail-")) {
            mainData.companyAddress = enData.companyAddress;
            mainData.addressSource = enData.addressSource;
          }
          // Merge email
          const englishEmails = Extractor.mergeContactEmails(
            mainData.emailId,
            enData.emailId || enData.secondaryEmailId,
            "",
            mainData.secondaryEmailId
          );
          mainData.emailId = englishEmails.emailId;
          mainData.secondaryEmailId = englishEmails.secondaryEmailId;
          // Merge country / state / city
          if (enData.countryName && !mainData.countryName) mainData.countryName = enData.countryName;
          if (["Y", "Available"].includes(enData.state) && !["Y", "Available"].includes(mainData.state)) mainData.state = enData.state;
          if (["Y", "Available"].includes(enData.city) && !["Y", "Available"].includes(mainData.city)) mainData.city = enData.city;
          // Merge phone
          if (enData.phoneNumber && !mainData.phoneNumber) mainData.phoneNumber = enData.phoneNumber;
          break; // Found and merged from first responding candidate
        }
      } catch (e) {
        console.log("English subpage check note:", e);
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
      }).slice(0, 2);
    } catch {}

    let footerAddressTakenFromContactPage = false;
    let bestContactAddressPriority = -1;
    let contactEmailPrioritySet = false;

    for (const contactUrl of contactCandidates) {
      try {
        setStatus("Checking Contact page for official address...", "info");
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
            if (["Y", "Available"].includes(state)) mainData.state = "Available";
            if (["Y", "Available"].includes(city)) mainData.city = "Available";

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
          
          // 👇 FIX: Always prioritize the Contact Page phone over the main page (bottom) phone
          if (contactData.phoneNumber && !isDummyPhone(contactData.phoneNumber)) {
            mainData.phoneNumber = contactData.phoneNumber;
          }
          // Double check address city/capital against CITY_STATE_COUNTRY_MAP to guarantee address country consistency
          if (mainData.companyAddress) {
            for (const m of Extractor.CITY_STATE_COUNTRY_MAP || []) {
              if (m.regex.test(mainData.companyAddress)) {
                mainData.countryName = m.country;
                const { state, city } = Extractor.detectStateAndCity(mainData.companyAddress);
                if (["Y", "Available"].includes(state)) mainData.state = "Available";
                if (["Y", "Available"].includes(city)) mainData.city = "Available";
                break;
              }
            }
          }

          // A contact-detail address must not be replaced by a later page's footer.
          if (bestContactAddressPriority >= 150 && mainData.countryName && mainData.emailId && mainData.phoneNumber) {
            break;
          }
        }
      } catch (e) {
        console.log("Contact page check note:", e);
      }
    }

    return mainData;

  } finally {
    // Always close the background tab
    if (tab?.id) {
      chrome.tabs.remove(tab.id).catch(() => {});
    }
  }
}


// Populate UI form fields with extracted data and check rules
function populateFields(data) {
  if (!data) return;

  // 1. Populate all 14 fields
  for (const key of ALL_FIELD_KEYS) {
    const el = $(`field-${key}`);
    if (el && data[key] !== undefined && data[key] !== null) {
      let value = data[key];
      if ((key === "state" || key === "city") && el.tagName === "SELECT") {
        const normalized = String(value).toLowerCase().replace(/[^a-z]/g, "");
        if (["available", "yes", "true"].includes(normalized)) value = "Y";
        else if (["notavailable", "unavailable", "no", "false"].includes(normalized)) value = "N";
      }
      el.value = value;
    }
  }

  // 1.5 Highlight empty fields (Issue 17)
  for (const key of ALL_FIELD_KEYS) {
    const el = $(`field-${key}`);
    const empty = !el?.value?.trim();
    el?.parentElement?.classList.toggle("qc-field-empty", empty);
  }

  // 2. Check Forbidden Categories (Porn, Medical, Food, Weapons, etc.)
  const alertEl = $("compliance-alert");
  if (data.forbidden?.isForbidden) {
    alertEl.style.display = "flex";
    alertEl.textContent = data.forbidden.message;
    setStatus(data.forbidden.message, "err");
  } else if (data.urlRules?.isSubdomain) {
    alertEl.style.display = "flex";
    alertEl.textContent = data.urlRules.warning;
    setStatus(data.urlRules.warning, "warn");
  } else {
    alertEl.style.display = "none";
  }

  // 3. Social Media Verification Links (Rule 5 & Important Notes: Facebook, LinkedIn)
  const socialRow = $("social-links-row");
  const fbLink = $("link-fb");
  const liLink = $("link-li");
  const sep = $("social-sep");

  if (data.social?.facebook || data.social?.linkedin) {
    socialRow.style.display = "flex";
    if (data.social.facebook) {
      fbLink.href = data.social.facebook;
      fbLink.style.display = "inline";
    } else {
      fbLink.style.display = "none";
    }
    if (data.social.linkedin) {
      liLink.href = data.social.linkedin;
      liLink.style.display = "inline";
    } else {
      liLink.style.display = "none";
    }
    sep.style.display = (data.social.facebook && data.social.linkedin) ? "inline" : "none";
  } else {
    socialRow.style.display = "none";
  }

  // 4. Render QC Checklist
  renderQcChecklist(data);

  $("btn-fill-portal").disabled = false;
}

// Read current values from UI
function readFieldsFromUi() {
  const data = {
    websiteName: $("url").value.trim()
  };
  for (const key of ALL_FIELD_KEYS) {
    const el = $(`field-${key}`);
    if (el) data[key] = el.value.trim();
  }
  return data;
}

// Render QC Checklist with Rule validations
function renderQcChecklist(data) {
  const qcListEl = $("qc-checklist");
  qcListEl.innerHTML = "";

  const checks = [
    {
      name: "Rule 1: Website Status",
      ok: ["W-Working", "Working"].includes(data.websiteStatus) && !data.urlRules?.isSubdomain,
      msg: data.urlRules?.isSubdomain ? "Subdomain detected (Not Allowed)" : `Status: ${data.websiteStatus}`
    },
    {
      name: "Rule 2: Business Type",
      ok: Boolean(data.businessType),
      msg: `Classified as ${data.businessType || "Unknown"}`
    },
    {
      name: "Rule 3: Company Profile",
      ok: ["Y", "Available"].includes(data.companyProfile),
      msg: `Profile is ${data.companyProfile}`
    },
    {
      name: "Rule 4: Company Name",
      ok: Boolean(data.companyName) &&
          !/[()\[\]]/.test(data.companyName) &&
          !(data.companyName.length > 5 && data.companyName === data.companyName.toUpperCase() && /[A-Z]{4,}/.test(data.companyName)),
      msg: data.companyName ? `Name: ${data.companyName}` : "Company name missing"
    },
    {
      name: "Rule 5: Country Name",
      ok: Boolean(data.countryName),
      msg: `Country: ${data.countryName}`
    },
    {
      name: "Rule 6: Address",
      ok: Boolean(data.companyAddress) &&
          !/[()\[\]]/.test(data.companyAddress) &&
          !/\b(?:USA|UK|India|China|Germany|Korea|Taiwan|Japan|Italy|France)\b/i.test(data.companyAddress.slice(-30)) &&
          !/\d{5,6}\s*$/.test(data.companyAddress),
      msg: data.companyAddress ? "Clean address" : "Address not found"
    },
    {
      name: "Rule 7 & 8: State & City",
      ok: ["Y", "Available"].includes(data.state) && ["Y", "Available"].includes(data.city),
      msg: `State: ${data.state}, City: ${data.city}`
    },
    {
      name: "Rule 9 & 10: Emails",
      ok: Boolean(data.emailId),
      msg: `Primary: ${data.emailId || "None"}, Secondary: ${data.secondaryEmailId || "Skipped"}`
    },
    {
      name: "Rule 11: Phone Number",
      ok: Boolean(data.phoneNumber) &&
          !data.phoneNumber.startsWith("0") &&
          !Extractor.isTollFreeNumber(data.phoneNumber, data.countryName),
      msg: data.phoneNumber ? `Digits: ${data.phoneNumber} (No country code, no 0, no toll-free)` : "Phone not found"
    },
    {
      name: "Rules 12-14: Products & Images",
      ok: data.numberOfProduct !== "0",
      msg: `Products: ${data.numberOfProduct}, Images: ${data.imageProduct}, Descs: ${data.noOfProductDescription}`
    }
  ];

  let passCount = 0;
  for (const c of checks) {
    if (c.ok) passCount++;
    const item = document.createElement("div");
    item.className = `qc-item ${c.ok ? "pass" : "warn"}`;
    item.innerHTML = `
      <span class="qc-badge">${c.ok ? "PASS" : "REVIEW"}</span>
      <span><strong>${c.name}:</strong> ${c.msg}</span>
    `;
    qcListEl.appendChild(item);
  }

  const badge = $("qc-score-badge");
  badge.textContent = `${passCount}/${checks.length} Rules Compliant`;
  badge.style.background = passCount >= 8 ? "#10b981" : "#f59e0b";

  $("qc-section").style.display = "block";
}

// Perform Extraction
async function performExtraction(targetUrl) {
  setStatus("Crawling website (background tab)...", "info");

  const data = await crawlAndExtractDirect(targetUrl);
  currentExtractedData = data;
  populateFields(currentExtractedData);

  if (data.forbidden?.isForbidden) {
    setStatus(data.forbidden.message || "This website is not eligible for processing.", "err");
    return currentExtractedData;
  }

  const name = data.companyName ? `"${data.companyName}"` : "no name detected";
  setStatus(`✅ Done! Company: ${name}. Review all fields before filling.`, "ok");
  return currentExtractedData;
}

// Fill directly into portal tab via executeScript (no sendMessage, 100% reliable)
async function fillPortal(data) {
  if (data?.forbidden?.isForbidden) {
    setStatus(data.forbidden.message || "This website is not eligible for processing.", "err");
    return { filled: 0, total: PORTAL_FIELD_COUNT, blocked: true };
  }

  const websiteNotWorking = String(data?.websiteStatus || "").trim().toLowerCase() === "not working";
  const portalData = websiteNotWorking
    ? Object.fromEntries(Object.entries(data).filter(([key]) => ["websiteName", "websiteStatus"].includes(key)))
    : data;

  if (!portalTabId) {
    const tab = await getActiveTab();
    portalTabId = tab.id;
  }

  setStatus("Filling fields into portal form...", "info");

  const execResults = await chrome.scripting.executeScript({
    target: { tabId: portalTabId, allFrames: true },
    func: (formData) => {
      const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const controls = [...document.querySelectorAll("input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]), textarea, select")];

      function getExactLabel(ctrl) {
        if (ctrl.labels && ctrl.labels.length > 0) {
          const t = [...ctrl.labels].map(l => l.textContent || "").join(" ").trim();
          if (t) return t;
        }
        if (ctrl.id) {
          try {
            const lbl = document.querySelector(`label[for="${CSS.escape(ctrl.id)}"]`);
            if (lbl && lbl.textContent?.trim()) return lbl.textContent.trim();
          } catch {}
        }
        const enclosing = ctrl.closest("label");
        if (enclosing) {
          const cl = enclosing.cloneNode(true);
          for (const sub of cl.querySelectorAll("input, select, textarea, button")) sub.remove();
          const t = cl.textContent?.trim();
          if (t) return t;
        }
        let prev = ctrl.previousElementSibling;
        while (prev) {
          if (prev.tagName === "LABEL" || prev.classList?.contains("label") || prev.classList?.contains("label-row")) {
            const t = prev.textContent?.trim();
            if (t) return t;
          }
          prev = prev.previousElementSibling;
        }
        const cell = ctrl.closest("td, th");
        if (cell && cell.previousElementSibling) {
          const t = cell.previousElementSibling.textContent?.trim();
          if (t) return t;
        }
        const directParent = ctrl.parentElement;
        if (directParent && directParent !== document.body) {
          const lbl = directParent.querySelector("label");
          if (lbl && lbl.textContent?.trim()) return lbl.textContent.trim();
        }
        return "";
      }

      const FIELD_RULES = [
        {
          key: "websiteName",
          match: (ctrl, label, desc) => {
            if (ctrl.tagName === "SELECT") return 0;
            if (label.includes("websitename") || label === "website") return 60;
            if (desc.includes("websitename") || desc.includes("targeturl") || desc.includes("siteurl")) return 50;
            return 0;
          }
        },
        {
          key: "websiteStatus",
          isSelect: true,
          match: (ctrl, label, desc) => {
            if (ctrl.tagName !== "SELECT") return 0;
            if (label.includes("status")) return 50;
            if (desc.includes("websitestatus") || desc.includes("sitestatus")) return 40;
            return 0;
          }
        },
        {
          key: "businessType",
          isSelect: true,
          match: (ctrl, label, desc) => {
            if (ctrl.tagName !== "SELECT") return 0;
            if (label.includes("businesstype") || label.includes("natureofbusiness")) return 50;
            if (desc.includes("businesstype") || desc.includes("natureofbusiness")) return 40;
            return 0;
          }
        },
        {
          key: "companyProfile",
          isSelect: true,
          match: (ctrl, label, desc) => {
            if (ctrl.tagName !== "SELECT") return 0;
            if (label.includes("companyprofile")) return 50;
            if (desc.includes("companyprofile") || desc.includes("profileofcompany")) return 40;
            return 0;
          }
        },
        {
          key: "companyName",
          isSelect: false,
          match: (ctrl, label, desc) => {
            if (ctrl.tagName === "SELECT") return 0;
            if (label.includes("address") || label.includes("country") || label.includes("profile")) return 0;
            if (desc.includes("companyaddress") || desc.includes("countryname") || desc.includes("companyprofile")) return 0;

            let score = 0;
            if (label.includes("company") && label.includes("name")) score += 60;
            else if (label.includes("company") || label.includes("firm")) score += 40;
            else if (desc.includes("companyname") || desc.includes("nameofcompany") || desc.includes("cname")) score += 50;

            if (ctrl.tagName === "INPUT" && ctrl.type !== "hidden") score += 10;
            if (ctrl.tagName === "TEXTAREA") score -= 20;
            return score;
          }
        },
        {
          key: "companyAddress",
          isSelect: false,
          match: (ctrl, label, desc) => {
            if (ctrl.tagName === "SELECT") return 0;
            if (label.includes("country") && !label.includes("address")) return 0;
            if (desc.includes("countryname") && !desc.includes("address")) return 0;

            let score = 0;
            if (label.includes("address")) score += 60;
            else if (desc.includes("companyaddress") || desc.includes("address") || desc.includes("addr")) score += 50;

            if (ctrl.tagName === "TEXTAREA") score += 20;
            return score;
          }
        },
        {
          key: "countryName",
          isSelect: false,
          match: (ctrl, label, desc) => {
            if (label.includes("address") || label.includes("profile")) return 0;
            if (desc.includes("companyaddress") || desc.includes("companyprofile")) return 0;

            let score = 0;
            if (label.includes("country")) score += 60;
            else if (desc.includes("countryname") || desc.includes("country")) score += 50;

            if (ctrl.tagName === "INPUT") score += 10;
            if (ctrl.tagName === "SELECT") score += 20;
            if (ctrl.tagName === "TEXTAREA") score -= 30;
            return score;
          }
        },
        {
          key: "state",
          isSelect: true,
          match: (ctrl, label, desc) => {
            if (ctrl.tagName !== "SELECT") return 0;
            if (label.includes("state") || label.includes("province")) return 50;
            if (desc.includes("statename") || desc.includes("state")) return 40;
            return 0;
          }
        },
        {
          key: "city",
          isSelect: true,
          match: (ctrl, label, desc) => {
            if (ctrl.tagName !== "SELECT") return 0;
            if (label.includes("city") || label.includes("town") || label.includes("district")) return 50;
            if (desc.includes("cityname") || desc.includes("city")) return 40;
            return 0;
          }
        },
        {
          key: "emailId",
          isSelect: false,
          match: (ctrl, label, desc) => {
            if (ctrl.tagName === "SELECT") return 0;
            if (label.includes("secondary") || label.includes("alt") || label.includes("2")) return 0;
            if (desc.includes("secondary") || desc.includes("alt") || desc.includes("email2")) return 0;

            let score = 0;
            if (label.includes("email") || label.includes("mail")) score += 50;
            else if (desc.includes("emailid") || desc.includes("email")) score += 40;
            return score;
          }
        },
        {
          key: "secondaryEmailId",
          isSelect: false,
          match: (ctrl, label, desc) => {
            if (ctrl.tagName === "SELECT") return 0;
            let score = 0;
            if ((label.includes("secondary") || label.includes("alt") || label.includes("2")) && (label.includes("email") || label.includes("mail"))) score += 60;
            else if (desc.includes("secondaryemail") || desc.includes("alternateemail") || desc.includes("email2")) score += 50;
            return score;
          }
        },
        {
          key: "phoneNumber",
          isSelect: false,
          match: (ctrl, label, desc) => {
            if (ctrl.tagName === "SELECT") return 0;
            let score = 0;
            if (label.includes("phone") || label.includes("tel") || label.includes("contact number") || label.includes("mobile")) score += 50;
            else if (desc.includes("phonenumber") || desc.includes("telephone") || desc.includes("tel")) score += 40;
            return score;
          }
        },
        {
          key: "numberOfProduct",
          isSelect: true,
          match: (ctrl, label, desc) => {
            if (ctrl.tagName !== "SELECT") return 0;
            if (label.includes("image") || label.includes("description")) return 0;
            if (label.includes("number of product") || label.includes("no of product") || label.includes("product count")) return 60;
            if (label.includes("product")) return 40;
            if (desc.includes("numberofproduct") || desc.includes("noofproduct")) return 50;
            return 0;
          }
        },
        {
          key: "imageProduct",
          isSelect: true,
          match: (ctrl, label, desc) => {
            if (ctrl.tagName !== "SELECT") return 0;
            if (label.includes("image")) return 60;
            if (desc.includes("imageproduct") || desc.includes("productimage")) return 50;
            return 0;
          }
        },
        {
          key: "noOfProductDescription",
          isSelect: true,
          match: (ctrl, label, desc) => {
            if (ctrl.tagName !== "SELECT") return 0;
            if (label.includes("desc")) return 60;
            if (desc.includes("description") || desc.includes("noofproductdescription")) return 50;
            return 0;
          }
        }
      ];

      let filled = 0;
      const used = new Set();
      const details = [];

      for (const rule of FIELD_RULES) {
        const val = formData[rule.key];
        if (val === undefined || val === null || String(val).trim() === "") {
          details.push({ field: rule.key, status: "missing" });
          continue;
        }

        let bestCtrl = null;
        let highestScore = 0;

        for (const ctrl of controls) {
          if (used.has(ctrl)) continue;

          const exactLabel = norm(getExactLabel(ctrl));
          const desc = norm([
            ctrl.id,
            ctrl.name,
            ctrl.placeholder,
            ctrl.getAttribute("aria-label"),
            ctrl.getAttribute("data-field")
          ].join(" "));

          const score = rule.match(ctrl, exactLabel, desc);
          if (score > highestScore) {
            highestScore = score;
            bestCtrl = ctrl;
          }
        }

        if (bestCtrl && highestScore > 0) {
          let expectedValue = String(val).trim();
          if (bestCtrl.tagName === "SELECT") {
            const wanted = norm(val);
            // Synonyms map for seamless portal compatibility
            const synMap = {
              "y": ["y", "available", "yes", "true", "1"],
              "available": ["y", "available", "yes", "true", "1"],
              "n": ["n", "notavailable", "no", "false", "0"],
              "notavailable": ["n", "notavailable", "no", "false", "0"],
              "wworking": ["wworking", "working"],
              "working": ["wworking", "working"],
              "distributer": ["distributer", "distributor"],
              "distributor": ["distributer", "distributor"],
              "industrialservices": ["industrialservices", "serviceprovider", "service"]
            };
            const countryAliases = {
              unitedstatesofamerica: ["unitedstatesofamerica", "unitedstates", "usa", "us"],
              unitedkingdom: ["unitedkingdom", "greatbritain", "uk", "gb"],
              southkorea: ["southkorea", "republicofkorea", "korea", "kr"],
              malaysia: ["malaysia", "my"],
              australia: ["australia", "au"],
              india: ["india", "bharat", "in"]
            };
            const validVariants = synMap[wanted] || countryAliases[wanted] || [wanted];
            let opt = [...bestCtrl.options].find(o => {
              const candidates = [norm(o.value), norm(o.textContent)];
              return validVariants.some(alias => candidates.some(candidate => candidate === alias || (alias.length >= 4 && candidate.startsWith(alias))));
            });
            if (!opt) {
              details.push({ field: rule.key, status: "missing", reason: "No matching option." });
              continue;
            }
            bestCtrl.value = opt.value;
            bestCtrl.selectedIndex = opt.index;
            if (bestCtrl.value !== opt.value || bestCtrl.selectedIndex !== opt.index) {
              details.push({ field: rule.key, status: "missing", reason: "Option was not accepted." });
              continue;
            }
            expectedValue = opt.value;
          } else {
            const proto = bestCtrl.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
            const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
            if (descriptor && descriptor.set) {
              descriptor.set.call(bestCtrl, val);
            } else {
              bestCtrl.value = val;
            }
            if (bestCtrl.value !== String(val).trim()) {
              details.push({ field: rule.key, status: "missing", reason: "Value was not accepted." });
              continue;
            }
          }
          used.add(bestCtrl);
          bestCtrl.dispatchEvent(new Event("focus", { bubbles: true }));
          bestCtrl.dispatchEvent(new Event("input", { bubbles: true }));
          bestCtrl.dispatchEvent(new Event("change", { bubbles: true }));
          bestCtrl.dispatchEvent(new Event("blur", { bubbles: true }));
          if (bestCtrl.value !== expectedValue) {
            details.push({ field: rule.key, status: "missing", reason: "Value changed after form events." });
            continue;
          }
          bestCtrl.classList.add("qc-field-filled-highlight");
          filled++;
          details.push({ field: rule.key, status: "filled", val });
        } else {
          details.push({ field: rule.key, status: "missing" });
        }
      }
      return { filled, total: FIELD_RULES.length, details };
    },
    args: [portalData]
  });

  const totals = execResults?.map(r => r?.result).filter(Boolean) || [];
  const totalFilled = totals.reduce((sum, result) => sum + result.filled, 0);
  if (websiteNotWorking) {
    setStatus("Website status is Not Working. Filled the website name and status only; company details were skipped.", "warn");
    return;
  }
  setStatus(`✅ Filled ${totalFilled}/${PORTAL_FIELD_COUNT} fields in portal! Review and Submit.`, "ok");
}

// Event Listeners on DOMContentLoaded
document.addEventListener("DOMContentLoaded", async () => {
  // Detect URL from portal on open
  await detectPortalUrl();

  // Clear URL button
  $("url").addEventListener("input", () => {
    $("btn-clear-url").style.display = $("url").value.trim() ? "block" : "none";
  });
  $("btn-clear-url").addEventListener("click", () => {
    $("url").value = "";
    $("btn-clear-url").style.display = "none";
    $("url").focus();
  });

  // Re-detect URL button
  $("btn-detect-url").addEventListener("click", async () => {
    await detectPortalUrl();
  });

  // 1-Click Grab & Fill Button
  $("btn-grab-and-fill").addEventListener("click", async () => {
    const rawUrl = $("url").value.trim();
    if (!rawUrl) {
      setStatus("Please enter or detect a Website URL first.", "warn");
      return;
    }

    const btn = $("btn-grab-and-fill");
    btn.disabled = true;
    btn.innerHTML = `<span class="spin"></span> <span>Crawling & Filling...</span>`;

    try {
      const data = await performExtraction(rawUrl);
      await fillPortal(data);
    } catch (err) {
      setStatus(`Error: ${err.message || err}`, "err");
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<span class="btn-icon">⚡</span> <span>Grab & Fill (1-Click)</span>`;
    }
  });

  // Extract Only Button
  $("btn-extract-only").addEventListener("click", async () => {
    const rawUrl = $("url").value.trim();
    if (!rawUrl) {
      setStatus("Please enter or detect a Website URL first.", "warn");
      return;
    }

    const btn = $("btn-extract-only");
    btn.disabled = true;
    btn.innerHTML = `<span class="spin"></span> <span>Extracting...</span>`;

    try {
      await performExtraction(rawUrl);
    } catch (err) {
      setStatus(`Error: ${err.message || err}`, "err");
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<span class="btn-icon">🔍</span> <span>Extract Only</span>`;
    }
  });

  // Fill Portal Form Button
  $("btn-fill-portal").addEventListener("click", async () => {
    const data = readFieldsFromUi();
    const btn = $("btn-fill-portal");
    btn.disabled = true;
    try {
      await fillPortal(data);
    } catch (err) {
      setStatus(`Error filling portal: ${err.message || err}`, "err");
    } finally {
      btn.disabled = false;
    }
  });

  // Copy Buttons
  document.querySelectorAll(".btn-copy-field").forEach(btn => {
    btn.addEventListener("click", async () => {
      const targetId = btn.getAttribute("data-copy");
      const targetEl = $(targetId);
      if (targetEl && targetEl.value) {
        await navigator.clipboard.writeText(targetEl.value);
        const originalHtml = btn.innerHTML;
        btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        setTimeout(() => {
          btn.innerHTML = originalHtml;
        }, 1200);
      }
    });
  });

  // Copy JSON
  $("btn-copy-all").addEventListener("click", async () => {
    const data = readFieldsFromUi();
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    const originalText = $("btn-copy-all").innerHTML;
    $("btn-copy-all").innerHTML = `<span>✓ Copied!</span>`;
    setTimeout(() => {
      $("btn-copy-all").innerHTML = originalText;
    }, 1500);
  });

  // Open Target Site in New Tab
  $("btn-open-target").addEventListener("click", () => {
    const u = $("url").value.trim();
    if (u) {
      const href = /^https?:\/\//i.test(u) ? u : "http://" + u;
      chrome.tabs.create({ url: href });
    }
  });

  // Auto-format & expand legal suffixes when user edits Company Name field
  const cNameInput = $("field-companyName");
  if (cNameInput) {
    cNameInput.addEventListener("blur", () => {
      if (cNameInput.value && typeof Extractor !== "undefined" && Extractor.formatCompanyName) {
        cNameInput.value = Extractor.formatCompanyName(cNameInput.value);
      }
    });
  }
});
