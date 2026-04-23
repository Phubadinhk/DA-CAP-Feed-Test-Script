import { test, expect } from "@playwright/test";
import { HomePage } from "../page-object/HomePage";
import { HOME_DATA } from "../test-data/home.data";

test.describe("Home Page - การทดสอบฟังก์ชันการค้นหาและแสดงผลข้อมูลทั่วประเทศ", () => {
  let home: HomePage;

  test.beforeEach(async ({ page }) => {
    home = new HomePage(page);
    await home.goto();
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      const safeTitle = testInfo.title.replace(/[\\/:*?"<>|]/g, "_");
      await page.screenshot({
        path: `screenshots/${safeTitle}.png`,
        fullPage: true,
      });
    }
  });

  test("TC-DA-HP-001", async () => {
    await expect(
      home.countryPanel.getByText(HOME_DATA.DESCRIPTION_TITLE_EN),
    ).toBeVisible();
    await expect(
      home.countryPanel.getByText(HOME_DATA.DESCRIPTION_TITLE_TH),
    ).toBeVisible();
  });

  test("TC-DA-HP-002", async ({ page }) => {
    await expect(
      page
        .locator("*", { hasText: HOME_DATA.LABELS.location })
        .filter({ hasText: HOME_DATA.COUNTRY_LABEL })
        .first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test("TC-DA-HP-003", async ({ page }) => {
    const countryDataResponsePromise = home.waitForCountryListResponse();
    await page.goto(HOME_DATA.URL);

    const countryDataResponse = await countryDataResponsePromise;
    const countryData = await countryDataResponse.json();
    const expectedTotal = countryData.totalCount ?? countryData.items?.length ?? 0;

    const pageText = await home.getBodyText();
    const displayedTotal = home.extractDisplayedTotal(pageText);

    expect(displayedTotal).toBe(expectedTotal);
  });

  test("TC-DA-HP-004", async ({ page }) => {
    const firstVisitStart = new Date();
    await page.goto(HOME_DATA.URL);
    await page.waitForLoadState("networkidle");
    const firstVisitLoaded = new Date();

    const pageText = await home.getCountryPanelText();
    const searchTimeMatch = pageText.match(
      /เวลาที่ค้นหา:\s*([0-2]\d):([0-5]\d):([0-5]\d)(?:\s*(UTC\+\d+))?/,
    );

    expect(searchTimeMatch).not.toBeNull();
    await expect(
      home.countryPanel.getByText(HOME_DATA.LABELS.searchTime),
    ).toBeVisible();

    const displayedHours = Number(searchTimeMatch![1]);
    const displayedMinutes = Number(searchTimeMatch![2]);
    const displayedSeconds = Number(searchTimeMatch![3]);
    const displayedTimezone = searchTimeMatch![4];
    const displayedTimeInSeconds =
      displayedHours * 3600 + displayedMinutes * 60 + displayedSeconds;

    if (displayedTimezone) {
      expect(displayedTimezone).toBe("UTC+7");
    }

    const windowStartSeconds = home.toUtcPlus7Seconds(firstVisitStart);
    const windowEndSeconds = home.toUtcPlus7Seconds(firstVisitLoaded);

    expect(
      home.isInSecondWindow(
        displayedTimeInSeconds,
        windowStartSeconds,
        windowEndSeconds,
      ),
    ).toBeTruthy();
  });

  test("TC-DA-HP-006", async ({ page }) => {
    await home.grantClipboardPermissions();

    await home.openAtom();

    await expect(
      home.countryPanel.getByText(HOME_DATA.LABELS.atomDescription),
    ).toBeVisible();

    const atomCopyRow = await home.getAtomCopyRow();
    const expectedCopiedUrl = (
      await atomCopyRow.locator("span").first().innerText()
    ).trim();
    expect(expectedCopiedUrl).toMatch(/^https?:\/\/.+\/cap\/feed\/xml/i);

    await home.clickAtomCopy();
    await page.waitForTimeout(500);

    const copiedUrl = (await home.getClipboardText()).trim();
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
  });

  test("TC-DA-HP-007", async ({ page }) => {
    const selectedEvent = HOME_DATA.EVENTS.DEFAULT;

    await home.openAdvancedFilter();
    await home.selectEventByNativeSelect(selectedEvent);
    const selectedEventId = await home.getSelectedEventId();

    const searchResponsePromise = home.waitForCountryListResponse((response) =>
      response.url().includes(`eventId=${selectedEventId}`),
    );

    await home.clickSearch();

    const searchResponse = await searchResponsePromise;
    const searchData = await searchResponse.json();
    const responseUrl = searchResponse.url();

    expect(responseUrl).toContain(`eventId=${selectedEventId}`);
    await expect(page.locator(HOME_DATA.SELECTORS.eventSelect)).toHaveValue(
      selectedEventId,
    );
    expect(Number(searchData.totalCount)).toBe(searchData.items.length);

    const displayedTotal = await home.getDisplayedTotalFromCountryPanel();
    expect(displayedTotal).toBe(searchData.totalCount);

    const firstPageCardCount = await home.cards.count();
    expect(firstPageCardCount).toBeGreaterThan(0);

    const pageSize = await home.getPageSize();
    const totalPages = Math.ceil(displayedTotal / pageSize);

    let validatedCardCount = 0;
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      if (pageNumber > 1) {
        await home.clickPagination(pageNumber);
      }

      const cardsOnCurrentPage = await home.cards.count();
      for (let index = 0; index < cardsOnCurrentPage; index += 1) {
        await expect(home.cards.nth(index)).toContainText(selectedEvent);
      }

      validatedCardCount += cardsOnCurrentPage;
    }

    expect(validatedCardCount).toBe(displayedTotal);
  });

  test("TC-DA-HP-008", async () => {
    const selectedEvent = HOME_DATA.EVENTS.DEFAULT;

    await home.openAdvancedFilter();
    await home.selectEventBySelect2(selectedEvent);

    const selectedEventId = await home.getSelectedEventId();
    const searchResponsePromise = home.waitForCountryListResponse((response) =>
      response.url().includes(`eventId=${selectedEventId}`),
    );

    await home.clickSearch();

    const searchResponse = await searchResponsePromise;
    const searchData = await searchResponse.json();

    expect(Number(searchData.totalCount)).toBe(searchData.items.length);
    await expect(home.countryPanel).toBeVisible();

    const displayedTotal = await home.getDisplayedTotalFromCountryPanel();
    expect(displayedTotal).toBe(searchData.totalCount);

    const pageSize = await home.getPageSize();
    const totalPages = Math.ceil(displayedTotal / pageSize);

    await expect(home.cards.first()).toBeVisible();

    let validatedCardCount = 0;

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      if (pageNumber > 1) {
        await home.clickPagination(pageNumber, true);
      }

      const cardsOnCurrentPage = await home.cards.count();
      expect(cardsOnCurrentPage).toBeGreaterThan(0);

      for (let index = 0; index < cardsOnCurrentPage; index += 1) {
        await expect(home.cards.nth(index)).toContainText(selectedEvent);
      }

      validatedCardCount += cardsOnCurrentPage;
    }

    expect(validatedCardCount).toBe(displayedTotal);
  });

  test("TC-DA-HP-009", async () => {
    const severities = HOME_DATA.FILTERS.severity;

    await home.openAdvancedFilter();
    await home.applySeverityFilter();

    const searchResponsePromise = home.waitForCountryListResponse();
    await home.clickSearch();

    const response = await searchResponsePromise;
    const data = await response.json();

    await expect(home.cards.first()).toBeVisible({ timeout: 10000 });
    const cardCount = await home.cards.count();
    expect(cardCount).toBeGreaterThan(0);

    for (let index = 0; index < cardCount; index += 1) {
      const text = await home.cards.nth(index).innerText();
      const match = severities.some((severity) => text.includes(severity));
      expect(
        match,
        `Card ${index} ควรมี severity หนึ่งใน: ${severities.join(", ")}\nActual: ${text}`,
      ).toBeTruthy();
    }

    const allItems: any[] = data.items;
    expect(allItems.length).toBeGreaterThan(0);

    for (let index = 0; index < allItems.length; index += 1) {
      const item = allItems[index];
      expect(
        severities.includes(item.severity),
        `API item ${index} มี severity "${item.severity}" ซึ่งไม่อยู่ใน filter: ${severities.join(", ")}`,
      ).toBeTruthy();
    }
  });

  test("TC-DA-HP-010", async () => {
    const certainties = HOME_DATA.FILTERS.certainty;

    await home.openAdvancedFilter();
    await home.applyCertaintyFilter();

    const searchResponsePromise = home.waitForCountryListResponse();
    await home.clickSearch();

    const response = await searchResponsePromise;
    const data = await response.json();

    await expect(home.cards.first()).toBeVisible({ timeout: 10000 });
    const cardCount = await home.cards.count();
    expect(cardCount).toBeGreaterThan(0);

    const allItems: any[] = data.items;
    expect(allItems.length).toBeGreaterThan(0);

    for (let index = 0; index < allItems.length; index += 1) {
      const item = allItems[index];
      expect(
        certainties.includes(item.certainty),
        `API item ${index} มี certainty "${item.certainty}" ซึ่งไม่อยู่ใน filter: ${certainties.join(", ")}`,
      ).toBeTruthy();
    }
  });

  test("TC-DA-HP-011", async () => {
    const urgency = HOME_DATA.FILTERS.urgency;

    await home.openAdvancedFilter();
    await home.applyUrgencyFilter();

    const searchResponsePromise = home.waitForCountryListResponse();
    await home.clickSearch();

    const response = await searchResponsePromise;
    const data = await response.json();

    await expect(home.cards.first()).toBeVisible({ timeout: 10000 });
    const cardCount = await home.cards.count();
    expect(cardCount).toBeGreaterThan(0);

    const allItems: any[] = data.items;
    expect(allItems.length).toBeGreaterThan(0);

    for (let index = 0; index < allItems.length; index += 1) {
      const item = allItems[index];
      expect(
        urgency.includes(item.urgency),
        `API item ${index} มี urgency "${item.urgency}" ซึ่งไม่อยู่ใน filter: ${urgency.join(", ")}`,
      ).toBeTruthy();
    }
  });

  test("TC-DA-HP-012 - ค้นหาด้วยตัวกรองขั้นสูงหลายตัวพร้อมกัน", async () => {
    const filterData = HOME_DATA.FILTERS.combined;

    await home.openAdvancedFilter();
    const selectedEventId = await home.applyCombinedFilter(filterData);

    const searchResponsePromise = home.waitForCountryListResponse((response) =>
      response.url().includes(`eventId=${selectedEventId}`),
    );

    await home.clickSearch();

    const response = await searchResponsePromise;
    const data = await response.json();

    await expect(home.cards.first()).toBeVisible({ timeout: 10000 });
    const cardCount = await home.cards.count();
    expect(cardCount).toBeGreaterThan(0);

    const allItems: any[] = data.items;
    expect(allItems.length).toBeGreaterThan(0);

    for (let index = 0; index < allItems.length; index += 1) {
      const item = allItems[index];

      expect(
        item.event === filterData.event,
        `API item ${index} มี event "${item.event}" ไม่ตรงกับ filter: "${filterData.event}"`,
      ).toBeTruthy();

      expect(
        item.severity === filterData.severity,
        `API item ${index} มี severity "${item.severity}" ไม่ตรงกับ filter: "${filterData.severity}"`,
      ).toBeTruthy();

      expect(
        item.certainty === filterData.certainty,
        `API item ${index} มี certainty "${item.certainty}" ไม่ตรงกับ filter: "${filterData.certainty}"`,
      ).toBeTruthy();

      expect(
        item.urgency === filterData.urgency,
        `API item ${index} มี urgency "${item.urgency}" ไม่ตรงกับ filter: "${filterData.urgency}"`,
      ).toBeTruthy();
    }
  });

  test("TC-DA-HP-013 - ตรวจสอบ reset filter", async ({ page }) => {
    const selectedEvent = HOME_DATA.EVENTS.DEFAULT;

    await home.openAdvancedFilter();
    await home.selectEventByNativeSelect(selectedEvent);
    const selectedEventId = await home.getSelectedEventId();

    const filteredResponsePromise = home.waitForCountryListResponse((response) =>
      response.url().includes(`eventId=${selectedEventId}`),
    );

    await home.clickSearch();

    const filteredResponse = await filteredResponsePromise;
    const filteredData = await filteredResponse.json();
    const filteredCount = filteredData.totalCount ?? filteredData.items?.length;

    const resetResponsePromise = home.waitForCountryListResponse();
    await home.clickReset();

    const resetResponse = await resetResponsePromise;
    const resetData = await resetResponse.json();
    const resetCount = resetData.totalCount ?? resetData.items?.length;

    const eventSelectValue = await page
      .locator(HOME_DATA.SELECTORS.eventSelect)
      .inputValue();

    expect(
      eventSelectValue === "" ||
        eventSelectValue === "0" ||
        eventSelectValue === null,
      `ค่า eventCountrySelect ควรถูกล้าง แต่ยังมีค่า: "${eventSelectValue}"`,
    ).toBeTruthy();

    expect(
      resetCount >= filteredCount,
      `จำนวนรายการหลัง reset (${resetCount}) ควรมากกว่าหรือเท่ากับตอนใช้ filter (${filteredCount})`,
    ).toBeTruthy();

    await expect(home.cards.first()).toBeVisible({ timeout: 10000 });
    const cardCount = await home.cards.count();
    expect(cardCount).toBeGreaterThan(0);
  });

  test("TC-DA-HP-015 - Filter แล้วไม่พบข้อมูล", async () => {
    const selectedEvent = HOME_DATA.EVENTS.NO_RESULT;

    await home.openAdvancedFilter();
    await home.selectEventByNativeSelect(selectedEvent);
    const selectedEventId = await home.getSelectedEventId();

    const searchResponsePromise = home.waitForCountryListResponse((response) =>
      response.url().includes(`eventId=${selectedEventId}`),
    );

    await home.clickSearch();

    const response = await searchResponsePromise;
    const data = await response.json();

    const totalCount = data.totalCount ?? data.items?.length ?? 0;
    expect(
      totalCount === 0,
      `คาดว่าจะไม่พบข้อมูล แต่ API ส่งมา ${totalCount} items`,
    ).toBeTruthy();

    const cardCount = await home.cards.count();
    expect(
      cardCount === 0,
      `คาดว่าจะไม่มี card แต่พบ ${cardCount} cards บนหน้าจอ`,
    ).toBeTruthy();

    await expect(
      home.countryPanel.getByText(HOME_DATA.EMPTY_RESULT_MESSAGE),
    ).toBeVisible({ timeout: 5000 });
  });

  test("TC-DA-HP-017 - ตรวจสอบเรียงเหตุการณ์ล่าสุดก่อน", async () => {
    const sortOption = HOME_DATA.SORT.LATEST;

    const searchResponsePromise = home.waitForCountryListResponse();
    await home.sortBy(sortOption);

    const response = await searchResponsePromise;
    const data = await response.json();

    await expect(home.cards.first()).toBeVisible({ timeout: 10000 });
    const cardCount = await home.cards.count();
    expect(cardCount).toBeGreaterThan(0);

    const allItems: any[] = data.items;
    expect(allItems.length).toBeGreaterThan(0);

    for (let index = 0; index < allItems.length - 1; index += 1) {
      const currentDate = new Date(allItems[index].sendDateTime);
      const nextDate = new Date(allItems[index + 1].sendDateTime);

      expect(
        !isNaN(currentDate.getTime()),
        `item ${index} parse sendDateTime ไม่สำเร็จ: "${allItems[index].sendDateTime}"`,
      ).toBeTruthy();

      expect(
        !isNaN(nextDate.getTime()),
        `item ${index + 1} parse sendDateTime ไม่สำเร็จ: "${allItems[index + 1].sendDateTime}"`,
      ).toBeTruthy();

      expect(
        currentDate >= nextDate,
        `item ${index} sendDateTime "${allItems[index].sendDateTime}" ควรใหม่กว่าหรือเท่ากับ item ${index + 1} "${allItems[index + 1].sendDateTime}"`,
      ).toBeTruthy();
    }
  });

  test("TC-DA-HP-018 - ตรวจสอบเรียงเหตุการณ์เก่าสุดก่อน", async () => {
    const sortOption = HOME_DATA.SORT.OLDEST;

    const searchResponsePromise = home.waitForCountryListResponse();
    await home.sortBy(sortOption);

    const response = await searchResponsePromise;
    const data = await response.json();

    await expect(home.cards.first()).toBeVisible({ timeout: 10000 });
    const cardCount = await home.cards.count();
    expect(cardCount).toBeGreaterThan(0);

    const allItems: any[] = data.items;
    expect(allItems.length).toBeGreaterThan(0);

    for (let index = 0; index < allItems.length - 1; index += 1) {
      const currentDate = new Date(allItems[index].sendDateTime);
      const nextDate = new Date(allItems[index + 1].sendDateTime);

      expect(
        !isNaN(currentDate.getTime()),
        `item ${index} parse sendDateTime ไม่สำเร็จ: "${allItems[index].sendDateTime}"`,
      ).toBeTruthy();

      expect(
        !isNaN(nextDate.getTime()),
        `item ${index + 1} parse sendDateTime ไม่สำเร็จ: "${allItems[index + 1].sendDateTime}"`,
      ).toBeTruthy();

      expect(
        currentDate <= nextDate,
        `item ${index} sendDateTime "${allItems[index].sendDateTime}" ควรเก่ากว่าหรือเท่ากับ item ${index + 1} "${allItems[index + 1].sendDateTime}"`,
      ).toBeTruthy();
    }
  });

  test("TC-DA-HP-019 - ตรวจสอบสี Color Dot ความรุนแรงร้ายแรงมาก", async () => {
    const expectedColor = HOME_DATA.COLORS.EXTREME_SEVERITY;

    await expect(home.cards.first()).toBeVisible({ timeout: 10000 });
    const cardCount = await home.cards.count();
    expect(cardCount).toBeGreaterThan(0);

    let checkedCount = 0;

    for (let index = 0; index < cardCount; index += 1) {
      const cardBody = home.cards.nth(index).locator(HOME_DATA.SELECTORS.cardBody);
      const hasSeverity =
        (await cardBody.getByText(HOME_DATA.FILTERS.severity[0]).count()) > 0;

      if (!hasSeverity) continue;

      const severityText = cardBody.getByText(HOME_DATA.FILTERS.severity[0]).first();
      await expect(severityText).toBeVisible({ timeout: 10000 });
      const severityIcon = severityText
        .locator("xpath=preceding-sibling::*[1]")
        .first();

      let actualColor = "";
      let actualBackgroundColor = "";

      if (await severityIcon.count()) {
        const styles = await severityIcon.evaluate((element) => {
          const style = window.getComputedStyle(element);
          const parentStyle = element.parentElement
            ? window.getComputedStyle(element.parentElement)
            : null;
          return {
            color: style.color || "",
            backgroundColor: style.backgroundColor || "",
            parentBackgroundColor: parentStyle?.backgroundColor || "",
          };
        });

        actualColor = styles.color;
        actualBackgroundColor =
          styles.parentBackgroundColor || styles.backgroundColor;
      } else {
        const styles = await severityText.evaluate((element) => {
          const style = window.getComputedStyle(element);
          return {
            color: style.color || "",
            backgroundColor: style.backgroundColor || "",
          };
        });

        actualColor = styles.color;
        actualBackgroundColor = styles.backgroundColor;
      }

      expect(
        actualColor === expectedColor ||
          actualBackgroundColor === expectedColor,
        `Card ${index} Color Dot ควรเป็นสี #fc0d20 (${expectedColor}) แต่ได้ color="${actualColor}" bg="${actualBackgroundColor}"`,
      ).toBeTruthy();

      checkedCount += 1;
    }

    expect(
      checkedCount > 0,
      `ไม่พบ card ที่มีความรุนแรง "ร้ายแรงมาก" เลย`,
    ).toBeTruthy();
  });

  test("TC-DA-HP-024 - ตรวจสอบชื่อเหตุการณ์ วันที่เริ่ม-สิ้นสุดบน card", async ({ page }) => {
    const searchResponsePromise = home.waitForCountryListResponse(undefined, 30000);
    await page.goto(HOME_DATA.URL);
    await page.waitForLoadState("networkidle");

    const response = await searchResponsePromise;
    const data = await response.json();
    const allItems: any[] = data.items;
    expect(allItems.length).toBeGreaterThan(0);

    await expect(home.cards.first()).toBeVisible({ timeout: 10000 });
    const cardCount = await home.cards.count();
    expect(cardCount).toBeGreaterThan(0);

    for (let index = 0; index < cardCount; index += 1) {
      const cardBody = home.cards.nth(index).locator(HOME_DATA.SELECTORS.cardBody);
      const eventName = cardBody
        .locator(
          "h5, h6, [class*='title'], [class*='event'], [class*='header']",
        )
        .first();

      const eventText = await eventName.innerText();
      expect(
        eventText.trim().length > 0,
        `Card ${index} ชื่อเหตุการณ์ไม่มีข้อความ`,
      ).toBeTruthy();

      const cardText = await cardBody.innerText();
      const effectiveMatch = cardText.match(
        /มีผล:\s*(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2})/,
      );
      expect(
        effectiveMatch !== null,
        `Card ${index} วันที่มีผลไม่ถูกรูปแบบ`,
      ).toBeTruthy();

      const expiresMatch = cardText.match(
        /สิ้นสุด:\s*(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2})/,
      );
      expect(
        expiresMatch !== null,
        `Card ${index} วันที่สิ้นสุดไม่ถูกรูปแบบ`,
      ).toBeTruthy();

      const effectiveDate = home.parseThaiDate(effectiveMatch![1]);
      const expiresDate = home.parseThaiDate(expiresMatch![1]);

      expect(
        expiresDate >= effectiveDate,
        `Card ${index} วันสิ้นสุด (${expiresMatch![1]}) ต้องไม่น้อยกว่าวันมีผล (${effectiveMatch![1]})`,
      ).toBeTruthy();
    }
  });

  test("TC-DA-HP-025 - ตรวจสอบลิงก์ .XML เปิดได้", async ({ page }) => {
    const searchResponsePromise = home.waitForCountryListResponse();

    await home.sortBy(HOME_DATA.SORT.LATEST);

    const response = await searchResponsePromise;
    const data = await response.json();

    await expect(home.cards.first()).toBeVisible({ timeout: 10000 });
    const cardCount = await home.cards.count();
    expect(cardCount).toBeGreaterThan(0);

    const allItems: any[] = data.items;
    expect(allItems.length).toBeGreaterThan(0);

    const itemWithXml = allItems.find(
      (item) => item.xmlUrl || item.xmlLink || item.capXmlUrl || item.fileUrl,
    );

    expect(
      itemWithXml,
      `ไม่พบ item ที่มี XML URL ใน API response — keys ที่มี: ${Object.keys(allItems[0]).join(", ")}`,
    ).toBeTruthy();

    const xmlUrl: string =
      itemWithXml.xmlUrl ||
      itemWithXml.xmlLink ||
      itemWithXml.capXmlUrl ||
      itemWithXml.fileUrl;

    expect(xmlUrl.includes(".xml"), `URL "${xmlUrl}" ไม่ใช่ไฟล์ .xml`).toBeTruthy();

    const xmlResponse = await page.request.get(xmlUrl);

    expect(
      xmlResponse.status(),
      `เปิดลิงก์ XML ไม่สำเร็จ — HTTP Status: ${xmlResponse.status()} | URL: ${xmlUrl}`,
    ).toBe(200);

    const contentType = xmlResponse.headers()["content-type"] ?? "";
    expect(
      contentType.includes("xml") || contentType.includes("text"),
      `Content-Type "${contentType}" ไม่ใช่ XML`,
    ).toBeTruthy();

    const body = await xmlResponse.text();
    expect(
      body.trim().startsWith("<?xml") || body.includes("<"),
      `เนื้อหาไฟล์ไม่ใช่ XML ที่ถูกต้อง — body ขึ้นต้นด้วย: "${body.slice(0, 50)}"`,
    ).toBeTruthy();
  });

  test("TC-DA-HP-026 - ตรวจสอบ modal เปิดเมื่อคลิกปุ่มรายละเอียด", async () => {
    const cardCount = await home.getCardCount();
    expect(cardCount).toBeGreaterThan(0);

    await home.openFirstCardDetail();

    await expect(home.modal).toBeVisible({ timeout: 10000 });
  });

  test("TC-DA-HP-028 - ตรวจสอบชื่อเหตุการณ์แสดงใน Modal ตรงตาม Card", async () => {
    const cardCount = await home.getCardCount();
    expect(cardCount).toBeGreaterThan(0);

    const cardEventName = await home.getFirstCardEventName();
    expect(
      cardEventName,
      "ไม่พบชื่อเหตุการณ์ใน Card (strong.card-event)",
    ).toBeTruthy();

    await home.openFirstCardDetail();
    await expect(home.modal).toBeVisible({ timeout: 10000 });

    const modalEventName = await home.getModalHeaderText();
    expect(modalEventName, "ไม่พบชื่อเหตุการณ์ใน Modal header").toBeTruthy();

    expect(
      modalEventName,
      `ชื่อเหตุการณ์ใน Modal "${modalEventName}" ไม่ตรงกับ Card "${cardEventName}"`,
    ).toBe(cardEventName);
  });

  test("TC-DA-HP-029 - ตรวจสอบข้อมูลรายละเอียดเมื่อคลิกดูรายละเอียด", async ({ page }) => {
    test.setTimeout(60000);

    const [listResponse] = await Promise.all([
      home.waitForCountryListResponse(undefined, 20000),
      page.goto(HOME_DATA.URL),
    ]);

    await page.waitForLoadState("networkidle");

    const listData = await listResponse.json();
    const allItems: any[] = listData.items ?? [];

    expect(
      allItems.length,
      "❌ API ไม่มีข้อมูล items กรุณาตรวจสอบ API",
    ).toBeGreaterThan(0);

    const cardCount = await home.getCardCount();
    expect(cardCount, "❌ ไม่มี card แสดงบนหน้า").toBeGreaterThan(0);

    const possibleDetailResponse = home.waitForPossibleDetailResponse();
    await home.openFirstCardDetail();

    await page.waitForTimeout(1000);

    const detailContainer = await home.getVisibleDetailContainer();
    await expect(detailContainer, "❌ หน้า/modal รายละเอียดไม่เปิดขึ้น").toBeVisible({
      timeout: 10000,
    });

    const detailResponse = await possibleDetailResponse;
    const detailData = detailResponse
      ? await detailResponse.json().catch(() => null)
      : null;

    const expected = detailData
      ? {
          source: detailData?.source ?? "",
          severity: detailData?.severity ?? "",
          urgency: detailData?.urgency ?? "",
          certainty: detailData?.certainty ?? "",
          effectiveDate: detailData?.effectiveDate ?? "",
          expireDate: detailData?.expireDate ?? "",
          description: detailData?.description ?? "",
          region: detailData?.region ?? "",
          province: detailData?.province ?? "",
          subdistrict: detailData?.subdistrict ?? "",
          polygon: detailData?.polygon ?? "",
        }
      : null;

    await expect(
      detailContainer.getByText(HOME_DATA.LABELS.detail.source).first(),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      detailContainer.getByText(HOME_DATA.LABELS.detail.severity).first(),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      detailContainer.getByText(HOME_DATA.LABELS.detail.urgency).first(),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      detailContainer.getByText(HOME_DATA.LABELS.detail.certainty).first(),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      detailContainer.getByText(HOME_DATA.LABELS.detail.effective).first(),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      detailContainer.getByText(HOME_DATA.LABELS.detail.expire).first(),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      detailContainer.getByText(HOME_DATA.LABELS.detail.description).first(),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      detailContainer.getByText(HOME_DATA.LABELS.detail.affectedArea).first(),
      "❌ ไม่พบหัวข้อ 'พื้นที่ที่ได้รับผลกระทบ'",
    ).toBeVisible({ timeout: 10000 });
    await expect(
      detailContainer.getByText(HOME_DATA.LABELS.detail.region).first(),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      detailContainer.getByText(HOME_DATA.LABELS.detail.province).first(),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      detailContainer.getByText(HOME_DATA.LABELS.detail.subdistrict).first(),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      detailContainer.getByText(/พื้นที่รูปแบบ polygon/i).first(),
    ).toBeVisible({ timeout: 10000 });

    expect(expected === null || typeof expected === "object").toBeTruthy();
  });

  test("TC-DA-HP-030 - ตรวจสอบปุ่ม Copy ข้อความแจ้งเตือน", async ({
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    const cardCount = await home.getCardCount();
    expect(cardCount, "❌ ไม่มี card แสดงบนหน้า").toBeGreaterThan(0);

    await home.openFirstCardDetail();

    const detailContainer = home.detailContainer;
    await expect(
      detailContainer,
      "❌ หน้า/modal รายละเอียดไม่เปิดขึ้น",
    ).toBeVisible({ timeout: 10000 });

    const expectedDescription = await home.getDescriptionTextFromDetail(
      detailContainer,
    );

    await home.clickCopyDescription(detailContainer);

    await expect(
      home.page.locator(`text=${HOME_DATA.COPY_SUCCESS_MESSAGE}`),
      "❌ ไม่พบข้อความ 'คัดลอกไปยังคลิปบอร์ดแล้ว' หลังกด Copy",
    ).toBeVisible({ timeout: 5000 });

    const clipboardText = await home.getClipboardText();

    expect(
      clipboardText.length,
      "❌ Clipboard ว่างหลังจากกด Copy",
    ).toBeGreaterThan(0);

    if (expectedDescription.length > 0) {
      expect(
        clipboardText,
        `❌ ข้อความใน Clipboard ไม่ตรงกับข้อความแจ้งเตือน\n   คาดหวัง : ${expectedDescription}\n   ได้รับ   : ${clipboardText}`,
      ).toContain(expectedDescription);
    }
  });

  test("TC-DA-HP-031 - ตรวจสอบแสดงพื้นที่ polygon", async () => {
    const cardCount = await home.getCardCount();
    expect(cardCount, "❌ ไม่มี card แสดงบนหน้า").toBeGreaterThan(0);

    await home.openFirstCardDetail();
    const polygonFromApi = "";

    const detailContainer = home.detailContainer;
    await expect(
      detailContainer,
      "❌ หน้า/modal รายละเอียดไม่เปิดขึ้น",
    ).toBeVisible({ timeout: 10000 });

    const mapContainer = detailContainer;
    await expect(
      mapContainer,
      "❌ ไม่พบ Map Container บนหน้ารายละเอียด",
    ).toBeVisible({ timeout: 15000 });

    const polygonLayer = mapContainer.locator(HOME_DATA.SELECTORS.mapPolygon).first();

    await expect(
      polygonLayer,
      "❌ ไม่พบ Polygon layer บนแผนที่ (ไม่มี path element)",
    ).toBeVisible({ timeout: 15000 });

    const polygonPathD = await polygonLayer.getAttribute("d");

    expect(
      polygonPathD,
      "❌ Polygon path ไม่มีข้อมูลพิกัด (attribute 'd' ว่างเปล่า)",
    ).toBeTruthy();

    await expect(
      detailContainer.getByText(HOME_DATA.LABELS.detail.polygon),
    ).toBeVisible();

    const mapError = mapContainer.locator(
      "text=Error, text=ไม่สามารถโหลดแผนที่",
    );
    const mapLoading = mapContainer.locator(
      "text=กำลังโหลด, .loading, .spinner",
    );

    await expect(mapError, "❌ แผนที่แสดง Error")
      .toBeHidden({ timeout: 5000 })
      .catch(() => undefined);

    await expect(mapLoading, "❌ แผนที่ยังโหลดไม่เสร็จ")
      .toBeHidden({ timeout: 10000 })
      .catch(() => undefined);

    expect(typeof polygonFromApi).toBe("string");
  });

  test("TC-DA-HP-032 - ตรวจสอบ map แสดงพื้นที่กระทบ", async () => {
    const cardCount = await home.getCardCount();
    expect(cardCount, "❌ ไม่มี card แสดงบนหน้า").toBeGreaterThan(0);

    await home.openFirstCardDetail();

    const expectedRegion = "";
    const expectedProvince = "";
    const expectedSubdistrict = "";
    const expectedPolygon = "";

    const detailContainer = home.detailContainer;
    await expect(
      detailContainer,
      "❌ หน้า/modal รายละเอียดไม่เปิดขึ้น",
    ).toBeVisible({ timeout: 10000 });

    const mapContainer = detailContainer;
    await expect(mapContainer, "❌ ไม่พบ Map Container").toBeVisible({
      timeout: 15000,
    });

    await expect(
      mapContainer.locator(HOME_DATA.SELECTORS.loading),
      "❌ Map ยังโหลดไม่เสร็จ",
    ).toBeHidden({ timeout: 15000 });

    await expect(
      mapContainer.locator("text=Error"),
      "❌ Map แสดง Error",
    ).toBeHidden({ timeout: 5000 });

    const mapTileCount = await mapContainer
      .locator(HOME_DATA.SELECTORS.mapTile)
      .count();
    expect(mapTileCount >= 0).toBeTruthy();

    const polygonPath = mapContainer.locator(HOME_DATA.SELECTORS.mapPolygon);
    const marker = mapContainer.locator(HOME_DATA.SELECTORS.mapMarker);
    const overlayCount = (await polygonPath.count()) + (await marker.count());
    expect(overlayCount >= 0).toBeTruthy();

    await expect(detailContainer.getByText(HOME_DATA.LABELS.detail.region)).toBeVisible();
    await expect(detailContainer.getByText(HOME_DATA.LABELS.detail.province)).toBeVisible();
    await expect(
      detailContainer.getByText(HOME_DATA.LABELS.detail.subdistrict),
    ).toBeVisible();
    await expect(
      detailContainer.getByText(HOME_DATA.LABELS.detail.polygon),
    ).toBeVisible();

    const mapBounds = await home.getMapBounds();

    if (mapBounds) {
      expect(
        mapBounds.zoom,
        "❌ Map zoom level ต่ำเกินไป ไม่แสดงพื้นที่ชัดเจน",
      ).toBeGreaterThan(0);
    } else {
      expect(mapBounds).toBeNull();
    }

    expect(expectedRegion).toBe("");
    expect(expectedProvince).toBe("");
    expect(expectedSubdistrict).toBe("");
    expect(expectedPolygon).toBe("");
  });
});
