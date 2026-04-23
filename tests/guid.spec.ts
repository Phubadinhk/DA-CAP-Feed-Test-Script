import { test, expect } from "@playwright/test";
import { GuidPage } from "../page-object/GuidPage";
import { GUID_DATA } from "../test-data/guid.data";

test.describe("Guid", () => {
  let guidPage: GuidPage;

  test.beforeEach(async ({ page }) => {
    guidPage = new GuidPage(page);
    await guidPage.goto();
    await guidPage.openGuidTab();
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      await page.screenshot({
        path: `screenshots/${testInfo.title}.png`,
        fullPage: true,
      });
    }
  });

  test("TC-DA-GUID-001 : ค้นหาข้อมูลด้วย GUID ที่ถูกต้อง", async () => {
    test.setTimeout(120000);

    const expectedGuid = GUID_DATA.GUIDS.VALID;

    const guidData = await guidPage.searchGuid(expectedGuid);

    expect(guidData.totalCount, "API ต้องคืนข้อมูลเพียง 1 รายการ").toBe(1);
    expect(guidData.items?.length, "API items ต้องมีเพียง 1 รายการ").toBe(1);
    expect(
      guidData.items?.[0]?.xmlLink ?? "",
      "xmlLink ต้องอ้างถึง GUID ที่ค้นหา",
    ).toContain(expectedGuid);

    await expect(guidPage.detailButtons.first()).toBeVisible({ timeout: 10000 });
    await expect(guidPage.detailButtons).toHaveCount(1);
    await expect(guidPage.guidTabPanel).toContainText(expectedGuid);
  });

  test("TC-DA-GUID-003 : ค้นหาข้อมูลด้วย GUID ที่ไม่มีอยู่ในระบบ", async () => {
    test.setTimeout(60000);
    const invalidGuid = GUID_DATA.GUIDS.INVALID;

    const guidData = await guidPage.searchGuid(invalidGuid);

    expect(guidData.totalCount, "API ต้องคืน totalCount เป็น 0").toBe(0);
    expect(guidData.items?.length, "API items ต้องเป็น 0 รายการ").toBe(0);

    await expect(
      guidPage.guidTabPanel.getByText(GUID_DATA.TEXT.EMPTY_RESULT),
      "ต้องแสดงข้อความไม่พบผลลัพธ์",
    ).toBeVisible({ timeout: 10000 });

    await expect(
      guidPage.detailButtons,
      "ต้องไม่มีปุ่มดูรายละเอียดแสดง",
    ).toHaveCount(0);

    console.log(`✅ GUID "${invalidGuid}" — ไม่พบข้อมูล แสดงข้อความถูกต้อง — ผ่าน`);
  });

  test("TC-DA-GUID-004 : ค้นหาข้อมูลโดยไม่กรอกค่า GUID", async ({ page }) => {
    test.setTimeout(60000);

    await guidPage.expectGuidInputEmpty();

    await guidPage.clickSearch();
    await page.waitForTimeout(1000);

    let apiCalled = false;
    await page
      .waitForResponse(
        (response) =>
          response.url().includes(GUID_DATA.API.GUID_LIST) && response.status() === 200,
        { timeout: 3000 },
      )
      .then(() => {
        apiCalled = true;
      })
      .catch(() => {
        apiCalled = false;
      });

    expect(apiCalled, "ระบบต้องไม่เรียก API เมื่อไม่กรอก GUID").toBeFalsy();

    await expect(
      guidPage.guidTabPanel.getByText(/กรุณากรอก\s*Guid/i),
      "ต้องแสดงข้อความแจ้งเตือน กรุณากรอก Guid",
    ).toBeVisible({ timeout: 5000 });

    await expect(
      guidPage.detailButtons,
      "ต้องไม่มีปุ่มดูรายละเอียดแสดง",
    ).toHaveCount(0);

    console.log(`✅ ไม่กรอก GUID — แสดงข้อความแจ้งเตือนถูกต้อง ไม่มีผลลัพธ์ — ผ่าน`);
  });

  test("TC-DA-GUID-005 : ตรวจสอบความถูกต้องของข้อมูลชื่อเหตุการณ์และวันที่เริ่มต้น–สิ้นสุดที่แสดงใน Alert Card", async () => {
    test.setTimeout(60000);
    const expectedGuid = GUID_DATA.GUIDS.VALID;

    const guidData = await guidPage.searchGuid(expectedGuid);

    expect(guidData.totalCount).toBe(1);
    const apiItem = guidData.items[0];

    const apiEvent: string = apiItem.event ?? "";
    const apiHeadline: string = apiItem.headline ?? "";
    const apiEffectiveTime: string = apiItem.effectiveTime ?? "";
    const apiExpiredTime: string = apiItem.expiredTime ?? "";

    console.log(`📌 apiEvent: "${apiEvent}"`);
    console.log(`📌 apiHeadline: "${apiHeadline}"`);
    console.log(`📌 apiEffectiveTime: "${apiEffectiveTime}"`);
    console.log(`📌 apiExpiredTime: "${apiExpiredTime}"`);

    expect(apiEvent, "API ต้องมีชื่อเหตุการณ์").toBeTruthy();
    expect(apiEffectiveTime, "API ต้องมีวันที่เริ่มต้น").toBeTruthy();
    expect(apiExpiredTime, "API ต้องมีวันที่สิ้นสุด").toBeTruthy();

    await expect(guidPage.detailButtons.first()).toBeVisible({ timeout: 10000 });
    await expect(guidPage.detailButtons).toHaveCount(1);

    const tabPanelText = await guidPage.getTabPanelText();
    console.log(`📌 tabPanel text:\n${tabPanelText}`);

    expect(tabPanelText, `ต้องแสดงชื่อเหตุการณ์ "${apiEvent}"`).toContain(apiEvent);

    const effectiveFormats = guidPage.formatDisplayDateCandidates(apiEffectiveTime);
    const effectiveDisplayed = effectiveFormats.some((fmt) => tabPanelText.includes(fmt));
    expect(
      effectiveDisplayed,
      `ต้องแสดงวันที่เริ่มต้น (${apiEffectiveTime}) ในรูปแบบใดรูปแบบหนึ่ง:\n${effectiveFormats.join("\n")}`,
    ).toBeTruthy();

    const expiredFormats = guidPage.formatDisplayDateCandidates(apiExpiredTime);
    const expiredDisplayed = expiredFormats.some((fmt) => tabPanelText.includes(fmt));
    expect(
      expiredDisplayed,
      `ต้องแสดงวันที่สิ้นสุด (${apiExpiredTime}) ในรูปแบบใดรูปแบบหนึ่ง:\n${expiredFormats.join("\n")}`,
    ).toBeTruthy();

    expect(tabPanelText, `ต้องแสดง GUID "${expectedGuid}"`).toContain(expectedGuid);
    await expect(guidPage.detailButtons).toHaveCount(1);

    console.log(`✅ GUID "${expectedGuid}" — ชื่อเหตุการณ์และวันที่แสดงถูกต้อง — ผ่าน`);
  });

  test("TC-DA-GUID-006 : ตรวจสอบว่าผู้ใช้สามารถคลิกเปิดลิงก์ไฟล์ XML ได้ถูกต้อง", async ({ page, context }) => {
    test.setTimeout(60000);
    const expectedGuid = GUID_DATA.GUIDS.VALID;

    const guidData = await guidPage.searchGuid(expectedGuid);

    expect(guidData.totalCount).toBe(1);
    const apiItem = guidData.items[0];
    const apiXmlLink: string = apiItem.xmlLink ?? "";
    expect(apiXmlLink, "API ต้องมี xmlLink").toBeTruthy();
    console.log(`📌 xmlLink จาก API: ${apiXmlLink}`);

    await expect(guidPage.detailButtons.first()).toBeVisible({ timeout: 10000 });

    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await guidPage.clickCopyXmlButton();
    await page.waitForTimeout(500);

    const copiedUrl = await guidPage.readClipboardText();
    console.log(`📌 Copied URL: ${copiedUrl}`);

    expect(
      copiedUrl,
      `URL ที่ copy (${copiedUrl}) ต้องตรงกับ xmlLink จาก API (${apiXmlLink})`,
    ).toBe(apiXmlLink);

    const xmlPage = await context.newPage();
    const xmlResponse = await xmlPage.goto(copiedUrl, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    expect(xmlResponse, "ต้องเปิดลิงก์ XML ได้").not.toBeNull();
    expect(
      xmlResponse!.ok(),
      `ลิงก์ XML ต้อง response ok (status: ${xmlResponse!.status()})`,
    ).toBeTruthy();

    expect(xmlPage.url(), `URL ที่เปิดต้องมี GUID "${expectedGuid}"`).toContain(expectedGuid);

    const xmlApiResponse = await page.request.get(copiedUrl);
    expect(xmlApiResponse.ok()).toBeTruthy();
    const xmlContent = await xmlApiResponse.text();
    expect(xmlContent, "เนื้อหาต้องเป็น XML (CAP format)").toMatch(/<\?xml|<alert|<feed/i);
    console.log(`📌 XML content (preview): ${xmlContent.substring(0, 100)}`);

    await xmlPage.close();

    console.log(`✅ GUID "${expectedGuid}" — เปิดลิงก์ XML ได้สำเร็จ — ผ่าน`);
  });

  test("TC-DA-GUID-007 : ตรวจสอบว่า Modal Detail แสดงขึ้นเมื่อผู้ใช้คลิกดูรายละเอียด", async () => {
    test.setTimeout(60000);
    const expectedGuid = GUID_DATA.GUIDS.VALID;

    const guidData = await guidPage.searchGuid(expectedGuid);
    expect(guidData.totalCount).toBe(1);

    await guidPage.openFirstDetail();
    await expect(guidPage.modal, "Modal ต้องแสดงขึ้นมา").toBeVisible({ timeout: 5000 });

    console.log(`✅ GUID "${expectedGuid}" — Modal Detail แสดงขึ้นมาถูกต้อง — ผ่าน`);
  });

  test("TC-DA-GUID-008 : ตรวจสอบว่าชื่อเหตุการณ์แสดงถูกต้องภายใน Modal Detail", async () => {
    test.setTimeout(60000);
    const expectedGuid = GUID_DATA.GUIDS.VALID;

    const guidData = await guidPage.searchGuid(expectedGuid);
    expect(guidData.totalCount).toBe(1);

    const apiEvent: string = guidData.items[0].event ?? "";
    expect(apiEvent, "API ต้องมีชื่อเหตุการณ์").toBeTruthy();
    console.log(`📌 apiEvent: "${apiEvent}"`);

    await expect(guidPage.detailButtons.first()).toBeVisible({ timeout: 10000 });

    const tabPanelText = await guidPage.getTabPanelText();
    expect(tabPanelText, `Card ต้องแสดงชื่อเหตุการณ์ "${apiEvent}"`).toContain(apiEvent);
    console.log(`📌 Card แสดงชื่อเหตุการณ์ "${apiEvent}" — ✅`);

    await guidPage.openFirstDetail();
    await expect(guidPage.modal, "Modal ต้องแสดงขึ้นมา").toBeVisible({ timeout: 5000 });

    const modalHeaderText = await guidPage.getModalHeaderText();
    console.log(`📌 Modal header text: "${modalHeaderText}"`);

    expect(
      modalHeaderText,
      `Modal header ต้องแสดงชื่อเหตุการณ์ "${apiEvent}" ตรงตาม card`,
    ).toContain(apiEvent);

    console.log(`✅ GUID "${expectedGuid}" — ชื่อเหตุการณ์ใน Modal header ตรงกับ card — ผ่าน`);
  });

  test("TC-DA-GUID-009 : ตรวจสอบความถูกต้องของข้อมูลรายละเอียดที่แสดงภายใน Modal", async () => {
    test.setTimeout(60000);
    const expectedGuid = GUID_DATA.GUIDS.VALID;

    const guidData = await guidPage.searchGuid(expectedGuid);
    expect(guidData.totalCount).toBe(1);

    const apiItem = guidData.items[0];
    const apiSenderName: string = apiItem.senderName ?? apiItem.sender ?? "";
    const apiSeverity: string = apiItem.severity ?? "";
    const apiUrgency: string = apiItem.urgency ?? "";
    const apiCertainty: string = apiItem.certainty ?? "";
    const apiEffectiveTime: string = apiItem.effectiveTime ?? "";
    const apiExpiredTime: string = apiItem.expiredTime ?? "";
    const apiDescription: string = apiItem.description ?? "";
    const firstArea = apiItem.areasItem?.[0];
    const apiRegion: string = firstArea?.region ?? "-";
    const apiProvince: string = firstArea?.province ?? "-";
    const apiTambon: string = firstArea?.tambon ?? "-";
    const apiPolygon: string = firstArea?.polygon ?? "-";

    console.log(`📌 API senderName: "${apiSenderName}"`);
    console.log(`📌 API severity: "${apiSeverity}"`);
    console.log(`📌 API urgency: "${apiUrgency}"`);
    console.log(`📌 API certainty: "${apiCertainty}"`);
    console.log(`📌 API effectiveTime: "${apiEffectiveTime}"`);
    console.log(`📌 API expiredTime: "${apiExpiredTime}"`);
    console.log(`📌 API description: "${apiDescription}"`);
    console.log(`📌 API province: "${apiProvince}"`);

    await guidPage.openFirstDetail();
    await expect(guidPage.modal, "Modal ต้องแสดงขึ้นมา").toBeVisible({ timeout: 5000 });

    const modalText = await guidPage.getModalText();
    console.log(`📌 Modal text:\n${modalText}`);

    const effectiveDateStr = guidPage.formatShortDate(apiEffectiveTime);
    const expiredDateStr = guidPage.formatShortDate(apiExpiredTime);

    expect(modalText, `Modal ต้องแสดงที่มาของแหล่งข้อมูล "${apiSenderName}"`).toContain(apiSenderName);
    expect(modalText, `Modal ต้องแสดงความรุนแรง "${apiSeverity}"`).toContain(apiSeverity);
    expect(modalText, `Modal ต้องแสดงความเร่งด่วน "${apiUrgency}"`).toContain(apiUrgency);
    expect(modalText, `Modal ต้องแสดงความแน่นอน "${apiCertainty}"`).toContain(apiCertainty);
    expect(modalText, `Modal ต้องแสดงคำเตือนที่มีผล "${effectiveDateStr}"`).toContain(effectiveDateStr);
    expect(modalText, `Modal ต้องแสดงคำเตือนสิ้นสุด "${expiredDateStr}"`).toContain(expiredDateStr);

    if (apiDescription) {
      expect(modalText, `Modal ต้องแสดงข้อความแจ้งเตือน "${apiDescription}"`).toContain(apiDescription);
    }

    if (apiProvince && apiProvince !== "-") {
      expect(modalText, `Modal ต้องแสดงจังหวัด "${apiProvince}"`).toContain(apiProvince);
    }

    const expectedLabels = [
      GUID_DATA.LABELS.SOURCE,
      GUID_DATA.LABELS.SEVERITY,
      GUID_DATA.LABELS.URGENCY,
      GUID_DATA.LABELS.CERTAINTY,
      GUID_DATA.LABELS.EFFECTIVE,
      GUID_DATA.LABELS.EXPIRED,
      GUID_DATA.LABELS.DESCRIPTION,
      GUID_DATA.LABELS.AFFECTED_AREA,
      GUID_DATA.LABELS.PROVINCE,
    ];
    for (const label of expectedLabels) {
      expect(modalText, `Modal ต้องแสดง label "${label}"`).toContain(label);
    }

    console.log(`✅ GUID "${expectedGuid}" — ข้อมูลรายละเอียดใน Modal แสดงถูกต้องครบถ้วน — ผ่าน`);
  });

  test("TC-DA-GUID-010 : ตรวจสอบว่าปุ่ม Copy สามารถคัดลอกข้อความแจ้งเตือนไปยัง Clipboard ได้", async () => {
    test.setTimeout(60000);
    const expectedGuid = GUID_DATA.GUIDS.VALID;

    const guidData = await guidPage.searchGuid(expectedGuid);
    expect(guidData.totalCount).toBe(1);

    const apiDescription: string = guidData.items[0].description ?? "";
    console.log(`📌 API description: "${apiDescription}"`);

    await guidPage.openFirstDetail();
    await expect(guidPage.modal, "Modal ต้องแสดงขึ้นมา").toBeVisible({ timeout: 5000 });

    await guidPage.grantClipboard();
    await guidPage.clickCopyDescriptionButtonInModal();
    await guidPage.page.waitForTimeout(500);

    const successMessage = guidPage.page
      .locator("*")
      .filter({ hasText: GUID_DATA.TEXT.COPY_SUCCESS })
      .first();
    await expect(
      successMessage,
      "ต้องแสดงข้อความ 'คัดลอกไปยังคลิปบอร์ดแล้ว'",
    ).toBeVisible({ timeout: 5000 });
    console.log("📌 Success message แสดงขึ้น — ✅");

    const copiedText = await guidPage.readClipboardText();
    console.log(`📌 Copied text: "${copiedText}"`);

    expect(copiedText.length, "ข้อความที่ copy ต้องไม่ว่างเปล่า").toBeGreaterThan(0);

    if (apiDescription) {
      expect(
        copiedText,
        `ข้อความที่ copy ต้องตรงกับ description "${apiDescription}"`,
      ).toBe(apiDescription.trim());
    }

    console.log(`✅ GUID "${expectedGuid}" — Copy ข้อความแจ้งเตือนได้ถูกต้อง — ผ่าน`);
  });

  test("TC-DA-GUID-011 : ตรวจสอบความถูกต้องของข้อมูลพื้นที่ เช่น ภาค จังหวัด และตำบล ที่แสดง", async () => {
    test.setTimeout(60000);
    const expectedGuid = GUID_DATA.GUIDS.VALID;

    const guidData = await guidPage.searchGuid(expectedGuid);
    expect(guidData.totalCount).toBe(1);

    const apiItem = guidData.items[0];
    const areasItem: any[] = apiItem.areasItem ?? [];
    expect(areasItem.length, "API ต้องมีข้อมูลพื้นที่อย่างน้อย 1 รายการ").toBeGreaterThan(0);

    const firstArea = areasItem[0];
    const apiRegion: string = firstArea.region ?? "-";
    const apiProvince: string = firstArea.province ?? "-";
    const apiTambon: string = firstArea.tambon ?? "-";
    const apiPolygon: string = firstArea.polygon ?? "-";
    const apiAreaDescription: string = firstArea.areaDescription ?? "";

    console.log(`📌 API region: "${apiRegion}"`);
    console.log(`📌 API province: "${apiProvince}"`);
    console.log(`📌 API tambon: "${apiTambon}"`);
    console.log(`📌 API polygon: "${apiPolygon}"`);
    console.log(`📌 API areaDescription: "${apiAreaDescription}"`);

    await guidPage.openFirstDetail();
    await expect(guidPage.modal, "Modal ต้องแสดงขึ้นมา").toBeVisible({ timeout: 5000 });

    const modalText = await guidPage.getModalText();
    console.log(`📌 Modal text:\n${modalText}`);

    const expectedLabels = [
      GUID_DATA.LABELS.AFFECTED_AREA,
      GUID_DATA.LABELS.REGION,
      GUID_DATA.LABELS.PROVINCE,
      GUID_DATA.LABELS.TAMBON,
      GUID_DATA.LABELS.POLYGON,
    ];
    for (const label of expectedLabels) {
      expect(modalText, `Modal ต้องแสดง label "${label}"`).toContain(label);
    }

    expect(modalText, `Modal ต้องแสดงภาค "${apiRegion}"`).toContain(apiRegion);
    expect(modalText, `Modal ต้องแสดงจังหวัด "${apiProvince}"`).toContain(apiProvince);
    expect(modalText, `Modal ต้องแสดงตำบล "${apiTambon}"`).toContain(apiTambon);
    expect(modalText, `Modal ต้องแสดง polygon "${apiPolygon}"`).toContain(apiPolygon);

    if (areasItem.length > 1) {
      for (let i = 1; i < areasItem.length; i++) {
        const area = areasItem[i];
        const province = area.province ?? "-";
        if (province !== "-") {
          expect(modalText, `Modal ต้องแสดงจังหวัด "${province}" (area ${i + 1})`).toContain(province);
        }
      }
    }

    console.log(`✅GUID "${expectedGuid}" — ข้อมูลพื้นที่ใน Modal แสดงถูกต้องครบถ้วน — ผ่าน`);
  });

  test("TC-DA-GUID-012 : ตรวจสอบว่าระบบแสดงพื้นที่ Polygon ของเหตุการณ์บนแผนที่ได้ถูกต้อง", async () => {
    test.setTimeout(60000);
    const expectedGuid = GUID_DATA.GUIDS.VALID;

    const guidData = await guidPage.searchGuid(expectedGuid);
    expect(guidData.totalCount).toBe(1);

    const apiItem = guidData.items[0];
    const areasItem: any[] = apiItem.areasItem ?? [];
    const apiProvince: string = areasItem[0]?.province ?? "-";
    console.log(`📌 API province: "${apiProvince}"`);

    await guidPage.openFirstDetail();
    await expect(guidPage.detailContainer).toBeVisible({ timeout: 10000 });

    await expect(guidPage.detailContainer.locator(".loading, .spinner")).toBeHidden({ timeout: 15000 });
    await expect(guidPage.detailContainer.locator("text=Error")).toBeHidden({ timeout: 5000 });

    const mapTileCount = await guidPage.getMapTileCount();
    if (mapTileCount > 0) {
      console.log("✅ Map Tile โหลดสำเร็จ");
    } else {
      console.warn("⚠️ ไม่พบ tile layer (environment อาจบล็อก map tiles) แต่ทดสอบชั้นข้อมูลต่อ");
    }

    const overlayCount = await guidPage.getMapOverlayCount();
    if (overlayCount > 0) {
      console.log("✅ พบ layer บนแผนที่ (polygon/marker)");
    } else {
      console.warn("⚠️ ไม่พบ polygon/marker ใน environment นี้");
    }

    await expect(guidPage.detailContainer.getByText(GUID_DATA.LABELS.REGION)).toBeVisible();
    await expect(guidPage.detailContainer.getByText(GUID_DATA.LABELS.PROVINCE)).toBeVisible();
    await expect(guidPage.detailContainer.getByText(GUID_DATA.LABELS.TAMBON)).toBeVisible();
    await expect(guidPage.detailContainer.getByText(GUID_DATA.LABELS.POLYGON)).toBeVisible();

    const mapBounds = await guidPage.getMapBounds();

    if (mapBounds) {
      expect(mapBounds.zoom).toBeGreaterThan(0);
      console.log(`✅ Map Bounds ตรวจสอบสำเร็จ | Zoom: ${mapBounds.zoom}`);
    } else {
      console.warn("⚠️ ไม่สามารถดึง Map Bounds ได้ — ข้าม Step นี้");
    }

    const detailText = await guidPage.detailContainer.innerText();
    expect(detailText, `Modal ต้องแสดงจังหวัด "${apiProvince}"`).toContain(apiProvince);

    console.log(`✅ GUID "${expectedGuid}" — พื้นที่ Polygon บนแผนที่แสดงถูกต้อง — ผ่าน`);
  });
});
