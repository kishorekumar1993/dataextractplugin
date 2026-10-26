/**
 * Content Script - In-Page Floating QC Assistant & Portal Auto-Filler
 * Automatically detects Data Entry portal forms, grabs the URL from 'Website Name',
 * and auto-fills all 15 fields with a single click right on the portal page!
 */

(() => {
  // Field aliases matching the portal from the user's screenshot
  const FIELD_DEFINITIONS = [
    {
      key: "websiteName",
      label: "Website Name",
      aliases: ["websitename", "website", "url", "siteurl", "weburl", "targeturl", "domain"]
    },
    {
      key: "websiteStatus",
      label: "Website Status",
      aliases: ["websitestatus", "status", "webstatus", "sitestatus"],
      isDropdown: true
    },
    {
      key: "businessType",
      label: "Business Type",
      aliases: ["businesstype", "natureofbusiness", "business", "industrytype"],
      isDropdown: true
    },
    {
      key: "companyProfile",
      label: "Company Profile",
      aliases: ["companyprofile", "profileofcompany", "aboutus", "companyoverview"],
      isDropdown: true
    },
    {
      key: "companyName",
      label: "Company Name",
      aliases: ["companyname", "nameofcompany", "cname", "company_name", "firmname", "businessname", "organizationname"]
    },
    {
      key: "companyAddress",
      label: "Company Address",
      aliases: ["companyaddress", "businessaddress", "fulladdress", "streetaddress", "address", "registeredaddress"]
    },
    {
      key: "countryName",
      label: "Country Name",
      aliases: ["countryname", "country", "nation"]
    },
    {
      key: "state",
      label: "State",
      aliases: ["state", "statename", "province", "region"],
      isDropdown: true
    },
    {
      key: "city",
      label: "City",
      aliases: ["city", "cityname", "town", "district"],
      isDropdown: true
    },
    {
      key: "emailId",
      label: "Email Id",
      aliases: ["emailid", "email", "primaryemail", "emailaddress", "contactemail", "mailid"]
    },
    {
      key: "secondaryEmailId",
      label: "Secondary Email Id",
      aliases: ["secondaryemailid", "secondaryemail", "alternateemail", "altemail", "email2", "otheremail", "emailid2"]
    },
    {
      key: "phoneNumber",
      label: "Phone Number",
      aliases: ["phonenumber", "telephone", "phone", "contactnumber", "tel", "mobilenumber", "mobile"]
    },
    {
      key: "numberOfProduct",
      label: "Number of Product",
      aliases: ["numberofproduct", "noofproduct", "productcount", "numproducts"],
      isDropdown: true
    },
    {
      key: "imageProduct",
      label: "Image Product",
      aliases: ["imageproduct", "productimage", "productimages", "imagesproduct", "imagecount"],
      isDropdown: true
    },
    {
      key: "noOfProductDescription",
      label: "No. of Product Description",
      aliases: ["noofproductdescription", "numberofproductdescription", "productdescription", "productdescriptions"],
      isDropdown: true
    }
  ];

  // 14 fillable fields on portal (Website Name is read-only input and must not update)
  const PORTAL_FIELD_COUNT = 14;
  let cachedExtractedData = null;

  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  // Find all form controls
  function getCandidateControls() {
    return [...document.querySelectorAll("input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]), textarea, select")];
  }

  // Get exact label for a control without container leakage
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

  // Read URL from Website Name field or inputs
  function detectWebsiteUrl() {
    const controls = getCandidateControls();
    for (const ctrl of controls) {
      const lbl = norm(getExactLabel(ctrl));
      const desc = norm([ctrl.id, ctrl.name, ctrl.placeholder].join(" "));
      if (lbl.includes("website") || lbl.includes("url") || desc.includes("websitename") || desc.includes("website") || desc.includes("targeturl") || desc.includes("url")) {
        const val = (ctrl.value || "").trim();
        if (val) return val;
      }
    }
    for (const ctrl of controls) {
      const val = (ctrl.value || "").trim();
      if (/^https?:\/\//i.test(val)) return val;
    }
    return "";
  }

  // Set control value with support for React/Vue/Angular/HTML5
  function setControlValue(el, val) {
    if (!el || val === undefined || val === null) return false;
    const strVal = String(val).trim();
    let expectedValue = strVal;

    if (el.tagName === "SELECT") {
      const targetNorm = norm(strVal);
      const synMap = {
        "y": ["y", "available", "yes", "true", "1"],
        "available": ["y", "available", "yes", "true", "1"],
        "n": ["n", "notavailable", "no", "false", "0"],
        "notavailable": ["n", "notavailable", "unavailable", "no", "false", "0"],
        "unavailable": ["n", "notavailable", "unavailable", "no", "false", "0"],
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
      const validVariants = synMap[targetNorm] || countryAliases[targetNorm] || [targetNorm];
      const options = [...el.options];
      let matchedOption = options.find(o => {
        const candidates = [norm(o.value), norm(o.textContent)];
        return validVariants.some(alias => candidates.some(candidate => candidate === alias || (alias.length >= 4 && candidate.startsWith(alias))));
      });

      // Portal forms vary between Y/N, Available/Not Available, and longer
      // labels such as "Not Available (N)". Match those meanings explicitly.
      if (!matchedOption && ["y", "available", "n", "notavailable", "unavailable"].includes(targetNorm)) {
        const wantsAvailable = ["y", "available"].includes(targetNorm);
        matchedOption = options.find(option => {
          const value = norm(option.value);
          const label = norm(option.textContent);
          const candidates = [value, label];
          return candidates.some(candidate => wantsAvailable
            ? /^(?:available|yes|true|y|1)/.test(candidate)
            : /^(?:notavailable|unavailable|no|false|n|0|na)/.test(candidate));
        });
      }

      if (!matchedOption) {
        return false;
      }

      el.value = matchedOption.value;
      el.selectedIndex = matchedOption.index;
      if (el.value !== matchedOption.value || el.selectedIndex !== matchedOption.index) return false;
      expectedValue = matchedOption.value;
    } else {
      const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
      if (descriptor && descriptor.set) {
        descriptor.set.call(el, strVal);
      } else {
        el.value = strVal;
      }
    }

    el.dispatchEvent(new Event("focus", { bubbles: true }));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));

    if (el.value !== expectedValue) return false;

    el.classList.add("qc-field-filled-highlight");
    setTimeout(() => {
      el.classList.remove("qc-field-filled-highlight");
    }, 4500);

    return true;
  }

  // Discriminative matching rules matching popup.js (14 fillable portal fields; Website Name must not update)
  const FIELD_RULES = [
    {
      key: "websiteStatus",
      label: "Website Status",
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
      label: "Business Type",
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
      label: "Company Profile",
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
      label: "Company Name",
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
      label: "Company Address",
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
      label: "Country Name",
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
      label: "State",
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
      label: "City",
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
      label: "Email Id",
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
      label: "Secondary Email Id",
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
      label: "Phone Number",
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
      label: "Number of Product",
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
      label: "Image Product",
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
      label: "No. of Product Description",
      isSelect: true,
      match: (ctrl, label, desc) => {
        if (ctrl.tagName !== "SELECT") return 0;
        if (label.includes("desc")) return 60;
        if (desc.includes("description") || desc.includes("noofproductdescription")) return 50;
        return 0;
      }
    }
  ];

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

  // Auto-fill all portal fields based on extracted data (Website Name is preserved / not updated)
  function fillAllPortalFields(data) {
    if (!data) return { filled: 0, total: PORTAL_FIELD_COUNT, details: [] };
    const forbiddenDetected = Boolean(data.forbidden?.isForbidden);
    const onlinePurchaseRejected = Boolean(data.onlinePurchase?.isOnlineStore);
    const websiteNotWorking = forbiddenDetected || onlinePurchaseRejected || String(data.websiteStatus || "").trim().toLowerCase() === "not working";
    const fillData = Object.fromEntries(Object.entries(data).filter(([key]) => key !== "websiteName" && !(websiteNotWorking && key === "websiteStatus")));

    const controls = getCandidateControls();
    const usedControls = new Set();

    // Protect Website Name control: Rule is that Website Name should NOT update
    for (const ctrl of controls) {
      if (isWebsiteNameControl(ctrl)) {
        usedControls.add(ctrl);
      }
    }
    if (websiteNotWorking) {
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

    const results = [];
    let filledCount = 0;

    for (const rule of FIELD_RULES) {
      if (rule.key === "websiteName") continue;

      const val = fillData[rule.key];
      if (val === undefined || val === null || String(val).trim() === "") {
        results.push({ field: rule.label, status: "missing" });
        continue;
      }

      let bestCtrl = null;
      let maxScore = 0;

      for (const ctrl of controls) {
        if (usedControls.has(ctrl)) continue;

        const exactLabel = norm(getExactLabel(ctrl));
        const desc = norm([
          ctrl.id,
          ctrl.name,
          ctrl.placeholder,
          ctrl.getAttribute("aria-label"),
          ctrl.getAttribute("data-field")
        ].join(" "));

        const score = rule.match(ctrl, exactLabel, desc);
        if (score > maxScore) {
          maxScore = score;
          bestCtrl = ctrl;
        }
      }

      if (bestCtrl && maxScore > 0) {
        if (setControlValue(bestCtrl, val)) {
          usedControls.add(bestCtrl);
          filledCount++;
          results.push({ field: rule.label, status: "filled", val });
        } else {
          results.push({ field: rule.label, status: "missing", reason: "No matching option or value was accepted." });
        }
      } else {
        results.push({ field: rule.label, status: "missing" });
      }
    }

    showToast(`✅ ${filledCount}/${PORTAL_FIELD_COUNT} Fields Filled! Review before submit.`);
    if (websiteNotWorking) {
      const warning = data.forbidden?.message ||
        (onlinePurchaseRejected ? "Online purchase detected; review this website." : "") ||
        data.urlRules?.warning ||
        "Website marked for review.";
      showToast(`${warning} Website Status left blank. Prefilled ${filledCount}/${PORTAL_FIELD_COUNT} available fields; review before submitting.`);
    }
    return { filled: filledCount, total: PORTAL_FIELD_COUNT, details: results };
  }

  // Show floating toast
  function showToast(msg) {
    const existing = document.getElementById("qc-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "qc-toast";
    toast.className = "qc-toast-notification";
    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.4s";
      setTimeout(() => toast.remove(), 400);
    }, 4500);
  }

  // In-Page Preview Modal
  function showPreviewModal(data) {
    const existing = document.getElementById("qc-preview-modal");
    if (existing) existing.remove();

    const backdrop = document.createElement("div");
    backdrop.id = "qc-preview-modal";
    backdrop.className = "qc-modal-backdrop";

    const card = document.createElement("div");
    card.className = "qc-modal-card";

    let fieldsHtml = "";
    for (const def of FIELD_DEFINITIONS.filter(({ key }) => key !== "websiteName")) {
      const rawValue = data[def.key];
      const val = rawValue === undefined || rawValue === null || String(rawValue).trim() === ""
        ? '<span style="color:#94a3b8">Not detected</span>'
        : escapeHtml(rawValue);
      const isFull = def.key === "companyAddress";
      fieldsHtml += `
        <div class="qc-field-preview ${isFull ? "full-width" : ""}">
          <div class="qc-preview-label">${def.label}</div>
          <div class="qc-preview-val">${val}</div>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="qc-modal-header">
        <div class="qc-modal-title">⚡ Extracted Details Preview</div>
        <button id="qc-modal-close" class="qc-btn-icon" style="font-size:18px;">✕</button>
      </div>
      <div class="qc-modal-body">
        ${fieldsHtml}
      </div>
      <div class="qc-modal-footer">
        <button id="qc-modal-cancel" class="qc-btn-secondary">Close</button>
        <button id="qc-modal-fill" class="qc-btn-primary">📝 Fill Into Portal</button>
      </div>
    `;

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);

    // Event listeners
    backdrop.querySelector("#qc-modal-close").onclick = () => backdrop.remove();
    backdrop.querySelector("#qc-modal-cancel").onclick = () => backdrop.remove();
    backdrop.querySelector("#qc-modal-fill").onclick = () => {
      backdrop.remove();
      fillAllPortalFields(data);
    };
  }

  // Extracted page text is untrusted. Escape it before inserting the preview markup.
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  // Detect if this page is a data-entry portal form (has multiple labeled form controls for QC fields)
  function isPortalPage() {
    const controls = [...document.querySelectorAll("input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]), textarea, select")];
    if (controls.length < 3) return false;

    const portalSignals = ["website", "company", "business", "email", "product", "status", "country", "address", "profile", "manufacturer"];
    let signalCount = 0;

    for (const ctrl of controls) {
      const combined = [
        ctrl.name,
        ctrl.id,
        ctrl.placeholder,
        ctrl.getAttribute("aria-label"),
        ctrl.getAttribute("data-field"),
        ctrl.closest("label")?.textContent,
        ctrl.previousElementSibling?.textContent,
        ctrl.closest("td")?.previousElementSibling?.textContent
      ].join(" ").toLowerCase();

      if (portalSignals.some(s => combined.includes(s))) {
        signalCount++;
      }
    }

    return signalCount >= 3;
  }

  // Inject Floating Quick Action Pill
  function injectFloatingAssistant() {
    // Only inject on portal pages — not on every website
    if (!isPortalPage()) return;
    if (document.getElementById("qc-helper-container")) return;

    const container = document.createElement("div");
    container.id = "qc-helper-container";

    container.innerHTML = `
      <div class="qc-floating-pill">
        <div class="qc-pill-brand">
          <div class="qc-brand-badge">⚡</div>
          <span>QC Helper</span>
        </div>
        <button id="qc-btn-grab-fill" class="qc-btn-primary" title="Grab details from URL & Fill Form">
          <span class="qc-btn-text">Grab & Fill</span>
        </button>
        <button id="qc-btn-preview" class="qc-btn-secondary" title="Preview Extracted Data" style="display:none;">
          👁️ Preview
        </button>
        <button id="qc-btn-close-pill" class="qc-btn-icon" title="Hide Helper">✕</button>
      </div>
    `;

    document.body.appendChild(container);

    const grabBtn = container.querySelector("#qc-btn-grab-fill");
    const previewBtn = container.querySelector("#qc-btn-preview");
    const closeBtn = container.querySelector("#qc-btn-close-pill");

    closeBtn.onclick = () => container.remove();

    previewBtn.onclick = () => {
      if (cachedExtractedData) showPreviewModal(cachedExtractedData);
    };

    grabBtn.onclick = async () => {
      const url = detectWebsiteUrl();
      if (!url) {
        showToast("⚠️ Please enter a Website URL in the form first.");
        return;
      }

      grabBtn.disabled = true;
      grabBtn.innerHTML = `<span class="qc-spinner"></span> Crawling...`;

      try {
        const response = await chrome.runtime.sendMessage({
          action: "CRAWL_AND_EXTRACT",
          url: url
        });

        if (response && response.success && response.data) {
          cachedExtractedData = response.data;
          previewBtn.style.display = "inline-flex";

          if (response.data.forbidden?.isForbidden) {
            fillAllPortalFields(response.data);
            return;
          } else if (response.data.urlRules?.isSubdomain) {
            showToast(response.data.urlRules.warning);
          }

          fillAllPortalFields(response.data);
        } else {
          showToast("❌ Extraction failed: " + (response?.error || "Could not read website"));
        }
      } catch (err) {
        showToast("❌ Error: " + (err.message || String(err)));
      } finally {
        grabBtn.disabled = false;
        grabBtn.innerHTML = `<span class="qc-btn-text">Grab & Fill</span>`;
      }
    };
  }

  // Initialize on page load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectFloatingAssistant);
  } else {
    injectFloatingAssistant();
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "DETECT_PORTAL_URL") {
      const detected = detectWebsiteUrl();
      sendResponse({ url: detected });
      return true;
    }
    if (request.action === "FILL_PORTAL_FROM_POPUP") {
      const res = fillAllPortalFields(request.data);
      sendResponse(res);
      return true;
    }
  });

})();
