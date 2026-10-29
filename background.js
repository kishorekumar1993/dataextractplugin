/**
 * Background Service Worker (Manifest V3)
 * Orchestrates tab-based background crawling so DOMParser and dynamic JavaScript
 * are executed reliably inside real tab contexts without service-worker limitations.
 */

// The Manifest v3 worker is classic, so the shared extractor must be loaded
// into the service-worker context as well as into page tabs.
importScripts("extractor.js");

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

function annotateEmailCandidates(data, sourcePage, fallbackRole = "other") {
  const raw = Array.isArray(data?.emailCandidates) && data.emailCandidates.length
    ? data.emailCandidates
    : [data?.emailId, data?.secondaryEmailId].filter(Boolean).map(email => ({ email }));
  const detectedRole = data?.contactPageScore >= 4 ? "contact" : data?.emailPageRole;
  const pageRole = fallbackRole === "contact" || detectedRole === "contact" ? "contact" : detectedRole || fallbackRole;
  return raw.map(candidate => typeof candidate === "string" ? { email: candidate } : candidate)
    .filter(candidate => candidate?.email)
    .map(candidate => ({
      ...candidate,
      email: String(candidate.email).trim().toLowerCase(),
      sourcePage: candidate.sourcePage || sourcePage,
      pageRole: pageRole || fallbackRole,
      evidence: Array.isArray(candidate.evidence) ? candidate.evidence : []
    }));
}

function emailPageRoleForUrl(pageUrl) {
  try {
    const path = new URL(pageUrl).pathname;
    return path === "/" || path === "" ? "homepage" : "other";
  } catch { return "other"; }
}

function pageLanguageFromUrl(pageUrl) {
  try {
    const url = new URL(pageUrl);
    const subdomain = url.hostname.split(".")[0].toLowerCase();
    const queryLanguage = url.searchParams.get("lang") || url.searchParams.get("language");
    const pathLanguage = url.pathname.match(/^\/([a-z]{2}(?:-[a-z]{2})?)(?:\/|$)/i)?.[1];
    const value = queryLanguage || (subdomain !== "www" ? subdomain : "") || pathLanguage || "";
    return value.toLowerCase();
  } catch { return ""; }
}

function isEnglishPage(data, pageUrl) {
  const declared = String(data?.pageLanguage || "").trim().toLowerCase().replace(/_/g, "-");
  if (declared) return declared === "en" || declared.startsWith("en-");
  const inferred = pageLanguageFromUrl(pageUrl);
  return inferred === "en" || inferred.startsWith("en-");
}

function hasNonEnglishLocale(pageUrl) {
  const locale = pageLanguageFromUrl(pageUrl).split("-")[0];
  return new Set(["ar", "bg", "ca", "cs", "da", "de", "el", "es", "et", "fa", "fi", "fr", "he", "hi", "hr", "hu", "id", "it", "ja", "ko", "lt", "lv", "ms", "nl", "no", "pl", "pt", "ro", "ru", "sk", "sl", "sv", "th", "tr", "uk", "vi", "zh"]).has(locale);
}

function rankEmailCandidates(candidates, rootUrl) {
  let host = "";
  try { host = new URL(rootUrl).hostname.replace(/^www\./i, "").toLowerCase(); } catch {}
  const roleRank = { contact: 0, homepage: 1, other: 2 };
  const mailboxScore = email => {
    const local = String(email || "").split("@")[0].toLowerCase();
    const priorities = ["sales", "info", "contact", "office", "export", "support", "service", "enquiries", "inquiries", "admin", "general"];
    const index = priorities.indexOf(local);
    return index < 0 ? 0 : priorities.length - index;
  };
  const merged = new Map();
  for (const candidate of candidates || []) {
    const email = String(candidate?.email || "").trim().toLowerCase();
    if (!email) continue;
    const emailDomain = (email.split("@")[1] || "").replace(/^www\./i, "").toLowerCase();
    const domainMatch = Boolean(host && (emailDomain === host || emailDomain.endsWith(`.${host}`) || host.endsWith(`.${emailDomain}`)));
    const current = merged.get(email) || {
      email,
      domainMatch,
      pageRole: candidate.pageRole || "other",
      pageRank: roleRank[candidate.pageRole] ?? roleRank.other,
      mailboxScore: Number(candidate.mailboxScore) || mailboxScore(email),
      confidence: 0,
      sourcePages: [],
      evidence: []
    };
    const rank = roleRank[candidate.pageRole] ?? roleRank.other;
    if (rank < current.pageRank) {
      current.pageRank = rank;
      current.pageRole = candidate.pageRole || "other";
    }
    current.domainMatch ||= domainMatch;
    current.mailboxScore = Math.max(current.mailboxScore, Number(candidate.mailboxScore) || mailboxScore(email));
    const evidence = Array.isArray(candidate.evidence) ? candidate.evidence : [];
    const confidence = evidence.includes("mailto") ? 3 : evidence.includes("json-ld") ? 2 : evidence.includes("email-element") ? 1 : 0;
    current.confidence = Math.max(current.confidence, confidence);
    if (candidate.sourcePage && !current.sourcePages.includes(candidate.sourcePage)) current.sourcePages.push(candidate.sourcePage);
    current.evidence = [...new Set([...current.evidence, ...evidence])];
    merged.set(email, current);
  }
  return [...merged.values()].sort((a, b) =>
    Number(b.domainMatch) - Number(a.domainMatch) ||
    a.pageRank - b.pageRank ||
    b.mailboxScore - a.mailboxScore ||
    b.confidence - a.confidence
  );
}

