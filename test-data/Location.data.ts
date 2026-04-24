// ============================================================
// test-data/location.data.ts
// Static test data for location.spec.ts
// ============================================================

export const PORTAL_URL = "https://ndwc-portal-dev.azurewebsites.net/";

export const GEO_BANGKOK = {
  latitude: 13.7563,
  longitude: 100.5018,
};

export const GEO_CHIANG_MAI = {
  latitude: 18.8958,
  longitude: 98.957,
  province: "เชียงใหม่",
};

export const GEO_CHIANG_MAI_INT = {
  latitude: 18,
  longitude: 98,
  province: "เชียงใหม่",
};

export const GEO_JAKARTA = {
  latitude: -6.2,
  longitude: 106.8,
};

export const GEO_BOUNDARY_MAX = {
  latitude: 90,
  longitude: 180,
};

export const GEO_BOUNDARY_MIN = {
  latitude: -90,
  longitude: -180,
};

export const GEO_BOUNDARY_OVER_LAT = {
  latitude: 120,
  longitude: 98,
};

export const GEO_BOUNDARY_OVER_LNG = {
  latitude: 18,
  longitude: 250,
};

export const API_LOCATION_PATH = "/api/app/capFeed/getCapFeedLocationDataList";
export const API_COUNTRY_PATH =
  "/api/app/capFeed/getCapFeedCountryDataList?eventId=&sorting=Alert.SendDateTime%20Asc&maxResultCount=1000&skipCount=0";

// Filter values
export const FILTER_EVENT_STANDARD = "มาตรฐานทั่วไป";
export const FILTER_EVENT_TROPICAL_STORM = "พายุโซนร้อน";
export const FILTER_SEVERITIES = ["ร้ายแรงมาก", "ร้ายแรง"] as const;
export const FILTER_CERTAINTIES = ["สังเกตการณ์", "เป็นไปได้"] as const;
export const FILTER_URGENCIES = ["ทันที", "คาดหวัง"] as const;
export const FILTER_SEVERITY_EXTREME = "ร้ายแรงมาก";
export const FILTER_CERTAINTY_OBSERVED = "สังเกตการณ์";
export const FILTER_URGENCY_IMMEDIATE = "ทันที";

// Sort labels
export const SORT_LATEST = "เหตุการณ์ล่าสุด";
export const SORT_OLDEST = "เหตุการณ์เก่าสุด";

// UI labels / text assertions
export const LABEL_LOCATION_TAB = "ค้นหาจากตำแหน่ง";
export const LABEL_USE_CURRENT_LOCATION = "ใช้ตำแหน่งปัจจุบัน";
export const LABEL_SEARCH = "ค้นหา";
export const LABEL_ADVANCED_FILTER = "ตัวกรองขั้นสูง";
export const LABEL_CLEAR_FILTER = "ล้างตัวเลือก";
export const LABEL_ATOM = "ATOM";
export const LABEL_DETAIL = "ดูรายละเอียด";
export const LABEL_COPY = "คัดลอก";
export const LABEL_TOTAL_COUNT = /จำนวนข้อมูลทั้งหมด\s*:/i;
export const LABEL_SEARCH_TIME = /เวลาที่ค้นหา:/i;
export const LABEL_LAT_LNG_FILTER = /ตำแหน่งละติจูด.*ลองจิจูด/i;

// Validation messages
export const MSG_ATOM_CAP = "CAP XML สำหรับการค้นหานี้จัดทำโดย API";
export const MSG_NO_RESULT = "ไม่พบผลลัพธ์การค้นหาที่ตรงกับเงื่อนไขของคุณ";
export const MSG_LAT_REQUIRED = /กรุณากรอกละติจูด/;
export const MSG_LNG_REQUIRED = /กรุณากรอกลองจิจูด/;
export const MSG_LAT_RANGE = /ละติจูดต้องอยู่ระหว่าง/;
export const MSG_LNG_RANGE = /ลองจิจูดต้องอยู่ระหว่าง/;
export const MSG_CLIPBOARD_COPIED = "คัดลอกไปยังคลิปบอร์ดแล้ว";

// Detail modal labels
export const DETAIL_LABELS = [
  "ที่มาของแหล่งข้อมูล:",
  "ความรุนแรง:",
  "ความเร่งด่วน:",
  "ความแน่นอน:",
  "คำเตือนที่มีผล:",
  "คำเตือนสิ้นสุด:",
  "ข้อความแจ้งเตือน:",
  "พื้นที่ที่ได้รับผลกระทบ",
  "ภาค:",
  "จังหวัด:",
  "ตำบล:",
  "พื้นที่รูปแบบ polygon",
] as const;

