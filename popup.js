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
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Website load timed out."));
    }, timeoutMs);

    function listener(id, info) {
      if (id === tabId && info.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// Main Crawl & Extract Engine — always uses a background tab for full JS rendering
// This is CORS-proof and works on 100% of websites including SPAs and JS-heavy pages
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
    await waitForTabComplete(tab.id, 30000);

    // Extra wait for JS-rendered SPAs (React/Vue/Angular)
    await new Promise(r => setTimeout(r, 1500));

    // Step 2: Inject extractor.js if not already present
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

    // Step 3: Run extraction INSIDE the live tab with full DOM access
    // This gives us properly rendered HTML, all dynamic elements, and correct document.title
    setStatus("Extracting company details from page...", "info");
    const [{ result: mainData }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (pageUrl) => {
        try {
          // Use live document — not a DOMParser copy — for best company name detection
          return Extractor.extractFromDocument(document, Extractor.getElementText(document.body), pageUrl);
        } catch (e) {
          return { error: String(e) };
        }
      },
      args: [tab.url || normUrl]  // use final redirected URL from tab
    });

    if (!mainData || mainData.error) {
      throw new Error(mainData?.error || "Could not extract details from page.");
    }

    // Step 4: English subpage fallback (Issue 16: Retry candidates when English subpage fails)
    let enCandidates = [];
    try {
      const u = new URL(tab.url || normUrl);
      const hostCandidates = [
        mainData.enUrl,
        `${u.origin}/en`,
        `${u.origin}/en/`,
        `${u.origin}/english`,
        `${u.origin}/eng`,
        `${u.origin}/global-en`
      ];
      enCandidates = [...new Set(hostCandidates.filter(Boolean))].filter(candidate => candidate !== normUrl && candidate !== tab.url);
    } catch {}

    for (const testUrl of enCandidates) {
      try {
        setStatus("Checking English version of site...", "info");
        const [{ result: enData }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: async (url) => {
            try {
              const res = await fetch(url, { credentials: "omit" });
              if (!res.ok) return null;
              const html = await res.text();
              if (html.length < 200) return null;
              const doc = new DOMParser().parseFromString(html, "text/html");
              return Extractor.extractFromDocument(doc, Extractor.getElementText(doc.body), url);
            } catch { return null; }
          },
          args: [testUrl]
        });

        if (enData && !enData.error) {
          // Prefer Latin-alphabet company name from English subpage
          if (enData.companyName && /[a-zA-Z]{3,}/.test(enData.companyName) &&
              (!mainData.companyName || !/[a-zA-Z]{3,}/.test(mainData.companyName))) {
            mainData.companyName = enData.companyName;
          }
          // Prefer Latin address from English subpage
          if (enData.companyAddress && /[a-zA-Z]{5,}/.test(enData.companyAddress)) {
            mainData.companyAddress = enData.companyAddress;
          }
          // Merge email
          if (enData.emailId && enData.emailId !== mainData.emailId) {
            if (mainData.emailId) mainData.secondaryEmailId = mainData.emailId;
            mainData.emailId = enData.emailId;
          }
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

    // Step 5: Dynamic Contact Page Check (Checks if email is missing or address is incomplete/missing)
    const needsContactCheck = !mainData.emailId ||
                              !mainData.companyAddress ||
                              mainData.companyAddress.split(",").length < 3 ||
                              !mainData.phoneNumber;

    if (needsContactCheck) {
      let contactCandidates = [];
      try {
        const u = new URL(tab.url || normUrl);
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
        contactCandidates = [...new Set(candidates.filter(Boolean))].filter(c => c !== normUrl && c !== tab.url);
      } catch {}

      for (const contactUrl of contactCandidates) {
        try {
          setStatus("Checking Contact page for email & complete address...", "info");
          const [{ result: contactData }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: async (url) => {
              try {
                const res = await fetch(url, { credentials: "omit" });
                if (!res.ok) return null;
                const html = await res.text();
                if (html.length < 200) return null;
                const doc = new DOMParser().parseFromString(html, "text/html");
                return Extractor.extractFromDocument(doc, Extractor.getElementText(doc.body), url);
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
                // Re-validate state & city from updated address
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
        } catch (e) {
          console.log("Contact page check note:", e);
        }
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
      el.value = data[key];
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
          !/^(1800|1888|800|0800|1544|1588|1577|1566)/.test(data.phoneNumber.replace(/\D/g, "")),
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

  const name = data.companyName ? `"${data.companyName}"` : "no name detected";
  setStatus(`✅ Done! Company: ${name}. Review all fields before filling.`, "ok");
  return currentExtractedData;
}

// Fill directly into portal tab via executeScript (no sendMessage, 100% reliable)
async function fillPortal(data) {
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
            if (label.includes("business") || label.includes("nature") || (label.includes("type") && !label.includes("status"))) return 50;
            if (desc.includes("businesstype") || desc.includes("natureofbusiness")) return 40;
            return 0;
          }
        },
        {
          key: "companyProfile",
          isSelect: true,
          match: (ctrl, label, desc) => {
            if (ctrl.tagName !== "SELECT") return 0;
            if (label.includes("profile")) return 50;
            if (desc.includes("companyprofile") || desc.includes("profile")) return 40;
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

      for (const rule of FIELD_RULES) {
        const val = formData[rule.key];
        if (val === undefined || val === null || val === "") continue;

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
          used.add(bestCtrl);
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
            const validVariants = synMap[wanted] || [wanted];
            let opt = [...bestCtrl.options].find(o => validVariants.includes(norm(o.value)) || validVariants.includes(norm(o.textContent)));
            if (!opt) opt = [...bestCtrl.options].find(o => validVariants.some(v => norm(o.textContent).includes(v)));
            if (!opt) opt = [...bestCtrl.options].find(o => norm(o.value) === wanted || norm(o.textContent) === wanted);
            if (!opt) opt = [...bestCtrl.options].find(o => norm(o.textContent).includes(wanted));
            if (opt) {
              bestCtrl.value = opt.value;
              bestCtrl.selectedIndex = opt.index;
            }
          } else {
            const proto = bestCtrl.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
            const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
            if (descriptor && descriptor.set) {
              descriptor.set.call(bestCtrl, val);
            } else {
              bestCtrl.value = val;
            }
          }
          bestCtrl.dispatchEvent(new Event("focus", { bubbles: true }));
          bestCtrl.dispatchEvent(new Event("input", { bubbles: true }));
          bestCtrl.dispatchEvent(new Event("change", { bubbles: true }));
          bestCtrl.dispatchEvent(new Event("blur", { bubbles: true }));
          bestCtrl.classList.add("qc-field-filled-highlight");
          filled++;
        }
      }
      return filled;
    },
    args: [data]
  });

  const totalFilled = execResults?.reduce((sum, r) => sum + (r?.result || 0), 0) || 0;
  setStatus(`✅ Filled ${totalFilled}/14 fields in portal! Review and Submit.`, "ok");
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
