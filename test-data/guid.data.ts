export const GUID_DATA = {
  URL: "https://ndwc-portal-dev.azurewebsites.net/",

  GUIDS: {
    VALID: "NDWC20260420103022_2",
    INVALID: "NDWC99999999999999_9",
  },

  API: {
    GUID_LIST: "/api/app/capFeed/getCapFeedGuidDataList",
  },

  TEXT: {
    TAB_NAME: "ค้นหาจาก Id",
    SEARCH_BUTTON: "ค้นหา",
    EMPTY_RESULT: "ไม่พบผลลัพธ์การค้นหาที่ตรงกับเงื่อนไขของคุณ",
    REQUIRED_GUID: "กรุณากรอก Guid",
    DETAIL_BUTTON: /ดูรายละเอียด/,
    COPY_SUCCESS: /คัดลอกไปยังคลิปบอร์ดแล้ว|copied|คัดลอกแล้ว/i,
  },

  LABELS: {
    SOURCE: "ที่มาของแหล่งข้อมูล:",
    SEVERITY: "ความรุนแรง:",
    URGENCY: "ความเร่งด่วน:",
    CERTAINTY: "ความแน่นอน:",
    EFFECTIVE: "คำเตือนที่มีผล:",
    EXPIRED: "คำเตือนสิ้นสุด:",
    DESCRIPTION: "ข้อความแจ้งเตือน:",
    AFFECTED_AREA: "พื้นที่ที่ได้รับผลกระทบ",
    REGION: "ภาค:",
    PROVINCE: "จังหวัด:",
    TAMBON: "ตำบล:",
    POLYGON: "พื้นที่รูปแบบ polygon",
  },
};
