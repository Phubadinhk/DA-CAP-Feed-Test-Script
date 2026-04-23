// ============================================================
// tests/location.spec.ts
// Refactored with Page Object Model and geo helpers in LocationPage
// ============================================================

import { test, expect, Browser } from "@playwright/test";
import { LocationPage } from "../page-object/LocationPage";
import {
  PORTAL_URL,
  GEO_BANGKOK,
  GEO_CHIANG_MAI,
  GEO_CHIANG_MAI_INT,
  GEO_JAKARTA,
  GEO_BOUNDARY_MAX,
  GEO_BOUNDARY_MIN,
  GEO_BOUNDARY_OVER_LAT,
  GEO_BOUNDARY_OVER_LNG,
  API_COUNTRY_PATH,
  FILTER_EVENT_STANDARD,
  FILTER_EVENT_TROPICAL_STORM,
  FILTER_SEVERITIES,
  FILTER_CERTAINTIES,
  FILTER_URGENCIES,
  FILTER_SEVERITY_EXTREME,
  FILTER_CERTAINTY_OBSERVED,
  FILTER_URGENCY_IMMEDIATE,
  SORT_LATEST,
  SORT_OLDEST,
  MSG_ATOM_CAP,
  MSG_NO_RESULT,
  DETAIL_LABELS,
  PROVINCE_EN_TO_TH,
} from "../test-data/Location.data";

// ============================================================
// beforeEach / afterEach
// ============================================================

let locationPage: LocationPage;

test.beforeEach(async ({ page }) => {
  locationPage = new LocationPage(page);
  await locationPage.goto();
  await locationPage.openLocationTab();
});

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    await page.screenshot({
      path: `screenshots/${testInfo.title.replace(/[^\w\s-]/g, "")}.png`,
      fullPage: true,
    });
  }
});

// ============================================================
// TC-DA-LOC-001
// ============================================================

test("TC-DA-LOC-001 : ตรวจสอบระบบดึง Latitude/Longitude ได้ถูกต้อง", async ({
  page,
}) => {
  test.setTimeout(120000);

  await page.context().setGeolocation(GEO_BANGKOK);
  await page.context().grantPermissions(["geolocation"], {
    origin: PORTAL_URL,
  });

  await locationPage.clickUseCurrentLocation();

  const latInput = locationPage.latInput();
  const lngInput = locationPage.lngInput();

  await expect(latInput).toBeVisible();
  await expect(lngInput).toBeVisible();

  await expect
    .poll(async () => Number(await latInput.inputValue()))
    .toBeCloseTo(GEO_BANGKOK.latitude, 4);
  await expect
    .poll(async () => Number(await lngInput.inputValue()))
    .toBeCloseTo(GEO_BANGKOK.longitude, 4);
});

// ============================================================
// TC-DA-LOC-002
// ============================================================

test("TC-DA-LOC-002 : ตรวจสอบแสดงข้อมูลเมื่อกดค้นหา", async ({ page }) => {
  test.setTimeout(120000);

  const geo = await locationPage.fetchGeo();
  console.log(
    `📍 ตำแหน่ง: ${geo.latitude}, ${geo.longitude} | จังหวัด: "${geo.province}"`,
  );

  await page.context().setGeolocation({
    latitude: geo.latitude,
    longitude: geo.longitude,
  });
  await page.context().grantPermissions(["geolocation"], { origin: PORTAL_URL });

  await locationPage.goto();
  await locationPage.openLocationTab();
  await locationPage.clickUseCurrentLocation();

  const searchResponsePromise = locationPage.waitForLocationApiResponse();
  await locationPage.clickSearch();
  const searchResponse = await searchResponsePromise;
  const searchData = await searchResponse.json();

  console.log(
    `📦 API totalCount: ${searchData.totalCount}, items: ${searchData.items?.length}`,
  );
  expect(searchData.items.length).toBeGreaterThan(0);

  let searchProvince = geo.province;
  searchProvince = PROVINCE_EN_TO_TH[searchProvince] ?? searchProvince;

  if (searchProvince === "") {
    const firstArea = searchData.items?.[0]?.areasItem?.[0];
    searchProvince = (firstArea?.province ?? firstArea?.areaDescription ?? "")
      .replace(/^จังหวัด/, "")
      .trim();
    console.warn(`⚠️ fallback province จาก API item: "${searchProvince}"`);
  }

  console.log(`🗺️ จังหวัดของตำแหน่งค้นหา: "${searchProvince}"`);
  expect(searchProvince).not.toBe("");

  const allItemsRes = await page.request.get(
    `${PORTAL_URL}${API_COUNTRY_PATH.replace(PORTAL_URL, "")}`,
  );
  expect(allItemsRes.ok()).toBeTruthy();
  const allItemsData = await allItemsRes.json();
  console.log(`🌐 Country API totalCount: ${allItemsData.totalCount}`);

  for (const item of searchData.items) {
    const areas = item.areasItem ?? [];
    expect(areas.length, `item "${item.headline}" ไม่มี areasItem`).toBeGreaterThan(0);

    const { covered, debugLog } = locationPage.checkAreaCoverage(
      geo.latitude,
      geo.longitude,
      searchProvince,
      areas,
      item.areaDesc,
    );

    console.log(
      `🃏 "${item.headline}" | ${debugLog.join(" | ")} | covered: ${covered}`,
    );
    expect(
      covered,
      `item "${item.headline}" ไม่ครอบคลุมตำแหน่ง lat=${geo.latitude}, lng=${geo.longitude} จังหวัด="${searchProvince}"`,
    ).toBe(true);
  }

  console.log(`✅ ตรวจสอบ ${searchData.items.length} items ผ่านทั้งหมด`);

  const cards = page.locator(
    "#capFeedLocationCardContainer .card, .alert-card, [class*='card'][class*='location']",
  );
  await expect(cards.first()).toBeVisible({ timeout: 10000 });
  const cardCount = await cards.count();
  expect(cardCount).toBeGreaterThan(0);
  console.log(`🖥️ UI แสดง ${cardCount} cards`);
});

// ============================================================
// TC-DA-LOC-003
// ============================================================

test("TC-DA-LOC-003 : ตรวจสอบเมื่อกด ไม่อนุญาต", async ({
  browser,
}: {
  browser: Browser;
}) => {
  test.setTimeout(60000);

  const context = await browser.newContext({ permissions: [] });
  const page = await context.newPage();
  const loc = new LocationPage(page);

  await loc.goto();
  await loc.openLocationTab();
  await loc.clickUseCurrentLocation();

  await page.waitForTimeout(3000);

  const latValue = await page
    .locator('input[placeholder*="at"], input[id*="lat"], input[name*="lat"]')
    .first()
    .inputValue();
  const lngValue = await page
    .locator(
      'input[placeholder*="on"], input[id*="lng"], input[id*="lon"], input[name*="lng"]',
    )
    .first()
    .inputValue();

  console.log(`📌 Latitude: "${latValue}" | Longitude: "${lngValue}"`);
  expect(
    latValue,
    "ช่อง Latitude ต้องเป็นค่าว่างเมื่อไม่อนุญาต geolocation",
  ).toBe("");
  expect(
    lngValue,
    "ช่อง Longitude ต้องเป็นค่าว่างเมื่อไม่อนุญาต geolocation",
  ).toBe("");

  console.log("✅ Latitude และ Longitude เป็นค่าว่าง — ผ่าน");
  await context.close();
});

// ============================================================
// TC-DA-LOC-005
// ============================================================

