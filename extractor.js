/**
 * Website Scraping & QC Helper - Extractor Engine v2.1
 * Fully complies with all 14 official QC Rules & Compliance Guidelines:
 * 1. Website Status (Working / Not Working; Subdomain & Redirect detection)
 * 2. Business Type (Manufacturer to Wholesaler; Prioritizes Manufacturer)
 * 3. Company Profile (Available / Not Available)
 * 4. Company Name (Full legal name, brackets removed, country kept, title cased, trimmed)
 * 5. Country Name (Full form; Locality priority e.g. England > United Kingdom)
 * 6. Company Address (HQ priority, postal code removed, country removed, company name removed, brackets removed, clean ends)
 * 7. State (Available / Not Available; Province/County/Prefecture/Capital = Available)
 * 8. City (Available / Not Available; Town/District/Municipality/Capital = Available)
 * 9. Email ID (First corporate email)
 * 10. Secondary Email ID (Secondary if given, else empty)
 * 11. Phone Number (Country code removed, spaces/special chars removed, NO toll-free, NO leading zero)
 * 12. Number of Products (1 or 3; never 0)
 * 13. Product Images (1 or 3; never 0)
 * 14. Number of Product Descriptions (1 or 3; never 0)
 * Forbidden Categories Filter (Porn, Medicine/Medical, Food, Weapons/Knife, Defence, Aircraft, Marine, Chemical, Alcohol, Animals)
 * Social Media Sources (Facebook, LinkedIn)
 */

