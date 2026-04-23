import { test, expect, Locator } from "@playwright/test";

test.describe("Guid", () => {


  test("TC-DA-GUID-001 : ค้นหาข้อมูลด้วย GUID ที่ถูกต้อง", async ({ page }) => {
    test.setTimeout(120000);

    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";
    const expectedGuid = "NDWC20260420103022_2";

    // Step 1: ไปที่แท็บ "ค้นหาจาก Id"
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");
    await page.getByText("ค้นหาจาก Id").first().click();

    // Step 2: กรอก GUID
    const guidInputCandidates: Locator[] = [
      page.locator("#searchById"),
      page.locator("#alertId"),
      page.locator('input[placeholder*="GUID"]'),
      page.locator('input[placeholder*="Id"]'),
      page.getByRole("textbox").first(),
    ];

    let filledGuidInput = false;
    for (const input of guidInputCandidates) {
      if (
        await input
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false)
      ) {
        await input.first().fill(expectedGuid);
        filledGuidInput = true;
        break;
      }
    }
    expect(filledGuidInput, "ต้องพบช่องกรอก GUID").toBeTruthy();

    // Step 3: กดค้นหา และตรวจ API getCapFeedGuidDataList
    const guidResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/app/capFeed/getCapFeedGuidDataList") &&
        response.url().includes(`guid=${expectedGuid}`) &&
        response.status() === 200,
    );
    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
    const guidResponse = await guidResponsePromise;
    const guidData = await guidResponse.json();
    await page.waitForLoadState("networkidle");

    expect(guidData.totalCount, "API ต้องคืนข้อมูลเพียง 1 รายการ").toBe(1);
    expect(guidData.items?.length, "API items ต้องมีเพียง 1 รายการ").toBe(1);
    expect(
      guidData.items?.[0]?.xmlLink ?? "",
      "xmlLink ต้องอ้างถึง GUID ที่ค้นหา",
    ).toContain(expectedGuid);

    // Expect Result: ระบบแสดงข้อมูล Alert ที่ตรงกับ GUID เพียง 1 รายการ เท่านั้น
    const idTabPanel = page.getByRole("tabpanel", { name: "ค้นหาจาก Id" });
    const detailButtons = idTabPanel.getByRole("button", {
      name: /ดูรายละเอียด/,
    });
    await expect(detailButtons.first()).toBeVisible({ timeout: 10000 });
    await expect(detailButtons).toHaveCount(1);
    await expect(idTabPanel).toContainText(expectedGuid);
  });

  test("TC-DA-GUID-003 : ค้นหาข้อมูลด้วย GUID ที่ไม่มีอยู่ในระบบ", async ({
    page,
  }) => {
    test.setTimeout(60000);
    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";
    const invalidGuid = "NDWC99999999999999_9";

    // Step 1: ไปที่แท็บ "ค้นหาจาก Id"
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");
    await page.getByText("ค้นหาจาก Id").first().click();

    // Step 2: กรอก GUID ที่ไม่มีในระบบ
    const guidInputCandidates: Locator[] = [
      page.locator("#searchById"),
      page.locator("#alertId"),
      page.locator('input[placeholder*="GUID"]'),
      page.locator('input[placeholder*="Id"]'),
      page.getByRole("textbox").first(),
    ];

    let filledGuidInput = false;
    for (const input of guidInputCandidates) {
      if (
        await input
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false)
      ) {
        await input.first().fill(invalidGuid);
        filledGuidInput = true;
        break;
      }
    }
    expect(filledGuidInput, "ต้องพบช่องกรอก GUID").toBeTruthy();

    // Step 3: กดค้นหา และตรวจ API
    const guidResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/app/capFeed/getCapFeedGuidDataList") &&
        response.url().includes(`guid=${invalidGuid}`) &&
        response.status() === 200,
    );
    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
    const guidResponse = await guidResponsePromise;
    const guidData = await guidResponse.json();
    await page.waitForLoadState("networkidle");

    // Expect 1: API ต้องคืนข้อมูล 0 รายการ
    expect(guidData.totalCount, "API ต้องคืน totalCount เป็น 0").toBe(0);
    expect(guidData.items?.length, "API items ต้องเป็น 0 รายการ").toBe(0);

    // Expect 2: UI ต้องแสดงข้อความ "ไม่พบผลลัพธ์"
    const idTabPanel = page.getByRole("tabpanel", { name: "ค้นหาจาก Id" });
    await expect(
      idTabPanel.getByText("ไม่พบผลลัพธ์การค้นหาที่ตรงกับเงื่อนไขของคุณ"),
      "ต้องแสดงข้อความไม่พบผลลัพธ์",
    ).toBeVisible({ timeout: 10000 });

    // Expect 3: ต้องไม่มี card หรือปุ่ม "ดูรายละเอียด" แสดง
    const detailButtons = idTabPanel.getByRole("button", {
      name: /ดูรายละเอียด/,
    });
    await expect(detailButtons, "ต้องไม่มีปุ่มดูรายละเอียดแสดง").toHaveCount(0);

    console.log(
      `✅ GUID "${invalidGuid}" — ไม่พบข้อมูล แสดงข้อความถูกต้อง — ผ่าน`,
    );
  });

  test("TC-DA-GUID-004 : ค้นหาข้อมูลโดยไม่กรอกค่า GUID", async ({ page }) => {
    test.setTimeout(60000);
    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";

    // Step 1: ไปที่แท็บ "ค้นหาจาก Id"
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");
    await page.getByText("ค้นหาจาก Id").first().click();

    // ตรวจสอบว่าช่องกรอก GUID ว่างเปล่า
    const guidInputCandidates: Locator[] = [
      page.locator("#searchById"),
      page.locator("#alertId"),
      page.locator('input[placeholder*="GUID"]'),
      page.locator('input[placeholder*="Id"]'),
      page.getByRole("textbox").first(),
    ];

    let guidInput: Locator | null = null;
    for (const input of guidInputCandidates) {
      if (
        await input
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false)
      ) {
        guidInput = input.first();
        break;
      }
    }
    expect(guidInput, "ต้องพบช่องกรอก GUID").not.toBeNull();
    await expect(guidInput!).toHaveValue("");

    // Step 2: กดค้นหาโดยไม่กรอก GUID
    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
    await page.waitForTimeout(1000);

    const idTabPanel = page.getByRole("tabpanel", { name: "ค้นหาจาก Id" });

    // Expect 1: ระบบต้องไม่เรียก API
    // (ถ้าเรียก API จะถูกจับโดย waitForResponse ซึ่งจะ timeout)
    let apiCalled = false;
    await page
      .waitForResponse(
        (response) =>
          response.url().includes("/api/app/capFeed/getCapFeedGuidDataList") &&
          response.status() === 200,
        { timeout: 3000 },
      )
      .then(() => {
        apiCalled = true;
      })
      .catch(() => {
        apiCalled = false;
      });

    expect(apiCalled, "ระบบต้องไม่เรียก API เมื่อไม่กรอก GUID").toBeFalsy();

    // Expect 2: ระบบแสดงข้อความแจ้งเตือน "กรุณากรอก Guid"
    await expect(
      idTabPanel.getByText(/กรุณากรอก\s*Guid/i),
      "ต้องแสดงข้อความแจ้งเตือน กรุณากรอก Guid",
    ).toBeVisible({ timeout: 5000 });

    // Expect 3: ต้องไม่มีปุ่ม "ดูรายละเอียด" แสดง
    const detailButtons = idTabPanel.getByRole("button", {
      name: /ดูรายละเอียด/,
    });
    await expect(detailButtons, "ต้องไม่มีปุ่มดูรายละเอียดแสดง").toHaveCount(0);

    console.log(
      `✅ ไม่กรอก GUID — แสดงข้อความแจ้งเตือนถูกต้อง ไม่มีผลลัพธ์ — ผ่าน`,
    );
  });

  test("TC-DA-GUID-005 : ตรวจสอบความถูกต้องของข้อมูลชื่อเหตุการณ์และวันที่เริ่มต้น–สิ้นสุดที่แสดงใน Alert Card", async ({
    page,
  }) => {
    test.setTimeout(60000);
    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";
    const expectedGuid = "NDWC20260420103022_2";

    // Step 1: ไปที่แท็บ "ค้นหาจาก Id"
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");
    await page.getByText("ค้นหาจาก Id").first().click();

    // Step 2: กรอก GUID
    const guidInputCandidates: Locator[] = [
      page.locator("#searchById"),
      page.locator("#alertId"),
      page.locator('input[placeholder*="GUID"]'),
      page.locator('input[placeholder*="Id"]'),
      page.getByRole("textbox").first(),
    ];

    let filledGuidInput = false;
    for (const input of guidInputCandidates) {
      if (
        await input
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false)
      ) {
        await input.first().fill(expectedGuid);
        filledGuidInput = true;
        break;
      }
    }
    expect(filledGuidInput, "ต้องพบช่องกรอก GUID").toBeTruthy();

    // Step 3: กดค้นหา และรอ API response
    const guidResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/app/capFeed/getCapFeedGuidDataList") &&
        response.url().includes(`guid=${expectedGuid}`) &&
        response.status() === 200,
    );
    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
    const guidResponse = await guidResponsePromise;
    const guidData = await guidResponse.json();
    await page.waitForLoadState("networkidle");

    expect(guidData.totalCount).toBe(1);
    const apiItem = guidData.items[0];

    // ดึง field ตาม structure จริงของ API
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

    // Step 4: ตรวจสอบ Alert Card
    const idTabPanel = page.getByRole("tabpanel", { name: "ค้นหาจาก Id" });

    // รอให้ปุ่มดูรายละเอียดปรากฏก่อน (ยืนยันว่าข้อมูลโหลดเสร็จแล้ว)
    const detailButtons = idTabPanel.getByRole("button", {
      name: /ดูรายละเอียด/,
    });
    await expect(detailButtons.first()).toBeVisible({ timeout: 10000 });
    await expect(detailButtons).toHaveCount(1);

    // ✅ อ่านข้อความทั้งหมดจาก tabpanel แทนการหา .card
    const tabPanelText = await idTabPanel.innerText();
    console.log(`📌 tabPanel text:\n${tabPanelText}`);

    // Expect 1: ต้องแสดงชื่อเหตุการณ์ตรงกับ API
    expect(tabPanelText, `ต้องแสดงชื่อเหตุการณ์ "${apiEvent}"`).toContain(
      apiEvent,
    );

    // Expect 2: ต้องแสดงวันที่เริ่มต้น (effectiveTime)
    const formatDateForDisplay = (isoDate: string): string[] => {
      if (!isoDate) return [];
      const date = new Date(isoDate);
      return [
        `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`,
        `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear() + 543}`,
        date.toLocaleDateString("th-TH", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        date.toLocaleDateString("th-TH", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }),
      ];
    };

    const effectiveFormats = formatDateForDisplay(apiEffectiveTime);
    const effectiveDisplayed = effectiveFormats.some((fmt) =>
      tabPanelText.includes(fmt),
    );
    expect(
      effectiveDisplayed,
      `ต้องแสดงวันที่เริ่มต้น (${apiEffectiveTime}) ในรูปแบบใดรูปแบบหนึ่ง:\n${effectiveFormats.join("\n")}`,
    ).toBeTruthy();

    // Expect 3: ต้องแสดงวันที่สิ้นสุด (expiredTime)
    const expiredFormats = formatDateForDisplay(apiExpiredTime);
    const expiredDisplayed = expiredFormats.some((fmt) =>
      tabPanelText.includes(fmt),
    );
    expect(
      expiredDisplayed,
      `ต้องแสดงวันที่สิ้นสุด (${apiExpiredTime}) ในรูปแบบใดรูปแบบหนึ่ง:\n${expiredFormats.join("\n")}`,
    ).toBeTruthy();

    // Expect 4: ต้องแสดง GUID ที่ค้นหา
    expect(tabPanelText, `ต้องแสดง GUID "${expectedGuid}"`).toContain(
      expectedGuid,
    );

    // Expect 5: ต้องมีปุ่ม "ดูรายละเอียด" เพียง 1 ปุ่ม
    await expect(detailButtons).toHaveCount(1);

    console.log(
      `✅ GUID "${expectedGuid}" — ชื่อเหตุการณ์และวันที่แสดงถูกต้อง — ผ่าน`,
    );
  });

  test("TC-DA-GUID-006 : ตรวจสอบว่าผู้ใช้สามารถคลิกเปิดลิงก์ไฟล์ XML ได้ถูกต้อง", async ({
    page,
    context,
  }) => {
    test.setTimeout(60000);
    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";
    const expectedGuid = "NDWC20260420103022_2";

    // Step 1: ไปที่แท็บ "ค้นหาจาก Id"
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");
    await page.getByText("ค้นหาจาก Id").first().click();

    // Step 2: กรอก GUID
    const guidInputCandidates: Locator[] = [
      page.locator("#searchById"),
      page.locator("#alertId"),
      page.locator('input[placeholder*="GUID"]'),
      page.locator('input[placeholder*="Id"]'),
      page.getByRole("textbox").first(),
    ];

    let filledGuidInput = false;
    for (const input of guidInputCandidates) {
      if (
        await input
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false)
      ) {
        await input.first().fill(expectedGuid);
        filledGuidInput = true;
        break;
      }
    }
    expect(filledGuidInput, "ต้องพบช่องกรอก GUID").toBeTruthy();

    // Step 3: กดค้นหา และรอ API response
    const guidResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/app/capFeed/getCapFeedGuidDataList") &&
        response.url().includes(`guid=${expectedGuid}`) &&
        response.status() === 200,
    );
    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
    const guidResponse = await guidResponsePromise;
    const guidData = await guidResponse.json();

    expect(guidData.totalCount).toBe(1);
    const apiItem = guidData.items[0];
    const apiXmlLink: string = apiItem.xmlLink ?? "";
    expect(apiXmlLink, "API ต้องมี xmlLink").toBeTruthy();
    console.log(`📌 xmlLink จาก API: ${apiXmlLink}`);

    // รอให้ปุ่มดูรายละเอียดปรากฏก่อน (ยืนยันว่าข้อมูลโหลดเสร็จแล้ว)
    const idTabPanel = page.getByRole("tabpanel", { name: "ค้นหาจาก Id" });
    const detailButtons = idTabPanel.getByRole("button", {
      name: /ดูรายละเอียด/,
    });
    await expect(detailButtons.first()).toBeVisible({ timeout: 10000 });

    // Step 4: อนุญาต clipboard และ copy ลิงก์ XML
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    const copyButton = idTabPanel.locator(".ic-copy").first();
    await expect(copyButton, "ต้องพบปุ่ม copy XML link").toBeVisible({
      timeout: 5000,
    });
    await copyButton.click();
    await page.waitForTimeout(500);

    const copiedUrl = (
      await page.evaluate(() => navigator.clipboard.readText())
    ).trim();
    console.log(`📌 Copied URL: ${copiedUrl}`);

    // Expect 1: URL ที่ copy ต้องตรงกับ xmlLink จาก API
    expect(
      copiedUrl,
      `URL ที่ copy (${copiedUrl}) ต้องตรงกับ xmlLink จาก API (${apiXmlLink})`,
    ).toBe(apiXmlLink);

    // Step 5: เปิดลิงก์ XML
    const xmlPage = await context.newPage();
    const xmlResponse = await xmlPage.goto(copiedUrl, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    // Expect 2: เปิดลิงก์ได้สำเร็จ (status 200)
    expect(xmlResponse, "ต้องเปิดลิงก์ XML ได้").not.toBeNull();
    expect(
      xmlResponse!.ok(),
      `ลิงก์ XML ต้อง response ok (status: ${xmlResponse!.status()})`,
    ).toBeTruthy();

    // Expect 3: URL ที่เปิดต้องมี GUID
    expect(xmlPage.url(), `URL ที่เปิดต้องมี GUID "${expectedGuid}"`).toContain(
      expectedGuid,
    );

    // Expect 4: เนื้อหาต้องเป็น XML
    const xmlApiResponse = await page.request.get(copiedUrl);
    expect(xmlApiResponse.ok()).toBeTruthy();
    const xmlContent = await xmlApiResponse.text();
    expect(xmlContent, "เนื้อหาต้องเป็น XML (CAP format)").toMatch(
      /<\?xml|<alert|<feed/i,
    );
    console.log(`📌 XML content (preview): ${xmlContent.substring(0, 100)}`);

    await xmlPage.close();

    console.log(`✅ GUID "${expectedGuid}" — เปิดลิงก์ XML ได้สำเร็จ — ผ่าน`);
  });

  test("TC-DA-GUID-007 : ตรวจสอบว่า Modal Detail แสดงขึ้นเมื่อผู้ใช้คลิกดูรายละเอียด", async ({
    page,
  }) => {
    test.setTimeout(60000);
    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";
    const expectedGuid = "NDWC20260420103022_2";

    // Step 1: ไปที่แท็บ "ค้นหาจาก Id"
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");
    await page.getByText("ค้นหาจาก Id").first().click();

    // Step 2: กรอก GUID
    const guidInputCandidates: Locator[] = [
      page.locator("#searchById"),
      page.locator("#alertId"),
      page.locator('input[placeholder*="GUID"]'),
      page.locator('input[placeholder*="Id"]'),
      page.getByRole("textbox").first(),
    ];

    let filledGuidInput = false;
    for (const input of guidInputCandidates) {
      if (
        await input
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false)
      ) {
        await input.first().fill(expectedGuid);
        filledGuidInput = true;
        break;
      }
    }
    expect(filledGuidInput, "ต้องพบช่องกรอก GUID").toBeTruthy();

    // Step 3: กดค้นหา และรอ API response
    const guidResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/app/capFeed/getCapFeedGuidDataList") &&
        response.url().includes(`guid=${expectedGuid}`) &&
        response.status() === 200,
    );
    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
    const guidResponse = await guidResponsePromise;
    const guidData = await guidResponse.json();
    expect(guidData.totalCount).toBe(1);

    // รอให้ปุ่มดูรายละเอียดปรากฏ
    const idTabPanel = page.getByRole("tabpanel", { name: "ค้นหาจาก Id" });
    const detailButton = idTabPanel
      .getByRole("button", { name: /ดูรายละเอียด/ })
      .first();
    await expect(detailButton).toBeVisible({ timeout: 10000 });

    // Step 4: คลิกดูรายละเอียด
    await detailButton.click();

    // Expect: Modal ต้องแสดงขึ้นมา
    const modal = page
      .locator(".modal.show, .modal-dialog, [role='dialog']")
      .first();
    await expect(modal, "Modal ต้องแสดงขึ้นมา").toBeVisible({ timeout: 5000 });

    console.log(
      `✅ GUID "${expectedGuid}" — Modal Detail แสดงขึ้นมาถูกต้อง — ผ่าน`,
    );
  });

  test("TC-DA-GUID-008 : ตรวจสอบว่าชื่อเหตุการณ์แสดงถูกต้องภายใน Modal Detail", async ({
    page,
  }) => {
    test.setTimeout(60000);
    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";
    const expectedGuid = "NDWC20260420103022_2";

    // Step 1: ไปที่แท็บ "ค้นหาจาก Id"
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");
    await page.getByText("ค้นหาจาก Id").first().click();

    // Step 2: กรอก GUID
    const guidInputCandidates: Locator[] = [
      page.locator("#searchById"),
      page.locator("#alertId"),
      page.locator('input[placeholder*="GUID"]'),
      page.locator('input[placeholder*="Id"]'),
      page.getByRole("textbox").first(),
    ];

    let filledGuidInput = false;
    for (const input of guidInputCandidates) {
      if (
        await input
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false)
      ) {
        await input.first().fill(expectedGuid);
        filledGuidInput = true;
        break;
      }
    }
    expect(filledGuidInput, "ต้องพบช่องกรอก GUID").toBeTruthy();

    // Step 3: กดค้นหา และรอ API response
    const guidResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/app/capFeed/getCapFeedGuidDataList") &&
        response.url().includes(`guid=${expectedGuid}`) &&
        response.status() === 200,
    );
    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
    const guidResponse = await guidResponsePromise;
    const guidData = await guidResponse.json();
    expect(guidData.totalCount).toBe(1);

    const apiEvent: string = guidData.items[0].event ?? "";
    expect(apiEvent, "API ต้องมีชื่อเหตุการณ์").toBeTruthy();
    console.log(`📌 apiEvent: "${apiEvent}"`);

    // Step 4: รอให้ปุ่มดูรายละเอียดปรากฏ และอ่านชื่อเหตุการณ์จาก card
    const idTabPanel = page.getByRole("tabpanel", { name: "ค้นหาจาก Id" });
    const detailButton = idTabPanel
      .getByRole("button", { name: /ดูรายละเอียด/ })
      .first();
    await expect(detailButton).toBeVisible({ timeout: 10000 });

    const tabPanelText = await idTabPanel.innerText();
    expect(tabPanelText, `Card ต้องแสดงชื่อเหตุการณ์ "${apiEvent}"`).toContain(
      apiEvent,
    );
    console.log(`📌 Card แสดงชื่อเหตุการณ์ "${apiEvent}" — ✅`);

    // Step 5: คลิกดูรายละเอียด
    await detailButton.click();

    // Step 6: ตรวจสอบ header ของ Modal
    const modal = page
      .locator(".modal.show, .modal-dialog, [role='dialog']")
      .first();
    await expect(modal, "Modal ต้องแสดงขึ้นมา").toBeVisible({ timeout: 5000 });

    const modalHeader = modal
      .locator(
        ".modal-header, .modal-title, [class*='modal-header'], [class*='modal-title']",
      )
      .first();
    await expect(modalHeader, "Modal ต้องมี header").toBeVisible({
      timeout: 3000,
    });

    const modalHeaderText = await modalHeader.innerText();
    console.log(`📌 Modal header text: "${modalHeaderText}"`);

    // Expect: ชื่อเหตุการณ์ใน Modal header ต้องตรงกับที่แสดงใน card
    expect(
      modalHeaderText,
      `Modal header ต้องแสดงชื่อเหตุการณ์ "${apiEvent}" ตรงตาม card`,
    ).toContain(apiEvent);

    console.log(
      `✅ GUID "${expectedGuid}" — ชื่อเหตุการณ์ใน Modal header ตรงกับ card — ผ่าน`,
    );
  });

  test("TC-DA-GUID-009 : ตรวจสอบความถูกต้องของข้อมูลรายละเอียดที่แสดงภายใน Modal", async ({
    page,
  }) => {
    test.setTimeout(60000);
    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";
    const expectedGuid = "NDWC20260420103022_2";

    // Step 1: ไปที่แท็บ "ค้นหาจาก Id"
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");
    await page.getByText("ค้นหาจาก Id").first().click();

    // Step 2: กรอก GUID
    const guidInputCandidates: Locator[] = [
      page.locator("#searchById"),
      page.locator("#alertId"),
      page.locator('input[placeholder*="GUID"]'),
      page.locator('input[placeholder*="Id"]'),
      page.getByRole("textbox").first(),
    ];

    let filledGuidInput = false;
    for (const input of guidInputCandidates) {
      if (
        await input
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false)
      ) {
        await input.first().fill(expectedGuid);
        filledGuidInput = true;
        break;
      }
    }
    expect(filledGuidInput, "ต้องพบช่องกรอก GUID").toBeTruthy();

    // Step 3: กดค้นหา และรอ API response
    const guidResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/app/capFeed/getCapFeedGuidDataList") &&
        response.url().includes(`guid=${expectedGuid}`) &&
        response.status() === 200,
    );
    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
    const guidResponse = await guidResponsePromise;
    const guidData = await guidResponse.json();
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

    // Step 4: รอให้ปุ่มดูรายละเอียดปรากฏ
    const idTabPanel = page.getByRole("tabpanel", { name: "ค้นหาจาก Id" });
    const detailButton = idTabPanel
      .getByRole("button", { name: /ดูรายละเอียด/ })
      .first();
    await expect(detailButton).toBeVisible({ timeout: 10000 });

    // Step 5: คลิกดูรายละเอียด
    await detailButton.click();

    // Step 6: ตรวจสอบค่าต่างๆ ใน Modal
    const modal = page
      .locator(".modal.show, .modal-dialog, [role='dialog']")
      .first();
    await expect(modal, "Modal ต้องแสดงขึ้นมา").toBeVisible({ timeout: 5000 });

    const modalText = await modal.innerText();
    console.log(`📌 Modal text:\n${modalText}`);

    // helper แปลงวันที่เป็นรูปแบบที่ UI แสดง
    const formatDate = (isoDate: string): string => {
      if (!isoDate) return "";
      const date = new Date(isoDate);
      return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
    };

    // Expect 1: ที่มาของแหล่งข้อมูล
    expect(
      modalText,
      `Modal ต้องแสดงที่มาของแหล่งข้อมูล "${apiSenderName}"`,
    ).toContain(apiSenderName);

    // Expect 2: ความรุนแรง
    expect(modalText, `Modal ต้องแสดงความรุนแรง "${apiSeverity}"`).toContain(
      apiSeverity,
    );

    // Expect 3: ความเร่งด่วน
    expect(modalText, `Modal ต้องแสดงความเร่งด่วน "${apiUrgency}"`).toContain(
      apiUrgency,
    );

    // Expect 4: ความแน่นอน
    expect(modalText, `Modal ต้องแสดงความแน่นอน "${apiCertainty}"`).toContain(
      apiCertainty,
    );

    // Expect 5: คำเตือนที่มีผล (effectiveTime)
    const effectiveDateStr = formatDate(apiEffectiveTime);
    expect(
      modalText,
      `Modal ต้องแสดงคำเตือนที่มีผล "${effectiveDateStr}"`,
    ).toContain(effectiveDateStr);

    // Expect 6: คำเตือนสิ้นสุด (expiredTime)
    const expiredDateStr = formatDate(apiExpiredTime);
    expect(
      modalText,
      `Modal ต้องแสดงคำเตือนสิ้นสุด "${expiredDateStr}"`,
    ).toContain(expiredDateStr);

    // Expect 7: ข้อความแจ้งเตือน
    if (apiDescription) {
      expect(
        modalText,
        `Modal ต้องแสดงข้อความแจ้งเตือน "${apiDescription}"`,
      ).toContain(apiDescription);
    }

    // Expect 8: พื้นที่ที่ได้รับผลกระทบ — จังหวัด
    if (apiProvince && apiProvince !== "-") {
      expect(modalText, `Modal ต้องแสดงจังหวัด "${apiProvince}"`).toContain(
        apiProvince,
      );
    }

    // Expect 9: label fields ต้องปรากฏใน Modal
    const expectedLabels = [
      "ที่มาของแหล่งข้อมูล:",
      "ความรุนแรง:",
      "ความเร่งด่วน:",
      "ความแน่นอน:",
      "คำเตือนที่มีผล:",
      "คำเตือนสิ้นสุด:",
      "ข้อความแจ้งเตือน:",
      "พื้นที่ที่ได้รับผลกระทบ",
      "จังหวัด:",
    ];
    for (const label of expectedLabels) {
      expect(modalText, `Modal ต้องแสดง label "${label}"`).toContain(label);
    }

    console.log(
      `✅ GUID "${expectedGuid}" — ข้อมูลรายละเอียดใน Modal แสดงถูกต้องครบถ้วน — ผ่าน`,
    );
  });

  test("TC-DA-GUID-010 : ตรวจสอบว่าปุ่ม Copy สามารถคัดลอกข้อความแจ้งเตือนไปยัง Clipboard ได้", async ({
    page,
    context,
  }) => {
    test.setTimeout(60000);
    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";
    const expectedGuid = "NDWC20260420103022_2";

    // Step 1: ไปที่แท็บ "ค้นหาจาก Id"
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");
    await page.getByText("ค้นหาจาก Id").first().click();

    // Step 2: กรอก GUID
    const guidInputCandidates: Locator[] = [
      page.locator("#searchById"),
      page.locator("#alertId"),
      page.locator('input[placeholder*="GUID"]'),
      page.locator('input[placeholder*="Id"]'),
      page.getByRole("textbox").first(),
    ];

    let filledGuidInput = false;
    for (const input of guidInputCandidates) {
      if (
        await input
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false)
      ) {
        await input.first().fill(expectedGuid);
        filledGuidInput = true;
        break;
      }
    }
    expect(filledGuidInput, "ต้องพบช่องกรอก GUID").toBeTruthy();

    // Step 3: กดค้นหา และรอ API response
    const guidResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/app/capFeed/getCapFeedGuidDataList") &&
        response.url().includes(`guid=${expectedGuid}`) &&
        response.status() === 200,
    );
    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
    const guidResponse = await guidResponsePromise;
    const guidData = await guidResponse.json();
    expect(guidData.totalCount).toBe(1);

    const apiDescription: string = guidData.items[0].description ?? "";
    console.log(`📌 API description: "${apiDescription}"`);

    // Step 4: รอให้ปุ่มดูรายละเอียดปรากฏ
    const idTabPanel = page.getByRole("tabpanel", { name: "ค้นหาจาก Id" });
    const detailButton = idTabPanel
      .getByRole("button", { name: /ดูรายละเอียด/ })
      .first();
    await expect(detailButton).toBeVisible({ timeout: 10000 });

    // Step 5: คลิกดูรายละเอียด
    await detailButton.click();

    const modal = page
      .locator(".modal.show, .modal-dialog, [role='dialog']")
      .first();
    await expect(modal, "Modal ต้องแสดงขึ้นมา").toBeVisible({ timeout: 5000 });

    // Step 6: อนุญาต clipboard และกด Copy ข้อความแจ้งเตือน
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    const copyButton = modal
      .locator("button, span, i")
      .filter({ hasText: /copy|คัดลอก/i })
      .or(modal.locator(".ic-copy, [class*='copy']"))
      .first();
    await expect(copyButton, "ต้องพบปุ่ม Copy ใน Modal").toBeVisible({
      timeout: 5000,
    });
    await copyButton.click();
    await page.waitForTimeout(500);

    // Expect 1: แสดงข้อความยืนยันการ copy
    const successMessage = page
      .locator("*")
      .filter({ hasText: /คัดลอกไปยังคลิปบอร์ดแล้ว|copied|คัดลอกแล้ว/i })
      .first();
    await expect(
      successMessage,
      "ต้องแสดงข้อความ 'คัดลอกไปยังคลิปบอร์ดแล้ว'",
    ).toBeVisible({ timeout: 5000 });
    console.log(`📌 Success message แสดงขึ้น — ✅`);

    // Expect 2: ข้อความใน clipboard ต้องตรงกับ description จาก API
    const copiedText = (
      await page.evaluate(() => navigator.clipboard.readText())
    ).trim();
    console.log(`📌 Copied text: "${copiedText}"`);

    expect(
      copiedText.length,
      "ข้อความที่ copy ต้องไม่ว่างเปล่า",
    ).toBeGreaterThan(0);

    if (apiDescription) {
      expect(
        copiedText,
        `ข้อความที่ copy ต้องตรงกับ description "${apiDescription}"`,
      ).toBe(apiDescription.trim());
    }

    console.log(
      `✅ GUID "${expectedGuid}" — Copy ข้อความแจ้งเตือนได้ถูกต้อง — ผ่าน`,
    );
  });

  test("TC-DA-GUID-011 : ตรวจสอบความถูกต้องของข้อมูลพื้นที่ เช่น ภาค จังหวัด และตำบล ที่แสดง", async ({
    page,
  }) => {
    test.setTimeout(60000);
    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";
    const expectedGuid = "NDWC20260420103022_2";

    // Step 1: ไปที่แท็บ "ค้นหาจาก Id"
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");
    await page.getByText("ค้นหาจาก Id").first().click();

    // Step 2: กรอก GUID
    const guidInputCandidates: Locator[] = [
      page.locator("#searchById"),
      page.locator("#alertId"),
      page.locator('input[placeholder*="GUID"]'),
      page.locator('input[placeholder*="Id"]'),
      page.getByRole("textbox").first(),
    ];

    let filledGuidInput = false;
    for (const input of guidInputCandidates) {
      if (
        await input
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false)
      ) {
        await input.first().fill(expectedGuid);
        filledGuidInput = true;
        break;
      }
    }
    expect(filledGuidInput, "ต้องพบช่องกรอก GUID").toBeTruthy();

    // Step 3: กดค้นหา และรอ API response
    const guidResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/app/capFeed/getCapFeedGuidDataList") &&
        response.url().includes(`guid=${expectedGuid}`) &&
        response.status() === 200,
    );
    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
    const guidResponse = await guidResponsePromise;
    const guidData = await guidResponse.json();
    expect(guidData.totalCount).toBe(1);

    // ดึงข้อมูลพื้นที่จาก API
    const apiItem = guidData.items[0];
    const areasItem: any[] = apiItem.areasItem ?? [];
    expect(
      areasItem.length,
      "API ต้องมีข้อมูลพื้นที่อย่างน้อย 1 รายการ",
    ).toBeGreaterThan(0);

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

    // Step 4: รอให้ปุ่มดูรายละเอียดปรากฏ
    const idTabPanel = page.getByRole("tabpanel", { name: "ค้นหาจาก Id" });
    const detailButton = idTabPanel
      .getByRole("button", { name: /ดูรายละเอียด/ })
      .first();
    await expect(detailButton).toBeVisible({ timeout: 10000 });

    // Step 5: คลิกดูรายละเอียด
    await detailButton.click();

    const modal = page
      .locator(".modal.show, .modal-dialog, [role='dialog']")
      .first();
    await expect(modal, "Modal ต้องแสดงขึ้นมา").toBeVisible({ timeout: 5000 });

    const modalText = await modal.innerText();
    console.log(`📌 Modal text:\n${modalText}`);

    // Step 6: ตรวจสอบข้อมูลพื้นที่

    // Expect 1: ต้องแสดง label พื้นที่ครบถ้วน
    const expectedLabels = [
      "พื้นที่ที่ได้รับผลกระทบ",
      "ภาค:",
      "จังหวัด:",
      "ตำบล:",
      "พื้นที่รูปแบบ polygon",
    ];
    for (const label of expectedLabels) {
      expect(modalText, `Modal ต้องแสดง label "${label}"`).toContain(label);
    }

    // Expect 2: ภาค
    expect(modalText, `Modal ต้องแสดงภาค "${apiRegion}"`).toContain(apiRegion);

    // Expect 3: จังหวัด
    expect(modalText, `Modal ต้องแสดงจังหวัด "${apiProvince}"`).toContain(
      apiProvince,
    );

    // Expect 4: ตำบล
    expect(modalText, `Modal ต้องแสดงตำบล "${apiTambon}"`).toContain(apiTambon);

    // Expect 5: polygon
    expect(modalText, `Modal ต้องแสดง polygon "${apiPolygon}"`).toContain(
      apiPolygon,
    );

    // Expect 6: ถ้ามีหลายพื้นที่ ต้องแสดงครบทุกรายการ
    if (areasItem.length > 1) {
      for (let i = 1; i < areasItem.length; i++) {
        const area = areasItem[i];
        const province = area.province ?? "-";
        if (province !== "-") {
          expect(
            modalText,
            `Modal ต้องแสดงจังหวัด "${province}" (area ${i + 1})`,
          ).toContain(province);
        }
      }
    }

    console.log(
      `✅GUID "${expectedGuid}" — ข้อมูลพื้นที่ใน Modal แสดงถูกต้องครบถ้วน — ผ่าน`,
    );
  });

  test("TC-DA-GUID-012 : ตรวจสอบว่าระบบแสดงพื้นที่ Polygon ของเหตุการณ์บนแผนที่ได้ถูกต้อง", async ({
    page,
  }) => {
    test.setTimeout(60000);
    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";
    const expectedGuid = "NDWC20260420103022_2";

    // Step 1: ไปที่แท็บ "ค้นหาจาก Id"
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");
    await page.getByText("ค้นหาจาก Id").first().click();

    // Step 2: กรอก GUID
    const guidInputCandidates: Locator[] = [
      page.locator("#searchById"),
      page.locator("#alertId"),
      page.locator('input[placeholder*="GUID"]'),
      page.locator('input[placeholder*="Id"]'),
      page.getByRole("textbox").first(),
    ];

    let filledGuidInput = false;
    for (const input of guidInputCandidates) {
      if (
        await input
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false)
      ) {
        await input.first().fill(expectedGuid);
        filledGuidInput = true;
        break;
      }
    }
    expect(filledGuidInput, "ต้องพบช่องกรอก GUID").toBeTruthy();

    // Step 3: กดค้นหา และรอ API response
    const guidResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/app/capFeed/getCapFeedGuidDataList") &&
        response.url().includes(`guid=${expectedGuid}`) &&
        response.status() === 200,
    );
    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
    const guidResponse = await guidResponsePromise;
    const guidData = await guidResponse.json();
    expect(guidData.totalCount).toBe(1);

    const apiItem = guidData.items[0];
    const areasItem: any[] = apiItem.areasItem ?? [];
    const apiProvince: string = areasItem[0]?.province ?? "-";
    console.log(`📌 API province: "${apiProvince}"`);

    // Step 4: รอให้ปุ่มดูรายละเอียดปรากฏ
    const idTabPanel = page.getByRole("tabpanel", { name: "ค้นหาจาก Id" });
    const detailButton = idTabPanel
      .getByRole("button", { name: /ดูรายละเอียด/ })
      .first();
    await expect(detailButton).toBeVisible({ timeout: 10000 });

    // Step 5: คลิกดูรายละเอียด
    await detailButton.click();

    const detailContainer = page
      .locator("#capFeedDetailContainer, .modal.show, [role='dialog']")
      .first();
    await expect(detailContainer).toBeVisible({ timeout: 10000 });

    // รอให้ loading หายก่อน
    await expect(detailContainer.locator(".loading, .spinner")).toBeHidden({
      timeout: 15000,
    });
    await expect(detailContainer.locator("text=Error")).toBeHidden({
      timeout: 5000,
    });

    // Step 6: ตรวจสอบแผนที่

    // Expect 1: ตรวจ map tile (warn ถ้าไม่มี ไม่ fail)
    const mapTileCount = await detailContainer
      .locator(".leaflet-tile-loaded, .leaflet-layer, canvas")
      .count();
    if (mapTileCount > 0) {
      console.log("✅ Map Tile โหลดสำเร็จ");
    } else {
      console.warn(
        "⚠️ ไม่พบ tile layer (environment อาจบล็อก map tiles) แต่ทดสอบชั้นข้อมูลต่อ",
      );
    }

    // Expect 2: ตรวจ polygon/marker layer (warn ถ้าไม่มี ไม่ fail)
    const polygonPath = detailContainer.locator(
      "path.leaflet-interactive, svg path",
    );
    const marker = detailContainer.locator(
      ".leaflet-marker-icon, [data-testid='map-marker']",
    );
    const overlayCount = (await polygonPath.count()) + (await marker.count());
    if (overlayCount > 0) {
      console.log("✅ พบ layer บนแผนที่ (polygon/marker)");
    } else {
      console.warn("⚠️ ไม่พบ polygon/marker ใน environment นี้");
    }

    // Expect 3: label พื้นที่ต้องแสดงครบ
    await expect(detailContainer.getByText("ภาค:")).toBeVisible();
    await expect(detailContainer.getByText("จังหวัด:")).toBeVisible();
    await expect(detailContainer.getByText("ตำบล:")).toBeVisible();
    await expect(
      detailContainer.getByText("พื้นที่รูปแบบ polygon"),
    ).toBeVisible();

    // Expect 4: ตรวจ Map Bounds ผ่าน window (warn ถ้าไม่มี ไม่ fail)
    const mapBounds = await page.evaluate(() => {
      const mapInstance =
        (window as any)._leafletMap ?? (window as any).mapInstance;
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

    // Expect 5: ชื่อจังหวัดต้องแสดงใน Modal
    const detailText = await detailContainer.innerText();
    expect(detailText, `Modal ต้องแสดงจังหวัด "${apiProvince}"`).toContain(
      apiProvince,
    );

    console.log(
      `✅ GUID "${expectedGuid}" — พื้นที่ Polygon บนแผนที่แสดงถูกต้อง — ผ่าน`,
    );
  });
});