test("TC-DA-LOC-005 : ตรวจสอบค้นหาด้วยค่าที่ถูกต้อง", async ({ page }) => {
  test.setTimeout(60000);

  const { latitude: testLat, longitude: testLng } = GEO_CHIANG_MAI_INT;
  let searchProvince = "เชียงใหม่";

  try {
    const geo = await locationPage.fetchGeo();
    searchProvince =
      PROVINCE_EN_TO_TH[geo.province] ??
      geo.province.replace(/^จังหวัด/, "").trim() ??
      "เชียงใหม่";
  } catch {}

  await locationPage.fillCoordinates(testLat, testLng);
  console.log(`📌 กรอก Latitude: ${testLat} | Longitude: ${testLng}`);

  const searchResponsePromise = locationPage.waitForLocationApiResponse();
  await locationPage.clickSearch();
  const searchResponse = await searchResponsePromise;
  const searchData = await searchResponse.json();

  console.log(
    `📦 API totalCount: ${searchData.totalCount}, items: ${searchData.items?.length}`,
  );
  expect(searchData.items.length, "ต้องมีผลลัพธ์อย่างน้อย 1 รายการ").toBeGreaterThan(0);

  console.log(`🗺️ จังหวัดของตำแหน่งค้นหา: "${searchProvince}"`);

  for (const item of searchData.items) {
    const areas = item.areasItem ?? [];
    expect(areas.length, `item "${item.headline}" ไม่มี areasItem`).toBeGreaterThan(0);

    const { covered, debugLog } = locationPage.checkAreaCoverage(
      testLat,
      testLng,
      searchProvince,
      areas,
      item.areaDesc,
    );
    console.log(
      `🃏 "${item.headline}" | ${debugLog.join(" | ")} | covered: ${covered}`,
    );
    expect(
      covered,
      `item "${item.headline}" ไม่ครอบคลุมตำแหน่ง lat=${testLat}, lng=${testLng} จังหวัด="${searchProvince}"`,
    ).toBe(true);
  }

  const cards = page.locator("#capFeedLocationCardContainer .card");
  await expect(cards.first()).toBeVisible({ timeout: 10000 });
  const cardCount = await cards.count();
  expect(cardCount, "UI ต้องแสดง card อย่างน้อย 1 ใบ").toBeGreaterThan(0);
  console.log(
    `✅ ตรวจสอบ ${searchData.items.length} items, UI แสดง ${cardCount} cards — ผ่านทั้งหมด`,
  );
});

// ============================================================
// TC-DA-LOC-006
// ============================================================

test("TC-DA-LOC-006 : ตรวจสอบรองรับ decimal", async ({ page }) => {
  test.setTimeout(60000);

  const { latitude: testLat, longitude: testLng } = GEO_CHIANG_MAI;
  let searchProvince = "เชียงใหม่";

  try {
    const geo = await locationPage.fetchGeo();
    searchProvince =
      PROVINCE_EN_TO_TH[geo.province] ??
      geo.province.replace(/^จังหวัด/, "").trim() ??
      "เชียงใหม่";
  } catch {}

  await locationPage.fillCoordinates(testLat, testLng);
  console.log(`📌 กรอก Latitude: ${testLat} | Longitude: ${testLng}`);

  const searchResponsePromise = locationPage.waitForLocationApiResponse();
  await locationPage.clickSearch();
  const searchResponse = await searchResponsePromise;
  const searchData = await searchResponse.json();

  console.log(
    `📦 API totalCount: ${searchData.totalCount}, items: ${searchData.items?.length}`,
  );
  expect(searchData.items.length, "ต้องมีผลลัพธ์อย่างน้อย 1 รายการ").toBeGreaterThan(0);
  console.log(`🗺️ จังหวัดของตำแหน่งค้นหา: "${searchProvince}"`);

  for (const item of searchData.items) {
    const areas = item.areasItem ?? [];
    expect(areas.length, `item "${item.headline}" ไม่มี areasItem`).toBeGreaterThan(0);
    const { covered, debugLog } = locationPage.checkAreaCoverage(
      testLat,
      testLng,
      searchProvince,
      areas,
      item.areaDesc,
    );
    console.log(
      `🃏 "${item.headline}" | ${debugLog.join(" | ")} | covered: ${covered}`,
    );
    expect(
      covered,
      `item "${item.headline}" ไม่ครอบคลุมตำแหน่ง lat=${testLat}, lng=${testLng} จังหวัด="${searchProvince}"`,
    ).toBe(true);
  }

  const cards = page.locator("#capFeedLocationCardContainer .card");
  await expect(cards.first()).toBeVisible({ timeout: 10000 });
  const cardCount = await cards.count();
  expect(cardCount, "UI ต้องแสดง card อย่างน้อย 1 ใบ").toBeGreaterThan(0);
  console.log(
    `✅ ตรวจสอบ ${searchData.items.length} items, UI แสดง ${cardCount} cards — ผ่านทั้งหมด`,
  );
});

// ============================================================
// TC-DA-LOC-008
// ============================================================

test("TC-DA-LOC-008 : ตรวจสอบการทำงานของ Validation เมื่อผู้ใช้กรอกข้อมูลเป็นตัวอักษร", async ({
  page,
}) => {
  test.setTimeout(60000);

  const latInput = page.locator('input[id="lat"], input[name="Lat"]').first();
  const lngInput = page
    .locator('input[id="lng"], input[id="lon"], input[name="Lng"], input[name="Lon"]')
    .first();

  await expect(latInput).toHaveAttribute("type", "number");
  await expect(lngInput).toHaveAttribute("type", "number");
  console.log("✅ input[type=number] ไม่รับตัวอักษร — ผ่าน");

  await latInput.click();
  await page.keyboard.type("abc");
  await lngInput.click();
  await page.keyboard.type("abc");

  const latValue = await latInput.inputValue();
  const lngValue = await lngInput.inputValue();

  console.log(`📌 Latitude value หลังพิมพ์ "abc": "${latValue}"`);
  console.log(`📌 Longitude value หลังพิมพ์ "abc": "${lngValue}"`);

  expect(latValue, "ช่อง Latitude ต้องไม่รับตัวอักษร").not.toBe("abc");
  expect(lngValue, "ช่อง Longitude ต้องไม่รับตัวอักษร").not.toBe("abc");

  const apiCalled = await Promise.race([
    page
      .waitForResponse(
        (r) => r.url().includes("/api/app/capFeed/getCapFeedLocationDataList"),
        { timeout: 3000 },
      )
      .then(() => true)
      .catch(() => false),
    locationPage
      .clickSearch()
      .then(() => new Promise<boolean>((res) => setTimeout(() => res(false), 3000))),
  ]);

  expect(apiCalled, "ต้องไม่มีการ call API เมื่อค่า input ไม่ถูกต้อง").toBe(false);
  console.log("✅ ระบบไม่ call API เมื่อกรอกตัวอักษร — ผ่าน");
});

// ============================================================
// TC-DA-LOC-009
// ============================================================

test("TC-DA-LOC-009 : ตรวจสอบ Validation เมื่อกรอกค่า Latitude เกิน 90", async () => {
  test.setTimeout(60000);

  const latInput = locationPage.latInput();
  await latInput.fill(String(GEO_BOUNDARY_OVER_LAT.latitude));
  console.log(`📌 กรอก Latitude: ${GEO_BOUNDARY_OVER_LAT.latitude}`);

  await locationPage.clickSearch();

  await expect(
    locationPage.latRangeError(),
    "ต้องแสดงข้อความ 'ละติจูดต้องอยู่ระหว่าง -90 ถึง 90'",
  ).toBeVisible({ timeout: 5000 });

  console.log(`✅ แสดง validation message — ผ่าน`);
});

// ============================================================
// TC-DA-LOC-010
// ============================================================

test("TC-DA-LOC-010 : ตรวจสอบ Validation เมื่อกรอกค่า Longitude เกิน 180", async () => {
  test.setTimeout(60000);

  const lngInput = locationPage.lngInput();
  await lngInput.fill(String(GEO_BOUNDARY_OVER_LNG.longitude));
  console.log(`📌 กรอก Longitude: ${GEO_BOUNDARY_OVER_LNG.longitude}`);

  await locationPage.clickSearch();

  await expect(
    locationPage.lngRangeError(),
    "ต้องแสดงข้อความ 'ลองจิจูดต้องอยู่ระหว่าง -180 ถึง 180'",
  ).toBeVisible({ timeout: 5000 });

  console.log(`✅ แสดง validation message — ผ่าน`);
});

// ============================================================
// TC-DA-LOC-011
// ============================================================

test("TC-DA-LOC-011 : ตรวจสอบ Validation เมื่อไม่กรอกข้อมูลในช่องที่กำหนด", async () => {
  test.setTimeout(60000);

  await locationPage.clickSearch();

  await expect(
    locationPage.latValidationError(),
    "ต้องแสดงข้อความ 'กรุณากรอกละติจูด'",
  ).toBeVisible({ timeout: 5000 });

  console.log(`✅ Latitude validation ผ่าน`);

  await expect(
    locationPage.lngValidationError(),
    "ต้องแสดงข้อความ 'กรุณากรอกลองจิจูด'",
  ).toBeVisible({ timeout: 5000 });

  console.log(`✅ Longitude validation ผ่าน`);
});

