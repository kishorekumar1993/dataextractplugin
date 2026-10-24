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
      isDropdown: true,
      defaultVal: "W-Working"
    },
    {
      key: "businessType",
      label: "Business Type",
      aliases: ["businesstype", "natureofbusiness", "business", "type", "industrytype"],
      isDropdown: true,
      defaultVal: "Manufacturer"
    },
    {
      key: "companyProfile",
      label: "Company Profile",
      aliases: ["companyprofile", "profileofcompany", "profile", "aboutus", "companyoverview"],
      isDropdown: true,
      defaultVal: "Y"
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
      isDropdown: true,
      defaultVal: "Y"
    },
    {
      key: "city",
      label: "City",
      aliases: ["city", "cityname", "town", "district"],
      isDropdown: true,
      defaultVal: "Y"
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
      aliases: ["numberofproduct", "noofproduct", "productcount", "products", "numproducts"],
      isDropdown: true,
      defaultVal: "3"
    },
    {
      key: "imageProduct",
      label: "Image Product",
      aliases: ["imageproduct", "productimage", "productimages", "imagesproduct", "imagecount"],
      isDropdown: true,
      defaultVal: "3"
    },
    {
      key: "noOfProductDescription",
      label: "No. of Product Description",
      aliases: ["noofproductdescription", "numberofproductdescription", "productdescription", "productdescriptions"],
      isDropdown: true,
      defaultVal: "3"
    }
  ];

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

    if (el.tagName === "SELECT") {
      const targetNorm = norm(strVal);
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
      const validVariants = synMap[targetNorm] || [targetNorm];
      let matchedOption = [...el.options].find(o => validVariants.includes(norm(o.value)) || validVariants.includes(norm(o.textContent)));

      if (!matchedOption) {
        matchedOption = [...el.options].find(o => validVariants.some(v => norm(o.textContent).includes(v) || v.includes(norm(o.textContent))));
      }

      if (!matchedOption) {
        matchedOption = [...el.options].find(o => norm(o.value) === targetNorm || norm(o.textContent) === targetNorm);
      }

      if (matchedOption) {
        el.value = matchedOption.value;
        el.selectedIndex = matchedOption.index;
      }
      // NOTE: Do NOT fallback to selectedIndex = 1 blindly — if no match found, leave as-is
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

    el.classList.add("qc-field-filled-highlight");
    setTimeout(() => {
      el.classList.remove("qc-field-filled-highlight");
    }, 4500);

    return true;
  }

  // Discriminative matching rules matching popup.js
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
        if (label.includes("business") || label.includes("nature") || (label.includes("type") && !label.includes("status"))) return 50;
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
        if (label.includes("profile")) return 50;
        if (desc.includes("companyprofile") || desc.includes("profile")) return 40;
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

  // Auto-fill all portal fields based on extracted data
  function fillAllPortalFields(data) {
    if (!data) return { filled: 0, total: 15 };

    const controls = getCandidateControls();
    const usedControls = new Set();
    const results = [];
    let filledCount = 0;

    for (const rule of FIELD_RULES) {
      const val = data[rule.key] ?? (rule.isSelect ? "3" : "");
      if (val === undefined || val === null || val === "") continue;

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
        setControlValue(bestCtrl, val);
        usedControls.add(bestCtrl);
        filledCount++;
        results.push({ field: rule.label, status: "filled", val });
      } else {
        results.push({ field: rule.label, status: "missing" });
      }
    }

    showToast(`✅ ${filledCount}/14 Fields Filled! Review before submit.`);
    return { filled: filledCount, total: 14, details: results };
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
    for (const def of FIELD_DEFINITIONS) {
      const val = data[def.key] || '<span style="color:#94a3b8">Not detected</span>';
      const isFull = ["companyAddress", "websiteName"].includes(def.key);
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
            showToast(response.data.forbidden.message);
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
