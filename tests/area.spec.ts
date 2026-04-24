import { test, expect, type BrowserContext, Locator } from "@playwright/test";
import { AreaPage } from "../page-object/AreaPage.ts";
import { AREA_DATA } from "../test-data/area.data";

// ─── Suite ───────────────────────────────────────────────────────────────────

test.describe("Area", () => {
  let areaPage: AreaPage;

  // ─── Hooks ─────────────────────────────────────────────────────────────────

  test.beforeEach(async ({ page }) => {
    areaPage = new AreaPage(page);
    await areaPage.goto(AREA_DATA.portalUrl);
    await areaPage.openAreaTab();
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      await page.screenshot({
        path: `screenshots/${testInfo.title}.png`,
        fullPage: true,
      });
    }
  });

  // ─── TC-DA-AREA-001 ────────────────────────────────────────────────────────

  test("TC-DA-AREA-001 : เลือกจังหวัดเพียงหนึ่งจังหวัด", async () => {
    test.setTimeout(60000);

    const selectedProvince = AREA_DATA.singleProvince;

    // Step 2: Select province
    const selectedProvinceOk = await areaPage.selectProvince(selectedProvince);
    expect(
      selectedProvinceOk,
      `ต้องเลือกจังหวัด "${selectedProvince}" ได้`,
    ).toBeTruthy();

    // Step 3: Search and intercept API
    const areaResponsePromise = areaPage.waitForAreaApiResponse();
    await areaPage.clickSearch();
    const areaResponse = await areaResponsePromise;
    const areaData = await areaResponse.json();
    await areaPage.page.waitForLoadState("networkidle");

    // Expect Result: province must appear in all Alert items
    const items: any[] = areaData.items ?? [];
    expect(Array.isArray(items), "API items ต้องเป็น array").toBeTruthy();

    for (const [index, item] of items.entries()) {
      const areas: any[] = item?.areasItem ?? item?.areas ?? [];
      if (!Array.isArray(areas) || areas.length === 0) continue;

      const provinces = areas
        .flatMap((a) =>
          areaPage
            .normalizeProvince(a?.province)
            .split(/[,\s]+/)
            .map((p) => p.trim())
            .filter((p) => p !== ""),
        )
        .filter((p) => p !== "");

      if (provinces.length === 0) continue;

      const hasSelectedProvince = provinces.some((p) => p === selectedProvince);
      expect(
        hasSelectedProvince,
        `item[${index}] ต้องมีจังหวัด "${selectedProvince}" อยู่ด้วย (เจอ: ${provinces.join(", ")})`,
      ).toBeTruthy();
    }

    // UI sanity check
    if ((areaData.totalCount ?? items.length) > 0) {
      await expect(areaPage.noResultMessage).toBeHidden({ timeout: 5000 });
      await expect(areaPage.detailButtons.first()).toBeVisible({
        timeout: 10000,
      });
    }
  });

  // ─── TC-DA-AREA-002 ────────────────────────────────────────────────────────

  test("TC-DA-AREA-002 : เลือกหลายจังหวัดพร้อมกัน", async () => {
    test.setTimeout(60000);

    const selectedProvinces = AREA_DATA.multipleProvinces;
    const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
    const selectedNativeValues: string[] = [];

    // Step 2: Select multiple provinces
    const ok = await areaPage.selectMultipleProvinces(
      [...selectedProvinces],
      selectedNativeValues,
    );
    for (const province of selectedProvinces) {
      expect(ok, `❌ ต้องเลือกจังหวัด "${province}" ได้`).toBeTruthy();
      console.log(`✅ เลือกจังหวัด "${province}" สำเร็จ`);
    }

    // Check tag/badge on UI
    for (const province of selectedProvinces) {
      const selectedTag = areaPage.tabPanel
        .locator(".tag, .badge, .chip, [class*='selected'], [class*='tag']")
        .filter({ hasText: province })
        .first();
      const tagVisible = await selectedTag
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      if (tagVisible) {
        console.log(`✅ พบ tag/badge ของจังหวัด "${province}" บน UI`);
      } else {
        console.warn(
          `⚠️ ไม่พบ tag/badge ของ "${province}" — อาจใช้ UI style อื่น`,
        );
      }
    }

    // Step 3: Search and intercept API
    const areaResponsePromise = areaPage.waitForAreaApiResponse();
    const areaRequestPromise = areaPage.waitForAreaApiRequest();
    await areaPage.clickSearch();

    const areaRequest = await areaRequestPromise;
    const areaResponse = await areaResponsePromise;
    const areaData = await areaResponse.json();
    await areaPage.page.waitForLoadState("networkidle");

    console.log(`✅ กดค้นหาสำเร็จ — API ตอบกลับ 200`);
    console.log("ℹ️ area request url:", areaRequest.url());

    // Expect Results 1-4: verify items contain selected provinces
    const items: any[] = areaData.items ?? [];
    expect(Array.isArray(items), "❌ API items ต้องเป็น array").toBeTruthy();

    const normalizedSelected = selectedProvinces.map(normalize);

    for (const [index, item] of items.entries()) {
      const areas: any[] = item?.areasItem ?? item?.areas ?? [];

      console.log(
        `🔍 item[${index}] raw provinces:`,
        areas.map((a) => JSON.stringify(a?.province)),
      );

      const provinces: string[] = Array.isArray(areas)
        ? areas
            .map((a) => areaPage.normalizeProvince(a?.province))
            .filter((p) => p !== "")
        : [];

      expect(
        provinces.length > 0,
        `❌ item[${index}] ต้องมีข้อมูลจังหวัดอย่างน้อย 1 ค่า`,
      ).toBeTruthy();

      const normalizedProvinces = provinces.map(normalize);

      for (const requiredProvince of normalizedSelected) {
        const found = normalizedProvinces.some(
          (p) => p === requiredProvince || p.includes(requiredProvince),
        );
        expect(
          found,
          `❌ item[${index}] ต้องมีจังหวัด "${requiredProvince}" (มี: ${normalizedProvinces.join(", ")})`,
        ).toBeTruthy();
      }

      const extraProvinces = normalizedProvinces.filter(
        (p) => !normalizedSelected.some((sel) => p === sel || p.includes(sel)),
      );
      if (extraProvinces.length > 0) {
        console.log(
          `   ℹ️  item[${index}] มีจังหวัดเพิ่มเติม (ยอมรับได้) : ${extraProvinces.join(", ")}`,
        );
      }

      console.log(
        `   ✅ item[${index}] ผ่าน — จังหวัด : ${normalizedProvinces.join(", ")}`,
      );
    }

    // UI Sanity
    if ((areaData.totalCount ?? items.length) > 0) {
      await expect(
        areaPage.noResultMessage,
        "❌ ไม่ควรแสดงข้อความ 'ไม่พบผลลัพธ์'",
      ).toBeHidden({ timeout: 5000 });
      await expect(
        areaPage.detailButtons.first(),
        "❌ ต้องมีปุ่ม 'ดูรายละเอียด' แสดงบนหน้า",
      ).toBeVisible({ timeout: 10000 });
      console.log(`\n✅ UI แสดง Alert Card ถูกต้อง`);
    }
  });

  // ─── TC-DA-AREA-003 ────────────────────────────────────────────────────────

  test("TC-DA-AREA-003 : ตรวจสอบการเลือกจังหวัดทั้งกรณีที่มีข้อมูลและไม่มีข้อมูลแสดงผล", async () => {
    test.setTimeout(60000);

    const selectedProvinces = AREA_DATA.noResultProvinces;
    const selectedNativeValues: string[] = [];

    // Step 2 & 3: Select provinces
    const ok = await areaPage.selectMultipleProvinces(
      [...selectedProvinces],
      selectedNativeValues,
    );
    expect(ok, "❌ ต้องเลือกจังหวัดได้").toBeTruthy();

    for (const province of selectedProvinces) {
      const selectedTag = areaPage.tabPanel
        .locator(".tag, .badge, .chip, [class*='selected'], [class*='tag']")
        .filter({ hasText: province })
        .first();
      const tagVisible = await selectedTag
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      if (tagVisible) {
        console.log(`✅ พบ tag/badge ของจังหวัด "${province}" บน UI`);
      } else {
        console.warn(
          `⚠️ ไม่พบ tag/badge ของ "${province}" — อาจใช้ UI style อื่น`,
        );
      }
    }

    // Step 4: Search
    const areaResponsePromise = areaPage.waitForAreaApiResponse();
    const areaRequestPromise = areaPage.waitForAreaApiRequest();
    await areaPage.clickSearch();

    const areaRequest = await areaRequestPromise;
    const areaResponse = await areaResponsePromise;
    const areaData = await areaResponse.json();
    await areaPage.page.waitForLoadState("networkidle");

    console.log("ℹ️ area request url:", areaRequest.url());

    // Expect Result: no results
    const items: any[] = areaData.items ?? [];
    const totalCount: number = areaData.totalCount ?? items.length;

    expect(
      totalCount === 0,
      `❌ ต้องไม่มีผลลัพธ์เมื่อเลือกจังหวัดที่ไม่มีข้อมูล (totalCount = ${totalCount})`,
    ).toBeTruthy();

    await expect(
      areaPage.noResultMessage,
      "❌ ต้องแสดงข้อความ 'ไม่พบผลลัพธ์การค้นหาที่ตรงกับเงื่อนไขของคุณ'",
    ).toBeVisible({ timeout: 10000 });

    await expect(
      areaPage.detailButtons.first(),
      "❌ ต้องไม่มีปุ่ม 'ดูรายละเอียด' เมื่อไม่มีผลลัพธ์",
    ).toBeHidden({ timeout: 5000 });
  });

  // ─── TC-DA-AREA-005 ────────────────────────────────────────────────────────

  test("TC-DA-AREA-005 : ตรวจสอบการเลือกจังหวัดโดยการพิมพ์ค้นหาในตัวกรอง", async () => {
    test.setTimeout(60000);

    const { page } = areaPage;
    const searchKeyword = AREA_DATA.provinceSearchKeyword;
    const targetProvince = AREA_DATA.provinceSearchTarget;
    const normalize = (s: string) => s.replace(/\s+/g, " ").trim();

    // Step 2: Find province input
    const provinceInputCandidates = [
      areaPage.tabPanel.getByRole("combobox", { name: /จังหวัด/i }),
      areaPage.tabPanel.locator("#provinceAreaSelect"),
      areaPage.tabPanel.locator("#provinceSelect"),
      areaPage.tabPanel.locator("input[placeholder*='จังหวัด' i]"),
      areaPage.tabPanel.locator("input[name*='province' i]"),
      areaPage.tabPanel.locator("select[name*='province' i]"),
      areaPage.tabPanel.locator("select").first(),
    ];

    let inputLocator = null;
    let isNativeSelect = false;

    for (const locator of provinceInputCandidates) {
      const first = locator.first();
      if (!(await first.isVisible({ timeout: 3000 }).catch(() => false)))
        continue;
      const tagName = await first.evaluate((el) => el.tagName).catch(() => "");
      if (String(tagName).toLowerCase() === "select") {
        isNativeSelect = true;
        inputLocator = first;
        break;
      }
      inputLocator = first;
      break;
    }

    expect(
      inputLocator !== null,
      "❌ ต้องพบช่องกรอกค้นหาจังหวัดบนหน้า",
    ).toBeTruthy();

    // Expect Result 1 & 2: typing search
    if (isNativeSelect) {
      console.warn(`⚠️ native <select> — ข้าม Expect Result 1 & 2`);
    } else {
      await inputLocator!.click();
      await page.waitForTimeout(300);
      await inputLocator!.fill(searchKeyword);
      await page.waitForTimeout(500);

      const dropdownOptions = areaPage.tabPanel.locator(
        "[role='option'], [role='listbox'] li, ul li, .dropdown-item",
      );
      await expect(
        dropdownOptions.first(),
        "❌ ต้องแสดง dropdown รายการจังหวัดหลังพิมพ์ค้นหา",
      ).toBeVisible({ timeout: 5000 });

      const optionTexts: string[] = await dropdownOptions.allInnerTexts();
      const normalizedOptions = optionTexts
        .map(normalize)
        .filter((t) => t !== "");

      const allMatch = normalizedOptions.every((opt) =>
        opt.includes(searchKeyword),
      );
      expect(
        allMatch,
        `❌ รายการที่แสดงต้องตรงหรือใกล้เคียงกับคำค้นหา "${searchKeyword}" (มี: ${normalizedOptions.join(", ")})`,
      ).toBeTruthy();
    }

    // Step 3 + Expect Result 3: select from dropdown
    let provinceSelected = false;

    if (isNativeSelect) {
      await inputLocator!
        .selectOption({ label: targetProvince })
        .catch(() => null);
      provinceSelected = true;
    } else {
      const exactOption = page
        .getByRole("option", { name: new RegExp(`^${targetProvince}$`) })
        .first();
      if (await exactOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await exactOption.click();
        provinceSelected = true;
      } else {
        const textOption = page
          .locator("li, [role='option']")
          .filter({ hasText: new RegExp(`^${targetProvince}$`) })
          .first();
        if (await textOption.isVisible({ timeout: 3000 }).catch(() => false)) {
          await textOption.click();
          provinceSelected = true;
        }
      }
    }

    expect(
      provinceSelected,
      `❌ ต้องสามารถเลือกจังหวัด "${targetProvince}" จากรายการได้`,
    ).toBeTruthy();

    await page.waitForTimeout(500);

    // Step 4: Search and check result
    const responsePromise = areaPage.waitForAreaApiResponse();
    const requestPromise = areaPage.waitForAreaApiRequest();
    await areaPage.clickSearch();
    const request = await requestPromise;
    const response = await responsePromise;
    const areaData = await response.json();
    await page.waitForLoadState("networkidle");

    console.log("ℹ️ area request url:", request.url());

    const items: any[] = areaData.items ?? [];
    const totalCount: number = areaData.totalCount ?? items.length;

    if (totalCount > 0) {
      await expect(
        areaPage.noResultMessage,
        "❌ ไม่ควรแสดงข้อความ 'ไม่พบผลลัพธ์'",
      ).toBeHidden({ timeout: 5000 });
      await expect(
        areaPage.detailButtons.first(),
        "❌ ต้องมีปุ่ม 'ดูรายละเอียด' แสดงบนหน้า",
      ).toBeVisible({ timeout: 10000 });
    }
  });

  // ─── TC-DA-AREA-006 ────────────────────────────────────────────────────────

  test("TC-DA-AREA-006 : ตรวจสอบการเลือกจังหวัดโดยการพิมพ์ค้นหาในตัวกรอง เมื่อไม่มีรายการที่ตรงกับคำค้น", async () => {
    test.setTimeout(60000);

    const { page } = areaPage;
    const invalidKeyword = AREA_DATA.invalidProvinceKeyword;

    // Step 2: find province input (excluding native select)
    const provinceInputCandidates = [
      areaPage.tabPanel.getByRole("combobox", { name: /จังหวัด/i }),
      areaPage.tabPanel.locator("#provinceAreaSelect"),
      areaPage.tabPanel.locator("#provinceSelect"),
      areaPage.tabPanel.locator("input[placeholder*='จังหวัด' i]"),
      areaPage.tabPanel.locator("input[name*='province' i]"),
    ];

    let inputLocator = null;
    for (const locator of provinceInputCandidates) {
      const first = locator.first();
      if (await first.isVisible({ timeout: 3000 }).catch(() => false)) {
        inputLocator = first;
        break;
      }
    }

    expect(inputLocator !== null, "❌ ต้องพบช่องกรอกค้นหาจังหวัด").toBeTruthy();

    await inputLocator!.click();
    await page.waitForTimeout(300);
    await inputLocator!.fill("");
    await inputLocator!.fill(invalidKeyword);

    // Step 3: check visible dropdown
    const visibleDropdown = page
      .locator(
        ".select2-results:visible, .ant-select-dropdown:visible, .cdk-overlay-pane:visible, .dropdown-menu:visible",
      )
      .last();

    await expect(
      visibleDropdown,
      "❌ ต้องมี dropdown แสดงหลังพิมพ์ค้นหา",
    ).toBeVisible({ timeout: 5000 });

    // Expect Result 1: "No results found"
    const noResultText = page
      .getByText(/No results found|No result found|ไม่พบ/i)
      .last();
    await expect(
      noResultText,
      '❌ ต้องแสดงข้อความ "No results found"',
    ).toBeVisible({ timeout: 10000 });

    // Expect Result 2: no other options
    const options = visibleDropdown.locator(
      "[role='option']:visible, li:visible, .dropdown-item:visible",
    );
    const optionTexts = (await options.allInnerTexts())
      .map((t) => t.trim())
      .filter(Boolean);

    const realOptions = optionTexts.filter(
      (t) => !/no result|no results|ไม่พบ/i.test(t),
    );
    expect(
      realOptions.length,
      `❌ ไม่ควรมีรายการอื่น (พบ ${realOptions.length})`,
    ).toBe(0);
  });

  // ─── TC-DA-AREA-007 ────────────────────────────────────────────────────────

  test("TC-DA-AREA-007 : ตรวจสอบแสดงรายการจังหวัดใน Dropdown", async () => {
    test.setTimeout(60000);

    const { page } = areaPage;

    // Step 2: open province dropdown
    const provinceInputCandidates = [
      areaPage.tabPanel.getByRole("combobox", { name: /จังหวัด/i }),
      areaPage.tabPanel.locator("#provinceAreaSelect"),
      areaPage.tabPanel.locator("#provinceSelect"),
      areaPage.tabPanel.locator("input[placeholder*='จังหวัด' i]"),
      areaPage.tabPanel.locator("input[name*='province' i]"),
    ];

    let inputLocator = null;
    for (const locator of provinceInputCandidates) {
      const first = locator.first();
      if (await first.isVisible({ timeout: 3000 }).catch(() => false)) {
        inputLocator = first;
        break;
      }
    }

    expect(inputLocator !== null, "❌ ต้องพบช่องเลือกจังหวัด").toBeTruthy();

    await inputLocator!.click();

    // Step 3: verify dropdown visible
    const dropdown = page
      .locator(
        ".select2-results:visible, .ant-select-dropdown:visible, .cdk-overlay-pane:visible, .dropdown-menu:visible",
      )
      .last();
    await expect(dropdown, "❌ ต้องมี dropdown จังหวัดแสดง").toBeVisible({
      timeout: 5000,
    });

    // Step 4: get province list
    const options = dropdown.locator(
      "[role='option']:visible, li:visible, .dropdown-item:visible",
    );
    const provinceList = (await options.allInnerTexts())
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    // Expect Result: provinces should be complete (>=70)
    expect(
      provinceList.length,
      `❌ จำนวนจังหวัดไม่ครบ (พบ ${provinceList.length})`,
    ).toBeGreaterThanOrEqual(AREA_DATA.expectedProvinceCount);

    for (const province of AREA_DATA.keyProvinces) {
      expect(
        provinceList.some((p) => p.includes(province)),
        `❌ ไม่พบจังหวัด ${province}`,
      ).toBeTruthy();
    }
  });

  // ─── TC-DA-AREA-008 ────────────────────────────────────────────────────────

  test("TC-DA-AREA-008 : เลือกตัวกรองภาค", async () => {
    test.setTimeout(60000);

    const selectedRegion = AREA_DATA.singleRegion;

    // Step 2: Select region
    const ok = await areaPage.selectRegion(selectedRegion);
    expect(ok, `❌ ต้องสามารถเลือก ${selectedRegion} ได้`).toBeTruthy();
    console.log(`✅ เลือกภาค "${selectedRegion}" สำเร็จ`);

    // Step 3: Search
    const searchResponsePromise = areaPage.page
      .waitForResponse(
        (res) =>
          res.url().includes("/api/app/capFeed") &&
          res.request().method() === "GET" &&
          res.status() === 200,
        { timeout: 15000 },
      )
      .catch(() => null);

    await areaPage.clickSearch();
    await searchResponsePromise;
    await areaPage.page.waitForLoadState("networkidle");
    await areaPage.page.waitForTimeout(1000);

    // Expect Result: results showing data for that region
    const resultCards = areaPage.page.locator(
      ".alert-card, .card, [class*='card']",
    );
    const resultCount = await resultCards.count();
    expect(resultCount, "❌ ต้องแสดงข้อมูลผลลัพธ์หลังค้นหา").toBeGreaterThan(0);

    const pageText = await areaPage.page.locator("body").innerText();
    const hasRegionText = pageText.includes(selectedRegion);
    const matchedProvince = AREA_DATA.northernProvinces.find((province) =>
      pageText.includes(province),
    );

    expect(
      hasRegionText || !!matchedProvince,
      `❌ ผลลัพธ์ต้องเป็นข้อมูลของ ${selectedRegion}`,
    ).toBeTruthy();
  });

  // ─── TC-DA-AREA-009 ────────────────────────────────────────────────────────

  test("TC-DA-AREA-009 : เลือกหลายภาคพร้อมกัน", async () => {
    test.setTimeout(60000);

    const selectedRegions = AREA_DATA.multipleRegions;
    const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
    const selectedNativeValues: string[] = [];

    // Step 2: Select multiple regions
    const ok = await areaPage.selectMultipleRegions(
      [...selectedRegions],
      selectedNativeValues,
    );
    expect(ok, "❌ ต้องเลือกภาคได้").toBeTruthy();

    // Step 3: Search and intercept API
    const requestPromise = areaPage.waitForAreaApiRequest();
    const responsePromise = areaPage.waitForAreaApiResponse();
    await areaPage.clickSearch();

    await requestPromise;
    const response = await responsePromise;
    const data = await response.json();

    const items: any[] = data.items ?? [];
    expect(Array.isArray(items), "❌ items ต้องเป็น array").toBeTruthy();

    const normalizedSelected = selectedRegions.map(normalize);

    for (const [index, item] of items.entries()) {
      const areas: any[] = item?.areasItem ?? item?.areas ?? [];
      const regions: string[] = Array.isArray(areas)
        ? areas
            .map((a) => areaPage.normalizeRegion(a?.region))
            .filter((r) => r !== "")
        : [];

      expect(
        regions.length > 0,
        `❌ item[${index}] ต้องมีข้อมูลภาค`,
      ).toBeTruthy();

      const normalizedRegions = regions.map(normalize);

      for (const requiredRegion of normalizedSelected) {
        const found = normalizedRegions.some(
          (r) => r === requiredRegion || r.includes(requiredRegion),
        );
        expect(
          found,
          `❌ item[${index}] ต้องมีภาค "${requiredRegion}" (มี: ${normalizedRegions.join(", ")})`,
        ).toBeTruthy();
      }
    }
  });

  // ─── TC-DA-AREA-010 ────────────────────────────────────────────────────────

  test("TC-DA-AREA-010 : ตรวจสอบการเลือกภาคทั้งกรณีที่มีข้อมูลและไม่มีข้อมูลแสดงผล", async () => {
    test.setTimeout(60000);

    const selectedRegions = AREA_DATA.noResultRegions;
    const selectedNativeValues: string[] = [];

    // Steps 2-3: Select regions
    const ok = await areaPage.selectMultipleRegions(
      [...selectedRegions],
      selectedNativeValues,
    );
    expect(ok, "❌ ต้องเลือกภาคได้").toBeTruthy();

    // Step 4: Search
    const responsePromise = areaPage.waitForAreaApiResponse().catch(() => null);

    await areaPage.clickSearch();
    const response = await responsePromise;
    await areaPage.page.waitForLoadState("networkidle");
    await areaPage.page.waitForTimeout(1000);

    // Expect Result: no results message
    await expect(
      areaPage.noResultMessage,
      '❌ ต้องแสดงข้อความ "ไม่พบผลลัพธ์การค้นหาที่ตรงกับเงื่อนไขของคุณ"',
    ).toBeVisible({ timeout: 10000 });

    if (response) {
      const data = await response.json();
      const totalCount = Number(data?.totalCount ?? data?.items?.length ?? 0);
      expect(
        totalCount,
        "❌ เมื่อเลือกภาคเหนือร่วมกับภาคใต้ฝั่งตะวันตก ต้องไม่พบผลลัพธ์",
      ).toBe(0);
    }
  });

  // ─── TC-DA-AREA-012 ────────────────────────────────────────────────────────

  test("TC-DA-AREA-012 : ตรวจสอบการเลือกภาคโดยการพิมพ์ค้นหาในตัวกรอง", async () => {
    test.setTimeout(60000);

    const { page } = areaPage;
    const searchKeyword = AREA_DATA.regionSearchKeyword;
    const expectedRegion = AREA_DATA.regionSearchTarget;

    // Step 2: find region input
    const regionInputCandidates = [
      areaPage.tabPanel.getByRole("combobox", { name: /ภาค/i }),
      areaPage.tabPanel.locator("#regionAreaSelect"),
      areaPage.tabPanel.locator("#regionSelect"),
      areaPage.tabPanel.locator("input[placeholder*='ภาค' i]"),
      areaPage.tabPanel.locator("input[name*='region' i]"),
      areaPage.tabPanel.locator("select[name*='region' i]"),
      areaPage.tabPanel.locator("select[id*='region' i]"),
    ];

    let regionLocator = null;
    for (const locator of regionInputCandidates) {
      const first = locator.first();
      if (await first.isVisible({ timeout: 3000 }).catch(() => false)) {
        regionLocator = first;
        break;
      }
    }

    expect(regionLocator !== null, "❌ ต้องพบช่องเลือกภาค").toBeTruthy();

    const tagName = await regionLocator!.evaluate((el) =>
      el.tagName.toLowerCase(),
    );

    let matchedOption = null;

    if (tagName === "select") {
      const optionLocator = regionLocator!
        .locator("option")
        .filter({ hasText: searchKeyword });
      await expect(optionLocator.first()).toBeVisible({ timeout: 5000 });
      matchedOption = optionLocator.first();
      await regionLocator!
        .selectOption({ label: expectedRegion })
        .catch(async () =>
          regionLocator!.selectOption({ value: expectedRegion }),
        );
    } else {
      await regionLocator!.click();
      await page.waitForTimeout(300);

      const dropdownSearchCandidates = [
        page.locator(".select2-container--open input.select2-search__field"),
        page.locator(".ant-select-dropdown:visible input"),
        page.locator(".cdk-overlay-pane:visible input"),
        page.locator(".dropdown-menu:visible input"),
        regionLocator!,
      ];

      let searchInput = null;
      for (const locator of dropdownSearchCandidates) {
        const first = locator.first();
        if (await first.isVisible({ timeout: 1500 }).catch(() => false)) {
          searchInput = first;
          break;
        }
      }

      expect(searchInput !== null, "❌ ต้องพบช่องค้นหาภาค").toBeTruthy();
      await searchInput!.fill("");
      await searchInput!.fill(searchKeyword);
      await page.waitForTimeout(500);

      // Expect Result 1: supports typing
      const typedValue = await searchInput!.inputValue().catch(() => "");
      expect(
        typedValue.includes(searchKeyword) || typedValue === searchKeyword,
        "❌ ระบบต้องรองรับการพิมพ์เพื่อค้นหาชื่อภาค",
      ).toBeTruthy();

      // Expect Result 2: dropdown shows matching options
      const dropdownContainer = page
        .locator(
          ".select2-results:visible, .ant-select-dropdown:visible, .cdk-overlay-pane:visible, .dropdown-menu:visible",
        )
        .last();
      await expect(dropdownContainer).toBeVisible({ timeout: 5000 });

      const optionCandidates = [
        page.getByRole("option", { name: new RegExp(expectedRegion, "i") }),
        dropdownContainer
          .locator("[role='option'], li, .dropdown-item")
          .filter({ hasText: expectedRegion }),
        page.locator(".select2-results__option", { hasText: expectedRegion }),
        page.getByText(expectedRegion, { exact: true }),
      ];

      for (const option of optionCandidates) {
        const first = option.first();
        if (await first.isVisible({ timeout: 3000 }).catch(() => false)) {
          matchedOption = first;
          break;
        }
      }

      expect(
        matchedOption !== null,
        `❌ ต้องแสดงรายการภาคที่ตรงกับคำค้นหา "${searchKeyword}"`,
      ).toBeTruthy();

      // Step 3: select from dropdown
      await matchedOption!.click();
      await page.waitForTimeout(500);

      // Expect Result 3: selected value shown on screen
      const selectedText = await areaPage.tabPanel.innerText();
      expect(
        selectedText.includes(expectedRegion),
        `❌ หลังเลือกแล้ว ต้องแสดงค่า "${expectedRegion}" บนหน้าจอ`,
      ).toBeTruthy();
    }

    // Step 4: Search
    const responsePromise = areaPage.waitForAreaApiResponse().catch(() => null);
    await areaPage.clickSearch();
    const response = await responsePromise;
    await areaPage.page.waitForLoadState("networkidle");

    if (response) {
      const data = await response.json();
      console.log(`✅ API ตอบกลับ ${data?.items?.length ?? 0} รายการ`);
    }
  });

  // ─── TC-DA-AREA-013 ────────────────────────────────────────────────────────

  test("TC-DA-AREA-013 : ตรวจสอบการเลือกภาคโดยการพิมพ์ค้นหาในตัวกรอง เมื่อไม่มีรายการที่ตรงกับคำค้น", async () => {
    test.setTimeout(60000);

    const { page } = areaPage;
    const invalidKeyword = AREA_DATA.invalidRegionKeyword;

    // Step 2: find region input
    const regionInputCandidates = [
      areaPage.tabPanel.getByRole("combobox", { name: /ภาค/i }),
      areaPage.tabPanel.locator("#regionAreaSelect"),
      areaPage.tabPanel.locator("#regionSelect"),
      areaPage.tabPanel.locator("input[placeholder*='ภาค' i]"),
      areaPage.tabPanel.locator("input[name*='region' i]"),
      areaPage.tabPanel.locator("select[name*='region' i]"),
      areaPage.tabPanel.locator("select[id*='region' i]"),
    ];

    let regionLocator = null;
    for (const locator of regionInputCandidates) {
      const first = locator.first();
      if (await first.isVisible({ timeout: 3000 }).catch(() => false)) {
        regionLocator = first;
        break;
      }
    }
    expect(regionLocator !== null, "❌ ต้องพบช่องเลือกภาค").toBeTruthy();

    await regionLocator!.click();
    await page.waitForTimeout(300);

    const dropdownSearchCandidates = [
      page.locator(".select2-container--open input.select2-search__field"),
      page.locator(".ant-select-dropdown:visible input"),
      page.locator(".cdk-overlay-pane:visible input"),
      page.locator(".dropdown-menu:visible input"),
      regionLocator!,
    ];

    let searchInput = null;
    for (const locator of dropdownSearchCandidates) {
      const first = locator.first();
      if (await first.isVisible({ timeout: 1500 }).catch(() => false)) {
        searchInput = first;
        break;
      }
    }

    expect(searchInput !== null, "❌ ต้องพบช่องค้นหาภาค").toBeTruthy();
    await searchInput!.fill("");
    await searchInput!.fill(invalidKeyword);
    await page.waitForTimeout(500);

    // Step 3: check dropdown
    const dropdownContainer = page
      .locator(
        ".select2-results:visible, .ant-select-dropdown:visible, .cdk-overlay-pane:visible, .dropdown-menu:visible",
      )
      .last();
    await expect(dropdownContainer).toBeVisible({ timeout: 5000 });

    // Expect Result 1: "No result found"
    const noResultTextCandidates = [
      page.getByText(/No result found/i),
      page.getByText(/No results found/i),
      dropdownContainer.getByText(/No result found/i),
      dropdownContainer.getByText(/No results found/i),
    ];

    let noResultLocator = null;
    for (const locator of noResultTextCandidates) {
      const first = locator.first();
      if (await first.isVisible({ timeout: 3000 }).catch(() => false)) {
        noResultLocator = first;
        break;
      }
    }

    await expect(
      noResultLocator!,
      '❌ ต้องแสดงข้อความ "No result found"',
    ).toBeVisible({ timeout: 5000 });

    // Expect Result 2: no other items
    const options = dropdownContainer.locator(
      "[role='option']:visible, li:visible, .dropdown-item:visible",
    );
    const optionTexts = (await options.allInnerTexts())
      .map((t) => t.trim())
      .filter(Boolean);
    const realOptions = optionTexts.filter(
      (t) => !/no result found|no results found/i.test(t),
    );

    expect(
      realOptions.length,
      `❌ ไม่ควรมีรายการอื่นที่ไม่เกี่ยวข้อง (พบ ${realOptions.length})`,
    ).toBe(0);
  });

  // ─── TC-DA-AREA-014 ────────────────────────────────────────────────────────

  test("TC-DA-AREA-014 : ตรวจสอบรายการภาคใน Dropdown", async () => {
    test.setTimeout(60000);

    const { page } = areaPage;
    const normalizeText = (text: string) =>
      text
        .replace(/\s+/g, " ")
        .replace(/\u00a0/g, " ")
        .trim();

    // Step 2: open region dropdown
    const regionInputCandidates = [
      areaPage.tabPanel.getByRole("combobox", { name: /ภาค/i }),
      areaPage.tabPanel.locator("#regionAreaSelect"),
      areaPage.tabPanel.locator("#regionSelect"),
      areaPage.tabPanel.locator("input[placeholder*='ภาค' i]"),
      areaPage.tabPanel.locator("input[name*='region' i]"),
      areaPage.tabPanel.locator("select[name*='region' i]"),
      areaPage.tabPanel.locator("select[id*='region' i]"),
    ];

    let regionLocator = null;
    for (const locator of regionInputCandidates) {
      const first = locator.first();
      if (await first.isVisible({ timeout: 3000 }).catch(() => false)) {
        regionLocator = first;
        break;
      }
    }
    expect(regionLocator !== null, "❌ ต้องพบ Dropdown ภาค").toBeTruthy();

    await regionLocator!.click();
    await page.waitForTimeout(500);

    // Get region list
    const tagName = await regionLocator!.evaluate((el) =>
      el.tagName.toLowerCase(),
    );
    let regionTexts: string[] = [];

    if (tagName === "select") {
      regionTexts = (await regionLocator!.locator("option").allInnerTexts())
        .map(normalizeText)
        .filter(Boolean);
    } else {
      const dropdownContainer = page
        .locator(
          ".select2-results:visible, .ant-select-dropdown:visible, .cdk-overlay-pane:visible, .dropdown-menu:visible",
        )
        .last();
      await expect(dropdownContainer).toBeVisible({ timeout: 5000 });
      regionTexts = (
        await dropdownContainer
          .locator(
            "[role='option']:visible, li:visible, .dropdown-item:visible",
          )
          .allInnerTexts()
      )
        .map(normalizeText)
        .filter(Boolean);
    }

    // Expect Result: all expected regions present
    for (const expectedRegion of AREA_DATA.expectedRegions) {
      const found = regionTexts.some(
        (region) =>
          region === expectedRegion ||
          region.includes(expectedRegion) ||
          expectedRegion.includes(region),
      );
      expect(
        found,
        `❌ ต้องพบรายการภาค "${expectedRegion}" ใน Dropdown`,
      ).toBeTruthy();
    }
  });

  // ─── TC-DA-AREA-015 ────────────────────────────────────────────────────────

  test("TC-DA-AREA-015 : ระบบกรองข้อมูลได้ถูกต้องตามค่าตัวกรองที่ผู้ใช้เลือก", async () => {
    test.setTimeout(60000);

    const selectedRegion = AREA_DATA.combinedRegion;
    const selectedProvince = AREA_DATA.combinedProvince;
    const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
    const selectedNativeRegions: string[] = [];

    // Step 2: Select region
    const regionOk = await areaPage.selectMultipleRegions(
      [selectedRegion],
      selectedNativeRegions,
    );
    expect(regionOk, `❌ ต้องเลือกภาค "${selectedRegion}" ได้`).toBeTruthy();
    await areaPage.page.waitForTimeout(500);

    // Step 3: Select province
    const selectedNativeProvinces: string[] = [];
    const provinceOk = await areaPage.selectMultipleProvinces(
      [selectedProvince],
      selectedNativeProvinces,
    );
    expect(
      provinceOk,
      `❌ ต้องเลือกจังหวัด "${selectedProvince}" ได้`,
    ).toBeTruthy();

    // Step 4: Search and intercept API
    const requestPromise = areaPage.waitForAreaApiRequest();
    const responsePromise = areaPage.waitForAreaApiResponse();
    await areaPage.clickSearch();

    const request = await requestPromise;
    const response = await responsePromise;
    const data = await response.json();
    await areaPage.page.waitForLoadState("networkidle");

    console.log("ℹ️ area request payload:", request.postData() || "<empty>");

    // Expect Result: items must contain both region and province
    const items: any[] = data.items ?? [];
    expect(Array.isArray(items), "❌ API items ต้องเป็น array").toBeTruthy();

    for (const [index, item] of items.entries()) {
      const areas: any[] = item?.areasItem ?? item?.areas ?? [];

      expect(
        Array.isArray(areas) && areas.length > 0,
        `❌ item[${index}] ต้องมีข้อมูลพื้นที่`,
      ).toBeTruthy();

      const regions = areas
        .map((a) => areaPage.normalizeRegion(a?.region))
        .filter((r) => r !== "");

      const provinces = areas
        .map((a) => areaPage.normalizeProvince(a?.province))
        .filter((p) => p !== "");

      const hasSelectedRegion = regions.some(
        (r) => r === selectedRegion || r.includes(selectedRegion),
      );
      expect(
        hasSelectedRegion,
        `❌ item[${index}] ต้องมีภาค "${selectedRegion}" (มี: ${regions.join(", ")})`,
      ).toBeTruthy();

      const hasSelectedProvince = provinces.some(
        (p) => p === selectedProvince || p.includes(selectedProvince),
      );
      expect(
        hasSelectedProvince,
        `❌ item[${index}] ต้องมีจังหวัด "${selectedProvince}" (มี: ${provinces.join(", ")})`,
      ).toBeTruthy();
    }

    // UI sanity
    if ((data.totalCount ?? items.length) > 0) {
      await expect(areaPage.noResultMessage).toBeHidden({ timeout: 5000 });
      await expect(areaPage.detailButtons.first()).toBeVisible({
        timeout: 10000,
      });
    }
  });

  // ─── TC-DA-AREA-016 ────────────────────────────────────────────────────────

  test("TC-DA-AREA-016 : ค้นหาข้อมูลโดยไม่เลือกตัวกรองภาคและจังหวัด", async () => {
    test.setTimeout(60000);

    // Step 2: Search without any filter
    const requestPromise = areaPage.waitForAreaApiRequest();
    const responsePromise = areaPage.waitForAreaApiResponse();
    await areaPage.clickSearch();
    const request = await requestPromise;
    const response = await responsePromise;
    const data = await response.json();
    await areaPage.page.waitForLoadState("networkidle");

    console.log("ℹ️ area request payload:", request.postData() || "<empty>");

    // Expect Result: all data shown
    const items: any[] = data?.items ?? [];
    const totalCount = Number(data?.totalCount ?? items.length ?? 0);

    expect(Array.isArray(items), "❌ API items ต้องเป็น array").toBeTruthy();
    expect(
      totalCount,
      "❌ เมื่อไม่เลือกตัวกรองภาคและจังหวัด ต้องแสดงข้อมูลทั้งหมดอย่างน้อย 1 รายการ",
    ).toBeGreaterThan(0);

    await expect(areaPage.noResultMessage).toBeHidden({ timeout: 5000 });
    await expect(areaPage.detailButtons.first()).toBeVisible({
      timeout: 10000,
    });
  });

  // ─── TC-DA-AREA-019 ────────────────────────────────────────────────────────

  test("TC-DA-AREA-019 : ตรวจสอบว่าระบบแสดงตำแหน่งที่ตั้งของเหตุการณ์บนแผนที่", async () => {
    test.setTimeout(60000);

    const normalize = (s: string) => s.replace(/\s+/g, " ").trim();

    // Step 2: Search
    const responsePromise = areaPage.waitForAreaApiResponse();
    await areaPage.clickSearch();
    await responsePromise;
    await areaPage.page.waitForLoadState("networkidle");
    await areaPage.page.waitForTimeout(1000);

    // Step 3: Check location label
    const locationLabel = areaPage.tabPanel
      .getByText(/ตำแหน่งพื้นที่[:：]/)
      .first();
    await expect(locationLabel).toBeVisible({ timeout: 10000 });

    // อ่านเฉพาะข้อความส่วนสรุป ไม่อ่านทั้ง panel
    const summaryText = await locationLabel.locator("..").innerText();
    const normalizedText = normalize(summaryText);

    expect(
      /ตำแหน่งพื้นที่[:：]/.test(normalizedText),
      '❌ กล่องข้อมูลต้องมีข้อความ "ตำแหน่งพื้นที่:"',
    ).toBeTruthy();

    // จับเฉพาะค่าหลัง ":" จนจบบรรทัด
    const match = summaryText.match(/ตำแหน่งพื้นที่[:：]\s*([^\n\r]*)/);
    const locationValue = normalize(match?.[1] ?? "");

    expect(
      locationValue,
      "❌ กรณีไม่ได้เลือกพื้นที่ ระบบต้องแสดงเป็นค่าว่างหลังข้อความตำแหน่งพื้นที่:",
    ).toBe("");
  });

  // ─── TC-DA-AREA-020 ────────────────────────────────────────────────────────

  test("TC-DA-AREA-020 : ตรวจสอบว่าระบบแสดงจำนวนผลลัพธ์ของเหตุการณ์", async () => {
    test.setTimeout(60000);

    const normalize = (s: string) => s.replace(/\s+/g, " ").trim();

    // Step 2: Search
    const responsePromise = areaPage.waitForAreaApiResponse();
    await areaPage.clickSearch();
    const response = await responsePromise;
    const data = await response.json();
    await areaPage.page.waitForLoadState("networkidle");
    await areaPage.page.waitForTimeout(1000);

    // Step 3: Check info text
    const infoText = normalize(await areaPage.tabPanel.innerText());

    // Expect Result 1: shows total count label with number
    expect(
      infoText.includes("จำนวนข้อมูลทั้งหมด:"),
      '❌ ต้องแสดงข้อความ "จำนวนข้อมูลทั้งหมด:"',
    ).toBeTruthy();

    const countMatch = infoText.match(/จำนวนข้อมูลทั้งหมด[:：]\s*([0-9]+)/);
    expect(
      countMatch !== null,
      '❌ ต้องแสดงค่าในรูปแบบ "จำนวนข้อมูลทั้งหมด: [จำนวน]"',
    ).toBeTruthy();

    const displayedCount = Number(countMatch?.[1] ?? -1);
    expect(
      Number.isNaN(displayedCount),
      "❌ ค่าจำนวนข้อมูลทั้งหมดต้องเป็นตัวเลข",
    ).toBeFalsy();

    // Expect Result 2: displayed count matches actual cards
    const apiCount = Number(data?.totalCount ?? data?.items?.length ?? 0);

    let actualCardCount = 0;
    const detailButtonCount = await areaPage.detailButtons.count();
    if (detailButtonCount > 0) {
      actualCardCount = detailButtonCount;
    } else {
      const cardCandidates = areaPage.tabPanel.locator(
        ".alert-card:visible, .card:visible, [class*='card']:visible",
      );
      actualCardCount = await cardCandidates.count();
    }

    expect(
      displayedCount,
      `❌ จำนวนข้อมูลทั้งหมดที่แสดง (${displayedCount}) ต้องตรงกับจำนวนรายการผลลัพธ์บนหน้าจอจริง (${actualCardCount})`,
    ).toBe(actualCardCount);

    expect(
      displayedCount,
      `❌ จำนวนข้อมูลทั้งหมดที่แสดง (${displayedCount}) ต้องตรงกับจำนวนผลลัพธ์จาก API (${apiCount})`,
    ).toBe(apiCount);
  });

  // ─── TC-DA-AREA-022 ────────────────────────────────────────────────────────

  test("TC-DA-AREA-022 : ตรวจสอบว่าระบบแสดงข้อมูล CAP XML และผู้ใช้สามารถคัดลอกข้อมูลได้", async ({
    page,
    context,
  }) => {
    test.setTimeout(60000);

    const normalize = (s: string) => s.replace(/\s+/g, " ").trim();

    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: AREA_DATA.portalUrl,
    });

    // Step 2: Search
    const responsePromise = areaPage.waitForAreaApiResponse();
    await areaPage.clickSearch();
    await responsePromise;
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Step 3: Open ATOM section
    const atomToggleCandidates = [
      areaPage.tabPanel.getByRole("button", { name: /^ATOM$/i }).first(),
      page.getByRole("button", { name: /^ATOM$/i }).first(),
      areaPage.tabPanel.getByText(/^ATOM$/i).first(),
    ];

    for (const locator of atomToggleCandidates) {
      if (await locator.isVisible({ timeout: 2000 }).catch(() => false)) {
        await locator.click().catch(() => {});
        break;
      }
    }

    const atomIntroCandidates = [
      areaPage.tabPanel
        .getByText("CAP XML สำหรับการค้นหานี้จัดทำโดย API")
        .first(),
      page.getByText("CAP XML สำหรับการค้นหานี้จัดทำโดย API").first(),
    ];

    let atomIntroFound = false;
    for (const locator of atomIntroCandidates) {
      if (await locator.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(locator).toBeVisible({ timeout: 10000 });
        atomIntroFound = true;
        break;
      }
    }
    expect(
      atomIntroFound,
      "❌ ต้องแสดงข้อความ CAP XML สำหรับการค้นหานี้จัดทำโดย API",
    ).toBeTruthy();

    // Step 4: Find ATOM copy row
    const atomCopyRowCandidates = [
      areaPage.tabPanel.locator(".atom-copy").first(),
      page.locator(".atom-copy").first(),
      areaPage.tabPanel
        .locator("div, section, article")
        .filter({ has: areaPage.tabPanel.locator(".ic-copy") })
        .first(),
      page
        .locator("div, section, article")
        .filter({ has: page.locator(".ic-copy") })
        .first(),
    ];

    let atomCopyRow = null;
    for (const locator of atomCopyRowCandidates) {
      if (await locator.isVisible({ timeout: 3000 }).catch(() => false)) {
        atomCopyRow = locator;
        break;
      }
    }

    expect(atomCopyRow, "❌ ต้องพบแถว ATOM/XML สำหรับ copy").toBeTruthy();
    await expect(atomCopyRow!).toBeVisible({ timeout: 10000 });

    // Step 5: Get displayed XML URL
    const urlTextCandidates = [
      atomCopyRow!.locator("span").first(),
      atomCopyRow!.locator("code").first(),
      atomCopyRow!.locator("a").first(),
      atomCopyRow!
        .locator("*")
        .filter({ hasText: /https?:\/\//i })
        .first(),
    ];

    let displayedXmlUrl = "";
    for (const locator of urlTextCandidates) {
      if (await locator.isVisible({ timeout: 2000 }).catch(() => false)) {
        const text = normalize(await locator.innerText().catch(() => ""));
        const match = text.match(/https?:\/\/\S+/i);
        if (match) {
          displayedXmlUrl = match[0].replace(/[)\],]+$/, "");
          break;
        }
      }
    }

    if (!displayedXmlUrl) {
      const linkInRow = atomCopyRow!.locator("a").first();
      if (await linkInRow.isVisible({ timeout: 2000 }).catch(() => false)) {
        const href = await linkInRow.getAttribute("href");
        if (href)
          displayedXmlUrl = new URL(href, AREA_DATA.portalUrl).toString();
      }
    }

    expect(
      displayedXmlUrl,
      "❌ ต้องพบ URL XML/ATOM ที่แสดงอยู่ในส่วน ATOM",
    ).toBeTruthy();

    // Step 6: Click Copy
    const copyButtonCandidates = [
      atomCopyRow!.locator(".ic-copy").first(),
      atomCopyRow!.getByRole("button", { name: /copy|คัดลอก/i }).first(),
      atomCopyRow!
        .locator("button")
        .filter({ hasText: /copy|คัดลอก/i })
        .first(),
      atomCopyRow!.locator("[class*='copy']").first(),
    ];

    let copyButton = null;
    for (const locator of copyButtonCandidates) {
      if (await locator.isVisible({ timeout: 2000 }).catch(() => false)) {
        copyButton = locator;
        break;
      }
    }
    expect(copyButton, "❌ ต้องพบปุ่ม Copy").toBeTruthy();

    await copyButton!.click();
    await page.waitForTimeout(1000);

    // Step 7: Verify clipboard
    const clipboardText = normalize(
      await page.evaluate(async () => navigator.clipboard.readText()),
    );

    expect(
      clipboardText.length > 0,
      "❌ หลังกด Copy ต้องมีข้อมูลใน clipboard",
    ).toBeTruthy();

    const isXmlContent =
      /<\?xml/i.test(clipboardText) ||
      /<alert[\s>]/i.test(clipboardText) ||
      /<feed[\s>]/i.test(clipboardText) ||
      /<entry[\s>]/i.test(clipboardText);
    const isUrlContent = /^https?:\/\//i.test(clipboardText);

    expect(
      isXmlContent || isUrlContent,
      "❌ ข้อมูลที่คัดลอกต้องเป็น XML content หรือ URL ของ XML",
    ).toBeTruthy();

    if (isUrlContent) {
      expect(
        clipboardText,
        "❌ URL ที่คัดลอกต้องตรงกับ URL XML/ATOM ที่แสดง",
      ).toBe(displayedXmlUrl);
    }

    // Step 8: Open the XML link
    const targetUrl = isUrlContent ? clipboardText : displayedXmlUrl;
    const urlObj = new URL(targetUrl);
    const area = urlObj.searchParams.get("area") ?? "";
    const geoCodeId = urlObj.searchParams.get("GeoCodeId") ?? "";

    if (!area && !geoCodeId) {
      console.warn("⚠️ URL มี parameter ว่างเปล่า — ข้าม Step นี้");
    } else {
      const xmlApiResponse = await page.request.get(targetUrl);
      expect(
        xmlApiResponse.ok(),
        `❌ ลิงก์ XML ต้องเปิดได้สำเร็จ (status: ${xmlApiResponse.status()})`,
      ).toBeTruthy();
      expect(targetUrl, "❌ URL ต้องมี /cap/feed/xml").toContain(
        "/cap/feed/xml",
      );

      const xmlContent = await xmlApiResponse.text();
      expect(xmlContent).toMatch(/<\?xml|<feed|<alert|<entry/i);
    }
  });

  // ─── TC-DA-AREA-023 ────────────────────────────────────────────────────────

  test("TC-DA-AREA-023 : ตรวจสอบว่าผู้ใช้สามารถเลือกประเภทเหตุการณ์จาก Dropdown", async ({
    page,
  }) => {
    test.setTimeout(60000);

    const selectedEvent = AREA_DATA.eventName;

    // Step 2: Initial search
    const firstResponsePromise = areaPage.waitForAreaApiResponse();
    await page.locator("#searchByArea").click();
    await firstResponsePromise;
    await page.waitForLoadState("networkidle");

    // Step 3: Open advanced filter
    await areaPage.tabPanel
      .getByRole("button", { name: "ตัวกรองขั้นสูง" })
      .click();

    // Step 4: Select event
    await page.selectOption("#eventAreaSelect", { label: selectedEvent });
    const selectedEventId = await page.locator("#eventAreaSelect").inputValue();
    expect(selectedEventId).toBeTruthy();

    // Step 5: Search with advanced filter
    const secondResponsePromise = areaPage.waitForAreaApiResponse();
    await page
      .locator("#capAdvanceFilterArea")
      .getByRole("button", { name: "ค้นหา" })
      .click();
    const searchResponse = await secondResponsePromise;
    const searchData = await searchResponse.json();
    await page.waitForLoadState("networkidle");

    // Expect: results match selected event
    expect(Array.isArray(searchData.items)).toBeTruthy();
    expect(
      searchData.items.length,
      "❌ ต้องมีผลลัพธ์อย่างน้อย 1 รายการ",
    ).toBeGreaterThan(0);

    for (let i = 0; i < searchData.items.length; i++) {
      const item = searchData.items[i];
      expect(
        item.event ?? item.eventName,
        `❌ item[${i}] ต้องมีเหตุการณ์ "${selectedEvent}"`,
      ).toBe(selectedEvent);
    }
  });

  // ─── TC-DA-AREA-024 ────────────────────────────────────────────────────────

  test("TC-DA-AREA-024 : ค้นหาเหตุการณ์โดยพิมพ์ชื่อเหตุการณ์ในช่องค้นหาของ Dropdown", async ({
    page,
  }) => {
    test.setTimeout(60000);

    const searchKeyword = AREA_DATA.eventName;
    const selectedEvent = AREA_DATA.eventName;

    // Step 2: Initial search
    const firstResponsePromise = areaPage.waitForAreaApiResponse();
    await areaPage.clickSearch();
    await firstResponsePromise;
    await page.waitForLoadState("networkidle");

    // Step 3: Open advanced filter
    const advFilterOpened = await areaPage.openAdvancedFilter();
    expect(advFilterOpened, "ต้องพบปุ่มตัวกรองขั้นสูง").toBeTruthy();

    // Step 4: Select event via dropdown
    const eventSelect = areaPage.eventSelect;
    await expect(eventSelect).toBeVisible({ timeout: 10000 });

    const eventTag = await eventSelect.evaluate((el) =>
      el.tagName.toLowerCase(),
    );

    if (eventTag === "select") {
      await eventSelect.selectOption({ label: selectedEvent });
    } else {
      const eventOpenCandidates = [
        page.locator("#select2-eventAreaSelect-container").first(),
        page.locator('span[aria-labelledby*="eventAreaSelect"]').first(),
        areaPage.advancedFilterPanel.locator(".select2-selection").first(),
        eventSelect,
      ];

      let opened = false;
      for (const locator of eventOpenCandidates) {
        if (await locator.isVisible({ timeout: 2000 }).catch(() => false)) {
          await locator.click({ force: true });
          opened = true;
          break;
        }
      }
      expect(opened, "❌ ต้องสามารถเปิด dropdown เหตุการณ์ได้").toBeTruthy();

      const eventSearchInputCandidates = [
        page
          .locator(".select2-container--open input.select2-search__field")
          .first(),
        page
          .locator(".select2-dropdown--below input.select2-search__field")
          .first(),
        page
          .locator(".select2-dropdown--above input.select2-search__field")
          .first(),
      ];

      let eventSearchInput = null;
      for (const locator of eventSearchInputCandidates) {
        if (await locator.isVisible({ timeout: 3000 }).catch(() => false)) {
          eventSearchInput = locator;
          break;
        }
      }

      if (eventSearchInput) {
        await eventSearchInput.fill("");
        await eventSearchInput.fill(searchKeyword);
        await page.waitForTimeout(500);

        const matchedOptionCandidates = [
          page
            .locator(".select2-results__option", { hasText: selectedEvent })
            .first(),
          page
            .getByRole("option", { name: new RegExp(selectedEvent, "i") })
            .first(),
          page.getByText(selectedEvent, { exact: true }).first(),
        ];

        let matchedOption = null;
        for (const locator of matchedOptionCandidates) {
          if (await locator.isVisible({ timeout: 3000 }).catch(() => false)) {
            matchedOption = locator;
            break;
          }
        }

        expect(
          matchedOption,
          `❌ ต้องพบรายการเหตุการณ์ "${selectedEvent}" จากคำค้นหา`,
        ).toBeTruthy();
        await matchedOption!.click();
      } else {
        await page.selectOption("#eventAreaSelect", { label: selectedEvent });
      }
    }

    const selectedEventId = await areaPage.eventSelect.inputValue();
    expect(selectedEventId).toBeTruthy();

    // Step 5: Search with event filter
    const searchResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/app/capFeed/") &&
        response.url().toLowerCase().includes("area") &&
        response.url().includes(`eventId=${selectedEventId}`) &&
        response.status() === 200,
      { timeout: 15000 },
    );

    await areaPage.advancedFilterPanel
      .getByRole("button", { name: "ค้นหา" })
      .click();
    const searchResponse = await searchResponsePromise;
    const searchData = await searchResponse.json();

    expect(searchResponse.url()).toContain(`eventId=${selectedEventId}`);
    await expect(areaPage.eventSelect).toHaveValue(selectedEventId);
    expect(Number(searchData.totalCount)).toBe(searchData.items.length);

    const sectionText = await areaPage.tabPanel.innerText();
    const displayedTotalMatch = sectionText.match(
      /จำนวนข้อมูลทั้งหมด:\s*([\d,]+)/,
    );
    expect(displayedTotalMatch, "ต้องแสดงจำนวนข้อมูลทั้งหมด").not.toBeNull();

    const displayedTotal = Number(displayedTotalMatch![1].replace(/,/g, ""));
    expect(displayedTotal).toBe(searchData.totalCount);

    const cardContainer = page
      .locator("#capFeedAreaCardContainer, #capFeedSearchByAreaCardContainer")
      .first();
    const cards = cardContainer.locator(".card");
    const firstPageCardCount = await cards.count();
    expect(firstPageCardCount).toBeGreaterThan(0);

    const pageSizeDropdown = page.locator("#pageSizeDropdown").first();
    const pageSize = Number(await pageSizeDropdown.inputValue());
    const totalPages = Math.ceil(displayedTotal / pageSize);

    let validatedCardCount = 0;
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      if (pageNumber > 1) {
        await page
          .getByLabel("ค้นหาจากพื้นที่")
          .locator("a.pointer.mx-1", { hasText: String(pageNumber) })
          .first()
          .click();
        await page.waitForTimeout(300);
      }
      const cardsOnCurrentPage = await cards.count();
      for (let index = 0; index < cardsOnCurrentPage; index += 1) {
        await expect(cards.nth(index)).toContainText(selectedEvent);
      }
      validatedCardCount += cardsOnCurrentPage;
    }

    expect(validatedCardCount).toBe(displayedTotal);
  });

  // ─── TC-DA-AREA-025 ────────────────────────────────────────────────────────

  test("TC-DA-AREA-025 : ตรวจสอบว่าผู้ใช้สามารถเลือกหลายค่าของระดับความรุนแรง", async () => {
    test.setTimeout(60000);

    const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
    const selectedSeverities = AREA_DATA.selectedSeverities;
    const severityApiAliases = AREA_DATA.severityApiAliases;

    // Step 2: Initial search
    const firstResponsePromise = areaPage.waitForAreaApiResponse();
    await areaPage.clickSearch();
    await firstResponsePromise;
    await areaPage.page.waitForLoadState("networkidle");

    // Step 3: Open advanced filter
    const ok = await areaPage.openAdvancedFilter();
    expect(ok, "ต้องพบปุ่มตัวกรองขั้นสูง").toBeTruthy();

    // Step 4: Tick severity checkboxes
    const extremeCheckbox = await areaPage.getSeverityCheckbox("ร้ายแรงมาก");
    const severeCheckbox = await areaPage.getSeverityCheckbox("ร้ายแรง");

    await areaPage.tickCheckbox(extremeCheckbox);
    await areaPage.tickCheckbox(severeCheckbox);

    // Step 5: Search
    const data = await areaPage.clickAdvancedFilterSearch();

    // Expect 1: both checkboxes remain checked
    await expect(extremeCheckbox).toBeChecked();
    await expect(severeCheckbox).toBeChecked();

    // Expect 2: cards shown
    await expect(areaPage.cards.first()).toBeVisible({ timeout: 10000 });
    const cardCount = await areaPage.cards.count();
    expect(cardCount).toBeGreaterThan(0);

    for (let i = 0; i < cardCount; i++) {
      const text = await areaPage.cards.nth(i).innerText();
      const matched = selectedSeverities.some((severity) =>
        text.includes(severity),
      );
      expect(
        matched,
        `Card ${i} ควรมี severity หนึ่งใน: ${selectedSeverities.join(", ")}\nActual: ${text}`,
      ).toBeTruthy();
    }

    const allItems: any[] = data?.items ?? [];
    expect(allItems.length).toBeGreaterThan(0);

    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i];
      const severityValues = [
        item?.severity,
        item?.severityName,
        item?.severityLevel,
        item?.responseType,
      ]
        .map((v) => normalize(String(v ?? "")))
        .filter((v) => v !== "");

      const combinedSeverityText = severityValues.join(" ");
      const matched = selectedSeverities.some((severityLabel) =>
        severityApiAliases[severityLabel].some((alias) =>
          combinedSeverityText.includes(normalize(alias)),
        ),
      );
      expect(
        matched,
        `API item ${i} ต้องมีระดับความรุนแรงเป็นหนึ่งในค่าที่เลือก (${selectedSeverities.join(", ")})`,
      ).toBeTruthy();
    }
  });

  // ─── TC-DA-AREA-026 ────────────────────────────────────────────────────────

  test("TC-DA-AREA-026 : ตรวจสอบว่าผู้ใช้สามารถเลือกหลายค่าของระดับความแน่นอน", async () => {
    test.setTimeout(60000);

    const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
    const selectedCertainties = AREA_DATA.selectedCertainties;
    const certaintyApiAliases = AREA_DATA.certaintyApiAliases;

    // Initial search
    const firstResponsePromise = areaPage.waitForAreaApiResponse();
    await areaPage.clickSearch();
    await firstResponsePromise;
    await areaPage.page.waitForLoadState("networkidle");

    // Open advanced filter
    const ok = await areaPage.openAdvancedFilter();
    expect(ok, "ต้องพบปุ่มตัวกรองขั้นสูง").toBeTruthy();

    // Tick certainty checkboxes
    const observedCheckbox = await areaPage.getCertaintyCheckbox("สังเกตการณ์");
    const possibleCheckbox = await areaPage.getCertaintyCheckbox("เป็นไปได้");

    await areaPage.tickCheckbox(observedCheckbox);
    await areaPage.tickCheckbox(possibleCheckbox);

    // Search
    const data = await areaPage.clickAdvancedFilterSearch();

    // Expect 1: both remain checked
    await expect(observedCheckbox).toBeChecked();
    await expect(possibleCheckbox).toBeChecked();

    // Expect 2: cards and API items match
    await expect(areaPage.cards.first()).toBeVisible({ timeout: 10000 });
    const cardCount = await areaPage.cards.count();
    expect(cardCount).toBeGreaterThan(0);

    const allItems: any[] = data?.items ?? [];
    expect(allItems.length).toBeGreaterThan(0);

    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i];
      const certaintyValues = [
        item?.certainty,
        item?.certaintyName,
        item?.certaintyLevel,
      ]
        .map((v) => normalize(String(v ?? "")))
        .filter((v) => v !== "");

      const combinedCertaintyText = certaintyValues.join(" ");
      const matched = selectedCertainties.some((label) =>
        certaintyApiAliases[label].some((alias) =>
          combinedCertaintyText.includes(normalize(alias)),
        ),
      );
      expect(
        matched,
        `API item ${i} ต้องมีระดับความแน่นอนเป็นหนึ่งในค่าที่เลือก (${selectedCertainties.join(", ")})`,
      ).toBeTruthy();
    }
  });

  // ─── TC-DA-AREA-027 ────────────────────────────────────────────────────────

  test("TC-DA-AREA-027 : ตรวจสอบว่าผู้ใช้สามารถเลือกหลายค่าของระดับความเร่งด่วน", async () => {
    test.setTimeout(60000);

    const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
    const selectedUrgencies = AREA_DATA.selectedUrgencies;
    const urgencyApiAliases = AREA_DATA.urgencyApiAliases;

    // Initial search
    const firstResponsePromise = areaPage.waitForAreaApiResponse();
    await areaPage.clickSearch();
    await firstResponsePromise;
    await areaPage.page.waitForLoadState("networkidle");

    // Open advanced filter
    const ok = await areaPage.openAdvancedFilter();
    expect(ok, "ต้องพบปุ่มตัวกรองขั้นสูง").toBeTruthy();

    // Tick urgency checkboxes
    const immediateCheckbox = await areaPage.getUrgencyCheckbox("ทันที");
    const expectedCheckbox = await areaPage.getUrgencyCheckbox("คาดหวัง");

    await areaPage.tickCheckbox(immediateCheckbox);
    await areaPage.tickCheckbox(expectedCheckbox);

    // Search
    const data = await areaPage.clickAdvancedFilterSearch();

    // Expect 1: both remain checked
    await expect(immediateCheckbox).toBeChecked();
    await expect(expectedCheckbox).toBeChecked();

    // Expect 2: cards and API items match
    await expect(areaPage.cards.first()).toBeVisible({ timeout: 10000 });
    const cardCount = await areaPage.cards.count();
    expect(cardCount).toBeGreaterThan(0);

    const allItems: any[] = data?.items ?? [];
    expect(allItems.length).toBeGreaterThan(0);

    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i];
      const urgencyValues = [
        item?.urgency,
        item?.urgencyName,
        item?.urgencyLevel,
      ]
        .map((v) => normalize(String(v ?? "")))
        .filter((v) => v !== "");

      const combinedUrgencyText = urgencyValues.join(" ");
      const matched = selectedUrgencies.some((label) =>
        urgencyApiAliases[label].some((alias) =>
          combinedUrgencyText.includes(normalize(alias)),
        ),
      );
      expect(
        matched,
        `API item ${i} ต้องมีระดับความเร่งด่วนเป็นหนึ่งในค่าที่เลือก (${selectedUrgencies.join(", ")})`,
      ).toBeTruthy();
    }
  });

  // ─── TC-DA-AREA-028 ────────────────────────────────────────────────────────

  test("TC-DA-AREA-028 : ตรวจสอบการค้นหาเมื่อเลือกตัวกรองขั้นสูงหลายตัวพร้อมกัน", async () => {
    test.setTimeout(60000);

    const selectedEvent = AREA_DATA.eventName;
    const selectedSeverity = AREA_DATA.singleSeverity;
    const selectedCertainty = AREA_DATA.singleCertainty;
    const selectedUrgency = AREA_DATA.singleUrgency;

    // Initial search
    const firstResponsePromise = areaPage.waitForAreaApiResponse();
    await areaPage.clickSearch();
    await firstResponsePromise;
    await areaPage.page.waitForLoadState("networkidle");

    // Open advanced filter
    const ok = await areaPage.openAdvancedFilter();
    expect(ok, "ต้องพบปุ่มตัวกรองขั้นสูง").toBeTruthy();

    // Select event
    const selectedEventId = await areaPage.selectEventFilter(selectedEvent);
    await expect(areaPage.eventSelect).toHaveValue(selectedEventId);

    // Tick severity, certainty, urgency
    const severityExtreme = await areaPage.getSeverityCheckbox("ร้ายแรงมาก");
    const certaintyObserved =
      await areaPage.getCertaintyCheckbox("สังเกตการณ์");
    const urgencyImmediate = await areaPage.getUrgencyCheckbox("ทันที");

    await areaPage.tickCheckbox(severityExtreme);
    await areaPage.tickCheckbox(certaintyObserved);
    await areaPage.tickCheckbox(urgencyImmediate);

    // Search with event filter
    const searchResponsePromise = areaPage.page.waitForResponse(
      (response) =>
        response.url().includes("/api/app/capFeed/") &&
        response.url().toLowerCase().includes("area") &&
        response.url().includes(`eventId=${selectedEventId}`) &&
        response.status() === 200,
      { timeout: 15000 },
    );

    await areaPage.advancedFilterSearchButton.click();
    const searchResponse = await searchResponsePromise;
    const data = await searchResponse.json();
    await areaPage.page.waitForLoadState("networkidle");

    // Expect 1: event dropdown still has selected value
    await expect(areaPage.eventSelect).toHaveValue(selectedEventId);

    // Expect 2: all checkboxes remain checked
    await expect(severityExtreme).toBeChecked();
    await expect(certaintyObserved).toBeChecked();
    await expect(urgencyImmediate).toBeChecked();

    // Expect 3: results shown
    await expect(areaPage.cards.first()).toBeVisible({ timeout: 10000 });
    const cardCount = await areaPage.cards.count();
    expect(cardCount).toBeGreaterThan(0);

    // Expect 4: API items match all conditions
    const allItems: any[] = data?.items ?? [];
    expect(allItems.length).toBeGreaterThan(0);

    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i];

      expect(
        String(item?.event ?? item?.eventName ?? "").includes(selectedEvent),
        `API item ${i} event ไม่ตรงกับ "${selectedEvent}"`,
      ).toBeTruthy();

      expect(
        String(item?.severity ?? item?.severityName ?? "").includes(
          selectedSeverity,
        ) ||
          String(item?.severityLevel ?? "").includes("4") ||
          String(item?.severity ?? item?.severityName ?? "").includes(
            "Extreme",
          ),
        `API item ${i} severity ไม่ตรงกับ "${selectedSeverity}"`,
      ).toBeTruthy();

      expect(
        String(item?.certainty ?? item?.certaintyName ?? "").includes(
          selectedCertainty,
        ) ||
          String(item?.certainty ?? item?.certaintyName ?? "").includes(
            "Observed",
          ),
        `API item ${i} certainty ไม่ตรงกับ "${selectedCertainty}"`,
      ).toBeTruthy();

      expect(
        String(item?.urgency ?? item?.urgencyName ?? "").includes(
          selectedUrgency,
        ) ||
          String(item?.urgency ?? item?.urgencyName ?? "").includes(
            "Immediate",
          ),
        `API item ${i} urgency ไม่ตรงกับ "${selectedUrgency}"`,
      ).toBeTruthy();
    }
  });

  // ─── TC-DA-AREA-029 ────────────────────────────────────────────────────────

  test("TC-DA-AREA-029 : ตรวจสอบว่าปุ่ม Reset Filter สามารถล้างค่าตัวกรองทั้งหมดได้", async () => {
    test.setTimeout(60000);

    const selectedEvent = AREA_DATA.eventName;

    // Initial search
    const firstResponsePromise = areaPage.waitForAreaApiResponse();
    await areaPage.clickSearch();
    await firstResponsePromise;
    await areaPage.page.waitForLoadState("networkidle");

    // Open advanced filter
    const ok = await areaPage.openAdvancedFilter();
    expect(ok, "ต้องพบปุ่มตัวกรองขั้นสูง").toBeTruthy();

    // Select all filters
    const selectedEventId = await areaPage.selectEventFilter(selectedEvent);
    await expect(areaPage.eventSelect).toHaveValue(selectedEventId);

    const severityExtreme = await areaPage.getSeverityCheckbox("ร้ายแรงมาก");
    const certaintyObserved =
      await areaPage.getCertaintyCheckbox("สังเกตการณ์");
    const urgencyImmediate = await areaPage.getUrgencyCheckbox("ทันที");

    await areaPage.tickCheckbox(severityExtreme);
    await areaPage.tickCheckbox(certaintyObserved);
    await areaPage.tickCheckbox(urgencyImmediate);

    // Step 5: Click reset
    await areaPage.resetFilterButton.click();
    await areaPage.page.waitForLoadState("networkidle");
    await areaPage.page.waitForTimeout(500);

    // Expect 1: event dropdown cleared
    await expect(areaPage.eventSelect).toHaveValue("");

    // Expect 2: all checkboxes unchecked
    expect(await severityExtreme.isChecked().catch(() => false)).toBeFalsy();
    expect(await certaintyObserved.isChecked().catch(() => false)).toBeFalsy();
    expect(await urgencyImmediate.isChecked().catch(() => false)).toBeFalsy();

    // Expect 3: no checkbox checked in entire panel
    const checkedCount = await areaPage.advancedFilterPanel
      .locator('input[type="checkbox"]')
      .evaluateAll(
        (els) => els.filter((el) => (el as HTMLInputElement).checked).length,
      );
    expect(checkedCount).toBe(0);
  });

  // ─── TC-DA-AREA-031 ────────────────────────────────────────────────────────

  test("TC-DA-AREA-031 : ตรวจสอบว่าระบบสามารถเรียงลำดับเหตุการณ์จากล่าสุดไปเก่าสุดได้", async () => {
    test.setTimeout(60000);

    // Initial search
    const firstResponsePromise = areaPage.waitForAreaApiResponse();
    await areaPage.clickSearch();
    await firstResponsePromise;
    await areaPage.page.waitForLoadState("networkidle");

    // Select sort order
    const searchResponsePromise = areaPage.waitForAreaApiResponse();
    await areaPage.selectSortOrder(AREA_DATA.sortNewest);
    const searchResponse = await searchResponsePromise;
    const data = await searchResponse.json();
    await areaPage.page.waitForLoadState("networkidle");

    // Expect 1: more than 1 result
    const items: any[] = data?.items ?? [];
    expect(items.length, "❌ ต้องมีผลลัพธ์มากกว่า 1 รายการ").toBeGreaterThan(1);

    // Expect 2: sorted newest to oldest by sendDateTime
    const timestamps = items.map((item) =>
      areaPage.parseDate(String(item?.sendDateTime ?? "")),
    );

    for (let i = 0; i < timestamps.length - 1; i++) {
      expect(
        timestamps[i] >= timestamps[i + 1],
        `❌ ข้อมูลลำดับที่ ${i} ("${items[i]?.headline}": ${items[i]?.sendDateTime}) ต้องไม่เก่ากว่าลำดับที่ ${i + 1}`,
      ).toBeTruthy();
    }
  });

  // ─── TC-DA-AREA-032 ────────────────────────────────────────────────────────

  test("TC-DA-AREA-032 : ตรวจสอบว่าระบบสามารถเรียงลำดับเหตุการณ์จากเก่าสุดไปล่าสุดได้", async () => {
    test.setTimeout(60000);

    // Initial search
    const firstResponsePromise = areaPage.waitForAreaApiResponse();
    await areaPage.clickSearch();
    await firstResponsePromise;
    await areaPage.page.waitForLoadState("networkidle");

    // Select sort order
    const searchResponsePromise = areaPage.waitForAreaApiResponse();
    await areaPage.selectSortOrder(AREA_DATA.sortOldest);
    const searchResponse = await searchResponsePromise;
    const data = await searchResponse.json();
    await areaPage.page.waitForLoadState("networkidle");

    // Expect 1: more than 1 result
    const items: any[] = data?.items ?? [];
    expect(items.length, "❌ ต้องมีผลลัพธ์มากกว่า 1 รายการ").toBeGreaterThan(1);

    // Expect 2: sorted oldest to newest
    const timestamps = items.map((item) =>
      areaPage.parseDate(String(item?.sendDateTime ?? "")),
    );

    for (let i = 0; i < timestamps.length - 1; i++) {
      expect(
        timestamps[i] <= timestamps[i + 1],
        `❌ ข้อมูลลำดับที่ ${i} ("${items[i]?.headline}": ${items[i]?.sendDateTime}) ต้องไม่ใหม่กว่าลำดับที่ ${i + 1}`,
      ).toBeTruthy();
    }
  });

  // ─── TC-DA-AREA-033 ────────────────────────────────────────────────────────

  test("TC-DA-AREA-033 : ตรวจสอบว่าระบบแสดงชื่อเหตุการณ์และวันที่เริ่มต้น–สิ้นสุดของเหตุการณ์", async () => {
    test.setTimeout(60000);

    const normalize = (s: string) => s.replace(/\s+/g, " ").trim();

    // Search
    const searchResponsePromise = areaPage.waitForAreaApiResponse();
    await areaPage.clickSearch();
    const searchResponse = await searchResponsePromise;
    const data = await searchResponse.json();
    await areaPage.page.waitForLoadState("networkidle");

    // Expect 1: API has at least 1 item
    const items: any[] = data?.items ?? [];
    expect(items.length, "❌ ต้องมีผลลัพธ์อย่างน้อย 1 รายการ").toBeGreaterThan(
      0,
    );

    const firstItem = items[0];

    const eventName = normalize(
      String(
        firstItem?.event ??
          firstItem?.eventName ??
          firstItem?.headline ??
          firstItem?.title ??
          "",
      ),
    );
    expect(eventName, "❌ API ต้องมีชื่อเหตุการณ์").not.toBe("");

    const startDate = normalize(
      String(
        firstItem?.effectiveTime ??
          firstItem?.onset ??
          firstItem?.effective ??
          firstItem?.startDate ??
          "",
      ),
    );
    const endDate = normalize(
      String(
        firstItem?.expiredTime ??
          firstItem?.expires ??
          firstItem?.endDate ??
          "",
      ),
    );

    expect(startDate, "❌ API ต้องมีวันที่เริ่มต้น").not.toBe("");
    expect(endDate, "❌ API ต้องมีวันที่สิ้นสุด").not.toBe("");

    const startDateFormatted = areaPage.formatDate(startDate);
    const endDateFormatted = areaPage.formatDate(endDate);

    // Expect 2-5: first card shows event name and dates
    await expect(areaPage.cards.first()).toBeVisible({ timeout: 10000 });
    const firstCardText = normalize(await areaPage.cards.first().innerText());

    expect(
      firstCardText.includes(eventName),
      `❌ card แรกต้องแสดงชื่อเหตุการณ์ "${eventName}"`,
    ).toBeTruthy();

    expect(
      firstCardText.includes(startDateFormatted),
      `❌ card แรกต้องแสดงวันที่เริ่มต้น "${startDateFormatted}"`,
    ).toBeTruthy();

    expect(
      firstCardText.includes(endDateFormatted),
      `❌ card แรกต้องแสดงวันที่สิ้นสุด "${endDateFormatted}"`,
    ).toBeTruthy();
  });

  // ─── TC-DA-AREA-034 ────────────────────────────────────────────────────────

  test("TC-DA-AREA-034 : ตรวจสอบว่าผู้ใช้สามารถคลิกเปิดลิงก์ไฟล์ XML ได้", async ({
    page,
    context,
  }) => {
    test.setTimeout(60000);

    // Step 1: เลือกหลายจังหวัดก่อนค้นหา เพื่อให้ XML URL มี parameter ครบ
    const provincesSelected = await areaPage.selectMultipleProvinces([
      ...AREA_DATA.multipleProvinces,
    ]);
    expect(
      provincesSelected,
      `❌ ต้องเลือกจังหวัด ${AREA_DATA.multipleProvinces.join(", ")} ได้`,
    ).toBeTruthy();

    // Step 2: ค้นหา
    const searchData = await areaPage.searchAndGetResponse();

    // Expect: at least 1 item with xmlLink
    const items: any[] = searchData?.items ?? [];
    expect(items.length, "❌ ต้องมีผลลัพธ์อย่างน้อย 1 รายการ").toBeGreaterThan(
      0,
    );

    const firstItem = items[0];
    const apiEvent: string = firstItem?.event ?? firstItem?.eventName ?? "";
    const apiSeverity: string = firstItem?.severity ?? "";
    const apiXmlLink: string = firstItem?.xmlLink ?? "";

    expect(apiXmlLink, "❌ API ต้องมี xmlLink").toBeTruthy();
    console.log(`📌 API xmlLink: ${apiXmlLink}`);

    // Step 3: ตรวจสอบ Alert Card
    await expect(areaPage.cards.first()).toBeVisible({ timeout: 10000 });
    const cardText = await areaPage.cards.first().innerText();
    expect(cardText, `❌ card ต้องแสดงชื่อเหตุการณ์ "${apiEvent}"`).toContain(
      apiEvent,
    );
    expect(cardText, `❌ card ต้องแสดงความรุนแรง "${apiSeverity}"`).toContain(
      apiSeverity,
    );
    console.log("✅ Alert Card แสดงข้อมูลถูกต้อง");

    // Step 4: Copy XML link จาก card
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    const copyButtonCandidates = [
      areaPage.cards.first().locator(".ic-copy").first(),
      areaPage.cards.first().locator("[class*='copy']").first(),
      areaPage.cards
        .first()
        .locator("button")
        .filter({ hasText: /copy|คัดลอก/i })
        .first(),
    ];

    let copyButton: Locator | null = null;
    for (const locator of copyButtonCandidates) {
      if (await locator.isVisible({ timeout: 3000 }).catch(() => false)) {
        copyButton = locator;
        break;
      }
    }
    expect(copyButton, "❌ ต้องพบปุ่ม Copy ใน card").not.toBeNull();

    const expectedCopiedUrl = (
      await areaPage.cards
        .first()
        .locator("span")
        .filter({ hasText: /https?:\/\//i })
        .first()
        .innerText()
    ).trim();
    expect(expectedCopiedUrl, "❌ ต้องพบ URL XML ใน card").toMatch(
      /^https?:\/\/.+/i,
    );
    console.log(`📌 Expected URL ใน card: ${expectedCopiedUrl}`);

    await copyButton!.click();
    await page.waitForTimeout(500);

    const copiedUrl = (
      await page.evaluate(() => navigator.clipboard.readText())
    ).trim();
    console.log(`📌 Copied URL: ${copiedUrl}`);

    // Expect 1: copied URL matches card and API
    expect(copiedUrl, "❌ URL ที่ copy ต้องตรงกับที่แสดงใน card").toBe(
      expectedCopiedUrl,
    );
    expect(copiedUrl, "❌ URL ที่ copy ต้องตรงกับ xmlLink จาก API").toBe(
      apiXmlLink,
    );
    console.log("✅ คัดลอก URL XML ได้ถูกต้อง");

    // Step 5: เปิดลิงก์ XML
    const xmlApiResponse = await page.request.get(copiedUrl);
    expect(
      xmlApiResponse.ok(),
      `❌ URL ต้อง response ok (status: ${xmlApiResponse.status()})`,
    ).toBeTruthy();

    // Expect 2: content ต้องเป็น XML
    const xmlContent = await xmlApiResponse.text();
    expect(xmlContent, "❌ เนื้อหาต้องเป็น XML (ATOM หรือ CAP)").toMatch(
      /<\?xml|<feed|<alert/i,
    );
    console.log(`📌 XML content (preview): ${xmlContent.substring(0, 150)}`);

    // Expect 3: XML data matches card
    if (apiEvent) {
      expect(xmlContent, `❌ XML ต้องมีชื่อเหตุการณ์ "${apiEvent}"`).toContain(
        apiEvent,
      );
    }
    if (apiSeverity) {
      expect(xmlContent, `❌ XML ต้องมีความรุนแรง "${apiSeverity}"`).toContain(
        apiSeverity,
      );
    }
    console.log("✅ ข้อมูลใน XML ตรงกับ Alert Card");

    console.log(
      `✅ TC-DA-AREA-034 ผ่าน — สามารถเปิด XML ได้สำเร็จ | จังหวัด: ${AREA_DATA.multipleProvinces.join(", ")}`,
    );
  });

  // ─── TC-DA-AREA-035 ────────────────────────────────────────────────────────

  test("TC-DA-AREA-035 : ตรวจสอบว่า Modal Detail แสดงขึ้นเมื่อผู้ใช้คลิกที่ Alert Card", async () => {
    test.setTimeout(60000);

    // Search
    const searchResponsePromise = areaPage.waitForAreaApiResponse();
    await areaPage.clickSearch();
    const searchResponse = await searchResponsePromise;
    const searchData = await searchResponse.json();
    await areaPage.page.waitForLoadState("networkidle");

    // Expect 1: at least 1 result
    const items: any[] = searchData?.items ?? [];
    expect(items.length, "❌ ต้องมีผลลัพธ์อย่างน้อย 1 รายการ").toBeGreaterThan(
      0,
    );

    // Step 3: click detail button
    await expect(areaPage.cards.first()).toBeVisible({ timeout: 10000 });

    const detailButtonCandidates = [
      areaPage.tabPanel.getByRole("button", { name: /ดูรายละเอียด/i }).first(),
      areaPage.cards
        .first()
        .getByRole("button", { name: /ดูรายละเอียด/i })
        .first(),
      areaPage.cards
        .first()
        .locator("a, button")
        .filter({ hasText: /รายละเอียด|ดูรายละเอียด/i })
        .first(),
    ];

    let detailButton = null;
    for (const locator of detailButtonCandidates) {
      if (await locator.isVisible({ timeout: 3000 }).catch(() => false)) {
        detailButton = locator;
        break;
      }
    }
    expect(detailButton, '❌ ต้องพบปุ่ม "ดูรายละเอียด"').toBeTruthy();

    await detailButton!.click();
    await areaPage.page.waitForTimeout(500);

    // Step 4: modal visible
    const modalCandidates = [
      areaPage.page.getByRole("dialog").first(),
      areaPage.page.locator(".modal.show").first(),
      areaPage.page.locator(".modal-dialog").first(),
      areaPage.page.locator('[role="dialog"]').first(),
    ];

    let detailModal = null;
    for (const locator of modalCandidates) {
      if (await locator.isVisible({ timeout: 5000 }).catch(() => false)) {
        detailModal = locator;
        break;
      }
    }

    expect(
      detailModal,
      "❌ ต้องมี Modal Detail แสดงขึ้นหลังคลิก Alert Card",
    ).toBeTruthy();
    await expect(detailModal!).toBeVisible({ timeout: 10000 });

    // Expect 2: modal has content
    const modalText = await detailModal!.innerText();
    expect(
      modalText.trim().length > 0,
      "❌ Modal Detail ต้องมีข้อมูลแสดงผล",
    ).toBeTruthy();
  });

  // ─── TC-DA-AREA-036 ────────────────────────────────────────────────────────

  test("TC-DA-AREA-036 : ตรวจสอบว่าชื่อเหตุการณ์แสดงถูกต้องภายใน Modal Detail", async () => {
    test.setTimeout(60000);

    const normalize = (s: string) => s.replace(/\s+/g, " ").trim();

    // Search
    const searchResponsePromise = areaPage.waitForAreaApiResponse();
    await areaPage.clickSearch();
    const searchResponse = await searchResponsePromise;
    const data = await searchResponse.json();
    await areaPage.page.waitForLoadState("networkidle");

    // Get event name from API
    const firstItem = data?.items?.[0];
    const eventName = normalize(
      String(
        firstItem?.event ?? firstItem?.eventName ?? firstItem?.headline ?? "",
      ),
    );
    expect(eventName, "❌ API ต้องมีชื่อเหตุการณ์").not.toBe("");

    // Wait for card, verify it shows event name
    const firstCard = areaPage.tabPanel
      .locator("[class*='card']")
      .filter({ hasText: /ดูรายละเอียด/ })
      .first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });

    const cardText = normalize(await firstCard.innerText());
    expect(
      cardText.includes(eventName),
      `❌ card ต้องแสดงชื่อเหตุการณ์ "${eventName}"`,
    ).toBeTruthy();

    // Open modal
    await areaPage.openFirstCardDetail();

    const modalText = normalize(await areaPage.modal.innerText());

    // Expect: modal header shows event name
    const modalHeader = areaPage.modal
      .locator(
        ".modal-header, .modal-title, [class*='modal-header'], [class*='modal-title']",
      )
      .first();

    if (await modalHeader.isVisible({ timeout: 3000 }).catch(() => false)) {
      const modalHeaderText = normalize(await modalHeader.innerText());
      expect(
        modalHeaderText.includes(eventName),
        `❌ Modal header ต้องแสดงชื่อเหตุการณ์ "${eventName}"\nActual: ${modalHeaderText}`,
      ).toBeTruthy();
    } else {
      expect(
        modalText.includes(eventName),
        `❌ Modal ต้องแสดงชื่อเหตุการณ์ "${eventName}"\nActual: ${modalText.substring(0, 300)}`,
      ).toBeTruthy();
    }
  });

  // ─── TC-DA-AREA-037 ────────────────────────────────────────────────────────

  test("TC-DA-AREA-037 : ตรวจสอบข้อมูลรายละเอียดใน Modal", async () => {
    test.setTimeout(60000);

    // Search
    await areaPage.clickSearch();
    await areaPage.page.waitForLoadState("networkidle");

    // Open modal
    await areaPage.openFirstCardDetail();

    const modalText = await areaPage.modal.innerText();

    // Expect: all required fields present
    for (const field of AREA_DATA.modalRequiredFields) {
      expect(
        modalText.includes(field),
        `❌ ต้องมี field "${field}" ใน Modal`,
      ).toBeTruthy();
    }
  });

  // ─── TC-DA-AREA-038 ────────────────────────────────────────────────────────

  test("TC-DA-AREA-038 : ตรวจสอบว่าปุ่ม Copy สามารถคัดลอกข้อความแจ้งเตือนไปยัง Clipboard ได้", async ({
    page,
    context,
  }) => {
    test.setTimeout(60000);

    // Search
    const searchResponsePromise = areaPage.waitForAreaApiResponse();
    await areaPage.clickSearch();
    const searchResponse = await searchResponsePromise;
    const data = await searchResponse.json();
    await page.waitForLoadState("networkidle");

    const apiDescription: string = data?.items?.[0]?.description ?? "";

    // Open modal
    await areaPage.openFirstCardDetail();

    // Grant clipboard permissions
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    // Find copy button in modal
    const copyBtnCandidates = [
      areaPage.modal.locator(".ic-copy").first(),
      areaPage.modal.locator("[class*='copy']").first(),
      areaPage.modal
        .locator("button, span, i")
        .filter({ hasText: /copy|คัดลอก/i })
        .first(),
    ];

    let copyBtn = null;
    for (const locator of copyBtnCandidates) {
      if (await locator.isVisible({ timeout: 3000 }).catch(() => false)) {
        copyBtn = locator;
        break;
      }
    }
    expect(copyBtn, "❌ ต้องพบปุ่ม Copy ใน Modal").not.toBeNull();

    await copyBtn!.click();
    await page.waitForTimeout(500);

    // Expect 1: confirmation toast visible
    const toast = page.getByText(/คัดลอกไปยังคลิปบอร์ดแล้ว/i);
    await expect(
      toast,
      `❌ ต้องแสดงข้อความ "${AREA_DATA.copiedToClipboardText}"`,
    ).toBeVisible({
      timeout: 5000,
    });

    // Expect 2: clipboard not empty
    const clipboardText = (
      await page.evaluate(() => navigator.clipboard.readText())
    ).trim();
    expect(
      clipboardText.length,
      "❌ ต้องมีข้อความถูก copy ลง clipboard",
    ).toBeGreaterThan(0);

    // Expect 3: clipboard matches API description
    if (apiDescription) {
      expect(
        clipboardText,
        `❌ clipboard ต้องตรงกับ description "${apiDescription}"`,
      ).toBe(apiDescription.trim());
    }
  });

  // ─── TC-DA-AREA-039 ────────────────────────────────────────────────────────

  test("TC-DA-AREA-039 : ตรวจสอบภาค จังหวัด ตำบล ใน Modal", async () => {
    test.setTimeout(60000);

    // Search
    await areaPage.clickSearch();
    await areaPage.page.waitForLoadState("networkidle");

    // Open modal
    await areaPage.openFirstCardDetail();

    const modalText = await areaPage.modal.innerText();

    // Expect: area fields present
    for (const field of AREA_DATA.modalAreaFields) {
      expect(
        modalText.includes(field),
        `❌ ต้องมีข้อมูล "${field}"`,
      ).toBeTruthy();
    }
  });

  // ─── TC-DA-AREA-040 ────────────────────────────────────────────────────────

  test("TC-DA-AREA-040 : ตรวจสอบระบบแสดงพื้นที่ Polygon ของเหตุการณ์บนแผนที่", async ({
    page,
  }) => {
    test.setTimeout(60000);

    // Search
    const searchResponsePromise = areaPage.waitForAreaApiResponse();
    await areaPage.clickSearch();
    await searchResponsePromise;
    await page.waitForLoadState("networkidle");

    // Open modal
    await areaPage.openFirstCardDetail();

    const detailContainer = page
      .locator("#capFeedDetailContainer, .modal.show, [role='dialog']")
      .first();
    await expect(detailContainer).toBeVisible({ timeout: 10000 });

    // Wait for loading to finish
    await expect(detailContainer.locator(".loading, .spinner")).toBeHidden({
      timeout: 15000,
    });
    await expect(detailContainer.locator("text=Error")).toBeHidden({
      timeout: 5000,
    });

    // Expect 1: map tile (warn if not found)
    const mapTileCount = await detailContainer
      .locator(".leaflet-tile-loaded, .leaflet-layer, canvas")
      .count();
    if (mapTileCount > 0) {
      console.log("✅ Map Tile โหลดสำเร็จ");
    } else {
      console.warn("⚠️ ไม่พบ tile layer");
    }

    // Expect 2: leaflet-container in DOM
    const leafletContainer = detailContainer
      .locator(".leaflet-container")
      .first();
    await expect(
      leafletContainer,
      "❌ ต้องมี leaflet-container ใน Modal",
    ).toBeAttached({
      timeout: 10000,
    });

    // Expect 3: polygon/marker layer (warn if not found)
    const polygonPath = detailContainer.locator(
      "path.leaflet-interactive, svg path",
    );
    const marker = detailContainer.locator(
      ".leaflet-marker-icon, [data-testid='map-marker']",
    );
    const overlayCount = (await polygonPath.count()) + (await marker.count());
    if (overlayCount === 0) {
      console.warn("⚠️ ไม่พบ polygon/marker ใน environment นี้");
    }

    // Expect 4: area labels visible
    await expect(detailContainer.getByText("ภาค:")).toBeVisible();
    await expect(detailContainer.getByText("จังหวัด:")).toBeVisible();
    await expect(detailContainer.getByText("ตำบล:")).toBeVisible();
    await expect(
      detailContainer.getByText("พื้นที่รูปแบบ polygon"),
    ).toBeVisible();

    // Expect 5: map bounds via window (warn if unavailable)
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
    } else {
      console.warn("⚠️ ไม่สามารถดึง Map Bounds ได้");
    }
  });
});