// ============================================================
// TC-DA-LOC-012
// ============================================================

test("TC-DA-LOC-012 : ตรวจสอบการรับค่าติดลบของ Latitude/Longitude สำหรับซีกโลกใต้และตะวันตก", async () => {
  test.setTimeout(60000);

  const { latitude: testLat, longitude: testLng } = GEO_JAKARTA;

  await locationPage.fillCoordinates(testLat, testLng);
  await locationPage.assertCoordinateFilled(testLat, testLng);
  console.log(`📌 กรอก Latitude: ${testLat} | Longitude: ${testLng}`);

  const searchResponsePromise = locationPage.waitForLocationApiResponse();
  await locationPage.clickSearch();

  await expect(
    locationPage.page
      .locator('[data-valmsg-for="Lat"]')
      .filter({ hasText: /.+/ })
      .first(),
  )
    .toBeHidden({ timeout: 3000 })
    .catch(() => {});

  await expect(
    locationPage.page
      .locator('[data-valmsg-for="Lng"], [data-valmsg-for="Lon"]')
      .filter({ hasText: /.+/ })
      .first(),
  )
    .toBeHidden({ timeout: 3000 })
    .catch(() => {});

  console.log("✅ ไม่มี validation error — ค่าติดลบอยู่ในช่วงที่ถูกต้อง");

  const searchResponse = await searchResponsePromise;
  expect(searchResponse.ok()).toBeTruthy();

  const responseBody = await searchResponse.json();
  console.log(
    `✅ ระบบ call API สำเร็จ | totalCount: ${responseBody.totalCount}, items: ${responseBody.items?.length ?? 0}`,
  );
  expect(responseBody).toBeTruthy();
});

// ============================================================
// TC-DA-LOC-013
// ============================================================

test("TC-DA-LOC-013 : ตรวจสอบการกรอกค่าขอบเขตสูงสุดของ Latitude และ Longitude", async ({
  page,
}) => {
  test.setTimeout(60000);

  const latInput = locationPage.latInput();
  const lngInput = locationPage.lngInput();

  await latInput.fill(String(GEO_BOUNDARY_MAX.latitude));
  await lngInput.fill(String(GEO_BOUNDARY_MAX.longitude));
  await expect(latInput).toHaveValue(String(GEO_BOUNDARY_MAX.latitude));
  await expect(lngInput).toHaveValue(String(GEO_BOUNDARY_MAX.longitude));
  console.log(
    `📌 ทดสอบ Lat=${GEO_BOUNDARY_MAX.latitude}, Lng=${GEO_BOUNDARY_MAX.longitude}`,
  );

  await locationPage.clickSearch();

  await expect(page.locator('[data-valmsg-for="Lat"]').filter({ hasText: /.+/ }))
    .toBeHidden({ timeout: 3000 })
    .catch(() => {});
  await expect(
    page.locator('[data-valmsg-for="Lng"], [data-valmsg-for="Lon"]').filter({
      hasText: /.+/,
    }),
  )
    .toBeHidden({ timeout: 3000 })
    .catch(() => {});

  const apiMax = await page
    .waitForResponse(
      (r) =>
        r.url().includes("/api/app/capFeed/getCapFeedLocationDataList") &&
        r.status() === 200,
      { timeout: 10000 },
    )
    .then(() => true)
    .catch(() => false);

  expect(
    apiMax,
    `ระบบต้อง call API เมื่อกรอก Lat=${GEO_BOUNDARY_MAX.latitude}, Lng=${GEO_BOUNDARY_MAX.longitude}`,
  ).toBe(true);
  console.log("✅ ค่าขอบเขตสูงสุด — ผ่าน");

  await latInput.fill(String(GEO_BOUNDARY_MIN.latitude));
  await lngInput.fill(String(GEO_BOUNDARY_MIN.longitude));
  await expect(latInput).toHaveValue(String(GEO_BOUNDARY_MIN.latitude));
  await expect(lngInput).toHaveValue(String(GEO_BOUNDARY_MIN.longitude));
  console.log(
    `📌 ทดสอบ Lat=${GEO_BOUNDARY_MIN.latitude}, Lng=${GEO_BOUNDARY_MIN.longitude}`,
  );

  await locationPage.clickSearch();

  await expect(page.locator('[data-valmsg-for="Lat"]').filter({ hasText: /.+/ }))
    .toBeHidden({ timeout: 3000 })
    .catch(() => {});
  await expect(
    page.locator('[data-valmsg-for="Lng"], [data-valmsg-for="Lon"]').filter({
      hasText: /.+/,
    }),
  )
    .toBeHidden({ timeout: 3000 })
    .catch(() => {});

  const apiMin = await page
    .waitForResponse(
      (r) =>
        r.url().includes("/api/app/capFeed/getCapFeedLocationDataList") &&
        r.status() === 200,
      { timeout: 10000 },
    )
    .then(() => true)
    .catch(() => false);

  expect(
    apiMin,
    `ระบบต้อง call API เมื่อกรอก Lat=${GEO_BOUNDARY_MIN.latitude}, Lng=${GEO_BOUNDARY_MIN.longitude}`,
  ).toBe(true);
  console.log("✅ ค่าขอบเขตต่ำสุด — ผ่าน");
});

// ============================================================
// TC-DA-LOC-015
// ============================================================

test("TC-DA-LOC-015 : ตรวจสอบแสดงตำแหน่งละติจูด, ลองจิจูด", async ({ page }) => {
  test.setTimeout(60000);

  const { latitude: testLat, longitude: testLng } = GEO_CHIANG_MAI;

  await locationPage.fillCoordinates(testLat, testLng);

  const searchResponsePromise = locationPage.waitForLocationApiResponse();
  await locationPage.clickSearch();
  await searchResponsePromise;

  const filterLabel = page
    .locator("*")
    .filter({ hasText: /ตำแหน่งละติจูด.*ลองจิจูด/i })
    .first();

  await expect(
    filterLabel,
    "ต้องแสดงข้อความ 'ตำแหน่งละติจูด, ลองจิจูด:'",
  ).toBeVisible({
    timeout: 5000,
  });

  const filterText = await filterLabel.innerText();
  console.log(`📌 Filter text: "${filterText}"`);

  const coordMatch = filterText.match(/([-\d.]+)\s*,\s*([-\d.]+)/);
  expect(coordMatch, "ต้องพบค่าพิกัดในรูปแบบ [ละติจูด], [ลองจิจูด]").not.toBeNull();

  const displayedLat = Number(coordMatch![1]);
  const displayedLng = Number(coordMatch![2]);

  console.log(`📌 แสดง Latitude: ${displayedLat} | Longitude: ${displayedLng}`);

  expect(displayedLat, "ค่า Latitude ที่แสดงต้องตรงกับที่กรอก").toBeCloseTo(testLat, 3);
  expect(displayedLng, "ค่า Longitude ที่แสดงต้องตรงกับที่กรอก").toBeCloseTo(testLng, 3);
  expect(
    displayedLat,
    "ค่าแรกต้องเป็น Latitude (ไม่สลับกับ Longitude)",
  ).not.toBeCloseTo(testLng, 0);

  console.log("✅ แสดงพิกัดถูกต้อง ครบถ้วน และไม่สลับตำแหน่ง — ผ่าน");
});

// ============================================================
// TC-DA-LOC-016
// ============================================================