function mergeFrameExtractionResults(results) {
  const records = (results || []).map(item => item?.result).filter(data => data && !data.error);
  if (!records.length) return null;
  const completeness = data => ["companyName", "companyAddress", "countryName", "emailId", "phoneNumber"]
    .reduce((score, key) => score + (data[key] ? 1 : 0), 0);
  records.sort((a, b) => completeness(b) - completeness(a));
  const merged = { ...records[0] };
  const topFrameLanguage = results?.find(item => item?.frameId === 0)?.result?.pageLanguage;
  if (topFrameLanguage) merged.pageLanguage = topFrameLanguage;
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
    // Compliance is an exclusion rule: any same-site frame that identifies a
    // forbidden category or a disallowed online store must win the merge.
    if (data.forbidden?.isForbidden) merged.forbidden = data.forbidden;
    if (data.onlinePurchase?.isOnlineStore) merged.onlinePurchase = data.onlinePurchase;
  }
  merged.emailCandidates = [...new Map(records.flatMap(data => data.emailCandidates || [])
    .filter(candidate => candidate?.email)
    .map(candidate => [`${candidate.email.toLowerCase()}|${candidate.sourcePage || ""}`, candidate])).values()];
  merged.contactPageScore = Math.max(...records.map(data => Number(data.contactPageScore) || 0));
  if (merged.contactPageScore >= 4) merged.emailPageRole = "contact";
  if (merged.forbidden?.isForbidden || merged.onlinePurchase?.isOnlineStore || merged.urlRules?.isSubdomain) {
    merged.websiteStatus = "Not Working";
  }
  return merged;
}

function waitForTabComplete(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let probeTimer;
    const cleanup = () => {
      clearTimeout(timer);
      clearInterval(probeTimer);
      chrome.tabs.onUpdated.removeListener(listener);
    };
    const finish = error => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };
    const timer = setTimeout(async () => {
      try {
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => ({
            readyState: document.readyState,
            hasContent: Boolean(document.body && (document.body.innerText || "").trim().length > 30)
          })
        });
        if (result && (result.readyState === "interactive" || result.readyState === "complete" || result.hasContent)) {
          finish();
          return;
        }
      } catch {}
      finish(new Error("Website load timed out. Check if site is accessible."));
    }, timeoutMs);
    // Many sites have useful server-rendered content well before every image,
    // analytics script, and ad has finished loading. Start extraction as soon
    // as the document is interactive and has meaningful body text.
    probeTimer = setInterval(async () => {
      if (settled) return;
      try {
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => ({
            readyState: document.readyState,
            hasContent: Boolean(document.body && (document.body.innerText || "").trim().length > 30)
          })
        });
        if (result && (result.readyState === "interactive" || result.readyState === "complete") && result.hasContent) {
          finish();
        }
      } catch {}
    }, 250);
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
  fallbackUrl.protocol = fallbackUrl.protocol === "https:" ? "http:" : "https:";
  await chrome.tabs.update(tabId, { url: fallbackUrl.href });
  await waitForTabComplete(tabId, timeoutMs);
  tab = await chrome.tabs.get(tabId);
  if (!/^https?:\/\//i.test(tab.url || "") || String(tab.url || "").startsWith("chrome-error://")) {
    throw new Error("The website could not be loaded over HTTPS or HTTP.");
  }
  return tab;
}