var Extractor = (typeof window !== "undefined" && window.Extractor) ? window.Extractor : (() => {

  // Forbidden Categories (Rule: Even if these appear anywhere, DO NOT work on that site!)
  const FORBIDDEN_CATEGORIES = [
    { name: "Porn / Adult", regex: /\b(porn|pornography|xxx|adult video|erotic|sex toy|escort)\b/i },
    { name: "Medicine / Medical / Hospital", regex: /\b(pharmacy|pharmaceutical|medicine|hospital|medical clinic|surgical|physician|prescriptions|therapeutics)\b/i },
    { name: "Food", regex: /\b(restaurant|bakery|catering|snack food|confectionery|edible|beverage supply|meat processing)\b/i },
    { name: "Weapons (Knife)", regex: /\b(weapon|weapons|knife|knives|blade|firearm|ammunition|gun maker|swords)\b/i },
    { name: "Defence", regex: /\b(defence system|defense contractor|military equipment|warfare|missile|tactical weapon)\b/i },
    { name: "Aircraft / Aerospace", regex: /\b(aircraft|aerospace|aviation|airplane manufacturing|helicopter|spacecraft)\b/i },
    { name: "Marine / Ship", regex: /\b(shipbuilding|shipyard|marine vessel|yacht building|naval ship|boat builder)\b/i },
    { name: "Chemical", regex: /\b(chemical factory|petrochemical|industrial chemical|chemical synthesis|hazardous reagent)\b/i },
    { name: "Alcohol", regex: /\b(brewery|distillery|winery|liquor|alcoholic beverage|beer brewing|vodka|whiskey)\b/i },
    { name: "Animals", regex: /\b(livestock|poultry|pet breeding|cattle|veterinary|animal breeding|slaughterhouse)\b/i }
  ];

  // World Capitals (If capital is in address, both City & State are Considered Available!)
  const WORLD_CAPITALS = [
    "seoul", "tokyo", "beijing", "washington", "london", "paris", "berlin", "new delhi",
    "canberra", "ottawa", "rome", "madrid", "bangkok", "jakarta", "singapore", "kuala lumpur",
    "manila", "hanoi", "taipei", "riyadh", "abu dhabi", "cairo", "brasilia", "mexico city",
    "moscow", "warsaw", "bern", "stockholm", "brussels", "vienna", "copenhagen", "oslo",
    "helsinki", "dublin", "wellington", "pretoria", "ankara", "amsterdam", "athens", "lisbon"
  ];

  // UK Localities (Rule 5: If England and United Kingdom both mentioned, must take England!)
  const UK_LOCALITIES = [
    { name: "England", regex: /\b(england|london|birmingham|manchester|liverpool|leeds|sheffield|bristol)\b/i },
    { name: "Scotland", regex: /\b(scotland|edinburgh|glasgow|aberdeen|dundee)\b/i },
    { name: "Wales", regex: /\b(wales|cardiff|swansea|newport)\b/i },
    { name: "Northern Ireland", regex: /\b(northern ireland|belfast|derry)\b/i }
  ];

  // Comprehensive Country Database with ISO codes, dial codes, aliases, and TLDs
  const COUNTRIES = [
    { name: "South Korea", iso: "KR", aliases: ["south korea", "republic of korea", "korea", "대한민국", "한국"], tlds: [".kr", ".co.kr"], dialCode: "82" },
    { name: "United States Of America", iso: "US", aliases: ["united states", "united states of america", "usa", "u.s.a."], tlds: [".us"], dialCode: "1" },
    { name: "United Kingdom", iso: "GB", aliases: ["united kingdom", "great britain", "uk"], tlds: [".uk", ".co.uk"], dialCode: "44" },
    { name: "Germany", iso: "DE", aliases: ["germany", "deutschland", "bundesrepublik deutschland"], tlds: [".de"], dialCode: "49" },
    { name: "China", iso: "CN", aliases: ["china", "people's republic of china", "p.r.c.", "prc", "中国"], tlds: [".cn", ".com.cn"], dialCode: "86" },
    { name: "India", iso: "IN", aliases: ["india", "bharat"], tlds: [".in", ".co.in"], dialCode: "91" },
    { name: "Japan", iso: "JP", aliases: ["japan", "nippon", "nihon", "日本"], tlds: [".jp", ".co.jp"], dialCode: "81" },
    { name: "Canada", iso: "CA", aliases: ["canada"], tlds: [".ca"], dialCode: "1" },
    { name: "Australia", iso: "AU", aliases: ["australia"], tlds: [".au", ".com.au"], dialCode: "61" },
    { name: "France", iso: "FR", aliases: ["france", "république française"], tlds: [".fr"], dialCode: "33" },
    { name: "Italy", iso: "IT", aliases: ["italy", "italia"], tlds: [".it"], dialCode: "39" },
    { name: "Spain", iso: "ES", aliases: ["spain", "españa"], tlds: [".es"], dialCode: "34" },
    { name: "Netherlands", iso: "NL", aliases: ["netherlands", "nederland", "holland"], tlds: [".nl"], dialCode: "31" },
    { name: "Taiwan", iso: "TW", aliases: ["taiwan", "republic of china", "taiwan, roc", "台湾"], tlds: [".tw", ".com.tw"], dialCode: "886" },
    { name: "Hong Kong", iso: "HK", aliases: ["hong kong", "hong kong sar", "香港"], tlds: [".hk", ".com.hk"], dialCode: "852" },
    { name: "Singapore", iso: "SG", aliases: ["singapore"], tlds: [".sg", ".com.sg"], dialCode: "65" },
    { name: "Malaysia", iso: "MY", aliases: ["malaysia"], tlds: [".my", ".com.my"], dialCode: "60" },
    { name: "Vietnam", iso: "VN", aliases: ["vietnam", "việt nam"], tlds: [".vn", ".com.vn"], dialCode: "84" },
    { name: "Thailand", iso: "TH", aliases: ["thailand"], tlds: [".th", ".co.th"], dialCode: "66" },
    { name: "Indonesia", iso: "ID", aliases: ["indonesia"], tlds: [".id", ".co.id"], dialCode: "62" },
    { name: "Philippines", iso: "PH", aliases: ["philippines"], tlds: [".ph", ".com.ph"], dialCode: "63" },
    { name: "Turkey", iso: "TR", aliases: ["turkey", "türkiye"], tlds: [".tr", ".com.tr"], dialCode: "90" },
    { name: "United Arab Emirates", iso: "AE", aliases: ["united arab emirates", "uae", "dubai", "abu dhabi"], tlds: [".ae"], dialCode: "971" },
    { name: "Saudi Arabia", iso: "SA", aliases: ["saudi arabia"], tlds: [".sa"], dialCode: "966" },
    { name: "Brazil", iso: "BR", aliases: ["brazil", "brasil"], tlds: [".br", ".com.br"], dialCode: "55" },
    { name: "Mexico", iso: "MX", aliases: ["mexico", "méxico"], tlds: [".mx", ".com.mx"], dialCode: "52" },
    { name: "Russia", iso: "RU", aliases: ["russia", "russian federation"], tlds: [".ru"], dialCode: "7" },
    { name: "Poland", iso: "PL", aliases: ["poland", "polska"], tlds: [".pl"], dialCode: "48" },
    { name: "Switzerland", iso: "CH", aliases: ["switzerland", "schweiz", "suisse"], tlds: [".ch"], dialCode: "41" },
    { name: "Sweden", iso: "SE", aliases: ["sweden", "sverige"], tlds: [".se"], dialCode: "46" },
    { name: "Belgium", iso: "BE", aliases: ["belgium", "belgique"], tlds: [".be"], dialCode: "32" },
    { name: "Austria", iso: "AT", aliases: ["austria", "österreich"], tlds: [".at"], dialCode: "43" },
    { name: "Denmark", iso: "DK", aliases: ["denmark", "danmark"], tlds: [".dk"], dialCode: "45" },
    { name: "Norway", iso: "NO", aliases: ["norway", "norge"], tlds: [".no"], dialCode: "47" },
    { name: "Finland", iso: "FI", aliases: ["finland", "suomi"], tlds: [".fi"], dialCode: "358" },
    { name: "Ireland", iso: "IE", aliases: ["ireland"], tlds: [".ie"], dialCode: "353" },
    { name: "New Zealand", iso: "NZ", aliases: ["new zealand"], tlds: [".nz", ".co.nz"], dialCode: "64" },
    { name: "South Africa", iso: "ZA", aliases: ["south africa"], tlds: [".za", ".co.za"], dialCode: "27" },
    { name: "Egypt", iso: "EG", aliases: ["egypt"], tlds: [".eg"], dialCode: "20" },
    { name: "Israel", iso: "IL", aliases: ["israel"], tlds: [".il"], dialCode: "972" },
    { name: "Pakistan", iso: "PK", aliases: ["pakistan"], tlds: [".pk"], dialCode: "92" },
    { name: "Bangladesh", iso: "BD", aliases: ["bangladesh"], tlds: [".bd"], dialCode: "880" }
  ];

  // Global City/State to Country Mapping
  const CITY_STATE_COUNTRY_MAP = [
    { country: "South Korea", regex: /\b(seoul|incheon|busan|daegu|daejeon|gwangju|ulsan|suwon|changwon|seongnam|cheongju|anyang|bucheon|gyeonggi|gyeonggi-do|gangwon|chungcheong|jeolla|gyeongsang|jeju)\b/i },
    { country: "Japan", regex: /\b(tokyo|osaka|yokohama|nagoya|sapporo|kobe|kyoto|fukuoka|kawasaki|saitama|hiroshima|sendai|chiba|kanagawa|hokkaido)\b/i },
    { country: "China", regex: /\b(beijing|shanghai|guangzhou|shenzhen|chengdu|wuhan|tianjin|hangzhou|chongqing|nanjing|xi'an|suzhou|dongguan|zhejiang|jiangsu|guangdong|shandong|fujian)\b/i },
    { country: "India", regex: /\b(mumbai|delhi|new delhi|bangalore|bengaluru|hyderabad|ahmedabad|chennai|kolkata|surat|pune|jaipur|lucknow|kanpur|nagpur|indore|thane|bhopal|visakhapatnam|gujarat|maharashtra|karnataka|tamil nadu|telangana|uttar pradesh|rajasthan|punjab|haryana|west bengal)\b/i },
    { country: "Germany", regex: /\b(berlin|hamburg|munich|münchen|cologne|köln|frankfurt|stuttgart|düsseldorf|leipzig|dortmund|essen|bremen|dresden|hannover|nuremberg|nürnberg|bavaria|bayern|baden-württemberg|hessen|nordrhein-westfalen|saxony)\b/i },
    { country: "France", regex: /\b(paris|marseille|lyon|toulouse|nice|nantes|strasbourg|montpellier|bordeaux|lille|rennes|reims|le havre|île-de-france)\b/i },
    { country: "Italy", regex: /\b(rome|roma|milan|milano|naples|napoli|turin|torino|palermo|genoa|genova|bologna|florence|firenze|bari|catania|venice|venezia|verona|lombardy|lombardia|tuscany|toscana|piedmont|piemonte|veneto)\b/i },
    { country: "United States Of America", regex: /\b(new york|los angeles|chicago|houston|phoenix|philadelphia|san antonio|san diego|dallas|san jose|austin|jacksonville|fort worth|columbus|charlotte|indianapolis|san francisco|seattle|denver|washington dc|boston|el paso|nashville|detroit|las vegas|portland|memphis|louisville|baltimore|milwaukee|albuquerque|tucson|fresno|sacramento|atlanta|kansas city|colorado springs|miami|raleigh|omaha|long beach|virginia beach|oakland|minneapolis|tulsa|tampa|arlington|california|texas|florida|new york state|pennsylvania|illinois|ohio|georgia|north carolina|michigan|new jersey|virginia|washington state|arizona|massachusetts|tennessee|indiana|missouri|maryland|wisconsin|colorado|minnesota|south carolina|alabama|louisiana|kentucky|oregon|oklahoma|connecticut|utah|iowa|nevada|arkansas|mississippi|kansas|new mexico|nebraska|idaho|west virginia|hawaii|new hampshire|maine|montana|rhode island|delaware|south dakota|north dakota|alaska|vermont|wyoming)\b/i },
    { country: "Canada", regex: /\b(toronto|montreal|vancouver|calgary|edmonton|ottawa|winnipeg|quebec city|hamilton|kitchener|london ontario|victoria|halifax|ontario|quebec|british columbia|alberta|manitoba|saskatchewan|nova scotia|new brunswick|newfoundland)\b/i },
    { country: "Australia", regex: /\b(sydney|melbourne|brisbane|perth|adelaide|gold coast|canberra|newcastle nsw|wollongong|hobart|geelong|townsville|cairns|darwin|new south wales|nsw|victoria vic|queensland qld|western australia wa|south australia sa|tasmania tas)\b/i },
    { country: "Taiwan", regex: /\b(taipei|new taipei|taichung|kaohsiung|taoyuan|tainan|hsinchu)\b/i }
  ];

  // Helper clean text
  const clean = v => String(v ?? "").replace(/\s+/g, " ").trim();

  // Helper escape regex
  function escapeRegExp(string) {
    return String(string || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Capitalize first letter of every word (Title Case) — preserves ALL-CAPS corporate suffixes
  const TITLE_CASE_EXEMPTIONS = /^(co\.,?\s*ltd\.?|inc\.?|corp\.?|corporation|llc|gmbh|pvt\.?\s*ltd\.?|limited|ltd\.?|plc|ag|bv|nv|sa|srl|kk|co\.)$/i;

  function toTitleCase(str) {
    if (!str) return "";
    return str.split(/\s+/).map(word =>
      TITLE_CASE_EXEMPTIONS.test(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(" ");
  }

  // Rule 4: Remove brackets from company name while keeping country or inner text (e.g. Korea, UK)
  function removeBrackets(str) {
    if (!str) return "";
    // Remove brackets but KEEP the text inside (e.g. (Korea) -> Korea, (China) -> China, [UK] -> UK)
    const s = str.replace(/[()（）\[\]{}【】]/g, " ");
    return s.replace(/\s+/g, " ").trim();
  }

  // Get text content from element or document with newlines for block elements & br
  // Works reliably both on live DOM elements and unrendered DOMParser documents!
  function getElementText(el) {
    if (!el) return "";
    try {
      const clone = el.cloneNode(true);
      const breaks = clone.querySelectorAll("br, hr");
      for (const b of breaks) b.replaceWith("\n");
      const blocks = clone.querySelectorAll("p, div, li, tr, h1, h2, h3, h4, h5, h6, header, footer, section, article, dt, dd, blockquote");
      for (const blk of blocks) blk.append("\n");
      return (clone.textContent || "").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
    } catch {
      return (el.innerText || el.textContent || "").trim();
    }
  }

  // 5.3 International Legal Suffix Reference
  // Suffixes must be expanded from short form to full form.
  function expandLegalSuffixes(name) {
    if (!name) return "";
    let s = name;

    const EXPANSIONS = [
      // --- D. Germany, Austria, and Switzerland (compounds first) ---
      [/\b(?:gmbh\s*(?:&|and)\s*co\.?\s*kgaa)\b/gi, "Gesellschaft mit beschränkter Haftung & Co. Kommanditgesellschaft auf Aktien"],
      [/\b(?:gmbh\s*(?:&|and)\s*co\.?\s*kg)\b/gi, "Gesellschaft mit beschränkter Haftung & Co. Kommanditgesellschaft"],
      [/\b(?:gmbh\s*(?:&|and)\s*co\.?)\b/gi, "Gesellschaft mit beschränkter Haftung & Company"],
      [/\bggmbh\b/gi, "Gemeinnützige Gesellschaft mit beschränkter Haftung"],
      [/\bkgaa\b/gi, "Kommanditgesellschaft auf Aktien"],
      [/\bug\s*(?:\(?\s*haftungsbeschr[äa]nkt\s*\)?)/gi, "Unternehmergesellschaft (haftungsbeschränkt)"],

      // --- L. Latin America (compounds first) ---
      [/\bs\.?a\.?p\.?i\.?\s+de\s+c\.?v\.?(?=[,.\s]|$)/gi, "Sociedad Anónima Promotora de Inversión de Capital Variable"],
      [/\bs\.?\s+de\s+r\.?l\.?\s+de\s+c\.?v\.?(?=[,.\s]|$)/gi, "Sociedad de Responsabilidad Limitada de Capital Variable"],
      [/\bs\.?a\.?(?:b\.?)?\s+de\s+c\.?v\.?(?=[,.\s]|$)/gi, "Sociedad Anónima de Capital Variable"],
      [/\bc[íi]a\.?\s*ltda\.?(?=[,.\s]|$)/gi, "Compañía Limitada"],
      [/\be\.?i\.?r\.?l\.?(?=[,.\s]|$)/gi, "Empresa Individual de Responsabilidad Limitada"],

      // --- B. India, A. US & UK, C. China & Hong Kong, I. SE Asia (compounds first) ---
      [/\b(?:private\s+limited\s+co(?:mpany|\.)?|pvt\.?\s*ltd\.?\s*co(?:mpany|\.)?)(?=[,.\s]|$)/gi, "Private Limited Company"],
      [/\b(?:private\s+limited|pvt\.?\s*ltd\.?|private\s+ltd\.?)(?=[,.\s]|$)/gi, "Private Limited"],
      [/\b(?:pte\.?\s*ltd\.?)(?=[,.\s]|$)/gi, "Private Limited"],
      [/\b(?:pty\.?\s*ltd\.?)(?=[,.\s]|$)/gi, "Proprietary Limited"],
      [/\b(?:sdn\.?\s*bhd\.?)(?=[,.\s]|$)/gi, "Sendirian Berhad"],
      [/\b(?:soc\s+ltd\.?)(?=[,.\s]|$)/gi, "State-Owned Company Limited"],
      [/\b(?:co[.,\s]+ltd\.?|co[.,\s]+limited|company\s+ltd\.?)(?=[,.\s]|$)/gi, "Company Limited"],
      [/\b(?:limited\s+co\.?)(?=[,.\s]|$)/gi, "Limited Company"],

      // --- G. Poland & Central Europe ---
      [/\bsp\.?\s*z\s*o\.?\s*o\.?(?=[,.\s]|$)/gi, "Spółka z ograniczoną odpowiedzialnością"],

      // --- K. Middle East and Gulf Countries ---
      [/\bfz[- ]llc\b/gi, "Free Zone Limited Liability Company"],
      [/\bfzco\b/gi, "Free Zone Company"],
      [/\bfze\b/gi, "Free Zone Establishment"],
      [/\bk\.?s\.?c\.?c\.?(?=[,.\s]|$)/gi, "Kuwaiti Shareholding Company (Closed)"],
      [/\bsaoc\b/gi, "Société Anonyme Omanaise Close"],
      [/\bsaog\b/gi, "Société Anonyme Omanaise Générale"],
      [/\bprjsc\b/gi, "Private Joint Stock Company"],
      [/\bpjsc\b/gi, "Public Joint Stock Company"],
      [/\bw\.?l\.?l\.?(?=[,.\s]|$)/gi, "With Limited Liability"],

      // --- E. France and French-Speaking Jurisdictions ---
      [/\bab\s*\(?publ\)?(?=[,.\s]|$)/gi, "Aktiebolag (publ)"],
      [/\bs\.?a\.?s\.?u\.?(?=[,.\s]|$)/gi, "Société par actions simplifiée unipersonnelle"],
      [/\bs[aà]\.?r\.?l\.?(?=[,.\s]|$)/gi, "Société à responsabilité limitée"],
      [/\be\.?u\.?r\.?l\.?(?=[,.\s]|$)/gi, "Entreprise unipersonnelle à responsabilité limitée"],
      [/\bs\.?a\.?s\.?(?=[,.\s]|$)/gi, "Société par actions simplifiée"],
      [/\bs\.?r\.?l\.?(?=[,.\s]|$)/gi, "Società a responsabilità limitata"],
      [/\bs\.?n\.?c\.?(?=[,.\s]|$)/gi, "Société en nom collectif"],
      [/\bs\.?c\.?a\.?(?=[,.\s]|$)/gi, "Société en commandite par actions"],
      [/\bs\.?c\.?s\.?(?=[,.\s]|$)/gi, "Société en commandite simple"],

      // --- A. United States and United Kingdom (acronyms) ---
      [/\bp\.?l\.?l\.?c\.?(?=[,.\s]|$)/gi, "Professional Limited Liability Company"],
      [/\bl\.?l\.?c\.?(?=[,.\s]|$)/gi, "Limited Liability Company"],
      [/\bl\.?l\.?p\.?(?=[,.\s]|$)/gi, "Limited Liability Partnership"],
      [/\bp\.?l\.?c\.?(?=[,.\s]|$)/gi, "Public Limited Company"],
      [/\bcic\b/gi, "Community Interest Company"],
      [/\bcio\b/gi, "Charitable Incorporated Organisation"],
      [/\bc[- ]corp(?:\.|\b)/gi, "C Corporation"],
      [/\bs[- ]corp(?:\.|\b)/gi, "S Corporation"],
      [/\b(?:wfoe|wofe)\b/gi, "Wholly Foreign-Owned Enterprise"],
      [/\bjsc\b/gi, "Joint Stock Company"],

      // --- G. Central & Eastern Europe, F. Nordics ---
      [/\bs\.?r\.?o\.?(?=[,.\s]|$)/gi, "Společnost s ručením omezeným"],
      [/\ba\.?s\.?(?=\s*$|[,.])/gi, "Akciová společnost"],
      [/\bd\.?o\.?o\.?(?=[,.\s]|$)/gi, "Društvo s ograničenom odgovornošću"],
      [/\bd\.?d\.?(?=\s*$|[,.])/gi, "Dioničko društvo"],
      [/\bkft\.?(?=[,.\s]|$)/gi, "Korlátolt felelősségű társaság"],
      [/\bzrt\.?(?=[,.\s]|$)/gi, "Zártkörűen működő részvénytársaság"],
      [/\bnyrt\.?(?=[,.\s]|$)/gi, "Nyilvánosan működő részvénytársaság"],
      [/\boü\b/gi, "Osaühing"],
      [/\buab\b(?=\s*$|[,.])/gi, "Uždaroji akcinė bendrovė"],
      [/\bsia\b(?=\s*$|[,.])/gi, "Sabiedrība ar ierobežotu atbildību"],

      // --- F. Netherlands / Belgium ---
      [/\bb\.?v\.?(?=[,.\s]|$)/gi, "Besloten Vennootschap"],
      [/\bn\.?v\.?(?=[,.\s]|$)/gi, "Naamloze Vennootschap"],

      // --- F. Nordic Countries ---
      [/\boyj\b/gi, "Julkinen osakeyhtiö"],
      [/\boy\b(?=\s*$|[,.])/gi, "Osakeyhtiö"],
      [/\basa\b(?=\s*$|[,.])/gi, "Allmennaksjeselskap"],
      [/\baps\b(?=\s*$|[,.])/gi, "Anpartsselskab"],
      [/\ba\/s\b/gi, "Aktieselskab"],

      // --- G. Spain / Italy / Portugal ---
      [/\bs\.?p\.?a\.?(?=[,.\s]|$)/gi, "Società per Azioni"],
      [/\bs\.?l\.?(?=\s*$|[,.])/gi, "Sociedad Limitada"],
      [/\bs\.?a\.?(?=\s*$|[,.])/gi, "Société anonyme"],
      [/\blda\.?(?=[,.\s]|$)/gi, "Limitada"],
      [/\bltda\.?(?=[,.\s]|$)/gi, "Limitada"],

      // --- D. Germany / Austria / Switzerland single words ---
      [/\bgmbh\b/gi, "Gesellschaft mit beschränkter Haftung"],
      [/\bohg\b/gi, "Offene Handelsgesellschaft"],
      [/\bgbr\b/gi, "Gesellschaft bürgerlichen Rechts"],
      [/\be\.?\s*k\.?(?=\s*$|[,.])/gi, "eingetragener Kaufmann"],
      [/\bse\b(?=\s*$|[,.])/gi, "Societas Europaea"],
      [/\bag\b(?=\s*$|[,.])/gi, "Aktiengesellschaft"],
      [/\bkg\b(?=\s*$|[,.])/gi, "Kommanditgesellschaft"],
      [/\bug\b(?=\s*$|[,.])/gi, "Unternehmergesellschaft (haftungsbeschränkt)"],

      // --- H. Japan and South Korea ---
      [/\bk\.?k\.?(?=\s*$|[,.])/gi, "Kabushiki Kaisha"],
      [/\bgk\b(?=\s*$|[,.])/gi, "Gōdō Kaisha"],
      [/\byk\b(?=\s*$|[,.])/gi, "Yūgen Kaisha"],
      [/주식회사/g, "Jusik Hoesa"],
      [/유한회사/g, "Yuhan Hoesa"],
      [/유한책임회사/g, "Yuhanchaegim Hoesa"],

      // --- I. Southeast Asia, J. Australia / Africa ---
      [/\bbhd\.?(?=[,.\s]|$)/gi, "Berhad"],
      [/(?:^|\b)p\.?t\.?\s+(?=[A-Za-z0-9])/gi, "Perseroan Terbatas "],
      [/\bpt\b(?=\s*$|[,.])/gi, "Perseroan Terbatas"],
      [/\btbk\.?(?=[,.\s]|$)/gi, "Terbuka"],
      [/\bcv\b(?=\s*$|[,.])/gi, "Commanditaire Vennootschap"],
      [/\bopc\b(?=\s*$|[,.])/gi, "One Person Company"],
      [/\bnpc\b(?=\s*$|[,.])/gi, "Non-Profit Company"],
      [/\bcc\b(?=\s*$|[,.])/gi, "Close Corporation"],
      [/\bksc\b(?=\s*$|[,.])/gi, "Kuwait Shareholding Company"],
      [/\bl\.?p\.?(?=\s*$|[,.])/gi, "Limited Partnership"],
      [/\bab\b(?=\s*$|[,.])/gi, "Aktiebolag"],

      // --- A. United States and United Kingdom (single words) ---
      [/\binc\.?(?=[,.\s]|$)/gi, "Incorporated"],
      [/\bcorp\.?(?=[,.\s]|$)/gi, "Corporation"],
      [/\bltd\.?(?=[,.\s]|$)/gi, "Limited"],
      [/\bpvt\.?(?=[,.\s]|$)/gi, "Private"],
      [/\bco\.?(?=\s+(?:limited|ltd|incorporated|corporation)\b)/gi, "Company"],
      [/\bco\.?(?=[,]?\s*$)/gi, "Company"]
    ];

    for (const [rx, rep] of EXPANSIONS) {
      s = s.replace(rx, rep);
    }

    return s;
  }

  // Format Company Name according to Rule 4 & Section 5.3 (Expand legal suffixes)
  function formatCompanyName(raw) {
    if (!raw) return "";
    let name = clean(raw);

    // 1. Remove copyright phrases, dates, or trailing noise
    name = name.replace(/\ball rights reserved\b/gi, "");
    name = name.replace(/\bcopyright\b/gi, "");
    name = name.replace(/^(?:copyright|©|\(c\))\s*(?:[0-9]{4})?\s*/gi, "");

    // 2. Expand Korean entity designations before stripping brackets
    name = name.replace(/[（(]\s*주\s*[)）]|㈜/g, "Jusik Hoesa ");
    name = name.replace(/주식회사/g, "Jusik Hoesa ");
    name = name.replace(/유한회사/g, "Yuhan Hoesa ");
    name = name.replace(/유한책임회사/g, "Yuhanchaegim Hoesa ");

    // 3. Remove brackets while keeping inner text (e.g. (Korea) -> Korea, (UK) -> UK)
    name = removeBrackets(name);

    // 4. Trim special characters from beginning and end
    name = trimSpecialChars(name);

    // 5. Title-case the trade name portion (if all lowercase or all uppercase)
    // Preserves 2-5 letter all-caps acronyms (like BBC, 3M, IBM, BASF) intact
    name = name.split(/\s+/).map(w => {
      if (/^[A-Z]{2,5}$/.test(w)) return w;
      if (/[a-z]/.test(w) && /[A-Z]/.test(w.slice(1))) return w;
      if (/^[a-zA-Z가-힣]+$/.test(w)) {
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      }
      return w;
    }).join(" ");

    // 6. Section 5.3: Expand all international legal suffixes to full form
    name = expandLegalSuffixes(name);

    // 7. Clean duplicate punctuation, extra spaces, trailing/leading commas or dots
    name = clean(name.replace(/^[,;:\-.\s]+|[,;:\-.\s]+$/g, ""));

    return name;
  }

  // Remove special characters from start and end
  function trimSpecialChars(str) {
    if (!str) return "";
    return str.replace(/^[^a-zA-Z0-9가-힣]+|[^a-zA-Z0-9가-힣]+$/g, "").trim();
  }

  // Safe DOM parser that works in window, tab, and fallback
  function getDoc(htmlString, url) {
    if (typeof DOMParser !== "undefined") {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, "text/html");
      const base = doc.createElement("base");
      base.href = url;
      doc.head?.prepend(base);
      return doc;
    }
    return null;
  }

  // Check Rule 1: Subdomain & Redirect Verification
  function checkUrlRules(rawUrl) {
    const res = {
      isSubdomain: false,
      isRedirect: false,
      warning: null
    };

    try {
      const u = new URL(rawUrl);
      const host = u.hostname.toLowerCase();
      const parts = host.split(".");

      // Check subdomains (excluding www and two-part TLDs like co.kr, co.uk, com.cn)
      const commonTwoPartTlds = ["co.kr", "co.uk", "com.cn", "co.in", "com.au", "com.tw", "com.hk", "com.br", "co.jp"];
      const isTwoPart = commonTwoPartTlds.some(tld => host.endsWith("." + tld));
      const minPartsForSubdomain = isTwoPart ? 4 : 3;

      if (parts.length >= minPartsForSubdomain && parts[0] !== "www") {
        res.isSubdomain = true;
        res.warning = `⚠️ Subdomain detected (${host}). Rule 1: Do not work on subdomain sites!`;
      }
    } catch { }

    return res;
  }

  // Check Forbidden Categories Filter
  function checkForbiddenCategories(text) {
    const lower = text.toLowerCase();
    for (const cat of FORBIDDEN_CATEGORIES) {
      if (cat.regex.test(lower)) {
        return {
          isForbidden: true,
          category: cat.name,
          message: `⛔ FORBIDDEN CATEGORY DETECTED: [${cat.name}]. Rule: Do not work on this site!`
        };
      }
    }
    return { isForbidden: false };
  }

  // Rule 2: Business Type (7 paid types: Manufacturer to Wholesaler)
  function detectBusinessType(text) {
    const lower = text.toLowerCase();

    // Priority rule: If manufacturing/producer mentioned (even on shopping site) -> Manufacturer
    if (/\b(manufacturer|manufacturing|manufacture|factory|produced by|producer|production|fabrication|plant|oem|odm|assembly line)\b/i.test(lower)) {
      return "Manufacturer";
    }
    if (/\b(wholesale|wholesaler|bulk supply|bulk order|distributor|distribution)\b/i.test(lower)) {
      return "Wholesaler";
    }
    // Trader requires BOTH import/export or compound phrase — not just 'trading'
    if (/\b(trading company|importer and exporter|import.*export|export.*import|merchant)\b/i.test(lower)) {
      return "Trader";
    }
    if (/\b(exporter|exporting|global export|overseas sales|export specialist)\b/i.test(lower)) {
      return "Exporter";
    }
    if (/\b(supplier|supplying|stockist|vendor)\b/i.test(lower)) {
      return "Supplier";
    }
    // Service Provider: only match explicit compound phrases — NOT just 'services' or 'solutions'
    if (/\b(service provider|it consulting|consulting firm|maintenance company|after-?sales service|support contractor)\b/i.test(lower)) {
      return "Service Provider";
    }

    return "Manufacturer"; // Default — most B2B industrial sites are manufacturers
  }

  // Rule 3: Company Profile
  function detectCompanyProfile(text, doc) {
    const hasProfile = /\b(about us|company profile|company overview|greetings|history|management philosophy|organization|회사소개|회사개요|인사말)\b/i.test(text) ||
      Boolean(doc?.querySelector?.('a[href*="about"], a[href*="ab0"], a[href*="company"], a[href*="profile"]'));
    return hasProfile ? "Available" : "Not Available";
  }

  // Rule 4: Company Name — Full Form Extraction with Extended Content & Suffix Analysis
  function extractCompanyName(doc, text, url) {
    let legalName = "";
    let brandName = "";

    // Comprehensive corporate suffix pattern (Section 5.3 International Legal Suffixes)
    const corpSuffix = /\b(?:co[.,\s]*ltd\.?|co[.,\s]+limited|company\s+limited|corporation|corp\.?|incorporated|inc\.?|limited|ltd\.?|llc|llp|plc|pllc|gmbh|ag|kg|kgaa|se|sarl|eurl|sas|sasu|sa|bv|nv|ab|oy|oyj|as|aps|sl|srl|spa|kft|zrt|nyrt|s\.r\.o\.|a\.s\.|d\.o\.o\.|pvt\.?\s*ltd\.?|private\s+limited|pte\.?\s*ltd\.?|pty\.?\s*ltd\.?|proprietary\s+limited|sdn\.?\s*bhd\.?|berhad|bhd\.?|tbk\.?|wll|pjsc|fze|fzco|fz-llc)\b/i;

    // Helper: checks if candidate string contains a real corporate suffix
    const hasCorpSuffix = str => Boolean(str && corpSuffix.test(str));

    // Helper to validate and clean a company name candidate
    function sanitizeCandidate(str) {
      if (!str) return "";
      let s = clean(str)
        .replace(/^(?:copyright|©|\(c\))\s*(?:[0-9]{4})?\s*/gi, "")
        .replace(/(?:all rights?|rights reserved|company reg|reg no).*$/gi, "")
        .replace(/\s*[|·•\-–—.,]\s*$/g, "")
        .replace(/^[,;:\-.\s]+|[,;:\-.\s]+$/g, "")
        .trim();
      if (s.length >= 2 && s.length <= 80 && !/^(?:all|rights|reserved|inc|ltd|co|llc|\d+)$/i.test(s)) {
        return s;
      }
      return "";
    }

    // --- PHASE 1: SEARCH FOR FULL LEGAL NAME WITH CORPORATE SUFFIX FIRST ---

    // 1. Schema.org JSON-LD (check legalName first, or name if it has a suffix)
    if (doc) {
      for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
        try {
          const parsed = JSON.parse(s.textContent);
          const objs = Array.isArray(parsed) ? parsed : [parsed];
          const allObjs = [];
          for (const o of objs) {
            allObjs.push(o);
            if (o["@graph"]) allObjs.push(...o["@graph"]);
          }
          for (const x of allObjs) {
            if (/Organization|Corporation|LocalBusiness|Store|Brand/i.test(x["@type"] || "")) {
              const lName = sanitizeCandidate(x.legalName || "");
              if (lName && hasCorpSuffix(lName)) {
                legalName = lName;
                break;
              }
              const n = sanitizeCandidate(x.name || "");
              if (n && hasCorpSuffix(n) && !legalName) {
                legalName = n;
              } else if (n && !brandName) {
                brandName = n;
              }
            }
          }
        } catch { }
        if (legalName) break;
      }
    }

    // 2. Footer Copyright & Footer Address lines (most common location for legal suffix)
    if (!legalName && doc) {
      const footerEls = doc.querySelectorAll(
        'footer, #footer, .footer, .foot, .ft_data, [class*="footer"], [id*="footer"], address, .bottom, #bottom, .copyright, [class*="copyright"], [class*="copy-right"]'
      );
      for (const f of footerEls) {
        const lines = getElementText(f).split(/[\r\n]+/);
        for (const line of lines) {
          const l = clean(line);
          if (!l || l.length < 2 || l.length > 120) continue;

          // Pattern A: © / copyright line
          const cpMatch = l.match(/(?:©|copyright|\(c\))\s*(?:\d{2,4}\s*[-–]?\s*\d{2,4}|\d{2,4})?\s*(.{2,80}?)(?:\s*[|·•\-–—.,]?\s*(?:all rights?|rights reserved|company reg|reg no)|$)/i);
          if (cpMatch && cpMatch[1]) {
            const cand = sanitizeCandidate(cpMatch[1]);
            if (cand) {
              if (hasCorpSuffix(cand)) {
                legalName = cand;
                break;
              } else if (!brandName) {
                brandName = cand;
              }
            }
          }

          // Pattern B: Line containing a corporate suffix and not an address/contact line
          if (hasCorpSuffix(l) &&
            !/(?:street|road|floor|suite|bldg|building|avenue|drive|lane|way|park\b|industrial estate|tel\b|phone\b|fax\b|email\b|@|사업자|대표자|-ro\b|-gu\b|-si\b)/i.test(l)) {
            const cand = sanitizeCandidate(l);
            if (cand && hasCorpSuffix(cand)) {
              legalName = cand;
              break;
            }
          }
        }
        if (legalName) break;
      }
    }

    // 3. Full-text copyright regex with corporate suffix
    if (!legalName && text) {
      const cpMatches = text.matchAll(/(?:©|copyright|\(c\))\s*(?:\d{2,4}\s*[-–]?\s*\d{2,4}|\d{2,4})?\s*([A-Za-z0-9\u00C0-\u024F&.,\s'-]{2,80}?)(?:\s*[|·•\-–—.,]?\s*(?:all rights?|rights reserved|company reg|reg no)|\n|$)/gi);
      for (const m of cpMatches) {
        if (m && m[1]) {
          const cand = sanitizeCandidate(m[1]);
          if (cand && hasCorpSuffix(cand)) {
            legalName = cand;
            break;
          } else if (cand && !brandName) {
            brandName = cand;
          }
        }
      }
    }

    // 4. "ALL RIGHTS RESERVED" reverse match with corporate suffix
    if (!legalName && text) {
      const arrMatch = text.match(/([A-Za-z0-9\u00C0-\u024F&.,\s'-]{2,80}?)\s*\.?\s*all rights? reserved/i);
      if (arrMatch && arrMatch[1]) {
        const cand = sanitizeCandidate(arrMatch[1]);
        if (cand && hasCorpSuffix(cand)) {
          legalName = cand;
        } else if (cand && !brandName) {
          brandName = cand;
        }
      }
    }

    // 5. Title tag segment with corporate suffix
    if (!legalName && doc?.title) {
      const titleParts = doc.title.split(/[|\-–—:·•]/).map(s => s.trim()).filter(Boolean);
      const corpPart = titleParts.find(p => hasCorpSuffix(p) && p.length >= 2 && p.length <= 80);
      if (corpPart) {
        legalName = sanitizeCandidate(corpPart);
      } else if (titleParts[0] && !brandName) {
        brandName = sanitizeCandidate(titleParts[0]);
      }
    }

    // 6. itemprop="legalName"
    if (!legalName && doc) {
      const itemprop = doc.querySelector('[itemprop="legalName"]');
      const cand = sanitizeCandidate(itemprop?.textContent || itemprop?.getAttribute("content") || "");
      if (cand && hasCorpSuffix(cand)) {
        legalName = cand;
      }
    }

    // If a full legal name with suffix was found in Phase 1, use it!
    if (legalName) {
      return formatCompanyName(legalName);
    }

    // --- PHASE 2: EXTRACT BRAND NAME CANDIDATE ---
    if (!brandName && doc) {
      const metaSources = [
        doc.querySelector('meta[property="og:site_name"]')?.content,
        doc.querySelector('meta[name="application-name"]')?.content,
        doc.querySelector('meta[name="author"]')?.content,
        doc.querySelector('meta[name="company"]')?.content
      ];
      for (const m of metaSources) {
        const v = sanitizeCandidate(m || "");
        if (v && !/home|website|portal|blog|@/i.test(v)) {
          brandName = v;
          break;
        }
      }
    }

    if (!brandName && doc) {
      const logoImgs = doc.querySelectorAll(
        'header img[alt], #header img[alt], nav img[alt], .logo img[alt], [class*="logo"] img[alt], [id*="logo"] img[alt], .brand img[alt], .navbar-brand img[alt]'
      );
      for (const img of logoImgs) {
        const alt = sanitizeCandidate(img.getAttribute("alt") || "");
        if (alt.length >= 2 && alt.length <= 70 && !/logo|icon|banner|home|header|nav|menu/i.test(alt)) {
          brandName = alt;
          break;
        }
      }
    }

    if (!brandName && doc) {
      const brandEls = doc.querySelectorAll(
        '.logo, .brand, .navbar-brand, .site-name, .site-title, [class*="logo-text"], [class*="brand-name"], [class*="company-name"], [class*="logo_text"], [class*="brand_name"], [id*="logo"], .logotype'
      );
      for (const el of brandEls) {
        const t = sanitizeCandidate(el.textContent || "");
        if (t.length >= 2 && t.length <= 70 && !/menu|navigation|home|skip|toggle|search/i.test(t)) {
          brandName = t;
          break;
        }
      }
    }

    if (!brandName && doc) {
      const hdrHeadings = doc.querySelectorAll("header h1, header h2, .hero h1, .banner h1, .intro h1, #header h1");
      for (const h of hdrHeadings) {
        const t = sanitizeCandidate(h.textContent || "");
        if (t.length >= 2 && t.length <= 70 && !/welcome|product|service|about|contact|home|we are/i.test(t)) {
          brandName = t;
          break;
        }
      }
    }

    if (!brandName && doc) {
      const h1 = doc.querySelector("h1");
      if (h1) {
        const t = sanitizeCandidate(h1.textContent || "");
        if (t.length >= 2 && t.length <= 70 && !/welcome|home|menu|navigation/i.test(t)) {
          brandName = t;
        }
      }
    }

    // --- PHASE 3: EXTENDED CONTENT SEARCH ---
    // If we have a brand name (e.g. "Accurite Industries"), check the extended content
    // of the page (footer, address, full text) to see if this brand name appears with a legal suffix (e.g. "Accurite Industries Ltd")!
    if (brandName && text) {
      const baseClean = brandName.replace(/\s+/g, "\\s+");
      const suffixSearchRegex = new RegExp(
        `\\b(${baseClean}\\s+(?:co[.,\\s]*ltd\\.?|co[.,\\s]+limited|company\\s+limited|corporation|corp\\.?|incorporated|inc\\.?|limited|ltd\\.?|llc|llp|plc|pllc|gmbh|ag|kg|kgaa|se|sarl|eurl|sas|sasu|sa|bv|nv|ab|oy|oyj|as|aps|sl|srl|spa|kft|zrt|nyrt|s\\.r\\.o\\.|a\\.s\\.|d\\.o\\.o\\.|pvt\\.?\\s*ltd\\.?|private\\s+limited|pte\\.?\\s*ltd\\.?|pty\\.?\\s*ltd\\.?|proprietary\\s+limited|sdn\\.?\\s*bhd\\.?|berhad|bhd\\.?|tbk\\.?|wll|pjsc|fze|fzco|fz-llc))\\b`,
        "i"
      );
      const match = text.match(suffixSearchRegex);
      if (match && match[1]) {
        return formatCompanyName(match[1]);
      }
    }

    // Also scan all text lines for any standalone company name matching brandName + suffix
    if (brandName && doc) {
      const allText = getElementText(doc.body);
      const lines = allText.split(/[\r\n]+/);
      for (const line of lines) {
        const l = clean(line);
        if (l.length >= brandName.length && l.length <= brandName.length + 30) {
          if (l.toLowerCase().startsWith(brandName.toLowerCase()) && hasCorpSuffix(l)) {
            const cand = sanitizeCandidate(l);
            if (cand) return formatCompanyName(cand);
          }
        }
      }
    }

    if (brandName) {
      return formatCompanyName(brandName);
    }

    // --- PHASE 4: ABSOLUTE LAST RESORT — DOMAIN FALLBACK ---
    try {
      const baseEl = doc?.querySelector("base[href]");
      const canonEl = doc?.querySelector('link[rel="canonical"]');
      const rawHref = url || baseEl?.getAttribute("href") || canonEl?.getAttribute("href") || "";
      if (rawHref) {
        const host = new URL(rawHref).hostname.replace(/^www\./, "");
        const domainPart = host.split(".")[0];
        if (domainPart && domainPart.length >= 2) {
          return formatCompanyName(domainPart);
        }
      }
    } catch { }

    return "";
  }

  // Rule 5: Country Name (Full form; Locality priority: England > United Kingdom; NEVER hardcoded!)
  function detectCountry(doc, addressText, fullText, url, phoneRaw) {
    const combinedAddr = `${addressText || ""}`.toLowerCase();
    // NOTE: Only scan addressText + short meta context for UK/cities, NOT the full body text!
    // Full body scanning causes false positives (e.g., Korean site mentions 'London' in news links)
    const combinedFull = `${addressText || ""}`.toLowerCase();

    // 1. RULE 5 SPECIAL CASE: United Kingdom localities (address-only scan to avoid false positives)
    // "If 'England' and 'United Kingdom' both are mentioned, you must take England as the country name."
    for (const uk of UK_LOCALITIES) {
      if (uk.regex.test(combinedAddr)) {
        return uk.name;
      }
    }

    // 2. Schema.org JSON-LD addressCountry
    if (doc) {
      for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
        try {
          const parsed = JSON.parse(s.textContent);
          const objs = Array.isArray(parsed) ? parsed : [parsed];
          for (const item of objs) {
            const addr = item.address || (item["@type"] === "PostalAddress" ? item : null);
            const countryVal = addr?.addressCountry;
            if (countryVal) {
              const strVal = (typeof countryVal === "object" ? countryVal.name : countryVal).trim();
              if (strVal) {
                // If 2-letter ISO code
                if (strVal.length === 2) {
                  const matchIso = COUNTRIES.find(c => c.iso.toLowerCase() === strVal.toLowerCase());
                  if (matchIso) {
                    if (matchIso.iso === "GB") {
                      for (const uk of UK_LOCALITIES) {
                        if (uk.regex.test(combinedAddr) || uk.regex.test(combinedFull)) return uk.name;
                      }
                    }
                    return matchIso.name;
                  }
                }
                // If country name
                for (const c of COUNTRIES) {
                  if (c.name.toLowerCase() === strVal.toLowerCase() || c.aliases.some(a => a.toLowerCase() === strVal.toLowerCase())) {
                    return c.name;
                  }
                }
              }
            }
          }
        } catch { }
      }
    }

    // 3. Match address text against country aliases
    if (addressText) {
      for (const c of COUNTRIES) {
        for (const alias of c.aliases) {
          const regex = new RegExp(`\\b${escapeRegExp(alias)}\\b`, "i");
          if (regex.test(addressText)) return c.name;
        }
      }
    }

    // 4. Match address text against City/State to Country Map
    if (addressText) {
      for (const mapping of CITY_STATE_COUNTRY_MAP) {
        if (mapping.regex.test(addressText)) {
          return mapping.country;
        }
      }
    }

    // 5. Match domain TLD (e.g. .co.kr -> South Korea, .de -> Germany, .jp -> Japan, .co.uk -> England)
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (host.endsWith(".uk") || host.endsWith(".co.uk")) {
        for (const uk of UK_LOCALITIES) {
          if (uk.regex.test(combinedFull)) return uk.name;
        }
        return "England";
      }
      for (const c of COUNTRIES) {
        for (const tld of c.tlds) {
          if (host.endsWith(tld)) return c.name;
        }
      }
    } catch { }

    // 6. Match Phone Number Dial Code (e.g. +82 -> South Korea, +49 -> Germany, +91 -> India, +44 -> England)
    const phoneToTest = `${phoneRaw || ""} ${fullText || ""}`;
    const dialCodeMatches = phoneToTest.match(/(?:Tel|Phone|Telephone|T\.)\s*[:.-]?\s*\+([0-9]{1,4})/gi) || [];
    for (const d of dialCodeMatches) {
      const codeMatch = d.match(/\+([0-9]{1,4})/);
      if (codeMatch && codeMatch[1]) {
        const code = codeMatch[1];
        if (code === "44") {
          for (const uk of UK_LOCALITIES) {
            if (uk.regex.test(combinedFull)) return uk.name;
          }
          return "England";
        }
        const countryByDial = COUNTRIES.find(c => c.dialCode === code);
        if (countryByDial) return countryByDial.name;
      }
    }

    // 7. Match full body text against City/State to Country Map (restricted to first 3000 chars to avoid false positives)
    const bodySnippet = `${addressText || ""} ${(fullText || "").slice(0, 3000)}`;
    for (const mapping of CITY_STATE_COUNTRY_MAP) {
      if (mapping.regex.test(bodySnippet)) {
        return mapping.country;
      }
    }

    // 8. Match body snippet against country aliases
    for (const c of COUNTRIES) {
      for (const alias of c.aliases) {
        if (alias.length < 4) continue; // skip very short aliases that cause false positives
        const regex = new RegExp(`\\b${escapeRegExp(alias)}\\b`, "i");
        if (regex.test(bodySnippet)) return c.name;
      }
    }

    // NEVER HARDCODE A DEFAULT! Return empty string if not found
    return "";
  }

  // Find Raw Multi-Line Address from Document / Footer / Text
  function findRawAddress(doc, fullText) {
    // 1. Schema.org PostalAddress
    if (doc) {
      for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
        try {
          const parsed = JSON.parse(s.textContent);
          const objs = Array.isArray(parsed) ? parsed : [parsed];
          for (const item of objs) {
            const addr = item.address || (item["@type"] === "PostalAddress" ? item : null);
            if (addr && (addr.streetAddress || addr.addressLocality || addr.addressRegion)) {
              const parts = [addr.streetAddress, addr.addressLocality, addr.addressRegion].filter(Boolean);
              if (parts.length >= 1) {
                return parts.join(", ");
              }
            }
          }
        } catch { }
      }
    }

    // 2. <address> tag
    if (doc) {
      const addrEl = doc.querySelector("address");
      if (addrEl) {
        const txt = getElementText(addrEl);
        if (txt && txt.length >= 15 && txt.length <= 250) {
          const lines = txt.split(/[\r\n]+/).map(clean).filter(Boolean);
          const addrLines = lines.filter(l => !/^(?:tel|phone|fax|email|e-mail|url|copyright)\b/i.test(l));
          if (addrLines.length > 0) {
            return addrLines.join(", ");
          }
        }
      }
    }

    // 3. Scan Footer elements for multi-line contiguous address blocks
    if (doc) {
      const footerElements = doc.querySelectorAll('footer, #footer, .footer, .foot, .ft_data, [class*="footer"], .bottom, #bottom');
      const addrKeywords = /(?:building|street|road|st\.|ave|rd\.|blvd|suite|floor|fl\.|bldg|-ro|-gu|-si|-do|district|province|city|zone|industrial|lane|drive|way|park|block|no\.|p\.o\.\s*box|strasse|straße|str\.|weg|platz|allee|rue|chemin|calle|via|corso|piazza|avenida|address|addr|location|headquarters|head office|본사|주소|\b\d{4,5}\s+[A-Za-z]+)/i;
      const stopKeywords = /^(?:tel|phone|fax|email|e-mail|대표|사업자|통신판매|copyright|all rights|©|\(c\))/i;

      for (const f of footerElements) {
        const fullFooterText = getElementText(f);
        const lines = fullFooterText.split(/[\r\n]+/).map(clean).filter(Boolean);

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (addrKeywords.test(line) && !stopKeywords.test(line)) {
            const collected = [];
            let firstLine = line.replace(/^(?:address|head office|headquarters|location|add|addr|본사|주소)\s*[:.-]\s*/i, "").trim();
            firstLine = firstLine.split(/\b(?:tel|phone|fax|email|e-mail|사업자|copyright)\b/i)[0].trim();
            if (firstLine) collected.push(firstLine);

            for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
              const nextLine = lines[j];
              if (stopKeywords.test(nextLine)) break;
              if (/(?:co[.,\s]*ltd|corporation|inc\.|all rights)/i.test(nextLine)) break;
              const cleanNext = nextLine.split(/\b(?:tel|phone|fax|email|e-mail|사업자|copyright)\b/i)[0].trim();
              if (cleanNext && cleanNext.length >= 2 && cleanNext.length <= 120) {
                collected.push(cleanNext);
              }
              if (/(?:\b\d{5,6}\b|korea|usa|japan|china|germany|uk|england)/i.test(cleanNext)) {
                break;
              }
            }

            const joined = collected.join(", ");
            if (joined.length >= 12 && joined.length <= 250) {
              return joined;
            }
          }
        }
      }
    }

    // 4. Regex fallback on text
    const textMatch = fullText.match(/(?:address|head office|headquarters|factory|location|add|addr)\s*[:.-]?\s*([A-Za-z0-9#.,\- \/]{15,180})/i);
    if (textMatch && textMatch[1]) {
      return textMatch[1].split(/\b(?:tel|phone|fax|email|e-mail|copyright)\b/i)[0].trim();
    }

    return "";
  }

  // Clean Address according to Rule 6
  function cleanAddressString(rawAddr, countryName, companyName) {
    if (!rawAddr) return "";
    let addr = clean(rawAddr);

    // 1. Remove brackets
    addr = removeBrackets(addr);

    if (companyName) {
      const cLower = companyName.toLowerCase();
      const baseName = companyName.replace(/\b(?:company\s+limited|co[.,\s]*ltd\.?|private\s+limited\s+company|private\s+limited|pvt\.?\s*ltd\.?|limited\s+liability\s+company|limited\s+liability\s+partnership|public\s+limited\s+company|limited|corporation|incorporated|gesellschaft\s+mit\s+beschr[äa]nkter\s+haftung|aktiengesellschaft|soci[eé]t[eé]\s+[aà]\s+responsabilit[eé]\s+limit[eé]e|perseroan\s+terbatas|sendirian\s+berhad|proprietary\s+limited|berhad|gmbh|inc\.?|corp\.?|llc|llp|plc|ltd\.?|co\.?)\b/gi, "").trim();

      const addrLower = addr.toLowerCase();
      if (addrLower.startsWith(cLower)) {
        addr = addr.substring(companyName.length).trim();
      } else if (baseName && baseName.length >= 3 && addrLower.startsWith(baseName.toLowerCase())) {
        const nextChar = addr.charAt(baseName.length);
        if (/[,;:\- ]/.test(nextChar)) {
          addr = addr.substring(baseName.length).trim();
        }
      }
    }

    // 3. REMOVE POSTAL CODES FIRST (so country names at end can be matched cleanly!)
    // 5-digit or 6-digit zip codes
    addr = addr.replace(/(?:^|[, \t])\b\d{5,6}\b(?=[, \t]|$)/g, " ");
    // UK postcodes (e.g. SW1A 1AA, EC2M 5QD)
    addr = addr.replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi, " ");
    // US Zip+4
    addr = addr.replace(/\b\d{5}-\d{4}\b/g, " ");
    // European postal code prefixes (D-12345, NL-1234)
    addr = addr.replace(/\b(?:D-|F-|I-|E-|NL-|B-|CH-|AT-|PL-)?\d{4,5}\b/gi, " ");

    // 4. REMOVE COUNTRY NAMES AT END — built DYNAMICALLY from COUNTRIES list (no hardcoding!)
    // Also removes UK locality names and common aliases.
    const allCountryTerms = [];
    for (const c of COUNTRIES) {
      allCountryTerms.push(escapeRegExp(c.name));
      for (const alias of c.aliases) {
        if (alias.length >= 3) allCountryTerms.push(escapeRegExp(alias));
      }
    }
    for (const uk of UK_LOCALITIES) {
      allCountryTerms.push(uk.name.toLowerCase());
    }
    // Deduplicate
    const uniqueTerms = [...new Set(allCountryTerms.map(t => t.toLowerCase()))].sort((a, b) => b.length - a.length);
    const dynamicCountryEndRegex = new RegExp(`[,\\s.]*(?:${uniqueTerms.join("|")})(?:[,\\s.]+|$)`, "gi");

    for (let pass = 0; pass < 4; pass++) {
      if (countryName) {
        const cRegex = new RegExp(`[,\\s]*\\b${escapeRegExp(countryName)}\\b[,\\s.]*$`, "gi");
        addr = addr.replace(cRegex, "");
      }
      addr = addr.replace(dynamicCountryEndRegex, function (match, offset, str) {
        // Only remove if at end of the string or near end
        const rest = str.slice(offset + match.length).trim();
        return (rest.length === 0 || /^[,. ]*$/.test(rest)) ? " " : match;
      });
      addr = addr.replace(/^[,;:\-.\s]+|[,;:\-.\s]+$/g, "").trim();
    }

    // 5. Clean extra spaces, duplicate commas, and trailing/leading punctuation
    addr = addr.replace(/\s+/g, " ");
    addr = addr.replace(/,\s*,+/g, ",");
    addr = addr.replace(/^[,;:\-.\s]+|[,;:\-.\s]+$/g, "").trim();

    return addr;
  }

  // Rules 7 & 8: State & City
  function detectStateAndCity(address, text) {
    const addrLower = (address || "").toLowerCase();
    const combined = `${address || ""} ${text || ""}`.toLowerCase();
    let state = "Not Available";
    let city = "Not Available";

    // Rule 7 & 8 Note: If country's capital is mentioned in address, BOTH State and City are Available!
    for (const cap of WORLD_CAPITALS) {
      if (addrLower.includes(cap) || combined.includes(cap)) {
        return { state: "Available", city: "Available" };
      }
    }

    // State indicators: County, Province, Prefecture, -do (Korea), or known states/provinces
    if (/(?:county|province|prefecture|state|-do\b|gyeonggi|gangwon|chungcheong|jeolla|gyeongsang|california|texas|florida|new york|pennsylvania|illinois|ohio|georgia|north carolina|michigan|new jersey|virginia|washington|arizona|massachusetts|tennessee|indiana|missouri|maryland|wisconsin|colorado|minnesota|south carolina|alabama|louisiana|kentucky|oregon|oklahoma|connecticut|utah|iowa|nevada|arkansas|mississippi|kansas|new mexico|nebraska|idaho|hawaii|guangdong|zhejiang|jiangsu|shandong|fujian|bavaria|bayern|baden-württemberg|hessen|nordrhein-westfalen|saxony|ontario|quebec|british columbia|alberta|manitoba|new south wales|victoria|queensland)/i.test(combined)) {
      state = "Available";
    }

    // City indicators: Town, District, Municipality, -si (Korea), -gu (Korea), or known global cities
    if (/(?:town|district|municipality|city|-si\b|-gu\b|anyang|suwon|seongnam|cheongju|bucheon|incheon|busan|daegu|daejeon|gwangju|ulsan|san jose|los angeles|san francisco|san diego|sacramento|fresno|new york|chicago|houston|phoenix|philadelphia|san antonio|dallas|austin|seattle|denver|boston|detroit|las vegas|miami|atlanta|london|birmingham|manchester|liverpool|leeds|sheffield|bristol|edinburgh|glasgow|berlin|hamburg|munich|münchen|cologne|köln|frankfurt|stuttgart|düsseldorf|paris|marseille|lyon|toulouse|nice|rome|milan|naples|turin|florence|venice|tokyo|osaka|yokohama|nagoya|sapporo|kobe|kyoto|fukuoka|beijing|shanghai|guangzhou|shenzhen|chengdu|wuhan|tianjin|hangzhou|mumbai|delhi|new delhi|bangalore|bengaluru|hyderabad|ahmedabad|chennai|kolkata|surat|pune|jaipur|toronto|montreal|vancouver|calgary|edmonton|ottawa|sydney|melbourne|brisbane|perth|taipei)/i.test(combined)) {
      city = "Available";
    }

    return { state, city };
  }

  // Rule 9 & 10: Email ID & Secondary Email ID
  function extractEmails(doc, text) {
    const emails = new Set();

    // mailto links
    if (doc) {
      for (const a of doc.querySelectorAll('a[href^="mailto:"]')) {
        const raw = a.getAttribute("href").replace(/^mailto:/i, "").split("?")[0].trim().toLowerCase();
        if (isValidEmail(raw)) emails.add(raw);
      }
    }

    // Regex scan — use word boundary after TLD to prevent "info@email.co.uktel" type matches
    const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}(?=[^a-zA-Z]|$)/g;
    const matches = text.match(emailRegex) || [];
    for (const m of matches) {
      if (isValidEmail(m)) emails.add(m.toLowerCase());
    }

    const list = [...emails];
    // Prioritize corporate email (sales, info, contact, office)
    list.sort((a, b) => {
      const prio = e => {
        if (/^sales@/i.test(e)) return 10;
        if (/^info@/i.test(e)) return 9;
        if (/^contact@/i.test(e)) return 8;
        if (/^office@/i.test(e)) return 7;
        if (/^export@/i.test(e)) return 6;
        return 1;
      };
      return prio(b) - prio(a);
    });

    return {
      primaryEmail: list[0] || "",
      secondaryEmail: list[1] || "", // Rule 10: If given, take it; if not, skip
      allEmails: list
    };
  }

  function isValidEmail(e) {
    if (!e || e.length > 80) return false;
    if (/\.(png|jpg|jpeg|gif|webp|svg|css|js)$/i.test(e)) return false;
    if (/example\.com|domain\.com|yourdomain|email@/i.test(e)) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  }

  // Rule 11: Phone Number
  // "remove the country code, special characters, and spaces. Do not take toll-free numbers. Do not take numbers starting with zero."
  function extractPhoneNumber(text, country) {
    // 1. Scan phone lines
    const phoneCandidates = [];
    const phoneRegex = /(?:Tel|Phone|Telephone|T\.)\s*[:.-]?\s*([+]?[0-9\s()./-]{7,25})/gi;
    let m;
    while ((m = phoneRegex.exec(text)) !== null) {
      const raw = m[1].split(/[\/~,\n]/)[0].trim();
      phoneCandidates.push(raw);
    }

    // Fallback general numbers
    const genRegex = /(?:\+\d{1,3}[\s.-]*)?(?:\(?\d{2,4}\)?[\s.-]*)?\d{3,4}[\s.-]*\d{4}/g;
    const genMatches = text.match(genRegex) || [];
    phoneCandidates.push(...genMatches);

    for (const raw of phoneCandidates) {
      // Rule 11: DO NOT TAKE TOLL-FREE NUMBERS!
      // Toll free prefixes: 1544, 1588, 1800, 1888, 800, 0800, 400
      const digitsOnly = raw.replace(/\D/g, "");
      if (/^(1544|1588|1577|1566|1800|1888|800|0800|400)/.test(digitsOnly)) {
        continue; // Skip toll-free
      }

      // Clean country code
      let s = raw;
      if (country?.dialCode) {
        s = s.replace(new RegExp(`^\\+?${country.dialCode}[\\s.-]*`), "");
      } else {
        s = s.replace(/^\+(82|86|91|1|44|49|81)[\s.-]*/, "");
      }

      // Remove special characters and spaces
      let cleanDigits = s.replace(/\D/g, "");

      // Rule 11: DO NOT TAKE NUMBERS STARTING WITH ZERO!
      if (cleanDigits.startsWith("0")) {
        cleanDigits = cleanDigits.replace(/^0+/, "");
      }

      // Validate length: 7 to 12 digits
      if (cleanDigits.length >= 7 && cleanDigits.length <= 12) {
        return cleanDigits;
      }
    }

    return "";
  }

  // Rules 12, 13, 14: Products, Images, Descriptions
  // Dropdown mapping: If 1 -> "1", if 2 -> "2", if >= 3 -> "3"; never 0
  function extractProductCounts(doc, text) {
    // Product element count — look for semantic product cards/items
    let rawCount = 0;
    if (doc) {
      const proEls = doc.querySelectorAll([
        "[class*=\"product\"]",
        "[class*=\"goods\"]",
        "[class*=\"item-card\"]",
        "[class*=\"pro-item\"]",
        "[class*=\"gallery-item\"]",
        ".bxslider li",
        ".slider_bot li",
        "[id*=\"product\"]"
      ].join(", "));
      rawCount = proEls.length;
    }

    // Image count — DON'T use img.width (DOMParser gives 0); use src/alt heuristics instead
    let imgCount = 0;
    if (doc) {
      const imgs = [...(doc.images || doc.querySelectorAll("img"))].filter(img => {
        const src = (img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("data-lazy") || "").toLowerCase();
        const alt = (img.getAttribute("alt") || "").toLowerCase();
        const parentClass = (img.parentElement?.className || "").toLowerCase();
        // Exclude decorative / UI images
        if (/logo|icon|avatar|flag|btn|arrow|banner|bg-|background|separator|sprite|pattern/i.test(src + " " + alt)) return false;
        // Include if URL contains product-like keywords
        if (/product|goods|item|thumb|gallery|catalog|pro[_-]/i.test(src)) return true;
        // Include if inside a product-like container
        if (/product|goods|item|gallery|catalog/i.test(parentClass)) return true;
        // Include if alt text has meaningful content (not empty, not just numbers)
        if (alt.length > 3 && !/^\d+$/.test(alt.trim())) return true;
        // Include all <img> with non-empty src that aren't tiny data-URIs or 1px tracking pixels
        if (src.startsWith("data:") || src.includes("1x1") || src.includes("pixel")) return false;
        // Include remaining images with an actual file extension
        return /\.(jpg|jpeg|png|webp|gif|bmp|svg)(\?|$)/i.test(src);
      });
      imgCount = imgs.length;
    }

    // Clamp: 0 -> 3 (rule: never 0), max -> 3
    const clamp = n => n <= 0 ? "3" : n === 1 ? "1" : n === 2 ? "2" : "3";

    const maxItems = Math.max(rawCount, imgCount);

    return {
      numberOfProduct: clamp(maxItems),
      imageProduct: clamp(imgCount),
      noOfProductDescription: clamp(maxItems)
    };
  }

  // Social Media Link Detection (Facebook, LinkedIn)
  function extractSocialMedia(doc, text) {
    const social = { facebook: null, linkedin: null };
    if (doc) {
      for (const a of doc.querySelectorAll('a[href]')) {
        const h = a.getAttribute('href') || "";
        if (!social.facebook && /facebook\.com\/(?:pages|company|[A-Za-z0-9._-]+)/i.test(h) && !/sharer/i.test(h)) {
          social.facebook = h;
        }
        if (!social.linkedin && /linkedin\.com\/(?:company|in)\/[A-Za-z0-9._-]+/i.test(h)) {
          social.linkedin = h;
        }
      }
    }
    return social;
  }

  // Find English or subpage URLs
  function findEnglishSubpage(doc, baseUrl) {
    if (!doc) return null;
    try {
      const base = new URL(baseUrl);
      for (const a of doc.querySelectorAll("a[href]")) {
        const href = a.getAttribute("href") || "";
        const text = clean(a.innerText || a.textContent || "").toLowerCase();
        try {
          const resolved = new URL(href, baseUrl).href;
          if (new URL(resolved).hostname !== base.hostname) continue;
          if (href === "/en" || href.startsWith("/en/") || /\b(english|eng|en)\b/i.test(text)) {
            return resolved;
          }
        } catch { }
      }
    } catch { }
    return null;
  }

  // Primary Extractor
  function extractFromDocument(doc, textContent, url) {
    const text = clean(textContent || getElementText(doc?.body) || "");

    // 1. Check Subdomain / Redirect
    const urlRules = checkUrlRules(url);

    // 2. Check Forbidden Categories
    const forbidden = checkForbiddenCategories(text);

    // 3. Extract Raw Multi-Line Address (Rule 6)
    const rawAddress = findRawAddress(doc, text);

    // 4. Extract Company Name (Rule 4) — pass url for domain-based fallback
    const companyName = extractCompanyName(doc, text, url);

    // 5. Extract Country (Rule 5 - dynamic, never hardcoded!)
    // Pass raw text as phoneRaw so dial codes (+82, +49 etc.) in "Tel: +82-..." can identify country
    const countryName = detectCountry(doc, rawAddress, text, url, text);
    const countryObj = COUNTRIES.find(c => c.name.toLowerCase() === countryName.toLowerCase());

    // 6. Clean Company Address with verified country and company name (Rule 6)
    const companyAddress = cleanAddressString(rawAddress, countryName, companyName);

    // 7. Extract State & City (Rule 7 & 8)
    const { state, city } = detectStateAndCity(rawAddress + " " + companyAddress, text);

    // 7. Business Type (Rule 2)
    const businessType = detectBusinessType(text);

    // 8. Company Profile (Rule 3)
    const companyProfile = detectCompanyProfile(text, doc);

    // 9. Emails (Rule 9 & 10)
    const emails = extractEmails(doc, text);

    // 10. Phone Number (Rule 11)
    const phoneNumber = extractPhoneNumber(text, countryObj);

    // 11. Products, Images, Descriptions (Rules 12, 13, 14)
    const counts = extractProductCounts(doc, text);

    // 12. Social Media (Facebook, LinkedIn)
    const social = extractSocialMedia(doc, text);

    // 13. Subpage
    const enUrl = findEnglishSubpage(doc, url);

    return {
      websiteName: url,
      websiteStatus: "Working",
      businessType,
      companyProfile,
      companyName,
      companyAddress,
      countryName,
      state,
      city,
      emailId: emails.primaryEmail,
      secondaryEmailId: emails.secondaryEmail,
      phoneNumber,
      numberOfProduct: counts.numberOfProduct,
      imageProduct: counts.imageProduct,
      noOfProductDescription: counts.noOfProductDescription,
      forbidden,
      urlRules,
      social,
      enUrl
    };
  }

  // Wrapper for HTML string
  function extractFromHtml(html, url) {
    const doc = getDoc(html, url);
    const text = clean(getElementText(doc?.body) || html.replace(/<[^>]+>/g, " "));
    return extractFromDocument(doc, text, url);
  }

  return {
    extractFromDocument,
    extractFromHtml,
    checkUrlRules,
    checkForbiddenCategories,
    getElementText,
    formatCompanyName,
    expandLegalSuffixes,
    COUNTRIES
  };
})();

if (typeof window !== "undefined") {
  window.Extractor = Extractor;
}
if (typeof globalThis !== "undefined") {
  globalThis.Extractor = Extractor;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = Extractor;
}