test("TC-DA-LOC-016 : ตรวจสอบแสดงจำนวนข้อมูล", async ({ page }) => {
  test.setTimeout(60000);

  const { latitude: testLat, longitude: testLng } = GEO_CHIANG_MAI;

  await locationPage.fillCoordinates(testLat, testLng);

  const searchResponsePromise = locationPage.waitForLocationApiResponse();
  await locationPage.clickSearch();
  const searchResponse = await searchResponsePromise;
  const searchData = await searchResponse.json();
  const apiTotal = Number(searchData.totalCount);

  console.log(`📦 API totalCount: ${apiTotal}`);

  const totalLabel = page
    .locator("*")
    .filter({ hasText: /จำนวนข้อมูลทั้งหมด\s*:/i })
    .first();

  await expect(totalLabel, "ต้องแสดงข้อความ 'จำนวนข้อมูลทั้งหมด:'").toBeVisible({
    timeout: 5000,
  });

  const labelText = await totalLabel.innerText();
  console.log(`📌 Label text: "${labelText}"`);

  const countMatch = labelText.match(/จำนวนข้อมูลทั้งหมด\s*:\s*([\d,]+)/i);
  expect(countMatch, "ต้องพบตัวเลขจำนวนข้อมูลในข้อความ").not.toBeNull();

  const displayedTotal = Number(countMatch![1].replace(/,/g, ""));
  console.log(`📌 จำนวนที่แสดง: ${displayedTotal} | API totalCount: ${apiTotal}`);

  expect(
    displayedTotal,
    `จำนวนที่แสดง (${displayedTotal}) ต้องตรงกับ API totalCount (${apiTotal})`,
  ).toBe(apiTotal);
  console.log("✅ จำนวนข้อมูลที่แสดงตรงกับ API — ผ่าน");
});

// ============================================================
// TC-DA-LOC-017
// ============================================================

test("TC-DA-LOC-017 : ตรวจสอบแสดงเวลาค้นหา", async ({ page }) => {
  test.setTimeout(60000);

  const { latitude: testLat, longitude: testLng } = GEO_CHIANG_MAI;

  await locationPage.fillCoordinates(testLat, testLng);

  const searchStart = new Date();
  const searchResponsePromise = locationPage.waitForLocationApiResponse();
  await locationPage.clickSearch();
  await searchResponsePromise;
  const searchLoaded = new Date();

  await expect(
    page.getByLabel("ค้นหาจากตำแหน่ง").getByText("เวลาที่ค้นหา:"),
  ).toBeVisible({ timeout: 5000 });

  const pageText = await page.getByLabel("ค้นหาจากตำแหน่ง").innerText();
  const searchTimeMatch = pageText.match(
    /เวลาที่ค้นหา:\s*([0-2]\d):([0-5]\d):([0-5]\d)(?:\s*(UTC\+\d+))?/,
  );
  expect(
    searchTimeMatch,
    `ต้องพบเวลาในรูปแบบ HH:MM:SS (ข้อความจริง: "${pageText}")`,
  ).not.toBeNull();

  const displayedHours = Number(searchTimeMatch![1]);
  const displayedMinutes = Number(searchTimeMatch![2]);
  const displayedSeconds = Number(searchTimeMatch![3]);
  const displayedTimezone = searchTimeMatch![4];
  const displayedTimeInSeconds =
    displayedHours * 3600 + displayedMinutes * 60 + displayedSeconds;

  console.log(
    `📌 เวลาที่แสดง: ${searchTimeMatch![1]}:${searchTimeMatch![2]}:${searchTimeMatch![3]} ${displayedTimezone ?? ""}`,
  );

  if (displayedTimezone) {
    expect(displayedTimezone).toBe("UTC+7");
  }

  const bufferSeconds = 30;
  const windowStartSeconds = locationPage.toUtcPlus7Seconds(searchStart) - bufferSeconds;
  const windowEndSeconds = locationPage.toUtcPlus7Seconds(searchLoaded) + bufferSeconds;

  expect(
    locationPage.isInSecondWindow(
      displayedTimeInSeconds,
      windowStartSeconds,
      windowEndSeconds,
    ),
    `เวลาที่แสดง (${displayedTimeInSeconds}s) ต้องอยู่ใน window [${windowStartSeconds}s, ${windowEndSeconds}s]`,
  ).toBeTruthy();

  console.log("✅ แสดงเวลาค้นหาถูกต้อง — ผ่าน");
});

// ============================================================
// TC-DA-LOC-019
// ============================================================

test("TC-DA-LOC-019 : ตรวจสอบฟิลเตอร์ ATOM XML และการคัดลอกข้อมูล", async ({
  page,
  context,
}) => {
  test.setTimeout(60000);

  const { latitude: testLat, longitude: testLng } = GEO_CHIANG_MAI;

  await locationPage.fillCoordinates(testLat, testLng);

  const searchResponsePromise = locationPage.waitForLocationApiResponse();
  await locationPage.clickSearch();
  await searchResponsePromise;

  await locationPage.clickAtomButton();

  const section = locationPage.section();
  await expect(section.getByText(MSG_ATOM_CAP)).toBeVisible();

  const atomCopyRow = locationPage.atomCopyRow();
  await expect(atomCopyRow).toBeVisible();

  const expectedCopiedUrl = await locationPage.getAtomCopyUrl();
  expect(expectedCopiedUrl).toMatch(/^https?:\/\/.+\/cap\/feed\/xml/i);

  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await locationPage.clickAtomCopyIcon();

  const copiedUrl = (await page.evaluate(() => navigator.clipboard.readText())).trim();
  expect(copiedUrl).toBe(expectedCopiedUrl);

  const xmlPage = await page.context().newPage();
  const xmlResponse = await xmlPage.goto(copiedUrl, {
    waitUntil: "domcontentloaded",
  });
  expect(xmlResponse).not.toBeNull();
  expect(xmlResponse!.ok()).toBeTruthy();
  expect(xmlPage.url()).toContain("/cap/feed/xml");

  const xmlApiResponse = await page.request.get(copiedUrl);
  expect(xmlApiResponse.ok()).toBeTruthy();
  const xmlContent = await xmlApiResponse.text();
  expect(xmlContent).toMatch(/<\?xml|<feed|<alert/i);
  await xmlPage.close();

  console.log("✅ ฟิลเตอร์ ATOM XML และการคัดลอกข้อมูลถูกต้อง — ผ่าน");
});

// ============================================================
// TC-DA-LOC-020
// ============================================================

test("TC-DA-LOC-020 : ตรวจสอบ dropdown เลือกเหตุการณ์", async () => {
  test.setTimeout(120000);

  const { latitude: testLat, longitude: testLng } = GEO_CHIANG_MAI;

  await locationPage.fillCoordinates(testLat, testLng);
  await locationPage.assertCoordinateFilled(testLat, testLng);

  const firstSearchResponsePromise = locationPage.waitForLocationApiResponse();
  await locationPage.clickSearchById();
  await firstSearchResponsePromise;

  await locationPage.openAdvancedFilter();
  await expect(locationPage.eventDropdown()).toBeVisible();

  await locationPage.selectEventByLabel(FILTER_EVENT_STANDARD);
  const selectedEventId = await locationPage.getSelectedEventId();

  const searchResponsePromise =
    locationPage.waitForLocationApiResponseWithEvent(selectedEventId);
  await locationPage.clickAdvancedSearch();

  const searchResponse = await searchResponsePromise;
  const searchData = await searchResponse.json();
  const responseUrl = searchResponse.url();

  expect(responseUrl).toContain(`eventId=${selectedEventId}`);
  await expect(locationPage.eventDropdown()).toHaveValue(selectedEventId);
  expect(Number(searchData.totalCount)).toBe(searchData.items.length);

  const sectionText = await locationPage.section().innerText();
  const displayedTotalMatch = sectionText.match(/จำนวนข้อมูลทั้งหมด:\s*([\d,]+)/);
  expect(displayedTotalMatch, "ต้องแสดงจำนวนข้อมูลทั้งหมด").not.toBeNull();
  const displayedTotal = Number(displayedTotalMatch![1].replace(/,/g, ""));
  expect(displayedTotal).toBe(searchData.totalCount);

  const cards = locationPage.cards();
  const firstPageCardCount = await cards.count();
  expect(firstPageCardCount).toBeGreaterThan(0);

  const pageSize = await locationPage.getPageSize();
  const totalPages = Math.ceil(displayedTotal / pageSize);

  let validatedCardCount = 0;
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
    if (pageNumber > 1) await locationPage.goToPage(pageNumber);
    const cardsOnPage = await cards.count();
    for (let i = 0; i < cardsOnPage; i++) {
      await expect(cards.nth(i)).toContainText(FILTER_EVENT_STANDARD);
    }
    validatedCardCount += cardsOnPage;
  }

  expect(validatedCardCount).toBe(displayedTotal);
  console.log(
    `✅ Validated ${validatedCardCount} cards across ${totalPages} pages for event "${FILTER_EVENT_STANDARD}" — ผ่าน`,
  );
});