async function extractFetchedPage(tabId, pageUrl, renderIfDataMissing = false) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
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
          const data = Extractor.extractFromDocument(doc, Extractor.getElementText(doc.body), url);
          data.pageLanguage = (doc.documentElement?.getAttribute("lang") || "").trim().toLowerCase();
          return data;
        },
        args: [html, response?.url || pageUrl]
      });
      result = extracted;
    } catch (e) {
      result = null;
    }
  }

  // Retry in a rendered page when the static response missed its address or
  // emails; contact details are often inserted by JavaScript.
  const missingRenderedData = !result?.companyAddress || !result?.emailId || !result?.secondaryEmailId;
  if (!renderIfDataMissing || !missingRenderedData) {
    return result;
  }

  let renderedTab;
  try {
    renderedTab = await chrome.tabs.create({ url: response?.url || pageUrl, active: false });
    await waitForTabComplete(renderedTab.id, 3000);
    renderedTab = await recoverFromBrowserError(
      renderedTab.id,
      response?.url || pageUrl,
      3000
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
        const extract = () => {
          const data = Extractor.extractFromDocument(
            document,
            Extractor.getElementText(document.body || document.documentElement),
            window.location.href || url
          );
          data.pageLanguage = (document.documentElement?.getAttribute("lang") || "").trim().toLowerCase();
          return data;
        };
        let data = extract();
        const deadline = Date.now() + 900;
        while ((!data.companyAddress || !data.emailId || !data.secondaryEmailId) && Date.now() < deadline) {
          await new Promise(resolve => setTimeout(resolve, 300));
          data = extract();
        }
        return data;
      },
      args: [response?.url || pageUrl]
    });
    const emails = [...new Set([
      renderedResult?.emailId, result?.emailId,
      renderedResult?.secondaryEmailId, result?.secondaryEmailId
    ].map(email => String(email || "").trim()).filter(Boolean))];
    const combined = { ...(result || {}) };
    for (const key of ["companyName", "companyNameRaw", "companyAddress", "countryName", "state", "city", "phoneNumber", "businessType", "companyProfile", "numberOfProduct", "imageProduct", "noOfProductDescription", "addressSource", "forbidden", "onlinePurchase", "urlRules", "social", "enUrl", "pageLanguage"]) {
      const value = renderedResult?.[key];
      if (value && value !== "Not Available") combined[key] = value;
    }
    combined.emailId = emails[0] || "";
    combined.secondaryEmailId = emails[1] || "";
    combined.emailCandidates = [...(result?.emailCandidates || []), ...(renderedResult?.emailCandidates || [])];
    combined.emailPageRole = renderedResult?.emailPageRole || result?.emailPageRole || "other";
    combined.contactPageScore = Math.max(Number(result?.contactPageScore) || 0, Number(renderedResult?.contactPageScore) || 0);
    combined.contactUrl = renderedResult?.contactUrl || result?.contactUrl;
    combined.contactUrls = [...new Set([...(result?.contactUrls || []), ...(renderedResult?.contactUrls || [])])];
    return combined;
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
async function crawlInTab(targetUrl, timeoutMs = 15000) {
  const normUrl = normalizeUrl(targetUrl);
  if (!normUrl) {
    return { success: false, error: "Please enter a valid website URL." };
  }

  let tab = null;
  const crawlDeadline = Date.now() + 22000;
  try {
    // 1. Create hidden background tab
    tab = await chrome.tabs.create({ url: normUrl, active: false });

    // 2. Wait for page load
    await waitForTabComplete(tab.id, timeoutMs);
    tab = await recoverFromBrowserError(tab.id, normUrl, timeoutMs);

    // Small delay to ensure client-side JS renders
    await new Promise(r => setTimeout(r, 150));

    // 3. Inject extractor.js into the tab only if not already loaded
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

    // 4. Run extraction inside tab context
    const frameResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: async (pageUrl) => {
        try {
          const baseHost = new URL(pageUrl).hostname.replace(/^www\./i, "").toLowerCase();
          const frameHost = window.location.hostname.replace(/^www\./i, "").toLowerCase();
          if (baseHost && frameHost && baseHost !== frameHost &&
              !baseHost.endsWith(`.${frameHost}`) && !frameHost.endsWith(`.${baseHost}`)) return null;
        } catch {}
        try {
          if (typeof Extractor === "undefined") return null;
          const extract = () => {
            const data = Extractor.extractFromDocument(
              document,
              document.body?.innerText || Extractor.getElementText(document.body),
              window.location.href || pageUrl
            );
            data.pageLanguage = (document.documentElement?.getAttribute("lang") || "").trim().toLowerCase();
            return data;
          };
          let data = extract();
          const deadline = Date.now() + 900;
          while (!data.companyAddress && Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, 300));
            data = extract();
          }
          return data;
        } catch (error) {
          return { error: String(error?.message || error || "Unknown extraction error") };
        }
      },
      args: [normUrl]
    });
    let mainData = mergeFrameExtractionResults(frameResults);

    if (!mainData) {
      // All-frame injection can yield no usable result on sites with unusual
      // frame setups. Retry the top document directly so a broken/empty child
      // frame cannot prevent extraction from the actual page.
      try {
        const [{ result: topResult }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: pageUrl => {
            if (typeof Extractor === "undefined") {
              return { error: "Extractor engine was not available in the page." };
            }
            try {
              const text = document.body?.innerText || Extractor.getElementText(document.body || document.documentElement);
              const data = Extractor.extractFromDocument(document, text, window.location.href || pageUrl);
              data.pageLanguage = (document.documentElement?.getAttribute("lang") || "").trim().toLowerCase();
              return data;
            } catch (error) {
              return { error: String(error?.message || error || "Unknown extraction error") };
            }
          },
          args: [tab.url || normUrl]
        });
        if (topResult && !topResult.error) mainData = topResult;
        else if (topResult?.error) console.warn("Top document extraction failed:", topResult.error);
      } catch (error) {
        console.warn("Top document extraction could not run:", error);
      }
    }

    if (!mainData) {
      const frameError = frameResults?.map(item => item?.result?.error).find(Boolean);
      throw new Error(frameError
        ? `Could not extract details from rendered page: ${frameError}`
        : "Could not extract details from rendered page. The page returned no usable frame content.");
    }
    let rootPageUrl = tab.url || normUrl;
    let allEmailCandidates = annotateEmailCandidates(mainData, rootPageUrl, emailPageRoleForUrl(rootPageUrl));

    // 5. English Subpage Crawling (for international companies with /en)
    let enCandidates = [];
    try {
      const u = new URL(normUrl);
      const declaredLanguage = String(mainData.pageLanguage || "").trim().toLowerCase();
      const sourceHasNonEnglishLocale = (declaredLanguage && !isEnglishPage(mainData, rootPageUrl)) ||
        hasNonEnglishLocale(rootPageUrl);
      const hostCandidates = isEnglishPage(mainData, rootPageUrl)
        ? []
        : [...(mainData.enUrls || []), mainData.enUrl, ...(sourceHasNonEnglishLocale ? [`${u.origin}/en`] : [])];
      enCandidates = [...new Set(hostCandidates.filter(Boolean))].filter(c => c !== rootPageUrl).slice(0, 3);
    } catch {}

    for (const candidateEnUrl of enCandidates) {
      if (Date.now() > crawlDeadline - 5000) break;
      try {
        const enData = await extractFetchedPage(tab.id, candidateEnUrl);

        if (enData && !enData.error) {
          const declaredLanguage = String(enData.pageLanguage || "").trim().toLowerCase();
          if (!declaredLanguage || isEnglishPage(enData, enData.websiteName || candidateEnUrl)) {
            // When the entry page is localized, use the English page as the
            // sole source of extracted fields and links to crawl next.
            mainData = enData;
            rootPageUrl = enData.websiteName || candidateEnUrl;
            allEmailCandidates = annotateEmailCandidates(mainData, rootPageUrl, emailPageRoleForUrl(rootPageUrl));
            break;
          }
          continue;
        }
      } catch (err) {
        console.log("English subpage candidate note:", err);
      }
    }

    // Crawl only contact URLs discovered in the page, not guessed routes.
    let contactCandidates = [];
    try {
      const u = new URL(rootPageUrl);
      // Always check discovered contact pages so their email can take primary
      // priority, even when the homepage already has two email addresses.
      const hostCandidates = [...(mainData.contactUrls || []), mainData.contactUrl];
      contactCandidates = [...new Set(hostCandidates.filter(Boolean).map(candidate => {
        try {
          const candidateUrl = new URL(candidate, u);
          if (hasNonEnglishLocale(candidateUrl.href)) return null;
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
      }).slice(0, 5);
    } catch {}

    let footerAddressTakenFromContactPage = false;
    let bestContactAddressPriority = -1;
    const visitedContactUrls = new Set(contactCandidates);
    for (let contactIndex = 0; contactIndex < contactCandidates.length && contactIndex < 3; contactIndex++) {
      // Keep optional subpage crawling from making the user wait indefinitely.
      if (Date.now() > crawlDeadline - 4000) break;
      const contactUrl = contactCandidates[contactIndex];
      try {
        const contactData = await extractFetchedPage(tab.id, contactUrl, true);

        if (contactData && !contactData.error) {
          if (contactData.pageLanguage && !isEnglishPage(contactData, contactUrl)) continue;
          // Relevant pages can link to additional pages containing company
          // contact details. Follow a bounded set of discovered same-site links.
          for (const discoveredUrl of [...(contactData.contactUrls || []), contactData.contactUrl].filter(Boolean)) {
            try {
              const nextUrl = new URL(discoveredUrl, contactUrl);
              const rootUrl = new URL(rootPageUrl);
              if (nextUrl.hostname.replace(/^www\./i, "").toLowerCase() !== rootUrl.hostname.replace(/^www\./i, "").toLowerCase()) continue;
              nextUrl.hash = "";
              if (!visitedContactUrls.has(nextUrl.href) && contactCandidates.length < 5) {
                visitedContactUrls.add(nextUrl.href);
                contactCandidates.push(nextUrl.href);
              }
            } catch {}
          }
          if (contactData.forbidden?.isForbidden) mainData.forbidden = contactData.forbidden;
          if (contactData.onlinePurchase?.isOnlineStore) mainData.onlinePurchase = contactData.onlinePurchase;
          if (mainData.forbidden?.isForbidden || mainData.onlinePurchase?.isOnlineStore) mainData.websiteStatus = "Not Working";
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

          const pathLooksLikeContact = /(?:contact|connect|location|inquir|enquir|reach|support)/i.test(new URL(contactUrl).pathname);
          const isContactInfoPage = contactData.emailPageRole === "contact" || contactData.contactPageScore >= 4 || pathLooksLikeContact;
          allEmailCandidates.push(...annotateEmailCandidates(contactData, contactUrl, isContactInfoPage ? "contact" : "other"));

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
            let domainCountry = "";
            try {
              const siteHost = new URL(tab.url || normUrl).hostname.toLowerCase();
              if (siteHost.endsWith(".com.au") || siteHost.endsWith(".au")) domainCountry = "Australia";
            } catch {}
            if (domainCountry) mainData.countryName = domainCountry;

            for (const m of Extractor.CITY_STATE_COUNTRY_MAP || []) {
              if (m.regex.test(mainData.companyAddress) &&
                  (!mainData.countryName || m.country === mainData.countryName)) {
                mainData.countryName = m.country;
                const { state, city } = Extractor.detectStateAndCity(mainData.companyAddress);
                if (["Y", "Available"].includes(state)) mainData.state = "Available";
                if (["Y", "Available"].includes(city)) mainData.city = "Available";
                break;
              }
            }
          }

          // A contact-detail address must not be replaced by a later page's footer.
        }
      } catch (err) {
        console.log("Contact subpage candidate note:", err);
      }
    }

    const rankedEmails = rankEmailCandidates(allEmailCandidates, tab.url || normUrl);
    mainData.emailCandidates = rankedEmails;
    mainData.emailId = rankedEmails[0]?.email || "";
    mainData.secondaryEmailId = rankedEmails[1]?.email || "";

    // Keep a country-code domain from being overwritten by ambiguous locality
    // names such as "Victoria", which exists in both Canada and Australia.
    try {
      const siteHost = new URL(tab.url || normUrl).hostname.toLowerCase();
      if ((siteHost.endsWith(".com.au") || siteHost.endsWith(".au")) && mainData.companyAddress) {
        mainData.countryName = "Australia";
      }
    } catch {}

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