// Province / region maps
export const PROVINCE_EN_TO_TH: Record<string, string> = {
  "Chiang Mai": "เชียงใหม่",
  Bangkok: "กรุงเทพมหานคร",
  "Chiang Rai": "เชียงราย",
  Nonthaburi: "นนทบุรี",
  "Pathum Thani": "ปทุมธานี",
  "Samut Prakan": "สมุทรปราการ",
  "Nakhon Ratchasima": "นครราชสีมา",
  "Khon Kaen": "ขอนแก่น",
  "Udon Thani": "อุดรธานี",
  Phuket: "ภูเก็ต",
  Songkhla: "สงขลา",
  "Surat Thani": "สุราษฎร์ธานี",
  Rayong: "ระยอง",
  Chonburi: "ชลบุรี",
  Ayutthaya: "พระนครศรีอยุธยา",
  Lampang: "ลำปาง",
  Lamphun: "ลำพูน",
  "Mae Hong Son": "แม่ฮ่องสอน",
  Nan: "น่าน",
  Phayao: "พะเยา",
  Phrae: "แพร่",
  Tak: "ตาก",
  Uttaradit: "อุตรดิตถ์",
  Sukhothai: "สุโขทัย",
  Phitsanulok: "พิษณุโลก",
  Phichit: "พิจิตร",
  "Kamphaeng Phet": "กำแพงเพชร",
  "Nakhon Sawan": "นครสวรรค์",
  "Uthai Thani": "อุทัยธานี",
  Phetchabun: "เพชรบูรณ์",
};

export const REGION_TO_PROVINCES: Record<string, string[]> = {
  ภาคเหนือ: [
    "เชียงใหม่",
    "เชียงราย",
    "ลำปาง",
    "ลำพูน",
    "แม่ฮ่องสอน",
    "น่าน",
    "พะเยา",
    "แพร่",
    "ตาก",
    "อุตรดิตถ์",
    "สุโขทัย",
    "พิษณุโลก",
    "พิจิตร",
    "กำแพงเพชร",
    "นครสวรรค์",
    "อุทัยธานี",
    "เพชรบูรณ์",
  ],
  ภาคกลาง: [
    "กรุงเทพมหานคร",
    "นนทบุรี",
    "ปทุมธานี",
    "สมุทรปราการ",
    "สมุทรสาคร",
    "สมุทรสงคราม",
    "นครปฐม",
    "สุพรรณบุรี",
    "พระนครศรีอยุธยา",
    "อ่างทอง",
    "สิงห์บุรี",
    "ชัยนาท",
    "ลพบุรี",
    "สระบุรี",
    "นครนายก",
    "ปราจีนบุรี",
    "ฉะเชิงเทรา",
    "ชลบุรี",
    "ระยอง",
  ],
  ภาคตะวันออกเฉียงเหนือ: [
    "นครราชสีมา",
    "ขอนแก่น",
    "อุดรธานี",
    "อุบลราชธานี",
    "สุรินทร์",
    "บุรีรัมย์",
    "ศรีสะเกษ",
    "ร้อยเอ็ด",
    "มหาสารคาม",
    "กาฬสินธุ์",
    "สกลนคร",
    "นครพนม",
    "มุกดาหาร",
    "หนองคาย",
    "หนองบัวลำภู",
    "เลย",
    "ชัยภูมิ",
    "ยโสธร",
    "อำนาจเจริญ",
    "บึงกาฬ",
  ],
  ภาคใต้: [
    "ภูเก็ต",
    "สงขลา",
    "สุราษฎร์ธานี",
    "นครศรีธรรมราช",
    "กระบี่",
    "พังงา",
    "ระนอง",
    "ชุมพร",
    "ตรัง",
    "พัทลุง",
    "สตูล",
    "ปัตตานี",
    "ยะลา",
    "นราธิวาส",
  ],
  ภาคตะวันออก: [
    "ชลบุรี",
    "ระยอง",
    "จันทบุรี",
    "ตราด",
    "ฉะเชิงเทรา",
    "ปราจีนบุรี",
    "สระแก้ว",
  ],
  ภาคตะวันตก: ["ตาก", "กาญจนบุรี", "ราชบุรี", "เพชรบุรี", "ประจวบคีรีขันธ์"],
};