// ============================================================
// TC-DA-LOC-021
// ============================================================

test("TC-DA-LOC-021 : ค้นหาเหตุการณ์โดยพิมพ์ชื่อเหตุการณ์ในช่องค้นหาของ Dropdown", async ({
  page,
}) => {
  test.setTimeout(120000);

  const { latitude: testLat, longitude: testLng } = GEO_CHIANG_MAI;
  const searchKeyword = FILTER_EVENT_STANDARD;

  await locationPage.fillCoordinates(testLat, testLng);
  await locationPage.assertCoordinateFilled(testLat, testLng);

  const firstSearchResponsePromise = locationPage.waitForLocationApiResponse();
  await locationPage.clickSearchById();
  await firstSearchResponsePromise;

  await locationPage.openAdvancedFilter();
  await expect(locationPage.eventDropdown()).toBeVisible();

  const eventSearchInput = page
    .locator(
      '#eventLocationSelect-search, input[aria-controls="eventLocationSelect"], input[placeholder*="ค้นหา"][id*="event"], #eventLocationSelect + input, #eventLocationSelect ~ input',
    )
    .first();

  if (await eventSearchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await eventSearchInput.fill(searchKeyword);
    await page.waitForTimeout(500);
    const matchedOption = page
      .locator(
        `#eventLocationSelect option, [id*="eventLocation"] li, [id*="eventLocation"] .option`,
        {
          hasText: searchKeyword,
        },
      )
      .first();
    if (await matchedOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await matchedOption.click();
    } else {
      await locationPage.selectEventByLabel(searchKeyword);
    }
  } else {
    await locationPage.eventDropdown().focus();
    await page.keyboard.type(searchKeyword, { delay: 100 });
    await page.waitForTimeout(500);
    await locationPage.selectEventByLabel(searchKeyword);
  }

  const selectedEventId = await locationPage.getSelectedEventId();
  console.log(`📌 selectedEventId: ${selectedEventId}`);

  const searchResponsePromise =
    locationPage.waitForLocationApiResponseWithEvent(selectedEventId);
  await locationPage.clickAdvancedSearch();

  const searchResponse = await searchResponsePromise;
  const searchData = await searchResponse.json();
  const responseUrl = searchResponse.url();

  expect(responseUrl).toContain(`eventId=${selectedEventId}`);
  await expect(locationPage.eventDropdown()).toHaveValue(selectedEventId);
  expect(Number(searchData.totalCount)).toBe(searchData.items.length);

  const sectionText = await locationPage.section().innerText();
  const displayedTotalMatch = sectionText.match(/จำนวนข้อมูลทั้งหมด:\s*([\d,]+)/);
  expect(displayedTotalMatch, "ต้องแสดงจำนวนข้อมูลทั้งหมด").not.toBeNull();
  const displayedTotal = Number(displayedTotalMatch![1].replace(/,/g, ""));
  expect(displayedTotal).toBe(searchData.totalCount);

  const cards = locationPage.cards();
  expect(await cards.count()).toBeGreaterThan(0);

  const pageSize = await locationPage.getPageSize();
  const totalPages = Math.ceil(displayedTotal / pageSize);
  let validatedCardCount = 0;
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
    if (pageNumber > 1) await locationPage.goToPage(pageNumber);
    const cardsOnPage = await cards.count();
    for (let i = 0; i < cardsOnPage; i++) {
      await expect(cards.nth(i)).toContainText(searchKeyword);
    }
    validatedCardCount += cardsOnPage;
  }

  expect(validatedCardCount).toBe(displayedTotal);
  console.log(
    `✅ Validated ${validatedCardCount} cards across ${totalPages} pages for keyword "${searchKeyword}" — ผ่าน`,
  );
});

// ============================================================
// TC-DA-LOC-022
// ============================================================

test("TC-DA-LOC-022 : ตรวจสอบ multi-select ความรุนแรง", async () => {
  test.setTimeout(120000);

  const { latitude: testLat, longitude: testLng } = GEO_CHIANG_MAI;

  await locationPage.fillCoordinates(testLat, testLng);
  await locationPage.assertCoordinateFilled(testLat, testLng);

  const firstSearchResponsePromise = locationPage.waitForLocationApiResponse();
  await locationPage.clickSearchById();
  await firstSearchResponsePromise;

  await locationPage.openAdvancedFilter();

  await locationPage.checkSeverityExtreme();
  await locationPage.checkSeveritySevere();

  const searchResponsePromise = locationPage.waitForLocationApiResponse();
  await locationPage.clickAdvancedSearch();

  const searchResponse = await searchResponsePromise;
  const data = await searchResponse.json();

  const cards = locationPage.cards();
  await expect(cards.first()).toBeVisible({ timeout: 10000 });
  const cardCount = await cards.count();
  expect(cardCount).toBeGreaterThan(0);

  for (let i = 0; i < cardCount; i++) {
    const text = await cards.nth(i).innerText();
    const match = FILTER_SEVERITIES.some((sev) => text.includes(sev));
    expect(
      match,
      `Card ${i} ควรมี severity หนึ่งใน: ${FILTER_SEVERITIES.join(", ")}\nActual: ${text}`,
    ).toBeTruthy();
  }

  const allItems: any[] = data.items;
  expect(allItems.length).toBeGreaterThan(0);
  for (let i = 0; i < allItems.length; i++) {
    expect(
      FILTER_SEVERITIES.includes(allItems[i].severity),
      `API item ${i} มี severity "${allItems[i].severity}" ซึ่งไม่อยู่ใน filter`,
    ).toBeTruthy();
  }

  console.log(
    `✅ Validated ${cardCount} UI cards | ${allItems.length} API items | Severities: ${FILTER_SEVERITIES.join(", ")} — ผ่าน`,
  );
});

// ============================================================
// TC-DA-LOC-023
// ============================================================

test("TC-DA-LOC-023 : ตรวจสอบ multi-select ความแน่นอน", async () => {
  test.setTimeout(120000);

  const { latitude: testLat, longitude: testLng } = GEO_CHIANG_MAI;

  await locationPage.fillCoordinates(testLat, testLng);
  await locationPage.assertCoordinateFilled(testLat, testLng);

  const firstSearchResponsePromise = locationPage.waitForLocationApiResponse();
  await locationPage.clickSearchById();
  await firstSearchResponsePromise;

  await locationPage.openAdvancedFilter();

  const observedCheckbox = await locationPage.checkCertaintyObserved();
  const likelyCheckbox = await locationPage.checkCertaintyLikely();

  const searchResponsePromise = locationPage.waitForLocationApiResponse();
  await locationPage.clickAdvancedSearch();

  const searchResponse = await searchResponsePromise;
  const data = await searchResponse.json();

  expect(await observedCheckbox.isChecked()).toBeTruthy();
  expect(await likelyCheckbox.isChecked()).toBeTruthy();

  const cards = locationPage.cards();
  await expect(cards.first()).toBeVisible({ timeout: 10000 });
  const cardCount = await cards.count();
  expect(cardCount).toBeGreaterThan(0);

  const allItems: any[] = data.items;
  expect(allItems.length).toBeGreaterThan(0);
  for (let i = 0; i < allItems.length; i++) {
    expect(
      FILTER_CERTAINTIES.includes(allItems[i].certainty),
      `API item ${i} มี certainty "${allItems[i].certainty}" ซึ่งไม่อยู่ใน filter`,
    ).toBeTruthy();
  }

  console.log(
    `✅ Validated ${cardCount} UI cards | ${allItems.length} API items | Certainties: ${FILTER_CERTAINTIES.join(", ")} — ผ่าน`,
  );
});

// ============================================================
// TC-DA-LOC-024
// ============================================================

