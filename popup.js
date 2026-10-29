/**
 * Website Scraping & QC Helper - Popup Controller v2.2
 * Popup UI delegates website crawling to the background service worker.
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
// 14 fillable fields on portal (Website Name is read-only input and must not update)
const PORTAL_FIELD_COUNT = ALL_FIELD_KEYS.length;

// Display status banner
function setStatus(msg, type = "info") {
  const el = $("status-banner");
  el.className = `status-banner ${type}`;
  el.textContent = msg;
}

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

// Delegate crawling to the background service worker, which shares the extractor.
async function crawlAndExtractDirect(targetUrl) {
  setStatus("Crawling website...", "info");
  const response = await chrome.runtime.sendMessage({ action: "CRAWL_AND_EXTRACT", url: targetUrl });
  if (!response?.success) throw new Error(response?.error || "Could not extract website details.");
  return response.data;
}

// Populate UI form fields with extracted data and check rules
function populateFields(data) {
  if (!data) return;

  // 1. Populate all 14 fields
  for (const key of ALL_FIELD_KEYS) {
    const el = $(`field-${key}`);
    if (el && data[key] !== undefined && data[key] !== null) {
      let value = data[key];
      if (key === "websiteStatus" && String(value).trim().toLowerCase() === "not working") value = "";
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
    const message = data.forbidden.matchedText
      ? `${data.forbidden.message} Matched text: "${data.forbidden.matchedText}".`
      : data.forbidden.message;
    alertEl.textContent = message;
    setStatus(message, "err");
  } else if (data.onlinePurchase?.isOnlineStore) {
    const message = "ERROR: Online purchase detected. This site is not accepted; Website Status marked Not Working.";
    alertEl.style.display = "flex";
    alertEl.textContent = message;
    setStatus(message, "err");
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
  // Preserve the extracted compliance decision when the user presses the
  // separate Fill button; this prevents an intervening UI edit from bypassing it.
  if (currentExtractedData?.forbidden?.isForbidden) {
    data.forbidden = currentExtractedData.forbidden;
    data.websiteStatus = "Not Working";
  }
  if (currentExtractedData?.onlinePurchase) {
    data.onlinePurchase = currentExtractedData.onlinePurchase;
  }
  return data;
}

// Render QC Checklist with Rule validations
function renderQcChecklist(data) {
  const qcListEl = $("qc-checklist");
  qcListEl.innerHTML = "";
  const emailProvenance = email => {
    const candidate = (data.emailCandidates || []).find(item => String(item.email || "").toLowerCase() === String(email || "").toLowerCase());
    if (!candidate) return "Source: not recorded";
    const sourcePages = (candidate.sourcePages || [candidate.sourcePage]).filter(Boolean).slice(0, 2).map(source => {
      try { return new URL(source).pathname || "/"; } catch { return String(source); }
    });
    const confidence = candidate.confidence >= 3 ? "mailto link" : candidate.confidence >= 2 ? "structured data" : candidate.confidence >= 1 ? "email element" : "page text";
    const domain = candidate.domainMatch ? "website-domain match" : "external domain";
    return `Source: ${sourcePages.join(", ") || "unknown page"} (${confidence}; ${domain})`;
  };
  const otherEmailCandidates = (data.emailCandidates || []).slice(2, 7).map(candidate => {
    const path = (candidate.sourcePages || [candidate.sourcePage]).filter(Boolean).map(source => {
      try { return new URL(source).pathname || "/"; } catch { return String(source); }
    })[0] || "unknown page";
    return `${candidate.email} (${path})`;
  });
  const otherEmailCandidatesNote = otherEmailCandidates.length
    ? ` Other candidates: ${otherEmailCandidates.join("; ")}`
    : "";

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
      name: "Rule 9: Primary Email",
      ok: Boolean(data.emailId && Extractor.isValidEmail(data.emailId)),
      msg: data.emailId ? `${data.emailId} — ${emailProvenance(data.emailId)}` : "No valid primary email found"
    },
    {
      name: "Rule 10: Secondary Email",
      ok: Boolean(data.secondaryEmailId && Extractor.isValidEmail(data.secondaryEmailId) &&
          data.secondaryEmailId.toLowerCase() !== String(data.emailId || "").toLowerCase()),
      msg: data.secondaryEmailId
        ? `${data.secondaryEmailId} — ${emailProvenance(data.secondaryEmailId)}.${otherEmailCandidatesNote}`
        : `No distinct secondary email found on checked pages; verify manually.${otherEmailCandidatesNote}`
    },
    {
      name: "Rule 11: Phone Number",
      ok: Boolean(data.phoneNumber),
      msg: data.phoneNumber
        ? `Digits: ${data.phoneNumber}${Extractor.isTollFreeNumber(data.phoneNumber, data.countryName) ? " (toll-free fallback; verify)" : " (no country code)"}`
        : "Phone not found"
    },
    {
      name: "Rules 12-14: Products & Images",
      ok: data.numberOfProduct !== "0",
      msg: `Products: ${data.numberOfProduct}, Images: ${data.imageProduct}, Descs: ${data.noOfProductDescription}`
    },
    {
      name: "Rule 15: Online Purchase",
      ok: data.onlinePurchase?.checked === true && data.onlinePurchase?.isOnlineStore !== true,
      msg: data.onlinePurchase?.isOnlineStore
        ? `ERROR: Online store not accepted${data.onlinePurchase.evidence?.length ? ` (${data.onlinePurchase.evidence.slice(0, 3).join(", ")})` : ""}`
        : `No online purchase detected${data.onlinePurchase?.evidence?.length ? ` (${data.onlinePurchase.evidence.slice(0, 3).join(", ")})` : ""}`
    }
  ];

  let passCount = 0;
  for (const c of checks) {
    if (c.ok) passCount++;
    const item = document.createElement("div");
    item.className = `qc-item ${c.ok ? "pass" : "warn"}`;
    const badge = document.createElement("span");
    badge.className = "qc-badge";
    badge.textContent = c.ok ? "PASS" : "REVIEW";
    const detail = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = `${c.name}: `;
    detail.append(name, document.createTextNode(c.msg));
    item.append(badge, detail);
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
  if (data.onlinePurchase?.isOnlineStore) {
    setStatus("ERROR: Online purchase detected. This site is not accepted; Website Status marked Not Working.", "err");
    return currentExtractedData;
  }

  const name = data.companyName ? `"${data.companyName}"` : "no name detected";
  setStatus(`✅ Done! Company: ${name}. Review all fields before filling.`, "ok");
  return currentExtractedData;
}

// Fill directly into portal tab via executeScript (no sendMessage, 100% reliable)
async function fillPortal(data) {
  const forbiddenDetected = Boolean(data?.forbidden?.isForbidden);
  const onlinePurchaseRejected = Boolean(data?.onlinePurchase?.isOnlineStore);
  const websiteNotWorking = forbiddenDetected || onlinePurchaseRejected || String(data?.websiteStatus || "").trim().toLowerCase() === "not working";
  const portalData = Object.fromEntries(Object.entries(data).filter(([key]) => key !== "websiteName" && !(websiteNotWorking && key === "websiteStatus")));
  portalData._clearWebsiteStatus = websiteNotWorking;

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

      // Identify Website Name / URL control to protect it from being updated (Rule: Website Name must not update)
      function isWebsiteNameControl(ctrl) {
        if (!ctrl || ctrl.tagName === "SELECT") return false;
        const lbl = norm(getExactLabel(ctrl));
        const desc = norm([
          ctrl.id,
          ctrl.name,
          ctrl.placeholder,
          ctrl.getAttribute("aria-label"),
          ctrl.getAttribute("data-field")
        ].join(" "));
        if (lbl.includes("websitename") || lbl === "website" || lbl === "websiteurl") return true;
        if (desc.includes("websitename") || desc.includes("targeturl") || desc.includes("siteurl") || desc.includes("weburl")) return true;
        if (lbl.includes("website") && !lbl.includes("status")) return true;
        return false;
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
      // Protect Website Name field: Rule is that Website Name should NOT update
      for (const ctrl of controls) {
        if (isWebsiteNameControl(ctrl)) {
          used.add(ctrl);
        }
      }
      if (formData._clearWebsiteStatus) {
        const statusRule = FIELD_RULES.find(rule => rule.key === "websiteStatus");
        const statusCtrl = controls.find(ctrl => statusRule && statusRule.match(ctrl, norm(getExactLabel(ctrl)), norm([
          ctrl.id, ctrl.name, ctrl.placeholder, ctrl.getAttribute("aria-label"), ctrl.getAttribute("data-field")
        ].join(" "))) > 0);
        if (statusCtrl) {
          const descriptor = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value");
          if (descriptor?.set) descriptor.set.call(statusCtrl, "");
          else statusCtrl.value = "";
          statusCtrl.dispatchEvent(new Event("input", { bubbles: true }));
          statusCtrl.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
      const details = [];

      for (const rule of FIELD_RULES) {
        if (rule.key === "websiteName") continue;
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
  const fieldResults = totals.flatMap(result => result.details || []);
  const filledFields = new Set(fieldResults.filter(detail => detail.status === "filled").map(detail => detail.field));
  const knownFields = new Set(fieldResults.map(detail => detail.field));
  const totalFilled = filledFields.size;
  const unfilledFields = [...knownFields].filter(field => !filledFields.has(field));
  if (websiteNotWorking) {
    const warning = data.forbidden?.message ||
      (onlinePurchaseRejected ? "Online purchase detected; review this website." : "") ||
      data.urlRules?.warning ||
      "Website marked for review.";
    setStatus(`${warning} Website Status left blank. Prefilled ${totalFilled}/${PORTAL_FIELD_COUNT} available fields; review before submitting.`, "warn");
    return;
  }
  if (!websiteNotWorking && unfilledFields.length) {
    setStatus(`Filled ${totalFilled}/${PORTAL_FIELD_COUNT} fields. Not filled: ${unfilledFields.join(", ")}. Review before submitting.`, "warn");
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
