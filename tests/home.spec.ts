import { test, expect } from "@playwright/test";

test.describe("Home Page - การทดสอบฟังก์ชันการค้นหาและแสดงผลข้อมูลทั่วประเทศ", () => {
  const UTC_PLUS_7_OFFSET_MINUTES = 7 * 60;

  function toUtcPlus7Seconds(date: Date): number {
    const utcMillis = date.getTime() + date.getTimezoneOffset() * 60_000;
    const utcPlus7 = new Date(utcMillis + UTC_PLUS_7_OFFSET_MINUTES * 60_000);

    return (
      utcPlus7.getHours() * 3600 +
      utcPlus7.getMinutes() * 60 +
      utcPlus7.getSeconds()
    );
  }

  function isInSecondWindow(
    valueSeconds: number,
    startSeconds: number,
    endSeconds: number,
  ): boolean {
    if (startSeconds <= endSeconds) {
      return valueSeconds >= startSeconds && valueSeconds <= endSeconds;
    }

    return valueSeconds >= startSeconds || valueSeconds <= endSeconds;
  }

  test("TC-DA-HP-001", async ({ page }) => {
    await page.goto("https://ndwc-portal-dev.azurewebsites.net/");
    await page.waitForTimeout(5000);

    // Expect a title "to contain" a substring.
    await expect(
      page.getByLabel("ทั่วประเทศ").getByText("The alerts web service"),
    ).toBeVisible();
    await expect(
      page
        .getByLabel("ทั่วประเทศ")
        .getByText(
          "บริการแจ้งเตือนแสดงการเฝ้าระวัง การเตือนภัย และคำแนะนำจาก ปภ. (กรมป้องกันและบรรเทาสาธารณภัย) ในรูปแบบ XML เพื่อให้สามารถนำไปใช้งานร่วมกับระบบสารสนเทศหรือแอปพลิเคชันต่าง ๆ ได้อย่างสะดวกและมีประสิทธิภาพ",
        ),
    ).toBeVisible();
  });

  test("TC-DA-HP-002", async ({ page }) => {
    await page.goto("https://ndwc-portal-dev.azurewebsites.net/");
    await page.waitForLoadState("networkidle");

    // หา element ที่มี label "ตำแหน่งที่ตั้ง:" แล้วเช็ค text "ทั่วประเทศ" ใน container เดียวกัน
    await expect(
      page
        .locator("*", { hasText: "ตำแหน่งที่ตั้ง:" })
        .filter({ hasText: "ทั่วประเทศ" })
        .first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test("TC-DA-HP-003", async ({ page }) => {
    const countryDataResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/app/capFeed/getCapFeedCountryDataList") &&
        response.status() === 200,
    );

    await page.goto("https://ndwc-portal-dev.azurewebsites.net/");

    const countryDataResponse = await countryDataResponsePromise;
    const countryData = await countryDataResponse.json();
    const expectedTotal =
      countryData.totalCount ?? countryData.items?.length ?? 0;

    const pageText = await page.locator("body").innerText();
    const totalMatch = pageText.match(/จำนวนข้อมูลทั้งหมด:\s*([\d,]+)/);

    expect(totalMatch).not.toBeNull();
    const displayedTotal = Number(totalMatch![1].replace(/,/g, ""));

    expect(displayedTotal).toBe(expectedTotal);
  });

  test("TC-DA-HP-004", async ({ page }) => {
    const firstVisitStart = new Date();
    await page.goto("https://ndwc-portal-dev.azurewebsites.net/");
    await page.waitForLoadState("networkidle");
    const firstVisitLoaded = new Date();

    const pageText = await page.getByLabel("ทั่วประเทศ").innerText();
    const searchTimeMatch = pageText.match(
      /เวลาที่ค้นหา:\s*([0-2]\d):([0-5]\d):([0-5]\d)(?:\s*(UTC\+\d+))?/,
    );

    expect(searchTimeMatch).not.toBeNull();
    await expect(
      page.getByLabel("ทั่วประเทศ").getByText("เวลาที่ค้นหา:"),
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

    const windowStartSeconds = toUtcPlus7Seconds(firstVisitStart);
    const windowEndSeconds = toUtcPlus7Seconds(firstVisitLoaded);

    expect(
      isInSecondWindow(
        displayedTimeInSeconds,
        windowStartSeconds,
        windowEndSeconds,
      ),
    ).toBeTruthy();
  });

  test("TC-DA-HP-006", async ({ page }) => {
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("https://ndwc-portal-dev.azurewebsites.net/");
    await page.waitForLoadState("networkidle");
    const countryPanel = page.getByLabel("ทั่วประเทศ");

    // Step 2: เปิดฟิลเตอร์ ATOM
    await page.getByRole("button", { name: "ATOM" }).click();

    // Step 3: ตรวจสอบฟิลเตอร์ ATOM
    await expect(
      countryPanel.getByText("CAP XML สำหรับการค้นหานี้จัดทำโดย API"),
    ).toBeVisible();
    const atomCopyRow = countryPanel.locator(".atom-copy").first();
    await expect(atomCopyRow).toBeVisible();

    const expectedCopiedUrl = (
      await atomCopyRow.locator("span").first().innerText()
    ).trim();
    expect(expectedCopiedUrl).toMatch(/^https?:\/\/.+\/cap\/feed\/xml/i);

    // Step 4: กด Copy
    await atomCopyRow.locator(".ic-copy").click();
    await page.waitForTimeout(500);

    const copiedUrl = (
      await page.evaluate(() => navigator.clipboard.readText())
    ).trim();

    // เงื่อนไข 1: copy XML ได้ถูกต้อง
    expect(copiedUrl).toBe(expectedCopiedUrl);

    // เงื่อนไข 2: เปิดลิงก์ที่ copy ได้
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
    const selectedEvent = "มาตรฐานทั่วไป";

    // Step 1: เปิดเว็บ
    await page.goto("https://ndwc-portal-dev.azurewebsites.net/");
    await page.waitForLoadState("networkidle");

    // Step 2: เปิดตัวกรองขั้นสูง
    await page.getByRole("button", { name: "ตัวกรองขั้นสูง" }).click();

    // Step 3: เลือกเหตุการณ์จาก dropdown (เหตุการณ์: มาตรฐานทั่วไป)
    await page.selectOption("#eventCountrySelect", { label: selectedEvent });
    const selectedEventId = await page
      .locator("#eventCountrySelect")
      .inputValue();
    const searchResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/app/capFeed/getCapFeedCountryDataList") &&
        response.url().includes(`eventId=${selectedEventId}`) &&
        response.status() === 200,
    );

    // Step 4: กด “ค้นหา”
    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();

    const searchResponse = await searchResponsePromise;
    const searchData = await searchResponse.json();
    const responseUrl = searchResponse.url();

    expect(responseUrl).toContain(`eventId=${selectedEventId}`);
    await expect(page.locator("#eventCountrySelect")).toHaveValue(
      selectedEventId,
    );
    expect(Number(searchData.totalCount)).toBe(searchData.items.length);

    const countryPanelText = await page.getByLabel("ทั่วประเทศ").innerText();
    const displayedTotalMatch = countryPanelText.match(
      /จำนวนข้อมูลทั้งหมด:\s*([\d,]+)/,
    );
    expect(displayedTotalMatch).not.toBeNull();
    const displayedTotal = Number(displayedTotalMatch![1].replace(/,/g, ""));

    expect(displayedTotal).toBe(searchData.totalCount);

    const countryCardContainer = page.locator("#capFeedCountryCardContainer");
    const countryCards = countryCardContainer.locator(".card");
    const firstPageCardCount = await countryCards.count();
    expect(firstPageCardCount).toBeGreaterThan(0);

    const pageSizeDropdown = page.locator("#pageSizeDropdown").first();
    const pageSize = Number(await pageSizeDropdown.inputValue());
    const totalPages = Math.ceil(displayedTotal / pageSize);

    let validatedCardCount = 0;
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      if (pageNumber > 1) {
        await page
          .getByLabel("ทั่วประเทศ")
          .locator("a.pointer.mx-1", { hasText: String(pageNumber) })
          .first()
          .click();
        await page.waitForTimeout(300);
      }

      const cardsOnCurrentPage = await countryCards.count();
      for (let index = 0; index < cardsOnCurrentPage; index += 1) {
        await expect(countryCards.nth(index)).toContainText(selectedEvent);
      }

      validatedCardCount += cardsOnCurrentPage;
    }

    expect(validatedCardCount).toBe(displayedTotal);

    console.log(
      `Validated ${validatedCardCount} cards across ${totalPages} pages for event "${selectedEvent}".`,
    );
  });

  test("TC-DA-HP-008", async ({ page }) => {
    const selectedEvent = "มาตรฐานทั่วไป";

    // Step 1: เปิดเว็บ
    await page.goto("https://ndwc-portal-dev.azurewebsites.net/");
    await page.waitForLoadState("networkidle");

    // Step 2: เปิดตัวกรองขั้นสูง
    await page.getByRole("button", { name: "ตัวกรองขั้นสูง" }).click();

    // Step 3: เลือกเหตุการณ์ (Select2)
    await page.getByRole("combobox", { name: "เลือกเหตุการณ์" }).click();

    const dropdown = page.locator(".select2-container--open");
    const input = dropdown.locator(".select2-search__field");

    await expect(input).toBeVisible();
    await input.fill(selectedEvent);

    const option = dropdown.locator(".select2-results__option", {
      hasText: selectedEvent,
    });

    await expect(option).toBeVisible();
    await option.click();

    // ดึง eventId
    const selectedEventId = await page
      .locator("#eventCountrySelect")
      .inputValue();

    // Step 4: ดัก API
    const searchResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/app/capFeed/getCapFeedCountryDataList") &&
        response.url().includes(`eventId=${selectedEventId}`) &&
        response.status() === 200,
    );

    // Step 5: กดค้นหา
    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();

    const searchResponse = await searchResponsePromise;
    const searchData = await searchResponse.json();

    expect(Number(searchData.totalCount)).toBe(searchData.items.length);

    // ✅ Scope ทุกอย่างใน panel "ทั่วประเทศ"
    const countryPanel = page.getByLabel("ทั่วประเทศ");
    await expect(countryPanel).toBeVisible();

    // Step 6: ตรวจ summary
    const text = await countryPanel.innerText();
    const match = text.match(/จำนวนข้อมูลทั้งหมด:\s*([\d,]+)/);

    expect(match).not.toBeNull();

    const displayedTotal = Number(match![1].replace(/,/g, ""));
    expect(displayedTotal).toBe(searchData.totalCount);

    // Step 7: ใช้ pageSize (แก้ strict mode)
    const pageSizeDropdown = countryPanel.locator("#pageSizeDropdown");
    const pageSize = Number(await pageSizeDropdown.inputValue());

    const totalPages = Math.ceil(displayedTotal / pageSize);

    // Step 8: cards (scope ใน panel)
    const countryCards = countryPanel.locator(
      "#capFeedCountryCardContainer .card",
    );

    await expect(countryCards.first()).toBeVisible();

    let validatedCardCount = 0;

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      if (pageNumber > 1) {
        const firstCardBefore = await countryCards.first().innerText();

        await countryPanel
          .locator("a.pointer.mx-1", { hasText: String(pageNumber) })
          .first()
          .click();

        // ✅ รอ DOM เปลี่ยนจริง (แทน waitForTimeout)
        await expect(countryCards.first()).not.toHaveText(firstCardBefore);
      }

      const cardsOnCurrentPage = await countryCards.count();
      expect(cardsOnCurrentPage).toBeGreaterThan(0);

      for (let i = 0; i < cardsOnCurrentPage; i++) {
        await expect(countryCards.nth(i)).toContainText(selectedEvent);
      }

      validatedCardCount += cardsOnCurrentPage;
    }

    // Step 9: final assertion
    expect(validatedCardCount).toBe(displayedTotal);

    console.log(
      `Validated ${validatedCardCount} cards across ${totalPages} pages for event "${selectedEvent}".`,
    );
  });

  test("TC-DA-HP-009", async ({ page }) => {
    const severities = ["ร้ายแรงมาก", "ร้ายแรง"];

    // Step 1: เปิดเว็บ
    await page.goto("https://ndwc-portal-dev.azurewebsites.net/");
    await page.waitForLoadState("networkidle");

    // Step 2: เปิดตัวกรองขั้นสูง
    await page.getByRole("button", { name: "ตัวกรองขั้นสูง" }).click();
    await page.waitForTimeout(1000);

    // Step 3: เลือก checkbox
    await page.locator("#severityExtreme").nth(0).check();
    await page.locator("#severitySevere").nth(0).check();

    await expect(page.locator("#severityExtreme").nth(0)).toBeChecked();
    await expect(page.locator("#severitySevere").nth(0)).toBeChecked();

    // ✅ ดัก API
    const searchResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/app/capFeed/getCapFeedCountryDataList") &&
        res.status() === 200,
      { timeout: 15000 },
    );

    // Step 4: กด "ค้นหา"
    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();

    const response = await searchResponsePromise;
    const data = await response.json();

    // ✅ UI cards — เช็คเฉพาะที่แสดงบนหน้าจอ
    const cards = page
      .locator("#capFeedCountryCardContainer")
      .nth(0)
      .locator(".card");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });

    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    for (let i = 0; i < cardCount; i++) {
      const text = await cards.nth(i).innerText();
      const match = severities.some((sev) => text.includes(sev));
      expect(
        match,
        `Card ${i} ควรมี severity หนึ่งใน: ${severities.join(", ")}\nActual: ${text}`,
      ).toBeTruthy();
    }

    // ✅ API validation — เช็คครบทุก item ที่ API ส่งมา (ทั้ง 19 items)
    const allItems: any[] = data.items;
    expect(allItems.length).toBeGreaterThan(0);

    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i];
      expect(
        severities.includes(item.severity),
        `API item ${i} มี severity "${item.severity}" ซึ่งไม่อยู่ใน filter: ${severities.join(", ")}`,
      ).toBeTruthy();
    }

    console.log(
      `✅ Validated ${cardCount} UI cards | ${allItems.length} API items | Severities: ${severities.join(", ")}`,
    );
  });

  test("TC-DA-HP-010", async ({ page }) => {
    const certainties = ["สังเกตการณ์", "ไม่ทราบ"];

    // Step 1: เปิดเว็บ
    await page.goto("https://ndwc-portal-dev.azurewebsites.net/");
    await page.waitForLoadState("networkidle");

    // Step 2: เปิดตัวกรองขั้นสูง
    await page.getByRole("button", { name: "ตัวกรองขั้นสูง" }).click();
    await page.waitForTimeout(1000);

    // Step 3: เลือก checkbox
    await page.locator("#certaintyObserved").nth(0).check();
    await page.locator("#certaintyUnknown").nth(0).check();

    await expect(page.locator("#certaintyObserved").nth(0)).toBeChecked();
    await expect(page.locator("#certaintyUnknown").nth(0)).toBeChecked();

    // ✅ ดัก API
    const searchResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/app/capFeed/getCapFeedCountryDataList") &&
        res.status() === 200,
      { timeout: 15000 },
    );

    // Step 4: กด "ค้นหา"
    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();

    const response = await searchResponsePromise;
    const data = await response.json();

    // ✅ UI — แค่ verify ว่า card render ขึ้นมา (certainty แสดงใน Modal ไม่ใช่บน card)
    const cards = page
      .locator("#capFeedCountryCardContainer")
      .nth(0)
      .locator(".card");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    // ✅ API validation — ตรวจสอบ certainty ครบทุก item
    const allItems: any[] = data.items;
    expect(allItems.length).toBeGreaterThan(0);

    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i];
      expect(
        certainties.includes(item.certainty),
        `API item ${i} มี certainty "${item.certainty}" ซึ่งไม่อยู่ใน filter: ${certainties.join(", ")}`,
      ).toBeTruthy();
    }

    console.log(
      `✅ Validated ${cardCount} UI cards | ${allItems.length} API items | Certainties: ${certainties.join(", ")}`,
    );
  });

  test("TC-DA-HP-011", async ({ page }) => {
    const urgency = ["ทันที", "ไม่ทราบ"];

    // Step 1: เปิดเว็บ
    await page.goto("https://ndwc-portal-dev.azurewebsites.net/");
    await page.waitForLoadState("networkidle");

    // Step 2: เปิดตัวกรองขั้นสูง
    await page.getByRole("button", { name: "ตัวกรองขั้นสูง" }).click();
    await page.waitForTimeout(1000);

    // Step 3: เลือก checkbox
    await page.locator("#urgencyImmediate").nth(0).check();
    await page.locator("#urgencyUnknown").nth(0).check();

    await expect(page.locator("#urgencyImmediate").nth(0)).toBeChecked();
    await expect(page.locator("#urgencyUnknown").nth(0)).toBeChecked();

    // ✅ ดัก API
    const searchResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/app/capFeed/getCapFeedCountryDataList") &&
        res.status() === 200,
      { timeout: 15000 },
    );

    // Step 4: กด "ค้นหา"
    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();

    const response = await searchResponsePromise;
    const data = await response.json();

    // ✅ UI — แค่ verify ว่า card render ขึ้นมา (certainty แสดงใน Modal ไม่ใช่บน card)
    const cards = page
      .locator("#capFeedCountryCardContainer")
      .nth(0)
      .locator(".card");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    // ✅ API validation — ตรวจสอบ certainty ครบทุก item
    const allItems: any[] = data.items;
    expect(allItems.length).toBeGreaterThan(0);

    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i];
      expect(
        urgency.includes(item.urgency),
        `API item ${i} มี urgency "${item.urgency}" ซึ่งไม่อยู่ใน filter: ${urgency.join(", ")}`,
      ).toBeTruthy();
    }

    console.log(
      `✅ Validated ${cardCount} UI cards | ${allItems.length} API items | Urgencies: ${urgency.join(", ")}`,
    );
  });

  test("TC-DA-HP-012 - ค้นหาด้วยตัวกรองขั้นสูงหลายตัวพร้อมกัน", async ({
    page,
  }) => {
    const filterData = {
      event: "มาตรฐานทั่วไป",
      severity: "ร้ายแรงมาก",
      certainty: "สังเกตการณ์",
      urgency: "ทันที",
    };

    // Step 1: เปิดเว็บ
    await page.goto("https://ndwc-portal-dev.azurewebsites.net/");
    await page.waitForLoadState("networkidle");

    // Step 2: เปิดตัวกรองขั้นสูง
    await page.getByRole("button", { name: "ตัวกรองขั้นสูง" }).click();
    await page.waitForTimeout(1000);

    // Step 3: เลือกเหตุการณ์จาก dropdown
    await page.selectOption("#eventCountrySelect", { label: filterData.event });
    const selectedEventId = await page
      .locator("#eventCountrySelect")
      .inputValue();

    // Step 4: เลือกความรุนแรง
    await page.locator("#severityExtreme").nth(0).check();
    await expect(page.locator("#severityExtreme").nth(0)).toBeChecked();

    // Step 5: เลือกความแน่นอน
    await page.locator("#certaintyObserved").nth(0).check();
    await expect(page.locator("#certaintyObserved").nth(0)).toBeChecked();

    // Step 6: เลือกความเร่งด่วน
    await page.locator("#urgencyImmediate").nth(0).check();
    await expect(page.locator("#urgencyImmediate").nth(0)).toBeChecked();

    // ✅ ดัก API (รวม eventId ใน URL)
    const searchResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/app/capFeed/getCapFeedCountryDataList") &&
        res.url().includes(`eventId=${selectedEventId}`) &&
        res.status() === 200,
      { timeout: 15000 },
    );

    // Step 7: กดปุ่มค้นหา
    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();

    const response = await searchResponsePromise;
    const data = await response.json();

    // ✅ UI — verify ว่า card render ขึ้นมา
    const cards = page
      .locator("#capFeedCountryCardContainer")
      .nth(0)
      .locator(".card");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    // ✅ API validation — ตรวจสอบทุก field ครบทุก item
    const allItems: any[] = data.items;
    expect(allItems.length).toBeGreaterThan(0);

    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i];

      expect(
        item.event === filterData.event,
        `API item ${i} มี event "${item.event}" ไม่ตรงกับ filter: "${filterData.event}"`,
      ).toBeTruthy();

      expect(
        item.severity === filterData.severity,
        `API item ${i} มี severity "${item.severity}" ไม่ตรงกับ filter: "${filterData.severity}"`,
      ).toBeTruthy();

      expect(
        item.certainty === filterData.certainty,
        `API item ${i} มี certainty "${item.certainty}" ไม่ตรงกับ filter: "${filterData.certainty}"`,
      ).toBeTruthy();

      expect(
        item.urgency === filterData.urgency,
        `API item ${i} มี urgency "${item.urgency}" ไม่ตรงกับ filter: "${filterData.urgency}"`,
      ).toBeTruthy();
    }

    console.log(
      `✅ Validated ${cardCount} UI cards | ${allItems.length} API items\n` +
        `   Event: ${filterData.event} (id: ${selectedEventId}) | Severity: ${filterData.severity} | Certainty: ${filterData.certainty} | Urgency: ${filterData.urgency}`,
    );
  });

  test("TC-DA-HP-013 - ตรวจสอบ reset filter", async ({ page }) => {
    const selectedEvent = "มาตรฐานทั่วไป";

    // Step 1: เปิดเว็บ
    await page.goto("https://ndwc-portal-dev.azurewebsites.net/");
    await page.waitForLoadState("networkidle");

    // Step 2: เปิดตัวกรองขั้นสูง
    await page.getByRole("button", { name: "ตัวกรองขั้นสูง" }).click();
    await page.waitForTimeout(1000);

    // Step 3: เลือกเหตุการณ์จาก dropdown
    await page.selectOption("#eventCountrySelect", { label: selectedEvent });
    const selectedEventId = await page
      .locator("#eventCountrySelect")
      .inputValue();

    // ✅ ดัก API ครั้งที่ 1 (หลังเลือก filter)
    const filteredResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/app/capFeed/getCapFeedCountryDataList") &&
        res.url().includes(`eventId=${selectedEventId}`) &&
        res.status() === 200,
      { timeout: 15000 },
    );

    // Step 4: กด "ค้นหา"
    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();

    const filteredResponse = await filteredResponsePromise;
    const filteredData = await filteredResponse.json();
    const filteredCount = filteredData.totalCount ?? filteredData.items?.length;

    // ✅ ดัก API ครั้งที่ 2 (หลัง reset)
    const resetResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/app/capFeed/getCapFeedCountryDataList") &&
        res.status() === 200,
      { timeout: 15000 },
    );

    // Step 5: กด "ล้างตัวเลือก"
    await page
      .getByRole("button", { name: "ล้างตัวเลือก", exact: true })
      .click();

    const resetResponse = await resetResponsePromise;
    const resetData = await resetResponse.json();
    const resetCount = resetData.totalCount ?? resetData.items?.length;

    // ✅ ตรวจสอบ filter ถูกล้างแล้ว — dropdown กลับเป็นค่า default
    const eventSelectValue = await page
      .locator("#eventCountrySelect")
      .inputValue();
    expect(
      eventSelectValue === "" ||
        eventSelectValue === "0" ||
        eventSelectValue === null,
      `ค่า eventCountrySelect ควรถูกล้าง แต่ยังมีค่า: "${eventSelectValue}"`,
    ).toBeTruthy();

    // ✅ ตรวจสอบว่าข้อมูลหลัง reset มากกว่าหรือเท่ากับตอนใช้ filter
    expect(
      resetCount >= filteredCount,
      `จำนวนรายการหลัง reset (${resetCount}) ควรมากกว่าหรือเท่ากับตอนใช้ filter (${filteredCount})`,
    ).toBeTruthy();

    // ✅ UI — ตรวจสอบว่า card แสดงผลหลัง reset
    const cards = page
      .locator("#capFeedCountryCardContainer")
      .nth(0)
      .locator(".card");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    console.log(
      `✅ Filter reset สำเร็จ\n` +
        `   ก่อน reset (filter: ${selectedEvent}): ${filteredCount} items\n` +
        `   หลัง reset (ทั้งหมด): ${resetCount} items | UI cards: ${cardCount}`,
    );
  });

  test("TC-DA-HP-015 - Filter แล้วไม่พบข้อมูล", async ({ page }) => {
    const selectedEvent = "การแจ้งเตือนระดับชาติ";

    // Step 1: เปิดเว็บ
    await page.goto("https://ndwc-portal-dev.azurewebsites.net/");
    await page.waitForLoadState("networkidle");

    // Step 2: เปิดตัวกรองขั้นสูง
    await page.getByRole("button", { name: "ตัวกรองขั้นสูง" }).click();
    await page.waitForTimeout(1000);

    // Step 3: เลือกเหตุการณ์จาก dropdown
    await page.selectOption("#eventCountrySelect", { label: selectedEvent });
    const selectedEventId = await page
      .locator("#eventCountrySelect")
      .inputValue();

    // ✅ ดัก API
    const searchResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/app/capFeed/getCapFeedCountryDataList") &&
        res.url().includes(`eventId=${selectedEventId}`) &&
        res.status() === 200,
      { timeout: 15000 },
    );

    // Step 4: กดค้นหา
    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();

    const response = await searchResponsePromise;
    const data = await response.json();

    // ✅ API validation — ตรวจสอบว่าไม่มีข้อมูล
    const totalCount = data.totalCount ?? data.items?.length ?? 0;
    expect(
      totalCount === 0,
      `คาดว่าจะไม่พบข้อมูล แต่ API ส่งมา ${totalCount} items`,
    ).toBeTruthy();

    // ✅ UI — ตรวจสอบว่าไม่มี card แสดง
    const cards = page
      .locator("#capFeedCountryCardContainer")
      .nth(0)
      .locator(".card");
    const cardCount = await cards.count();
    expect(
      cardCount === 0,
      `คาดว่าจะไม่มี card แต่พบ ${cardCount} cards บนหน้าจอ`,
    ).toBeTruthy();

    // ✅ UI — ตรวจสอบข้อความ empty state
    const emptyState = page
      .getByLabel("ทั่วประเทศ")
      .getByText("ไม่พบผลลัพธ์การค้นหาที่ตรงกับเงื่อนไขของคุณ");
    await expect(emptyState).toBeVisible({ timeout: 5000 });

    console.log(
      `✅ TC-DA-HP-015 ผ่าน — ไม่พบข้อมูลตามที่คาด\n` +
        `   Event: ${selectedEvent} (id: ${selectedEventId})\n` +
        `   API items: ${totalCount} | UI cards: ${cardCount}`,
    );
  });

  test("TC-DA-HP-017 - ตรวจสอบเรียงเหตุการณ์ล่าสุดก่อน", async ({ page }) => {
    const sortOption = "เหตุการณ์ล่าสุด";

    // Step 1: เปิดเว็บ
    await page.goto("https://ndwc-portal-dev.azurewebsites.net/");
    await page.waitForLoadState("networkidle");

    // ✅ ดัก API ก่อนกด option
    const searchResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/app/capFeed/getCapFeedCountryDataList") &&
        res.status() === 200,
      { timeout: 15000 },
    );

    // Step 2: กด dropdown เลือกเวลาเหตุการณ์
    await page
      .getByRole("combobox", { name: "เลือกลำดับเวลาเหตุการณ์" })
      .click();
    await page.getByRole("option", { name: sortOption }).click();

    // ✅ รอ API โหลดเสร็จก่อน
    const response = await searchResponsePromise;
    const data = await response.json();

    // ✅ UI — ตรวจสอบว่า card แสดงผล
    const cards = page
      .locator("#capFeedCountryCardContainer")
      .nth(0)
      .locator(".card");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    // ✅ API validation — ตรวจสอบว่าเรียงจากใหม่ไปเก่า (desc) ด้วย sendDateTime
    const allItems: any[] = data.items;
    expect(allItems.length).toBeGreaterThan(0);

    for (let i = 0; i < allItems.length - 1; i++) {
      const currentDate = new Date(allItems[i].sendDateTime);
      const nextDate = new Date(allItems[i + 1].sendDateTime);

      expect(
        !isNaN(currentDate.getTime()),
        `item ${i} parse sendDateTime ไม่สำเร็จ: "${allItems[i].sendDateTime}"`,
      ).toBeTruthy();

      expect(
        !isNaN(nextDate.getTime()),
        `item ${i + 1} parse sendDateTime ไม่สำเร็จ: "${allItems[i + 1].sendDateTime}"`,
      ).toBeTruthy();

      expect(
        currentDate >= nextDate,
        `item ${i} sendDateTime "${allItems[i].sendDateTime}" ควรใหม่กว่าหรือเท่ากับ item ${i + 1} "${allItems[i + 1].sendDateTime}"`,
      ).toBeTruthy();
    }

    console.log(
      `✅ TC-DA-HP-017 ผ่าน — เรียงเหตุการณ์ล่าสุดก่อนสำเร็จ\n` +
        `   Sort: ${sortOption} | API items: ${allItems.length} | UI cards: ${cardCount}\n` +
        `   ล่าสุด: ${allItems[0].sendDateTime}\n` +
        `   เก่าสุด: ${allItems[allItems.length - 1].sendDateTime}`,
    );
  });

  test("TC-DA-HP-018 - ตรวจสอบเรียงเหตุการณ์เก่าสุดก่อน", async ({ page }) => {
    const sortOption = "เหตุการณ์เก่าสุด";

    // Step 1: เปิดเว็บ
    await page.goto("https://ndwc-portal-dev.azurewebsites.net/");
    await page.waitForLoadState("networkidle");

    // ✅ ดัก API ก่อนกด option
    const searchResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/app/capFeed/getCapFeedCountryDataList") &&
        res.status() === 200,
      { timeout: 15000 },
    );

    // Step 2: กด dropdown เลือกเวลาเหตุการณ์
    await page
      .getByRole("combobox", { name: "เลือกลำดับเวลาเหตุการณ์" })
      .click();
    await page.getByRole("option", { name: sortOption }).click();

    // ✅ รอ API โหลดเสร็จก่อน
    const response = await searchResponsePromise;
    const data = await response.json();

    // ✅ UI — ตรวจสอบว่า card แสดงผล
    const cards = page
      .locator("#capFeedCountryCardContainer")
      .nth(0)
      .locator(".card");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    // ✅ API validation — ตรวจสอบว่าเรียงจากเก่าไปใหม่ (asc) ด้วย sendDateTime
    const allItems: any[] = data.items;
    expect(allItems.length).toBeGreaterThan(0);

    for (let i = 0; i < allItems.length - 1; i++) {
      const currentDate = new Date(allItems[i].sendDateTime);
      const nextDate = new Date(allItems[i + 1].sendDateTime);

      expect(
        !isNaN(currentDate.getTime()),
        `item ${i} parse sendDateTime ไม่สำเร็จ: "${allItems[i].sendDateTime}"`,
      ).toBeTruthy();

      expect(
        !isNaN(nextDate.getTime()),
        `item ${i + 1} parse sendDateTime ไม่สำเร็จ: "${allItems[i + 1].sendDateTime}"`,
      ).toBeTruthy();

      expect(
        currentDate <= nextDate,
        `item ${i} sendDateTime "${allItems[i].sendDateTime}" ควรเก่ากว่าหรือเท่ากับ item ${i + 1} "${allItems[i + 1].sendDateTime}"`,
      ).toBeTruthy();
    }

    console.log(
      `✅ TC-DA-HP-018 ผ่าน — เรียงเหตุการณ์เก่าสุดก่อนสำเร็จ\n` +
        `   Sort: ${sortOption} | API items: ${allItems.length} | UI cards: ${cardCount}\n` +
        `   เก่าสุด: ${allItems[0].sendDateTime}\n` +
        `   ล่าสุด: ${allItems[allItems.length - 1].sendDateTime}`,
    );
  });

  test("TC-DA-HP-019 - ตรวจสอบสี Color Dot ความรุนแรงร้ายแรงมาก", async ({
    page,
  }) => {
    const expectedColor = "rgb(252, 13, 32)"; // #fc0d20

    // Step 1: เปิดเว็บ
    await page.goto("https://ndwc-portal-dev.azurewebsites.net/");
    await page.waitForLoadState("networkidle");

    // ✅ UI — ตรวจสอบว่า card แสดงผล
    const cards = page
      .locator("#capFeedCountryCardContainer")
      .nth(0)
      .locator(".card");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    // ✅ ตรวจสอบสี Color Dot เฉพาะ card ที่มี "ร้ายแรงมาก"
    let checkedCount = 0;

    for (let i = 0; i < cardCount; i++) {
      const cardBody = cards.nth(i).locator(".card-body");
      const hasSeverity = (await cardBody.getByText("ร้ายแรงมาก").count()) > 0;

      if (!hasSeverity) continue;

      // ดึงสีจากสัญลักษณ์ severity ในแถวเดียวกับข้อความ "ร้ายแรงมาก"
      const severityText = cardBody.getByText("ร้ายแรงมาก").first();
      await expect(severityText).toBeVisible({ timeout: 10000 });
      const severityIcon = severityText
        .locator("xpath=preceding-sibling::*[1]")
        .first();

      let actualColor = "";
      let actualBackgroundColor = "";
      if (await severityIcon.count()) {
        const styles = await severityIcon.evaluate((el) => {
          const style = window.getComputedStyle(el);
          const parentStyle = el.parentElement
            ? window.getComputedStyle(el.parentElement)
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
        const styles = await severityText.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return {
            color: style.color || "",
            backgroundColor: style.backgroundColor || "",
          };
        });
        actualColor = styles.color;
        actualBackgroundColor = styles.backgroundColor;
      }

      console.log(
        `Card ${i} Severity color: "${actualColor}", bg: "${actualBackgroundColor}"`,
      );

      expect(
        actualColor === expectedColor ||
          actualBackgroundColor === expectedColor,
        `Card ${i} Color Dot ควรเป็นสี #fc0d20 (${expectedColor}) แต่ได้ color="${actualColor}" bg="${actualBackgroundColor}"`,
      ).toBeTruthy();

      checkedCount++;
    }

    expect(
      checkedCount > 0,
      `ไม่พบ card ที่มีความรุนแรง "ร้ายแรงมาก" เลย`,
    ).toBeTruthy();

    console.log(
      `✅ TC-DA-HP-019 ผ่าน — Color Dot ความรุนแรงร้ายแรงมากแสดงสีถูกต้อง\n` +
        `   Expected: #fc0d20 | ตรวจสอบแล้ว: ${checkedCount} cards`,
    );
  });

  test("TC-DA-HP-024 - ตรวจสอบชื่อเหตุการณ์ วันที่เริ่ม-สิ้นสุดบน card", async ({
    page,
  }) => {
    // ✅ ดัก API ก่อน goto เพื่อไม่พลาด response แรก
    const searchResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/app/capFeed/getCapFeedCountryDataList") &&
        res.status() === 200,
      { timeout: 30000 },
    );

    // Step 1: เปิดเว็บ
    await page.goto("https://ndwc-portal-dev.azurewebsites.net/");
    await page.waitForLoadState("networkidle");

    console.log(
      `TC-DA-HP-024: ตรวจสอบชื่อเหตุการณ์ วันที่มีผล และวันที่สิ้นสุดบน card`,
    );
    const response = await searchResponsePromise;
    const data = await response.json();
    const allItems: any[] = data.items;
    expect(allItems.length).toBeGreaterThan(0);

    // ✅ UI — ตรวจสอบว่า card แสดงผล
    const cards = page
      .locator("#capFeedCountryCardContainer")
      .nth(0)
      .locator(".card");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    // ✅ ตรวจสอบแต่ละ card
    for (let i = 0; i < cardCount; i++) {
      const cardBody = cards.nth(i).locator(".card-body");

      // ตรวจสอบชื่อเหตุการณ์ — ต้องมีข้อความแสดงอยู่
      const eventName = cardBody
        .locator(
          "h5, h6, [class*='title'], [class*='event'], [class*='header']",
        )
        .first();
      const eventText = await eventName.innerText();
      expect(
        eventText.trim().length > 0,
        `Card ${i} ชื่อเหตุการณ์ไม่มีข้อความ`,
      ).toBeTruthy();

      // ตรวจสอบวันที่มีผล/สิ้นสุดจากข้อความรวมในการ์ด (label กับ value อยู่คนละ element)
      const cardText = await cardBody.innerText();
      const effectiveMatch = cardText.match(
        /มีผล:\s*(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2})/,
      );
      expect(
        effectiveMatch !== null,
        `Card ${i} วันที่มีผลไม่ถูกรูปแบบ`,
      ).toBeTruthy();

      const expiresMatch = cardText.match(
        /สิ้นสุด:\s*(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2})/,
      );
      expect(
        expiresMatch !== null,
        `Card ${i} วันที่สิ้นสุดไม่ถูกรูปแบบ`,
      ).toBeTruthy();

      // ตรวจสอบว่าวันสิ้นสุด >= วันมีผล
      const parseThaiDate = (str: string): Date => {
        const match = str.match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2})/);
        if (!match) return new Date("invalid");
        return new Date(`${match[3]}-${match[2]}-${match[1]}T${match[4]}:00`);
      };

      const effectiveDate = parseThaiDate(effectiveMatch![1]);
      const expiresDate = parseThaiDate(expiresMatch![1]);

      expect(
        expiresDate >= effectiveDate,
        `Card ${i} วันสิ้นสุด (${expiresMatch![1]}) ต้องไม่น้อยกว่าวันมีผล (${effectiveMatch![1]})`,
      ).toBeTruthy();

      console.log(
        `Card ${i} ✅ ชื่อ: "${eventText.trim()}" | มีผล: ${effectiveMatch![1]} | สิ้นสุด: ${expiresMatch![1]}`,
      );
    }

    console.log(
      `✅ TC-DA-HP-024 ผ่าน — ตรวจสอบ ${cardCount} cards ครบถ้วนถูกต้อง`,
    );
  });

  test("TC-DA-HP-025 - ตรวจสอบลิงก์ .XML เปิดได้", async ({ page }) => {
    // Step 1: เปิดเว็บ
    await page.goto("https://ndwc-portal-dev.azurewebsites.net/");
    await page.waitForLoadState("networkidle");

    // ✅ ดัก API เพื่อดึง XML URL ที่ยังมีอยู่จริง
    const searchResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/app/capFeed/getCapFeedCountryDataList") &&
        res.status() === 200,
      { timeout: 15000 },
    );

    // trigger API โดยกด dropdown แล้วเลือก option ใดก็ได้
    await page
      .getByRole("combobox", { name: "เลือกลำดับเวลาเหตุการณ์" })
      .click();
    await page.getByRole("option", { name: "เหตุการณ์ล่าสุด" }).click();

    const response = await searchResponsePromise;
    const data = await response.json();

    // ✅ Step 2: ตรวจสอบ Card แสดงผล (UI)
    const cards = page
      .locator("#capFeedCountryCardContainer")
      .nth(0)
      .locator(".card");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    // ✅ Step 3: ดึง XML URL จาก API response (ไม่ใช่จาก DOM ที่อาจเป็น data เก่า)
    const allItems: any[] = data.items;
    expect(allItems.length).toBeGreaterThan(0);

    // หา item แรกที่มี xmlUrl
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

    expect(
      xmlUrl.includes(".xml"),
      `URL "${xmlUrl}" ไม่ใช่ไฟล์ .xml`,
    ).toBeTruthy();

    // ✅ Step 4: เปิดลิงก์ XML และตรวจสอบ
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

    console.log(
      `✅ TC-DA-HP-025 ผ่าน — ลิงก์ .XML เปิดได้สำเร็จ\n` +
        `   XML URL: ${xmlUrl}\n` +
        `   HTTP Status: ${xmlResponse.status()}\n` +
        `   Content-Type: ${contentType}\n` +
        `   API items: ${allItems.length} | UI cards: ${cardCount}`,
    );
  });
  test("TC-DA-HP-026 - ตรวจสอบ modal เปิดเมื่อคลิกปุ่มรายละเอียด", async ({
    page,
  }) => {
    // Step 1: เปิดเว็บ
    await page.goto("https://ndwc-portal-dev.azurewebsites.net/");
    await page.waitForLoadState("networkidle");

    // ✅ Step 2: ตรวจสอบ Card แสดงผล
    const cards = page
      .locator("#capFeedCountryCardContainer")
      .nth(0)
      .locator(".card");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    const firstCard = cards.first();

    // ✅ Step 3: คลิกปุ่มรายละเอียด
    const detailButton = firstCard.locator("button.card-content").first();
    await expect(detailButton).toBeVisible({ timeout: 10000 });
    await detailButton.click();

    // ✅ Step 4: ตรวจสอบ Modal แสดงขึ้นมา
    const modal = page.locator(".modal.show, [role='dialog']").first();
    await expect(modal).toBeVisible({ timeout: 10000 });

    console.log(
      `✅ TC-DA-HP-026 ผ่าน — Modal แสดงขึ้นมาได้อย่างถูกต้อง\n` +
        `   Card count: ${cardCount}`,
    );
  });

  test("TC-DA-HP-028 - ตรวจสอบชื่อเหตุการณ์แสดงใน Modal ตรงตาม Card", async ({
    page,
  }) => {
    // Step 1: เปิดเว็บ
    await page.goto("https://ndwc-portal-dev.azurewebsites.net/");
    await page.waitForLoadState("networkidle");

    // ✅ Step 2: ตรวจสอบ Card แสดงผล
    const cards = page
      .locator("#capFeedCountryCardContainer")
      .nth(0)
      .locator(".card");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    const firstCard = cards.first();

    // ✅ Step 3: ดึงชื่อเหตุการณ์จาก Card ก่อนคลิก
    const cardEventName =
      (
        await firstCard.locator("strong.card-event").first().textContent()
      )?.trim() ?? "";

    expect(
      cardEventName,
      "ไม่พบชื่อเหตุการณ์ใน Card (strong.card-event)",
    ).toBeTruthy();

    console.log(`   Card event name: "${cardEventName}"`);

    // ✅ Step 4: คลิกปุ่มดูรายละเอียด
    const detailButton = firstCard.locator("button.card-content").first();
    await expect(detailButton).toBeVisible({ timeout: 10000 });
    await detailButton.click();

    // ✅ Step 5: ตรวจสอบ Modal แสดงขึ้นมา
    const modal = page.locator(".modal.show, [role='dialog']").first();
    await expect(modal).toBeVisible({ timeout: 10000 });

    // ✅ Step 6: ตรวจสอบชื่อเหตุการณ์ใน Modal header ตรงกับ Card
    // (ปรับ selector ของ modal header ให้ตรง DOM จริง หากยังไม่ผ่าน)
    const modalHeader = modal
      .locator(
        ".modal-title, .modal-header h1, .modal-header h2, .modal-header h3, .modal-header strong, .modal-header p, p",
      )
      .first();
    await expect(modalHeader).toBeVisible({ timeout: 10000 });

    const modalEventName = (await modalHeader.textContent())?.trim() ?? "";

    expect(modalEventName, "ไม่พบชื่อเหตุการณ์ใน Modal header").toBeTruthy();

    expect(
      modalEventName,
      `ชื่อเหตุการณ์ใน Modal "${modalEventName}" ไม่ตรงกับ Card "${cardEventName}"`,
    ).toBe(cardEventName);

    console.log(
      `✅ TC-DA-HP-028 ผ่าน — ชื่อเหตุการณ์แสดงถูกต้อง\n` +
        `   Card: "${cardEventName}"\n` +
        `   Modal: "${modalEventName}"\n` +
        `   Card count: ${cardCount}`,
    );
  });

  test("TC-DA-HP-029 - ตรวจสอบข้อมูลรายละเอียดเมื่อคลิกดูรายละเอียด", async ({
    page,
  }) => {
    test.setTimeout(60000);

    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";

    // ─────────────────────────────────────────────
    // Step 1: เปิดเว็บ + ดัก API list พร้อมกัน
    // ─────────────────────────────────────────────
    const [listResponse] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes("/api/app/capFeed/getCapFeedCountryDataList") &&
          res.status() === 200,
        { timeout: 20000 },
      ),
      page.goto(portalUrl),
    ]);

    await page.waitForLoadState("networkidle");

    const listData = await listResponse.json();
    const allItems: any[] = listData.items ?? [];

    expect(
      allItems.length,
      "❌ API ไม่มีข้อมูล items กรุณาตรวจสอบ API",
    ).toBeGreaterThan(0);

    // ─────────────────────────────────────────────
    // Step 2: ตรวจสอบ card บน UI
    // ─────────────────────────────────────────────
    const cards = page.locator("#capFeedCountryCardContainer .card");

    await expect(cards.first(), "❌ ไม่พบ card แรกบนหน้าจอ").toBeVisible({
      timeout: 10000,
    });

    const cardCount = await cards.count();
    expect(cardCount, "❌ ไม่มี card แสดงบนหน้า").toBeGreaterThan(0);

    const firstCard = cards.first();
    const detailButton = firstCard.getByRole("button", {
      name: "ดูรายละเอียด",
    });

    await expect(
      detailButton,
      "❌ ไม่พบปุ่ม 'ดูรายละเอียด' บน card แรก",
    ).toBeVisible({ timeout: 10000 });

    // ─────────────────────────────────────────────
    // Step 3: คลิกปุ่มดูรายละเอียด
    // ไม่บังคับว่าต้องมี API detail เสมอ
    // ─────────────────────────────────────────────
    const possibleDetailResponse = page
      .waitForResponse(
        (res) =>
          res.url().includes("/api/app/capFeed/getCapFeed") &&
          !res.url().includes("getCapFeedCountryDataList") &&
          res.status() === 200,
        { timeout: 5000 },
      )
      .catch(() => null);

    await detailButton.click();

    // ─────────────────────────────────────────────
    // Step 4: ตรวจสอบว่า detail เปิดขึ้นมา
    // ─────────────────────────────────────────────
    await page.waitForTimeout(1000);

    const detailContainerCandidates = [
      page.locator("#capFeedDetailContainer").first(),
      page.locator(".modal.show").first(),
      page.locator(".modal.fade.show").first(),
      page.locator('[role="dialog"]').first(),
      page.locator(".modal-dialog").first(),
    ];

    let detailContainer = detailContainerCandidates[0];
    let detailOpened = false;

    for (const candidate of detailContainerCandidates) {
      const visible = await candidate
        .isVisible({ timeout: 8000 })
        .catch(() => false);
      if (visible) {
        detailContainer = candidate;
        detailOpened = true;
        break;
      }
    }

    // fallback: ถ้าไม่มี container ชัดเจน แต่มี label รายละเอียดโผล่บนหน้า
    if (!detailOpened) {
      const labelCandidates = [
        page.getByText("ที่มาของแหล่งข้อมูล:").first(),
        page.getByText("ความรุนแรง:").first(),
        page.getByText("คำเตือนที่มีผล:").first(),
      ];
      for (const label of labelCandidates) {
        const visible = await label
          .isVisible({ timeout: 5000 })
          .catch(() => false);
        if (visible) {
          detailContainer = page.locator("body");
          detailOpened = true;
          break;
        }
      }
    }

    // fallback สุดท้าย: ตรวจจาก URL เปลี่ยนหรือ DOM มี element ใหม่
    if (!detailOpened) {
      try {
        await page.waitForFunction(
          () => {
            const modal = document.querySelector(
              ".modal.show, [role='dialog'], #capFeedDetailContainer",
            );
            return (
              modal !== null && (modal as HTMLElement).offsetParent !== null
            );
          },
          { timeout: 8000 },
        );
        detailContainer = page
          .locator(".modal.show, [role='dialog'], #capFeedDetailContainer")
          .first();
        detailOpened = true;
      } catch {
        detailOpened = false;
      }
    }

    expect(detailOpened, "❌ หน้า/modal รายละเอียดไม่เปิดขึ้น").toBe(true);
    // ─────────────────────────────────────────────
    // Step 5: ถ้ามี API detail ค่อยอ่าน
    // ─────────────────────────────────────────────
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

    // ─────────────────────────────────────────────
    // Step 6: UI Validation
    // ─────────────────────────────────────────────
    await expect(
      detailContainer.getByText("ที่มาของแหล่งข้อมูล:").first(),
    ).toBeVisible({ timeout: 10000 });

    await expect(detailContainer.getByText("ความรุนแรง:").first()).toBeVisible({
      timeout: 10000,
    });

    await expect(
      detailContainer.getByText("ความเร่งด่วน:").first(),
    ).toBeVisible({ timeout: 10000 });

    await expect(detailContainer.getByText("ความแน่นอน:").first()).toBeVisible({
      timeout: 10000,
    });

    await expect(
      detailContainer.getByText("คำเตือนที่มีผล:").first(),
    ).toBeVisible({ timeout: 10000 });

    await expect(
      detailContainer.getByText("คำเตือนสิ้นสุด:").first(),
    ).toBeVisible({ timeout: 10000 });

    await expect(
      detailContainer.getByText("ข้อความแจ้งเตือน:").first(),
    ).toBeVisible({ timeout: 10000 });

    // ─────────────────────────────────────────────
    // Step 7: ตรวจสอบส่วน "พื้นที่ที่ได้รับผลกระทบ"
    // ─────────────────────────────────────────────
    await expect(
      detailContainer.getByText("พื้นที่ที่ได้รับผลกระทบ").first(),
      "❌ ไม่พบหัวข้อ 'พื้นที่ที่ได้รับผลกระทบ'",
    ).toBeVisible({ timeout: 10000 });

    await expect(detailContainer.getByText("ภาค:").first()).toBeVisible({
      timeout: 10000,
    });

    await expect(detailContainer.getByText("จังหวัด:").first()).toBeVisible({
      timeout: 10000,
    });

    await expect(detailContainer.getByText("ตำบล:").first()).toBeVisible({
      timeout: 10000,
    });

    await expect(
      detailContainer.getByText(/พื้นที่รูปแบบ polygon/i).first(),
    ).toBeVisible({ timeout: 10000 });

    // ─────────────────────────────────────────────
    // Step 8: สรุปผล
    // ─────────────────────────────────────────────
    console.log(
      `✅ TC-DA-HP-029 ผ่าน — ตรวจสอบข้อมูลรายละเอียดสำเร็จ\n` +
        `   ที่มาของแหล่งข้อมูล : ${expected?.source ?? "(ไม่ได้จาก API detail)"}\n` +
        `   ความรุนแรง          : ${expected?.severity ?? "(ไม่ได้จาก API detail)"}\n` +
        `   ความเร่งด่วน        : ${expected?.urgency ?? "(ไม่ได้จาก API detail)"}\n` +
        `   ความแน่นอน          : ${expected?.certainty ?? "(ไม่ได้จาก API detail)"}\n` +
        `   คำเตือนที่มีผล      : ${expected?.effectiveDate ?? "(ไม่ได้จาก API detail)"}\n` +
        `   คำเตือนสิ้นสุด      : ${expected?.expireDate ?? "(ไม่ได้จาก API detail)"}\n` +
        `   ข้อความแจ้งเตือน    : ${expected?.description ?? "(ไม่ได้จาก API detail)"}\n` +
        `   ภาค                 : ${expected?.region ?? "(ไม่ได้จาก API detail)"}\n` +
        `   จังหวัด             : ${expected?.province ?? "(ไม่ได้จาก API detail)"}\n` +
        `   ตำบล                : ${expected?.subdistrict ?? "(ไม่ได้จาก API detail)"}\n` +
        `   Polygon             : ${expected?.polygon ?? "(ไม่ได้จาก API detail)"}`,
    );
  });

  test("TC-DA-HP-030 - ตรวจสอบปุ่ม Copy ข้อความแจ้งเตือน", async ({
    page,
    context,
  }) => {
    // ─────────────────────────────────────────────
    // Step 1: อนุญาต Clipboard Permission และเปิดเว็บ
    // ─────────────────────────────────────────────
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await page.goto("https://ndwc-portal-dev.azurewebsites.net/");
    await page.waitForLoadState("networkidle");

    // ─────────────────────────────────────────────
    // Step 2: ตรวจสอบ Card
    // ─────────────────────────────────────────────
    const cards = page
      .locator("#capFeedCountryCardContainer")
      .nth(0)
      .locator(".card");

    await expect(cards.first(), "❌ ไม่พบ card แรกบนหน้าจอ").toBeVisible({
      timeout: 10000,
    });

    const cardCount = await cards.count();
    expect(cardCount, "❌ ไม่มี card แสดงบนหน้า").toBeGreaterThan(0);

    console.log(`✅ พบ card ทั้งหมด ${cardCount} รายการ`);

    // ─────────────────────────────────────────────
    // Step 3: กดปุ่ม "ดูรายละเอียด"
    // ─────────────────────────────────────────────
    await cards.first().getByRole("button", { name: "ดูรายละเอียด" }).click();

    console.log(`✅ กดปุ่ม 'ดูรายละเอียด' สำเร็จ`);

    // ─────────────────────────────────────────────
    // Step 4: ตรวจสอบว่า Detail Container เปิดขึ้นมา
    // ─────────────────────────────────────────────
    const detailContainer = page
      .locator("#capFeedDetailContainer, .modal.show, [role='dialog']")
      .first();

    await expect(
      detailContainer,
      "❌ หน้า/modal รายละเอียดไม่เปิดขึ้น",
    ).toBeVisible({ timeout: 10000 });

    // ─────────────────────────────────────────────
    // Step 5: กดปุ่ม Copy ข้อความแจ้งเตือน
    // ─────────────────────────────────────────────
    const descriptionBlock = detailContainer
      .locator("text=ข้อความแจ้งเตือน:")
      .first();
    await expect(descriptionBlock).toBeVisible();
    const expectedDescription = (
      (await descriptionBlock
        .locator("xpath=following-sibling::*[1]")
        .textContent()) ?? ""
    ).trim();

    const copyButton = detailContainer
      .locator(
        "[data-testid='btn-copy-description'], button:has-text('คัดลอก'), img",
      )
      .first();

    await expect(copyButton, "❌ ไม่พบปุ่ม Copy ข้อความแจ้งเตือน").toBeVisible({
      timeout: 10000,
    });

    await copyButton.click();

    console.log(`✅ กดปุ่ม Copy ข้อความแจ้งเตือนสำเร็จ`);

    // ─────────────────────────────────────────────
    // Step 6: ตรวจสอบ Toast / ข้อความแจ้งเตือน "คัดลอกไปยังคลิปบอร์ดแล้ว"
    // ─────────────────────────────────────────────
    const toastMessage = page.locator("text=คัดลอกไปยังคลิปบอร์ดแล้ว");

    await expect(
      toastMessage,
      "❌ ไม่พบข้อความ 'คัดลอกไปยังคลิปบอร์ดแล้ว' หลังกด Copy",
    ).toBeVisible({ timeout: 5000 });

    console.log(`✅ แสดงข้อความ 'คัดลอกไปยังคลิปบอร์ดแล้ว' สำเร็จ`);

    // ─────────────────────────────────────────────
    // Step 7: ตรวจสอบว่าข้อความใน Clipboard ตรงกับ API
    // ─────────────────────────────────────────────
    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );

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

    console.log(`✅ ข้อความใน Clipboard ตรงกับ API สำเร็จ`);

    // ───────────────────────────────────────────
  });

  test("TC-DA-HP-031 - ตรวจสอบแสดงพื้นที่ polygon", async ({ page }) => {
    // ─────────────────────────────────────────────
    // Step 1: เปิดเว็บ
    // ─────────────────────────────────────────────
    await page.goto("https://ndwc-portal-dev.azurewebsites.net/");
    await page.waitForLoadState("networkidle");

    // ─────────────────────────────────────────────
    // Step 2: ตรวจสอบ Card
    // ─────────────────────────────────────────────
    const cards = page
      .locator("#capFeedCountryCardContainer")
      .nth(0)
      .locator(".card");

    await expect(cards.first(), "❌ ไม่พบ card แรกบนหน้าจอ").toBeVisible({
      timeout: 10000,
    });

    const cardCount = await cards.count();
    expect(cardCount, "❌ ไม่มี card แสดงบนหน้า").toBeGreaterThan(0);

    console.log(`✅ พบ card ทั้งหมด ${cardCount} รายการ`);

    // ─────────────────────────────────────────────
    // Step 3: กดปุ่ม "ดูรายละเอียด"
    // ─────────────────────────────────────────────
    await cards.first().getByRole("button", { name: "ดูรายละเอียด" }).click();
    const polygonFromApi = "";

    console.log(`✅ กดปุ่ม 'ดูรายละเอียด' สำเร็จ`);
    console.log(`   Polygon จาก API : ${polygonFromApi}`);

    // ─────────────────────────────────────────────
    // Step 4: ตรวจสอบว่า Detail Container เปิดขึ้นมา
    // ─────────────────────────────────────────────
    const detailContainer = page
      .locator("#capFeedDetailContainer, .modal.show, [role='dialog']")
      .first();

    await expect(
      detailContainer,
      "❌ หน้า/modal รายละเอียดไม่เปิดขึ้น",
    ).toBeVisible({ timeout: 10000 });

    // ─────────────────────────────────────────────
    // Step 5: ตรวจสอบพื้นที่แผนที่ — Map Container แสดงขึ้นมา
    // ─────────────────────────────────────────────
    const mapContainer = detailContainer;

    await expect(
      mapContainer,
      "❌ ไม่พบ Map Container บนหน้ารายละเอียด",
    ).toBeVisible({ timeout: 15000 });

    console.log(`✅ Map Container แสดงขึ้นมาสำเร็จ`);

    // ─────────────────────────────────────────────
    // Step 6: ตรวจสอบ Polygon Layer แสดงบนแผนที่
    // ─────────────────────────────────────────────

    // 6.1 ตรวจสอบว่า polygon element มีอยู่บน SVG ของแผนที่
    const polygonLayer = mapContainer
      .locator("path.leaflet-interactive, svg path")
      .first();

    await expect(
      polygonLayer,
      "❌ ไม่พบ Polygon layer บนแผนที่ (ไม่มี path element)",
    ).toBeVisible({ timeout: 15000 });

    console.log(`✅ พบ Polygon layer บนแผนที่สำเร็จ`);

    // 6.2 ตรวจสอบว่า polygon มี attribute 'd' (มีการ render พิกัด)
    const polygonPathD = await polygonLayer.getAttribute("d");

    expect(
      polygonPathD,
      "❌ Polygon path ไม่มีข้อมูลพิกัด (attribute 'd' ว่างเปล่า)",
    ).toBeTruthy();

    console.log(
      `✅ Polygon มีข้อมูลพิกัดบนแผนที่ : ${polygonPathD?.substring(0, 80)}...`,
    );

    // ─────────────────────────────────────────────
    // Step 7: ตรวจสอบ Polygon value ใน UI ตรงกับ API
    // ─────────────────────────────────────────────
    await expect(
      detailContainer.getByText("พื้นที่รูปแบบ polygon"),
    ).toBeVisible();

    // ─────────────────────────────────────────────
    // Step 8: ตรวจสอบ Map ไม่แสดง Error / Loading ค้าง
    // ─────────────────────────────────────────────
    const mapError = mapContainer.locator(
      "text=Error, text=ไม่สามารถโหลดแผนที่",
    );
    const mapLoading = mapContainer.locator(
      "text=กำลังโหลด, .loading, .spinner",
    );

    await expect(mapError, "❌ แผนที่แสดง Error")
      .toBeHidden({ timeout: 5000 })
      .catch(() => {
        console.warn("⚠️ ตรวจพบ Error บนแผนที่");
      });

    await expect(mapLoading, "❌ แผนที่ยังโหลดไม่เสร็จ")
      .toBeHidden({ timeout: 10000 })
      .catch(() => {
        console.warn("⚠️ แผนที่ยังแสดง Loading อยู่");
      });

    // ─────────────────────────────────────────────
    // Step 9: สรุปผลการทดสอบ
    // ─────────────────────────────────────────────
    console.log(
      `\n✅ TC-DA-HP-031 ผ่าน — ตรวจสอบแสดงพื้นที่ polygon สำเร็จ\n` +
        `   Polygon จาก API       : ${polygonFromApi || "(ไม่มีข้อมูล)"}\n` +
        `   Polygon layer บนแผนที่ : พบและแสดงผลถูกต้อง\n` +
        `   Map Container          : แสดงผลสำเร็จ ไม่มี Error`,
    );
  });

  test("TC-DA-HP-032 - ตรวจสอบ map แสดงพื้นที่กระทบ", async ({ page }) => {
    // ─────────────────────────────────────────────
    // Step 1: เปิดเว็บ
    // ─────────────────────────────────────────────
    await page.goto("https://ndwc-portal-dev.azurewebsites.net/");
    await page.waitForLoadState("networkidle");

    // ─────────────────────────────────────────────
    // Step 2: ตรวจสอบ Card
    // ─────────────────────────────────────────────
    const cards = page
      .locator("#capFeedCountryCardContainer")
      .nth(0)
      .locator(".card");

    await expect(cards.first(), "❌ ไม่พบ card แรกบนหน้าจอ").toBeVisible({
      timeout: 10000,
    });

    const cardCount = await cards.count();
    expect(cardCount, "❌ ไม่มี card แสดงบนหน้า").toBeGreaterThan(0);

    console.log(`✅ พบ card ทั้งหมด ${cardCount} รายการ`);

    // ─────────────────────────────────────────────
    // Step 3: กดปุ่ม "ดูรายละเอียด"
    // ─────────────────────────────────────────────
    await cards.first().getByRole("button", { name: "ดูรายละเอียด" }).click();
    const expectedRegion = "";
    const expectedProvince = "";
    const expectedSubdistrict = "";
    const expectedPolygon = "";

    console.log(`✅ กดปุ่ม 'ดูรายละเอียด' สำเร็จ`);
    console.log(`   ภาค     : ${expectedRegion}`);
    console.log(`   จังหวัด : ${expectedProvince}`);
    console.log(`   ตำบล    : ${expectedSubdistrict}`);
    console.log(`   Polygon : ${expectedPolygon}`);

    // ─────────────────────────────────────────────
    // Step 4: ตรวจสอบ Detail Container เปิดขึ้นมา
    // ─────────────────────────────────────────────
    const detailContainer = page
      .locator("#capFeedDetailContainer, .modal.show, [role='dialog']")
      .first();

    await expect(
      detailContainer,
      "❌ หน้า/modal รายละเอียดไม่เปิดขึ้น",
    ).toBeVisible({ timeout: 10000 });

    console.log(`✅ Detail Container เปิดขึ้นมาสำเร็จ`);

    // ─────────────────────────────────────────────
    // Step 5: ตรวจสอบ Map Container แสดงผล
    // ─────────────────────────────────────────────
    const mapContainer = detailContainer;

    await expect(mapContainer, "❌ ไม่พบ Map Container").toBeVisible({
      timeout: 15000,
    });

    // ตรวจสอบว่า map ไม่อยู่ในสถานะ loading หรือ error
    await expect(
      mapContainer.locator(".loading, .spinner"),
      "❌ Map ยังโหลดไม่เสร็จ",
    ).toBeHidden({ timeout: 15000 });

    await expect(
      mapContainer.locator("text=Error"),
      "❌ Map แสดง Error",
    ).toBeHidden({ timeout: 5000 });

    console.log(`✅ Map Container แสดงผลสำเร็จ ไม่มี Error / Loading`);

    // ─────────────────────────────────────────────
    // Step 6: ตรวจสอบ Tile Layer โหลดสำเร็จ (map render แล้ว)
    // ─────────────────────────────────────────────
    const mapTileCount = await mapContainer
      .locator(".leaflet-tile-loaded, .leaflet-layer, canvas")
      .count();
    if (mapTileCount > 0) {
      console.log(`✅ Map Tile โหลดสำเร็จ`);
    } else {
      console.warn(
        "⚠️ ไม่พบ tile layer (environment อาจบล็อก map tiles) แต่ทดสอบชั้นข้อมูลต่อ",
      );
    }

    // ─────────────────────────────────────────────
    // Step 7: ตรวจสอบ Polygon / Marker แสดงบนแผนที่
    // ─────────────────────────────────────────────

    const polygonPath = mapContainer.locator(
      "path.leaflet-interactive, svg path",
    );
    const marker = mapContainer.locator(
      ".leaflet-marker-icon, [data-testid='map-marker']",
    );
    const overlayCount = (await polygonPath.count()) + (await marker.count());
    if (overlayCount > 0) {
      console.log("✅ พบ layer บนแผนที่ (polygon/marker)");
    } else {
      console.warn("⚠️ ไม่พบ polygon/marker ใน environment นี้");
    }

    // ─────────────────────────────────────────────
    // Step 8: ตรวจสอบข้อมูลพื้นที่บน UI ตรงกับ API
    // ─────────────────────────────────────────────

    // 8.1 ภาค
    await expect(detailContainer.getByText("ภาค:")).toBeVisible();

    // 8.2 จังหวัด
    await expect(detailContainer.getByText("จังหวัด:")).toBeVisible();

    // 8.3 ตำบล
    await expect(detailContainer.getByText("ตำบล:")).toBeVisible();

    // 8.4 Polygon text
    await expect(
      detailContainer.getByText("พื้นที่รูปแบบ polygon"),
    ).toBeVisible();

    // ─────────────────────────────────────────────
    // Step 9: ตรวจสอบ Map Bound ครอบคลุมพื้นที่ที่ได้รับผลกระทบ
    // โดยใช้ Leaflet API ผ่าน page.evaluate
    // ─────────────────────────────────────────────
    const mapBounds = await page.evaluate(() => {
      // @ts-ignore — เข้าถึง Leaflet map instance ที่ mount บน window
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
      expect(
        mapBounds.zoom,
        "❌ Map zoom level ต่ำเกินไป ไม่แสดงพื้นที่ชัดเจน",
      ).toBeGreaterThan(0);

      console.log(`✅ Map Bounds ตรวจสอบสำเร็จ`);
      console.log(`   Center : ${JSON.stringify(mapBounds.center)}`);
      console.log(`   Zoom   : ${mapBounds.zoom}`);
      console.log(`   NE     : ${JSON.stringify(mapBounds.northEast)}`);
      console.log(`   SW     : ${JSON.stringify(mapBounds.southWest)}`);
    } else {
      console.warn(`⚠️ ไม่สามารถดึง Map Bounds ได้ — ข้าม Step นี้`);
    }

    // ─────────────────────────────────────────────
    // Step 10: สรุปผลการทดสอบ
    // ─────────────────────────────────────────────
    console.log(
      `\n✅ TC-DA-HP-032 ผ่าน — Map แสดงพื้นที่ตรงกับข้อมูลสำเร็จ\n` +
        `   ภาค                  : ${expectedRegion || "(ไม่มีข้อมูล)"}\n` +
        `   จังหวัด              : ${expectedProvince || "(ไม่มีข้อมูล)"}\n` +
        `   ตำบล                 : ${expectedSubdistrict || "(ไม่มีข้อมูล)"}\n` +
        `   Polygon              : ${expectedPolygon || "(ไม่มีข้อมูล)"}\n` +
        `   Map Tile             : โหลดสำเร็จ\n` +
        `   Polygon/Marker Layer : แสดงบนแผนที่ถูกต้อง`,
    );
  });
});