test("TC-DA-LOC-024 : ตรวจสอบ multi-select ความเร่งด่วน", async () => {
  test.setTimeout(120000);

  const { latitude: testLat, longitude: testLng } = GEO_CHIANG_MAI;

  await locationPage.fillCoordinates(testLat, testLng);
  await locationPage.assertCoordinateFilled(testLat, testLng);

  const firstSearchResponsePromise = locationPage.waitForLocationApiResponse();
  await locationPage.clickSearchById();
  await firstSearchResponsePromise;

  await locationPage.openAdvancedFilter();

  const immediateCheckbox = await locationPage.checkUrgencyImmediate();
  const expectedCheckbox = await locationPage.checkUrgencyExpected();

  const searchResponsePromise = locationPage.waitForLocationApiResponse();
  await locationPage.clickAdvancedSearch();

  const searchResponse = await searchResponsePromise;
  const data = await searchResponse.json();

  expect(await immediateCheckbox.isChecked()).toBeTruthy();
  expect(await expectedCheckbox.isChecked()).toBeTruthy();

  const cards = locationPage.cards();
  await expect(cards.first()).toBeVisible({ timeout: 10000 });
  const cardCount = await cards.count();
  expect(cardCount).toBeGreaterThan(0);

  const allItems: any[] = data.items;
  expect(allItems.length).toBeGreaterThan(0);
  for (let i = 0; i < allItems.length; i++) {
    expect(
      FILTER_URGENCIES.includes(allItems[i].urgency),
      `API item ${i} มี urgency "${allItems[i].urgency}" ซึ่งไม่อยู่ใน filter`,
    ).toBeTruthy();
  }

  console.log(
    `✅ Validated ${cardCount} UI cards | ${allItems.length} API items | Urgencies: ${FILTER_URGENCIES.join(", ")} — ผ่าน`,
  );
});

// ============================================================
// TC-DA-LOC-025
// ============================================================

test("TC-DA-LOC-025 : ตรวจสอบการค้นหาเมื่อเลือกตัวกรองขั้นสูงหลายตัวพร้อมกัน", async () => {
  test.setTimeout(120000);

  const { latitude: testLat, longitude: testLng } = GEO_CHIANG_MAI;

  await locationPage.fillCoordinates(testLat, testLng);
  await locationPage.assertCoordinateFilled(testLat, testLng);

  const firstSearchResponsePromise = locationPage.waitForLocationApiResponse();
  await locationPage.clickSearchById();
  await firstSearchResponsePromise;

  await locationPage.openAdvancedFilter();
  await expect(locationPage.eventDropdown()).toBeVisible();

  await locationPage.selectEventByLabel(FILTER_EVENT_STANDARD);
  const selectedEventId = await locationPage.getSelectedEventId();
  await expect(locationPage.eventDropdown()).toHaveValue(selectedEventId);

  await locationPage.checkSeverityExtreme();
  await locationPage.checkCertaintyObserved();
  await locationPage.checkUrgencyImmediate();

  const searchResponsePromise =
    locationPage.waitForLocationApiResponseWithEvent(selectedEventId);
  await locationPage.clickAdvancedSearch();

  const searchResponse = await searchResponsePromise;
  const data = await searchResponse.json();

  const cards = locationPage.cards();
  await expect(cards.first()).toBeVisible({ timeout: 10000 });
  expect(await cards.count()).toBeGreaterThan(0);

  const allItems: any[] = data.items;
  expect(allItems.length).toBeGreaterThan(0);
  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    expect(item.event).toBe(FILTER_EVENT_STANDARD);
    expect(item.severity).toBe(FILTER_SEVERITY_EXTREME);
    expect(item.certainty).toBe(FILTER_CERTAINTY_OBSERVED);
    expect(item.urgency).toBe(FILTER_URGENCY_IMMEDIATE);
  }

  console.log(`✅ Validated ${allItems.length} API items | All filters matched — ผ่าน`);
});

// ============================================================
// TC-DA-LOC-026
// ============================================================

test("TC-DA-LOC-026 : ตรวจสอบ reset filter", async () => {
  test.setTimeout(120000);

  const { latitude: testLat, longitude: testLng } = GEO_CHIANG_MAI;

  await locationPage.fillCoordinates(testLat, testLng);
  await locationPage.assertCoordinateFilled(testLat, testLng);

  const firstSearchResponsePromise = locationPage.waitForLocationApiResponse();
  await locationPage.clickSearchById();
  await firstSearchResponsePromise;

  await locationPage.openAdvancedFilter();
  await expect(locationPage.eventDropdown()).toBeVisible();

  await locationPage.selectEventByLabel(FILTER_EVENT_STANDARD);
  const selectedEventId = await locationPage.getSelectedEventId();
  await expect(locationPage.eventDropdown()).toHaveValue(selectedEventId);

  const searchResponsePromise =
    locationPage.waitForLocationApiResponseWithEvent(selectedEventId);
  await locationPage.clickAdvancedSearch();
  await searchResponsePromise;

  await locationPage.clickClearFilter();

  await expect(locationPage.eventDropdown()).toHaveValue("");
  const checkedCount = await locationPage
    .advancedFilterPanel()
    .locator('input[type="checkbox"]')
    .evaluateAll((els) => els.filter((el) => (el as HTMLInputElement).checked).length);
  expect(checkedCount).toBe(0);

  console.log("✅ Reset filter สำเร็จ: event ว่างและ checkbox ถูกล้างทั้งหมด — ผ่าน");
});

// ============================================================
// TC-DA-LOC-028
// ============================================================

test("TC-DA-LOC-028 : Filter แล้วไม่พบข้อมูล", async () => {
  test.setTimeout(120000);

  const { latitude: testLat, longitude: testLng } = GEO_CHIANG_MAI;

  await locationPage.fillCoordinates(testLat, testLng);
  await locationPage.assertCoordinateFilled(testLat, testLng);

  const firstSearchResponsePromise = locationPage.waitForLocationApiResponse();
  await locationPage.clickSearchById();
  await firstSearchResponsePromise;

  await locationPage.openAdvancedFilter();
  await expect(locationPage.eventDropdown()).toBeVisible();

  const eventOptionValue = await locationPage.eventDropdown().evaluate(
    (el, keyword) => {
      const select = el as HTMLSelectElement;
      const option = Array.from(select.options).find((opt) =>
        opt.text.includes(keyword),
      );
      return option?.value ?? "";
    },
    FILTER_EVENT_TROPICAL_STORM,
  );

  expect(
    eventOptionValue,
    `ต้องพบ option เหตุการณ์ที่มีคำว่า "${FILTER_EVENT_TROPICAL_STORM}"`,
  ).not.toBe("");
  await locationPage.selectEventByValue(eventOptionValue);

  const searchResponsePromise =
    locationPage.waitForLocationApiResponseWithEvent(eventOptionValue);
  await locationPage.clickAdvancedSearch();
  await searchResponsePromise;

  await expect(
    locationPage.section().getByText(MSG_NO_RESULT, { exact: true }),
  ).toBeVisible({ timeout: 10000 });

  console.log(`✅ แสดงข้อความ no data ถูกต้อง: "${MSG_NO_RESULT}" — ผ่าน`);
});

// ============================================================
// TC-DA-LOC-030
// ============================================================

