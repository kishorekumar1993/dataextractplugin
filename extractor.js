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
    "johor", "kedah", "kelantan", "melaka", "malacca", "negeri sembilan", "pahang", "penang", "pulau pinang", "perak", "perlis", "sabah", "sarawak", "selangor", "terengganu", "kuala lumpur", "putrajaya", "labuan"
  ];
  const MALAYSIA_CITIES = [
    "kuala lumpur", "george town", "johor bahru", "ipoh", "shah alam", "petaling jaya", "subang jaya", "klang", "kuantan", "kota kinabalu", "kuching", "seremban", "malacca city", "melaka city", "alor setar", "miri", "sandakan", "tawau", "kota bharu", "kuala terengganu", "putrajaya", "cyberjaya", "kulim", "batu pahat", "kuala kedah", "sibu", "bintulu", "taiping", "teluk intan", "pasir gudang", "iskandar puteri", "bayan lepas", "butterworth", "langkawi", "port dickson", "temerloh", "kemaman", "labuan town", "ampang", "ayer keroh", "balik pulau", "bandar baru bangi", "bandar sunway", "bangsar", "batu gajah", "bukit mertajam", "gombak", "jitra", "kajang", "kampar", "kangar", "keningau", "kluang", "kuala kangsar", "kulai", "lahad datu", "muar", "nilai", "pekan", "seberang perai", "sungai petani", "simpang ampat", "tanah merah", "tampin", "bentong", "rawang", "sabak bernam", "beranang", "setapak", "cheras", "kepong", "sentul", "mont kiara", "damansara", "puchong", "seri kembangan", "shah alam", "kota damansara", "sri petaling"
  ];
  const UAE_EMIRATES = ["Abu Dhabi", "Ajman", "Dubai", "Fujairah", "Ras Al Khaimah", "Sharjah", "Umm Al Quwain"];
  const UAE_CITIES = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Al Ain", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain", "Khor Fakkan", "Kalba", "Dibba Al-Fujairah", "Jebel Ali"];
  const UK_COUNTIES = [
    "bedfordshire", "berkshire", "borders", "bristol", "buckinghamshire", "cambridgeshire", "cheshire", "cornwall", "cumbria", "derbyshire", "devon", "dorset", "durham", "east sussex", "essex", "gloucestershire", "hampshire", "herefordshire", "hertfordshire", "kent", "lancashire", "leicestershire", "lincolnshire", "merseyside", "norfolk", "northamptonshire", "northumberland", "nottinghamshire", "oxfordshire", "somerset", "south yorkshire", "staffordshire", "suffolk", "surrey", "tyne and wear", "warwickshire", "west midlands", "west sussex", "wiltshire", "worcs", "worcestershire", "north yorkshire", "west yorkshire", "isle of wight", "greater london"
  ];
  const UK_CITIES = [
    "london", "birmingham", "manchester", "liverpool", "leeds", "sheffield", "bristol", "nottingham", "leicester", "coventry", "wolverhampton", "stoke-on-trent", "stoke on trent", "derby", "southampton", "portsmouth", "oxford", "cambridge", "york", "bath", "newcastle", "newcastle upon tyne", "newcastle-upon-tyne", "brighton", "brighton and hove", "brighton & hove", "plymouth", "exeter", "norwich", "milton keynes", "reading", "luton", "blackpool", "middlesbrough", "sunderland", "wakefield", "worcester", "chester", "canterbury", "aldridge", "walsall", "sutton coldfield", "bloxwich", "brownhills", "lichfield", "tamworth", "west bromwich", "dudley", "rochdale", "edinburgh", "glasgow", "aberdeen", "dundee", "cardiff", "swansea", "newport", "belfast", "derry",
    // Remaining official UK cities (Cabinet Office list), plus spelling variants.
    "bradford", "carlisle", "chelmsford", "chichester", "colchester", "doncaster", "durham", "ely", "gloucester", "hereford", "kingston upon hull", "kingston-upon-hull", "hull", "lancaster", "lincoln", "peterborough", "preston", "ripon", "salford", "salisbury", "southend-on-sea", "southend on sea", "st albans", "truro", "wells", "westminster", "winchester", "armagh", "bangor", "lisburn", "londonderry", "newry", "dunfermline", "inverness", "perth", "stirling", "st asaph", "st davids", "wrexham",
    // Common UK towns frequently used as address localities.
    "bolton", "bournemouth", "bury", "stockport", "gateshead", "middlesbrough", "oldham", "bury st edmunds", "warrington", "wigan", "blackburn", "burnley", "chorley", "crewe", "macclesfield", "northwich", "widnes", "ellesmere port", "barrow-in-furness", "kendal", "workington", "durham", "darlington", "hartlepool", "bishop auckland", "ashington", "blyth", "cramlington", "consett", "redcar", "seaham", "morpeth", "scunthorpe", "grimsby", "bridlington", "scarborough", "harrogate", "keighley", "halifax", "huddersfield", "wakefield", "castleford", "batley", "dewsbury", "barnsley", "rotherham", "doncaster", "chesterfield", "mansfield", "newark", "worksop", "loughborough", "kettering", "corby", "grantham", "spalding", "stamford", "wellingborough", "lowestoft", "great yarmouth", "huntingdon", "st neots", "hertford", "hitchin", "aylesbury", "banbury", "bicester", "guildford", "maidstone", "margate", "dover", "folkestone", "ashford", "tunbridge wells", "royal tunbridge wells", "eastbourne", "east grinstead", "hastings", "worthing", "crawley", "eastleigh", "fareham", "gosport", "andover", "taunton", "yeovil", "weymouth", "bridgwater", "barnstaple", "falmouth", "newquay", "exmouth", "cirencester", "stratford-upon-avon", "warwick", "stafford", "stourbridge", "halesowen", "smethwick", "malvern", "evesham", "droitwich spa", "royal leamington spa", "telford", "shrewsbury", "hereford", "newtown", "aberystwyth", "barry", "caerphilly", "merthyr tydfil", "pontypridd", "port talbot", "cwmbran", "llanelli", "bridgend", "paisley", "livingston", "kirkcaldy", "ayr", "kilmarnock", "dumfries", "greenock", "cumbernauld", "perth", "antrim", "coleraine", "carrickfergus", "omagh", "enniskillen"
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
    { state: "Western Australia", cities: ["perth"] },
    { state: "South Australia", cities: ["adelaide"] },
    { state: "Tasmania", cities: ["hobart", "launceston"] },
    { state: "Australian Capital Territory", cities: ["canberra"] },
    { state: "Northern Territory", cities: ["darwin"] }
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
    { name: "England", regex: /\b(england|london|birmingham|manchester|liverpool|leeds|sheffield|bristol|nottingham|leicester|coventry|wolverhampton|stoke[- ]on[- ]trent|derby|southampton|portsmouth|oxford|cambridge|york|bath|newcastle(?: upon tyne)?|brighton|plymouth|exeter|norwich|milton keynes|reading|luton|blackpool|middlesbrough|sunderland|wakefield|worcester|chester|canterbury|aldridge|walsall|sutton coldfield|bloxwich|brownhills|lichfield|tamworth|west bromwich|dudley)\b/i },
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
    { name: "Bulgaria", iso: "BG", aliases: ["bulgaria", "българия"], tlds: [".bg"], dialCode: "359" },
    { name: "Croatia", iso: "HR", aliases: ["croatia", "hrvatska"], tlds: [".hr"], dialCode: "385" },
    { name: "Cyprus", iso: "CY", aliases: ["cyprus"], tlds: [".cy"], dialCode: "357" },
    { name: "Austria", iso: "AT", aliases: ["austria", "österreich"], tlds: [".at"], dialCode: "43" },
    { name: "Denmark", iso: "DK", aliases: ["denmark", "danmark", "kingdom of denmark"], tlds: [".dk"], dialCode: "45" },
    { name: "Norway", iso: "NO", aliases: ["norway", "norge"], tlds: [".no"], dialCode: "47" },
    { name: "Finland", iso: "FI", aliases: ["finland", "suomi"], tlds: [".fi"], dialCode: "358" },
    { name: "Ireland", iso: "IE", aliases: ["ireland"], tlds: [".ie"], dialCode: "353" },
    { name: "New Zealand", iso: "NZ", aliases: ["new zealand"], tlds: [".nz", ".co.nz"], dialCode: "64" },
    { name: "South Africa", iso: "ZA", aliases: ["south africa"], tlds: [".za", ".co.za"], dialCode: "27" },
    { name: "Egypt", iso: "EG", aliases: ["egypt", "arab republic of egypt", "مصر"], tlds: [".eg"], dialCode: "20" },
    { name: "Israel", iso: "IL", aliases: ["israel"], tlds: [".il"], dialCode: "972" },
    { name: "Pakistan", iso: "PK", aliases: ["pakistan"], tlds: [".pk"], dialCode: "92" },
    { name: "Bangladesh", iso: "BD", aliases: ["bangladesh"], tlds: [".bd"], dialCode: "880" },
    { name: "Czech Republic", iso: "CZ", aliases: ["czech republic", "czechia", "česko"], tlds: [".cz"], dialCode: "420" },
    { name: "Greece", iso: "GR", aliases: ["greece", "hellas", "hellenic republic", "ellada", "ελλάδα"], tlds: [".gr"], dialCode: "30" }
  ];

  // Global City/State to Country Mapping
  const CITY_STATE_COUNTRY_MAP = [
    { country: "United Arab Emirates", regex: /\b(?:abu dhabi|ajman|al ain|dubai|fujairah|jebel ali|kalba|khor fakkan|ras al khaimah|sharjah|umm al quwain|dibba al-fujairah)\b/i },
    { country: "South Korea", regex: /\b(seoul|incheon|busan|daegu|daejeon|gwangju|ulsan|suwon|changwon|seongnam|cheongju|anyang|bucheon|gyeonggi|gyeonggi-do|gangwon|chungcheong|jeolla|gyeongsang|jeju)\b/i },
    { country: "Japan", regex: /\b(tokyo|osaka|yokohama|nagoya|sapporo|kobe|kyoto|fukuoka|kawasaki|saitama|hiroshima|sendai|chiba|kanagawa|hokkaido)\b/i },
    { country: "China", regex: new RegExp(`\\b(?:${[...CHINA_PROVINCES_AND_REGIONS, ...CHINA_DIRECT_MUNICIPALITIES, ...CHINA_CITIES].map(escapeRegExp).sort((a, b) => b.length - a.length).join("|")})\\b`, "i") },
    { country: "India", regex: /\b(mumbai|delhi|new delhi|bangalore|bengaluru|hyderabad|ahmedabad|chennai|kolkata|surat|pune|jaipur|lucknow|kanpur|nagpur|indore|thane|bhopal|visakhapatnam|gujarat|maharashtra|karnataka|tamil nadu|telangana|uttar pradesh|rajasthan|punjab|haryana|west bengal)\b/i },
    { country: "Germany", regex: /\b(berlin|hamburg|munich|münchen|cologne|köln|frankfurt|stuttgart|düsseldorf|leipzig|dortmund|essen|bremen|dresden|hannover|nuremberg|nürnberg|bavaria|bayern|baden-württemberg|hessen|nordrhein-westfalen|saxony)\b/i },
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
    try {
      const clone = el.cloneNode(true);
      // Remove script and style tags completely
      const nonContent = clone.querySelectorAll("script, style, noscript, svg, canvas");
      for (const nc of nonContent) nc.remove();

      const breaks = clone.querySelectorAll("br, hr");
      for (const b of breaks) b.replaceWith("\n");

      const blocks = clone.querySelectorAll("p, div, li, tr, td, th, h1, h2, h3, h4, h5, h6, header, footer, section, article, dt, dd, blockquote, address");
      for (const blk of blocks) {
        blk.append("\n");
      }
      return (clone.textContent || "").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
    } catch {
      return (el.innerText || el.textContent || "").trim();
    }
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
      { countries: ["france"], rules: [[/\bs\.?a\.?s\.?u\.?(?=\s*[,;:]?$)/gi, "Société par actions simplifiée unipersonnelle"], [/\bs\.?a\.?s\.?(?=\s*[,;:]?$)/gi, "Société par actions simplifiée"], [/\bs\.?r\.?l\.?(?=\s*[,;:]?$)/gi, "Société à responsabilité limitée"], [/\bs\.?l\.?(?=\s*[,;:]?$)/gi, "Société à responsabilité limitée"], [/\bs\.?a\.?(?=\s*[,;:]?$)/gi, "Société Anonyme"], [/\bs\.?n\.?c\.?(?=\s*[,;:]?$)/gi, "Société en nom collectif"]] },
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
    const countryRules = countryExpansions.find(entry =>
      entry.countries.some(value => value.replace(/[^a-z]/g, "") === country)
    );
    if (countryRules) {
      for (const [rx, rep] of countryRules.rules) {
        const titleCasedRep = rep.replace(/\p{L}+/gu, word =>
          word.charAt(0).toLocaleUpperCase() + word.slice(1).toLocaleLowerCase()
        );
        s = s.replace(rx, titleCasedRep);
      }
    }

    const EXPANSIONS = [
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
      [/\bl\.?l\.?c\.?(?=\s*[,;:]?$)/gi, "Limited Liability Company"],
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
      [/주식회사/g, "Jusik Hoesa"],
      [/유한회사/g, "Yuhan Hoesa"],
      [/유한책임회사/g, "Yuhanchaegim Hoesa"],

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
      [/\bco\.?(?=[,]?\s*$)/gi, "Company"]
    ];

    for (const [rx, rep] of EXPANSIONS) {
      const titleCasedRep = rep.replace(/\p{L}+/gu, word =>
        word.charAt(0).toLocaleUpperCase() + word.slice(1).toLocaleLowerCase()
      );
      s = s.replace(rx, titleCasedRep);
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
    const legalForm = addressLead.match(/\b(S\s*\.\s*R\s*\.\s*L\s*\.?|S\s*\.\s*N\s*\.\s*C\s*\.?|S\s*\.\s*A\s*\.?|S\s*\.\s*A\s*\.\s*S\s*\.?)\s*$/i);
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
    const trailingRightsNotice = /(?:©|\(c\)|copyright)\s*(?:19|20)\d{2}\b/i.exec(name);
    if (trailingRightsNotice?.index > 0) {
      name = name.slice(0, trailingRightsNotice.index).replace(/[\s.,;:|]+$/g, "").trim();
    }
    return name;
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

    // 2. Expand Korean entity designations before stripping brackets
    name = name.replace(/[\(\[（]\s*주\s*[\)\]）]|㈜/g, "Jusik Hoesa ");
    name = name.replace(/주식회사/g, "Jusik Hoesa ");
    name = name.replace(/유한회사/g, "Yuhan Hoesa ");
    name = name.replace(/유한책임회사/g, "Yuhanchaegim Hoesa ");

    // 3. Remove brackets while keeping inner text (e.g. (Korea) -> Korea, (UK) -> UK)
    name = removeBrackets(name);

    // 4. Trim special characters from beginning and end
    name = trimSpecialChars(name);

    // 5. Title-case the trade name portion
    name = name.split(/\s+/).map(w => {
      if (/^(?:USA|UK|IBM|BMW|BBC|BHP|LLC|LLP|PLC|GMBH|AG|T2)$/i.test(w)) return w.toUpperCase();
      if (/^[A-Z]{2,3}$/.test(w)) return w;
      if (/[a-z]/.test(w) && /[A-Z]/.test(w.slice(1))) return w;
      if (/^[a-zA-Z가-힣]+$/.test(w)) {
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      }
      return w;
    }).join(" ");

    // 6. Capitalize short connector words (of, and, the, etc.)
    const SMALL_WORDS = /\b(of|and|the|for|to|in|on|at|by|as|a|an)\b/gi;
    name = name.replace(SMALL_WORDS, m => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase());

    // 7. Section 5.3: Expand all international legal suffixes to full form
    name = expandLegalSuffixes(name, countryName);

    // 8. Clean duplicate punctuation, extra spaces, trailing/leading commas or dots
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

  // Check Forbidden Categories Filter (Scans header/hero context only to prevent false positives from case studies)
  function checkForbiddenCategories(text, doc) {
    const headerContext = [
      doc?.title || "",
      doc?.querySelector?.('meta[name="description"]')?.content || "",
      doc?.querySelector?.("h1")?.textContent || "",
      (text || "").slice(0, 500)
    ].join(" ").toLowerCase();

    for (const cat of FORBIDDEN_CATEGORIES) {
      if (cat.regex.test(headerContext)) {
        return {
          isForbidden: true,
          category: cat.name,
          message: `⛔ FORBIDDEN CATEGORY DETECTED: [${cat.name}]. Rule: Do not work on this site!`
        };
      }
    }
    return { isForbidden: false };
  }

  // Rule 2: Business Type (Excel values: Manufacturer, Wholesaler, Distributer, Exporter, Trader, Supplier, Industrial Services)
  function detectBusinessType(text) {
    const lower = (text || "").toLowerCase();

    // Priority rule: If manufacturing/producer mentioned -> Manufacturer
    if (/\b(manufacturer|manufacturing|manufacture|factory|produced by|producer|production|fabrication|plant|oem|odm|assembly line)\b/i.test(lower)) {
      return "Manufacturer";
    }
    if (/\b(wholesale|wholesaler|bulk supply|bulk order)\b/i.test(lower)) {
      return "Wholesaler";
    }
    if (/\b(distributer|distributor|distribution|authorized dealer|dealership)\b/i.test(lower)) {
      return "Distributer";
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
    if (/\b(industrial services|service provider|it consulting|consulting firm|maintenance company|after-?sales service|support contractor|engineering services)\b/i.test(lower)) {
      return "Industrial Services";
    }

    return "Manufacturer"; // Default — most B2B industrial sites are manufacturers
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

    // Comprehensive corporate suffix pattern (Section 5.3 International Legal Suffixes)
    const corpSuffix = /\b(?:co[.,\s]*ltd\.?|co[.,\s]+limited|company\s+limited|corporation|corp\.?|incorporated|inc\.?|limited|ltd\.?|llc|llp|plc|pllc|gmbh|ag|kg|kgaa|se|sarl|eurl|sas|sasu|sa|bv|nv|ab|oy|oyj|as|aps|sl|s\.?r\.?l\.?|s\.?n\.?c\.?|spa|kft|zrt|nyrt|s\.r\.o\.|a\.s\.|d\.o\.o\.|pvt\.?\s*ltd\.?|private\s+limited|pte\.?\s*ltd\.?|pty\.?\s*ltd\.?|proprietary\s+limited|sdn\.?\s*bhd\.?|berhad|bhd\.?|tbk\.?|wll|pjsc|fze|fzco|fz-llc|l3c|p\.?c\.?|p\.?a\.?|l\.?l\.?l\.?p\.?|l\.?p\.?a\.?|bcorp|clg|ulc|dac|scio|bencom|lp|section\s*8\s+company|producer\s+company|nidhi\s+(?:limited|company)|s\.?e\.?n\.?c\.?|s\.?e\.?c\.?|incorporated\s+association|npc|wfoe|wofe|fie|g\.?k\.?|y\.?k\.?|p\.?t\.?|perum|persero|s\.?c\.?l\.?|s\.?c\.?|psc|prjsc|g\.?t\.?\s*ltd)\b/i;

    // Helper: checks if candidate string contains a real corporate suffix
    const hasCorpSuffix = str => {
      if (!str || /^\s*(?:NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\s+\d{4}\s*$/i.test(str)) {
        return false;
      }
      return corpSuffix.test(str);
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
      if (s.length >= 2 && s.length <= 80 && !/^(?:all|rights|reserved|inc|ltd|co|llc|\d+)$/i.test(s)) {
        return s;
      }
      return "";
    }

    function companyNameAfterRightsNotice(value) {
      const match = String(value || "").match(
        /\ball rights reserved\b\s*(?:(?:©\s*)?\d{2,4}(?:\s*[-–]\s*\d{2,4})?\s*)?(?:©\s*)?(.{2,80})$/i
      );
      const candidate = sanitizeCandidate(match?.[1] || "");
      return candidate && hasCorpSuffix(candidate) ? candidate : "";
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
              if (n && hasCorpSuffix(n) && !legalName && !metadataLegalName) {
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

    if (!legalName && metadataLegalName) {
      legalName = metadataLegalName;
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

        const cpMatch = l.match(/(?:©|copyright|\(c\))\s*(?:\d{2,4}\s*[-–]?\s*\d{2,4}|\d{2,4})?\s*(.{2,80}?)(?:\s*[|·•\-–—.,]?\s*(?:all rights?|rights reserved|company reg|reg no)|$)/i);
        if (cpMatch && cpMatch[1]) {
          const candidate = sanitizeCandidate(cpMatch[1]);
          if (candidate && hasCorpSuffix(candidate)) {
            legalName = candidate;
            break;
          } else if (candidate && !brandName) {
            brandName = candidate;
          }
        }
      }

      if (!legalName) {
        for (const line of footerLines) {
          const l = clean(line);
          if (!l || l.length < 2 || l.length > 120 || !hasCorpSuffix(l)) continue;

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
      const titleParts = doc.title.split(/\s*\|\s*|\s+[–—-]\s+|:\s*|[·•]/).map(s => s.trim()).filter(Boolean);
      const corpPart = titleParts.find(p => hasCorpSuffix(p) && p.length >= 2 && p.length <= 80);
      if (corpPart) {
        legalName = sanitizeCandidate(corpPart);
      } else if (!brandName) {
        const genericTitlePart = /^(?:home(?:page)?|welcome|contact(?:\s+us)?|about(?:\s+us)?|privacy(?:\s+policy)?|terms(?:\s+(?:and|&)\s+conditions)?|products?|services?|shop|store|furniture|blog|news|login|search)(?:\s+page)?$/i;
        brandName = [...titleParts].reverse().find(part =>
          part.length >= 2 && part.length <= 80 && !genericTitlePart.test(part)
        ) || "";
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
        `\\b(${baseClean}\\s+(?:co[.,\\s]*ltd\\.?|co[.,\\s]+limited|company\\s+limited|corporation|corp\\.?|incorporated|inc\\.?|limited|ltd\\.?|llc|llp|plc|pllc|gmbh|ag|kg|kgaa|se|sarl|eurl|sas|sasu|sa|bv|nv|ab|oy|oyj|as|aps|sl|s\\.?r\\.?l\\.?|s\\.?n\\.?c\\.?|srl|spa|kft|zrt|nyrt|s\\.r\\.o\\.|a\\.s\\.|d\\.o\\.o\\.|pvt\\.?\\s*ltd\\.?|private\\s+limited|pte\\.?\\s*ltd\\.?|pty\\.?\\s*ltd\\.?|proprietary\\s+limited|sdn\\.?\\s*bhd\\.?|berhad|bhd\\.?|tbk\\.?|wll|pjsc|fze|fzco|fz-llc))\\b`,
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
      for (const line of lines) {
        const l = clean(line);
        if (l.length >= brandName.length && l.length <= brandName.length + 30) {
          if (l.toLowerCase().startsWith(brandName.toLowerCase()) && hasCorpSuffix(l)) {
            const cand = sanitizeCandidate(l);
            if (cand) return finishName(cand);
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

    // 5. Match address text against City/State to Country Map
    if (addressText) {
      for (const mapping of CITY_STATE_COUNTRY_MAP) {
        if (mapping.regex.test(addressText)) {
          return mapping.country;
        }
      }
    }

    // 6. Match domain TLD (e.g. .co.kr -> South Korea, .de -> Germany, .jp -> Japan, .co.uk -> England)
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

    // 7. Match Phone Number Dial Code (e.g. +82 -> South Korea, +49 -> Germany, +91 -> India, +44 -> England, 66(0) -> Thailand)
    const phoneToTest = `${phoneRaw || ""} ${fullText || ""}`;
    const dialCodeMatches = phoneToTest.match(/(?:\b(?:Tel(?:ephone)?|Phone|Mob(?:ile)?|Cell|Fax)\b[:：.-]?|\b[TPMF][:：.-])\s*(?:\+([0-9]{1,4})|([0-9]{2,4})\s*(?:\(0\)|0))/gi) || [];
    for (const d of dialCodeMatches) {
      const codeMatch = d.match(/(?:\b(?:Tel(?:ephone)?|Phone|Mob(?:ile)?|Cell|Fax)\b[:：.-]?|\b[TPMF][:：.-])\s*(?:\+([0-9]{1,4})|([0-9]{2,4})\s*(?:\(0\)|0))/i);
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
        .replace(/\s+(?:tel(?:ephone)?|phone|mobile|fax)\s*[:：]?\s*.*$/i, "")
        .replace(/\(?\+\d{1,3}\)?(?:[\s().-]*\d){7,}[\s\S]*$/i, "");

      const legalNotice = /©|\bcopyright\b|\ball rights reserved\b|\|\s*privacy(?:\s+policy)?\b|\bprivacy\s+policy\b|\|\s*terms(?:\s+of\s+use)?\b|\bterms\s+of\s+use\b/i.exec(address);
      const webMaterialNotice = /\bthis\s+web\s*site\s+contains\s+material\b|\bwe\s+provide\s+some\s+images\b|\bour\s+logotype\b|\byou\s+may\s+(?:not\s+)?(?:print|copy|mirror|modify|reproduce|rebroadcast)\b|\byou\s+may\s+print\s+off\s+copies\b/i.exec(address);
      const noticeIndex = Math.min(legalNotice?.index ?? Infinity, webMaterialNotice?.index ?? Infinity);
      if (Number.isFinite(noticeIndex)) address = cutNoticePreservingAddress(address, noticeIndex);

      // Clean leading address labels like "Address:", "Location:", "HQ:", "Headquarters:"
      address = address.replace(/^[\s•\-\*#|>📍🏢🏠🏬📌]*(?:our\s+)?(?:global\s+headquarters|headquarters|head\s+office|registered\s+office|corporate\s+office|corporate\s+headquarters|corporate\s+address|company\s+address|office\s+address|office\s+location|postal\s+address|physical\s+address|mailing\s+address|street\s+address|business\s+address|main\s+office|office|address|location|hq|주소|본사|사업장\s*주소|회사위치|소재지|所在地|住所|本社|営業所|地址|公司地址|总部地址|联系地址|adresse|standort|firmensitz|dirección|sede|indirizzo|siège)\s*(?:[:：\-–—]|[\r\n,]+)\s*/i, "");

      // Replace semicolons with commas to prevent premature rejection
      address = address.replace(/;/g, ", ");

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

    const isNoise = address =>
      !address ||
      address.length < 10 ||
      address.length > 350 ||
      /@|https?:\/\/|www\.|all rights reserved/i.test(address) ||
      isContactOnly(address);

    const hasPostalCode = (address, hasStreetMarker = false) => {
      const numericPostalPattern = /(?:^|[,;\s])(\d{4,6}(?:-\d{4})?)(?=$|[,;\s])/g;
      let match;
      while ((match = numericPostalPattern.exec(address))) {
        const code = match[1];
        if (!/^(?:19|20)\d{2}$/.test(code) || hasStreetMarker) return true;
      }
      return /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i.test(address);
    };

    const isAddressShaped = address => {
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
      const detectedLocation = detectStateAndCity(nonCountryAddress);

      // Flexible street & building markers: matches number before marker OR marker before number (e.g. "Suite 200", "Plot 45", "PO Box 123", "No. 106-2")
      const streetNumberMatch =
        /\b\d+[^\n]{0,35}\b(?:street|st\.?|road|rd\.?|lane|ln\.?|avenue|ave\.?|boulevard|blvd\.?|drive|dr\.?|court|ct\.?|place|pl\.?|square|sq\.?|highway|hwy\.?|parkway|pkwy\.?|terrace|ter\.?|circle|cir\.?|crescent|cres\.?|way|trail|trl\.?|route|rte\.?|expressway|freeway|district|zone|block|sector|plot|suite|ste\.?|floor|fl\.?|unit|building|bldg\.?|tower|house|apartment|apt\.?|flat|level|phase)\b/i.test(cleaned) ||
        /\b(?:plot|sector|suite|ste\.?|unit|building|bldg\.?|tower|apartment|apt\.?|flat|level|floor|fl\.?|p\.?o\.?\s*box|post\s+office\s+box|no\.?)\b[^\n]{0,25}\d+/i.test(cleaned);

      const postalMatch = hasPostalCode(cleaned, streetNumberMatch);

      const hasKnownLocation = countryMatch || postalMatch || regionMatch || cityMatch ||
        Boolean(detectedCountry) ||
        detectedLocation.state !== "N" ||
        detectedLocation.city !== "N" ||
        streetNumberMatch ||
        /\b(?:street|st\.?|road|rd\.?|lane|ln\.?|avenue|ave\.?|boulevard|blvd\.?|drive|dr\.?|court|ct\.?|place|pl\.?|square|sq\.?|highway|hwy\.?|parkway|pkwy\.?|terrace|ter\.?|circle|cir\.?|crescent|cres\.?|way|trail|trl\.?|route|rte\.?|expressway|freeway|district|zone|block|sector|plot|suite|ste\.?|floor|fl\.?|unit|building|bldg\.?|tower|house|apartment|apt\.?|flat|level|phase|county|\bco\.)\b/i.test(cleaned);

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
      if (segments.some(segment => segment.split(/\s+/).filter(Boolean).length > 8)) {
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
      return locationSignal || streetNumberMatch;
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
      /^(?:tel(?:ephone)?|phone|mobile|cell|fax|email|e-mail|contact|call|copyright|follow us|social media|website|web|sales|support|customer service|business registration|cin|gstin|vat|tax id)\b|^(?:t|p|m|f|e)\s*[:：.\-–—]/i;

    const looksLikeAddressLine = line => {
      let s = String(line || "").trim();
      s = s.replace(/\s+(?:e-?mail\s*[:：]?\s*)?[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}.*$/i, "").trim();
      s = s.replace(/\s+(?:tel(?:ephone)?|phone|mobile|fax)\s*[:：]?\s*.*$/i, "").trim();
      if (!s || s.length < 12 || s.length > 220) return false;
      if (stopLinePattern.test(s) || /@|https?:\/\/|www\.|all rights reserved/i.test(s)) return false;
      const hasNumber = /\d/.test(s);
      const hasStreetMarker = /\b(?:p\.?\s*o\.?\s*box|post\s+office\s+box|street|st\.?|road|rd\.?|avenue|ave\.?|drive|dr\.?|lane|ln\.?|boulevard|blvd\.?|court|ct\.?|place|pl\.?|circle|cir\.?|parkway|pkwy\.?|highway|hwy\.?|crescent|cres\.?|terrace|ter\.?|way|district|industrial|estate|park|zone|building|tower|unit|suite|floor|phase|gu\b|si\b|do\b|ro\b|dong\b|gun\b|min\b|city\b|province\b|county\b)/i.test(s);
      const commaSegments = s.split(",").map(p => p.trim()).filter(Boolean);
      return (hasNumber && (commaSegments.length >= 2 || hasStreetMarker)) ||
        (hasStreetMarker && commaSegments.length >= 2);
    };

    const officeMarkers = doc.querySelectorAll(
      "h1, h2, h3, h4, h5, h6, strong, b, [class*='head-office'], [class*='headquarter']"
    );
    for (const marker of officeMarkers) {
      if (!/\b(?:head office|headquarters|registered office|corporate office)\b/i.test(marker.textContent || "")) {
        continue;
      }

      let ancestor = marker.parentElement;
      for (let depth = 0; ancestor && ancestor !== doc.body && depth < 5; depth++, ancestor = ancestor.parentElement) {
        const officeText = getElementText(ancestor);
        if (officeText.length > 650) break;
        if (
          !/\b(?:head office|headquarters|registered office|corporate office)\b/i.test(officeText) ||
          !/\baddress\b/i.test(officeText)
        ) {
          continue;
        }

        const officeLines = officeText.split(/[\r\n]+/).map(line => line.trim()).filter(Boolean);
        const addressIndex = officeLines.findIndex(line =>
          /^(?:our\s+)?address\s*[:：-]?\s*$/i.test(line)
        );
        if (addressIndex < 0) continue;

        const addressParts = [];
        for (let i = addressIndex + 1; i < officeLines.length && i < addressIndex + 7; i++) {
          const line = officeLines[i];
          if (labelPattern.test(line) || stopLinePattern.test(line) || /@|https?:\/\/|www\./i.test(line)) {
            break;
          }
          addressParts.push(line);
        }

        const officeAddress = addressParts.join(", ");
        if (officeAddress) {
          addCandidate(
            officeAddress,
            isContactPage ? "contact-detail-labelled" : (isFooterElement(ancestor) ? "footer-labelled" : "page-labelled"),
            250
          );
          break;
        }
      }
      break;
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
            j < Math.min(lines.length, i + 6);
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
            /@|https?:\/\/|www\.|all rights reserved/i.test(line)
          ) {
            break;
          }
          if (!line || line.length > 120) break;
          if (looksLikeAddressLine(line) || line.includes(",") || /\d/.test(line)) {
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
          for (let j = i + 1; j < Math.min(ftLines.length, i + 5); j++) {
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
        /\b(?:United Kingdom|UK|England|Scotland|Wales|Northern Ireland|Birmingham)\b/i.test(address)
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
      if (domainCountry && detectedCountry) {
        score += detectedCountry === domainCountry ? 40 : -35;
      }
      if (countriesMentioned.length > 1) {
        // A single candidate spanning multiple branch locations is less
        // useful than one complete address matching the site's home country.
        score -= (countriesMentioned.length - 1) * 50;
      }
      const streetNumberMatch =
        /\b\d+[^\n]{0,25}\b(?:street|st\.?|road|rd\.?|lane|ln\.?|avenue|ave\.?|boulevard|blvd\.?|drive|dr\.?|court|ct\.?|place|pl\.?|square|sq\.?|highway|hwy\.?|parkway|pkwy\.?|terrace|ter\.?|circle|cir\.?|crescent|cres\.?|way|trail|trl\.?|route|rte\.?|expressway|freeway)\b/i
          .test(address);
      const hasLeadingStreetNumber = /^\s*\d{1,6}\s+.{1,80}\b(?:street|st\.?|road|rd\.?|lane|ln\.?|avenue|ave\.?|boulevard|blvd\.?|drive|dr\.?|court|ct\.?|place|pl\.?|square|sq\.?|highway|hwy\.?|parkway|pkwy\.?|terrace|ter\.?|circle|cir\.?|crescent|cres\.?|way|trail|trl\.?|route|rte\.?|expressway|freeway)\b/i.test(address);
      if (hasLeadingStreetNumber) score += 30;
      const postalMatch = hasPostalCode(address, streetNumberMatch);
      if (postalMatch) score += 15;
      if (countryMatch || detectedCountry) score += 12;

      if (/\b\d+[^\n]{0,25}\b(?:street|st\.?|road|rd\.?|lane|ln\.?|avenue|ave\.?|boulevard|blvd\.?|drive|dr\.?|court|ct\.?|place|pl\.?|square|sq\.?|highway|hwy\.?|parkway|pkwy\.?|terrace|ter\.?|circle|cir\.?|crescent|cres\.?|way|trail|trl\.?|route|rte\.?|expressway|freeway)\b/i.test(address)) {
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
    if (/\b(?:United States|United States Of America|USA|U\.S\.A?\.?)\b/i.test(context) ||
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
    if (regionMap) {
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
    addr = addr.replace(/\bRIICO\b/gi, "Rajasthan State Industrial Development and Investment Corporation");
    addr = addr.replace(/\bUPSIDC\b/gi, "Uttar Pradesh State Industrial Development Corporation");

    // 2. Common Indian & International Address Terms (Sections 7.8 & 7.9)
    // Post Office Box Number first before Post Office Box
    addr = addr.replace(/\bP\.?O\.?\s*Box\b\s*No\b\.?/gi, "Post Office Box Number");
    addr = addr.replace(/\bP\.?O\.?\s*Box\b/gi, "Post Office Box");
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
    addr = addr.replace(/\bOld\s+Rd\b\.?/gi, "Old Road");
    addr = addr.replace(/\bNew\s+Rd\b\.?/gi, "New Road");
    addr = addr.replace(/\bStn\b\.?\s*Rd\b\.?/gi, "Station Road");
    addr = addr.replace(/\bStn\b\.?/gi, "Station");
    addr = addr.replace(/\bExpy\b\.?/gi, "Expressway");
    addr = addr.replace(/\bFwy\b\.?/gi, "Freeway");
    addr = addr.replace(/\b(?:Tpke|Tpk)\b\.?/gi, "Turnpike");
    addr = addr.replace(/\bByp\b\.?/gi, "Bypass");
    addr = addr.replace(/\bPath\b\.?/gi, "Pathway");
    addr = addr.replace(/\bAlley\b/gi, "Alleyway");
    addr = addr.replace(/\bAly\b\.?/gi, "Alleyway");
    addr = addr.replace(/\bWy\b\.?/gi, "Way");
    addr = addr.replace(/\bWalk\b\.?/gi, "Walkway");
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
    // Standalone directional prefixes before street names
    addr = addr.replace(/(?<![A-Za-z.])\bN\.\s+(?=[A-Z][a-z0-9]+(?:\s+(?:Road|Street|Avenue|Boulevard|Drive|Highway|Lane|Court|Square|Place|Way|Crescent|Terrace)))/gi, "North ");
    addr = addr.replace(/(?<![A-Za-z.])\bS\.\s+(?=[A-Z][a-z0-9]+(?:\s+(?:Road|Street|Avenue|Boulevard|Drive|Highway|Lane|Court|Square|Place|Way|Crescent|Terrace)))/gi, "South ");
    addr = addr.replace(/(?<![A-Za-z.])\bE\.\s+(?=[A-Z][a-z0-9]+(?:\s+(?:Road|Street|Avenue|Boulevard|Drive|Highway|Lane|Court|Square|Place|Way|Crescent|Terrace)))/gi, "East ");
    addr = addr.replace(/(?<![A-Za-z.])\bW\.\s+(?=[A-Z][a-z0-9]+(?:\s+(?:Road|Street|Avenue|Boulevard|Drive|Highway|Lane|Court|Square|Place|Way|Crescent|Terrace)))/gi, "West ");

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

    let addr = clean(String(rawAddr));
    const addressCountry = getAddressCountryContext(rawAddr, countryName) ||
      detectCountry(null, rawAddr, rawAddr, "", "");

    // 1. Remove brackets and normalize whitespace.
    addr = removeBrackets(addr);
    addr = addr
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();

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
      /\b(?:tel(?:ephone)?|phone|mobile|cell|fax|email|e-mail|website|url|cin|gstin|gst|tax\s+id|vat|ein|abn|acn|copyright|all\s+rights\s+reserved|ph|t|p)\s*[:：\-–—]|\b(?:tel(?:ephone)?|phone|mobile|cell|fax)\s+[+(0-9]|\bcontact\b\s*$/i;

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
          const companyRegex = new RegExp(
            "^\\s*" + escapeRegex(variant) +
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
    const countryTerms = [];

    if (countryName) {
      countryTerms.push(String(countryName).trim());
    }

    if (Array.isArray(COUNTRIES)) {
      for (const country of COUNTRIES) {
        if (country?.name) countryTerms.push(country.name);

        if (Array.isArray(country?.aliases)) {
          countryTerms.push(...country.aliases);
        }
      }
    }

    const uniqueCountries = [...new Set(
      countryTerms
        .filter(Boolean)
        .map(term => term.trim())
        .filter(term => term.length >= 2)
    )].sort((a, b) => b.length - a.length);

    if (uniqueCountries.length) {
      const countryPattern = uniqueCountries
        .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");

      // A footer or menu can be concatenated after a complete address, e.g.
      // "Älvdalen, Sweden., Showroom, ...". Treat a punctuated country name
      // as the end of the address and discard everything that follows it.
      const countryMarker = new RegExp("\\b(?:" + countryPattern + ")\\b(?=[.,;])", "i");
      const countryMatch = countryMarker.exec(addr);
      if (countryMatch) {
        const tail = addr.slice(countryMatch.index + countryMatch[0].length);
        if (tail.replace(/[.,;|\s]/g, "")) {
          addr = addr.slice(0, countryMatch.index + countryMatch[0].length).trim();
        }
      }

      const countryAtEnd = new RegExp(
        "(?:,\\s*|\\s+)\\b(?:" + countryPattern + ")\\b(?:\\s+\\d{4,10})?\\s*[.,;]*$",
        "i"
      );

      // Remove a country suffix, but preserve all preceding address parts.
      addr = addr.replace(countryAtEnd, "").trim();
    }

    addr = expandPostalRegionPostcodes(addr, addressCountry);
    if (typeof expandAddressAbbreviations === "function") {
      addr = expandAddressAbbreviations(addr, addressCountry);
    }

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
      /^\d{5}(?:-\d{4})?$/,                       // US ZIP / ZIP+4
      /^\d{6}$/,                                  // Six-digit postal code
      /^[A-Z]\d[A-Z]\s*\d[A-Z]\d$/i,            // Canadian postal code
      /^(?:D|F|I|E|NL|B|CH|AT|PL)-\d{4,5}$/i     // Selected international formats
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
    if (countryInfo?.iso === "TW" || /\btaiwan\s*,?\s*(?:r\s*\.?\s*o\s*\.?\s*c\.?|republic\s+of\s+china)\b/i.test(addr)) {
      // Taiwan addresses often append an old three-digit ZIP to the city
      // ("Taichung City 420") and use "Taiwan R.O.C." as the country suffix.
      addr = addr
        .replace(/\b(city|district|dist\.?|county)\s+\d{3}\b/gi, "$1")
        .replace(/,\s*\d{3}(?=\s*(?:,|$))/g, "")
        .replace(/(?:,\s*|\s+)(?:taiwan\s*,?\s*(?:r\s*\.?\s*o\s*\.?\s*c\s*\.?|republic\s+of\s+china)|r\s*\.?\s*o\s*\.?\s*c\s*\.?)\s*[.,;]*$/i, "");
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
    if (countryInfo?.iso === "GB" || /^(?:england|scotland|wales|northern ireland|great britain|uk)$/.test(postalCountry)) {
      addr = addr.replace(/\b(?:GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/gi, " ");
    }
    if (countryInfo?.iso) {
      addr = addr.replace(new RegExp(`(?:,\\s*|\\s+)${escapeRegExp(countryInfo.iso)}\\s*$`, "i"), " ");
    }
    if (/^(?:united kingdom|england|scotland|wales|northern ireland|uk|great britain)$/.test(postalCountry)) {
      addr = addr.replace(/\b(?:GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/gi, " ");
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
      .replace(/^[,;:|.\-–—\s]+|[,;:|.\-–—\s]+$/g, "")
      .trim();

    // 9. Apply title case while preserving common acronyms and numbers.
    addr = addr.split(/\s+/).map((word, wordIndex, words) => {
      const trailing = (word.match(/[.,;:!?]+$/) || [""])[0];
      const core = word.replace(/[.,;:!?]+$/g, "");
      const previousCore = words[wordIndex - 1]?.replace(/[.,;:!?]+$/g, "") || "";
      const nextCore = words[wordIndex + 1]?.replace(/[.,;:!?]+$/g, "") || "";

      if (!core) return word;
      if (
        (/^[A-Z]{1,2}\d[A-Z\d]?$/i.test(core) && /^\d[A-Z]{2}$/i.test(nextCore)) ||
        (/^\d[A-Z]{2}$/i.test(core) && /^[A-Z]{1,2}\d[A-Z\d]?$/i.test(previousCore))
      ) {
        return core.toUpperCase() + trailing;
      }
      if (/^[A-Z]{2,3}[,;:]?$/.test(core)) return core + trailing;
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

    return addr;
  }



  // Rules 7 & 8: State & City (Y / N)
  // Scans ONLY the verified address (never full body text) to prevent false positives from blog posts/global offices
  function detectStateAndCity(address) {
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
    const hasStateLevelMunicipality = [...TAIWAN_SPECIAL_MUNICIPALITIES, ...METROPOLITAN_CITY_REGIONS].some(name =>
      new RegExp(`\\b${escapeRegExp(name)}(?:\\s+(?:city|special\\s+municipality|municipality))?\\b`, "i").test(addrLower)
    );
    const hasGenericStateLevel = /\b(?:region|governorate|oblast|department|territory|administrative\s+area)\b/i.test(addrLower);
    const hasIndianState = INDIAN_STATES_AND_TERRITORIES.some(name => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(addrLower));
    const hasMalaysiaState = MALAYSIA_STATES_AND_TERRITORIES.some(name => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(addrLower));
    const hasMalaysiaCity = MALAYSIA_CITIES.some(name => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(addrLower));
    const hasUkCountyOrNation = UK_COUNTIES.some(name => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(addrLower)) ||
      /\b(?:england|scotland|wales|northern ireland)\b/i.test(addrLower);
    const hasUkCity = UK_CITIES.some(name => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(addrLower));
    const hasUaeEmirate = UAE_EMIRATES.some(name => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(addrLower));
    const hasUaeCity = UAE_CITIES.some(name => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(addrLower));
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

    // State indicators in address
    if (state === "N" && (hasTaiwanCounty || hasChinaProvince || hasChinaMunicipality || hasStateLevelMunicipality || hasGenericStateLevel || hasIndianState || hasMalaysiaState || hasUkCountyOrNation || hasUaeEmirate || hasSwedenCounty || hasSwedenMunicipality || australianCityState || hasAustralianStateCode || (australianPostcode !== null && australianPostcode !== undefined) || POSTAL_REGION_NAMES_REGEX.test(addrLower) ||
        POSTAL_REGION_US_CODES_REGEX.test(address || "") ||
        /(?:county|\bco\.|\bco\s+[a-z]+|province|prefecture|state|-do\b|gyeonggi|gangwon|chungcheong|jeolla|gyeongsang|california|texas|florida|\bfl\b|new york|pennsylvania|illinois|ohio|georgia|north carolina|michigan|new jersey|virginia|washington|arizona|massachusetts|tennessee|indiana|missouri|maryland|wisconsin|colorado|minnesota|south carolina|alabama|louisiana|kentucky|oregon|oklahoma|connecticut|utah|iowa|nevada|arkansas|mississippi|kansas|new mexico|nebraska|idaho|hawaii|guangdong|zhejiang|jiangsu|shandong|fujian|bavaria|bayern|baden-württemberg|hessen|nordrhein-westfalen|saxony|ontario|quebec|british columbia|alberta|manitoba|new south wales|victoria|queensland|roscommon|kildare|wicklow|meath|louth|mayo|donegal|kerry|tipperary|clare|cavan|monaghan|leitrim|longford|westmeath|offaly|laois|galway|waterford|limerick|cork|dublin|chonburi|samut prakan|nonthaburi|pathum thani|chiang mai|phuket|rayong|ayutthaya|songkhla|surat thani|khon kaen|nakhon ratchasima)/i.test(addrLower))) {
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
    if (city === "N" && (/(?:town|district|municipality|city|-si\b|-gu\b|troy|west palm beach|palm beach|tampa|orlando|jacksonville|fort lauderdale|boca raton|nof hagalil|anyang|suwon|seongnam|cheongju|bucheon|incheon|busan|daegu|daejeon|gwangju|ulsan|san jose|los angeles|san francisco|san diego|sacramento|fresno|new york|chicago|houston|phoenix|philadelphia|san antonio|dallas|austin|seattle|denver|boston|detroit|las vegas|miami|atlanta|london|birmingham|manchester|liverpool|leeds|sheffield|bristol|edinburgh|glasgow|berlin|hamburg|munich|münchen|cologne|köln|frankfurt|stuttgart|düsseldorf|paris|marseille|lyon|toulouse|nice|rome|milan|naples|turin|florence|venice|tokyo|osaka|yokohama|nagoya|sapporo|kobe|kyoto|fukuoka|beijing|shanghai|guangzhou|shenzhen|chengdu|wuhan|tianjin|hangzhou|mumbai|delhi|new delhi|bangalore|bengaluru|hyderabad|ahmedabad|chennai|kolkata|surat|pune|jaipur|toronto|montreal|vancouver|calgary|edmonton|ottawa|sydney|melbourne|brisbane|perth|taipei|ballinderry|four mile house)/i.test(addrLower) ||
        CITY_STATE_COUNTRY_MAP.some(m => m.regex.test(cityEvidenceAddress)))) {
      city = "Y";
    }

    // Taiwan has a different hierarchy: special municipalities are state-level,
    // counties mark State, and other named cities/districts mark City only.
    if (hasTaiwanContext) {
      state = hasTaiwanCounty || hasTaiwanSpecialMunicipality ? "Y" : "N";
      city = hasTaiwanSpecialMunicipality || hasTaiwanCityOrDistrict || hasWorldCapital ? "Y" : "N";
    }
    if (hasChinaContext) {
      state = hasChinaProvince || hasChinaMunicipality ? "Y" : "N";
      city = hasChinaCity || hasChinaMunicipality || hasWorldCapital ? "Y" : "N";
    }

    // Completeness validation (Rule 18): If address has fewer than 2 segments, State is likely invalid
    const parts = (address || "").split(",").map(p => p.trim()).filter(Boolean);
    const hasExplicitStateEvidence = hasTaiwanCounty || hasChinaProvince || hasChinaMunicipality || hasStateLevelMunicipality || hasGenericStateLevel || hasUaeEmirate || hasSwedenCounty || hasSwedenMunicipality ||
      hasIndianState || hasMalaysiaState || hasUkCountyOrNation || australianCityState || hasAustralianStateCode ||
      (australianPostcode !== null && australianPostcode !== undefined) || POSTAL_REGION_NAMES_REGEX.test(addrLower) ||
      POSTAL_REGION_US_CODES_REGEX.test(address || "");
    if (parts.length < 2 && state === "Y" && !hasExplicitStateEvidence) {
      state = "N";
    }

    return { state, city };
  }

  // Rule 9 & 10: Email ID & Secondary Email ID
  function extractEmails(doc, text, siteHostname) {
    const emails = new Set();
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,24}/g;

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

    const addFrom = value => {
      if (!value) return;

      const decoded = decodeEmailText(value);
      const matches = decoded.match(emailRegex) || [];
      for (const match of matches) {
        const email = match.replace(/[.,;:!?]+$/, "").toLowerCase();
        if (isValidEmail(email)) emails.add(email);
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
          addFrom(el.getAttribute(attribute));
        }
        addFrom(el.textContent || el.innerText || "");
      }

      // 2. JSON-LD can nest email values in @graph and contact-point structures.
      const visitJsonLd = value => {
        if (!value || typeof value !== "object") return;
        if (Array.isArray(value)) {
          value.forEach(visitJsonLd);
          return;
        }
        if (Object.prototype.hasOwnProperty.call(value, "email")) addFrom(value.email);
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
    addFrom(text || (doc?.body ? getElementText(doc.body) : ""));

    // Filter out blacklisted / system emails
    const list = [...emails].filter(e => !/^(noreply|no-reply|careers|jobs|hr|webmaster|postmaster|abuse|spam|privacy|legal)@/i.test(e));

    const hostname = String(siteHostname || "")
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      .split(":")[0]
      .toLowerCase();

    // Prioritize corporate emails and match against site domain
    const scored = list.map(e => {
      let score = 0;
      if (/^sales@/i.test(e)) score += 10;
      else if (/^info@/i.test(e)) score += 9;
      else if (/^contact@/i.test(e)) score += 8;
      else if (/^office@/i.test(e)) score += 7;
      else if (/^export@/i.test(e)) score += 6;
      else score += 1;

      const emailDomain = (e.split("@")[1] || "").toLowerCase();
      if (hostname && (emailDomain === hostname || hostname.endsWith(`.${emailDomain}`))) {
        score += 50;
      }
      return { email: e, score };
    });

    scored.sort((a, b) => b.score - a.score);

    return {
      primaryEmail: scored[0]?.email || "",
      secondaryEmail: scored[1]?.email || "",
      allEmails: scored.map(s => s.email)
    };
  }

  function isValidEmail(e) {
    if (!e || typeof e !== "string" || e.length > 80) return false;
    if (/[/\\]/.test(e)) return false;
    if (/\.(png|jpg|jpeg|gif|webp|svg|css|js|woff2?|ttf|eot|ico|map|min)$/i.test(e)) return false;
    if (/(?:jsdelivr|cdnjs|unpkg|googleapis|gstatic|w3\.org|schema\.org|sentry|recaptcha|wordpress|wp-content|github|polyfill|node_modules|bootstrap|jquery)/i.test(e)) return false;
    if (/example\.com|domain\.com|yourdomain|email@/i.test(e)) return false;
    if (/^(noreply|no-reply|careers|jobs|hr|webmaster|postmaster|abuse|spam|privacy|legal)@/i.test(e)) return false;
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,24}$/.test(e);
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

  // Rule 11: Phone Number
  // "remove the country code, special characters, and spaces. Do not take toll-free numbers. Do not take numbers starting with zero."
  function extractPhoneNumber(text, country) {
    // 1. Scan phone lines
    const phoneCandidates = [];
    const phoneRegex = /(?:Tel|Telephone|Phone|Mob(?:ile)?|Cell|Fax|T|P|M|F)\.?\s*[:：.-]?\s*([+]?[0-9\s()./-]{7,25})/gi;
    let m;
    while ((m = phoneRegex.exec(text)) !== null) {
      const raw = m[1].split(/[\/~,\n]/)[0].trim();
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

      // Clean country code FIRST
      let s = raw;
      if (country?.dialCode) {
        s = s.replace(new RegExp(`^\\+?${country.dialCode}[\\s.-]*(?:\\(0\\)|0)?[\\s.-]*`), "");
      } else {
        const allDialCodes = COUNTRIES.map(c => c.dialCode).filter(Boolean).sort((a, b) => b.length - a.length);
        const dialRegex = new RegExp(`^\\+(?:${allDialCodes.join("|")})[\\s.-]*|^(?:${allDialCodes.join("|")})[\\s.-]*(?:\\(0\\)|0)[\\s.-]*`);
        s = s.replace(dialRegex, "");
      }

      // Remove special characters and leading zeros
      let cleanDigits = s.replace(/\D/g, "").replace(/^0+/, "");
      if (country?.dialCode && cleanDigits.startsWith(country.dialCode)) {
        cleanDigits = cleanDigits.slice(country.dialCode.length).replace(/^0+/, "");
      }

      // Filter out dummy/placeholder numbers, sequential digits, or repeating digits
      if (/^(?:0123456789|1234567890|12345678910|2345678910|123456789|12345678|1234567|9876543210|987654321|(\d)\1{6,})$/.test(cleanDigits)) {
        continue;
      }

      // Only filter on TRUE toll-free prefixes (dropped 400 — not universally toll-free)
      if (/^(1800|1888|800|0800|1544|1588|1577|1566)/.test(cleanDigits)) {
        continue;
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

  // Find all Contact Us subpage URLs dynamically, ranked by relevance
  function findContactSubpages(doc, baseUrl) {
    if (!doc || !baseUrl) return [];
    const found = [];
    const seen = new Set();
    try {
      const base = new URL(baseUrl);
      const baseHostNorm = base.hostname.replace(/^www\./i, "").toLowerCase();

      const contactHrefRegex = /(?:contact|contact-us|contact_us|contactus|contacts|location|locations|our-location|our-locations|reach-us|reach_us|find-us|visit-us|get-in-touch|getintouch|enquiry|enquiries|inquiry|inquiries|send-enquiry|request-information|support|customer-service|customer-support|help|sales\/contact|contact-sales|company\/contact|corporate\/contact|our-company\/contact|company-profile\/contact|about\/contact|about-us\/contact|aboutus\/contact|who-we-are\/contact|오시는길|고객센터|연락처|회사위치|お問い合わせ|アクセス|联系我们|kontakt|contacto|contatti)/i;
      const contactTextRegex = /\b(contact|contact us|get in touch|location|locations|our location|our locations|reach us|find us|visit us|our office|our offices|headquarters|where to find us|office location|enquiry|enquiries|inquiry|inquiries|support|customer service|customer support|help|contact sales|sales contact|오시는길|고객센터|연락처|회사위치|お問い合わせ|お問合せ|アクセス|联系我们|聯繫我們|kontakt|contacto|contáctenos|contatti)\b/i;

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
          if (contactHrefRegex.test(fullTarget)) score += 50;
          if (contactTextRegex.test(text)) score += 40;
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
    const forbidden = checkForbiddenCategories(text, doc);

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
            if (recovered && recovered.length >= 10 && (!companyAddress || recovered.split(",").length > companyAddress.split(",").length)) {
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
      for (const c of COUNTRIES) {
        for (const alias of c.aliases) {
          if (matchesCountryTerm(companyAddress, alias)) {
            countryName = c.name;
            countryObj = c;
            break;
          }
        }
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
    let { state, city } = detectStateAndCity(companyAddress || rawAddress);
    if (companyAddress && /^(?:england|scotland|wales|northern ireland)$/i.test(countryName)) {
      state = "Y";
    }

    // 7. Business Type (Rule 2)
    const businessType = detectBusinessType(text);

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
    const phoneNumber = (headOfficeText && extractPhoneNumber(headOfficeText, countryObj)) ||
      extractPhoneNumber(text, countryObj);

    // 11. Products, Images, Descriptions (Rules 12, 13, 14)
    const counts = extractProductCounts(doc, text);

    // 12. Social Media (Facebook, LinkedIn)
    const social = extractSocialMedia(doc, text);

    // 13. Subpage (English & Contact)
    const enUrl = findEnglishSubpage(doc, url);
    const contactUrls = findContactSubpages(doc, url);
    const contactUrl = contactUrls[0] || null;

    return {
      websiteName: url,
      websiteStatus: "W-Working",
      businessType,
      companyProfile,
      companyName,
      companyNameRaw,
      companyAddress,
      addressSource,
      countryName,
      state: state === "Y" ? "Available" : "Not Available",
      city: city === "Y" ? "Available" : "Not Available",
      emailId: emails.primaryEmail,
      secondaryEmailId: emails.secondaryEmail,
      phoneNumber,
      numberOfProduct: counts.numberOfProduct,
      imageProduct: counts.imageProduct,
      noOfProductDescription: counts.noOfProductDescription,
      forbidden,
      urlRules,
      social,
      enUrl,
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
    isValidEmail,
    mergeContactEmails,
    extractPhoneNumber,
    findRawAddress,
    findEnglishSubpage,
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
