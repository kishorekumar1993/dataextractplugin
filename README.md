# ⚡ Website Scraping & QC Helper (v2.0)

A high-performance Chrome extension designed for **Data Entry & QC (Quality Check) Operators**. It crawls a target website from a given URL, accurately extracts corporate and contact details, and fills 14 portal fields with a single click while preserving the existing Website Name value.

---

## 🎯 15 Fields Extracted & Auto-Filled

### Compliance restriction

The extension may flag prohibited categories (Porn/Adult, Medicine/Medical/Hospital, Food, Weapons/Knife, Defence, Aircraft/Aerospace, Marine/Ship, Chemical, Alcohol, or Animals) and online stores for review. A Not Working status is left blank in the portal, while all available extracted details are prefilled for review.

| # | Field Name | Type | How It Is Extracted | Example (Rezontech) |
|---|---|---|---|---|
| 1 | **Website Name** | URL Input | Read from portal or popup input (Preserved; never updated during form fill) | `http://www.rezontech.co.kr` |
| 2 | **Website Status** | Dropdown | Verified via HTTP response (`Working` / `Not Working`) | `Working` |
| 3 | **Business Type** | Dropdown | Keyword AI matching (`Manufacturer`, `Trader`, etc.) | `Manufacturer` |
| 4 | **Company Profile** | Dropdown | Detects About Us / Overview (`Available` / `Not Available`) | `Available` |
| 5 | **Company Name** | Text Input | Legal copyright, Schema.org, Header entity name | `REZONTECH CO., LTD.` |
| 6 | **Company Address** | Textarea | Street, building, district, province detection | `Rezontech Building, 72-9 Beolmal-ro, Dongan-gu, Anyang-si, Gyeonggi-do, ` |
| 7 | **Country Name** | Input/Select | Detected from address, TLD (.kr), or phone code | `South Korea` |
| 8 | **State** | Dropdown | Detected state/province verified (`Available`) | `Available` |
| 9 | **City** | Dropdown | Detected city/locality verified (`Available`) | `Available` |
| 10 | **Email Id** | Email Input | Primary corporate email (`sales@`, `info@`, etc.) | `sales@rezontech.com` |
| 11 | **Secondary Email Id** | Email Input | Alternate / local email (`yacht@`, `insa@`, etc.) | `yacht@rezontech.com` |
| 12 | **Phone Number** | Number Input | Country code stripped, clean digits | `313484246` |
| 13 | **Number of Product** | Dropdown | Counts product catalog items (set to target `3`) | `3` |
| 14 | **Image Product** | Dropdown | Counts product photos (set to target `3`) | `3` |
| 15 | **No. of Product Description** | Dropdown | Counts product description items (set to target `3`) | `3` |

---

## 🚀 How to Install & Reload in Chrome

1. Open Google Chrome and go to:
   ```
   chrome://extensions
   ```
2. Enable **Developer mode** (toggle in the top-right corner).
3. If the extension was previously loaded:
   - Click the **Reload** (🔄) button on the **Website Scraping & QC Helper** card.
4. If loading for the first time:
   - Click **Load unpacked**.
   - Select this folder: `c:\Users\KISHORE KUMAR\Downloads\New folder (3)\website-qc-extension`.

---

## 🧪 Quick Test (Instant Verification)

We have included a built-in test portal `test_portal.html` that matches your real portal form:

1. Drag and drop `test_portal.html` into Chrome (or open `file:///c:/Users/KISHORE%20KUMAR/Downloads/New%20folder%20(3)/website-qc-extension/test_portal.html`).
2. You will notice the **Floating Assistant** pill in the top right:
   - Click **`Grab & Fill`**!
   - It will crawl `http://www.rezontech.co.kr`, extract the available details, and auto-fill 14 fields with green highlight animations. The Website Name field is left unchanged.
3. Alternatively, click the **Extension icon** in your Chrome toolbar:
   - Click **`⚡ Grab & Fill (1-Click)`** or **`🔍 Extract Only`** to review all fields before filling.

---

## 🛠️ Key Improvements in v2.0

1. **14 Portal Fields Supported**:
   - Previous version only had 6 fields. v2.0 extracts and fills 14 portal fields; the Website Name field remains the URL source and is never changed during form fill.
2. **Multi-Language & English Subpage Discovery**:
   - Automatically crawls `/en` or English subpages for international corporate names, English addresses, and separates Primary (`sales@`) vs Secondary (`yacht@`) emails.
3. **In-Page Floating Assistant**:
   - Injects a fast `Grab & Fill` button right onto the portal page so you don't even have to open the popup every time!