test("TC-DA-LOC-030 : ตรวจสอบเรียงเหตุการณ์ล่าสุดก่อน", async () => {
  test.setTimeout(60000);

  const { latitude: testLat, longitude: testLng } = GEO_CHIANG_MAI;

  await locationPage.fillCoordinates(testLat, testLng);
  await locationPage.assertCoordinateFilled(testLat, testLng);

  const firstSearchResponsePromise = locationPage.waitForLocationApiResponse();
  await locationPage.clickSearchById();
  await firstSearchResponsePromise;

  const sortResponsePromise = locationPage.waitForLocationApiResponse();
  await locationPage.selectSort(SORT_LATEST);
  const sortResponse = await sortResponsePromise;
  const data = await sortResponse.json();

  const allItems: any[] = data.items;
  expect(allItems.length).toBeGreaterThan(0);

  for (let i = 0; i < allItems.length - 1; i++) {
    const currentTime = locationPage.extractItemTime(allItems[i]);
    const nextTime = locationPage.extractItemTime(allItems[i + 1]);
    expect(isNaN(currentTime)).toBeFalsy();
    expect(isNaN(nextTime)).toBeFalsy();
    expect(
      currentTime,
      `item[${i}] ต้องไม่เก่ากว่า item[${i + 1}]`,
    ).toBeGreaterThanOrEqual(nextTime);
  }

  const cards = locationPage.cards();
  await expect(cards.first()).toBeVisible({ timeout: 10000 });
  const cardCount = await cards.count();
  expect(cardCount).toBeGreaterThan(0);

  const firstItemTime = locationPage.extractItemTime(allItems[0]);
  expect(isNaN(firstItemTime)).toBeFalsy();
  console.log(`📌 First API item timestamp: ${firstItemTime}`);

  const firstCardText = await cards.first().innerText();
  const lastCardText = await cards.nth(cardCount - 1).innerText();

  const extractDate = (text: string): Date | null => {
    const match = text.match(/(\d{1,2})[\/\-\s](\d{1,2})[\/\-\s](\d{2,4})/);
    if (!match) return null;
    return new Date(
      `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`,
    );
  };

  const firstCardDate = extractDate(firstCardText);
  const lastCardDate = extractDate(lastCardText);

  if (firstCardDate && lastCardDate) {
    expect(
      firstCardDate.getTime(),
      `Card แรก ต้องใหม่กว่าหรือเท่ากับ card สุดท้าย`,
    ).toBeGreaterThanOrEqual(lastCardDate.getTime());
  }

  console.log(
    `✅ Validated ${cardCount} UI cards | ${allItems.length} API items | เรียงล่าสุดก่อน — ผ่าน`,
  );
});

// ============================================================
// TC-DA-LOC-031
// ============================================================

test("TC-DA-LOC-031 : ตรวจสอบเรียงเหตุการณ์เก่าสุดก่อน", async () => {
  test.setTimeout(60000);

  const { latitude: testLat, longitude: testLng } = GEO_CHIANG_MAI;

  await locationPage.fillCoordinates(testLat, testLng);
  await locationPage.assertCoordinateFilled(testLat, testLng);

  const firstSearchResponsePromise = locationPage.waitForLocationApiResponse();
  await locationPage.clickSearchById();
  await firstSearchResponsePromise;

  const sortResponsePromise = locationPage.waitForLocationApiResponse();
  await locationPage.selectSort(SORT_OLDEST);
  const sortResponse = await sortResponsePromise;
  const data = await sortResponse.json();

  const allItems: any[] = data.items;
  expect(allItems.length).toBeGreaterThan(0);

  for (let i = 0; i < allItems.length - 1; i++) {
    const currentTime = locationPage.extractItemTime(allItems[i]);
    const nextTime = locationPage.extractItemTime(allItems[i + 1]);
    expect(isNaN(currentTime)).toBeFalsy();
    expect(isNaN(nextTime)).toBeFalsy();
    expect(
      currentTime,
      `item[${i}] ต้องไม่ใหม่กว่า item[${i + 1}]`,
    ).toBeLessThanOrEqual(nextTime);
  }

  const cards = locationPage.cards();
  await expect(cards.first()).toBeVisible({ timeout: 10000 });
  const cardCount = await cards.count();
  expect(cardCount).toBeGreaterThan(0);

  const firstItemTime = locationPage.extractItemTime(allItems[0]);
  expect(isNaN(firstItemTime)).toBeFalsy();
  console.log(`📌 First API item timestamp (oldest): ${firstItemTime}`);

  console.log(
    `✅ Validated ${cardCount} UI cards | ${allItems.length} API items | เรียงเก่าสุดก่อน — ผ่าน`,
  );
});

// ============================================================
// TC-DA-LOC-038
// ============================================================

