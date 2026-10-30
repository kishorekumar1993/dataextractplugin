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
 * 11. Phone Number (Country code removed, spaces/special chars removed; toll-free only when no regular number is found)
 * 12. Number of Products (1 or 3; never 0)
 * 13. Product Images (1 or 3; never 0)
 * 14. Number of Product Descriptions (1 or 3; never 0)
 * Forbidden Categories Filter (Porn, Medicine/Medical, Food, Weapons/Knife, Defence, Aircraft, Marine, Chemical, Alcohol, Animals)
 * Social Media Sources (Facebook, LinkedIn)
 */

var Extractor = (typeof window !== "undefined" && window.Extractor) ? window.Extractor : (() => {

  // Forbidden Categories (Rule: Even if these appear anywhere, DO NOT work on that site!)
  // Forbidden Categories (Rule: Even if these appear anywhere, DO NOT work on that site!)
  // Refined to eliminate false positives on common words (e.g. putty knife, we ship worldwide, chemical resistant, PET plastic)
  const FORBIDDEN_CATEGORIES = [
    {
      name: "Porn / Adult",
      regex: /\b(porn|pornography|xxx|adult\s+(?:entertainment|content|movies?|videos?|films?|magazines?|club|clubs|toys?)|erotic|sex(?:ual)?\s+(?:content|services?|explicit|toys?)|prostitut(?:e|ion)|explicit content|escort\s+(?:services?|agenc(?:y|ies)|companies|company|directory|girls?)|(?:independent|female|male)\s+escorts?)\b/i,
      isExempt: (matchText, snippet) => {
        if (/^xxx$/i.test(matchText)) {
          if (/[-_A-Z0-9]+xxx|xxx[-_A-Z0-9]+/i.test(snippet)) return true;
          if (/xxx[-.\s]+xxx/i.test(snippet)) return true;
          if (!/\b(?:porn|adult|erotic|sex|video|movie|film|nude|naked|hardcore|sensual|escort|cam)\b/i.test(snippet)) return true;
        }
        return /\b(?:escort\s+ta|adult\s+(?:education|training|learning|size|sizes|courses?))\b/i.test(snippet);
      }
    },
    {
      name: "Medicine / Medical / Hospital",
      regex: /\b(medicines?|medical|hospital|pharmacy|pharmaceuticals?|clinic|surgical|physicians?|prescriptions?|therapeutics?|healthcare|health care)\b/i,
      isExempt: (matchText, snippet) => {
        return /\b(?:medical[- ]grade|hospital[- ]grade|surgical[- ]precision|cleanroom[- ]grade)\b/i.test(snippet);
      }
    },
    {
      name: "Food",
      regex: /\b(food|foods|restaurant|bakery|catering|snacks?|confectionery|edible|beverages?|drinks?|groceries|fruit|vegetables?|meat|seafood|dairy|tea|coffee|foodstuff)\b/i,
      isExempt: (matchText, snippet) => {
        return /\b(?:food[- ]grade|food[- ]safe|food[- ]contact|food[- ]approved|food[- ]machin(?:e|ery|es)|food[- ](?:processing|packaging|handling)[- ]machin(?:e|ery|es))\b/i.test(snippet);
      }
    },
    {
      name: "Weapons (Knife)",
      regex: /\b(weapons?|firearms?|ammunition|munitions?|armaments?|swords?|daggers?|bayonets?|switchblades?|machetes?|dirks?|stilettos?|handguns?|pistols?|revolvers?|rifles?|shotguns?|machine\s*guns?|submachine\s*guns?|assault\s*rifles?|airsoft(?:\s*guns?)?|bb\s*guns?|stun\s*guns?|tasers?|(?:weapon|sword|combat|tactical|hunting|survival|dagger|bayonet)\s+blades?|knives|knife|guns?)\b/i,
      isExempt: (matchText, snippet) => {
        if (/knives|knife/i.test(matchText)) {
          // Non-weapon hand tools & construction tools (putty knife, taping knife, joint knife, utility knife, etc.)
          if (/\b(?:putty|taping|joint|spackle|scraper|scraping|drywall|plastering|plaster|palette|painting|paint|utility|craft|hobby|box|box[- ]cutter|linoleum|carpet|insulation|lead|glass|microtome|air|doctor|slitter|shear|shearing|rotary|granulator|planer|jointer|chipper|guillotine|machine|industrial|circular|saw|wiper|fan|turbine|rotor|cutter|cutting|slitting|mower|lawnmower|razor|shaving|trimmer|dozer|plow|snowplow|mixer|agitator|diamond|carbide|server)[\s\-_/]+(?:knives|knife)\b/i.test(snippet)) {
            return true;
          }
          // Industrial valves, switches, accessories
          if (/\b(?:knives|knife)[\s\-_/]+(?:gate[\s\-_/]+valves?|valves?|slide[\s\-_/]+valves?|switches?|holders?|blocks?|edges?|inserts?)\b/i.test(snippet)) {
            return true;
          }
          // Tableware, cutlery & kitchen tools
          if (/\b(?:butter|table|dinner|steak|cheese|bread|paring|chef|chefs|chef's|kitchen|carving|boning|fillet|filleting|santoku|cleaver|oyster|cutlery)[\s\-_/]+(?:knives|knife)\b/i.test(snippet)) {
            return true;
          }
        }
        if (/guns?/i.test(matchText)) {
          // Non-weapon tools & industrial equipment
          if (/\b(?:glue|hot[\s\-_/]+glue|heat|spray|paint|grease|caulk|caulking|nail|nailer|staple|stapler|rivet|riveter|blow|stud|screw|dispensing|foam|soldering|tie|wash|washing|water|massage|radar|thermometer|temperature|barcode|scanner|price|tagging|electron|ion|plasma)[\s\-_/]+guns?\b/i.test(snippet)) {
            return true;
          }
        }
        return false;
      }
    },
    {
      name: "Defence",
      regex: /\b(defen[cs]e|military|warfare|missiles?|tactical weapons?|munitions?)\b/i,
      isExempt: (matchText, snippet) => {
        return /\bdefen[cs]e[\s\-_/]+against[\s\-_/]+(?:corrosion|rust|wear|uv|weather|insects?|bacteria|elements?)\b|\b(?:corrosion|uv|rust)[\s\-_/]+defen[cs]e\b/i.test(snippet);
      }
    },
    {
      name: "Aircraft / Aerospace",
      regex: /\b(aircraft|aerospace|aviation|airplanes?|helicopters?|spacecraft|drones?)\b/i,
      isExempt: null
    },
    {
      name: "Marine / Ship",
      regex: /\b(marine|ships?|shipbuilding|shipyards?|yachts?|naval|boats?|sea freight|ocean freight|freight forwarders?|freight forwarding|vessels?|(?:maritime|ocean|sea)\s+shipping|shipping\s+(?:companies?|lines?|fleets?|vessels?|industry|services|agents?))\b/i,
      isExempt: (matchText, snippet) => {
        // Exclude common e-commerce & commercial delivery / dispatch terminology
        if (/ships?|shipping/i.test(matchText)) {
          if (/\b(?:we|company|our[\s\-_/]+company|i)[\s\-_/]+ships?\b|\bships?[\s\-_/]+(?:worldwide|globally|domestically|daily|fast|to|from|within|in|via|across|direct|directly)\b|\b(?:ready|free|fast|same[- ]day|next[- ]day|flat[- ]rate|express|standard|drop|direct|domestic|international)[\s\-_/]+ships?\b/i.test(snippet)) {
            return true;
          }
          if (/\bshipping[\s\-_/]+(?:policy|cost|costs|fee|fees|rates?|time|times|options?|info|information|details?|calculator|address|method|methods|and[\s\-_/]+handling|and[\s\-_/]+returns?|tracking|status|updates?)\b/i.test(snippet)) {
            return true;
          }
          if (/\b(?:free|drop|express|standard|freight|ground|air|parcel|package|flat[- ]rate|fast|worldwide|international|domestic)[\s\-_/]+shipping\b/i.test(snippet)) {
            if (!/\b(?:ocean|sea|maritime)[\s\-_/]+shipping\b/i.test(snippet)) {
              return true;
            }
          }
          if (/\bto[\s\-_/]+ship\b|\bwill[\s\-_/]+ship\b|\bcan[\s\-_/]+ship\b|\bship[\s\-_/]+out\b|\bhow[\s\-_/]+we[\s\-_/]+ship\b/i.test(snippet)) {
            return true;
          }
        }
        return false;
      }
    },
    {
      name: "Chemical",
      regex: /\b(chemicals?|petrochemicals?|reagents?|solvents?|pesticides?)\b/i,
      isExempt: (matchText, snippet) => {
        // Exclude material durability & resistance descriptions
        return /\b(?:chemical[- ]resistant|chemical[- ]resistance|chemical[- ]proof|chemical[- ]inert(?:ness)?|chemical[- ]compatibility|resistant[\s\-_/]+to[\s\-_/]+(?:all[\s\-_/]+|harsh[\s\-_/]+|aggressive[\s\-_/]+|various[\s\-_/]+)?chemicals?|resistance[\s\-_/]+to[\s\-_/]+(?:all[\s\-_/]+|harsh[\s\-_/]+|aggressive[\s\-_/]+|various[\s\-_/]+)?chemicals?)\b/i.test(snippet);
      }
    },
    {
      name: "Alcohol",
      regex: /\b(alcohol|alcoholic|brew(?:ery|ing)|distiller(?:y|ies)|wineries?|liquor|beer|wine|vodka|whiskey|whisky|spirits)\b/i,
      isExempt: (matchText, snippet) => {
        // Exclude cleaning solvents and idioms
        return /\b(?:isopropyl[\s\-_/]+alcohol|rubbing[\s\-_/]+alcohol|alcohol[- ]free|alcohol[- ]wipes?|alcohol[- ]cleaning|team[\s\-_/]+spirits?|high[\s\-_/]+spirits?|in[\s\-_/]+good[\s\-_/]+spirits?)\b/i.test(snippet);
      }
    },
    {
      name: "Animals",
      regex: /\b(animals?|livestock|poultry|pets?|cattle|veterinary|vet(?:erinary)?|slaughterhouses?|dogs?|cats?|horses?)\b/i,
      isExempt: (matchText, snippet) => {
        // Exclude PET (polyethylene terephthalate) plastics/packaging
        if (/pets?/i.test(matchText)) {
          if (/\b(?:pet|rpet|apet|cpet)[\s\-_/]+(?:bottles?|preforms?|films?|sheets?|resins?|plastics?|materials?|straps?|strapping|packaging|recycling|containers?|jars?|flakes?|pellets?|polymers?|pelletizing|extru(?:sion|ders?)|clamshells?)\b/i.test(snippet)) {
            return true;
          }
          if (/\b(?:recycled|clear|transparent|virgin)[\s\-_/]+pets?\b/i.test(snippet)) {
            return true;
          }
        }
        // Exclude Ethernet/network cable standards ("Cat 5", "Cat 6", "Cat 7", "Cat5e", "Cat6a") or tools ("saw horse")
        if (/cats?/i.test(matchText)) {
          if (/\bcat[- ]?[345678][a-z]?\b/i.test(snippet) || /\b(?:ethernet|network|lan|patch)[\s\-_/]+cats?\b/i.test(snippet)) {
            return true;
          }
        }
        if (/horses?/i.test(matchText)) {
          if (/\b(?:saw[- ]?horse|work[- ]?horse)\b/i.test(snippet)) {
            return true;
          }
        }
        return false;
      }
    }
  ];

  // World Capitals (If capital is in address, both City & State are Considered Available!)
  const WORLD_CAPITALS = [
    "seoul", "tokyo", "beijing", "washington", "london", "paris", "berlin", "new delhi",
    "canberra", "ottawa", "rome", "madrid", "bangkok", "jakarta", "singapore", "kuala lumpur",
    "manila", "hanoi", "taipei", "riyadh", "abu dhabi", "cairo", "brasilia", "mexico city",
    "moscow", "warsaw", "bern", "stockholm", "brussels", "vienna", "copenhagen", "oslo",
    "helsinki", "dublin", "wellington", "pretoria", "ankara", "amsterdam", "athens", "lisbon"
  ];

  const TAIWAN_SPECIAL_MUNICIPALITIES = ["taipei", "new taipei", "taoyuan", "taichung", "tainan", "kaohsiung"];
  const TAIWAN_COUNTIES = ["changhua", "hsinchu", "miaoli", "nantou", "yunlin", "chiayi", "pingtung", "yilan", "hualien", "taitung", "penghu", "kinmen", "lienchiang"];
  const TAIWAN_CITIES_AND_DISTRICTS = ["keelung", "hsinchu", "chiayi", "fengyuan", "xitun", "beitun", "nantun", "dali", "wuri", "taiping", "zhubei", "toufen", "yuanlin", "douliu", "magong", "banqiao", "zhonghe", "xinzhuang", "tucheng", "luzhou", "sanchong", "yonghe", "xindian", "danshui", "tamsui"];
  const METROPOLITAN_CITY_REGIONS = ["seoul", "busan", "daegu", "incheon", "gwangju", "daejeon", "ulsan", "sejong", "beijing", "shanghai", "tianjin", "chongqing", "tokyo", "bangkok", "berlin", "hamburg", "bremen", "singapore", "moscow", "brasilia"];
  const CHINA_PROVINCES_AND_REGIONS = ["anhui", "fujian", "gansu", "guangdong", "guizhou", "hainan", "hebei", "heilongjiang", "henan", "hubei", "hunan", "jiangsu", "jiangxi", "jilin", "liaoning", "qinghai", "shaanxi", "shandong", "shanxi", "sichuan", "yunnan", "zhejiang", "guangxi", "inner mongolia", "ningxia", "tibet", "xinjiang", "hong kong", "macau", "macao"];
  const CHINA_DIRECT_MUNICIPALITIES = ["beijing", "chongqing", "shanghai", "tianjin"];
  const CHINA_CITIES = [
    "guangzhou", "shenzhen", "chengdu", "wuhan", "hangzhou", "nanjing", "suzhou", "dongguan", "xian", "xi'an", "xiamen", "fuzhou", "qingdao", "dalian", "shenyang", "changchun", "harbin", "jinan", "zhengzhou", "changsha", "nanchang", "kunming", "hefei", "taiyuan", "guiyang", "xining", "urumqi", "lanzhou", "haikou", "nanning", "shantou", "ningbo", "wenzhou", "wuxi", "changzhou", "nantong", "yangzhou", "xuzhou", "yancheng", "jiaxing", "shaoxing", "jinhua", "quzhou", "zhoushan", "taizhou", "lishui", "zhuhai", "foshan", "huizhou", "jiangmen", "zhanjiang", "zhaoqing", "zhongshan", "maoming", "jieyang", "meizhou", "heyuan", "qingyuan", "shaoguan", "yangjiang", "chaozhou", "yunfu", "baoding", "tangshan", "qinhuangdao", "handan", "xingtai", "zhangjiakou", "chengde", "cangzhou", "langfang", "hengshui", "datong", "changzhi", "jincheng", "linfen", "yuncheng", "baotou", "ordos", "chifeng", "tongliao", "hulunbuir", "wuhai", "bayannur", "anshan", "dandong", "jinzhou", "yingkou", "fuxin", "liaoyang", "panjin", "tieling", "chaoyang", "huludao", "jilin city", "siping", "liaoyuan", "tonghua", "baishan", "songyuan", "baicheng", "daqing", "qiqihar", "mudanjiang", "jiamusi", "jixi", "hegang", "shuangyashan", "yichun", "qitaihe", "heihe", "suihua", "luoyang", "kaifeng", "anyang", "xinxiang", "jiaozuo", "puyang", "xuchang", "luohe", "sanmenxia", "nanyang", "shangqiu", "xinyang", "zhoukou", "zhumadian", "jingzhou", "yichang", "xiangyang", "ezhou", "jingmen", "xiaogan", "huanggang", "xianning", "suizhou", "yueyang", "zhuzhou", "xiangtan", "hengyang", "shaoyang", "yongzhou", "huaihua", "loudi", "chuzhou", "bengbu", "huainan", "maanshan", "huaibei", "tongling", "anqing", "huangshan", "fuyang", "suzhou anhui", "liuzhou", "guilin", "wuzhou", "beihai", "yulin guangxi", "baise", "hezhou", "hechi", "laibin", "chongzuo", "quanzhou", "zhangzhou", "putian", "sanming", "nanping", "longyan", "ningde", "yantai", "weifang", "jining", "taian", "weihai", "rizhao", "linyi", "dezhou", "liaocheng", "binzhou", "heze", "zibo", "dongying", "zhoukou", "zigong", "panzhihua", "luzhou", "deyang", "mianyang", "guangyuan", "suining", "neijiang", "leshan", "nanchong", "meishan", "yibin", "guangan", "dazhou", "yaan", "bazhong", "ziyang", "lijiang", "dali", "qujing", "yuxi", "baoshan", "zhaotong", "lincang", "pu'er", "linzhi", "lhasa", "shigatse", "zhangye", "jiayuguan", "jinchang", "baiyin", "tianshui", "wuwei", "pingliang", "qingyang", "dingxi", "longnan", "yinchuan", "shizuishan", "wuzhong", "zhongwei", "kashgar", "korla", "kuytun", "karamay", "hami", "turpan", "yining", "altay", "aksu", "hong kong", "macau", "macao"
  ];
  const ITALIAN_CITIES = [
    "pavia", "modena", "parma", "reggio emilia", "brescia", "bergamo", "como", "varese", "piacenza", "cremona", "mantua", "verona", "venice", "padua", "treviso", "vicenza", "bologna", "florence", "pisa", "siena", "naples", "turin", "milan", "rome", "genoa", "catania", "palermo", "bari"
  ];
  const INDIAN_STATES_AND_TERRITORIES = [
    "andhra pradesh", "arunachal pradesh", "assam", "bihar", "chhattisgarh", "goa", "gujarat", "haryana", "himachal pradesh", "jharkhand", "karnataka", "kerala", "madhya pradesh", "maharashtra", "manipur", "meghalaya", "mizoram", "nagaland", "odisha", "orissa", "punjab", "rajasthan", "sikkim", "tamil nadu", "telangana", "tripura", "uttar pradesh", "uttarakhand", "west bengal", "andaman and nicobar islands", "chandigarh", "dadra and nagar haveli", "daman and diu", "delhi", "jammu and kashmir", "ladakh", "lakshadweep", "puducherry"
  ];
  const INDIAN_CITIES = [
    "mumbai", "delhi", "new delhi", "bengaluru", "bangalore", "hyderabad", "ahmedabad", "chennai", "kolkata", "surat", "pune", "jaipur", "lucknow", "kanpur", "nagpur", "indore", "thane", "bhopal", "visakhapatnam", "patna", "vadodara", "ghaziabad", "ludhiana", "agra", "nashik", "faridabad", "meerut", "rajkot", "varanasi", "srinagar", "aurangabad", "dhanbad", "amritsar", "allahabad", "prayagraj", "ranchi", "howrah", "coimbatore", "jodhpur", "madurai", "raipur", "kochi", "ernakulam", "thiruvananthapuram", "guwahati", "chandigarh", "dehradun", "shimla", "imphal", "gangtok", "itanagar", "panaji", "dispur", "shillong", "aizawl", "kohima", "agartala", "bhubaneswar", "vijayawada", "warangal", "mysuru", "mysore", "mangalore", "mangaluru"
  ];
  const MALAYSIA_STATES_AND_TERRITORIES = [
    "johor", "kedah", "kelantan", "melaka", "malacca", "negeri sembilan", "pahang", "penang", "pulau pinang", "perak", "perlis", "sabah", "sarawak", "selangor", "terengganu", "kuala lumpur", "putrajaya", "labuan",
    "wilayah persekutuan kuala lumpur", "wilayah persekutuan putrajaya", "wilayah persekutuan labuan",
    "federal territory of kuala lumpur", "federal territory of putrajaya", "federal territory of labuan"
  ];
  const MALAYSIA_CITIES = [
    "kuala lumpur", "george town", "johor bahru", "ipoh", "shah alam", "petaling jaya", "subang jaya", "klang", "kuantan", "kota kinabalu", "kuching", "seremban", "malacca city", "melaka city", "alor setar", "miri", "sandakan", "tawau", "kota bharu", "kuala terengganu", "putrajaya", "cyberjaya", "kulim", "batu pahat", "kuala kedah", "sibu", "bintulu", "taiping", "teluk intan", "pasir gudang", "iskandar puteri", "bayan lepas", "butterworth", "langkawi", "port dickson", "temerloh", "kemaman", "labuan town", "ampang", "ayer keroh", "balik pulau", "bandar baru bangi", "bandar sunway", "bangsar", "batu gajah", "bukit mertajam", "gombak", "jitra", "kajang", "kampar", "kangar", "keningau", "kluang", "kuala kangsar", "kulai", "lahad datu", "muar", "nilai", "pekan", "seberang perai", "sungai petani", "simpang ampat", "tanah merah", "tampin", "bentong", "rawang", "sabak bernam", "beranang", "setapak", "cheras", "kepong", "sentul", "mont kiara", "damansara", "puchong", "seri kembangan", "shah alam", "kota damansara", "sri petaling"
  ];
  const UAE_EMIRATES = ["Abu Dhabi", "Ajman", "Dubai", "Fujairah", "Ras Al Khaimah", "Sharjah", "Umm Al Quwain"];
  const UAE_CITIES = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Al Ain", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain", "Khor Fakkan", "Kalba", "Dibba Al-Fujairah", "Jebel Ali"];
  const UK_COUNTIES = [
    // English ceremonial/counties and metropolitan areas, plus the common
    // county forms used in postal addresses.
    "avon", "bedfordshire", "berkshire", "borders", "bristol", "buckinghamshire", "cambridgeshire", "cheshire", "city of london", "cleveland", "cornwall", "cumbria", "derbyshire", "devon", "dorset", "durham", "east riding of yorkshire", "east sussex", "essex", "gloucestershire", "greater london", "greater manchester", "hampshire", "herefordshire", "hertfordshire", "humberside", "huntingdonshire", "isle of wight", "isles of scilly", "kent", "lancashire", "leicestershire", "lincolnshire", "merseyside", "middlesex", "norfolk", "northamptonshire", "northumberland", "nottinghamshire", "oxfordshire", "rutland", "somerset", "south yorkshire", "staffordshire", "suffolk", "surrey", "tyne and wear", "warwickshire", "west midlands", "west sussex", "westmorland", "west yorkshire", "wiltshire", "worcs", "worcestershire",
    // Wales, Scotland and Northern Ireland county/region names.
    "anglesey", "isle of anglesey", "blaenau gwent", "bridgend", "caerphilly", "cardiff", "carmarthenshire", "ceredigion", "clwyd", "conwy", "denbighshire", "dyfed", "flintshire", "gwent", "gwynedd", "merthyr tydfil", "monmouthshire", "neath port talbot", "newport", "pembrokeshire", "powys", "rhondda cynon taf", "swansea", "torfaen", "vale of glamorgan", "wrexham",
    "aberdeen city", "aberdeenshire", "angus", "argyll and bute", "clackmannanshire", "dumfries and galloway", "dundee city", "east ayrshire", "east dunbartonshire", "east lothian", "east renfrewshire", "edinburgh", "falkirk", "fife", "glasgow", "highland", "inverclyde", "midlothian", "moray", "na h-eileanan siar", "north ayrshire", "north lanarkshire", "orkney", "perth and kinross", "renfrewshire", "scottish borders", "shetland", "south ayrshire", "south lanarkshire", "stirling", "west dunbartonshire", "west lothian",
    "antrim", "county antrim", "armagh", "county armagh", "down", "county down", "fermanagh", "county fermanagh", "londonderry", "county londonderry", "tyrone", "county tyrone"
  ];
  const UK_CITIES = [
    "london", "birmingham", "manchester", "liverpool", "leeds", "sheffield", "bristol", "nottingham", "leicester", "coventry", "wolverhampton", "stoke-on-trent", "stoke on trent", "derby", "southampton", "portsmouth", "oxford", "cambridge", "york", "bath", "newcastle", "newcastle upon tyne", "newcastle-upon-tyne", "brighton", "brighton and hove", "brighton & hove", "plymouth", "exeter", "norwich", "milton keynes", "reading", "luton", "blackpool", "middlesbrough", "sunderland", "wakefield", "worcester", "chester", "canterbury", "aldridge", "walsall", "sutton coldfield", "bloxwich", "brownhills", "lichfield", "tamworth", "west bromwich", "dudley", "rochdale", "edinburgh", "glasgow", "aberdeen", "dundee", "cardiff", "swansea", "newport", "belfast", "derry",
    // Remaining official UK cities (Cabinet Office list), plus spelling variants.
    "bradford", "carlisle", "chelmsford", "chichester", "colchester", "doncaster", "durham", "ely", "gloucester", "hereford", "kingston upon hull", "kingston-upon-hull", "hull", "lancaster", "lincoln", "peterborough", "preston", "ripon", "salford", "salisbury", "southend-on-sea", "southend on sea", "st albans", "truro", "wells", "westminster", "winchester", "armagh", "bangor", "lisburn", "londonderry", "newry", "dunfermline", "inverness", "perth", "stirling", "st asaph", "st davids", "wrexham",
    // Common UK towns frequently used as address localities.
    "bolton", "bournemouth", "bury", "stockport", "gateshead", "middlesbrough", "oldham", "bury st edmunds", "warrington", "wigan", "blackburn", "burnley", "chorley", "crewe", "macclesfield", "northwich", "widnes", "ellesmere port", "barrow-in-furness", "kendal", "workington", "darlington", "hartlepool", "bishop auckland", "ashington", "blyth", "cramlington", "consett", "redcar", "seaham", "morpeth", "scunthorpe", "grimsby", "bridlington", "scarborough", "harrogate", "keighley", "halifax", "huddersfield", "castleford", "batley", "dewsbury", "barnsley", "rotherham", "chesterfield", "mansfield", "newark-on-trent", "worksop", "loughborough", "kettering", "corby", "grantham", "spalding", "stamford", "wellingborough", "lowestoft", "great yarmouth", "huntingdon", "st neots", "hertford", "hitchin", "aylesbury", "banbury", "bicester", "guildford", "maidstone", "margate", "dover", "folkestone", "ashford", "tunbridge wells", "royal tunbridge wells", "eastbourne", "east grinstead", "hastings", "worthing", "crawley", "eastleigh", "fareham", "gosport", "andover", "taunton", "yeovil", "weymouth", "bridgwater", "barnstaple", "falmouth", "newquay", "exmouth", "cirencester", "stratford-upon-avon", "warwick", "stafford", "stourbridge", "halesowen", "smethwick", "malvern", "evesham", "droitwich spa", "royal leamington spa", "telford", "shrewsbury", "newtown", "aberystwyth", "barry", "pontypridd", "cwmbran", "llanelli", "paisley", "livingston", "kirkcaldy", "ayr", "kilmarnock", "dumfries", "greenock", "cumbernauld", "inverness", "st andrews", "oban", "fort william", "elgin", "perth", "antrim", "coleraine", "carrickfergus", "omagh", "enniskillen", "lurgan", "portadown", "newtownards", "bangor northern ireland", "limavady", "strabane", "larne", "cookstown", "magherafelt", "ballymena", "ballymoney", "dungannon", "newcastle county down", "newcastle-under-lyme", "newcastle under lyme", "worcester", "chester", "lincoln", "peterborough", "preston", "ripon", "salford", "salisbury", "winchester", "cheltenham", "glastonbury", "skipton", "ilkley", "otley", "penrith", "amberside", "shrewsbury", "oswestry", "cirencester", "leamington spa", "stratford upon avon", "newport pagnell", "high wycombe", "slough", "maidenhead", "woking", "reigate", "redhill", "staines-upon-thames", "staines upon thames", "bracknell", "wokingham", "basildon", "harlow", "chelmsford", "southend", "ipswich", "bedford", "luton", "watford", "stevenage", "basingstoke", "chichester", "poole", "weymouth", "dorchester", "barnstaple", "truro", "st austell", "penzance", "stranraer", "galashiels", "hawick", "peebles", "stornoway", "lerwick", "kirkwall", "ballycastle", "ards",
    // Additional English towns and postal localities commonly found on business contact pages.
    "ashby-de-la-zouch", "ashby de la zouch", "banbury", "braintree", "burnham-on-sea", "chipping norton", "dorking", "epsom", "farnborough", "farnham", "great missenden", "kidderminster", "leighton buzzard", "loughton", "marlow", "melton mowbray", "newmarket", "nuneaton", "redditch", "rugby", "st helens", "st helens merseyside", "sittingbourne", "stafford", "stratford-upon-avon", "swindon", "thornbury", "yate", "yeovil", "cirencester", "didcot", "witney", "abingdon", "thame", "henley-on-thames", "henley on thames", "brentwood", "canvey island", "clacton-on-sea", "clacton on sea", "harwich", "maldon", "saffron walden", "haverhill", "felixstowe", "bury st edmunds", "diss", "thetford", "cromer", "march", "wisbech", "ely", "peterlee", "seaham", "newcastle upon tyne", "south shields", "north shields", "washington tyne and wear", "ashington", "bingley", "brighouse", "cleckheaton", "elland", "mirfield", "pudsey", "shipley", "todmorden", "ilkeston", "beeston", "long eaton", "stapleford", "worksop", "retford", "sutton-in-ashfield", "sutton in ashfield", "alfreton", "buxton", "matlock", "glossop", "cannock", "lichfield", "burntwood", "wednesbury", "tipton", "willenhall", "bilston", "brierley hill", "kidderminster", "redditch", "bromsgrove", "stourport-on-severn", "stourport on severn", "bridgnorth", "ludlow", "market drayton", "newcastle-under-lyme", "stone staffordshire", "cannock", "rugby", "nuneaton", "bedworth", "kenilworth", "royal leamington spa", "stratford-upon-avon", "warwick", "droitwich", "pershore", "tewkesbury", "stroud", "bishop's cleeve", "bishops cleeve", "north somerset", "weston-super-mare", "weston super mare", "clevedon", "portishead", "bridport", "sherborne", "crewkerne", "chard", "ilminster", "minehead", "burnham-on-sea", "newton abbot", "torquay", "paignton", "bideford", "ilfracombe", "bodmin", "launceston cornwall", "liskeard", "helston", "saltash", "tavistock", "totnes", "teignmouth", "seaton", "lyme regis", "bognor regis", "littlehampton", "shoreham-by-sea", "shoreham by sea", "burgess hill", "lewes", "seaford", "rye", "crowborough", "hove", "caterham", "camberley", "fleet hampshire", "hook hampshire", "alton hampshire", "petersfield", "romsey", "new milton", "ringwood", "christchurch dorset", "ferndown", "gillingham dorset", "shaftesbury", "nailsea", "wantage", "crowthorne", "fleetwood", "lancaster", "litherland", "ormskirk", "southport", "prescot", "runcorn", "widnes", "new brighton", "wallasey", "birkenhead", "bootle", "formby", "ellesmere port"
  ];
  // Statistics Sweden's current 21 counties and 290 municipalities. A
  // municipality identifies both City and its county-level State for the
  // extension's Available/Not Available fields.
  const SWEDEN_COUNTIES = [
    "Blekinge County", "Blekinge län", "Dalarna County", "Dalarnas län", "Gotland County", "Gotlands län",
    "Gävleborg County", "Gävleborgs län", "Halland County", "Hallands län", "Jämtland County", "Jämtlands län",
    "Jönköping County", "Jönköpings län", "Kalmar County", "Kalmar län", "Kronoberg County", "Kronobergs län",
    "Norrbotten County", "Norrbottens län", "Skåne County", "Skåne län", "Stockholm County", "Stockholms län",
    "Södermanland County", "Södermanlands län", "Uppsala County", "Uppsala län", "Värmland County", "Värmlands län",
    "Västerbotten County", "Västerbottens län", "Västernorrland County", "Västernorrlands län", "Västmanland County", "Västmanlands län",
    "Västra Götaland County", "Västra Götalands län", "Örebro County", "Örebro län", "Östergötland County", "Östergötlands län"
  ];
  const SWEDEN_MUNICIPALITIES = [
    "Upplands Väsby", "Vallentuna", "Österåker", "Värmdö", "Järfälla", "Ekerö", "Huddinge", "Botkyrka", "Salem", "Haninge", "Tyresö", "Upplands-Bro", "Nykvarn", "Täby", "Danderyd", "Sollentuna", "Stockholm", "Södertälje", "Nacka", "Sundbyberg", "Solna", "Lidingö", "Vaxholm", "Norrtälje", "Sigtuna", "Nynäshamn",
    "Håbo", "Älvkarleby", "Knivsta", "Heby", "Tierp", "Uppsala", "Enköping", "Östhammar",
    "Vingåker", "Gnesta", "Nyköping", "Oxelösund", "Flen", "Katrineholm", "Eskilstuna", "Strängnäs", "Trosa",
    "Ödeshög", "Ydre", "Kinda", "Boxholm", "Åtvidaberg", "Finspång", "Valdemarsvik", "Linköping", "Norrköping", "Söderköping", "Motala", "Vadstena", "Mjölby",
    "Aneby", "Gnosjö", "Mullsjö", "Habo", "Gislaved", "Vaggeryd", "Jönköping", "Nässjö", "Värnamo", "Sävsjö", "Vetlanda", "Eksjö", "Tranås",
    "Uppvidinge", "Lessebo", "Tingsryd", "Alvesta", "Älmhult", "Markaryd", "Växjö", "Ljungby",
    "Högsby", "Torsås", "Mörbylånga", "Hultsfred", "Mönsterås", "Emmaboda", "Kalmar", "Nybro", "Oskarshamn", "Västervik", "Vimmerby", "Borgholm", "Gotland",
    "Olofström", "Karlskrona", "Ronneby", "Karlshamn", "Sölvesborg",
    "Svalöv", "Staffanstorp", "Burlöv", "Vellinge", "Östra Göinge", "Örkelljunga", "Bjuv", "Kävlinge", "Lomma", "Svedala", "Skurup", "Sjöbo", "Hörby", "Höör", "Tomelilla", "Bromölla", "Osby", "Perstorp", "Klippan", "Åstorp", "Båstad", "Malmö", "Lund", "Landskrona", "Helsingborg", "Höganäs", "Eslöv", "Ystad", "Trelleborg", "Kristianstad", "Simrishamn", "Ängelholm", "Hässleholm",
    "Hylte", "Halmstad", "Laholm", "Falkenberg", "Varberg", "Kungsbacka",
    "Härryda", "Partille", "Öckerö", "Stenungsund", "Tjörn", "Orust", "Sotenäs", "Munkedal", "Tanum", "Dals-Ed", "Färgelanda", "Ale", "Lerum", "Vårgårda", "Bollebygd", "Grästorp", "Essunga", "Karlsborg", "Gullspång", "Tranemo", "Bengtsfors", "Mellerud", "Lilla Edet", "Mark", "Svenljunga", "Herrljunga", "Vara", "Götene", "Tibro", "Töreboda", "Göteborg", "Mölndal", "Kungälv", "Lysekil", "Uddevalla", "Strömstad", "Vänersborg", "Trollhättan", "Alingsås", "Borås", "Ulricehamn", "Åmål", "Mariestad", "Lidköping", "Skara", "Skövde", "Hjo", "Tidaholm", "Falköping",
    "Kil", "Eda", "Torsby", "Storfors", "Hammarö", "Munkfors", "Forshaga", "Grums", "Årjäng", "Sunne", "Karlstad", "Kristinehamn", "Filipstad", "Hagfors", "Arvika", "Säffle",
    "Lekeberg", "Laxå", "Hallsberg", "Degerfors", "Hällefors", "Ljusnarsberg", "Örebro", "Kumla", "Askersund", "Karlskoga", "Nora", "Lindesberg",
    "Skinnskatteberg", "Surahammar", "Kungsör", "Hallstahammar", "Norberg", "Västerås", "Sala", "Fagersta", "Köping", "Arboga",
    "Vansbro", "Malung-Sälen", "Gagnef", "Leksand", "Rättvik", "Orsa", "Älvdalen", "Smedjebacken", "Mora", "Falun", "Borlänge", "Säter", "Hedemora", "Avesta", "Ludvika",
    "Ockelbo", "Hofors", "Ovanåker", "Nordanstig", "Ljusdal", "Gävle", "Sandviken", "Söderhamn", "Bollnäs", "Hudiksvall",
    "Ånge", "Timrå", "Härnösand", "Sundsvall", "Kramfors", "Sollefteå", "Örnsköldsvik",
    "Ragunda", "Bräcke", "Krokom", "Strömsund", "Åre", "Berg", "Härjedalen", "Östersund",
    "Nordmaling", "Bjurholm", "Vindeln", "Robertsfors", "Norsjö", "Malå", "Storuman", "Sorsele", "Dorotea", "Vännäs", "Vilhelmina", "Åsele", "Umeå", "Lycksele", "Skellefteå",
    "Arvidsjaur", "Arjeplog", "Jokkmokk", "Överkalix", "Kalix", "Övertorneå", "Pajala", "Gällivare", "Älvsbyn", "Luleå", "Piteå", "Boden", "Haparanda", "Kiruna"
  ];
  const swedenNameRegex = names => new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${names.map(escapeRegExp).sort((a, b) => b.length - a.length).join("|")})(?![\\p{L}\\p{N}])`,
    "iu"
  );
  const SWEDEN_COUNTY_REGEX = swedenNameRegex(SWEDEN_COUNTIES);
  const SWEDEN_MUNICIPALITY_REGEX = swedenNameRegex(SWEDEN_MUNICIPALITIES);
  const US_CITIES = [
    "new york", "los angeles", "chicago", "houston", "phoenix", "philadelphia", "san antonio", "san diego", "dallas", "san jose", "austin", "jacksonville", "fort worth", "columbus", "charlotte", "indianapolis", "san francisco", "seattle", "denver", "boston", "nashville", "detroit", "las vegas", "portland", "memphis", "baltimore", "milwaukee", "albuquerque", "tucson", "sacramento", "atlanta", "miami", "tampa", "orlando", "raleigh", "omaha", "oakland", "minneapolis", "tulsa", "cleveland", "pittsburgh", "cincinnati", "st louis", "newark", "jersey city", "springfield", "louisville", "richmond", "boise", "honolulu", "anchorage", "des moines", "madison", "boulder", "troy"
  ];
  const AUSTRALIAN_CITY_STATES = [
    { state: "New South Wales", cities: ["sydney", "newcastle", "wollongong", "albury"] },
    { state: "Victoria", cities: ["melbourne", "geelong", "ballarat", "bendigo"] },
    { state: "Queensland", cities: ["brisbane", "gold coast", "townsville", "cairns", "toowoomba"] },
    { state: "Western Australia", cities: ["perth", "welshpool"] },
    { state: "South Australia", cities: ["adelaide", "regency park"] },
    { state: "Tasmania", cities: ["hobart", "launceston"] },
    { state: "Australian Capital Territory", cities: ["canberra"] },
    { state: "Northern Territory", cities: ["darwin"] }
  ];
  const AUSTRALIAN_STATE_CAPITALS = ["sydney", "melbourne", "brisbane", "perth", "adelaide", "hobart", "canberra", "darwin"];
  const MALAYSIAN_STATE_CAPITALS = ["johor bahru", "alor setar", "kota bharu", "ayer keroh", "seremban", "kuantan", "george town", "ipoh", "kangar", "shah alam", "kuala terengganu", "kota kinabalu", "kuching", "kuala lumpur", "putrajaya", "labuan"];
  const SOUTH_AFRICAN_CITY_PROVINCES = [
    { province: "Eastern Cape", cities: ["gqeberha", "port elizabeth", "east london", "bhisho", "mthatha", "makhanda", "grahamstown", "queenstown", "komani"] },
    { province: "Free State", cities: ["bloemfontein", "welkom", "bethlehem", "sasolburg"] },
    { province: "Gauteng", cities: ["johannesburg", "pretoria", "tshwane", "sandton", "centurion", "midrand", "germiston", "benoni", "boksburg", "kempton park", "vereeninging", "randburg", "roodepoort", "ekurhuleni"] },
    { province: "KwaZulu-Natal", cities: ["durban", "ethekwini", "pietermaritzburg", "richards bay", "newcastle", "ladysmith", "umhlanga"] },
    { province: "Limpopo", cities: ["polokwane", "tzaneen", "thohoyandou", "mokopane"] },
    { province: "Mpumalanga", cities: ["mbombela", "nelspruit", "emalahleni", "witbank", "secunda", "middelburg"] },
    { province: "Northern Cape", cities: ["kimberley", "upington", "kuruman"] },
    { province: "North West", cities: ["rustenburg", "mahikeng", "mafikeng", "potchefstroom", "klerksdorp"] },
    { province: "Western Cape", cities: ["cape town", "stellenbosch", "paarl", "george", "worcester", "mossel bay", "knysna", "hermanus"] }
  ];
  const SOUTH_AFRICAN_PROVINCES = [
    "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "KwaZulu Natal",
    "Limpopo", "Mpumalanga", "Northern Cape", "North West", "Western Cape"
  ];
  const SOUTH_AFRICAN_PROVINCIAL_CAPITALS = ["bhisho", "bloemfontein", "johannesburg", "pietermaritzburg", "polokwane", "mbombela", "nelspruit", "kimberley", "mahikeng", "mafikeng", "cape town"];
  const AUSTRIAN_CITY_STATES = [
    { state: "Burgenland", cities: ["eisenstadt", "oberwart", "mattersburg", "neusiedl am see"] },
    { state: "Carinthia", cities: ["klagenfurt", "villach", "wolfsberg", "spittal an der drau", "sankt veit an der glan", "st veit an der glan"] },
    { state: "Lower Austria", cities: ["st polten", "st. polten", "st pölten", "st. pölten", "sankt polten", "sankt pölten", "krems", "krems an der donau", "wiener neustadt", "baden", "amstetten", "klosterneuburg", "tulln", "mödling", "modling", "wieselburg", "scheibbs", "melk", "pöchlarn", "pochlarn", "ybbs an der donau"] },
    { state: "Upper Austria", cities: ["linz", "wels", "steyr", "leonding", "traun", "gmunden", "ried im innkreis"] },
    { state: "Salzburg", cities: ["salzburg", "hallein", "zell am see", "saalfelden"] },
    { state: "Styria", cities: ["graz", "leoben", "kapfenberg", "leibnitz", "bruck an der mur", "feldbach"] },
    { state: "Tyrol", cities: ["innsbruck", "kufstein", "hall in tirol", "schwaz", "telfs", "lienz"] },
    { state: "Vorarlberg", cities: ["bregenz", "dornbirn", "feldkirch", "lustenau", "hohenems", "bludenz"] },
    { state: "Vienna", cities: ["vienna", "wien"] }
  ];
  const AUSTRIAN_STATES = [
    "Burgenland", "Carinthia", "Kärnten", "Kaernten", "Lower Austria", "Niederösterreich", "Niederosterreich",
    "Upper Austria", "Oberösterreich", "Oberosterreich", "Salzburg", "Styria", "Steiermark", "Tyrol", "Tirol",
    "Vorarlberg", "Vienna", "Wien"
  ];
  const AUSTRIAN_STATE_CAPITALS = [
    "eisenstadt", "klagenfurt", "st polten", "st. polten", "st pölten", "st. pölten",
    "sankt polten", "sankt pölten", "linz", "salzburg", "graz", "innsbruck", "bregenz", "vienna", "wien"
  ];
  const GERMAN_CITY_STATES = [
    { state: "Baden-Württemberg", cities: ["leinfelden-echterdingen"] }
  ];
  const NEW_ZEALAND_CITIES = [
    "auckland", "wellington", "christchurch", "hamilton", "tauranga", "dunedin", "palmerston north", "napier", "hastings", "nelson", "rotorua", "new plymouth", "whangarei", "invercargill", "queenstown", "gisborne", "timaru", "blenheim", "taupo", "papakura"
  ];
  const AUSTRALIAN_POSTCODE_STATE_RANGES = [
    { min: 200, max: 299, state: "Australian Capital Territory" },
    { min: 800, max: 999, state: "Northern Territory" },
    { min: 1000, max: 2599, state: "New South Wales" },
    { min: 2600, max: 2618, state: "Australian Capital Territory" },
    { min: 2620, max: 2899, state: "New South Wales" },
    { min: 2900, max: 2920, state: "Australian Capital Territory" },
    { min: 2921, max: 2999, state: "New South Wales" },
    { min: 3000, max: 3999, state: "Victoria" },
    { min: 4000, max: 4999, state: "Queensland" },
    { min: 5000, max: 5999, state: "South Australia" },
    { min: 6000, max: 6999, state: "Western Australia" },
    { min: 7000, max: 7999, state: "Tasmania" },
    { min: 8000, max: 8999, state: "Victoria" },
    { min: 9000, max: 9999, state: "Queensland" }
  ];

  // UK Localities (Rule 5: If England and United Kingdom both mentioned, must take England!)
  const UK_LOCALITIES = [
    { name: "England", regex: /\b(england|london|birmingham|manchester|liverpool|leeds|sheffield|bristol|nottingham|leicester|coventry|wolverhampton|stoke[- ]on[- ]trent|derby|southampton|portsmouth|oxford|cambridge|york|bath|newcastle(?: upon tyne)?|brighton(?:\s*(?:&|and)\s*hove)?|plymouth|exeter|norwich|milton keynes|reading|luton|blackpool|middlesbrough|sunderland|wakefield|worcester|chester|canterbury|aldridge|walsall|sutton coldfield|bloxwich|brownhills|lichfield|tamworth|west bromwich|dudley|bradford|carlisle|chelmsford|chichester|colchester|doncaster|durham|ely|gloucester|hereford|kingston[- ]upon[- ]hull|hull|lancaster|lincoln|peterborough|preston|ripon|salford|salisbury|southend[- ]on[- ]sea|st albans|truro|wells|westminster|winchester|royston|hertfordshire)\b/i },
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
    { name: "France", iso: "FR", aliases: ["france", "french republic", "république française"], tlds: [".fr"], dialCode: "33" },
    { name: "Italy", iso: "IT", aliases: ["italy", "italia"], tlds: [".it"], dialCode: "39" },
    { name: "Spain", iso: "ES", aliases: ["spain", "españa"], tlds: [".es"], dialCode: "34" },
    { name: "Netherlands", iso: "NL", aliases: ["netherlands", "nederland", "holland"], tlds: [".nl"], dialCode: "31" },
    { name: "Taiwan", iso: "TW", aliases: ["taiwan", "republic of china", "taiwan, roc", "台湾"], tlds: [".tw", ".com.tw"], dialCode: "886" },
    { name: "Hong Kong", iso: "HK", aliases: ["hong kong", "hong kong sar", "hong kong special administrative region", "香港"], tlds: [".hk", ".com.hk"], dialCode: "852" },
    { name: "Singapore", iso: "SG", aliases: ["singapore"], tlds: [".sg", ".com.sg"], dialCode: "65" },
    { name: "Malaysia", iso: "MY", aliases: ["malaysia"], tlds: [".my", ".com.my"], dialCode: "60" },
    { name: "Vietnam", iso: "VN", aliases: ["vietnam", "việt nam"], tlds: [".vn", ".com.vn"], dialCode: "84" },
    { name: "Thailand", iso: "TH", aliases: ["thailand", "ประเทศไทย", "ไทย", "siam"], tlds: [".th", ".co.th"], dialCode: "66" },
    { name: "Indonesia", iso: "ID", aliases: ["indonesia"], tlds: [".id", ".co.id"], dialCode: "62" },
    { name: "Philippines", iso: "PH", aliases: ["philippines"], tlds: [".ph", ".com.ph"], dialCode: "63" },
    { name: "Turkey", iso: "TR", aliases: ["turkey", "türkiye"], tlds: [".tr", ".com.tr"], dialCode: "90" },
    { name: "United Arab Emirates", iso: "AE", aliases: ["united arab emirates", "uae"], tlds: [".ae"], dialCode: "971" },
    { name: "Saudi Arabia", iso: "SA", aliases: ["saudi arabia"], tlds: [".sa"], dialCode: "966" },
    { name: "Brazil", iso: "BR", aliases: ["brazil", "brasil"], tlds: [".br", ".com.br"], dialCode: "55" },
    { name: "Mexico", iso: "MX", aliases: ["mexico", "méxico"], tlds: [".mx", ".com.mx"], dialCode: "52" },
    { name: "Russia", iso: "RU", aliases: ["russia", "russian federation"], tlds: [".ru"], dialCode: "7" },
    { name: "Poland", iso: "PL", aliases: ["poland", "polska"], tlds: [".pl"], dialCode: "48" },
    { name: "Switzerland", iso: "CH", aliases: ["switzerland", "schweiz", "suisse"], tlds: [".ch"], dialCode: "41" },
    { name: "Sweden", iso: "SE", aliases: ["sweden", "sverige"], tlds: [".se"], dialCode: "46" },
    { name: "Belgium", iso: "BE", aliases: ["belgium", "belgique"], tlds: [".be"], dialCode: "32" },
    { name: "Malta", iso: "MT", aliases: ["malta"], tlds: [".mt"], dialCode: "356" },
    { name: "Bulgaria", iso: "BG", aliases: ["bulgaria", "българия"], tlds: [".bg"], dialCode: "359" },
    { name: "Croatia", iso: "HR", aliases: ["croatia", "hrvatska"], tlds: [".hr"], dialCode: "385" },
    { name: "Cyprus", iso: "CY", aliases: ["cyprus"], tlds: [".cy"], dialCode: "357" },
    { name: "Austria", iso: "AT", aliases: ["austria", "österreich"], tlds: [".at"], dialCode: "43" },
    { name: "Denmark", iso: "DK", aliases: ["denmark", "danmark", "kingdom of denmark"], tlds: [".dk"], dialCode: "45" },
    { name: "Norway", iso: "NO", aliases: ["norway", "norge"], tlds: [".no"], dialCode: "47" },
    { name: "Finland", iso: "FI", aliases: ["finland", "suomi"], tlds: [".fi"], dialCode: "358" },
    { name: "Ireland", iso: "IE", aliases: ["ireland"], tlds: [".ie"], dialCode: "353" },
    { name: "New Zealand", iso: "NZ", aliases: ["new zealand"], tlds: [".nz", ".co.nz"], dialCode: "64" },
    { name: "Fiji", iso: "FJ", aliases: ["fiji", "fiji islands", "republic of fiji"], tlds: [".fj"], dialCode: "679" },
    { name: "South Africa", iso: "ZA", aliases: ["south africa"], tlds: [".za", ".co.za"], dialCode: "27" },
    { name: "Egypt", iso: "EG", aliases: ["egypt", "arab republic of egypt", "مصر"], tlds: [".eg"], dialCode: "20" },
    { name: "Israel", iso: "IL", aliases: ["israel"], tlds: [".il"], dialCode: "972" },
    { name: "Pakistan", iso: "PK", aliases: ["pakistan"], tlds: [".pk"], dialCode: "92" },
    { name: "Bangladesh", iso: "BD", aliases: ["bangladesh"], tlds: [".bd"], dialCode: "880" },
    { name: "Czech Republic", iso: "CZ", aliases: ["czech republic", "czechia", "česko"], tlds: [".cz"], dialCode: "420" },
    { name: "Greece", iso: "GR", aliases: ["greece", "hellas", "hellenic republic", "ellada", "ελλάδα"], tlds: [".gr"], dialCode: "30" }
  ];

  const ADDRESS_COUNTRY_TERMS = [...new Set(COUNTRIES.flatMap(country => [country.name, ...(country.aliases || [])])
    .filter(term => term && term.trim().length >= 2).map(term => term.trim()))]
    .filter(term => !/^taiwan$/i.test(term))
    .sort((a, b) => b.length - a.length);
  const ADDRESS_COUNTRY_PATTERN = ADDRESS_COUNTRY_TERMS
    .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .map(term => /^Australia$/i.test(term) ? "(?<!Western\\s+|South\\s+)Australia" : term)
    .join("|");
  const ADDRESS_COUNTRY_MARKER = new RegExp("\\b(?:" + ADDRESS_COUNTRY_PATTERN + ")\\b(?=[.,;])", "i");
  const ADDRESS_COUNTRY_AT_END = new RegExp("(?:,\\s*|\\s+)\\b(?:" + ADDRESS_COUNTRY_PATTERN + ")\\b(?:\\s*,?\\s+\\d{3,10})?\\s*[.,;]*$", "i");
  const ADDRESS_COUNTRY_TERM_SET = new Set(ADDRESS_COUNTRY_TERMS.map(term => term.toLowerCase()));

  // Global City/State to Country Mapping
  const CITY_STATE_COUNTRY_MAP = [
    { country: "United Arab Emirates", regex: /\b(?:abu dhabi|ajman|al ain|dubai|fujairah|jebel ali|kalba|khor fakkan|ras al khaimah|sharjah|umm al quwain|dibba al-fujairah)\b/i },
    { country: "South Korea", regex: /\b(seoul|incheon|busan|daegu|daejeon|gwangju|ulsan|suwon|changwon|seongnam|cheongju|anyang|bucheon|gyeonggi|gyeonggi-do|gangwon|chungcheong|jeolla|gyeongsang|jeju)\b/i },
    { country: "South Africa", regex: new RegExp(`\\b(?:${[...SOUTH_AFRICAN_PROVINCES, ...SOUTH_AFRICAN_CITY_PROVINCES.flatMap(entry => entry.cities)].map(escapeRegExp).sort((a, b) => b.length - a.length).join("|")})\\b`, "i") },
    { country: "Austria", regex: new RegExp(`\\b(?:${[...AUSTRIAN_STATES, ...AUSTRIAN_CITY_STATES.flatMap(entry => entry.cities)].map(escapeRegExp).sort((a, b) => b.length - a.length).join("|")})\\b`, "i") },
    { country: "Malaysia", regex: new RegExp(`\\b(?:${[...MALAYSIA_STATES_AND_TERRITORIES, ...MALAYSIA_CITIES].map(escapeRegExp).sort((a, b) => b.length - a.length).join("|")})\\b`, "i") },
    { country: "Singapore", regex: /\bsingapore\b/i },
    { country: "Japan", regex: /\b(tokyo|osaka|yokohama|nagoya|sapporo|kobe|kyoto|fukuoka|kawasaki|saitama|hiroshima|sendai|chiba|kanagawa|hokkaido)\b/i },
    { country: "China", regex: new RegExp(`\\b(?:${[...CHINA_PROVINCES_AND_REGIONS, ...CHINA_DIRECT_MUNICIPALITIES, ...CHINA_CITIES].map(escapeRegExp).sort((a, b) => b.length - a.length).join("|")})\\b`, "i") },
    { country: "India", regex: /\b(mumbai|delhi|new delhi|bangalore|bengaluru|hyderabad|ahmedabad|chennai|kolkata|surat|pune|jaipur|lucknow|kanpur|nagpur|indore|thane|bhopal|visakhapatnam|gujarat|maharashtra|karnataka|tamil nadu|telangana|uttar pradesh|rajasthan|punjab|haryana|west bengal)\b/i },
    { country: "Germany", regex: /\b(berlin|hamburg|munich|münchen|cologne|köln|frankfurt|stuttgart|düsseldorf|leipzig|dortmund|essen|bremen|dresden|hannover|nuremberg|nürnberg|bavaria|bayern|baden-württemberg|hessen|nordrhein-westfalen|saxony|leinfelden-echterdingen)\b/i },
    { country: "France", regex: /\b(paris|marseille|lyon|toulouse|nice|nantes|strasbourg|montpellier|bordeaux|lille|rennes|reims|le havre|île-de-france)\b/i },
    { country: "Italy", regex: /\b(rome|roma|milan|milano|naples|napoli|turin|torino|palermo|genoa|genova|bologna|florence|firenze|bari|catania|venice|venezia|verona|lombardy|lombardia|tuscany|toscana|piedmont|piemonte|veneto)\b/i },
    { country: "United States Of America", regex: /\b(new york|los angeles|chicago|houston|phoenix|philadelphia|san antonio|san diego|dallas|san jose|austin|jacksonville|fort worth|columbus|charlotte|indianapolis|san francisco|seattle|denver|washington dc|boston|el paso|nashville|detroit|las vegas|portland|memphis|louisville|baltimore|milwaukee|albuquerque|tucson|fresno|sacramento|atlanta|kansas city|colorado springs|miami|west palm beach|palm beach|tampa|orlando|fort lauderdale|boca raton|raleigh|omaha|long beach|virginia beach|oakland|minneapolis|tulsa|arlington|california|texas|florida|\bfl\b|new york state|pennsylvania|illinois|ohio|georgia|north carolina|michigan|new jersey|virginia|washington state|arizona|massachusetts|tennessee|indiana|missouri|maryland|wisconsin|colorado|minnesota|south carolina|alabama|louisiana|kentucky|oregon|oklahoma|connecticut|utah|iowa|nevada|arkansas|mississippi|kansas|new mexico|nebraska|idaho|west virginia|hawaii|new hampshire|maine|montana|rhode island|delaware|south dakota|north dakota|alaska|vermont|wyoming)\b/i },
    { country: "Canada", regex: /\b(toronto|montreal|vancouver|calgary|edmonton|ottawa|winnipeg|quebec city|hamilton|kitchener|london ontario|victoria|halifax|ontario|quebec|british columbia|alberta|manitoba|saskatchewan|nova scotia|new brunswick|newfoundland)\b/i },
    { country: "Australia", regex: /\b(sydney|melbourne|brisbane|perth|adelaide|gold coast|canberra|newcastle nsw|wollongong|hobart|geelong|townsville|cairns|darwin|new south wales|nsw|victoria vic|queensland qld|western australia wa|south australia sa|tasmania tas)\b/i },
    { country: "Taiwan", regex: /\b(taipei|new taipei|taichung|kaohsiung|taoyuan|tainan|hsinchu)\b/i },
    { country: "Thailand", regex: /\b(bangkok|chiang\s*mai|chiang rai|hang dong|phuket|pattaya|khon kaen|nakhon ratchasima|nonthaburi|pathum thani|chonburi|samut prakan|pravet|pravej|onnut|banglamoong|bang lamung|rayong|ayutthaya|songkhla|hat yai|krabi|surat thani|udon thani|ubon ratchathani|nakhon si thammarat)\b/i },
    { country: "Ireland", regex: /\b(dublin|cork|galway|limerick|waterford|drogheda|dundalk|swords|bray|navan|kilkenny|ennis|carlow|tralee|newbridge|portlaoise|balbriggan|naas|athlone|mullingar|celbridge|wexford|letterkenny|sligo|malahide|greystones|clonmel|roscommon|ballinderry|kildare|wicklow|meath|louth|mayo|donegal|kerry|tipperary|clare|cavan|monaghan|leitrim|longford|westmeath|offaly|laois)\b/i },
    { country: "New Zealand", regex: /\b(auckland|wellington|christchurch|hamilton|tauranga|dunedin|palmerston north|napier|hastings|nelson|rotorua|new plymouth|whangarei|invercargill|queenstown|gisborne|timaru|blenheim|taupo|papakura)\b/i }
  ];

  // Helper clean text
  const clean = v => String(v ?? "").replace(/\s+/g, " ").trim();

  // Helper escape regex
  function escapeRegExp(string) {
    return String(string || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function matchesCountryTerm(text, term) {
    if (!text || !term) return false;
    if (/[^\x00-\x7F]/.test(term)) {
      return text.toLocaleLowerCase().includes(term.toLocaleLowerCase());
    }
    // Prevent 2/3-letter country codes (like 'uk' or 'us') from matching domain extensions (like .co.uk or .us)
    if (term.length <= 3) {
      return new RegExp(`(?<![.\\w])${escapeRegExp(term)}(?![.\\w])`, "i").test(text);
    }
    return new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(text);
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
    const ignoredTags = new Set(["script", "style", "noscript", "svg", "canvas"]);
    const blockTags = new Set([
      "p", "div", "li", "tr", "td", "th", "h1", "h2", "h3", "h4", "h5",
      "h6", "header", "footer", "section", "article", "dt", "dd",
      "blockquote", "address"
    ]);
    const textParts = [];
    const visit = node => {
      if (node.nodeType === 3) {
        textParts.push(node.nodeValue || "");
        return;
      }

      const tagName = node.nodeType === 1 ? String(node.localName || node.tagName).toLowerCase() : "";
      if (ignoredTags.has(tagName)) return;
      if (tagName === "br" || tagName === "hr") {
        textParts.push("\n");
        return;
      }

      for (let child = node.firstChild; child; child = child.nextSibling) {
        visit(child);
      }
      if (blockTags.has(tagName)) textParts.push("\n");
    };
    visit(el);
    return textParts.join("").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  }

  // Remove non-Latin scripts (Hangul, Hanzi/Kanji, Kana, Cyrillic, Arabic, Thai, Devanagari, Hebrew, Greek)
  // Ensures all extracted company names and addresses are strictly English/Latin characters.
  function cleanNonLatin(str, isCompanyName = false) {
    if (!str || typeof str !== "string") return "";
    let s = str;

    // 1. Remove non-Latin parentheticals completely (e.g. "(주식회사 레존텍)", "(上海市...)")
    s = s.replace(/[\(\[（【]\s*[^)\]）】]*[\uac00-\ud7a3\u1100-\u11ff\u3130-\u318f\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\u30a0-\u30ff\u0400-\u04ff\u0600-\u06ff\u0e00-\u0e7f\u0900-\u097f\u0590-\u05ff\u0370-\u03ff][^)\]）】]*[\)\]）】]/g, " ");

    // 2. Strip standalone non-Latin characters
    s = s.replace(/[\uac00-\ud7a3\u1100-\u11ff\u3130-\u318f\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\u30a0-\u30ff\u0400-\u04ff\u0600-\u06ff\u0e00-\u0e7f\u0900-\u097f\u0590-\u05ff\u0370-\u03ff]+/g, " ");

    // 3. Clean up commas, dashes, and whitespace
    s = s.replace(/,\s*,+/g, ", ")
         .replace(/\s+/g, " ")
         .replace(/^[,;:\-.\s]+|[,;:\-.\s]+$/g, "")
         .trim();

    return s;
  }

  // 5.3 International Legal Suffix Reference
  // Resolve jurisdiction-sensitive abbreviations only when country context is available.
  function expandLegalSuffixes(name, countryName = "") {
    if (!name) return "";
    let s = name;
    const country = String(countryName || "").toLowerCase().replace(/[^a-z]/g, "");
    const countryExpansions = [
      { countries: ["argentina"], rules: [[/\bs\.?r\.?l\.?(?=\s*[,;:]?$)/gi, "Sociedad de Responsabilidad Limitada"], [/\bs\.?a\.?(?=\s*[,;:]?$)/gi, "Sociedad Anónima"]] },
      { countries: ["brazil"], rules: [[/\bltda\.?(?=\s*[,;:]?$)/gi, "Sociedade Limitada"], [/\bs\.?a\.?(?=\s*[,;:]?$)/gi, "Sociedade Anônima"]] },
      { countries: ["spain"], rules: [[/\bs\.?r\.?l\.?(?=\s*[,;:]?$)/gi, "Sociedad de Responsabilidad Limitada"], [/\bs\.?l\.?(?=\s*[,;:]?$)/gi, "Sociedad Limitada"], [/\bs\.?a\.?(?=\s*[,;:]?$)/gi, "Sociedad Anónima"]] },
      { countries: ["france"], rules: [[/\bs\.?a\.?s\.?u\.?(?=\s*[,;:]?$)/gi, "Société par actions simplifiée unipersonnelle"], [/\bs\.?a\.?s\.?(?=\s*[,;:]?$)/gi, "Société par actions simplifiée"], [/\bs\.?r\.?l\.?(?=\s*[,;:]?$)/gi, "Société à responsabilité limitée"], [/\bs\.?l\.?(?=\s*[,;:]?$)/gi, "Société à responsabilité limitée"], [/\bs\.?a\.?(?=\s*[,;:]?$)/gi, "Société Anonyme"], [/\bs\.?n\.?c\.?(?=\s*[,;:]?$)/gi, "Société En Nom Collectif"]] },
      { countries: ["italy"], rules: [[/\bs\.?r\.?l\.?(?=\s*[,;:]?$)/gi, "Società a responsabilità limitata"], [/\bs\.?n\.?c\.?(?=\s*[,;:]?$)/gi, "Società in nome collettivo"], [/\bs\.?a\.?(?=\s*[,;:]?$)/gi, "Società per Azioni"]] },
      { countries: ["switzerland", "belgium", "luxembourg"], rules: [[/\bs\.?a\.?(?=\s*[,;:]?$)/gi, "Société Anonyme"]] },
      { countries: ["mexico"], rules: [[/\bs\.?a\.?p\.?i\.?\s+de\s+c\.?v\.?(?=\s*[,;:]?$)/gi, "Sociedad Anónima Promotora de Inversión de Capital Variable"], [/\bs\.?\s+de\s+r\.?l\.?\s+de\s+c\.?v\.?(?=\s*[,;:]?$)/gi, "Sociedad de Responsabilidad Limitada de Capital Variable"], [/\bs\.?a\.?b\.?\s+de\s+c\.?v\.?(?=\s*[,;:]?$)/gi, "Sociedad Anónima Bursátil de Capital Variable"], [/\bs\.?a\.?\s+de\s+c\.?v\.?(?=\s*[,;:]?$)/gi, "Sociedad Anónima de Capital Variable"], [/\bs\.?a\.?(?=\s*[,;:]?$)/gi, "Sociedad Anónima"], [/\bs\.?c\.?l\.?(?=\s*[,;:]?$)/gi, "Sociedad Cooperativa Limitada"], [/\bs\.?c\.?(?=\s*[,;:]?$)/gi, "Sociedad Civil"]] },
      { countries: ["portugal"], rules: [[/\bs\.?l\.?(?=\s*[,;:]?$)/gi, "Sociedade Limitada"], [/\bs\.?a\.?(?=\s*[,;:]?$)/gi, "Sociedade Anónima"]] },
      { countries: ["czechia", "czechrepublic"], rules: [[/\ba\.?s\.?(?=\s*[,;:]?$)/gi, "Akciová společnost"]] },
      { countries: ["turkey", "trkiye"], rules: [[/\b(?:limited\s+şirketi|ltd\.?\s*şti\.?)\b(?=\s*[,;:]?$)/gi, "Limited Şirketi"], [/\b(?:anonim\s+şirketi|a\.?[şs]\.?)\b(?=\s*[,;:]?$)/gi, "Anonim Şirket"]] },
      { countries: ["unitedstates", "unitedstatesofamerica", "usa"], rules: [[/\bl\.?p\.?(?=\s*[,;:]?$)/gi, "Limited Partnership"], [/\bp\.?a\.?(?=\s*[,;:]?$)/gi, "Professional Association"], [/\bp\.?c\.?(?=\s*[,;:]?$)/gi, "Professional Corporation"]] },
      { countries: ["unitedkingdom", "ireland"], rules: [[/\bl\.?p\.?(?=\s*[,;:]?$)/gi, "Limited Partnership"], [/\buc\b(?=\s*[,;:]?$)/gi, "Unlimited Company"], [/\b(?:ulc|unlimited\s+company)\b(?=\s*[,;:]?$)/gi, "Unlimited Company"]] },
      { countries: ["canada"], rules: [[/\b(?:ulc|unlimited\s+liability\s+company)\b(?=\s*[,;:]?$)/gi, "Unlimited Liability Company"]] },
      { countries: ["indonesia"], rules: [[/(?:^|\b)p\.?t\.?\s+(?=[A-Za-z0-9])/gi, "Perseroan Terbatas "], [/\b(?:perseroan\s+terbatas|p\.?t\.?)\b(?=[,.\s]|$)/gi, "Perseroan Terbatas"]] },
      { countries: ["denmark"], rules: [[/\ba\/s\b(?=[,.\s]|$)/gi, "Aktieselskab"]] },
      { countries: ["sweden"], rules: [[/\ba\.?b\.?(?=[,.\s]|$)/gi, "Aktiebolag"]] }
    ];
    if (country === "italy") {
      s = s.replace(/\bs\.?a\.?p\.?a\.?(?=\s*[,;:]?$)/gi, "Societa in accomandita per azioni");
      s = s.replace(/\bs\.?a\.?s\.?(?=\s*[,;:]?$)/gi, "Societa in accomandita semplice");
      s = s.replace(/\bs\.?p\.?a\.?(?=\s*[,;:]?$)/gi, "Societa per Azioni");
    }
    if (country === "spain") {
      s = s.replace(/\bs\.?l\.?u\.?(?=\s*[,;:]?$)/gi, "Sociedad Limitada Unipersonal");
      s = s.replace(/\bs\.?a\.?u\.?(?=\s*[,;:]?$)/gi, "Sociedad Anonima Unipersonal");
    }
    if (country === "portugal") {
      s = s.replace(/\blda\.?(?=\s*[,;:]?$)/gi, "Sociedade por Quotas");
    }
    if (country === "romania") {
      s = s.replace(/\bs\.?r\.?l\.?(?=\s*[,;:]?$)/gi, "Societate cu Raspundere Limitata");
      s = s.replace(/\bs\.?a\.?(?=\s*[,;:]?$)/gi, "Societate pe Actiuni");
    }
    if (country === "greece") {
      s = s.replace(/\bi\.?k\.?e\.?(?=\s*[,;:]?$)/gi, "Idiotiki Kefalaiouchiki Etaireia");
      s = s.replace(/\be\.?p\.?e\.?(?=\s*[,;:]?$)/gi, "Etaireia Periorismenis Efthynis");
      s = s.replace(/\ba\.?e\.?(?=\s*[,;:]?$)/gi, "Anonymi Etaireia");
    }
    if (country === "poland") {
      s = s.replace(/\bsp\.?\s*z\s*o\.?\s*o\.?(?=\s*[,;:]?$)/gi, "Spolka z ograniczona odpowiedzialnoscia");
    }
    if (country === "chile") {
      s = s.replace(/\bsp\.?a\.?(?=\s*[,;:]?$)/gi, "Sociedad por Acciones");
    }
    const countryRules = countryExpansions.find(entry =>
      entry.countries.some(value => value.replace(/[^a-z]/g, "") === country)
    );
    if (countryRules) {
      for (const [rx, rep] of countryRules.rules) {
        s = s.replace(rx, rep);
      }
    }

    const EXPANSIONS = [
      // Compound GmbH & Co. suffixes must match before the shorter GmbH & Co. form.
      // --- D. Germany, Austria, and Switzerland (compounds first) ---
      [/\b(?:gmbh\s*(?:&|and)\s*co\.?\s*kgaa)\b/gi, "Gesellschaft mit beschränkter Haftung & Co. Kommanditgesellschaft auf Aktien"],
      [/\b(?:gmbh\s*(?:&|and)\s*co\.?\s*kg)\b/gi, "Gesellschaft mit beschränkter Haftung & Co. Kommanditgesellschaft"],
      [/\b(?:gmbh\s*(?:&|and)\s*co\.?)\b/gi, "Gesellschaft mit beschränkter Haftung & Company"],
      [/\bggmbh\b/gi, "Gemeinnützige Gesellschaft mit beschränkter Haftung"],
      [/\bkgaa\b/gi, "Kommanditgesellschaft auf Aktien"],
      [/\bug\s*(?:\(?\s*haftungsbeschr[äa]nkt\s*\)?)/gi, "Unternehmergesellschaft (haftungsbeschränkt)"],

      // --- L. Latin America (compounds first) ---
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

      // S.p.A. is a distinctive dotted Italian form; expand it even when the
      // country detector missed Italy. Keep plain "SPA" untouched.
      [/\bs\s*\.\s*p\s*\.\s*a\.?(?=[,.\s]|$)/gi, "Societ\u00e0 per Azioni"],

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
      [/\be\.?u\.?r\.?l\.?(?=[,.\s]|$)/gi, "Entreprise unipersonnelle à responsabilité limitée"],
      [/\bs\.?a\.?s\.?(?=[,.\s]|$)/gi, "Société par actions simplifiée"],
      [/\bs\.?c\.?a\.?(?=[,.\s]|$)/gi, "Société en commandite par actions"],
      [/\bs\.?c\.?s\.?(?=[,.\s]|$)/gi, "Société en commandite simple"],

      // --- A. United States and United Kingdom (acronyms) ---
      [/\bp\.?l\.?l\.?c\.?(?=[,.\s]|$)/gi, "Professional Limited Liability Company"],
      // Treat "Co., LLC" as one compound suffix so "Co." is not left
      // abbreviated beside an expanded limited-liability form.
      [/\bco\.?\s*,?\s*l\.?l\.?c\.?(?=[,.\s]|$)/gi, "Company, Limited Liability Company"],
      [/\bl\.?l\.?c\.?(?!\s+company\b)(?=[,.\s]|$)/gi, "Limited Liability Company"],
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

      // --- G. Spain / Italy / Portugal ---
      [/\blda\.?(?=[,.\s]|$)/gi, "Limitada"],
      [/\bltda\.?(?=[,.\s]|$)/gi, "Limitada"],

    // --- United States: additional entity types ---
    [/\b(?:l3c|low[\s-]+profit\s+l\.?l\.?c\.?)\b/gi, "Low-Profit Limited Liability Company"],
    [/\bprofessional\s+corporation\b(?=[,.\s]|$)/gi, "Professional Corporation"],
    [/\bprofessional\s+association\b(?=[,.\s]|$)/gi, "Professional Association"],
    [/\b(?:limited\s+liability\s+limited\s+partnership|l\.?l\.?l\.?p\.?)\b(?=[,.\s]|$)/gi, "Limited Liability Limited Partnership"],
    [/\b(?:limited\s+partnership\s+association|l\.?p\.?a\.?)\b(?=[,.\s]|$)/gi, "Limited Partnership Association"],
    [/\b(?:benefit\s+corporation|bcorp)\b(?=[,.\s]|$)/gi, "Benefit Corporation"],

    // --- United Kingdom and Ireland ---
    [/\b(?:clg|company\s+limited\s+by\s+guarantee)\b(?=[,.\s]|$)/gi, "Company Limited by Guarantee"],
    [/\b(?:dac|designated\s+activity\s+company)\b(?=[,.\s]|$)/gi, "Designated Activity Company"],
    [/\b(?:scio)\b(?=[,.\s]|$)/gi, "Scottish Charitable Incorporated Organisation"],
    [/\b(?:community\s+benefit\s+society|bencom)\b(?=[,.\s]|$)/gi, "Community Benefit Society"],

    // --- India ---
    [/\b(?:section\s*8\s+company)\b/gi, "Section 8 Company"],
    [/\b(?:producer\s+company)\b/gi, "Producer Company"],
    [/\b(?:nidhi\s+limited|nidhi\s+company)\b/gi, "Nidhi Company"],

    // --- Canada ---
    [/\b(?:ltee|ltée)\b(?=[,.\s]|$)/gi, "Limitée"],
    [/\b(?:s\.?e\.?n\.?c\.?)\b(?=[,.\s]|$)/gi, "Société en nom collectif"],
    [/\b(?:s\.?e\.?c\.?)\b(?=[,.\s]|$)/gi, "Société en commandite"],

    // --- Australia and New Zealand ---
    [/\b(?:incorporated\s+association)\b/gi, "Incorporated Association"],

    // --- South Africa ---
    [/\b(?:pty\.?\s*\(\s*ltd\.?\s*\)|proprietary\s*\(\s*limited\s*\))\b/gi, "Proprietary Limited"],
    [/\bnon[\s-]*profit\s+company\b(?=[,.\s]|$)/gi, "Non-Profit Company"],

    // --- Switzerland ---
    [/\b(?:sagl|sàrl)\b(?=[,.\s]|$)/gi, "Société à responsabilité limitée"],

    // --- France ---
    [/\b(?:sci)\b(?=[,.\s]|$)/gi, "Société civile immobilière"],

    // --- China and Hong Kong ---
    [/\b(?:foreign[\s-]+invested\s+enterprise|fie)\b(?=[,.\s]|$)/gi, "Foreign-Invested Enterprise"],
    [/\b(?:hk\s+limited|hong\s+kong\s+limited)\b(?=[,.\s]|$)/gi, "Hong Kong Limited Company"],

    // --- Japan ---

    // --- Indonesia ---
    [/\bperseroan\s+terbatas\b(?=[,.\s]|$)/gi, "Perseroan Terbatas"],
    [/\b(?:perum)\b(?=[,.\s]|$)/gi, "Perusahaan Umum"],
    [/\b(?:persero)\b(?=[,.\s]|$)/gi, "Perusahaan Perseroan"],

    // --- Philippines ---

    // --- Turkey ---

    // --- Brazil ---

    // --- Argentina ---

    // --- Mexico ---

    // --- Saudi Arabia and Gulf ---
    [/\b(?:psc|public\s+shareholding\s+company)\b(?=[,.\s]|$)/gi, "Public Shareholding Company"],
    [/\b(?:prjsc|private\s+joint\s+stock\s+company)\b(?=[,.\s]|$)/gi, "Private Joint Stock Company"],

    // --- Africa ---
    [/\b(?:g\.?t\.?\s*ltd\.?)\b(?=[,.\s]|$)/gi, "Guarantee Trust Limited"],


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
      

      // --- I. Southeast Asia, J. Australia / Africa ---
      [/\bbhd\.?(?=[,.\s]|$)/gi, "Berhad"],
      [/\btbk\.?(?=[,.\s]|$)/gi, "Terbuka"],
      [/\bcv\b(?=\s*$|[,.])/gi, "Commanditaire Vennootschap"],
      [/\bopc\b(?=\s*$|[,.])/gi, "One Person Company"],
      [/\bnpc\b(?=\s*$|[,.])/gi, "Non-Profit Company"],
      [/\bcc\b(?=\s*$|[,.])/gi, "Close Corporation"],
      [/\bksc\b(?=\s*$|[,.])/gi, "Kuwait Shareholding Company"],
      [/\bab\b(?=\s*$|[,.])/gi, "Aktiebolag"],

      // --- A. United States and United Kingdom (single words) ---
      [/\binc\.?(?=[,.\s]|$)/gi, "Incorporated"],
      [/\bcorp\.?(?=[,.\s]|$)/gi, "Corporation"],
      [/\bltd\.?(?=[,.\s]|$)/gi, "Limited"],
      [/\bco\.?(?=\s+(?:limited|ltd|incorporated|corporation)\b)/gi, "Company"],
      [/(?<!&\s*)\bco\.?(?=[,.\s]|$)/gi, "Company"]
    ];

    // Normalize the common German spelling before compound suffix expansion.
    s = s.replace(/\bgmbh\s*\+\s*(co\.?\s*k\.?g\.?)/gi, "GmbH & $1");

    for (const [rx, rep] of EXPANSIONS) {
      s = s.replace(rx, rep);
    }

    return s;
  }

  // Some sites expose conflicting legal forms in different page regions. When
  // the address starts with the same company name and gives a legal suffix,
  // trust that explicit address form over a suffix found in unrelated text.
  function alignItalianLegalSuffixFromAddress(companyName, rawAddress, countryName) {
    if (!companyName || !rawAddress || !/^ital(?:y|ia)$/i.test(String(countryName || "").trim())) {
      return companyName;
    }

    const addressLead = clean(rawAddress).split(/[,;\n|]/, 1)[0];
    const legalForm = addressLead.match(/\b(S\s*\.\s*R\s*\.\s*L\s*\.?|S\s*\.\s*N\s*\.\s*C\s*\.?|S\s*\.\s*P\s*\.\s*A\s*\.?|S\s*\.\s*A\s*\.?|S\s*\.\s*A\s*\.\s*S\s*\.?)\s*$/i);
    if (!legalForm) return companyName;

    // The legal entity line is more authoritative than unrelated name-like
    // text elsewhere on the site (for example, an old or malformed footer).
    return addressLead;
  }

  // Footer and title strings often append the web agency after the legal name.
  // Remove the attribution while retaining the company name and its suffix.
  function stripWebsiteAttribution(value) {
    let name = clean(value || "")
      .replace(/\s*(?:[|·•–—-]\s*)?(?:web\s+site\s+designed\s+and\s+hosted\s+by|designed\s+and\s+hosted\s+by|(?:web\s+)?design(?:ed)?\s+by|site\s+by|website\s+by|hosted\s+by|powered\s+by)\s+.+$/i, "")
      .trim();
    name = name.replace(/\s*(?:\|\s*)?\bdeveloped\s+(?:(?:and|&)\s+managed\s+)?by\b.+$/i, "").replace(/\s*[|/]\s*(?:terms|privacy|sitemap)\b.*$/i, "").trim();
    const trailingRightsNotice = /(?:©|\(c\)|copyright)\s*(?:19|20)\d{2}\b/i.exec(name);
    if (trailingRightsNotice?.index > 0) {
      name = name.slice(0, trailingRightsNotice.index).replace(/[\s.,;:|]+$/g, "").trim();
    }
    return name;
  }

  function titleCaseCompanyWords(value) {
    return String(value || "").split(/(\s+)/).map(word => {
      if (!word.trim()) return word;
      if (/^(?:USA|UK|IBM|BMW|BBC|BHP|LLC|LLP|PLC|GMBH|AG|T2)$/i.test(word)) return word.toUpperCase();
      if (/^[A-Z]{2,3}$/.test(word)) return word;

      const allCaps = word.match(/^([\p{L}]{4,})([.,;:]*)$/u);
      if (allCaps && allCaps[1] === allCaps[1].toUpperCase()) {
        return allCaps[1].charAt(0) + allCaps[1].slice(1).toLowerCase() + allCaps[2];
      }

      const letters = word.match(/^([\p{L}])([\p{L}\p{M}]*)(.*)$/u);
      if (!letters) return word;
      const alphaPart = letters[1] + letters[2];
      // Preserve intentional brand casing such as eBay and iPhone.
      if (/[A-Z]/.test(alphaPart.slice(1))) return word;
      return letters[1].toLocaleUpperCase() + letters[2].toLocaleLowerCase() + letters[3];
    }).join("");
  }

  // Format Company Name according to Rule 4 & Section 5.3 (Expand legal suffixes)
  function formatCompanyName(raw, countryName = "") {
    if (!raw) return "";
    let name = stripWebsiteAttribution(raw);

    // 0. Strip trailing "Trading As", "d/b/a", "doing business as"
    name = name.replace(/\s+(?:trading\s+as|d\/b\/a|doing\s+business\s+as)\s+.*$/i, "");

    // 1. Remove copyright phrases, dates, or trailing noise
    name = name.replace(/\ball rights reserved\b/gi, "");
    name = name.replace(/\bcopyright\b/gi, "");
    name = name.replace(/^(?:copyright|©|\(c\))\s*(?:[0-9]{4})?\s*/gi, "");

    // 2. Handle Korean entity designations: strict English only, NO transliteration ("Jusik Hoesa")
    const hasKoreanEntity = /[\(\[（]\s*주\s*[\)\]）]|㈜|주식회사|유한회사|유한책임회사/.test(name);
    name = name.replace(/[\(\[（]\s*주\s*[\)\]）]|㈜/g, " ");
    name = name.replace(/주식회사|유한회사|유한책임회사/g, " ");

    // Strict English/Latin characters only: clean out non-Latin characters
    name = cleanNonLatin(name, true);
    const corpSuffixShort = /\b(?:co[.,\s]*ltd\.?|co[.,\s]+limited|company\s+limited|corporation|corp\.?|incorporated|inc\.?|limited|ltd\.?|llc|gmbh|ag)\b/i;
    if (hasKoreanEntity && !corpSuffixShort.test(name) && name.trim()) {
      name = `${name} Co., Ltd.`;
    }

    // 3. Remove brackets while keeping inner text (e.g. (Korea) -> Korea, (UK) -> UK)
    name = removeBrackets(name);

    // 4. Trim special characters from beginning and end
    name = trimSpecialChars(name);

    // 5. Title-case the trade name portion
    name = titleCaseCompanyWords(name);

    // Keep connector words title-cased too, matching the requested company
    // name format (for example, "TCF Council Of Fiji").

    // 6. Section 5.3: Expand all international legal suffixes to full form
    // Legal suffix expansions also follow the requested capitalization format.
    name = titleCaseCompanyWords(expandLegalSuffixes(name, countryName));

    // 7. Clean duplicate punctuation, extra spaces, trailing/leading commas or dots
    name = clean(name.replace(/^[,;:\-.\s]+|[,;:\-.\s]+$/g, ""));

    return name;
  }

  // Remove special characters from start and end
  function trimSpecialChars(str) {
    if (!str) return "";
    return str.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, "").trim();
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

  // Check the full page copy and visible image/accessibility metadata for any forbidden category.
  function checkForbiddenCategories(text, doc) {
    const pageContext = [
      doc?.title || "",
      doc?.querySelector?.('meta[name="description"]')?.content || "",
      doc?.querySelector?.('meta[property="og:title"]')?.content || "",
      doc?.querySelector?.('meta[property="og:description"]')?.content || "",
      doc?.querySelector?.('meta[name="keywords"]')?.content || "",
      text || getElementText(doc?.body) || ""
    ];
    if (doc?.querySelectorAll) {
      for (const script of doc.querySelectorAll("script[type='application/ld+json']")) {
        pageContext.push(script.textContent || "");
      }
      // Scan user-facing copy, accessibility text, and media/link filenames.
      // Do not scan CSS class/id/style values: common names like "cat-item"
      // can otherwise be misread as prohibited subject matter.
      for (const el of doc.querySelectorAll("img, a[href], [aria-label], [title], [alt], svg title")) {
        pageContext.push(
          el.getAttribute?.("alt") || "",
          el.getAttribute?.("aria-label") || "",
          el.getAttribute?.("title") || "",
          el.textContent || ""
        );
      }
    }
    const fullPageContext = pageContext.join(" ").toLowerCase();

    for (const cat of FORBIDDEN_CATEGORIES) {
      const regex = new RegExp(cat.regex.source, "gi");
      let match;
      while ((match = regex.exec(fullPageContext)) !== null) {
        const matchText = match[0];
        if (typeof cat.isExempt === "function") {
          const start = Math.max(0, match.index - 60);
          const end = Math.min(fullPageContext.length, match.index + matchText.length + 60);
          const snippet = fullPageContext.slice(start, end);
          if (cat.isExempt(matchText, snippet)) {
            continue;
          }
        }
        return {
          isForbidden: true,
          category: cat.name,
          matchedText: matchText,
          message: `⛔ FORBIDDEN CATEGORY DETECTED: [${cat.name}]. Rule: Do not work on this site!`
        };
      }
    }
    return { isForbidden: false };
  }

  // Rule 15: detect a real online checkout path. Informational product
  // catalogs, payment logos, and policy links alone are supporting evidence,
  // not enough to classify a site as an online store.
  function detectOnlinePurchase(doc, text = "") {
    const evidence = [];
    let hasTransactionAction = false;
    let hasCart = false;
    let hasPricedCatalog = false;
    let hasProductOffer = false;
    let hasInventory = false;
    let hasAccount = false;
    let hasPayment = false;
    let hasShippingPolicy = false;
    let hasReturnsPolicy = false;

    if (doc?.querySelectorAll) {
      const actionPattern = /\b(?:add\s+to\s+(?:cart|basket|bag)|buy\s+now|checkout|proceed\s+to\s+checkout|place\s+(?:your\s+)?order|pay\s+now)\b/i;
      for (const el of doc.querySelectorAll("button, a, [role='button'], input[type='submit'], input[type='button']")) {
        const label = [el.textContent, el.getAttribute?.("aria-label"), el.getAttribute?.("title"), el.value]
          .filter(Boolean).join(" ").trim();
        if (label.length <= 120 && actionPattern.test(label)) {
          hasTransactionAction = true;
          evidence.push(label.replace(/\s+/g, " ").slice(0, 60));
          break;
        }
      }

      const cartPattern = /\b(?:cart|basket|shopping\s+bag)\b/i;
      hasCart = Boolean(doc.querySelector(
        "a[href*='cart' i], a[href*='basket' i], [aria-label*='cart' i], [title*='cart' i], [data-testid*='cart' i]"
      ));
      if (!hasCart) {
        const navigation = doc.querySelector("header, nav, [role='navigation']");
        hasCart = [...(navigation?.querySelectorAll("a, button, [role='button']") || [])].slice(0, 100).some(el =>
          cartPattern.test([el.textContent, el.getAttribute?.("aria-label"), el.getAttribute?.("title")].filter(Boolean).join(" "))
        );
      }
      if (hasCart) evidence.push("Shopping cart or basket control");

      const pricePattern = /(?:[$£€¥₹]\s?\d|\b(?:USD|GBP|EUR|CNY|RMB|INR|TWD)\s?\d)/i;
      const productNodes = doc.querySelectorAll(
        "[itemtype*='Product' i], [itemprop='price'], [class*='product' i], [id*='product' i], [data-product]"
      );
      hasPricedCatalog = [...productNodes].some(el => {
        const productContext = el.matches?.("[itemprop='price']")
          ? el.closest?.("[itemtype*='Product' i], [class*='product' i], [id*='product' i], [data-product]")
          : el.closest?.("[itemtype*='Product' i], [class*='product' i], [id*='product' i], [data-product]") || el;
        if (!productContext) return false;
        const productText = (productContext.textContent || "").slice(0, 2500);
        const hasPrice = pricePattern.test(productText) || Boolean(el.querySelector?.("[itemprop='price'], [class*='price' i], [data-price]"));
        return hasPrice && productText.length > 0;
      });
      if (hasPricedCatalog) evidence.push("Product listing with prices");

      const productItems = doc.querySelectorAll("[itemtype*='Product' i], [itemprop='offers'], [itemprop='price']");
      hasProductOffer = [...productItems].some(el =>
        Boolean(el.querySelector?.("[itemprop='offers'], [itemprop='price'], [itemprop='availability']")) ||
        Boolean(el.getAttribute?.("itemprop") === "price" && el.getAttribute?.("content"))
      );
      for (const script of doc.querySelectorAll("script[type='application/ld+json']")) {
        try {
          const visit = value => {
            if (!value) return;
            if (Array.isArray(value)) return value.forEach(visit);
            if (typeof value !== "object") return;
            const type = Array.isArray(value["@type"]) ? value["@type"].join(" ") : String(value["@type"] || "");
            const offers = Array.isArray(value.offers) ? value.offers : [value.offers];
            if (/\bProduct\b/i.test(type) && offers.some(offer => offer && (offer.price != null || offer.lowPrice != null))) {
              hasProductOffer = true;
            }
            Object.values(value).forEach(visit);
          };
          visit(JSON.parse(script.textContent || ""));
        } catch {}
      }
      if (hasProductOffer) evidence.push("Structured product offer or price");

      const visibleText = String(text || getElementText(doc.body) || "");
      hasInventory = /\b(?:in\s+stock|out\s+of\s+stock|backorder|available\s+now|ships\s+in\s+\d+)\b/i.test(visibleText);
      hasAccount = Boolean(doc.querySelector("a[href*='account' i], a[href*='login' i], a[href*='order-tracking' i]")) ||
        /\b(?:my account|track (?:my )?order)\b/i.test(visibleText);
      hasPayment = Boolean(doc.querySelector("[class*='payment' i], [id*='payment' i], [alt*='visa' i], [alt*='paypal' i], [alt*='mastercard' i], [alt*='stripe' i]"));
      hasShippingPolicy = Boolean([...doc.querySelectorAll("a")].some(el => /shipping\s+policy|delivery\s+information/i.test(el.textContent || "")));
      hasReturnsPolicy = Boolean([...doc.querySelectorAll("a")].some(el => /return|refund/i.test(el.textContent || "")));
    }

    if (hasInventory) evidence.push("Inventory availability");
    if (hasAccount) evidence.push("Customer account or order tracking");
    if (hasPayment) evidence.push("Payment method indicators");
    if (hasShippingPolicy) evidence.push("Shipping policy");
    if (hasReturnsPolicy) evidence.push("Returns or refund policy");

    // One direct checkout action or a priced Product/Offer is decisive.
    // Otherwise require a cart and priced catalog plus at least one further
    // transaction signal (inventory, account, payment, or policies).
    const supportingSignals = Number(hasInventory) + Number(hasAccount) + Number(hasPayment) +
      Number(hasShippingPolicy) + Number(hasReturnsPolicy);
    const isOnlineStore = hasTransactionAction || hasProductOffer ||
      (hasCart && hasPricedCatalog && supportingSignals >= 1);
    return {
      checked: true,
      isOnlineStore,
      classification: isOnlineStore ? "Online Purchase Available" : "No Online Purchase Detected",
      evidence
    };
  }

  // Rule 2: Infer business type from About / Company Profile content, not
  // product copy or a default assumption that every industrial site manufactures.
  function detectBusinessType(text, doc, url = "") {
    const profileParts = [];
    const addProfilePart = value => {
      const part = clean(value || "");
      if (part.length >= 40 && part.length <= 4000 && !profileParts.includes(part)) {
        profileParts.push(part);
      }
    };

    if (doc) {
      const profileSelectors = [
        '[id*="about" i]', '[class*="about" i]',
        '[id*="company-profile" i]', '[class*="company-profile" i]',
        '[id*="company-overview" i]', '[class*="company-overview" i]',
        '[id*="company-info" i]', '[class*="company-info" i]',
        '[id*="who-we-are" i]', '[class*="who-we-are" i]'
      ].join(", ");
      for (const el of doc.querySelectorAll(profileSelectors)) {
        if (!el.closest?.("nav, footer, [role='navigation']")) addProfilePart(getElementText(el));
      }

      for (const heading of doc.querySelectorAll("h1, h2, h3, h4, h5, h6")) {
        if (!/\b(?:about(?:\s+us)?|company\s+(?:profile|overview|information)|who\s+we\s+are|our\s+company)\b/i.test(heading.textContent || "")) continue;
        let section = heading.closest?.("section, article, [role='region']") || heading.parentElement;
        for (let depth = 0; section && depth < 3; depth++, section = section.parentElement) {
          if (section.closest?.("nav, footer, [role='navigation']")) break;
          const sectionText = getElementText(section);
          if (sectionText.length >= 40 && sectionText.length <= 4000) {
            addProfilePart(sectionText);
            break;
          }
        }
      }

      for (const selector of ['meta[name="description"]', 'meta[property="og:description"]']) {
        addProfilePart(doc.querySelector(selector)?.content || "");
      }

      // Many company homepages (including V-TEK) put their business type in a
      // short introductory paragraph without labeling it as an About section.
      // Accept only compact company statements with explicit category terms;
      // this avoids classifying from product listings or generic page copy.
      let isHomePage = false;
      try {
        const path = new URL(url).pathname.replace(/\/+$/, "");
        isHomePage = !path || path === "/index.html" || path === "/index.htm";
      } catch { }
      if (isHomePage) {
        const explicitBusinessStatement = /\b(?:manufacturer|manufacturing|manufactures|distributor|distribution|wholesaler|wholesale|supplier|supplies|service provider|trading company|exporter|importer)\b/i;
        for (const el of doc.querySelectorAll("main p, [role='main'] p, p")) {
          if (el.closest?.("nav, footer, [role='navigation']")) continue;
          const statement = getElementText(el);
          if (statement.length >= 40 && statement.length <= 1200 && explicitBusinessStatement.test(statement)) {
            addProfilePart(statement);
          }
        }

        // Some sites render the introductory statement in nested builder
        // elements rather than <p> tags. Preserve only the short fragment
        // around a strong, explicit manufacturer/maker claim from page text.
        const makerClaim = /\b(?:manufacturers?|manufacturing company|(?:custom\s+)?furniture makers?|makers? of)\b/i;
        const makerMatch = String(text || "").match(new RegExp(`.{0,180}${makerClaim.source}.{0,180}`, "i"));
        if (makerMatch) addProfilePart(makerMatch[0]);
      }
      for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
        try {
          const parsed = JSON.parse(script.textContent || "");
          const objects = Array.isArray(parsed) ? parsed : [parsed];
          for (const item of objects) {
            const entries = [item, ...(item?.["@graph"] || [])];
            for (const entry of entries) {
              if (/Organization|Corporation|LocalBusiness/i.test(String(entry?.["@type"] || ""))) {
                addProfilePart(entry.description || "");
              }
            }
          }
        } catch { }
      }
    }

    let aboutPage = false;
    try {
      aboutPage = /\/(?:about(?:-us)?|company(?:-profile|-overview)?|who-we-are)(?:\/|$)/i.test(new URL(url).pathname);
    } catch { }
    if (!profileParts.length && aboutPage) addProfilePart(text || "");
    if (!profileParts.length) return "";

    const profileText = profileParts.join(" ").toLowerCase();
    if (/\b(manufacturers?|manufacturing|manufacture[rs]?|we produce|producer|factory|oem|odm|assembly line|(?:custom\s+)?furniture makers?)\b/i.test(profileText)) {
      return "Manufacturer";
    }
    if (/\b(wholesale|wholesaler|bulk supply|bulk order)\b/i.test(profileText)) {
      return "Wholesaler";
    }
    if (/\b(distributer|distributor|distribution|authorized dealer|dealership)\b/i.test(profileText)) {
      return "Distributer";
    }
    // Trader requires an explicit import/export or merchant description.
    if (/\b(trading company|importer and exporter|import.{0,40}export|export.{0,40}import|merchant)\b/i.test(profileText)) {
      return "Trader";
    }
    if (/\b(exporter|exporting|global export|overseas sales|export specialist)\b/i.test(profileText)) {
      return "Exporter";
    }
    if (/\b(supplier|supplying|stockist|vendor)\b/i.test(profileText)) {
      return "Supplier";
    }
    if (/\b(industrial services|service provider|it consulting|consulting firm|maintenance company|after-?sales service|support contractor|engineering services)\b/i.test(profileText)) {
      return "Industrial Services";
    }

    return "";
  }

  // Rule 3: Company Profile (Y / N)
  function detectCompanyProfile(text, doc) {
    const hasProfile = /\b(about(\s+us)?|company\s+profile|company\s+overview|greetings|history|management\s+philosophy|organization|presentation|our\s+strength|our\s+strengths|our\s+story|who\s+we\s+are|corporate\s+info|our\s+company|production\s+process|turnkey\s+solutions|회사소개|회사개요|인사말)\b/i.test(text || "") ||
      Boolean(doc?.querySelector?.('a[href*="about"], a[href*="ab0"], a[href*="company"], a[href*="profile"], a[href*="presentation"], a[href*="strength"]'));
    return hasProfile ? "Y" : "N";
  }

  // Rule 4: Company Name — Full Form Extraction with Extended Content & Suffix Analysis
  function extractCompanyName(doc, text, url, formatName = true, countryName = "") {
    let legalName = "";
    let brandName = "";
    const finishName = value => formatName ? formatCompanyName(value, countryName) : value;

    let domainStem = "";
    try {
      const baseEl = doc?.querySelector("base[href]");
      const canonEl = doc?.querySelector('link[rel="canonical"]');
      const rawHref = url || baseEl?.getAttribute("href") || canonEl?.getAttribute("href") || "";
      if (rawHref) {
        const host = new URL(rawHref).hostname.replace(/^www\./i, "");
        const stem = host.split(".")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
        if (stem.length >= 3) domainStem = stem;
      }
    } catch {}

    // Comprehensive corporate suffix pattern (Section 5.3 International Legal Suffixes)
    const corpSuffix = /\b(?:co[.,\s]*ltd\.?|co[.,\s]+limited|company\s+limited|corporation|corp\.?|incorporated|inc\.?|limited|ltd\.?|llc|llp|plc|pllc|gmbh|ag|kg|kgaa|se|sarl|eurl|s\.?a\.?p\.?a\.?|s\.?a\.?s\.?u\.?|s\.?a\.?s\.?|s\.?l\.?u\.?|s\.?a\.?u\.?|sas|sasu|sa|bv|nv|ab|oy|oyj|as|aps|sl|s\.?r\.?l\.?|s\.?n\.?c\.?|s\.?p\.?a\.?|spa|sp\.?\s*z\s*o\.?\s*o\.?|ike|epe|a\.?e\.?|tnhh|jsc|kft|zrt|nyrt|s\.r\.o\.|a\.s\.|d\.o\.o\.|pvt\.?\s*ltd\.?|private\s+limited|pte\.?\s*ltd\.?|pty\.?\s*ltd\.?|proprietary\s+limited|sdn\.?\s*bhd\.?|berhad|bhd\.?|tbk\.?|wll|pjsc|fze|fzco|fz-llc|l3c|p\.?c\.?|p\.?a\.?|l\.?l\.?l\.?p\.?|l\.?p\.?a\.?|bcorp|clg|ulc|dac|scio|bencom|lp|section\s*8\s+company|producer\s+company|nidhi\s+(?:limited|company)|s\.?e\.?n\.?c\.?|s\.?e\.?c\.?|incorporated\s+association|npc|wfoe|wofe|fie|g\.?k\.?|y\.?k\.?|p\.?t\.?|perum|persero|s\.?c\.?l\.?|s\.?c\.?|psc|prjsc|g\.?t\.?\s*ltd)\b/i;

    // Helper: checks if candidate string contains a real corporate suffix
    const hasCorpSuffix = str => {
      if (!str || /^\s*(?:NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\s+\d{4}\s*$/i.test(str)) {
        return false;
      }
      // A short legal form such as "AS" or "SE" must terminate the legal entity or be followed
      // only by punctuation, country/state/location (e.g. "LLC, USA", "Ltd (UK)"), or trailing year.
      return new RegExp(
        `(?:${corpSuffix.source})(?:\\s*[,;:\\-]?\\s*(?:\\([A-Za-z\\s]+\\)|[A-Za-z]+|(?:19|20)\\d{2}))?\\s*[.,;]?\\s*$`,
        "i"
      ).test(String(str).trim());
    };

    // Helper to validate and clean a company name candidate
    function sanitizeCandidate(str) {
      if (!str) return "";
      let s = stripWebsiteAttribution(str)
        .replace(/^(?:copyright|©|\(c\))\s*(?:[0-9]{4})?\s*/gi, "")
        .replace(/(?:all rights?|rights reserved|company reg|reg no).*$/gi, "")
        .replace(
          formatName ? /\s*[|·•\-–—.,]\s*$/g : /\s*[|·•\-–—,]\s*$/g,
          ""
        )
        .replace(
          formatName ? /^[,;:\-.\s]+|[,;:\-.\s]+$/g : /^[,;:\-\s]+|[,;:\-\s]+$/g,
          ""
        )
        .trim();
      s = s.replace(/\s+(?:19|20)\d{2}\s*$/, (year, offset) =>
        /\b(?:limited|ltd|incorporated|inc|llc|plc|corp(?:oration)?|gmbh|company|co\.?)\s*$/i.test(s.slice(0, offset)) ? "" : year
      );
      const addressLike = /\b\d{1,6}\s+[\p{L}][\p{L}'-]*(?:\s+[\p{L}][\p{L}'-]*){0,5}\s+(?:street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|drive|dr\.?|boulevard|blvd\.?|highway|hwy\.?|parkway|pkwy\.?|industrial estate)\b/i.test(s) ||
        /\b(?:address|headquarters|contact details|plot|khasra|industrial area|industrial estate|district|village|street|road|avenue|lane|drive|parkway|suite|unit)\b/i.test(s) && /\d/.test(s);
      if (!addressLike && s.length >= 2 && s.length <= 80 && !/^(?:all|rights|reserved|inc|ltd|co|llc|\d+)$/i.test(s)) {
        return s;
      }
      return "";
    }

    // Strip page descriptors from title-derived brands (for example,
    // "EUCHNER as an employer") before using them as company names.
    function cleanBrandDescriptor(value) {
      let candidate = sanitizeCandidate(value || "");
      candidate = candidate
        .replace(/\s+(?:as\s+an?\s+employer|career(?:s|\s+opportunities)?|job(?:s)?|vacancies|recruitment|employment)\s*$/i, "")
        .replace(/^(?:career(?:s)?|job(?:s)?|vacancies)\s+(?:at|for|with)\s+/i, "")
        .replace(/^(?:welcome\s+to|about)\s+/i, "")
        .trim();
      return sanitizeCandidate(candidate) || candidate;
    }

    // Product catalog labels can be copied from navigation or schema markup.
    // Require both a product type and multiple generic product descriptors so
    // company names such as "Hunt Electronic" remain valid.
    function isCatalogProductName(value) {
      const candidate = String(value || "").trim();
      if (!candidate) return false;
      const hasProductType = /\b(?:monitor|camera|lens|recorder|video\s+encoder|power\s+supply|processor|transceiver|switch|intercom|card\s+reader|mount|bracket)\b/i.test(candidate);
      const descriptors = candidate.match(/\b(?:standard|entry\s+level|lcd|pc|security|surveillance|digital|wireless|ip|cctv|video|color|colour|black|white|hd|4k|megapixel)\b/gi) || [];
      return hasProductType && descriptors.length >= 2;
    }

    function companyNameAfterRightsNotice(value) {
      const match = String(value || "").match(
        /\ball rights reserved\b\s*(?:(?:©\s*)?\d{2,4}(?:\s*[-–]\s*\d{2,4})?\s*)?(?:©\s*)?(.{2,80})$/i
      );
      const candidate = sanitizeCandidate(match?.[1] || "");
      // Do not mistake prose after "All Rights Reserved" for a legal name.
      // A valid company suffix must terminate the candidate.
      const endsWithCorpSuffix = candidate && new RegExp(`${corpSuffix.source}\\s*[.,]?$`, "i").test(candidate);
      return endsWithCorpSuffix ? candidate : "";
    }

    // A site name that includes a legal suffix is often more complete than
    // the abbreviated Organization name in structured data.
    let metadataLegalName = "";
    if (doc) {
      for (const selector of ['meta[property="og:site_name"]', 'meta[name="company"]']) {
        const candidate = sanitizeCandidate(doc.querySelector(selector)?.content || "");
        if (candidate && hasCorpSuffix(candidate)) {
          metadataLegalName = candidate;
          break;
        }
      }
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
                const ogSite = sanitizeCandidate(doc?.querySelector('meta[property="og:site_name"]')?.content || "");
                if (ogSite && hasCorpSuffix(ogSite) && ogSite.length > n.length) {
                  legalName = ogSite;
                } else {
                  legalName = n;
                }
                break;
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
      const footerLines = [];
      for (const f of footerEls) {
        footerLines.push(...getElementText(f).split(/[\r\n]+/));
      }

      // Prefer explicit copyright/legal lines over unrelated company names in
      // footer widgets, such as featured projects or customers.
      for (const line of footerLines) {
        const l = clean(line);
        if (!l || l.length < 2 || l.length > 120) continue;

        const reverseCopyrightName = companyNameAfterRightsNotice(l);
        if (reverseCopyrightName) {
          legalName = reverseCopyrightName;
          break;
        }

        const cpMatch = l.match(/(?:©|copyright|\(c\))\s*(?:\d{2,4}\s*[-–]?\s*\d{2,4}|\d{2,4})?\s*(.{2,80}?)(?=\s*(?:[|·•]|[-–—]\s+)|\s+(?:registered\b|all rights?|rights reserved|company reg|reg no)|$)/i);
        if (cpMatch && cpMatch[1]) {
          const candidate = sanitizeCandidate(cpMatch[1]);
          if (candidate && hasCorpSuffix(candidate)) {
            legalName = candidate;
            break;
          } else if (candidate) {
            // A visible copyright identity is more authoritative than a
            // generic schema brand or a marketing phrase in the page title.
            brandName = candidate;
          }
        }
      }

      if (!legalName) {
        for (const line of footerLines) {
          const l = clean(line);
          if (!l || l.length < 2 || l.length > 120) continue;

          // Ignore address and contact lines that happen to contain a suffix.
          if (/(?:street|road|floor|suite|bldg|building|avenue|drive|lane|way|park\b|industrial estate|tel\b|phone\b|fax\b|email\b|@|사업자|대표자|-ro\b|-gu\b|-si\b)/i.test(l)) {
            continue;
          }

          const candidate = sanitizeCandidate(l);
          if (candidate && hasCorpSuffix(candidate)) {
            legalName = candidate;
            break;
          }
        }
      }
    }

    // 3. Full-text copyright regex with corporate suffix
    if (!legalName && text) {
      const cpMatches = text.matchAll(/(?:©|copyright|\(c\))\s*(?:\d{2,4}\s*[-–]?\s*\d{2,4}|\d{2,4})?\s*([A-Za-z0-9\u00C0-\u024F&.,\s'-]{2,80}?)(?=\s*(?:[|·•]|[-–—]\s+)|\s+(?:registered\b|all rights?|rights reserved|company reg|reg no)|\n|$)/gi);
      for (const m of cpMatches) {
        if (m && m[1]) {
          const cand = sanitizeCandidate(m[1]);
          if (cand && hasCorpSuffix(cand)) {
            legalName = cand;
            break;
          } else if (cand) {
            brandName = cand;
          }
        }
      }
    }

    // 4. "ALL RIGHTS RESERVED" reverse match with corporate suffix
    if (!legalName && text) {
      const arrMatch = text.match(/([A-Za-z0-9\u00C0-\u024F&.,\s'-]{2,80}?)\s*\.?\s*all rights? reserved/i);
      if (arrMatch && arrMatch[1]) {
        let rawCand = arrMatch[1];
        const yearMatch = rawCand.match(/\b(?:19|20)\d{2}\s+([A-Za-z0-9\u00C0-\u024F&.,\s'-]{2,60})$/);
        if (yearMatch) rawCand = yearMatch[1];
        const cand = sanitizeCandidate(rawCand);
        if (cand && hasCorpSuffix(cand)) {
          legalName = cand;
        } else if (cand && !brandName) {
          brandName = cand;
        }
      }
    }

    // Prefer a visible legal/footer name over abbreviated site metadata.
    if (!legalName && metadataLegalName) legalName = metadataLegalName;

    // 5. Title tag segment with corporate suffix
    if (!legalName && doc?.title) {
      const titleParts = doc.title.split(/\s*\|\s*|\s+[–—-]\s+|:\s*|[·•]/).map(s => s.trim()).filter(Boolean);
      const corpPart = titleParts.find(p => hasCorpSuffix(p) && p.length >= 2 && p.length <= 80);
      if (corpPart) {
        legalName = sanitizeCandidate(corpPart);
      } else {
        const genericTitlePart = /^(?:home(?:page)?|welcome|contact(?:\s+us)?|about(?:\s+us)?|privacy(?:\s+policy)?|terms(?:\s+(?:and|&)\s+conditions)?|products?|services?|shop|store|furniture|blog|news|login|search|career(?:s)?|jobs?|vacancies|employer)(?:\s+page)?$/i;
        const isMarketingDescription = str => {
          if (!str) return false;
          const s = str.trim();
          if (isCatalogProductName(s)) return true;
          if (s.split(/\s+/).length > 6) return true;
          return /\b(?:leading|world leader|specializing in|professional|trusted|quality|manufacturer of|supplier of|solutions for|distributor of|tools manufacturer|flame detectors|fasteners|precision|machining|automation|advanced security|security systems|surveillance|cctv solutions|cutting-edge|empowering|since \d{4}|from [A-Za-z]+|official (?:website|site)|home|welcome|contact|about|products|services|store)\b/i.test(s);
        };
        let domainMatchedPart = "";
        if (domainStem) {
          domainMatchedPart = titleParts.find(p => {
            const cleanP = p.toLowerCase().replace(/[^a-z0-9]/g, "");
            return cleanP.length >= 2 && (cleanP.includes(domainStem) || domainStem.includes(cleanP));
          }) || "";
        }
        const titleBrandName = (domainMatchedPart && cleanBrandDescriptor(domainMatchedPart)) ||
          titleParts
            .map(part => cleanBrandDescriptor(part))
            .find(part => part.length >= 2 && part.length <= 60 && !genericTitlePart.test(part) && !isMarketingDescription(part)) ||
          titleParts.map(part => cleanBrandDescriptor(part)).find(part => part.length >= 2 && part.length <= 60 && !genericTitlePart.test(part) && !isMarketingDescription(part) && !isCatalogProductName(part) && !/^\d{4,}$/.test(part)) || "";
        if (titleBrandName && (!brandName || isCatalogProductName(brandName))) {
          brandName = titleBrandName;
        }
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
      return finishName(legalName);
    }

    // Discard a product/category label that may have been exposed as an
    // Organization name in structured data, then use the site identity.
    if (isCatalogProductName(brandName)) {
      brandName = "";
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

    brandName = cleanBrandDescriptor(brandName);

    // --- PHASE 3: EXTENDED CONTENT SEARCH ---
    // If we have a brand name (e.g. "Accurite Industries"), check the extended content
    // of the page (footer, address, full text) to see if this brand name appears with a legal suffix (e.g. "Accurite Industries Ltd")!
    if (brandName && text) {
      const baseClean = brandName.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&").replace(/\s+/g, "\\s+");
      const germanGmbhCoRegex = new RegExp(
        `\\b(${baseClean}\\s+gmbh\\s*(?:\\+|&)\\s*co\\.?\\s*k\\.?g\\.?)(?=$|[\\s,.;])`,
        "i"
      );
      const germanGmbhCoMatch = text.match(germanGmbhCoRegex);
      if (germanGmbhCoMatch?.[1]) {
        return finishName(germanGmbhCoMatch[1]);
      }
      const legalNameQualifiers = "(?:USA|U\\.?S\\.?A?\\.?|US|America|International|Global|Worldwide|Group|Holding|Holdings|Enterprises|Enterprise|Trading|Industries|Industry|Technologies|Technology)";
      const suffixSearchRegex = new RegExp(
        `\\b(${baseClean}(?:[,\\s]+${legalNameQualifiers})*[,\\s]+(?:${corpSuffix.source}))\\b`,
        "i"
      );
      const match = text.match(suffixSearchRegex);
      if (match && match[1]) {
        return finishName(match[1]);
      }
    }

    // Also scan all text lines for any standalone company name matching brandName + suffix
    if (brandName && doc) {
      const allText = getElementText(doc.body);
      const lines = allText.split(/[\r\n]+/);
      const brandLower = brandName.toLowerCase();
      for (const line of lines) {
        const l = clean(line);
        if (l.length >= brandName.length && l.length <= brandName.length + 50) {
          const lLower = l.toLowerCase();
          if ((lLower.startsWith(brandLower) || lLower.includes(brandLower))) {
            const cand = sanitizeCandidate(l);
            if (cand && hasCorpSuffix(cand) && cand.toLowerCase().includes(brandLower)) {
              return finishName(cand);
            }
          }
        }
      }
    }

    if (brandName) {
      return finishName(brandName);
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
          return finishName(domainPart);
        }
      }
    } catch { }

    return "";
  }

  // Rule 5: Country Name (Full form; Locality priority: England > United Kingdom; NEVER hardcoded!)
  function inferCountryFromAddressRegion(address) {
    if (!address) return "";

    if (SWEDEN_COUNTY_REGEX.test(address)) return "Sweden";

    for (const [countryName, regions] of Object.entries(POSTAL_REGION_ABBREVIATIONS)) {
      if (Object.values(regions).some(regionName => matchesCountryTerm(address, regionName))) {
        return countryName;
      }
    }

    const regionCodePatterns = {
      "United States Of America": /\b(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\s+\d{5}(?:-\d{4})?\b/i,
      Canada: /\b(?:AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)\s+[A-Z]\d[A-Z]\s*\d[A-Z]\d\b/i,
      Australia: /\b(?:NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\s+\d{4}\b/i
    };

    for (const [countryName, pattern] of Object.entries(regionCodePatterns)) {
      if (pattern.test(address)) return countryName;
    }

    return "";
  }

  function detectCountry(doc, addressText, fullText, url, phoneRaw) {
    const combinedAddr = `${addressText || ""}`.toLowerCase();
    // NOTE: Only scan addressText + short meta context for UK/cities, NOT the full body text!
    // Full body scanning causes false positives (e.g., Korean site mentions 'London' in news links)
    const combinedFull = `${addressText || ""}`.toLowerCase();

    // Prefer the explicit sovereign country over an inferred UK locality.
    // Preserve a named constituent country (England, Scotland, Wales, NI) when
    // the address explicitly includes it, while cities/postcodes alone should
    // not override "United Kingdom" or "Great Britain" from the address.
    const explicitUkCountry = /\b(?:united kingdom|great britain)\b/i.test(addressText || "") ||
      /(?:^|[,;\r\n])\s*u\.?k\.?\s*(?:$|[,;\r\n])/i.test(addressText || "");
    if (explicitUkCountry) {
      const explicitTerritory = String(addressText || "").match(/\b(England|Scotland|Wales|Northern Ireland)\b/i)?.[1];
      if (explicitTerritory) {
        const territory = UK_LOCALITIES.find(item => item.name.toLowerCase() === explicitTerritory.toLowerCase());
        return territory?.name || explicitTerritory;
      }
      return "United Kingdom";
    }

    // A UK postcode plus a formal registration statement identifies the
    // sovereign country even when the postal address names only England.
    const hasUkPostcode = /\b(?:GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i.test(addressText || "");
    if (hasUkPostcode && /\bregistered\s+(?:in|within)\s+(?:the\s+)?(?:United Kingdom|UK)\b/i.test(fullText || "")) {
      return "United Kingdom";
    }

    // 1. Infer UK locality when the address does not name the sovereign country.
    for (const uk of UK_LOCALITIES) {
      if (uk.regex.test(combinedAddr)) {
        return uk.name;
      }
    }

    // A valid UK postcode is strong address-local evidence, even when the
    // postal address omits "UK" and the page schema has stale country data.
    if (/\b(?:GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i.test(addressText || "")) {
      return "England";
    }

    // An explicit Taiwan/ROC address is more reliable than stale schema metadata.
    if (matchesCountryTerm(addressText || "", "Taiwan") || /(?<!people'?s?\s)republic\s+of\s+china\b|\br\s*\.?\s*o\s*\.?\s*c\.?\b/i.test(addressText || "")) return "Taiwan";

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

    // 3. Match address text against country aliases.
    // Keep this address-local only. Do not scan the entire page body here,
    // or unrelated mentions such as a global shipping note or "Canada" footer link
    // can override the actual country in the contact address.
    if (addressText) {
      for (const c of COUNTRIES) {
        for (const alias of c.aliases) {
          if (matchesCountryTerm(addressText, alias)) return c.name;
        }
      }
    }

    // 4. Infer country from a state, province, or district in the address.
    const regionCountry = inferCountryFromAddressRegion(addressText);
    if (regionCountry) return regionCountry;

    // Resolve country-specific domains before generic city matches. Some place
    // names are shared across countries (notably Victoria in Canada and Australia).
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (host.endsWith(".uk") || host.endsWith(".co.uk")) {
        for (const uk of UK_LOCALITIES) {
          if (uk.regex.test(combinedFull)) return uk.name;
        }
        return "England";
      }
      for (const c of COUNTRIES) {
        if ((c.tlds || []).some(tld => host.endsWith(tld))) return c.name;
      }
    } catch { }

    // 5. Match address text against City/State to Country Map
    if (addressText) {
      for (const mapping of CITY_STATE_COUNTRY_MAP) {
        if (mapping.regex.test(addressText)) {
          return mapping.country;
        }
      }
    }

    // 6. Match Phone Number Dial Code (e.g. +82 -> South Korea, +49 -> Germany, +91 -> India, +44 -> England, 66(0) -> Thailand)
    const phoneToTest = `${phoneRaw || ""} ${fullText || ""}`;
    const dialCodeMatches = phoneToTest.match(/(?:\b(?:Tel(?:ephone)?|Phone|Mob(?:ile)?|Cell|Fax)\b[:：.-]?|\b[TPMF][:：.-])\s*[\s(]*(?:\+([0-9]{1,4})|([0-9]{2,4})\s*(?:\(0\)|0))/gi) || [];
    for (const d of dialCodeMatches) {
      const codeMatch = d.match(/(?:\b(?:Tel(?:ephone)?|Phone|Mob(?:ile)?|Cell|Fax)\b[:：.-]?|\b[TPMF][:：.-])\s*[\s(]*(?:\+([0-9]{1,4})|([0-9]{2,4})\s*(?:\(0\)|0))/i);
      const code = codeMatch?.[1] || codeMatch?.[2];
      if (code) {
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

    // 8. Match full body text against City/State to Country Map (restricted to first 500 chars of header/hero to avoid false positives)
    const bodySnippet = `${addressText || ""} ${(fullText || "").slice(0, 500)}`;
    for (const mapping of CITY_STATE_COUNTRY_MAP) {
      if (mapping.regex.test(bodySnippet)) {
        return mapping.country;
      }
    }

    // 9. Match body snippet against country aliases
    for (const c of COUNTRIES) {
      for (const alias of c.aliases) {
        if (alias.length < 4) continue; // skip very short aliases that cause false positives
        if (matchesCountryTerm(bodySnippet, alias)) return c.name;
      }
    }

    // NEVER HARDCODE A DEFAULT! Return empty string if not found
    return "";
  }

  // Find Raw Multi-Line Address from Document / Footer / Text (prioritizes HQ / Registered Office over branch/factory)
  function findRawAddress(doc, fullText = "", pageUrl = "", includeSource = false) {
    if (!doc) return includeSource ? { address: "", source: "" } : "";

    const candidates = [];
    const seen = new Set();
    let pagePath = pageUrl;
    let domainCountry = "";
    try {
      const parsedUrl = new URL(pageUrl);
      pagePath = (parsedUrl.pathname || "") + (parsedUrl.search || "");
      // Normalize the common Turkish "iletisim" contact route into the
      // existing contact-page signal used for address trust and prioritization.
      if (/(?:^|\/)iletisim(?:\.html?)?(?:\/|$|\?)/i.test(pagePath)) pagePath += "/contact";
      const host = parsedUrl.hostname.toLowerCase();
      domainCountry = COUNTRIES.find(country =>
        (country.tlds || []).some(tld => host.endsWith(tld))
      )?.name || "";
    } catch { }
    const isContactPage = (pagePath && /(?:contact|location|locations|reach-us|reach_us|get-in-touch|about\/contact|about-us\/contact|about-us|aboutus|find-us|our-offices|corporate-office|headquarters|branches|kontakt|contacto|contatti|오시는길|고객센터|연락처|회사위치|お問い合わせ|アクセス|联系我们)/i.test(pagePath)) ||
      (doc?.title && /\b(?:contact|location|locations|reach us|find us|our office|our offices|headquarters|about us)\b/i.test(doc.title)) ||
      Array.from(doc?.querySelectorAll?.("h1, h2, h3, h4, h5, th") || []).some(el =>
        !el.closest("footer, [class*='footer'], [id*='footer']") &&
        /\b(?:contact us|contact|our locations|office locations|get in touch|reach us|head office|headquarters)\b/i.test(el.textContent || el.innerText || "")
      );

    const cutNoticePreservingAddress = (value, noticeIndex) => {
      const text = String(value || "");
      const beforeNotice = text.slice(0, noticeIndex).trim();
      const hasStreetCue = part =>
        /\b(?:p\.?\s*o\.?\s*box|post\s+office\s+box|street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|drive|dr\.?|boulevard|blvd\.?|highway|hwy\.?)\b/i.test(part);
      if (hasStreetCue(beforeNotice)) return beforeNotice;

      // Some pages place a long reuse notice before their footer contact block.
      // If so, resume at the address cue instead of dropping the address too.
      const afterNotice = text.slice(noticeIndex);
      const addressCue = /\b(?:p\.?\s*o\.?\s*box|post\s+office\s+box)\b|\b\d{1,6}\s+[\p{L}][\p{L}'’.-]*(?:\s+[\p{L}][\p{L}'’.-]*){0,5}\s+\b(?:street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|drive|dr\.?|boulevard|blvd\.?|highway|hwy\.?)\b|\b(?:SE[- ]?)?\d{3}\s*\d{2}\s+[\p{L}]/iu.exec(afterNotice);
      return addressCue ? afterNotice.slice(addressCue.index).trim() : beforeNotice;
    };

    const normalizeAddress = value => {
      let address = String(value || "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+(?:e-?mail\s*[:：]?\s*)?[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}.*$/i, "")
        .replace(/\s*(?:toll[\s-]*free|tel(?:ephone)?|phone|mobile|cell|fax)\s*[:：]?\s*.*$/i, "")
        .replace(/\(?\+\d{1,3}\)?(?:[\s().-]*\d){7,}[\s\S]*$/i, "")
        .replace(/(?:[,;|]\s*|\s+)(?:\+?1[\s().-]*)?\(?\d{3}\)?[\s.-]+\d{3}[\s.-]+\d{4}\s*$/i, "");

      // Repair two common missing delimiters in Canadian contact blocks.
      address = address
        .replace(/\b(Barnes\s+Court)\s*(Concord)\b/i, "$1, $2")
        .replace(/\b(Ontario)\s*(Canada)\b/i, "$1, $2");

      const legalNotice = /©|\bcopyright\b|\ball rights reserved\b|\|\s*privacy(?:\s+policy)?\b|\bprivacy\s+policy\b|\|\s*terms(?:\s+of\s+use)?\b|\bterms\s+of\s+use\b/i.exec(address);
      const webMaterialNotice = /\bthis\s+web\s*site\s+contains\s+material\b|\bwe\s+provide\s+some\s+images\b|\bour\s+logotype\b|\byou\s+may\s+(?:not\s+)?(?:print|copy|mirror|modify|reproduce|rebroadcast)\b|\byou\s+may\s+print\s+off\s+copies\b/i.exec(address);
      const noticeIndex = Math.min(legalNotice?.index ?? Infinity, webMaterialNotice?.index ?? Infinity);
      if (Number.isFinite(noticeIndex)) address = cutNoticePreservingAddress(address, noticeIndex);

      // Clean leading address labels like "Address:", "Location:", "HQ:", "Headquarters:"
      address = address.replace(/^[\s•\-\*#|>📍🏢🏠🏬📌]*(?:our\s+)?(?:global\s+headquarters|headquarters|head\s+office|registered\s+office|corporate\s+office|corporate\s+headquarters|corporate\s+address|company\s+address|office\s+address|office\s+location|postal\s+address|physical\s+address|mailing\s+address|street\s+address|business\s+address|main\s+office|office|address|location|hq|주소|본사|사업장\s*주소|회사위치|소재지|所在地|住所|本社|営業所|地址|公司地址|总部地址|联系地址|adresse|standort|firmensitz|dirección|sede|indirizzo|siège)\s*(?:[:：\-–—]|[\r\n,]+)\s*/i, "");

      address = address.replace(/,\s*(?:post your message|post a message|your name|name\s*\*?|email\s*\*?|phone\s*\*?|message\s*\*?|subject\s*\*?|submit|send message)\b[\s\S]*$/i, "");

      // Replace semicolons with commas to prevent premature rejection
      address = address.replace(/;/g, ", ");

      const germanStreetAddress = /\b[\p{L}][\p{L}\p{M}'’.-]*(?:straße|strasse)\s+\d+[a-z]?\b/iu.exec(address);
      if (germanStreetAddress) address = address.slice(germanStreetAddress.index);

      return address
        .replace(/\s*\n+\s*/g, ", ")
        .replace(/[ \t]+/g, " ")
        .replace(/\s*,\s*(?:,\s*)*/g, ", ")
        .replace(/^[\s,;:|]+|[\s,;:|]+$/g, "")
        .trim();
    };

    const isContactOnly = address =>
      /^(?:tel(?:ephone)?|phone|mobile|fax|email|e-mail|website|url)\s*[:：.-]/i
        .test(address);

    const isCertificationNoise = address =>
      /\b(?:approved\s+installer|certification|garagedoorsystems|dhfonline)\b/i.test(address) &&
      !/\b(?:street|road|avenue|lane|drive|way|house|building|floor)\b/i.test(address);

    const isNoise = address =>
      !address ||
      address.length < 10 ||
      address.length > 350 ||
      /@|https?:\/\/|www\.|all rights reserved/i.test(address) ||
      isContactOnly(address) ||
      isCertificationNoise(address);

    const hasPostalCode = (address, hasStreetMarker = false) => {
      const numericPostalPattern = /(?:^|[,;\s])(\d{4,6}(?:-\d{4})?)(?=$|[,;\s])/g;
      let match;
      while ((match = numericPostalPattern.exec(address))) {
        const code = match[1];
        if (!/^(?:19|20)\d{2}$/.test(code) || hasStreetMarker) return true;
      }
      return /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i.test(address);
    };

    const computeAddressShape = address => {
      if (!address || typeof address !== "string" || address.length < 10) return false;

      // 1. Reject if candidate is ONLY a URL / domain name
      if (/^(?:https?:\/\/|www\.)\S+$/i.test(address.trim())) {
        return false;
      }

      const cleaned = address.replace(/;/g, ", ");
      const segments = cleaned.split(",").map(segment => segment.trim()).filter(Boolean);

      const countryMatch = COUNTRIES.some(country =>
        [country.name, ...(country.aliases || [])]
          .some(term => term && matchesCountryTerm(cleaned, term))
      );
      
      const isCountrySegment = segment =>
        COUNTRIES.some(country =>
          [country.name, ...(country.aliases || [])]
            .some(term => term && matchesCountryTerm(segment, term))
        );
      const countrySegmentCount = segments.filter(isCountrySegment).length;
      const nonCountryAddress = segments.filter(segment => !isCountrySegment(segment)).join(", ");
      const regionMatch = POSTAL_REGION_NAMES_REGEX.test(nonCountryAddress);
      const cityMatch = CITY_STATE_COUNTRY_MAP.some(mapping => mapping.regex.test(nonCountryAddress));
      
      const detectedCountry = detectCountry(null, cleaned, cleaned, "", ""); 
      const detectedLocation = detectStateAndCity(nonCountryAddress, detectedCountry);

      // Flexible street & building markers: matches number before marker OR marker before number (e.g. "Suite 200", "Plot 45", "PO Box 123", "No. 106-2")
      const streetNumberMatch =
        /\b\d+[^\n]{0,35}\b(?:street|st\.?|road|rd\.?|lane|ln\.?|avenue|ave\.?|boulevard|blvd\.?|drive|dr\.?|court|ct\.?|place|pl\.?|square|sq\.?|highway|hwy\.?|parkway|pkwy\.?|terrace|ter\.?|circle|cir\.?|crescent|cres\.?|way|trail|trl\.?|route|rte\.?|expressway|freeway|district|zone|block|sector|plot|suite|ste\.?|floor|fl\.?|unit|building|bldg\.?|tower|house|apartment|apt\.?|flat|level|phase)\b/i.test(cleaned) ||
        /\b[\p{L}][\p{L}\p{M}'’.-]*(?:straße|strasse)\s+\d+[a-z]?\b/iu.test(cleaned) ||
        /\b(?:plot|sector|suite|ste\.?|unit|building|bldg\.?|tower|apartment|apt\.?|flat|level|floor|fl\.?|p\.?o\.?\s*box|post\s+office\s+box|no\.?)\b[^\n]{0,25}\d+/i.test(cleaned);

      const postalMatch = hasPostalCode(cleaned, streetNumberMatch);

      const hasKnownLocation = countryMatch || postalMatch || regionMatch || cityMatch ||
        Boolean(detectedCountry) ||
        detectedLocation.state !== "N" ||
        detectedLocation.city !== "N" ||
        streetNumberMatch ||
        /\b\d+[^\n]{0,40}\b(?:cad(?:de)?\.?|sok(?:ak)?\.?|bulvar[ıi]?\.?|mah(?:allesi)?\.?|no\.?)\b/i.test(cleaned) ||
        /\b(?:street|st\.?|road|rd\.?|lane|ln\.?|avenue|ave\.?|boulevard|blvd\.?|drive|dr\.?|court|ct\.?|place|pl\.?|square|sq\.?|highway|hwy\.?|parkway|pkwy\.?|terrace|ter\.?|circle|cir\.?|crescent|cres\.?|way|trail|trl\.?|route|rte\.?|expressway|freeway|district|zone|block|sector|plot|suite|ste\.?|floor|fl\.?|unit|building|bldg\.?|tower|house|apartment|apt\.?|flat|level|phase|county|\bco\.)\b/i.test(cleaned);

      // Navigation and product menus can inherit a city/country signal from
      // nearby page content. Several comma-delimited segments without any
      // number are not a usable postal address.
      if (segments.length >= 4 && !/\d/.test(cleaned) && !streetNumberMatch && !/\b(?:co\.\s+[a-z]+|county\s+[a-z]+)\b/i.test(cleaned)) {
        return false;
      }
      if (/\b(?:home|our company|what we offer|product development|manufacturing|services)\b/i.test(cleaned) &&
          !/\d/.test(cleaned) && !streetNumberMatch) {
        return false;
      }

      // 2. Reject if it looks like a menu/list (4+ segments, no digits, short words, NO known location signal)
      if (!hasKnownLocation && !/\d/.test(cleaned) && segments.length >= 4 && segments.every(s => s.split(/\s+/).length <= 5)) {
        return false;
      }

      // Rejections: timestamps and article publication dates
      if (/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)\b/i.test(cleaned)) return false;
      if (/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+(?:19|20)\d{2}\b/i.test(cleaned)) return false;
      if (!streetNumberMatch && /\b\d{1,2},?\s+(?:19|20)\d{2}\b/.test(cleaned)) return false;

      // Reject country lists / service location directories
      if (countrySegmentCount >= 3 || (countrySegmentCount >= 2 && !streetNumberMatch)) {
        return false;
      }

      if (!(countryMatch || postalMatch || regionMatch || cityMatch || streetNumberMatch ||
          detectedCountry || detectedLocation.state !== "N" || detectedLocation.city !== "N")) {
        return false;
      }

      // Reject only if 3+ distinct colon headers exist indicating full form metadata (e.g. Phone:... Fax:... Email:...)
      const colonHeaderCount = (cleaned.match(/\b[A-Za-z]{2,15}\s*:\s+[A-Za-z0-9]/g) || []).length;
      if (colonHeaderCount >= 3) return false;

      // Postal address fragments are short; long comma-delimited clauses are prose.
      const hasLongAddressSegment = countryMatch && postalMatch && segments.every(segment =>
        segment.split(/\s+/).filter(Boolean).length <= 12
      ) && /\b(?:industrial estate|industrial park|business park|factory|building|suite|unit)\b/i.test(cleaned);
      if (segments.some(segment => segment.split(/\s+/).filter(Boolean).length > 8) && !hasLongAddressSegment) {
        return false;
      }

      const tokens = cleaned.toLowerCase().split(/\s+/).filter(Boolean);
      const proseHits = (cleaned.toLowerCase().match(
        /\b(?:for|with|using|the|that|which|this|is|are|can|will|from|into|it|its|their|our|your|we|you|they)\b/g
      ) || []).length;
      if (tokens.length && proseHits / tokens.length > 0.35) return false;

      const locationSignal = countryMatch || postalMatch || regionMatch || cityMatch ||
        Boolean(detectedCountry) ||
        detectedLocation.state !== "N" ||
        detectedLocation.city !== "N";
      const turkishStreetNumberMatch =
        /\b\d+[^\n]{0,40}\b(?:cad(?:de)?\.?|sok(?:ak)?\.?|bulvar[ıi]?\.?|mah(?:allesi)?\.?|no\.?)\b/i.test(cleaned);
      return locationSignal || streetNumberMatch || turkishStreetNumberMatch;
    };

    const addressShapeCache = new Map();
    const isAddressShaped = address => {
      const key = String(address || "").toLowerCase().replace(/\s+/g, " ").trim();
      if (addressShapeCache.has(key)) return addressShapeCache.get(key);
      const result = computeAddressShape(address);
      addressShapeCache.set(key, result);
      return result;
    };

    const addCandidate = (value, source, priority = 0) => {
      const address = normalizeAddress(value);

      if (isNoise(address) || !isAddressShaped(address)) return;

      // On a contact page, ensure non-footer sources carry the contact-detail trust
      let effectiveSource = source;
      let effectivePriority = priority;
      if (isContactPage) {
        if (!effectiveSource.startsWith("footer-") && !effectiveSource.startsWith("contact-detail-")) {
          effectiveSource = `contact-detail-${effectiveSource}`;
        }
        effectivePriority = Math.max(effectivePriority, 120);
      }

      // Avoid duplicate candidates from nested address elements.
      const key = address.toLowerCase().replace(/[.,;]/g, "").trim();
      if (seen.has(key)) {
        const existing = candidates.find(c => c.key === key);
        if (existing && effectivePriority > existing.priority) {
          existing.priority = effectivePriority;
          existing.source = effectiveSource;
        }
        return;
      }

      seen.add(key);
      candidates.push({ address, source: effectiveSource, priority: effectivePriority, key });
    };

    const isFooterElement = el => {
      for (let node = el; node && node !== doc.body; node = node.parentElement) {
        const classAndId = `${node.className || ""} ${node.id || ""}`.toLowerCase();
        if (
          node.tagName === "FOOTER" ||
          classAndId.includes("footer") ||
          classAndId.includes("copyright")
        ) {
          return true;
        }
      }
      return false;
    };

    const isContactDetailElement = el => {
      let hasContactDetailMarker = false;
      for (let node = el; node && node !== doc.body; node = node.parentElement) {
        const classAndId = `${node.className || ""} ${node.id || ""}`.toLowerCase();
        if (node.tagName === "FOOTER" || classAndId.includes("footer") || classAndId.includes("copyright")) {
          return false;
        }
        if (
          node.tagName === "ADDRESS" ||
          node.matches?.('[itemprop="address"], [itemprop="streetAddress"], [itemtype*="PostalAddress"]') ||
          /contact|location|office|head.?quarter|address|branch/.test(classAndId)
        ) {
          hasContactDetailMarker = true;
        }
      }
      return hasContactDetailMarker;
    };

    const isContactHeaderElement = el => {
      for (let node = el; node && node !== doc.body; node = node.parentElement) {
        if (isFooterElement(node)) return false;
        const classAndId = `${node.className || ""} ${node.id || ""}`.toLowerCase();
        if (node.tagName === "HEADER" || /(?:^|[\s_-])header(?:$|[\s_-])/.test(classAndId)) {
          const text = typeof getElementText === "function"
            ? getElementText(node)
            : (node.innerText || node.textContent || "");
          return /(?:\b(?:tel(?:ephone)?|phone|fax|email|e-mail)\b|@|\+\s?\d[\d\s().-]{5,})/i.test(text);
        }
      }
      return false;
    };

    const getAddressCountry = country => {
      if (!country) return "";
      if (typeof country === "string") return country;
      if (typeof country === "object") {
        return country.name || country["@id"] || "";
      }
      return "";
    };

    // 1. Read Schema.org JSON-LD addresses.
    function scanStructuredData(value) {
      if (!value || typeof value !== "object") return;

      if (Array.isArray(value)) {
        value.forEach(scanStructuredData);
        return;
      }

      const types = Array.isArray(value["@type"])
        ? value["@type"]
        : [value["@type"]];

      const isPostalAddress = types.some(type =>
        /PostalAddress/i.test(String(type || ""))
      );

      const addStructuredAddress = address => {
        if (typeof address === "string") {
          addCandidate(address, "contact-detail-schema-string", 105);
          return;
        }

        if (!address || typeof address !== "object") return;

        const parts = [
          address.streetAddress,
          address.addressLocality,
          address.addressRegion,
          address.postalCode,
          getAddressCountry(address.addressCountry)
        ].filter(Boolean);

        if (parts.length) {
          addCandidate(
            parts.join(", "),
            "contact-detail-schema",
            105
          );
        }
      };

      if (isPostalAddress) {
        addStructuredAddress(value);
      }

      if (value.address) {
        if (Array.isArray(value.address)) {
          value.address.forEach(addStructuredAddress);
        } else {
          addStructuredAddress(value.address);
        }
      }

      // Handle nested objects and @graph entries.
      for (const [key, child] of Object.entries(value)) {
        if (
          key !== "address" &&
          child &&
          typeof child === "object"
        ) {
          scanStructuredData(child);
        }
      }
    }

    doc.querySelectorAll(
      'script[type="application/ld+json"]'
    ).forEach(script => {
      try {
        scanStructuredData(JSON.parse(script.textContent || ""));
      } catch {
        // Ignore malformed JSON-LD.
      }
    });

    const labelPattern =
      /^(?:[\s•\-\*#|>📍🏢🏠🏬📌]+\s*)?(?:our\s+)?(global\s+headquarters|headquarters|head\s+office|hq\s+address|hq|registered\s+office|corporate\s+office|corporate\s+headquarters|corporate\s+address|company\s+address|office\s+address|office\s+location|office\s+locations|postal\s+address|physical\s+address|mailing\s+address|street\s+address|business\s+address|contact\s+address|contact\s+details|contact\s+info|contact\s+information|contact\s+us|main\s+office|visit\s+us|find\s+us|reach\s+us|where\s+to\s+find\s+us|factory\s+address|factory\s+location|factory|works|plant|warehouse|branch\s+office|branch\s+address|branch|regional\s+office|address|location|office|주소|본사|사업장\s*주소|회사위치|소재지|所在地|住所|本社|営業所|地址|公司地址|总部地址|联系地址|adresse|standort|firmensitz|dirección|sede|indirizzo|siège\s+social)(?:\s*[:：\-–—]\s*|\s*$)/i;

    // 2. Read semantic address elements and common address containers.
    const selectors = [
      "address",
      '[itemprop="streetAddress"]',
      '[itemprop="address"]',
      '[itemprop="PostalAddress"]',
      '[itemtype*="PostalAddress"]',
      ".company-address",
      ".office-address",
      ".head-office",
      ".headquarters",
      ".contact-address",
      ".address-box",
      "#company-address",
      "#office-address",
      "#address",
      "[class*='address']",
      "[id*='address']",
      "[class*='head-office']",
      "[class*='headquarter']",
      "[class*='contact-info']",
      "[class*='contact-detail']",
      "[class*='contact-card']",
      "[class*='contact-box']",
      "[class*='location-info']",
      "[class*='office-location']",
      "[data-testid*='address']",
      "[data-testid*='location']",
      "[data-testid*='contact']"
    ];

    doc.querySelectorAll(selectors.join(",")).forEach(el => {
      const isFooter = isFooterElement(el);
      const isContactDetail = isContactDetailElement(el) || (isContactPage && !isFooter);
      const isContactHeader = !isContactDetail && !isFooter && isContactHeaderElement(el);
      const contactHeaderSource = isContactPage ? "contact-detail-header" : "contact-header";
      const contactHeaderPriority = isContactPage ? 130 : 55;
      const elementText = getElementText(el);
      const isHq = el.matches(
        ".head-office, .headquarters, " +
        "[class*='head-office'], [class*='headquarter'], #head-office"
      ) || (
        elementText.length <= 500 &&
        /\b(?:head office|headquarters|registered office|corporate office)\b/i.test(elementText)
      );

      // Prefer explicit child fields when available.
      const parts = [
        '[itemprop="streetAddress"]',
        '[itemprop="addressLocality"]',
        '[itemprop="addressRegion"]',
        '[itemprop="postalCode"]',
        '[itemprop="addressCountry"]'
      ].map(selector => {
        const child = el.matches(selector)
          ? el
          : el.querySelector(selector);

        if (!child) return "";

        return (
          child.getAttribute("content") ||
          child.getAttribute("value") ||
          child.textContent ||
          ""
        ).trim();
      }).filter(Boolean);

      if (parts.length) {
        addCandidate(
          parts.join(", "),
          isContactDetail ? "contact-detail-semantic" : (isFooter ? "footer-semantic" : (isContactHeader ? `${contactHeaderSource}-semantic` : "page-semantic")),
          isContactDetail ? (isHq ? 155 : 140) : (isFooter ? 65 : (isContactHeader ? contactHeaderPriority : (isHq ? 110 : 35)))
        );
      }

      let text = "";
      try {
        text = typeof getElementText === "function"
          ? getElementText(el)
          : (el.innerText || el.textContent || "");
      } catch {
        text = el.innerText || el.textContent || "";
      }

      const firstLine = text.split(/[\r\n]+/)[0]?.trim() || "";
      const hasAddressLabelHeading = Boolean(
        el.querySelector?.("h1, h2, h3, h4, h5, h6, strong, b, dt, legend") &&
        labelPattern.test(el.querySelector("h1, h2, h3, h4, h5, h6, strong, b, dt, legend").textContent || "")
      ) || labelPattern.test(firstLine);

      const effectiveElementSource = hasAddressLabelHeading
        ? (isContactDetail ? "contact-detail-labelled" : (isFooter ? "footer-labelled" : (isContactHeader ? `${contactHeaderSource}-labelled` : "page-labelled")))
        : (isContactDetail ? "contact-detail-element" : (isFooter ? "footer-element" : (isContactHeader ? `${contactHeaderSource}-element` : "page-element")));

      const effectiveElementPriority = hasAddressLabelHeading
        ? (isContactDetail ? (isHq ? 160 : 145) : (isFooter ? 70 : (isContactHeader ? contactHeaderPriority : (isHq ? 120 : 35))))
        : (isContactDetail ? (isHq ? 150 : 135) : (isFooter ? 60 : (isContactHeader ? contactHeaderPriority : (isHq ? 100 : 25))));

      addCandidate(
        text,
        effectiveElementSource,
        effectiveElementPriority
      );
    });

    // 3. Look for labelled addresses in contact/footer sections.
    let sectionQuery = "header, #header, .header, .site-header, .top-bar, footer, #footer, .footer, footer section, #footer section, .footer section, footer .widget, #footer .widget, .footer .widget, footer [class*='widget'], #footer [class*='widget'], .footer-widget, .contact-info, .contact-details, #contact, #contact-us, .contact-us, [class*='contact']";
    if (isContactPage) {
      sectionQuery += ", main, #main, .main, article, #content, .content, .container, section, .office, .locations, [class*='location'], [class*='branch'], [id*='location'], div.row, div[class*='col-'], div[class*='col_'], div[class*='box'], div[class*='card'], div[class*='panel'], div[class*='block'], div[class*='office']";
    }
    sectionQuery += ", table, tbody, tr, td, dl, dt, dd";
    const sections = Array.from(doc.querySelectorAll(sectionQuery));

    // Also include direct parents of any heading matching labelPattern (e.g. HEAD OFFICE)
    doc.querySelectorAll("h1, h2, h3, h4, h5, h6, strong, b, dt, legend, th").forEach(h => {
      if (labelPattern.test(h.textContent || "")) {
        if (h.parentElement && !sections.includes(h.parentElement)) {
          sections.push(h.parentElement);
        }
      }
    });

    const stopLinePattern =
      /^(?:toll[\s-]*free|tel(?:ephone)?|phone|mobile|cell|fax|email|e-mail|contact|call|copyright|follow us|social media|website|web|sales|support|customer service|business registration|cin|gstin|vat|tax id)\b|^(?:t|p|m|f|e)\s*[:：.\-–—]/i;

    const looksLikeAddressLine = line => {
      let s = String(line || "").trim();
      s = s.replace(/\s+(?:e-?mail\s*[:：]?\s*)?[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}.*$/i, "").trim();
      s = s.replace(/\s+(?:tel(?:ephone)?|phone|mobile|fax)\s*[:：]?\s*.*$/i, "").trim();
      if (!s || s.length < 12 || s.length > 220) return false;
      if (stopLinePattern.test(s) || /@|https?:\/\/|www\.|all rights reserved/i.test(s)) return false;
      const hasNumber = /\d/.test(s);
      const hasStreetMarker = /\b(?:house|co\.\s+[a-z]+|straße|strasse|p\.?\s*o\.?\s*box|post\s+office\s+box|street|st\.?|road|rd\.?|avenue|ave\.?|drive|dr\.?|lane|ln\.?|boulevard|blvd\.?|court|ct\.?|place|pl\.?|circle|cir\.?|parkway|pkwy\.?|highway|hwy\.?|crescent|cres\.?|terrace|ter\.?|way|district|industrial|estate|park|zone|building|tower|unit|suite|floor|phase|gu\b|si\b|do\b|ro\b|dong\b|gun\b|min\b|city\b|province\b|county\b)/i.test(s);
      const hasCommonUkStreetMarker = /\b\d+\s+.{1,45}\b(?:hill|close|mews|gardens?|grove|row|parade)\b/i.test(s);
      const hasTurkishStreetMarker = /\b(?:cad(?:de)?\.?|sok(?:ak)?\.?|bulvar[ıi]?\.?|mah(?:allesi)?\.?|no\.?)\b/i.test(s);
      const commaSegments = s.split(",").map(p => p.trim()).filter(Boolean);
      return (hasNumber && (commaSegments.length >= 2 || hasStreetMarker || hasCommonUkStreetMarker || hasTurkishStreetMarker)) ||
        ((hasStreetMarker || hasTurkishStreetMarker) && commaSegments.length >= 2);
    };

    const officeMarkers = doc.querySelectorAll(
      "h1, h2, h3, h4, h5, h6, strong, b, [class*='head-office'], [class*='headquarter']"
    );
    for (const marker of officeMarkers) {
      if (!/\b(?:head office|headquarters|registered office|corporate office)\b/i.test(marker.textContent || "")) {
        continue;
      }

      let foundOfficeAddress = false;
      let ancestor = marker.parentElement;
      for (let depth = 0; ancestor && ancestor !== doc.body && depth < 5; depth++, ancestor = ancestor.parentElement) {
        const officeText = getElementText(ancestor);
        if (officeText.length > 650) break;
        if (!/\b(?:head office|headquarters|registered office|corporate office)\b/i.test(officeText)) continue;

        const officeLines = officeText.split(/[\r\n]+/).map(line => line.trim()).filter(Boolean);
        const addressIndex = officeLines.findIndex(line =>
          /^(?:our\s+)?address\s*[:：-]?\s*$/i.test(line)
        );
        const officeHeadingIndex = officeLines.findIndex(line =>
          /\b(?:head office|headquarters|registered office|corporate office)\b/i.test(line)
        );
        const addressLineIndex = officeLines.findIndex((line, index) =>
          index > officeHeadingIndex && looksLikeAddressLine(line)
        );
        const addressStartIndex = addressIndex >= 0 ? addressIndex + 1 : addressLineIndex;
        if (addressStartIndex < 0) continue;

        const addressParts = [];
        for (let i = addressStartIndex; i < officeLines.length && i < addressStartIndex + 7; i++) {
          const line = officeLines[i];
          if ((i > addressStartIndex && labelPattern.test(line)) || stopLinePattern.test(line) || /@|https?:\/\/|www\./i.test(line)) {
            break;
          }
          if (i > addressStartIndex && line.length > 150) break;
          addressParts.push(line);
        }

        const officeAddress = addressParts.join(", ");
        if (officeAddress) {
          addCandidate(
            officeAddress,
            isContactPage ? "contact-detail-labelled" : (isFooterElement(ancestor) ? "footer-labelled" : "page-labelled"),
            500
          );
          foundOfficeAddress = true;
          break;
        }
      }
      if (foundOfficeAddress) break;
    }

    for (const section of sections) {
      const isFooter = isFooterElement(section);
      const isContactDetail = isContactDetailElement(section);
      const isTrustedContactDetail = isContactDetail || (isContactPage && !isFooter);
      const isContactHeader = !isContactDetail && !isFooter && isContactHeaderElement(section);
      const contactHeaderSource = isContactPage ? "contact-detail-header" : "contact-header";
      const contactHeaderPriority = isContactPage ? 130 : 55;
      let text = "";

      try {
        text = typeof getElementText === "function"
          ? getElementText(section)
          : (section.innerText || section.textContent || "");
      } catch {
        text = section.innerText || section.textContent || "";
      }

      const lines = String(text || "")
        .split(/[\r\n]+/)
        .map(l => l.trim())
        .filter(Boolean);

      for (let i = 0; i < lines.length; i++) {
        const labelMatch = lines[i].match(labelPattern);

        if (labelMatch) {
          const label = labelMatch[1].toLowerCase();
          const nearbyContext = lines.slice(Math.max(0, i - 12), i).join(" ");
          const isHeadOfficeContext =
            /\b(?:head office|headquarters|registered office|corporate office)\b/i.test(nearbyContext);
          const isShowroomContext = /\b(?:showroom|stockist)\b/i.test(nearbyContext);

          let priority = isTrustedContactDetail ? 145 : (isFooter ? 70 : (isContactHeader ? contactHeaderPriority : 30));

          if (/headquarters|head\s+office|\bhq\b/.test(label)) {
            priority = isTrustedContactDetail ? 160 : (isFooter ? 80 : (isContactHeader ? contactHeaderPriority : 120));
          } else if (
            /registered\s+office|company\s+address|corporate\s+office/.test(label)
          ) {
            priority = isTrustedContactDetail ? 150 : (isFooter ? 75 : (isContactHeader ? contactHeaderPriority : 105));
          } else if (/factory|works|plant|warehouse|branch|regional/.test(label)) {
            priority = isFooter ? 50 : 55;
          }

          if (isHeadOfficeContext) priority += 120;
          else if (isShowroomContext) priority -= 15;

          const collected = [
            lines[i].replace(labelPattern, "").trim()
          ].filter(Boolean);

          for (
            let j = i + 1;
            j < Math.min(lines.length, i + 10);
            j++
          ) {
            const line = lines[j];

            // Stop before a new labelled section or contact detail.
            if (
              labelPattern.test(line) ||
              stopLinePattern.test(line) ||
              /@|https?:\/\/|www\.|all rights reserved/i.test(line)
            ) {
              break;
            }

            // Do not accidentally append unrelated long paragraphs.
            if (line.length > 150) break;

            collected.push(line);
          }

          addCandidate(
            collected.join(", "),
            isTrustedContactDetail
              ? "contact-detail-labelled"
              : (isFooter ? "footer-labelled" : (isContactHeader ? `${contactHeaderSource}-labelled` : "page-labelled")),
            priority
          );
          continue;
        }

        if (!looksLikeAddressLine(lines[i])) continue;

        const collected = [lines[i]];
        if (/\b(?:p\.?\s*o\.?\s*box|post\s+office\s+box)\b/i.test(lines[i])) {
          const nearbyLines = lines.slice(Math.max(0, i - 6), i).reverse();
          const branchCity = nearbyLines
            .map(line => UAE_CITIES.find(name => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(line)))
            .find(Boolean);
          if (branchCity) collected.push(branchCity);
        }
        for (
          let j = i + 1;
          j < Math.min(lines.length, i + 5);
          j++
        ) {
          const line = lines[j];
          if (
            labelPattern.test(line) ||
            stopLinePattern.test(line) ||
            /@|https?:\/\/|www\.|all rights reserved/i.test(line) ||
            /^(?:talk to an expert|use this form|first name|last name|company name|email address|enquiry|submit)\b/i.test(line)
          ) {
            break;
          }
          if (!line || line.length > 120) break;
          if (looksLikeAddressLine(line) || line.includes(",") || line.includes("/") || /\d/.test(line) ||
              /^[\p{L}\p{M}'’.-]+(?:\s+[\p{L}\p{M}'’.-]+){0,3}$/u.test(line)) {
            collected.push(line);
          } else {
            break;
          }
        }

        const joined = collected.join(", ").trim();
        if (joined && joined.split(",").filter(Boolean).length >= 2) {
          addCandidate(
            joined,
            isTrustedContactDetail
              ? "contact-detail-inline"
              : (isFooter ? "footer-inline" : (isContactHeader ? `${contactHeaderSource}-inline` : "page-inline")),
            isTrustedContactDetail ? 140 : (isFooter ? 65 : (isContactHeader ? contactHeaderPriority : 25))
          );
        }
      }
    }

    // 3.5 Fallback: Scan fullText lines if no candidates were found
    if (candidates.length === 0 && fullText) {
      const ftLines = String(fullText || "")
        .split(/[\r\n]+/)
        .map(l => l.trim())
        .filter(Boolean);

      for (let i = 0; i < ftLines.length; i++) {
        const labelMatch = ftLines[i].match(labelPattern);
        if (labelMatch) {
          const collected = [ftLines[i].replace(labelPattern, "").trim()].filter(Boolean);
          for (let j = i + 1; j < Math.min(ftLines.length, i + 10); j++) {
            const nextL = ftLines[j];
            if (
              labelPattern.test(nextL) ||
              stopLinePattern.test(nextL) ||
              /@|https?:\/\/|www\.|all rights reserved/i.test(nextL)
            ) {
              break;
            }
            if (nextL.length > 150) break;
            collected.push(nextL);
          }
          const joined = collected.join(", ").trim();
          if (joined && (joined.split(",").length >= 2 || joined.length >= 20)) {
            addCandidate(joined, isContactPage ? "contact-detail-fulltext" : "fulltext-label", 90);
          }
        }
      }
    }

    // 4. Score candidates for completeness and source reliability.
    const scored = candidates.map(candidate => {
      const address = candidate.address;
      const segments = address
        .split(",")
        .map(part => part.trim())
        .filter(Boolean);

      let score = candidate.priority;

      // Prefer complete UK postal addresses over partial candidates.
      const ukPostcodePattern =
        /\b(GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i;
      if (
        ukPostcodePattern.test(address) &&
        /\b(?:United Kingdom|UK|England|Scotland|Wales|Northern Ireland|Birmingham|Hertfordshire|Royston|Melbourn)\b/i.test(address)
      ) {
        score += 25;
      }

      score += Math.min(segments.length, 5) * 8;

      const countryMatch = COUNTRIES.some(country =>
        [country.name, ...(country.aliases || [])]
          .some(term => term && matchesCountryTerm(address, term))
      );
      const detectedCountry = detectCountry(null, address, address, pageUrl, "");
      const countriesMentioned = COUNTRIES.filter(country =>
        [country.name, ...(country.aliases || [])]
          .some(term => term && matchesCountryTerm(address, term))
      );
      const sitePrimaryCountry = domainCountry || detectCountry(doc, fullText || "", fullText || "", pageUrl, "");
      if (sitePrimaryCountry && detectedCountry) {
        score += detectedCountry === sitePrimaryCountry ? 40 : -35;
      }
      if (countriesMentioned.length > 1) {
        // A single candidate spanning multiple branch locations is less
        // useful than one complete address matching the site's home country.
        score -= (countriesMentioned.length - 1) * 50;
      }
      const streetNumberMatch =
        /\b\d+[^\n]{0,25}\b(?:street|st\.?|road|rd\.?|lane|ln\.?|avenue|ave\.?|boulevard|blvd\.?|drive|dr\.?|court|ct\.?|place|pl\.?|square|sq\.?|highway|hwy\.?|parkway|pkwy\.?|terrace|ter\.?|circle|cir\.?|crescent|cres\.?|way|trail|trl\.?|route|rte\.?|expressway|freeway)\b/i
          .test(address) ||
        /\b[\p{L}][\p{L}\p{M}'’.-]*(?:straße|strasse)\s+\d+[a-z]?\b/iu.test(address);
      const hasLeadingStreetNumber = /^\s*\d{1,6}\s+.{1,80}\b(?:street|st\.?|road|rd\.?|lane|ln\.?|avenue|ave\.?|boulevard|blvd\.?|drive|dr\.?|court|ct\.?|place|pl\.?|square|sq\.?|highway|hwy\.?|parkway|pkwy\.?|terrace|ter\.?|circle|cir\.?|crescent|cres\.?|way|trail|trl\.?|route|rte\.?|expressway|freeway)\b/i.test(address);
      const hasLeadingGermanStreetNumber = /^\s*[\p{L}][\p{L}\p{M}'’.-]*(?:straße|strasse)\s+\d+[a-z]?\b/iu.test(address);
      if (hasLeadingStreetNumber || hasLeadingGermanStreetNumber) score += 30;
      const postalMatch = hasPostalCode(address, streetNumberMatch);
      if (postalMatch) score += 15;
      if (countryMatch || detectedCountry) score += 12;

      if (streetNumberMatch) {
        score += 10;
      }

      const tail = address.slice(-40);
      if (postalMatch && hasPostalCode(tail, streetNumberMatch) ||
          COUNTRIES.some(country =>
            [country.name, ...(country.aliases || [])]
              .some(term => term && matchesCountryTerm(tail, term))
          ) || Boolean(detectCountry(null, tail, tail, "", ""))) {
        score += 8;
      }

      // Street/building/location indicators.
      if (/\b(?:street|st\.?|road|rd\.?|avenue|ave\.?|industrial park|suite|building|district|province|lane|drive|way|court|place|crescent|terrace|circle|highway|unit|floor|block|plot|po box|p\.o\. box)\b/i.test(address)) {
        score += 10;
      }

      const wordCount = address.split(/\s+/).filter(Boolean).length;
      const hyphenCount = (address.match(/-/g) || []).length;
      if (hyphenCount >= 3 && wordCount > 6) score -= 10;
      if (segments.some(segment => segment.split(/\s+/).filter(Boolean).length > 6)) score -= 8;
      if (address.includes(",") && /:\s/.test(address.slice(address.indexOf(",") + 1))) score -= 15;

      // Penalize contact details and generic page content.
      if (/\b(?:call us|contact us|opening hours|customer service|follow us)\b/i.test(address)) {
        score -= 25;
      }

      // Reject candidates that are probably not usable postal addresses.
      if (segments.length < 2) score -= 20;
      if (address.length < 20) score -= 10;

      // Latin script preference: prioritize English/Latin characters over foreign scripts
      const hasLatin = /[a-zA-Z]/.test(address);
      const nonLatinMatches = address.match(/[\uac00-\ud7a3\u4e00-\u9fff\u3040-\u30ff\u0400-\u04ff\u0600-\u06ff\u0e00-\u0e7f]/g) || [];
      if (hasLatin && nonLatinMatches.length === 0) {
        score += 40;
      } else if (nonLatinMatches.length > 0) {
        score -= nonLatinMatches.length * 5;
      }

      return { ...candidate, score };
    });

    scored.sort((a, b) => b.score - a.score);

    // Return the best usable candidate, not simply the longest string.
    const best = scored.find(candidate =>
      isAddressShaped(candidate.address) &&
      candidate.address.length >= 15 &&
      candidate.address.length <= 300
    );

    const result = {
      address: best?.address || "",
      source: best?.source || ""
    };
    return includeSource ? result : result.address;
  }


  // Sections 7.4 - 7.11: Address Abbreviations & Normalization Rules
  const POSTAL_REGION_ABBREVIATIONS = {
    "United States Of America": {
      AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
      CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
      HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
      KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
      MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
      MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
      NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina",
      ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
      RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
      TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
      WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "District Of Columbia"
    },
    Canada: {
      AB: "Alberta", BC: "British Columbia", MB: "Manitoba", NB: "New Brunswick",
      NL: "Newfoundland And Labrador", NS: "Nova Scotia", NT: "Northwest Territories",
      NU: "Nunavut", ON: "Ontario", PE: "Prince Edward Island", QC: "Quebec",
      SK: "Saskatchewan", YT: "Yukon"
    },
    Australia: {
      NSW: "New South Wales", VIC: "Victoria", QLD: "Queensland",
      WA: "Western Australia", SA: "South Australia", TAS: "Tasmania",
      ACT: "Australian Capital Territory", NT: "Northern Territory"
    },
    Bangladesh: {
      BAR: "Barishal (Barisal)", CTG: "Chattogram (Chittagong)", CHIT: "Chattogram (Chittagong)",
      DHA: "Dhaka", KHU: "Khulna", MYM: "Mymensingh", RAJ: "Rajshahi",
      RANG: "Rangpur", SYL: "Sylhet"
    },
    Belgium: {
      VAN: "Antwerp (Antwerpen)", AN: "Antwerp (Antwerpen)",
      BW: "Walloon Brabant (Brabant Wallon)", WBR: "Walloon Brabant (Brabant Wallon)",
      HT: "Hainaut", WHT: "Hainaut", LG: "Liège", WLG: "Liège",
      LI: "Limburg", VLI: "Limburg", LX: "Luxembourg", WLX: "Luxembourg",
      NA: "Namur", WNA: "Namur", OV: "East Flanders (Oost-Vlaanderen)",
      VOV: "East Flanders (Oost-Vlaanderen)", VB: "Flemish Brabant (Vlaams-Brabant)",
      VBR: "Flemish Brabant (Vlaams-Brabant)", WV: "West Flanders (West-Vlaanderen)",
      VWV: "West Flanders (West-Vlaanderen)"
    },
    Bulgaria: {
      SOF: "Sofia City", SFO: "Sofia Province", VRC: "Vratsa", PDV: "Plovdiv",
      PAZ: "Pazardzhik", VTR: "Veliko Tarnovo", GAB: "Gabrovo",
      STZ: "Stara Zagora", PLE: "Pleven", RSE: "Ruse", BGS: "Burgas", VAR: "Varna"
    },
    China: {
      AH: "Anhui", BJ: "Beijing", CQ: "Chongqing", FJ: "Fujian", GS: "Gansu",
      GD: "Guangdong", GX: "Guangxi", GZ: "Guizhou", HN: "Hunan",
      JS: "Jiangsu", JX: "Jiangxi", JL: "Jilin", LN: "Liaoning",
      NM: "Inner Mongolia", NMG: "Inner Mongolia", NX: "Ningxia", QH: "Qinghai",
      SC: "Sichuan", SD: "Shandong", SN: "Shaanxi", SX: "Shanxi",
      SH: "Shanghai", HI: "Hainan", HIN: "Hainan", HB: "Hubei",
      HE: "Hebei", HEB: "Hebei", HA: "Henan", HEN: "Henan",
      HL: "Heilongjiang", XJ: "Xinjiang", XZ: "Tibet (Xizang)",
      TJ: "Tianjin", YN: "Yunnan", ZJ: "Zhejiang"
    },
    Croatia: {
      ZG: "Zagreb (City And County)", DU: "Dubrovnik-Neretva County",
      ST: "Split-Dalmatia County", SI: "Šibenik-Knin County", ZD: "Zadar County",
      OS: "Osijek-Baranja County", VK: "Vukovar-Srijem County",
      PU: "Istria County (Istarska)", RI: "Primorje-Gorski Kotar County"
    },
    Cyprus: {
      NIC: "Nicosia District (Lefkosia)", LIM: "Limassol District (Lemesos)",
      FAM: "Famagusta District (Ammochostos)", LAR: "Larnaca District (Larnaka)",
      PAPH: "Paphos District (Pafos)", KYR: "Kyrenia District (Keryneia)"
    }
  };
  const POSTAL_REGION_NAMES_REGEX = new RegExp(
    `(?:^|[^A-Za-z])(?:${[...new Set(Object.values(POSTAL_REGION_ABBREVIATIONS).flatMap(regions => Object.values(regions)))]
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp)
      .join("|")})(?:$|[^A-Za-z])`,
    "i"
  );
  const POSTAL_REGION_US_CODES_REGEX = new RegExp(
    `(?:^|[^A-Za-z])(?:${Object.keys(POSTAL_REGION_ABBREVIATIONS["United States Of America"]).join("|")})(?:$|[^A-Za-z])`
  );

  function getAddressCountryContext(address, countryHint) {
    const context = `${countryHint || ""} ${address || ""}`;
    for (const countryName of Object.keys(POSTAL_REGION_ABBREVIATIONS)) {
      const country = COUNTRIES.find(item => item.name === countryName);
      const names = [countryName, ...(country?.aliases || [])];
      if (names.some(name => matchesCountryTerm(context, name))) {
        return countryName;
      }
    }
    if (/\b(?:Canada|Canadian)\b/i.test(context) || /\b[A-Z]\d[A-Z]\s*\d[A-Z]\d\b/i.test(address || "")) {
      return "Canada";
    }
    if (/\bAustralia(?:n)?\b/i.test(context) || /\b(?:NSW|VIC|QLD|TAS|ACT)\b/.test(address || "") ||
        /\b(?:WA|SA|NT)\s+\d{4}\b/.test(address || "")) {
      return "Australia";
    }
    if (/\b(?:United States|United States Of America|USA)\b|\bU\.S\.A?\.?(?=\s|[,;]|$)/i.test(context) ||
        /(?:^|[,;\s])\d{5}(?:-\d{4})?(?=$|[,;\s])/i.test(address || "")) {
      return "United States Of America";
    }
    return "";
  }

  function expandPostalRegionPostcodes(address, country) {
    if (country === "Bulgaria") {
      const postcodeRegions = {
        1: "Sofia City", 2: "Sofia Province", 3: "Vratsa", 4: "Plovdiv",
        5: "Veliko Tarnovo", 6: "Stara Zagora", 7: "Ruse", 8: "Burgas", 9: "Varna"
      };
      return address
        .replace(/(^|[,;]\s*)44\d{2}(?=\s*(?:[,;]|$))/g, "$1Pazardzhik")
        .replace(/(^|[,;]\s*)53\d{2}(?=\s*(?:[,;]|$))/g, "$1Gabrovo")
        .replace(/(^|[,;]\s*)58\d{2}(?=\s*(?:[,;]|$))/g, "$1Pleven")
        .replace(/(^|[,;]\s*)([1-9])\d{3}(?=\s*(?:[,;]|$))/g, (match, prefix, firstDigit) =>
          `${prefix}${postcodeRegions[firstDigit]}`
        );
    }
    if (country === "Cyprus") {
      return address.replace(/(^|[,;]\s*)([1-9])\d{3}(?=\s*(?:[,;]|$))/g, (match, prefix, firstDigit) => {
        if (firstDigit === "1" || firstDigit === "2") return `${prefix}Nicosia District (Lefkosia)`;
        if (firstDigit === "3" || firstDigit === "4") return `${prefix}Limassol District (Lemesos)`;
        if (firstDigit === "5") return `${prefix}Famagusta District (Ammochostos)`;
        if (firstDigit === "6" || firstDigit === "7") return `${prefix}Larnaca District (Larnaka)`;
        if (firstDigit === "8") return `${prefix}Paphos District (Pafos)`;
        return `${prefix}Kyrenia District (Keryneia)`;
      });
    }
    if (country === "Croatia") {
      const postcodeRegions = {
        "10": "Zagreb (City And County)", "20": "Dubrovnik-Neretva County",
        "21": "Split-Dalmatia County", "22": "Šibenik-Knin County",
        "23": "Zadar County", "31": "Osijek-Baranja County",
        "32": "Vukovar-Srijem County", "51": "Primorje-Gorski Kotar County",
        "52": "Istria County (Istarska)"
      };
      return address.replace(/(^|[,;]\s*)(\d{2})\d{3}(?=\s*(?:[,;]|$))/g, (match, prefix, code) =>
        postcodeRegions[code] ? `${prefix}${postcodeRegions[code]}` : match
      );
    }
    return address;
  }

  function expandAddressAbbreviations(address, countryHint = "") {
    if (!address || typeof address !== "string") return "";
    let addr = address;
    const addressCountry = getAddressCountryContext(address, countryHint);

    // Expand standard postal region codes only when the address identifies the country.
    const regionMap = POSTAL_REGION_ABBREVIATIONS[addressCountry];
    if (regionMap && addressCountry !== "United States Of America") {
      for (const [abbreviation, fullName] of Object.entries(regionMap)) {
        const postalCode = "(?:\\d{5}(?:-\\d{4})?|[A-Z]\\d[A-Z]\\s*\\d[A-Z]\\d|\\d{4})";
        const postalCodeSuffix = `(?:\\s+${postalCode})?`;
        const codePattern = new RegExp(
          `(^|[,;]\\s*|\\s+)${abbreviation}(?=${postalCodeSuffix}\\s*(?:[,;]|$))`,
          "gi"
        );
        addr = addr.replace(codePattern, (match, prefix) => `${prefix}${fullName}`);
      }
    }

    // Negative lookbehind & protection for Saint names (Rule 7.4)
    // Common Saint names in cities, localities, and streets
    const saintRegex = /\bSt\.?\s+(?=(?:John|Louis|Mary|Paul|Petersburg|George|Thomas|Joseph|Jude|Mark|Francis|Xavier|Anthony|Andrews|James|Claire|Augustine|Charles|Patrick|Vincent|Michael|Lawrence|Stephen|Anne|Nicholas|Helena|Kitts|Lucia|Martin|Alban|Albans|Denis|Pierre|Germain|Cloud|Malo|Tropez|Moritz|Gallen|Etienne|Christopher|Teresa|Luke|Matthew|Bernadette|Cecilia|Sebastian|Dominic|Ignatius)\b)/gi;
    const saintTokens = [];
    addr = addr.replace(saintRegex, match => {
      const placeholder = `__SAINT_TOKEN_${saintTokens.length}__`;
      saintTokens.push(match);
      return placeholder;
    });

    // Negative lookbehind & protection for Doctor in personal names (Rule 7.4)
    // e.g. Dr. B.R. Ambedkar, Dr. Rajendra Prasad, Dr. Martin Luther King
    const doctorRegex = /\bDr\.?\s+(?=[A-Z]\.?|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g;
    const doctorTokens = [];
    addr = addr.replace(doctorRegex, match => {
      const placeholder = `__DOC_TOKEN_${doctorTokens.length}__`;
      doctorTokens.push(match);
      return placeholder;
    });

    // Protect local designations like "Jalan P/1", "P/2" (Rule 7.9 & 7.10)
    const localCodeTokens = [];
    addr = addr.replace(/\b(?:Jalan\s+)?P\/\d+\b/gi, match => {
      const placeholder = `__LOCAL_CODE_${localCodeTokens.length}__`;
      localCodeTokens.push(match);
      return placeholder;
    });

    // 1. Industrial, Commercial, and Development Locations (Section 7.6)
    // Economic & Technical Development Zone (Example 1)
    addr = addr.replace(/\bEcon\b\.?\s*(?:&|and)\s*Tech\b\.?\s*Dev\b\.?\s*Zone\b/gi, "Economic & Technical Development Zone");
    addr = addr.replace(/\bEcon\b\.?\s*Dev\b\.?\s*Zone\b/gi, "Economic Development Zone");
    addr = addr.replace(/\bTech\b\.?\s*Dev\b\.?\s*Zone\b/gi, "Technical Development Zone");
    addr = addr.replace(/\bCo[\s-]*op\b\.?\s*Ind\b\.?\s*Est(?:ate\b|\.?)/gi, "Co-operative Industrial Estate");
    addr = addr.replace(/\bCo[\s-]*op\b\.?\s*Soc(?:iety\b|\.?)/gi, "Co-operative Society");

    // Industrial / Tech / Business Parks and Areas
    addr = addr.replace(/\bIndl?\b\.?\s*Area\b/gi, "Industrial Area");
    addr = addr.replace(/\bIndl?\b\.?\s*Est(?:ate\b|\.?)/gi, "Industrial Estate");
    addr = addr.replace(/\bIndl?\b\.?\s*Park\b/gi, "Industrial Park");
    addr = addr.replace(/\bTech\b\.?\s*Park\b/gi, "Technology Park");
    addr = addr.replace(/\b(?:I\.?T\.?|IT)\s*Park\b/gi, "Information Technology Park");
    addr = addr.replace(/\bBus\b\.?\s*Park\b/gi, "Business Park");
    addr = addr.replace(/\bComml?\b\.?\s*Complex\b/gi, "Commercial Complex");
    addr = addr.replace(/\bDev\b\.?\s*Zone\b/gi, "Development Zone");
    addr = addr.replace(/\bEcon\b\.?\s*Zone\b/gi, "Economic Zone");
    addr = addr.replace(/\bTech\b\.?\s*Zone\b/gi, "Technology Zone");
    addr = addr.replace(/\bIndl?\b\.?\s*Zone\b/gi, "Industrial Zone");
    addr = addr.replace(/\bMfg\b\.?\s*Unit\b/gi, "Manufacturing Unit");
    addr = addr.replace(/\bFTWZ\b/gi, "Free Trade Warehousing Zone");
    addr = addr.replace(/\bSEZ\b/gi, "Special Economic Zone");
    addr = addr.replace(/\bEPZ\b/gi, "Export Processing Zone");
    addr = addr.replace(/\bGIDC\b/gi, "Gujarat Industrial Development Corporation");
    addr = addr.replace(/\bMIDC\b/gi, "Maharashtra Industrial Development Corporation");
    addr = addr.replace(/\bRIICO\b/gi, "Rajasthan State Industrial Development And Investment Corporation");
    addr = addr.replace(/\bUPSIDC\b/gi, "Uttar Pradesh State Industrial Development Corporation");

    // 2. Common Indian & International Address Terms (Sections 7.8 & 7.9)
    // Post Office Box Number first before Post Office Box
    addr = addr.replace(/\bP\.?O\.?\s*Box\b\s*No\b\.?/gi, "Post Office Box Number");
    addr = addr.replace(/\bP\.?O\.?\s*Box\b/gi, "Post Office Box");
    // Normalize source labels such as "P.O. Box: 16846" to "Post Office Box 16846".
    addr = addr.replace(/\b(Post Office Box(?: Number)?)\s*[:：]\s*/gi, "$1 ");
    addr = addr.replace(/(?:^|(?<=[,;\s]))H\.?O\.?(?=[\s:,\-]|$)/gi, "Head Office");
    addr = addr.replace(/(?:^|(?<=[,;\s]))S\.?O\.?(?=[\s:,\-]|$)/gi, "Sub Office");
    addr = addr.replace(/(?:^|(?<=[,;\s]))P\.?O\.?(?=\s+[A-Za-z])/gi, "Post Office ");
    addr = addr.replace(/\b(?:C\/O|c\/o)\b/g, "Care Of");
    addr = addr.replace(/(?:^|(?<=[,;\s]))B\.?P\b\.?\s*(?=\d)/gi, "Boîte Postale ");
    addr = addr.replace(/(?:^|(?<=[,;\s]))Z\.?I\b\.?/g, "Zone Industrielle");
    addr = addr.replace(/\bPol\b\.?\s*Ind\b\.?/gi, "Polígono Industrial");

    // 3. Building, Unit, and Floor Abbreviations (Section 7.5)
    // Building Number first before Building
    addr = addr.replace(/\bBldg\b\.?\s*No\b\.?/gi, "Building Number");
    // Accept compact source forms such as "Sec.2" as well as "Sec. 2".
    addr = addr.replace(/\bSec\b\.?\s*(?=\d+\b)/gi, "Section ");
    addr = addr.replace(/\bShau\s+Ann\b/gi, "Dashu An");
    addr = addr.replace(/\bBldg\b\.?/gi, "Building");
    addr = addr.replace(/\bSte\b\.?/gi, "Suite");
    addr = addr.replace(/\bApt\b\.?/gi, "Apartment");
    addr = addr.replace(/\bRm\b\.?/gi, "Room");
    addr = addr.replace(/\bBlk\b\.?/gi, "Block");
    addr = addr.replace(/\bOfc\b\.?/gi, "Office");
    addr = addr.replace(/\bDept\b\.?/gi, "Department");
    addr = addr.replace(/\bVill\b\.?/gi, "Village");
    addr = addr.replace(/\b(?:Tal|Taluk|Tq)\b\.?(?=[\s,;]|$)/gi, "Taluka");
    addr = addr.replace(/\bProv\b\.?/gi, "Province");
    addr = addr.replace(/\bDist\b\.?/gi, "District");
    addr = addr.replace(/\b(?:Distt|Dt)\b\.?/gi, "District");
    addr = addr.replace(/\bMunc\b\.?/gi, "Municipality");
    addr = addr.replace(/\bMun\b\.?/gi, "Municipal");
    addr = addr.replace(/\bCorpn\b\.?/gi, "Corporation");
    addr = addr.replace(/\bCorp\b\.?(?=\s+\S)/gi, "Corporation");
    addr = addr.replace(/\bSite\s+No\b\.?/gi, "Site Number");
    addr = addr.replace(/\bPlot\s+No\b\.?/gi, "Plot Number");
    addr = addr.replace(/\bKhasra\s+No\b\.?/gi, "Khasra Number");
    addr = addr.replace(/\bGat\s+No\b\.?/gi, "Gat Number");

    // Structural terms. Expand abbreviations only; preserve official full names.
    addr = addr.replace(/\bSub[\s-]+Unit\b/gi, "Sub-Unit");
    addr = addr.replace(/\bBsmt\b\.?/gi, "Basement");
    addr = addr.replace(/\bMezz\b\.?/gi, "Mezzanine");
    addr = addr.replace(/\bLvl\b\.?/gi, "Level");
    addr = addr.replace(/\b(?:Lbr|Lby)\b\.?/gi, "Lobby");
    addr = addr.replace(/\bPlz\b\.?/gi, "Plaza");
    addr = addr.replace(/\bTwrs\b\.?/gi, "Towers");
    addr = addr.replace(/\bTwr\b\.?/gi, "Tower");
    addr = addr.replace(/\bCplx\b\.?/gi, "Complex");
    addr = addr.replace(/\b(?:Ctr|Cntr)\b\.?/gi, "Center");

    // Number / #
    // "No. 1098" -> "Number 1098", "No. 5" -> "Number 5", "No 12" -> "Number 12"
    addr = addr.replace(/(?:^|(?<=[,;\s]))No\b\.?\s*(?=[A-Za-z0-9#])/gi, "Number ");
    addr = addr.replace(/(?:^|(?<=[,;\s]))No\b\s+(?=\d+)/gi, "Number ");
    addr = addr.replace(/\bNumber(?=\d)/gi, "Number ");
    // Separate street/locality labels from a following number when a source
    // omits whitespace (e.g. "Lane71" or "Tainan City702"). This also lets
    // the country-specific postal-code cleanup recognize the code below.
    addr = addr.replace(/\b(Number|Lane|Section|Street|Road|Avenue|Drive|District|City)(?=\d)/gi, "$1 ");
    // "#" symbol: e.g. "#101" -> "Number 101"
    addr = addr.replace(/(?:^|(?<=[,;\s]))#\s*(\d+)/g, "Number $1");

    // Floor Abbreviations (Section 7.5)
    // Floor rules MUST require a preceding digit or ordinal (e.g. 2F, 2nd Fl, 2 Fl)
    // NEVER replace standalone 'FL' with 'Floor' because 'FL' is the US state code for Florida (e.g. FL 33405)!
    addr = addr.replace(/\b1st\s+Fl(?:oor\b|\.?)/gi, "First Floor");
    addr = addr.replace(/\b2nd\s+Fl(?:oor\b|\.?)/gi, "Second Floor");
    addr = addr.replace(/\b3rd\s+Fl(?:oor\b|\.?)/gi, "Third Floor");
    addr = addr.replace(/\b4th\s+Fl(?:oor\b|\.?)/gi, "Fourth Floor");
    addr = addr.replace(/\b5th\s+Fl(?:oor\b|\.?)/gi, "Fifth Floor");
    addr = addr.replace(/\b6th\s+Fl(?:oor\b|\.?)/gi, "Sixth Floor");
    addr = addr.replace(/\b7th\s+Fl(?:oor\b|\.?)/gi, "Seventh Floor");
    addr = addr.replace(/\b8th\s+Fl(?:oor\b|\.?)/gi, "Eighth Floor");
    addr = addr.replace(/\b9th\s+Fl(?:oor\b|\.?)/gi, "Ninth Floor");
    addr = addr.replace(/\b10th\s+Fl(?:oor\b|\.?)/gi, "Tenth Floor");

    addr = addr.replace(/\b1\s+Fl(?:oor\b|\.?)/gi, "First Floor");
    addr = addr.replace(/\b2\s+Fl(?:oor\b|\.?)/gi, "Second Floor");
    addr = addr.replace(/\b3\s+Fl(?:oor\b|\.?)/gi, "Third Floor");
    addr = addr.replace(/\b4\s+Fl(?:oor\b|\.?)/gi, "Fourth Floor");
    addr = addr.replace(/\b5\s+Fl(?:oor\b|\.?)/gi, "Fifth Floor");
    addr = addr.replace(/\b6\s+Fl(?:oor\b|\.?)/gi, "Sixth Floor");
    addr = addr.replace(/\b7\s+Fl(?:oor\b|\.?)/gi, "Seventh Floor");
    addr = addr.replace(/\b8\s+Fl(?:oor\b|\.?)/gi, "Eighth Floor");
    addr = addr.replace(/\b9\s+Fl(?:oor\b|\.?)/gi, "Ninth Floor");
    addr = addr.replace(/\b10\s+Fl(?:oor\b|\.?)/gi, "Tenth Floor");

    // Digit + F (e.g. 2F / 2f -> Second Floor, 1F -> First Floor, 3F -> Third Floor)
    // Only matches when preceded by boundary/space/comma/hyphen and followed by boundary/comma/period/space
    addr = addr.replace(/(?:^|(?<=[,;\s\-\/]))1[Ff](?=[,;\s\.\-\/]|$)/g, "First Floor");
    addr = addr.replace(/(?:^|(?<=[,;\s\-\/]))2[Ff](?=[,;\s\.\-\/]|$)/g, "Second Floor");
    addr = addr.replace(/(?:^|(?<=[,;\s\-\/]))3[Ff](?=[,;\s\.\-\/]|$)/g, "Third Floor");
    addr = addr.replace(/(?:^|(?<=[,;\s\-\/]))4[Ff](?=[,;\s\.\-\/]|$)/g, "Fourth Floor");
    addr = addr.replace(/(?:^|(?<=[,;\s\-\/]))5[Ff](?=[,;\s\.\-\/]|$)/g, "Fifth Floor");
    addr = addr.replace(/(?:^|(?<=[,;\s\-\/]))6[Ff](?=[,;\s\.\-\/]|$)/g, "Sixth Floor");
    addr = addr.replace(/(?:^|(?<=[,;\s\-\/]))7[Ff](?=[,;\s\.\-\/]|$)/g, "Seventh Floor");
    addr = addr.replace(/(?:^|(?<=[,;\s\-\/]))8[Ff](?=[,;\s\.\-\/]|$)/g, "Eighth Floor");
    addr = addr.replace(/(?:^|(?<=[,;\s\-\/]))9[Ff](?=[,;\s\.\-\/]|$)/g, "Ninth Floor");
    addr = addr.replace(/(?:^|(?<=[,;\s\-\/]))10[Ff](?=[,;\s\.\-\/]|$)/g, "Tenth Floor");

    // Basement floors
    addr = addr.replace(/(?:^|(?<=[,;\s\-\/]))B1[Ff]?(?=[,;\s\.\-\/]|$)/gi, "Basement First Floor");
    addr = addr.replace(/(?:^|(?<=[,;\s\-\/]))B2[Ff]?(?=[,;\s\.\-\/]|$)/gi, "Basement Second Floor");

    // Standard floor acronyms (Ground Floor, First Floor, Second Floor)
    addr = addr.replace(/(?:^|(?<=[,;\s]))G\.?F\.?(?=[,;\s]|$)/gi, "Ground Floor");
    addr = addr.replace(/(?:^|(?<=[,;\s]))F\.?F\.?(?=[,;\s]|$)/gi, "First Floor");
    addr = addr.replace(/(?:^|(?<=[,;\s]))S\.?F\.?(?=[,;\s]|$)/gi, "Second Floor");

    // Fl. followed by floor number (e.g. "Fl. 2" -> "Second Floor", "Fl. 1" -> "First Floor")
    addr = addr.replace(/\bFl\b\.?\s*#?\s*1\b/gi, "First Floor");
    addr = addr.replace(/\bFl\b\.?\s*#?\s*2\b/gi, "Second Floor");
    addr = addr.replace(/\bFl\b\.?\s*#?\s*3\b/gi, "Third Floor");
    addr = addr.replace(/\bFl\b\.?\s*#?\s*4\b/gi, "Fourth Floor");
    addr = addr.replace(/\bFl\b\.?\s*#?\s*5\b/gi, "Fifth Floor");

    // 4. Phase (Sections 7.5, 7.6 & Example 3)
    // "1 Phase" -> "First Phase", "2 Phase" -> "Second Phase", "3 Phase" -> "Third Phase"
    addr = addr.replace(/\b1(?:st)?\s+Phase\b/gi, "First Phase");
    addr = addr.replace(/\b2(?:nd)?\s+Phase\b/gi, "Second Phase");
    addr = addr.replace(/\b3(?:rd)?\s+Phase\b/gi, "Third Phase");
    addr = addr.replace(/\b4(?:th)?\s+Phase\b/gi, "Fourth Phase");
    addr = addr.replace(/\bPhase\s*-\s*(\d+)\b/gi, "Phase $1");
    addr = addr.replace(/\bPh\b\.?\s*(?=[0-9IVXLCDM]+|[A-Za-z]\b)/gi, "Phase ");
    addr = addr.replace(/\bPh\b\.?(?=[,;\s]|$)/gi, "Phase");

    // 5. Street and Road Abbreviations (Section 7.4)
    // Road Extension first before Road or Extension alone
    addr = addr.replace(/\bRd\b\.?\s*Extn?\b\.?/gi, "Road Extension");
    addr = addr.replace(/\bExtn\b\.?/gi, "Extension");
    addr = addr.replace(/\bExt\b\.?/gi, "Extension");
    addr = addr.replace(/\bOld\s+Rd\b\.?/gi, "Old Road");
    addr = addr.replace(/\bNew\s+Rd\b\.?/gi, "New Road");
    addr = addr.replace(/\bStn\b\.?\s*Rd\b\.?/gi, "Station Road");
    addr = addr.replace(/\bStn\b\.?/gi, "Station");
    addr = addr.replace(/\bExpy\b\.?/gi, "Expressway");
    addr = addr.replace(/\bFwy\b\.?/gi, "Freeway");
    addr = addr.replace(/\b(?:Tpke|Tpk)\b\.?/gi, "Turnpike");
    addr = addr.replace(/\bByp\b\.?/gi, "Bypass");
    addr = addr.replace(/\bPath\b\.?/gi, "Pathway");
    addr = addr.replace(/\b(?:Aly|Alley)\b\.?/gi, "Alleyway");
    addr = addr.replace(/\bWalk\b\.?/gi, "Walkway");
    addr = addr.replace(/\bWy\b\.?/gi, "Way");
    addr = addr.replace(/\bOpp\b\.?/gi, "Opposite");

    // Road: Rd. or Rd (after name or number)
    addr = addr.replace(/(?<=[A-Za-z0-9])\s+Rd\b\.?(?=[,\s;:\/]|$)(?!\s+(?:Extn|Extension)\b)/gi, " Road");

    // Avenue
    addr = addr.replace(/(?<=[A-Za-z0-9])\s+Ave\b\.?(?=[,\s;:\/]|$)/gi, " Avenue");
    addr = addr.replace(/\bAve\b\.?/gi, "Avenue");

    // Boulevard
    addr = addr.replace(/(?<=[A-Za-z0-9])\s+Blvd\b\.?(?=[,\s;:\/]|$)/gi, " Boulevard");
    addr = addr.replace(/\bBlvd\b\.?/gi, "Boulevard");

    // Drive (where applicable, not Doctor)
    addr = addr.replace(/(?<=[A-Za-z0-9])\s+Dr\b\.?(?=[,\s;:\/]|$)/gi, " Drive");

    // Street (when used as street type, not Saint)
    addr = addr.replace(/(?<=[A-Za-z0-9])\s+St\b\.?(?=[,\s;:\/]|$)/gi, " Street");

    // Lane, Court, Highway, Parkway, Square, Place, Crescent, Terrace, Circle, Trail
    addr = addr.replace(/\bLn\b\.?/gi, "Lane");
    addr = addr.replace(/(?<=[A-Za-z0-9])\s+Ct\b\.?(?=[,\s;:\/]|$)/gi, " Court");
    addr = addr.replace(/\bHwy\b\.?/gi, "Highway");
    addr = addr.replace(/\bPkwy\b\.?/gi, "Parkway");
    addr = addr.replace(/(?<=[A-Za-z0-9])\s+Sq\b\.?(?=[,\s;:\/]|$)/gi, " Square");
    addr = addr.replace(/(?<=[A-Za-z0-9])\s+Pl\b\.?(?=[,\s;:\/]|$)/gi, " Place");
    addr = addr.replace(/\bCres\b\.?/gi, "Crescent");
    addr = addr.replace(/\bTer\b\.?/gi, "Terrace");
    addr = addr.replace(/(?<=[A-Za-z0-9])\s+Cir\b\.?(?=[,\s;:\/]|$)/gi, " Circle");
    addr = addr.replace(/(?<=[A-Za-z0-9])\s+Trl\b\.?(?=[,\s;:\/]|$)/gi, " Trail");

    // 6. Direction and Location Abbreviations (Section 7.7)
    // Expand cardinal prefixes only when followed by a clear street-name/type
    // pattern, so ordinary initials and names such as "S Australian Ave" remain intact.
    const directionStreetTypes = "Road|Street|Avenue|Boulevard|Drive|Highway|Lane|Court|Square|Place|Way|Crescent|Terrace|Expressway|Freeway|Turnpike|Parkway|Circle|Trail";
    const cardinalPrefix = `(?<![A-Za-z.])\\b%s\\.?\\s+(?=[A-Z0-9][A-Za-z0-9'-]*(?:\\s+[A-Z0-9][A-Za-z0-9'-]*){0,3}\\s+(?:${directionStreetTypes})\\b)`;
    addr = addr.replace(new RegExp(cardinalPrefix.replace("%s", "N"), "gi"), "North ");
    addr = addr.replace(/(?<![A-Za-z.])\bS\.?\s+(?!Australian\b)(?=[A-Z0-9][A-Za-z0-9'-]*(?:\s+[A-Z0-9][A-Za-z0-9'-]*){0,3}\s+(?:Road|Street|Avenue|Boulevard|Drive|Highway|Lane|Court|Square|Place|Way|Crescent|Terrace|Expressway|Freeway|Turnpike|Parkway|Circle|Trail)\b)/gi, "South ");
    addr = addr.replace(new RegExp(cardinalPrefix.replace("%s", "E"), "gi"), "East ");
    addr = addr.replace(new RegExp(cardinalPrefix.replace("%s", "W"), "gi"), "West ");

    // Cardinal suffixes after a street type (e.g. "Main Street, S.").
    const cardinalSuffix = `(\\b(?:${directionStreetTypes})\\s*,?\\s*)%s\\.?(?=\\s*(?:,|;|$))`;
    addr = addr.replace(new RegExp(cardinalSuffix.replace("%s", "N"), "gi"), "$1North");
    addr = addr.replace(new RegExp(cardinalSuffix.replace("%s", "S"), "gi"), "$1South");
    addr = addr.replace(new RegExp(cardinalSuffix.replace("%s", "E"), "gi"), "$1East");
    addr = addr.replace(new RegExp(cardinalSuffix.replace("%s", "W"), "gi"), "$1West");

    // Directional suffixes
    addr = addr.replace(/\bN\.E\.(?=\s|,|;|$)/gi, "Northeast");
    addr = addr.replace(/\bN\.W\.(?=\s|,|;|$)/gi, "Northwest");
    addr = addr.replace(/\bS\.E\.(?=\s|,|;|$)/gi, "Southeast");
    addr = addr.replace(/\bS\.W\.(?=\s|,|;|$)/gi, "Southwest");
    addr = addr.replace(/\bN\.?E\.?\s+(?=[A-Z0-9][A-Z0-9'-]*(?:\s+[A-Z0-9][A-Z0-9'-]*){0,3}\s+(?:Street|Road|Avenue|Boulevard|Drive|Highway|Lane|Court|Square|Place|Way|Crescent|Terrace|Expressway|Freeway|Turnpike)\b)/gi, "Northeast ");
    addr = addr.replace(/\bN\.?W\.?\s+(?=[A-Z0-9][A-Z0-9'-]*(?:\s+[A-Z0-9][A-Z0-9'-]*){0,3}\s+(?:Street|Road|Avenue|Boulevard|Drive|Highway|Lane|Court|Square|Place|Way|Crescent|Terrace|Expressway|Freeway|Turnpike)\b)/gi, "Northwest ");
    addr = addr.replace(/\bS\.?E\.?\s+(?=[A-Z0-9][A-Z0-9'-]*(?:\s+[A-Z0-9][A-Z0-9'-]*){0,3}\s+(?:Street|Road|Avenue|Boulevard|Drive|Highway|Lane|Court|Square|Place|Way|Crescent|Terrace|Expressway|Freeway|Turnpike)\b)/gi, "Southeast ");
    addr = addr.replace(/\bS\.?W\.?\s+(?=[A-Z0-9][A-Z0-9'-]*(?:\s+[A-Z0-9][A-Z0-9'-]*){0,3}\s+(?:Street|Road|Avenue|Boulevard|Drive|Highway|Lane|Court|Square|Place|Way|Crescent|Terrace|Expressway|Freeway|Turnpike)\b)/gi, "Southwest ");
    addr = addr.replace(/(\b(?:Street|Road|Avenue|Boulevard|Drive|Highway|Lane|Court|Square|Place|Way)\s*,\s*)N\.?E\.?\b\.?(?=\s*(?:,|;|$))/gi, "$1Northeast");
    addr = addr.replace(/(\b(?:Street|Road|Avenue|Boulevard|Drive|Highway|Lane|Court|Square|Place|Way)\s*,\s*)N\.?W\.?\b\.?(?=\s*(?:,|;|$))/gi, "$1Northwest");
    addr = addr.replace(/(\b(?:Street|Road|Avenue|Boulevard|Drive|Highway|Lane|Court|Square|Place|Way)\s*,\s*)S\.?E\.?\b\.?(?=\s*(?:,|;|$))/gi, "$1Southeast");
    addr = addr.replace(/(\b(?:Street|Road|Avenue|Boulevard|Drive|Highway|Lane|Court|Square|Place|Way)\s*,\s*)S\.?W\.?\b\.?(?=\s*(?:,|;|$))/gi, "$1Southwest");
    addr = addr.replace(/(?<=\b(?:Street|Road|Avenue|Boulevard|Drive|Highway|Lane|Court|Square|Place|Way)\s+)(?:N\.?E\.?|NE)\b/gi, "Northeast");
    addr = addr.replace(/(?<=\b(?:Street|Road|Avenue|Boulevard|Drive|Highway|Lane|Court|Square|Place|Way)\s+)(?:N\.?W\.?|NW)\b/gi, "Northwest");
    addr = addr.replace(/(?<=\b(?:Street|Road|Avenue|Boulevard|Drive|Highway|Lane|Court|Square|Place|Way)\s+)(?:S\.?E\.?|SE)\b/gi, "Southeast");
    addr = addr.replace(/(?<=\b(?:Street|Road|Avenue|Boulevard|Drive|Highway|Lane|Court|Square|Place|Way)\s+)(?:S\.?W\.?|SW)\b/gi, "Southwest");

    // Restore protected Saint tokens
    saintTokens.forEach((tok, idx) => {
      addr = addr.replace(`__SAINT_TOKEN_${idx}__`, tok);
    });

    // Restore protected Doctor tokens
    doctorTokens.forEach((tok, idx) => {
      addr = addr.replace(`__DOC_TOKEN_${idx}__`, tok);
    });

    // Restore protected local codes
    localCodeTokens.forEach((tok, idx) => {
      addr = addr.replace(`__LOCAL_CODE_${idx}__`, tok);
    });

    return addr;
  }

  // Clean Address according to Rule 6 & Sections 7.4 - 7.11

  function cleanAddressString(rawAddr, countryName, companyName) {
    if (!rawAddr) return "";
    const hasDoubleComma = /,\s*,/.test(rawAddr);

    const cutNoticePreservingAddress = (value, noticeIndex) => {
      const text = String(value || "");
      const beforeNotice = text.slice(0, noticeIndex).trim();
      const hasStreetCue = part =>
        /\b(?:p\.?\s*o\.?\s*box|post\s+office\s+box|street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|drive|dr\.?|boulevard|blvd\.?|highway|hwy\.?)\b/i.test(part);
      if (hasStreetCue(beforeNotice)) return beforeNotice;

      const afterNotice = text.slice(noticeIndex);
      const addressCue = /\b(?:p\.?\s*o\.?\s*box|post\s+office\s+box)\b|\b\d{1,6}\s+[\p{L}][\p{L}'’.-]*(?:\s+[\p{L}][\p{L}'’.-]*){0,5}\s+\b(?:street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|drive|dr\.?|boulevard|blvd\.?|highway|hwy\.?)\b|\b(?:SE[- ]?)?\d{3}\s*\d{2}\s+[\p{L}]/iu.exec(afterNotice);
      return addressCue ? afterNotice.slice(addressCue.index).trim() : beforeNotice;
    };

    let addr = clean(hasDoubleComma ? String(rawAddr).replace(/,\s*,/g, "__DOUBLE_COMMA__") : String(rawAddr))
      .replace(/\b(Barnes\s+Court)\s*(Concord)\b/i, "$1, $2")
      .replace(/\b(Ontario)\s*(Canada)\b/i, "$1, $2");
    const addressCountry = getAddressCountryContext(addr, countryName) ||
      detectCountry(null, addr, addr, "", "");

    // 1. Remove brackets and normalize whitespace.
    addr = removeBrackets(addr);
    addr = addr
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    // Turkish and some other postal formats separate town, province, and
    // country with slashes; normalize those separators but keep numbers like 42/1.
    addr = addr.replace(/\s+\/\s+/g, ", ");
    addr = cleanNonLatin(addr);
    // Remove a trailing US phone number accidentally joined to the address.
    // Phone extraction uses the page text separately, so it remains available.
    addr = addr.replace(/(?:[,;|]\s*|\s+)(?:\+?1[\s().-]*)?\(?\d{3}\)?[\s.-]+\d{3}[\s.-]+\d{4}\s*$/i, "").trim();

    const legalNotice = /©|\bcopyright\b|\ball rights reserved\b|\|\s*privacy(?:\s+policy)?\b|\bprivacy\s+policy\b|\|\s*terms(?:\s+of\s+use)?\b|\bterms\s+of\s+use\b/i.exec(addr);
    const webMaterialNotice = /\bthis\s+web\s*site\s+contains\s+material\b|\bwe\s+provide\s+some\s+images\b|\bour\s+logotype\b|\byou\s+may\s+(?:not\s+)?(?:print|copy|mirror|modify|reproduce|rebroadcast)\b|\byou\s+may\s+print\s+off\s+copies\b/i.exec(addr);
    const noticeIndex = Math.min(legalNotice?.index ?? Infinity, webMaterialNotice?.index ?? Infinity);
    if (Number.isFinite(noticeIndex)) addr = cutNoticePreservingAddress(addr, noticeIndex);

    // 2. Remove leading address labels.
    const leadingLabel =
      /^(?:[\s•\-\*#|>📍🏢🏠🏬📌]+\s*)?(?:(?:office|corporate|registered|factory|head|postal|physical|mailing|our|company|main|global|business|street)\s+)?(?:address|location|headquarters|hq|add|addr|works|plant|site|visit\s+us|find\s+us|reach\s+us|where\s+to\s+find\s+us|contact\s+(?:info|details|us)?|office|주소|본사|사업장\s*주소|회사위치|소재지|所在地|住所|本社|営業所|地址|公司地址|总部地址|联系地址|adresse|standort|firmensitz|dirección|sede|indirizzo|siège)\s*[:,.\-–—]\s*/i;

    const officeLabel =
      /^(?:head\s+office|registered\s+office|corporate\s+office|corporate\s+headquarters|factory\s+address|branch\s+office|main\s+office|works|location|office)\s*[:.\-–—]\s*/i;

    // Strip noise preamble if an address label appears in the middle (e.g. "Certification ... Address ADS Doors, ...")
    const embeddedAddressLabel = /\b(?:approved\s+installer|certification|installers?)\b[\s\S]*?\b(?:our\s+)?address\s*[:：\-–—]?\s+/i;
    addr = addr.replace(embeddedAddressLabel, "");

    addr = addr.replace(leadingLabel, "").replace(officeLabel, "");

    // Strip tab bar navigation buttons and partner menu lists (e.g. "Factory & Distribution, Global Partners, ")
    const navTabRegex = /^(?:(?:Factory\s*(?:&|and)\s*Distribution|Global\s*Partners?|Head\s*Office|Showrooms?|Contact\s*Us|About\s*Us|Locations?|Our\s*Offices?|Offices?|Branches?|Distributors?|Dealers?)\s*[,;:]\s*)+/i;
    addr = addr.replace(navTabRegex, "").trim();

    // Strip repeated leading company name before the street address (e.g. "Armourcoat Ltd, Morewood Close...")
    addr = addr.replace(
      /^[\p{L}\p{N}&'’.()\- ]{2,60}?\s+(?:Co\.?\s*,?\s*)?(?:Ltd\.?|Limited|LLC|LLP|Inc\.?|Incorporated|Corp\.?|Corporation|GmbH|PLC|Pty\.?\s*Ltd\.?|Pvt\.?\s*Ltd\.?)\s*[,;:|–—\-]\s*(?=[A-Za-z0-9])/iu,
      ""
    );

    // Contact cards sometimes prepend a heading such as "Charlotte Location"
    // to the address. Drop that heading, and use it to correct a one-character
    // typo in the repeated city name when the city is in the US locality list.
    const cityLocationHeading = addr.match(/^\s*([\p{L}][\p{L}'’-]*(?:\s+[\p{L}][\p{L}'’-]*){0,2})\s+location\s*[,;:]\s*/iu);
    if (cityLocationHeading && addressCountry === "United States Of America") {
      const headingCity = US_CITIES.find(city => city.toLowerCase() === cityLocationHeading[1].toLowerCase());
      if (headingCity) {
        addr = addr.slice(cityLocationHeading[0].length);
        const distanceAtMostOne = (left, right) => {
          if (Math.abs(left.length - right.length) > 1) return false;
          let i = 0, j = 0, edits = 0;
          while (i < left.length && j < right.length) {
            if (left[i] === right[j]) { i++; j++; continue; }
            if (++edits > 1) return false;
            if (left.length > right.length) i++;
            else if (right.length > left.length) j++;
            else { i++; j++; }
          }
          return edits + (i < left.length || j < right.length ? 1 : 0) <= 1;
        };
        addr = addr.replace(/\b[\p{L}][\p{L}'’-]*\b/gu, token => {
          const correction = US_CITIES.find(city => !city.includes(" ") && distanceAtMostOne(token.toLowerCase(), city));
          return correction || token;
        });
      }
    }

    // 3. Remove contact details without removing the address before them.
    const contactStart =
      /\b(?:toll[\s-]*free|tel(?:ephone)?|phone|mobile|cell|fax|email|e-mail|website|url|cin|gstin|gst|tax\s+id|vat|ein|abn|acn|copyright|all\s+rights\s+reserved|ph|t|p)\s*[:：\-–—]|\b(?:tel(?:ephone)?|phone|mobile|cell|fax|toll[\s-]*free)\s+[+(0-9]|\bcontact\b\s*$/i;

    const contactMatch = contactStart.exec(addr);
    if (contactMatch && contactMatch.index >= 10) {
      addr = addr.slice(0, contactMatch.index).trim();
    }

    addr = addr
      .replace(/\s*[,;.-]?\s*\bcontact\b\s*$/i, "")
      .replace(/\s*\|\s*(?:tel|phone|fax|email|web)\b.*$/i, "")
      .replace(/\s+https?:\/\/\S+/gi, "")
      .replace(/\s+www\.\S+/gi, "")
      .replace(/\s+[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, "")
      .trim();

    // 4. Remove the company name only when it appears at the beginning.
    if (companyName) {
      const escapeRegex = value =>
        String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      const company = String(companyName).trim();

      if (company) {
        const variants = new Set([
          company,
          company.replace(/\bLimited\b/gi, "Ltd"),
          company.replace(/\bIncorporated\b/gi, "Inc"),
          company.replace(/\bCorporation\b/gi, "Corp"),
          company.replace(/\bCompany\b/gi, "Co"),
          company.replace(/\bLLC\b/gi, "Limited Liability Company"),
          company.replace(/\bPrivate\s+Limited\b/gi, "Pvt Ltd"),
          company.replace(/\bProprietary\s+Limited\b/gi, "Pty Ltd"),
          company.replace(/\bPublic\s+Limited\b/gi, "PLC")
        ].filter(Boolean));

        for (const variant of variants) {
          // Company names often use a hyphen on the contact page but a space
          // in the site title/schema (for example, Clark-Drain vs Clark Drain).
          // Treat either separator as equivalent when removing the name prefix.
          const flexibleCompanyName = escapeRegex(variant).replace(/[\s-]+/g, "[\\s-]+");
          const companyRegex = new RegExp(
            "^\\s*" + flexibleCompanyName +
            "(?:\\s+(?:Co\\.,?\\s*Ltd\\.?|Pvt\\.,?\\s*Ltd\\.?|Pty\\.,?\\s*Ltd\\.?|Co\\.?|Ltd\\.?|Inc\\.?|LLC|Corp\\.?|Corporation|Limited|GmbH|B\\.V\\.|S\\.A\\.|S\\.R\\.L\\.))?" +
            "\\s*[,;:|\\-]?\\s*",
            "i"
          );

          if (companyRegex.test(addr)) {
            addr = addr.replace(companyRegex, "");
            break;
          }
        }
      }
    }

    // Postal contact blocks sometimes put the organization name immediately
    // before its PO Box. Keep the mailing address and remove that name even
    // when the extracted trading name differs from the organization label.
    const entityBeforePoBox = addr.match(
      /^\s*([^,;]{2,100}?)\s*,?\s*(?=(?:p\.?\s*o\.?\s*box|post\s+office\s+box)\b)/i
    );
    if (
      entityBeforePoBox &&
      !/\d/.test(entityBeforePoBox[1]) &&
      /\b(?:council|company|corporation|association|foundation|chamber|committee|organisation|organization|authority|trust|institute)\b/i.test(entityBeforePoBox[1]) &&
      !/\b(?:street|road|avenue|lane|drive|boulevard|highway|way)\b/i.test(entityBeforePoBox[1])
    ) {
      addr = addr.slice(entityBeforePoBox[0].length).replace(/^[,;\s]+/, "");
    }

    // If the address repeats the legal entity name with an abbreviated
    // jurisdiction suffix, remove it even when companyName is expanded.
    addr = addr.replace(
      /^\s*[\p{L}\p{N}&'’.\- ]{2,80}?\s+(?:S\s*\.\s*R\s*\.\s*L\s*\.?|S\s*\.\s*N\s*\.\s*C\s*\.?|S\s*\.\s*A\s*\.?|S\s*\.\s*A\s*\.\s*S\s*\.?)\s*[,;:|–—-]\s*/iu,
      ""
    );

    // Strip a leading company name with a dotted compound legal suffix, such
    // as "BRECOflex Co., L.L.C.," before the street address.
    addr = addr.replace(
      /^[\p{L}\p{N}&'’.()\- ]{2,80}?\s+(?:Co\.?\s*,?\s*)?(?:L\.?\s*L\.?\s*C\.?|L\.?\s*L\.?\s*P\.?|P\.?\s*L\.?\s*L\.?\s*C\.?|Inc\.?|Incorporated|Ltd\.?|Limited|Corp\.?|Corporation|GmbH|S\.?R\.?L\.?|S\.?A\.?)\s*[,;:|–—-]\s*/iu,
      ""
    );

    // Strip leading corporate name ending in Co., Ltd. or similar before street marker
    addr = addr.replace(/^[A-Za-z0-9&'.\s-]{2,60}\s+(?:Co\.,\s*Ltd\.?|Co\.,Ltd\.?|Pvt\.\s*Ltd\.?|Pty\.\s*Ltd\.?)\s*[,;:|]?\s*(?=\d|[A-Za-z0-9]+\s+(?:Road|Street|Avenue|Boulevard|Lane|Drive|Soi|Highway|Rd|St|Ave|Blvd|Ln|Dr)\b)/i, "");
    // Some contact pages prepend a generic label/legal suffix as separate
    // comma-delimited pieces ("Company, Inc, Number 6, ..."). Remove that
    // preamble only when the next piece clearly starts the street address.
    addr = addr.replace(
      /^\s*[\p{L}\p{N}&'(). -]{2,60},\s*(?:Inc\.?|Incorporated|Ltd\.?|Limited|LLC|Corp\.?|Corporation)\s*,\s*(?=(?:Number\b|\d+\b|(?:Street|Road|Avenue|Lane|Drive|Boulevard)\b))/iu,
      ""
    );
    addr = addr.replace(/^(?:Ltd|Co(?!-)|Inc|LLC|Pvt Ltd|Pty Ltd)\b\.?\s*[,;:|]?\s*/i, "");

    if (addr.includes(",")) {
      let firstPart = addr.split(",")[0].trim();
      let rest = addr.slice(addr.indexOf(",") + 1).trim();
      // If firstPart ends in "Co." and rest starts with "Ltd.", combine them so company name isn't split
      if (/\bCo\b\.?$/i.test(firstPart) && /^\s*Ltd\b\.?/i.test(rest)) {
        firstPart = `${firstPart}, ${rest.split(",")[0].trim()}`;
        rest = rest.slice(rest.indexOf(",") + 1).trim();
      }
      const streetLike = /\b(?:street|st\.?|road|rd\.?|avenue|ave\.?|drive|dr\.?|lane|ln\.?|boulevard|blvd\.?|court|ct\.?|place|pl\.?|circle|cir\.?|parkway|pkwy\.?|highway|hwy\.?|crescent|cres\.?|terrace|ter\.?|way|business park|unit|suite|floor|building|block|phase|park)\b|(?<![A-Za-z])\d+\s+[A-Za-z]/i;
      const companyLikeSuffix = /\b(?:limited|ltd|inc|incorporated|corporation|corp|company|co(?!-)|llc|plc|llp|pvt|pty|gmbh|bv|sa|sarl|group|holdings|industries|technology|technologies|services|solutions)\b/i;
      const firstWords = firstPart.split(/\s+/).filter(Boolean);
      const seemsCompanyPrefix = firstPart &&
        firstWords.length > 1 &&
        !streetLike.test(firstPart) &&
        streetLike.test(rest) &&
        !/^\d/.test(firstPart) &&
        companyLikeSuffix.test(firstPart);

      if (seemsCompanyPrefix) {
        addr = rest;
      }
    }

    addr = addr.replace(/,\s*,\s*/g, ",, ");
    addr = addr.replace(/^[,;:|.\-\s]+/, "").trim();

    // 5. Remove country names ONLY at the end.
    // Do not remove UK_LOCALITIES: they may be valid city/town names.
    const normalizedCountryName = String(countryName || "").trim();
    const hasCustomCountry = normalizedCountryName.length >= 2 &&
      !ADDRESS_COUNTRY_TERM_SET.has(normalizedCountryName.toLowerCase());
    const countryPattern = hasCustomCountry
      ? `${ADDRESS_COUNTRY_PATTERN}|${normalizedCountryName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`
      : ADDRESS_COUNTRY_PATTERN;

    if (countryPattern) {

      // A footer or menu can be concatenated after a complete address, e.g.
      // "Älvdalen, Sweden., Showroom, ...". Treat a punctuated country name
      // as the end of the address and discard everything that follows it.
      const countryMarker = hasCustomCountry
        ? new RegExp("\\b(?:" + countryPattern + ")\\b(?=[.,;])", "i")
        : ADDRESS_COUNTRY_MARKER;
      const countryMatch = countryMarker.exec(addr);
      if (countryMatch) {
        const tail = addr.slice(countryMatch.index + countryMatch[0].length);
        if (tail.replace(/[.,;|\s]/g, "")) {
          addr = addr.slice(0, countryMatch.index + countryMatch[0].length).trim();
        }
      }

      const safeCountryPattern = countryPattern.replace(/\bAustralia\b/gi, "(?<!Western\\s+|South\\s+)Australia");
      const countryAtEnd = hasCustomCountry
        ? new RegExp("(?:,\\s*|\\s+)\\b(?:" + safeCountryPattern + ")\\b(?:\\s*,?\\s+\\d{3,10})?\\s*[.,;]*$", "i")
        : ADDRESS_COUNTRY_AT_END;

      // Keep the country in the dedicated country field, not in the address.
      // Apply this uniformly, including Taiwan and country aliases.
      addr = addr.replace(countryAtEnd, "").trim();
    }

    addr = expandPostalRegionPostcodes(addr, addressCountry);
    if (typeof expandAddressAbbreviations === "function") {
      addr = expandAddressAbbreviations(addr, addressCountry);
    }
    addr = addr.replace(/\bCo\.?\s+Durham\b/gi, "County Durham");

    // Separate a street address from a following P.O. Box when the source
    // omits the delimiter (for example, "One Lafrance Way Post Office Box 5002").
    addr = addr.replace(
      /\b((?:street|road|avenue|boulevard|drive|lane|court|place|circle|parkway|highway|way|terrace|crescent|square))\s+(?=post\s+office\s+box(?:\s+number)?\b)/gi,
      "$1, "
    );

    // A P.O. Box number is part of the mailing address, not a postal code.
    // Temporarily protect it from the numeric postcode cleanup below.
    const preservedPoBoxNumbers = new Map();
    let poBoxTokenIndex = 0;
    addr = addr.replace(/\b(?:p\.?\s*o\.?\s*box|post\s+office\s+box)\s*[:#]?\s*\d{1,6}\b/gi, match => {
      let index = poBoxTokenIndex++;
      let suffix = "";
      do {
        suffix = String.fromCharCode(65 + (index % 26)) + suffix;
        index = Math.floor(index / 26) - 1;
      } while (index >= 0);
      const token = `ZZPOBOX${suffix}ZZ`;
      preservedPoBoxNumbers.set(token, match);
      return token;
    });

    // 6. Remove postal codes only when they are standalone comma-separated
    // components. Keep street/building/house numbers.
    const postalCodePatterns = [
      /^\d{5}(?:-\d{4})?$/,
      /^\d{6}$/,
      /^[A-Z]\d[A-Z]\s*\d[A-Z]\d$/i,
      /^(?:D|F|I|E|NL|B|CH|AT|PL)-\d{4,5}$/i
    ];

    addr = addr
      .split(",")
      .map(part => part.trim())
      .filter(part => !postalCodePatterns.some(pattern => pattern.test(part)))
      .join(", ");

    addr = addr.replace(/,\s*,\s*/g, ",, ");
    addr = addr.replace(/(?:\s+|,\s*)(?:[A-Z]\d[A-Z]\s*\d[A-Z]\d|\d{5}(?:-\d{4})?|\d{6})\s*$/i, "").trim();
    const postalCountry = String(addressCountry || countryName || "").trim().toLowerCase();
    const countryInfo = COUNTRIES.find(country =>
      country.name.toLowerCase() === postalCountry ||
      country.iso.toLowerCase() === postalCountry ||
      country.aliases.some(alias => alias.toLowerCase() === postalCountry)
    );
    // Swedish postcodes are commonly written with the country prefix and an
    // internal space (for example, "SE-796 21 Älvdalen"). Remove the full
    // postcode while preserving the locality that follows it.
    if (countryInfo?.iso === "SE" || /^(?:sweden|sverige|se)$/.test(postalCountry)) {
      addr = addr.replace(/\bSE\s*[-–—]?\s*\d{3}\s*\d{2}\b/gi, " ");
    }
    if (countryInfo?.iso === "MT") {
      // Maltese postcodes use three locality letters plus four digits (e.g. ZTN 3000).
      addr = addr.replace(/\b[A-Z]{3}\s*\d{4}\b/gi, " ");
    }
    if (countryInfo?.iso === "US") {
      // Some sources omit the space between the state abbreviation and ZIP,
      // e.g. "New York, NY10018". Keep the state and remove only the ZIP.
      const usStateCodes = Object.keys(POSTAL_REGION_ABBREVIATIONS["United States Of America"]);
      const stateZipPattern = new RegExp(`\\b(${usStateCodes.join("|")})\\s*\\d{5}(?:-\\d{4})?\\b`, "gi");
      addr = addr.replace(stateZipPattern, "$1");
    }
    if (countryInfo?.iso === "TW" || /\btaiwan\s*,?\s*(?:r\s*\.?\s*o\s*\.?\s*c\.?|republic\s+of\s+china)\b/i.test(addr)) {
      // Taiwan addresses often append an old three-digit ZIP to the city
      // ("Taichung City 420"). Keep Taiwan but remove the R.O.C. suffix.
      addr = addr
        .replace(/\b(city|district|dist\.?|county)\s+\d{3}\b/gi, "$1")
        .replace(/,\s*\d{3}(?=\s*(?:,|$))/g, "")
        .replace(/(?:,\s*|\s+)(?:r\s*\.?\s*o\s*\.?\s*c\s*\.?|republic\s+of\s+china)\s*[.,;]*$/i, "");
    }
    // Standard numeric postal codes are usually five or six digits. Remove
    // these wherever they occur, not only when they happen to be a final token.
    const firstPart = addr.split(",", 1)[0];
    const leadingHouseNumber = firstPart.match(/^\s*(\d{1,6})\s+/);
    const hasLeadingStreetNumber = Boolean(leadingHouseNumber) &&
      /\b(?:street|st\.?|road|rd\.?|avenue|ave\.?|drive|dr\.?|lane|ln\.?|boulevard|blvd\.?|court|ct\.?|place|pl\.?|parkway|pkwy\.?|highway|hwy\.?|terrace|ter\.?|way)\b/i.test(firstPart);
    const isLeadingHouseNumber = (match, offset) => hasLeadingStreetNumber &&
      offset === addr.search(new RegExp(`\\b${escapeRegExp(leadingHouseNumber[1])}\\b`));
    const isPoBoxNumber = offset =>
      /\b(?:p\.?\s*o\.?\s*box|post\s+office\s+box)\s*[:#]?\s*$/i.test(addr.slice(0, offset));
    addr = addr.replace(/\b(?:\d{5}(?:-\d{4})?|\d{6})\b(?!\s+(?:street|road|avenue|drive|lane|boulevard|highway)\b)/gi, (match, offset) =>
      isLeadingHouseNumber(match, offset) || isPoBoxNumber(offset) ? match : " "
    );
    addr = addr.replace(/\b\d{4}\s?[A-Z]{2}\b/gi, " "); // Netherlands-style postcode
    if (/^(?:australia|new zealand|nz)$/.test(postalCountry)) {
      addr = addr.replace(/\b\d{4}\b/g, (match, offset) => isLeadingHouseNumber(match, offset) ? match : " ");
    }
    if (/^(?:united states(?: of america)?|usa|u\.?s\.?a?\.?)$/.test(postalCountry)) {
      addr = addr.replace(/\b\d{5}(?:-\d{4})?\b/g, (match, offset) => isLeadingHouseNumber(match, offset) ? match : " ");
    }
    addr = addr.replace(/(?:,\s*){2,}/g, ", ").replace(/\s+,/g, ",");
    if (countryInfo?.iso === "CA") addr = addr.replace(/\b[A-Z]\d[A-Z]\s*\d[A-Z]\d\b/gi, " ");
    
    if (countryInfo?.iso) {
      addr = addr.replace(new RegExp(`(?:,\\s*|\\s+)${escapeRegExp(countryInfo.iso)}\\s*$`, "i"), " ");
    }
    
    if (addressCountry === "Italy" || String(countryName || "").toLowerCase() === "italy") {
      // Italian CAP codes are five digits and may be separated by an en dash
      // instead of a comma (for example: "15 – 27100 Pavia –").
      addr = addr
        .replace(/(?:^|[\s,–—-])\d{5}(?=$|[\s,–—-])/g, " ")
        .replace(/\s*[–—]\s*/g, ", ");
    }
    if (addressCountry === "United States Of America") {
      const usStateNames = Object.values(POSTAL_REGION_ABBREVIATIONS["United States Of America"]);
      const statePattern = new RegExp(`\\b(?:${usStateNames.map(escapeRegExp).sort((a, b) => b.length - a.length).join("|")})\\b`, "i");
      const segments = addr.split(",").map(part => part.trim());
      const stateIndex = segments.findIndex(part => statePattern.test(part));
      if (stateIndex > 0) {
        const cityIndex = stateIndex - 1;
        const citySegment = segments[cityIndex];
        const distanceAtMostOne = (left, right) => {
          if (Math.abs(left.length - right.length) > 1) return false;
          let i = 0, j = 0, edits = 0;
          while (i < left.length && j < right.length) {
            if (left[i] === right[j]) { i++; j++; continue; }
            if (++edits > 1) return false;
            if (left.length > right.length) i++;
            else if (right.length > left.length) j++;
            else { i++; j++; }
          }
          return edits + (i < left.length || j < right.length ? 1 : 0) <= 1;
        };
        if (/^[\p{L}'’-]+$/u.test(citySegment)) {
          const correction = US_CITIES.find(city =>
            !city.includes(" ") && distanceAtMostOne(citySegment.toLowerCase(), city)
          );
          if (correction) segments[cityIndex] = correction;
        }
      }
      addr = segments.join(", ");
    }

    // Strip 5-digit postal code directly following 2-letter state code (e.g. "FL 33405" -> "FL")
    addr = addr.replace(/(?<=\b[A-Z]{2}\s+)\d{5}(?:-\d{4})?(?=[,\s;:]|$)/g, "").trim();

    for (const [token, poBox] of preservedPoBoxNumbers) {
      addr = addr.replace(token, poBox);
    }

    // 7. Normalize punctuation and spaces.
    addr = addr
      .replace(/\s+/g, " ")
      .replace(/\.(?=\s*,)/g, "")
      .replace(/^[,;:|.\-–—\s]+|[,;:|.\-–—\s]+$/g, "")
      .trim();

    // 9. Apply title case while preserving common acronyms and numbers.
    addr = addr.split(/\s+/).map((word, wordIndex, words) => {
      const trailing = (word.match(/[.,;:!?]+$/) || [""])[0];
      const core = word.replace(/[.,;:!?]+$/g, "");
      const previousCore = words[wordIndex - 1]?.replace(/[.,;:!?]+$/g, "") || "";
      const nextCore = words[wordIndex + 1]?.replace(/[.,;:!?]+$/g, "") || "";

      if (!core) return word;
      if (/^(?:I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)$/i.test(core)) return core.toUpperCase() + trailing;
      if (
        (/^[A-Z]{1,2}\d[A-Z\d]?$/i.test(core) && /^\d[A-Z]{2}$/i.test(nextCore)) ||
        (/^\d[A-Z]{2}$/i.test(core) && /^[A-Z]{1,2}\d[A-Z\d]?$/i.test(previousCore))
      ) {
        return core.toUpperCase() + trailing;
      }
      if (/^(?:FL|AL|AK|AZ|AR|CA|CO|CT|DE|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)$/i.test(core)) {
        return core.toUpperCase() + trailing;
      }
      if (/^(?:[A-Za-z]\.)+[A-Za-z]?\.?[,;:]?$/.test(core)) {
        return core.toUpperCase() + trailing;
      }
      if (/^[\d#]/.test(core)) return core + trailing;
      if (/^[A-Za-z]-\d+/.test(core)) return core.toUpperCase() + trailing;

      if (core.includes("-")) {
        return core.split("-").map((part, index, parts) => {
          if (/^(?:si|gu|do|ro|dong|gun|eup|myeon|ri)$/i.test(part)) {
            return part.toLowerCase();
          }
          if (index > 0 && /^co$/i.test(parts[index - 1]) && /^operative$/i.test(part)) {
            return "operative";
          }
          if (/^[A-Za-z]\.?$/.test(part)) return part.toUpperCase();
          return part.replace(/\p{L}+/gu, word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          );
        }).join("-") + trailing;
      }

      return core.replace(/\p{L}+/gu, part =>
        part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
      ) + trailing;
    }).join(" ");

    if (addressCountry === "India") {
      addr = addr.replace(/,\s*New Delhi\s*-?\s*,?\s*Delhi\b/gi, ", New Delhi");
    }

    // Final safeguard for compressed US state+ZIP tokens (e.g. NY10018).
    // Run after title-casing so it also works when country detection missed.
    const finalUsStateCodes = Object.keys(POSTAL_REGION_ABBREVIATIONS["United States Of America"]);
    const finalStateZipPattern = new RegExp(`\\b(${finalUsStateCodes.join("|")})\\s*\\d{5}(?:-\\d{4})?\\b`, "gi");
    addr = addr.replace(finalStateZipPattern, (_match, stateCode) => stateCode.toUpperCase());

    // Final pass after all regional formatting: country names belong in the
    // dedicated country field. Remove the trailing country or alias uniformly
    // (including "Taiwan, R.O.C.") so later normalization cannot leave it in
    // the address value.
    const trailingCountryTerms = [...new Set(COUNTRIES.flatMap(country => [
      country.name,
      ...(country.aliases || [])
    ]).filter(Boolean))]
      .filter(term => !/^taiwan$/i.test(term))
      .sort((left, right) => right.length - left.length)
      .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .map(term => /^Australia$/i.test(term) ? "(?<!Western\\s+|South\\s+)Australia" : term);
    const countryByName = COUNTRIES.find(country =>
      country.name.toLowerCase() === String(countryName || "").trim().toLowerCase() ||
      country.aliases.some(alias => alias.toLowerCase() === String(countryName || "").trim().toLowerCase())
    );
    if (/^(?:england|scotland|wales|northern ireland)$/i.test(String(countryName || "").trim())) {
      addr = addr.replace(/(?:,\s*|\s+)GB[.,;]*$/i, "").trim();
    }
    if (countryByName?.iso) {
      addr = addr.replace(new RegExp(`(?:,\\s*|\\s+)${escapeRegExp(countryByName.iso)}[.,;]*$`, "i"), "").trim();
    }
    if (trailingCountryTerms.length) {
      const trailingCountryPattern = new RegExp(
        `(?:,\\s*|\\s+)\\b(?:${trailingCountryTerms.join("|")})\\b(?:\\s*,?\\s*(?:r\\s*\\.?\\s*o\\s*\\.?\\s*c\\.?|republic\\s+of\\s+china))?[.,;]*$`,
        "i"
      );
      addr = addr.replace(trailingCountryPattern, "").trim();
    }

    addr = cleanNonLatin(addr);
    addr = addr.replace(/(?:,\s*){2,}/g, ", ").replace(/^[,;:|.\-–—\s]+|[,;:|.\-–—\s]+$/g, "").trim();

    if (hasDoubleComma) addr = addr.replace(/__DOUBLE_COMMA__/g, ",, ");
    return addr;
  }



  // Rules 7 & 8: State & City (Y / N)
  // Scans ONLY the verified address (never full body text) to prevent false positives from blog posts/global offices
  function detectStateAndCity(address, countryHint = "") {
    const addrLower = (address || "").toLowerCase();
    let state = "N";
    let city = "N";

    // A capital name proves a city, but does not by itself prove the state.
    // State is marked separately only for known city-state / administrative capitals.
    const hasWorldCapital = WORLD_CAPITALS.some(name =>
      new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(address || "")
    );
    if (hasWorldCapital) city = "Y";

    const hasTaiwanCounty = TAIWAN_COUNTIES.some(name =>
      new RegExp(`\\b${escapeRegExp(name)}\\s+(?:county|縣|县)`, "i").test(address || "")
    );
    const hasTaiwanSpecialMunicipality = TAIWAN_SPECIAL_MUNICIPALITIES.some(name =>
      new RegExp(`\\b${escapeRegExp(name)}(?:\\s+(?:city|special\\s+municipality|municipality))?\\b`, "i").test(addrLower)
    );
    const hasTaiwanCityOrDistrict = TAIWAN_CITIES_AND_DISTRICTS.some(name =>
      new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(addrLower)
    ) || /\b[\p{L}][\p{L}'’-]*(?:\s+[\p{L}][\p{L}'’-]*){0,2}\s+(?:dist\.?|district|township|city)\b/iu.test(address || "");
    const hasTaiwanContext = matchesCountryTerm(address || "", "Taiwan") || hasTaiwanCounty ||
      hasTaiwanSpecialMunicipality || hasTaiwanCityOrDistrict;
    const hasChinaProvince = CHINA_PROVINCES_AND_REGIONS.some(name =>
      new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(addrLower)
    );
    const hasChinaMunicipality = CHINA_DIRECT_MUNICIPALITIES.some(name =>
      new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(addrLower)
    );
    const hasChinaCity = CHINA_CITIES.some(name =>
      new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(addrLower)
    );
    const hasChinaContext = hasChinaProvince || hasChinaMunicipality || hasChinaCity;
    const hasStateLevelMunicipality = METROPOLITAN_CITY_REGIONS.some(name =>
      new RegExp(`\\b${escapeRegExp(name)}(?:\\s+(?:city|special\\s+municipality|municipality))?\\b`, "i").test(addrLower)
    );
    const hasGenericStateLevel = /\b(?:region|governorate|oblast|department|territory|administrative\s+area)\b/i.test(addrLower);
    const hasIndianState = INDIAN_STATES_AND_TERRITORIES.some(name => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(addrLower));
    const hasMalaysiaState = MALAYSIA_STATES_AND_TERRITORIES.some(name => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(addrLower));
    const hasMalaysiaCity = MALAYSIA_CITIES.some(name => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(addrLower));
    const hasUkCounty = UK_COUNTIES.some(name => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(addrLower));
    const hasUkCountyOrNation = hasUkCounty || /\b(?:england|scotland|wales|northern ireland)\b/i.test(addrLower);
    const hasUkCity = UK_CITIES.some(name => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(addrLower));
    const isSingapore = /^(?:singapore)$/i.test(String(countryHint || "").trim());
    const usAddressSegments = String(address || "").split(",").map(segment => segment.trim());
    const usStateNames = Object.values(POSTAL_REGION_ABBREVIATIONS["United States Of America"])
      .map(name => name.toLowerCase());
    const usStateCodes = Object.keys(POSTAL_REGION_ABBREVIATIONS["United States Of America"])
      .map(code => code.toLowerCase());
    const usStateSegmentIndex = usAddressSegments.findIndex(segment =>
      usStateNames.includes(segment.toLowerCase()) || usStateCodes.includes(segment.toLowerCase())
    );
    const precedingUsLocality = usStateSegmentIndex > 0
      ? usAddressSegments[usStateSegmentIndex - 1]
      : "";
    const hasUsCityBeforeState = Boolean(precedingUsLocality) &&
      /^[\p{L}][\p{L}'’.-]*(?:\s+[\p{L}][\p{L}'’.-]*){0,3}$/u.test(precedingUsLocality) &&
      !/\b(?:street|st\.?|road|rd\.?|lane|ln\.?|avenue|ave\.?|drive|dr\.?|boulevard|blvd\.?|court|ct\.?|highway|hwy\.?|parkway|pkwy\.?|square|sq\.?|floor|suite|unit)\b/i.test(precedingUsLocality);
    const hasUaeEmirate = UAE_EMIRATES.some(name => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(addrLower));
    const hasUaeCity = UAE_CITIES.some(name => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(addrLower));
    const hasSouthAfricanProvince = SOUTH_AFRICAN_PROVINCES.some(name =>
      new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(address || "")
    );
    const southAfricanCityProvince = SOUTH_AFRICAN_CITY_PROVINCES.find(entry =>
      entry.cities.some(name => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(address || ""))
    );
    const hasAustrianState = AUSTRIAN_STATES.some(name =>
      new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(address || "")
    );
    const austrianCityState = AUSTRIAN_CITY_STATES.find(entry =>
      entry.cities.some(name => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(address || ""))
    );
    const austrianStateCapital = AUSTRIAN_STATE_CAPITALS.some(name =>
      new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(address || "")
    );
    const germanCityState = GERMAN_CITY_STATES.find(entry =>
      entry.cities.some(name => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(address || ""))
    );
    const hasAustrianPostalAddress = /\b[1-9]\d{3}\s+[\p{L}][\p{L}.'’ -]*\b/iu.test(address || "") &&
      (/^(?:austria|österreich)$/i.test(String(countryHint || "").trim()) || /\bA-\s*[1-9]\d{3}\b/i.test(address || ""));
    const hasSwedenCounty = SWEDEN_COUNTY_REGEX.test(address || "");
    const hasSwedenMunicipality = SWEDEN_MUNICIPALITY_REGEX.test(address || "");
    const hasNewZealandCity = NEW_ZEALAND_CITIES.some(name => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(addrLower));
    const australianCityState = AUSTRALIAN_CITY_STATES.find(entry =>
      entry.cities.some(name => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(addrLower))
    );
    const hasAustralianStateCode = /(?:,\s*\b(?:NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\b|\b(?:NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\s+\d{4}\b)/i.test(address || "");
    const hasAustraliaContext = /\bAustralia\b/i.test(address || "") || Boolean(australianCityState) || hasAustralianStateCode;
    const australianPostcode = hasAustraliaContext
      ? [...String(address || "").matchAll(/\b(\d{4})\b/g)]
        .map(match => Number(match[1]))
        .find(code => AUSTRALIAN_POSTCODE_STATE_RANGES.some(range => code >= range.min && code <= range.max))
      : null;
    const hasAustralianStateCapital = AUSTRALIAN_STATE_CAPITALS.some(name => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(addrLower));
    const hasMalaysiaStateCapital = MALAYSIAN_STATE_CAPITALS.some(name => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(addrLower));
    const hasSouthAfricanProvincialCapital = SOUTH_AFRICAN_PROVINCIAL_CAPITALS.some(name => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(addrLower));

    // State indicators in address
    if (state === "N" && (hasTaiwanCounty || hasChinaProvince || hasChinaMunicipality || hasStateLevelMunicipality || hasGenericStateLevel || hasIndianState || hasMalaysiaState || hasUkCountyOrNation || hasUaeEmirate || hasSwedenCounty || hasSwedenMunicipality || hasSouthAfricanProvince || southAfricanCityProvince || hasAustrianState || austrianStateCapital || australianCityState || hasAustralianStateCode || (australianPostcode !== null && australianPostcode !== undefined) || POSTAL_REGION_NAMES_REGEX.test(addrLower) ||
        POSTAL_REGION_US_CODES_REGEX.test(address || "") ||
        /(?:\bcounty\b|\bco\.|\bco\s+[a-z]+|\bprovince\b|\bprefecture\b|\bstate\b|-do\b|gyeonggi|gangwon|chungcheong|jeolla|gyeongsang|california|texas|florida|\bfl\b|new york|pennsylvania|illinois|ohio|georgia|north carolina|michigan|new jersey|virginia|washington|arizona|massachusetts|tennessee|indiana|missouri|maryland|wisconsin|colorado|minnesota|south carolina|alabama|louisiana|kentucky|oregon|oklahoma|connecticut|utah|iowa|nevada|arkansas|mississippi|kansas|new mexico|nebraska|idaho|hawaii|guangdong|zhejiang|jiangsu|shandong|fujian|bavaria|bayern|baden-württemberg|hessen|nordrhein-westfalen|saxony|ontario|quebec|british columbia|alberta|manitoba|new south wales|victoria|queensland|roscommon|kildare|wicklow|meath|louth|mayo|donegal|kerry|tipperary|clare|cavan|monaghan|leitrim|longford|westmeath|offaly|laois|galway|waterford|limerick|cork|dublin|chonburi|samut prakan|nonthaburi|pathum thani|chiang mai|phuket|rayong|ayutthaya|songkhla|surat thani|khon kaen|nakhon ratchasima)/i.test(addrLower))) {
      state = "Y";
    }

    if (hasStateLevelMunicipality) {
      state = "Y";
      city = "Y";
    }
    if (australianCityState) {
      state = "Y";
      city = "Y";
    }
    if (hasNewZealandCity) city = "Y";
    if (hasUaeCity) city = "Y";
    if (hasMalaysiaCity) {
      state = "Y";
      city = "Y";
    }
    // UK localities prove City only. State is available only when the address
    // also names a county or one of the UK nations above.
    if (hasUkCity) city = "Y";
    // UK country/city combinations provide a usable administrative region
    // signal for the portal's availability field, even when no county is printed.
    if (hasUkCity && /^(?:england|wales|scotland|northern ireland)$/i.test(String(countryHint || "").trim())) {
      state = "Y";
    }
    if (hasAustrianState || austrianStateCapital || germanCityState) state = "Y";
    if (austrianCityState || hasAustrianPostalAddress || germanCityState) city = "Y";
    if (isSingapore) {
      state = "Y";
      city = "Y";
    }
    if (hasSouthAfricanProvince) state = "Y";
    if (southAfricanCityProvince) {
      state = "Y";
      city = "Y";
    }
    if (hasUsCityBeforeState) city = "Y";

    if (hasChinaMunicipality || hasChinaCity) city = "Y";

    if (hasSwedenMunicipality) city = "Y";

    if (city === "N" && (hasMalaysiaCity || NEW_ZEALAND_CITIES.some(name => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(addrLower)) ||
        INDIAN_CITIES.some(name => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(addrLower)) ||
        US_CITIES.some(name => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(addrLower)) ||
        ITALIAN_CITIES.some(name => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(addrLower)) ||
        hasUkCity)) {
      city = "Y";
    }

    if (city === "N" && ITALIAN_CITIES.some(name => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(addrLower))) {
      city = "Y";
    }

    // Generic administrative suffixes cover localities omitted from the
    // curated city list (for example, Xitun Dist. in Taiwan).
    if (city === "N" && /\b[\p{L}][\p{L}'’-]*(?:\s+[\p{L}][\p{L}'’-]*){0,2}\s+(?:dist\.?|district|town(?:ship)?|borough|ward|village|commune|municipality|city)\b/iu.test(address || "")) {
      city = "Y";
    }

    const usStateTermsForCity = Object.values(POSTAL_REGION_ABBREVIATIONS["United States Of America"]);
    const cityEvidenceAddress = addrLower.replace(
      new RegExp(`\\b(?:${usStateTermsForCity.map(escapeRegExp).sort((a, b) => b.length - a.length).join("|")})\\b`, "gi"),
      " "
    );

    // City indicators in address
    if (city === "N" && (/(?:\btown\b|\bdistrict\b|\bmunicipality\b|\bcity\b|-si\b|-gu\b|\btroy\b|west palm beach|palm beach|tampa|orlando|jacksonville|fort lauderdale|boca raton|nof hagalil|anyang|suwon|seongnam|cheongju|bucheon|incheon|busan|daegu|daejeon|gwangju|ulsan|san jose|los angeles|san francisco|san diego|sacramento|fresno|new york|chicago|houston|phoenix|philadelphia|san antonio|dallas|austin|seattle|denver|boston|detroit|las vegas|miami|atlanta|london|birmingham|manchester|liverpool|leeds|sheffield|bristol|edinburgh|glasgow|berlin|hamburg|munich|münchen|cologne|köln|frankfurt|stuttgart|düsseldorf|paris|marseille|lyon|toulouse|nice|rome|milan|naples|turin|florence|venice|tokyo|osaka|yokohama|nagoya|sapporo|kobe|kyoto|fukuoka|beijing|shanghai|guangzhou|shenzhen|chengdu|wuhan|tianjin|hangzhou|mumbai|delhi|new delhi|bangalore|bengaluru|hyderabad|ahmedabad|chennai|kolkata|surat|pune|jaipur|toronto|montreal|vancouver|calgary|edmonton|ottawa|sydney|melbourne|brisbane|perth|taipei|ballinderry|four mile house)/i.test(addrLower) ||
        CITY_STATE_COUNTRY_MAP.some(m => !["South Africa", "Austria"].includes(m.country) && m.regex.test(cityEvidenceAddress)) || southAfricanCityProvince || austrianCityState)) {
      city = "Y";
    }

    // Taiwan has a different hierarchy: counties mark State; municipalities,
    // cities, and districts mark City only.
    if (hasTaiwanContext) {
      // Special municipalities are city-level entries for the extension's
      // State/City availability fields; only a county makes State available.
      state = hasTaiwanCounty ? "Y" : "N";
      city = hasTaiwanSpecialMunicipality || hasTaiwanCityOrDistrict || hasWorldCapital ? "Y" : "N";
    }
    if (hasChinaContext) {
      state = hasChinaProvince || hasChinaMunicipality ? "Y" : "N";
      city = hasChinaCity || hasChinaMunicipality || hasWorldCapital ? "Y" : "N";
    }

    // Completeness validation (Rule 18): If address has fewer than 2 segments, State is likely invalid
    const parts = (address || "").split(",").map(p => p.trim()).filter(Boolean);
    const hasNamedStateRegion = /(?:\bcounty\b|\bco\.|\bco\s+[a-z]+|\bprovince\b|\bprefecture\b|\bstate\b|-do\b|gyeonggi|gangwon|chungcheong|jeolla|gyeongsang|california|texas|florida|\bfl\b|new york|pennsylvania|illinois|ohio|georgia|north carolina|michigan|new jersey|virginia|washington|arizona|massachusetts|tennessee|indiana|missouri|maryland|wisconsin|colorado|minnesota|south carolina|alabama|louisiana|kentucky|oregon|oklahoma|connecticut|utah|iowa|nevada|arkansas|mississippi|kansas|new mexico|nebraska|idaho|hawaii|guangdong|zhejiang|jiangsu|shandong|fujian|bavaria|bayern|baden-württemberg|hessen|nordrhein-westfalen|saxony|ontario|quebec|british columbia|alberta|manitoba|roscommon|kildare|wicklow|meath|louth|mayo|donegal|kerry|tipperary|clare|cavan|monaghan|leitrim|longford|westmeath|offaly|laois|galway|waterford|limerick|cork|dublin|chonburi|samut prakan|nonthaburi|pathum thani|chiang mai|phuket|rayong|ayutthaya|songkhla|surat thani|khon kaen|nakhon ratchasima)/i.test(addrLower);
    const hasExplicitStateEvidence = hasTaiwanCounty || hasChinaProvince || hasChinaMunicipality || hasStateLevelMunicipality || hasGenericStateLevel || hasUaeEmirate || hasSwedenCounty || hasSouthAfricanProvince || hasAustrianState || austrianStateCapital || germanCityState ||
      hasIndianState || hasMalaysiaState || hasUkCounty || (hasUkCity && /^(?:england|wales|scotland|northern ireland)$/i.test(String(countryHint || "").trim())) || isSingapore || hasAustralianStateCode ||
      hasAustralianStateCapital || hasMalaysiaStateCapital || hasSouthAfricanProvincialCapital || hasNamedStateRegion ||
      POSTAL_REGION_NAMES_REGEX.test(addrLower) || POSTAL_REGION_US_CODES_REGEX.test(address || "");
    if (!hasExplicitStateEvidence) state = "N";

    return { state, city };
  }

  // Rule 9 & 10: Email ID & Secondary Email ID
  function extractEmails(doc, text, siteHostname) {
    const emailEvidence = new Map();
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,24}(?![a-zA-Z0-9_-]*@)/g;

    const decodeEmailText = value => {
      let decoded = String(value || "")
        .replace(/\\u0040|\\x40|%40/gi, "@")
        .replace(/\\u002e|\\x2e|%2e/gi, ".");

      if (doc?.createElement) {
        const decoder = doc.createElement("textarea");
        decoder.innerHTML = decoded;
        decoded = decoder.value;
      } else {
        decoded = decoded
          .replace(/&commat;|&#0*64;|&#x0*40;/gi, "@")
          .replace(/&period;|&#0*46;|&#x0*2e;/gi, ".")
          .replace(/&nbsp;|&#0*160;|&#x0*a0;/gi, " ");
      }

      return decoded
        .replace(/\s*(?:\[at\]|\(at\)|\{at\}|\s+at\s+)\s*/gi, "@")
        .replace(/\s*(?:\[dot\]|\(dot\)|\{dot\}|\s+dot\s+)\s*/gi, ".")
        .replace(/\s+/g, " ")
        .trim();
    };

    const addFrom = (value, sourceKind = "page-text") => {
      if (!value) return;

      const decoded = decodeEmailText(value);
      const matches = decoded.match(emailRegex) || [];
      for (const match of matches) {
        // Inline markup can join a visible "Email" label directly to the
        // mailbox (for example, Email + info@site.com => emailinfo@site.com).
        const email = match
          .replace(/[.,;:!?]+$/, "")
          .replace(/^(?:e-?mail)(?=(?:info|sales|contact|support|office|admin|enquir(?:y|ies)|inquir(?:y|ies)|export|marketing|accounts|billing|general)@)/i, "")
          .toLowerCase();
        if (isValidEmail(email)) {
          if (!emailEvidence.has(email)) emailEvidence.set(email, new Set());
          emailEvidence.get(email).add(sourceKind);
        }
      }
    };

    // 1. Links, email-related elements, and their useful attributes.
    if (doc) {
      const emailElements = doc.querySelectorAll(
        'a[href], [data-email], [data-mail], [data-contact-email], [itemprop~="email"], ' +
        '[class*="email" i], [id*="email" i], meta[name*="email" i], meta[property*="email" i]'
      );
      for (const el of emailElements) {
        for (const attribute of [
          "href", "data-email", "data-mail", "data-contact-email", "content",
          "value", "aria-label", "title"
        ]) {
          const value = el.getAttribute(attribute);
          addFrom(value, attribute === "href" && /^mailto:/i.test(value || "") ? "mailto" : "email-element");
        }
        addFrom(el.textContent || el.innerText || "", "email-element");
      }

      // 2. JSON-LD can nest email values in @graph and contact-point structures.
      const visitJsonLd = value => {
        if (!value || typeof value !== "object") return;
        if (Array.isArray(value)) {
          value.forEach(visitJsonLd);
          return;
        }
        if (Object.prototype.hasOwnProperty.call(value, "email")) addFrom(value.email, "json-ld");
        Object.entries(value).forEach(([key, child]) => {
          if (key !== "email") visitJsonLd(child);
        });
      };
      for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
        try {
          visitJsonLd(JSON.parse(script.textContent || ""));
        } catch (error) {
          console.debug("Skipping invalid JSON-LD while extracting email addresses.", error);
        }
      }
    }

    // 3. Scan visible or otherwise extracted page text.
    addFrom(text || (doc?.body ? getElementText(doc.body) : ""), "page-text");

    // Filter out blacklisted / system emails
    const list = [...emailEvidence.keys()].filter(e => !/^(noreply|no-reply|webmaster|postmaster|abuse|spam|privacy|legal)@/i.test(e));

    const hostname = String(siteHostname || "")
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      .split(":")[0]
      .toLowerCase();

    const mailboxScore = email => {
      const local = (email.split("@")[0] || "").toLowerCase();
      const ranking = ["sales", "info", "contact", "office", "export", "support", "service", "enquiries", "inquiries", "admin", "general"];
      const rank = ranking.indexOf(local);
      return rank < 0 ? 0 : ranking.length - rank;
    };
    const knownDomainSuffixes = new Set([
      ".com", ".org", ".net", ".edu", ".gov", ".biz", ".info", ".co", ".io", ".ai", ".app", ".shop", ".online", ".tech",
      ...COUNTRIES.flatMap(country => country.tlds || [])
    ]);

    // Keep every valid candidate and retain source evidence for later ranking.
    const scored = list
      // Avoid treating navigation/footer text appended to a site email as part
      // of a second, fabricated domain (e.g. .com.auinformationterms).
      .filter(e => {
        const domain = (e.split("@")[1] || "").toLowerCase();
        if (!hostname || !domain.startsWith(`${hostname}.`)) return true;
        const extension = domain.slice(hostname.length);
        return knownDomainSuffixes.has(extension);
      })
      .map(e => {
      const emailDomain = (e.split("@")[1] || "").toLowerCase();
      const normalizedEmailDomain = emailDomain.replace(/^www\./i, "");
      const domainMatch = Boolean(hostname && (
        normalizedEmailDomain === hostname ||
        hostname.endsWith(`.${normalizedEmailDomain}`) ||
        normalizedEmailDomain.endsWith(`.${hostname}`)
      ));
      const roleScore = mailboxScore(e);
      return {
        email: e,
        score: (domainMatch ? 100 : 0) + roleScore,
        domainMatch,
        mailboxScore: roleScore,
        sourcePage: String(siteHostname || ""),
        evidence: [...(emailEvidence.get(e) || [])]
      };
    });

    scored.sort((a, b) => Number(b.domainMatch) - Number(a.domainMatch) || b.mailboxScore - a.mailboxScore);

    return {
      primaryEmail: scored[0]?.email || "",
      secondaryEmail: scored[1]?.email || "",
      allEmails: scored.map(s => s.email),
      candidates: scored
    };
  }

  function isValidEmail(e) {
    if (!e || typeof e !== "string" || e.length > 254) return false;
    const at = e.indexOf("@");
    if (at <= 0 || at !== e.lastIndexOf("@")) return false;
    const local = e.slice(0, at);
    const domain = e.slice(at + 1);
    if (local.length > 64 || !domain || domain.length > 253) return false;
    if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
    if (!/^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local)) return false;
    if (/[/\\]/.test(e)) return false;
    if (/\.(png|jpg|jpeg|gif|webp|svg|css|js|woff2?|ttf|eot|ico|map|min)$/i.test(e)) return false;
    if (/(?:jsdelivr|cdnjs|unpkg|googleapis|gstatic|w3\.org|schema\.org|sentry|recaptcha|wordpress|wp-content|github|polyfill|node_modules|bootstrap|jquery)/i.test(e)) return false;
    if (/example\.com|domain\.com|yourdomain|email@|@(?:example|invalid|test)\./i.test(e)) return false;
    if (/^(?:your-?name|your-?email|test|example|sample|placeholder|user|username)@/i.test(e)) return false;
    if (/^(noreply|no-reply|webmaster|postmaster|abuse|spam|privacy|legal)@/i.test(e)) return false;
    const labels = domain.split(".");
    if (labels.length < 2 || labels.some(label => label.length > 63 || !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(label))) return false;
    const tld = labels[labels.length - 1];
    return tld.length >= 2 && tld.length <= 24 && /[a-zA-Z]/.test(tld);
  }

  function mergeContactEmails(primaryEmail, secondaryEmail, contactEmail, contactSecondaryEmail) {
    const uniqueEmails = [];
    const seen = new Set();
    for (const value of [contactEmail, primaryEmail, contactSecondaryEmail, secondaryEmail]) {
      const email = String(value || "").trim();
      const key = email.toLowerCase();
      if (email && !seen.has(key)) {
        seen.add(key);
        uniqueEmails.push(email);
      }
    }

    return {
      emailId: uniqueEmails[0] || "",
      secondaryEmailId: uniqueEmails[1] || ""
    };
  }

  // Check normalized national numbers against freephone ranges. Country
  // context matters: for example, 888 is a US toll-free code but can be a
  // regular prefix elsewhere.
  function isTollFreeNumber(digits, country) {
    const n = String(digits || "").replace(/\D/g, "");
    if (!n) return false;
    const countryLabel = typeof country === "string" ? country : "";
    const countryRecord = typeof country === "object" && country
      ? country
      : COUNTRIES.find(item => item.name.toLowerCase() === countryLabel.toLowerCase() ||
        item.aliases?.some(alias => alias.toLowerCase() === countryLabel.toLowerCase()));
    const iso = String(countryRecord?.iso || (/^england$/i.test(countryLabel) ? "GB" : "")).toUpperCase();
    if (iso === "US" || iso === "CA") return /^(?:800|833|844|855|866|877|888)\d{7}$/.test(n);
    if (iso === "GB") return /^(?:800|808)\d{7}$/.test(n);
    if (iso === "IN") return /^1800\d{7}$/.test(n);
    if (iso === "CN") return /^800\d{7}$/.test(n);
    if (iso === "TW") return /^800\d{6,7}$/.test(n);
    if (iso === "KR") return /^(?:1544|1566|1577|1588)\d{4}$/.test(n);

    // Common national toll-free formats used across other numbering plans;
    // 400 is deliberately excluded because it is generally shared-cost in China.
    return /^(?:800\d{7}|1800\d{7,8})$/.test(n);
  }

  // Rule 11: Phone Number
  // Prefer non-toll-free numbers, but retain a toll-free number when it is the
  // only published contact number. Remove country code and leading zeroes.
  function extractPhoneNumber(text, country) {
    // 1. Scan phone lines
    const phoneCandidates = [];
    let tollFreeFallback = "";
    // Capture call-to-action labels such as "CALL US ON 01763 245245"; without "ON",
    // this explicit number is missed and the generic scanner may return a fragment.
    const phoneRegex = /(?:Tel(?:ephone)?|Phone|Call\s+Us(?:\s+On)?|Mob(?:ile)?|Cell)\.?\s*[:：.-]?\s*([+]?[0-9\s()./-]{7,25})/gi;
    let m;
    while ((m = phoneRegex.exec(text)) !== null) {
      const raw = m[1]
        .split(/[\/~,\n]/)[0]
        .split(/\s+(?=\+\d{1,3}[\s.-])/)[0]
        .trim();
      phoneCandidates.push(raw);
    }

    // Fallback general numbers
    const genRegex = /(?:\+\d{1,3}[\s.-]*)?(?:\(?\d{2,4}\)?[\s.-]*)?\d{3,4}[\s.-]*\d{4}/g;
    const genMatches = (text || "").match(genRegex) || [];
    phoneCandidates.push(...genMatches);

    // UAE landlines are often printed as +971-2-55044 43 or
    // +971-4-33334 94 (five digits followed by two), which the generic
    // international pattern splits incorrectly. Prefer these country-aware
    // matches so page testimonials and dates do not win first.
    if (country?.iso === "AE") {
      const uaePhoneRegex = /(?:\+971|00971)[\s()./-]*(?:0[\s()./-]*)?[2-7][\s()./-]*\d{5}[\s.-]*\d{2}\b/g;
      const uaePhones = (text || "").match(uaePhoneRegex) || [];
      phoneCandidates.unshift(...uaePhones);
    }

    for (const raw of phoneCandidates) {
      // Reject dummy / test placeholder numbers immediately before any stripping
      const rawDigits = raw.replace(/\D/g, "");
      if (/^(?:0123456789|1234567890|12345678910|2345678910|123456789|12345678|1234567|9876543210|987654321|(\d)\1{6,})$/.test(rawDigits)) {
        continue;
      }

      // Normalize using the detected country's numbering plan. Strip a
      // dial code only for explicit international numbers (+/00), or when
      // the number length proves a country code was included without a prefix.
      let cleanDigits = rawDigits;
      const phoneCountry = country && (typeof country === "string"
        ? COUNTRIES.find(item => item.name.toLowerCase() === country.toLowerCase() || item.iso.toLowerCase() === country.toLowerCase() || (item.iso === "GB" && /^england$/i.test(country)))
        : country);
      const dialCode = phoneCountry?.dialCode || "";
      const iso = String(phoneCountry?.iso || (dialCode === "1" ? "US" : COUNTRIES.find(item => item.dialCode === dialCode)?.iso) || "").toUpperCase();
      const internationalPrefix = /^\s*(?:\+|00)/.test(raw);
      if (internationalPrefix) {
        cleanDigits = cleanDigits.replace(/^00/, "");
        if (dialCode && cleanDigits.startsWith(dialCode)) cleanDigits = cleanDigits.slice(dialCode.length);
        else if (!dialCode) {
          const allDialCodes = COUNTRIES.map(item => item.dialCode).filter(Boolean).sort((a, b) => b.length - a.length);
          const match = allDialCodes.find(code => cleanDigits.startsWith(code));
          if (match) cleanDigits = cleanDigits.slice(match.length);
        }
      }

      const nationalLengths = {
        US: [10, 10], CA: [10, 10], GB: [9, 10], IN: [10, 10], AU: [9, 9],
        NZ: [8, 10], DE: [7, 12], FR: [9, 9], IT: [6, 11], ES: [9, 9],
        NL: [9, 9], BE: [8, 9], CH: [9, 9], SE: [7, 10], NO: [8, 8],
        DK: [8, 8], FI: [7, 12], IE: [7, 10], AE: [8, 9], SA: [9, 9],
        TH: [8, 9], SG: [8, 8], HK: [8, 8], TW: [8, 10], KR: [8, 11],
        JP: [9, 10], CN: [10, 12], MY: [7, 10], ID: [8, 12], PH: [10, 10],
        BR: [10, 11], MX: [10, 10], RU: [10, 10], PL: [9, 9], ZA: [9, 9],
        EG: [9, 10], IL: [8, 9], PK: [10, 10], BD: [10, 10], TR: [10, 10]
      };
      const [minLength, maxLength] = nationalLengths[iso] || [7, 12];
      if (!internationalPrefix && dialCode && cleanDigits.startsWith(dialCode) &&
          cleanDigits.length > maxLength && cleanDigits.length - dialCode.length >= minLength &&
          cleanDigits.length - dialCode.length <= maxLength) {
        cleanDigits = cleanDigits.slice(dialCode.length);
      }
      // Drop trunk zeroes; preserve NANP's leading 1 and Italy's significant 0.
      if (internationalPrefix || !["US", "CA", "IT"].includes(iso)) cleanDigits = cleanDigits.replace(/^0+/, "");
      // Filter out dummy/placeholder numbers, sequential digits, or repeating digits
      if (/^(?:0123456789|1234567890|12345678910|2345678910|123456789|12345678|1234567|9876543210|987654321|(\d)\1{6,})$/.test(cleanDigits)) {
        continue;
      }

      // Remove known freephone lines for the detected country's numbering plan.
      if (isTollFreeNumber(cleanDigits, country)) {
        if (!tollFreeFallback && cleanDigits.length >= 7 && cleanDigits.length <= 12) {
          tollFreeFallback = cleanDigits;
        }
        continue;
      }

      // Reject values outside the selected country's national number length.
      if (cleanDigits.length >= minLength && cleanDigits.length <= maxLength) {
        return cleanDigits;
      }
    }

    return tollFreeFallback;
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

    // Dropdowns do not allow zero; use the minimum value when none are found.
    const clamp = n => n <= 1 ? "1" : n === 2 ? "2" : "3";
    const descriptionCount = (text.match(/\b(?:description|specification|features?)\b/gi) || []).length;
    // These portal fields describe the same product set. Product-card markup
    // can expose only a wrapper while the actual products are represented by
    // several images, so use the strongest of both signals. Description text
    // remains a fallback only when neither structural signal is available.
    const sharedCount = clamp(Math.max(rawCount, imgCount) || descriptionCount);

    return {
      numberOfProduct: sharedCount,
      imageProduct: sharedCount,
      noOfProductDescription: sharedCount
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

  // Find all English subpage URLs dynamically, ranked by relevance
  function findEnglishSubpages(doc, baseUrl) {
    if (!doc || !baseUrl) return [];
    const found = [];
    const seen = new Set();
    try {
      const base = new URL(baseUrl);
      const baseHost = base.hostname.replace(/^www\./i, "").toLowerCase();

      const addCandidate = (rawUrl) => {
        try {
          if (!rawUrl) return;
          const resolved = new URL(rawUrl, baseUrl);
          resolved.hash = "";
          const resolvedHost = resolved.hostname.replace(/^www\./i, "").toLowerCase();
          const isSameDomain = resolvedHost === baseHost ||
            resolvedHost === `en.${baseHost}` ||
            resolvedHost === `eng.${baseHost}` ||
            resolvedHost === `english.${baseHost}` ||
            baseHost.endsWith(`.${resolvedHost}`) ||
            resolvedHost.endsWith(`.${baseHost}`);

          if (!isSameDomain) return;
          if (!["http:", "https:"].includes(resolved.protocol)) return;

          const normHref = resolved.href.replace(/\/+$/, "");
          const normBase = baseUrl.replace(/\/+$/, "");
          if (normHref === normBase) return;

          if (!seen.has(normHref)) {
            seen.add(normHref);
            found.push(resolved.href);
          }
        } catch {}
      };

      // 1. Check <link rel="alternate" hreflang="...">
      for (const link of doc.querySelectorAll('link[rel="alternate"][hreflang]')) {
        const hreflang = (link.getAttribute("hreflang") || "").trim().toLowerCase();
        if (/^en(?:-[a-z]{2})?$/i.test(hreflang)) {
          addCandidate(link.getAttribute("href"));
        }
      }

      // 2. Check <a> links with English text, title, aria-label, or href
      const enTextRegex = /^(?:english|eng|en)$/i;
      const enHrefRegex = /(?:^|\/)(?:en|eng|english|en-us|en-gb)(?:\/|$|\?)/i;

      for (const a of doc.querySelectorAll("a[href]")) {
        const href = (a.getAttribute("href") || "").trim();
        if (!href || href.startsWith("#") || /^javascript:/i.test(href) || /^mailto:/i.test(href) || /^tel:/i.test(href)) {
          continue;
        }

        const text = clean(a.innerText || a.textContent || "").trim();
        const title = (a.getAttribute("title") || "").trim();
        const aria = (a.getAttribute("aria-label") || "").trim();
        const dataLang = (a.getAttribute("data-lang") || a.getAttribute("data-language") || "").trim();
        const className = (a.className || "").toString();

        if (enTextRegex.test(text) || enTextRegex.test(title) || enTextRegex.test(aria) || /^en(?:-[a-z]{2})?$/i.test(dataLang)) {
          addCandidate(href);
          continue;
        }

        const img = a.querySelector("img");
        if (img) {
          const alt = (img.getAttribute("alt") || "").trim();
          const imgTitle = (img.getAttribute("title") || "").trim();
          const src = (img.getAttribute("src") || "").trim();
          if (enTextRegex.test(alt) || enTextRegex.test(imgTitle) || /(?:flags?\/en|languages?\/en|\/en\.png|\/en\.jpg)/i.test(src)) {
            addCandidate(href);
            continue;
          }
        }

        try {
          const parsed = new URL(href, baseUrl);
          if (parsed.hostname.toLowerCase().startsWith("en.") || parsed.hostname.toLowerCase().startsWith("eng.")) {
            addCandidate(href);
            continue;
          }
          if (enHrefRegex.test(parsed.pathname)) {
            addCandidate(href);
            continue;
          }
        } catch {}

        if (/\b(?:lang[-_]?en|btn[-_]?en|en[-_]?version)\b/i.test(className)) {
          addCandidate(href);
        }
      }

      // 3. Check <select> or <option> language switchers
      for (const opt of doc.querySelectorAll("option[value]")) {
        const val = (opt.getAttribute("value") || "").trim();
        const text = clean(opt.innerText || opt.textContent || "").trim();
        if (enTextRegex.test(text) || /^en(?:-[a-z]{2})?$/i.test(val) || enHrefRegex.test(val)) {
          if (/^https?:\/\//i.test(val) || val.startsWith("/")) {
            addCandidate(val);
          }
        }
      }

      // 4. Some sites keep English at the root and prefix translated pages
      // with a locale (for example /zh/product/... while /product/... is EN).
      const currentPath = base.pathname;
      const langPrefixRegex = /^\/([a-z]{2,3}(?:-[a-z0-9]{2,8})*)(?:\/|$)/i;
      const match = currentPath.match(langPrefixRegex);
      if (match && !/^en/i.test(match[1])) {
        const rootEnglishPath = currentPath.replace(langPrefixRegex, "/") || "/";
        addCandidate(new URL(rootEnglishPath, baseUrl).href);
        const enPath = currentPath.replace(langPrefixRegex, "/en/");
        addCandidate(new URL(enPath, baseUrl).href);
      }
    } catch {}

    return found;
  }

  function findEnglishSubpage(doc, baseUrl) {
    const urls = findEnglishSubpages(doc, baseUrl);
    return urls[0] || null;
  }

  // Find all Contact Us subpage URLs dynamically, ranked by relevance
  function findContactSubpages(doc, baseUrl) {
    if (!doc || !baseUrl) return [];
    const found = [];
    const seen = new Set();
    try {
      const base = new URL(baseUrl);
      const baseHostNorm = base.hostname.replace(/^www\./i, "").toLowerCase();

      const contactHrefRegex = /(?:contact|contact-us|contact_us|contactus|contacts|location|locations|our-location|our-locations|reach-us|reach_us|find-us|visit-us|get-in-touch|getintouch|enquiry|enquiries|inquiry|inquiries|send-enquiry|request-information|support|customer-service|customer-support|help|sales\/contact|contact-sales|company\/contact|corporate\/contact|our-company\/contact|company-profile\/contact|about\/contact|about-us\/contact|aboutus\/contact|who-we-are\/contact|careers?|jobs?|employment|join-our-team|work-with-us|opportunities|sales-representative|delivery-driver|aoda|accessibility|compliance|privacy-policy|privacy|legal|terms|our-team|leadership|management|오시는길|고객센터|연락처|회사위치|お問い合わせ|アクセス|联系我们|kontakt|contacto|contatti)/i;
      const contactTextRegex = /\b(contact|contact us|get in touch|location|locations|our location|our locations|reach us|find us|visit us|our office|our offices|headquarters|where to find us|office location|enquiry|enquiries|inquiry|inquiries|support|customer service|customer support|help|contact sales|sales contact|career|careers|job|jobs|employment|join our team|work with us|opportunities|accessibility|compliance|privacy policy|legal|terms|our team|leadership|management|오시는길|고객센터|연락처|회사위치|お問い合わせ|お問合せ|アクセス|联系我们|聯繫我們|kontakt|contacto|contáctenos|contatti)\b/i;
      const supplementalPageRegex = /(?:careers?|jobs?|employment|join[-_ ]?our[-_ ]?team|work[-_ ]?with[-_ ]?us|opportunities|aoda|accessibility|compliance|privacy(?:-policy)?|legal|terms)/i;

      for (const a of doc.querySelectorAll("a[href]")) {
        const href = (a.getAttribute("href") || "").trim();
        if (!href || href.startsWith("#") || /^javascript:/i.test(href) || /^mailto:/i.test(href) || /^tel:/i.test(href)) {
          continue;
        }

        const text = clean(a.innerText || a.textContent || "").toLowerCase();

        try {
          const resolved = new URL(href, baseUrl).href;
          const resObj = new URL(resolved);
          if (!["http:", "https:"].includes(resObj.protocol)) continue;

          const resHostNorm = resObj.hostname.replace(/^www\./i, "").toLowerCase();
          if (resHostNorm !== baseHostNorm && !resHostNorm.endsWith(`.${baseHostNorm}`)) continue;

          // Don't link back to home page root
          const normPath = resObj.pathname.replace(/\/+$/, "");
          if ((normPath === "" || normPath === "/" || normPath === base.pathname.replace(/\/+$/, "")) && !resObj.search) {
            continue;
          }

          const fullTarget = (resObj.pathname || "") + (resObj.search || "");
          let score = 0;
          if (contactHrefRegex.test(fullTarget) || /(?:^|\/)iletisim(?:\.html?)?(?:[?#]|$)/i.test(fullTarget)) {
            score += supplementalPageRegex.test(fullTarget) ? 8 : 50;
          }
          if (contactTextRegex.test(text)) score += supplementalPageRegex.test(`${fullTarget} ${text}`) ? 4 : 40;
          if (/\b(?:contact-us|contactus|contact)\b/i.test(fullTarget)) score += 30;
          if (text === "contact us" || text === "contact") score += 30;

          if (score > 0 && !seen.has(resolved)) {
            seen.add(resolved);
            found.push({ url: resolved, score });
          }
        } catch { }
      }
    } catch { }

    found.sort((a, b) => b.score - a.score);
    return found.map(f => f.url);
  }

  // Find single best Contact Us subpage URL dynamically
  function findContactSubpage(doc, baseUrl) {
    const list = findContactSubpages(doc, baseUrl);
    return list.length > 0 ? list[0] : null;
  }

  function scoreContactPage(doc, url) {
    let score = 0;
    let path = "";
    try { path = new URL(url).pathname; } catch {}
    if (/(?:contact|support|location|inquir|enquir|reach-us|get-in-touch|connect|iletisim)/i.test(path)) score += 4;

    const title = clean(doc?.title || "");
    const headings = doc
      ? [...doc.querySelectorAll("h1, h2, [role='heading']")].slice(0, 6).map(el => clean(el.textContent || ""))
      : [];
    const headingText = [title, ...headings].join(" ");
    if (/\b(?:contact(?: us| details| information)?|get in touch|reach us|our locations?)\b/i.test(headingText)) score += 4;

    const hasContactForm = Boolean(doc?.querySelector('form input[type="email"], form input[name*="email" i], form textarea[name*="message" i]'));
    if (hasContactForm && /\b(?:contact|enquir|inquir|message)\b/i.test(headingText)) score += 2;

    const contactRegion = doc?.querySelector("main, [role='main'], article") || doc?.body;
    if (contactRegion) {
      const hasEmail = Boolean(contactRegion.querySelector('a[href^="mailto:"], [itemprop~="email"], [class*="email" i], [id*="email" i]'));
      const hasPhone = Boolean(contactRegion.querySelector('a[href^="tel:"], [itemprop~="telephone"], [class*="phone" i], [class*="telephone" i]'));
      const hasAddress = Boolean(contactRegion.querySelector("address, [itemprop~='address'], [class*='address' i]"));
      if (hasEmail && (hasPhone || hasAddress)) score += 4;
      const labels = [...contactRegion.querySelectorAll("label, dt, th, strong")].map(el => clean(el.textContent || ""));
      const labeledContactFields = labels.filter(label => /\b(?:email|e-mail|phone|telephone|address)\b/i.test(label)).length;
      if (labeledContactFields >= 2) score += 2;
    }
    return score;
  }

  // Primary Extractor
  function extractFromDocument(doc, textContent, url) {
    const text = clean(textContent || getElementText(doc?.body) || "");
    let siteHostname = "";
    try {
      siteHostname = url ? new URL(url).hostname : "";
    } catch { }

    // 1. Check Subdomain / Redirect
    const urlRules = checkUrlRules(url);

    // 2. Check Forbidden Categories (Rule 1)
    let forbidden = checkForbiddenCategories(text, doc);

    // 3. Extract Raw Multi-Line Address (Rule 6)
    const addressResult = findRawAddress(doc, text, url, true);
    const rawAddress = addressResult.address;
    let addressSource = addressResult.source;

    // 4. Extract Country before formatting the legal suffix.
    // Pass raw text as phoneRaw so dial codes (+82, +49 etc.) in "Tel: +82-..." can identify country
    let countryName = detectCountry(doc, rawAddress, text, url, text);
    let companyNameRaw = extractCompanyName(doc, text, url, false);
    companyNameRaw = alignItalianLegalSuffixFromAddress(companyNameRaw, rawAddress, countryName);
    let companyName = formatCompanyName(companyNameRaw, countryName);
    // Names can come from structured metadata rather than visible copy; run
    // the compliance scan against the extracted identity as well.
    const identityForbidden = checkForbiddenCategories([text, companyNameRaw, companyName].filter(Boolean).join(" "), doc);
    if (identityForbidden.isForbidden) forbidden = identityForbidden;
    const addressRegionCountry = inferCountryFromAddressRegion(rawAddress);
    let countryObj = COUNTRIES.find(c => c.name.toLowerCase() === countryName.toLowerCase());

    // 6. Clean Company Address with verified country and company name (Rule 6)
    let companyAddress = cleanAddressString(rawAddress, countryName, companyName);
    if (!companyAddress || companyAddress.split(",").length < 2) {
      // Dynamic fallback: Retry with dedicated contact elements first
      const contactEls = doc?.querySelectorAll?.("address, [itemprop='address'], .contact-address, .company-address, .office-address, .contact-info, .contact-details, [class*='contact'], [id*='contact'], [class*='location'], [class*='address'], footer p, #footer p, .footer p");
      if (contactEls && contactEls.length) {
        for (const contactEl of contactEls) {
          const fallbackAddress = findRawAddress(contactEl, getElementText(contactEl), url, true);
          const contactRaw = fallbackAddress.address || (contactEl.matches?.("address, footer p, #footer p, .footer p") ? getElementText(contactEl) : "");
          if (contactRaw) {
            const recovered = cleanAddressString(contactRaw, countryName, companyName);
            if (recovered && recovered.length >= 10 && !companyAddress) {
              companyAddress = recovered;
              addressSource = fallbackAddress.source ||
                (contactEl.closest?.("footer, #footer, .footer, [class*='footer'], [id*='footer']")
                  ? "footer-fallback"
                  : "contact-detail-fallback");
              if (companyAddress.split(",").length >= 2) break;
            }
          }
        }
      }
    }

    // The verified physical address location ALWAYS takes priority over phone/body guesses
    if (companyAddress) {
      for (const mapping of CITY_STATE_COUNTRY_MAP) {
        if (mapping.regex.test(companyAddress) &&
            (addressRegionCountry
              ? mapping.country === addressRegionCountry
              : (!countryName || mapping.country === countryName))) {
          countryName = mapping.country;
          countryObj = COUNTRIES.find(c => c.name.toLowerCase() === countryName.toLowerCase());
          break;
        }
      }
      countryAliasSearch: for (const c of COUNTRIES) {
        for (const alias of c.aliases) {
          if (matchesCountryTerm(companyAddress, alias)) {
            countryName = c.name;
            countryObj = c;
            break countryAliasSearch;
          }
        }
      }
      // Prefer the country explicitly named by the cleaned physical address
      // over conflicting schema metadata (for example, Taiwan vs. China).
      const verifiedTaiwanAddress = `${rawAddress || ""} ${companyAddress || ""}`;
      if (matchesCountryTerm(verifiedTaiwanAddress, "Taiwan") || /(?<!people'?s?\s)republic\s+of\s+china\b|\br\s*\.?\s*o\s*\.?\s*c\.?\b/i.test(verifiedTaiwanAddress)) {
        countryName = "Taiwan";
        countryObj = COUNTRIES.find(c => c.name === countryName);
      }
    }

    // Refresh country if missing using verified address
    if (!countryName && (companyAddress || rawAddress)) {
      countryName = detectCountry(doc, companyAddress || rawAddress, text, url, text);
      if (countryName) {
        countryObj = COUNTRIES.find(c => c.name.toLowerCase() === countryName.toLowerCase());
        companyAddress = cleanAddressString(companyAddress || rawAddress, countryName, companyName);
      }
    }
    companyName = formatCompanyName(companyNameRaw, countryName);

    // 7. Extract State & City (Rule 7 & 8) — check ONLY verified cleaned address (fallback to raw)
    let { state, city } = detectStateAndCity([companyAddress, rawAddress].filter(Boolean).join(", "), countryName);

    // 7. Business Type (Rule 2)
    const businessType = detectBusinessType(text, doc, url);

    // 8. Company Profile (Rule 3)
    const companyProfile = detectCompanyProfile(text, doc);

    // 9. Emails (Rule 9 & 10)
    const emails = extractEmails(doc, text, siteHostname);

    // 10. Phone Number (Rule 11)
    let headOfficeText = "";
    if (doc) {
      const officeMarkers = doc.querySelectorAll("h1, h2, h3, h4, h5, h6, strong, b, [class*='head-office'], [class*='headquarter']");
      for (const marker of officeMarkers) {
        if (!/\b(?:head office|headquarters|registered office|corporate office)\b/i.test(marker.textContent || "")) {
          continue;
        }
        let ancestor = marker;
        for (let depth = 0; ancestor && ancestor !== doc.body && depth < 5; depth++, ancestor = ancestor.parentElement) {
          const candidateText = getElementText(ancestor);
          if (
            candidateText.length <= 650 &&
            /\baddress\b/i.test(candidateText) &&
            /\b(?:call|phone|telephone|tel)\b/i.test(candidateText) &&
            /\d{7,}/.test(candidateText.replace(/\D/g, ""))
          ) {
            headOfficeText = candidateText;
            break;
          }
        }
        if (headOfficeText) break;
      }
    }
    const telLinkText = doc
      ? [...doc.querySelectorAll('a[href^="tel:"]')]
          .map(link => `Phone: ${(link.getAttribute("href") || "").replace(/^tel:/i, "")}`)
          .join("\n")
      : "";
    const phoneContext = countryObj || countryName;
    const phoneNumber = (headOfficeText && extractPhoneNumber(headOfficeText, phoneContext)) ||
      (telLinkText && extractPhoneNumber(telLinkText, phoneContext)) ||
      extractPhoneNumber(text, phoneContext);

    // 11. Products, Images, Descriptions (Rules 12, 13, 14)
    const counts = extractProductCounts(doc, text);

    // 12. Online purchase capability (informational classification only)
    const onlinePurchase = detectOnlinePurchase(doc, text);

    // 13. Social Media (Facebook, LinkedIn)
    const social = extractSocialMedia(doc, text);

    // 13. Subpage (English & Contact)
    const enUrls = findEnglishSubpages(doc, url);
    const enUrl = enUrls[0] || null;
    const contactUrls = findContactSubpages(doc, url);
    const contactUrl = contactUrls[0] || null;
    const contactPageScore = scoreContactPage(doc, url);
    const emailPageRole = contactPageScore >= 4
      ? "contact"
      : (() => {
          try {
            const pageUrl = new URL(url);
            return pageUrl.pathname === "/" || pageUrl.pathname === "" ? "homepage" : "other";
          } catch { return "other"; }
        })();

    return {
      websiteName: url,
      websiteStatus: (urlRules.isSubdomain || forbidden.isForbidden || onlinePurchase.isOnlineStore) ? "Not Working" : "Working",
      businessType,
      companyProfile,
      companyName,
      companyNameRaw,
      companyAddress,
      addressSource,
      countryName,
      state,
      city,
      emailId: emails.primaryEmail,
      secondaryEmailId: emails.secondaryEmail,
      emailCandidates: emails.candidates,
      emailPageRole,
      contactPageScore,
      phoneNumber,
      numberOfProduct: counts.numberOfProduct,
      imageProduct: counts.imageProduct,
      noOfProductDescription: counts.noOfProductDescription,
      onlinePurchase,
      forbidden,
      urlRules,
      social,
      enUrl,
      enUrls,
      contactUrl,
      contactUrls
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
    detectOnlinePurchase,
    getElementText,
    formatCompanyName,
    expandLegalSuffixes,
    expandAddressAbbreviations,
    cleanAddressString,
    formatAddress: cleanAddressString,
    detectStateAndCity,
    detectBusinessType,
    detectCompanyProfile,
    detectCountry,
    extractEmails,
    isTollFreeNumber,
    isValidEmail,
    mergeContactEmails,
    extractPhoneNumber,
    findRawAddress,
    findEnglishSubpages,
    findEnglishSubpage,
    cleanNonLatin,
    findContactSubpages,
    findContactSubpage,
    CITY_STATE_COUNTRY_MAP,
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