4. **Universal Dropdown & React Form Support**:
   - Uses native property descriptors and event bubbling (`input`, `change`, `blur`) so that React, Angular, Vue, and vanilla HTML forms register all input changes without dropping data.
5. **Modern Popup Design**:
   - Categorized card layout, individual field copy buttons, live editing, QC pass/warning badges, and 1-click JSON export.
6. **Comprehensive Section 7 Address Normalization & Expansion**:
   - **Address validation and source priority**: Requires geographic/postal/street-number evidence, rejects prose-shaped candidates, and scores postal/country/street signals above marketing text. Contact pages accept only contact-detail/footer sources; labelled footer addresses are recognized, nearby phone/fax details are removed, and live pages are polled briefly when no validated address has rendered yet.
7. **Email Extraction & Contact-Page Priority**:
   - Extracts emails from links, email-related attributes, nested Schema.org JSON-LD, page text, and HTML, including common entity encodings and simple `[at]` / `[dot]` obfuscation. Emails found on a crawled contact page take priority over homepage emails; duplicates are removed when merging primary and secondary values.
8. **Verified Portal Autofill**:
   - Missing extraction values are left untouched instead of receiving guessed dropdown defaults. Website Name is read as the target URL from the portal or popup and strictly preserved without updating (strict rule: Website Name must not update during form fill). Select fields count as filled only when a matching option is selected; the in-page helper and popup report the fillable fields consistently and block autofill for forbidden websites. Contact and English pages are fetched from the extension context so host permissions can handle cross-origin requests.
   - Implements Sections 7.4 through 7.11 address rules:
     - **Street & Road Types**: `St.` -> `Street`, `Rd.` -> `Road`, `Ave.` -> `Avenue`, `Blvd.` -> `Boulevard`, `Dr.` -> `Drive`, `Ln.` -> `Lane`, `Ct.` -> `Court`, `Hwy.` -> `Highway`, `Pkwy.` -> `Parkway`, `Sq.` -> `Square`, `Pl.` -> `Place`, `Cres.` -> `Crescent`, `Ter.` -> `Terrace`, `Cir.` -> `Circle`, `Trl.` -> `Trail`, `Extn.` -> `Extension`, `Rd. Extn.` -> `Road Extension`.
     - **Context Safeguards**: Protects Saint in proper names (`St. John`, `St. Louis`, `St. Mary`) and Doctor (`Dr. B.R. Ambedkar`) from improper expansion.
     - **Building & Units**: `Bldg.` -> `Building`, `Bldg No.` -> `Building Number`, `Ste.` -> `Suite`, `Apt.` -> `Apartment`, `Rm.` -> `Room`, `Blk.` -> `Block`, `No.` / `#` -> `Number`. Retains `Unit` as written.
     - **Floors & Phases**: `1st Fl.` / `2nd Fl.` / `3rd Fl.` -> `First Floor` / `Second Floor` / `Third Floor`; `G.F.` / `F.F.` / `S.F.` -> `Ground Floor` / `First Floor` / `Second Floor`; `1 Phase` / `2 Phase` -> `First Phase` / `Second Phase`.
     - **Industrial & Commercial**: `Ind. Area` -> `Industrial Area`, `Ind. Est.` -> `Industrial Estate`, `Tech. Park` -> `Technology Park`, `IT Park` -> `Information Technology Park`, `Bus. Park` -> `Business Park`, `Comml. Complex` -> `Commercial Complex`, `Dev. Zone` -> `Development Zone`, `Econ. & Tech. Dev. Zone` -> `Economic & Technical Development Zone`.
     - **Directions**: `N.`, `S.`, `E.`, `W.` -> `North`, `South`, `East`, `West`; `NE`, `NW`, `SE`, `SW` -> `Northeast`, `Northwest`, `Southeast`, `Southwest`; `Old Rd.` -> `Old Road`, `New Rd.` -> `New Road`.
     - **Indian & International Terms**: `H.O.` -> `Head Office`, `S.O.` -> `Sub Office`, `P.O. Box No.` -> `Post Office Box Number`, `Vill.` -> `Village`, `Tal.` / `Tq.` -> `Taluka`, `Dist.` -> `District`, `C/O` -> `Care Of`, `B.P.` -> `Boîte Postale`, `Z.I.` -> `Zone Industrielle`, `Pol. Ind.` -> `Polígono Industrial`.
     - **Preserves Local Official Names**: Local place names like `Jalan P/1`, `Kawasan Perusahaan`, `Nagar`, `Puram`, and `Colony` are strictly preserved without distortion.