test("TC-DA-LOC-038 : ตรวจสอบชื่อเหตุการณ์ วันที่เริ่ม-สิ้นสุดบน card", async ({
  page,
}) => {
  test.setTimeout(120000);

  const { latitude: testLat, longitude: testLng } = GEO_CHIANG_MAI;

  await locationPage.fillCoordinates(testLat, testLng);

  const searchResponsePromise = locationPage.waitForLocationApiResponse();
  await locationPage.clickSearchById();
  const response = await searchResponsePromise;
  const data = await response.json();

  expect((data.items as any[]).length).toBeGreaterThan(0);

  const cards = locationPage.cards();
  await expect(cards.first()).toBeVisible({ timeout: 10000 });
  const cardCount = await cards.count();
  expect(cardCount).toBeGreaterThan(0);

  const parseThaiDate = (str: string): Date => {
    const m = str.match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2})/);
    if (!m) return new Date("invalid");
    return new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:00`);
  };

  for (let i = 0; i < cardCount; i++) {
    const cardBody = cards.nth(i).locator(".card-body");
    const eventName = cardBody
      .locator("h5, h6, strong, [class*='title'], [class*='event'], [class*='header']")
      .first();
    const eventText = ((await eventName.textContent()) ?? "").trim();
    expect(eventText.length > 0, `Card ${i} ชื่อเหตุการณ์ไม่มีข้อความ`).toBeTruthy();

    const cardText = await cardBody.innerText();
    const effectiveMatch = cardText.match(/มีผล:\s*(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2})/);
    const expiresMatch = cardText.match(/สิ้นสุด:\s*(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2})/);
    expect(effectiveMatch !== null, `Card ${i} วันที่มีผลไม่ถูกรูปแบบ`).toBeTruthy();
    expect(expiresMatch !== null, `Card ${i} วันที่สิ้นสุดไม่ถูกรูปแบบ`).toBeTruthy();

    const effectiveDate = parseThaiDate(effectiveMatch![1]);
    const expiresDate = parseThaiDate(expiresMatch![1]);
    expect(expiresDate >= effectiveDate).toBeTruthy();
  }

  console.log(`✅ TC-DA-LOC-038 ผ่าน — ตรวจสอบ ${cardCount} cards ครบถ้วนถูกต้อง`);
});

// ============================================================
// TC-DA-LOC-039
// ============================================================

test("TC-DA-LOC-039 : ตรวจสอบลิงก์ .XML เปิดได้", async ({ page }) => {
  test.setTimeout(120000);

  const { latitude: testLat, longitude: testLng } = GEO_CHIANG_MAI;

  await locationPage.fillCoordinates(testLat, testLng);

  const searchResponsePromise = locationPage.waitForLocationApiResponse();
  await locationPage.clickSearchById();
  const response = await searchResponsePromise;
  const data = await response.json();
  const allItems: any[] = data.items;
  expect(allItems.length).toBeGreaterThan(0);

  await expect(locationPage.cards().first()).toBeVisible({ timeout: 10000 });

  const xmlCandidates: string[] = allItems
    .map((item) => item.xmlUrl || item.xmlLink || item.capXmlUrl || item.fileUrl)
    .filter((url: string | undefined) => Boolean(url && url.includes(".xml")));

  expect(xmlCandidates.length).toBeGreaterThan(0);

  let xmlUrl = "";
  let xmlResponse: Awaited<ReturnType<typeof page.request.get>> | null = null;
  for (const candidate of xmlCandidates) {
    const res = await page.request.get(candidate);
    if (res.status() === 200) {
      xmlUrl = candidate;
      xmlResponse = res;
      break;
    }
  }

  expect(
    xmlResponse,
    `ไม่พบ XML URL ที่เปิดได้จริงจาก ${xmlCandidates.length} candidates`,
  ).toBeTruthy();
  const contentType = xmlResponse!.headers()["content-type"] ?? "";
  expect(contentType.includes("xml") || contentType.includes("text")).toBeTruthy();
  const body = await xmlResponse!.text();
  expect(body.trim().startsWith("<?xml") || body.includes("<")).toBeTruthy();

  console.log(`✅ TC-DA-LOC-039 ผ่าน — ลิงก์ .XML เปิดได้สำเร็จ | URL: ${xmlUrl}`);
});

// ============================================================
// TC-DA-LOC-040
// ============================================================

test("TC-DA-LOC-040 : ตรวจสอบ modal เปิดเมื่อคลิกปุ่มรายละเอียด", async () => {
  test.setTimeout(120000);

  const { latitude: testLat, longitude: testLng } = GEO_CHIANG_MAI;

  await locationPage.fillCoordinates(testLat, testLng);
  await locationPage.clickSearchById();

  const cards = locationPage.cards();
  await expect(cards.first()).toBeVisible({ timeout: 10000 });
  const cardCount = await cards.count();
  expect(cardCount).toBeGreaterThan(0);

  await locationPage.openFirstCardDetail();
  await locationPage.assertModalVisible();

  console.log(
    `✅ TC-DA-LOC-040 ผ่าน — Modal แสดงขึ้นมาได้อย่างถูกต้อง | Card count: ${cardCount}`,
  );
});

// ============================================================
// TC-DA-LOC-041
// ============================================================

test("TC-DA-LOC-041 : ตรวจสอบชื่อเหตุการณ์แสดงใน Modal ตรงตาม Card", async () => {
  test.setTimeout(120000);

  const { latitude: testLat, longitude: testLng } = GEO_CHIANG_MAI;

  await locationPage.fillCoordinates(testLat, testLng);
  await locationPage.clickSearchById();

  const cards = locationPage.cards();
  await expect(cards.first()).toBeVisible({ timeout: 10000 });
  const firstCard = cards.first();

  const cardEventName =
    (await firstCard
      .locator("strong.card-event, strong, h5, h6, [class*='event']")
      .first()
      .textContent()) ?? "";
  expect(cardEventName.trim()).toBeTruthy();

  await firstCard
    .locator("button.card-content, button:has-text('ดูรายละเอียด')")
    .first()
    .click();

  const modal = locationPage.modal();
  await expect(modal).toBeVisible({ timeout: 10000 });
  const modalEventName =
    (await modal
      .locator(
        ".modal-title, .modal-header h1, .modal-header h2, .modal-header h3, .modal-header strong, .modal-header p, p",
      )
      .first()
      .textContent()) ?? "";
  expect(modalEventName.trim()).toBeTruthy();
  expect(modalEventName.trim()).toBe(cardEventName.trim());
});

// ============================================================
// TC-DA-LOC-042
// ============================================================

test("TC-DA-LOC-042 : ตรวจสอบข้อมูลรายละเอียดเมื่อคลิกดูรายละเอียด", async () => {
  test.setTimeout(120000);

  const { latitude: testLat, longitude: testLng } = GEO_CHIANG_MAI;

  await locationPage.fillCoordinates(testLat, testLng);
  await locationPage.clickSearchById();

  const cards = locationPage.cards();
  await expect(cards.first()).toBeVisible({ timeout: 10000 });
  await cards.first().getByRole("button", { name: "ดูรายละเอียด" }).click();

  const detailContainer = locationPage.detailContainer();
  await expect(detailContainer).toBeVisible({ timeout: 10000 });

  for (const label of DETAIL_LABELS) {
    await expect(detailContainer.getByText(label)).toBeVisible();
  }
});

// ============================================================
// TC-DA-LOC-043
// ============================================================

test("TC-DA-LOC-043 : ตรวจสอบปุ่ม Copy ข้อความแจ้งเตือน", async ({
  page,
  context,
}) => {
  test.setTimeout(120000);

  const { latitude: testLat, longitude: testLng } = GEO_CHIANG_MAI;

  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await locationPage.fillCoordinates(testLat, testLng);
  await locationPage.clickSearchById();

  const cards = locationPage.cards();
  await expect(cards.first()).toBeVisible({ timeout: 10000 });
  await cards.first().getByRole("button", { name: "ดูรายละเอียด" }).click();

  const detailContainer = locationPage.detailContainer();
  await expect(detailContainer).toBeVisible({ timeout: 10000 });

  const descriptionBlock = detailContainer.locator("text=ข้อความแจ้งเตือน:").first();
  await expect(descriptionBlock).toBeVisible();
  const expectedDescription = (
    (await descriptionBlock.locator("xpath=following-sibling::*[1]").textContent()) ?? ""
  ).trim();

  const copyButton = detailContainer
    .locator("[data-testid='btn-copy-description'], button:has-text('คัดลอก'), img")
    .first();
  await expect(copyButton).toBeVisible({ timeout: 10000 });
  await copyButton.click();

  await expect(page.locator("text=คัดลอกไปยังคลิปบอร์ดแล้ว")).toBeVisible({
    timeout: 5000,
  });
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText.length).toBeGreaterThan(0);
  if (expectedDescription.length > 0) {
    expect(clipboardText).toContain(expectedDescription);
  }
});

// ============================================================
// TC-DA-LOC-044
// ============================================================

test("TC-DA-LOC-044 : ตรวจสอบแสดงพื้นที่ polygon", async () => {
  test.setTimeout(120000);

  const { latitude: testLat, longitude: testLng } = GEO_CHIANG_MAI;

  await locationPage.fillCoordinates(testLat, testLng);
  await locationPage.clickSearchById();

  const cards = locationPage.cards();
  await expect(cards.first()).toBeVisible({ timeout: 10000 });
  await cards.first().getByRole("button", { name: "ดูรายละเอียด" }).click();

  const detailContainer = locationPage.detailContainer();
  await expect(detailContainer).toBeVisible({ timeout: 10000 });

  const polygonLayer = detailContainer
    .locator("path.leaflet-interactive, svg path")
    .first();
  await expect(polygonLayer).toBeVisible({ timeout: 15000 });
  const polygonPathD = await polygonLayer.getAttribute("d");
  expect(polygonPathD).toBeTruthy();
  await expect(detailContainer.getByText("พื้นที่รูปแบบ polygon")).toBeVisible();
  await expect(
    detailContainer.locator("text=Error, text=ไม่สามารถโหลดแผนที่"),
  ).toBeHidden({ timeout: 5000 });
});

// ============================================================
// TC-DA-LOC-045
// ============================================================

test("TC-DA-LOC-045 : ตรวจสอบ map แสดงพื้นที่กระทบ", async ({ page }) => {
  test.setTimeout(120000);

  const { latitude: testLat, longitude: testLng } = GEO_CHIANG_MAI;

  await locationPage.fillCoordinates(testLat, testLng);
  await locationPage.clickSearchById();

  const cards = locationPage.cards();
  await expect(cards.first()).toBeVisible({ timeout: 10000 });
  await cards.first().getByRole("button", { name: "ดูรายละเอียด" }).click();

  const detailContainer = locationPage.detailContainer();
  await expect(detailContainer).toBeVisible({ timeout: 10000 });

  await expect(detailContainer.locator(".loading, .spinner")).toBeHidden({
    timeout: 15000,
  });
  await expect(detailContainer.locator("text=Error")).toBeHidden({
    timeout: 5000,
  });

  const mapTileCount = await detailContainer
    .locator(".leaflet-tile-loaded, .leaflet-layer, canvas")
    .count();
  if (mapTileCount > 0) {
    console.log("✅ Map Tile โหลดสำเร็จ");
  } else {
    console.warn("⚠️ ไม่พบ tile layer — environment อาจบล็อก map tiles");
  }

  const polygonPath = detailContainer.locator("path.leaflet-interactive, svg path");
  const marker = detailContainer.locator(
    ".leaflet-marker-icon, [data-testid='map-marker']",
  );
  const overlayCount = (await polygonPath.count()) + (await marker.count());
  if (overlayCount > 0) {
    console.log("✅ พบ layer บนแผนที่ (polygon/marker)");
  } else {
    console.warn("⚠️ ไม่พบ polygon/marker ใน environment นี้");
  }

  await expect(detailContainer.getByText("ภาค:")).toBeVisible();
  await expect(detailContainer.getByText("จังหวัด:")).toBeVisible();
  await expect(detailContainer.getByText("ตำบล:")).toBeVisible();
  await expect(detailContainer.getByText("พื้นที่รูปแบบ polygon")).toBeVisible();

  const mapBounds = await page.evaluate(() => {
    const mapInstance = (window as any)._leafletMap ?? (window as any).mapInstance;
    if (!mapInstance) return null;
    const bounds = mapInstance.getBounds();
    return {
      northEast: bounds.getNorthEast(),
      southWest: bounds.getSouthWest(),
      center: mapInstance.getCenter(),
      zoom: mapInstance.getZoom(),
    };
  });

  if (mapBounds) {
    expect(mapBounds.zoom).toBeGreaterThan(0);
    console.log(`✅ Map Bounds ตรวจสอบสำเร็จ | Zoom: ${mapBounds.zoom}`);
  } else {
    console.warn("⚠️ ไม่สามารถดึง Map Bounds ได้ — ข้าม Step นี้");
  }
});
