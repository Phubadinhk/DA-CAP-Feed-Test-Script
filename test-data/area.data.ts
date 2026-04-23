export const AREA_DATA = {
  portalUrl: "https://ndwc-portal-dev.azurewebsites.net/",

  // TC-DA-AREA-001
  singleProvince: "เชียงใหม่",

  // TC-DA-AREA-002
  multipleProvinces: ["เชียงราย", "เชียงใหม่"],

  // TC-DA-AREA-003
  noResultProvinces: ["เชียงใหม่", "แม่ฮ่องสอน"],

  // TC-DA-AREA-005
  provinceSearchKeyword: "เชียงใหม่",
  provinceSearchTarget: "เชียงใหม่",

  // TC-DA-AREA-006
  invalidProvinceKeyword: "zzzz_not_found_123",

  // TC-DA-AREA-008
  singleRegion: "ภาคเหนือ",
  northernProvinces: [
    "เชียงใหม่", "เชียงราย", "ลำปาง", "ลำพูน", "แม่ฮ่องสอน",
    "น่าน", "พะเยา", "แพร่", "อุตรดิตถ์", "ตาก", "สุโขทัย",
    "พิษณุโลก", "พิจิตร", "เพชรบูรณ์", "กำแพงเพชร", "นครสวรรค์", "อุทัยธานี",
  ],

  // TC-DA-AREA-009
  multipleRegions: ["ภาคเหนือ", "ภาคกลาง"],

  // TC-DA-AREA-010
  noResultRegions: ["ภาคเหนือ", "ภาคใต้ (ฝั่งตะวันตก)"],

  // TC-DA-AREA-012
  regionSearchKeyword: "ภาคเหนือ",
  regionSearchTarget: "ภาคเหนือ",

  // TC-DA-AREA-013
  invalidRegionKeyword: "zzzz_not_found_region_123",

  // TC-DA-AREA-014
  expectedRegions: [
    "ภาคเหนือ",
    "ภาคกลาง",
    "ภาคตะวันออก",
    "ภาคใต้ (ฝั่งตะวันออก)",
    "ภาคใต้ (ฝั่งตะวันตก)",
    "กรุงเทพมหานครและปริมณฑล",
  ],

  // TC-DA-AREA-007
  expectedProvinceCount: 70,
  keyProvinces: ["กรุงเทพมหานคร", "เชียงใหม่", "ชลบุรี", "ภูเก็ต", "ขอนแก่น"],

  // TC-DA-AREA-015
  combinedRegion: "ภาคเหนือ",
  combinedProvince: "เชียงใหม่",

  // TC-DA-AREA-023 / 024 / 028 / 029
  eventName: "มาตรฐานทั่วไป",

  // TC-DA-AREA-025 / 028
  selectedSeverities: ["ร้ายแรงมาก", "ร้ายแรง"],
  severityApiAliases: {
    ร้ายแรงมาก: ["ร้ายแรงมาก", "Extreme", "extreme", "4"],
    ร้ายแรง: ["ร้ายแรง", "Severe", "severe", "3"],
    ปานกลาง: ["ปานกลาง", "Moderate", "moderate", "2"],
    เล็กน้อย: ["เล็กน้อย", "Minor", "minor", "1"],
    ไม่ทราบ: ["ไม่ทราบ", "Unknown", "unknown", "0"],
  } as Record<string, string[]>,

  // TC-DA-AREA-026 / 028
  selectedCertainties: ["สังเกตการณ์", "เป็นไปได้"],
  certaintyApiAliases: {
    สังเกตการณ์: ["สังเกตการณ์", "Observed", "observed"],
    เป็นไปได้: ["เป็นไปได้", "Possible", "possible"],
    น่าจะ: ["น่าจะ", "Likely", "likely"],
    คาดว่าจะไม่เกิด: ["คาดว่าจะไม่เกิด", "Unlikely", "unlikely"],
    ไม่ทราบ: ["ไม่ทราบ", "Unknown", "unknown"],
  } as Record<string, string[]>,

  // TC-DA-AREA-027 / 028
  selectedUrgencies: ["ทันที", "คาดหวัง"],
  urgencyApiAliases: {
    ทันที: ["ทันที", "Immediate", "immediate"],
    คาดหวัง: ["คาดหวัง", "Expected", "expected"],
    อนาคต: ["อนาคต", "Future", "future"],
    อดีต: ["อดีต", "Past", "past"],
    ไม่ทราบ: ["ไม่ทราบ", "Unknown", "unknown"],
  } as Record<string, string[]>,

  // TC-DA-AREA-028 (single values for combined filter test)
  singleSeverity: "ร้ายแรงมาก",
  singleCertainty: "สังเกตการณ์",
  singleUrgency: "ทันที",

  // TC-DA-AREA-031 / 032
  sortNewest: "เหตุการณ์ล่าสุด",
  sortOldest: "เหตุการณ์เก่าสุด",

  // TC-DA-AREA-037 / 039
  modalRequiredFields: [
    "ที่มาของแหล่งข้อมูล",
    "ความรุนแรง",
    "ความเร่งด่วน",
    "ความแน่นอน",
    "คำเตือนที่มีผล",
    "คำเตือนสิ้นสุด",
    "ข้อความแจ้งเตือน",
    "พื้นที่ที่ได้รับผลกระทบ",
    "ภาค",
    "จังหวัด",
    "ตำบล",
  ],
  modalAreaFields: ["ภาค", "จังหวัด", "ตำบล"],

  // Text constants
  noResultText: "ไม่พบผลลัพธ์การค้นหาที่ตรงกับเงื่อนไขของคุณ",
  copiedToClipboardText: "คัดลอกไปยังคลิปบอร์ดแล้ว",
} as const;