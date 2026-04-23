import { type Page, type Locator, expect } from "@playwright/test";

export class AreaPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // ─── Core Locators ────────────────────────────────────────────────────────

  get tabPanel(): Locator {
    return this.page.getByRole("tabpanel", { name: "ค้นหาจากพื้นที่" });
  }

  get searchButton(): Locator {
    return this.tabPanel.getByRole("button", { name: /^ค้นหา$/ }).first();
  }

  get advancedFilterPanel(): Locator {
    return this.page
      .locator("#capAdvanceFilterArea, #capAdvanceFilterSearchByArea")
      .first();
  }

  get advancedFilterSearchButton(): Locator {
    return this.advancedFilterPanel.getByRole("button", { name: "ค้นหา" });
  }

  get cardContainer(): Locator {
    return this.page
      .locator("#capFeedAreaCardContainer, #capFeedSearchByAreaCardContainer")
      .first();
  }

  get cards(): Locator {
    return this.cardContainer.locator(".card");
  }

  get modal(): Locator {
    return this.page.getByRole("dialog").first();
  }

  get noResultMessage(): Locator {
    return this.tabPanel.getByText(
      "ไม่พบผลลัพธ์การค้นหาที่ตรงกับเงื่อนไขของคุณ"
    );
  }

  get detailButtons(): Locator {
    return this.tabPanel.getByRole("button", { name: /ดูรายละเอียด/ });
  }

  get eventSelect(): Locator {
    return this.page.locator("#eventAreaSelect").first();
  }

  get sortSelect(): Locator {
    return this.page.locator("#sortAreaSelect, #sortSelect").first();
  }

  get resetFilterButton(): Locator {
    return this.advancedFilterPanel
      .getByRole("button", { name: /ล้างตัวเลือก/i })
      .first();
  }

  // ─── Navigation ───────────────────────────────────────────────────────────

  async goto(url: string): Promise<void> {
    await this.page.goto(url);
    await this.page.waitForLoadState("networkidle");
  }

  async openAreaTab(): Promise<void> {
    const candidates: Locator[] = [
      this.page.getByRole("tab", { name: /ค้นหาจากพื้นที่/i }),
      this.page.getByRole("button", { name: /ค้นหาจากพื้นที่/i }),
      this.page.getByText("ค้นหาจากพื้นที่", { exact: true }),
    ];

    for (const locator of candidates) {
      const first = locator.first();
      if (await first.isVisible({ timeout: 5000 }).catch(() => false)) {
        await first.click();
        break;
      }
    }

    await expect(this.tabPanel).toBeVisible({ timeout: 10000 });
  }

  // ─── Province Selection ───────────────────────────────────────────────────

  async selectProvince(provinceName: string): Promise<boolean> {
    const candidates: Locator[] = [
      this.tabPanel.getByRole("combobox", { name: /จังหวัด/i }),
      this.tabPanel.locator("#provinceAreaSelect"),
      this.tabPanel.locator("#provinceSelect"),
      this.tabPanel.locator("select[name*='province' i]"),
      this.tabPanel.locator("select").first(),
    ];

    for (const selectLocator of candidates) {
      const first = selectLocator.first();
      if (!(await first.isVisible({ timeout: 3000 }).catch(() => false)))
        continue;

      const tagName = await first.evaluate((el) => el.tagName).catch(() => "");

      if (String(tagName).toLowerCase() === "select") {
        await first.selectOption({ label: provinceName });
        return true;
      }

      await first.click();
      const option = this.page
        .getByRole("option", { name: new RegExp(`^${provinceName}$`) })
        .first();

      if (await option.isVisible({ timeout: 3000 }).catch(() => false)) {
        await option.click();
        return true;
      }

      const textOption = this.page
        .locator("*")
        .filter({ hasText: new RegExp(`^${provinceName}$`) })
        .first();

      if (await textOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await textOption.click();
        return true;
      }
    }
    return false;
  }

  async selectMultipleProvinces(
    provinceNames: string[],
    selectedNativeValues: string[] = []
  ): Promise<boolean> {
    const candidates: Locator[] = [
      this.tabPanel.getByRole("combobox", { name: /จังหวัด/i }),
      this.tabPanel.locator("#provinceAreaSelect"),
      this.tabPanel.locator("#provinceSelect"),
      this.tabPanel.locator("select[name*='province' i]"),
      this.tabPanel.locator("select").first(),
    ];

    const selectOne = async (provinceName: string): Promise<boolean> => {
      for (const selectLocator of candidates) {
        const first = selectLocator.first();
        if (!(await first.isVisible({ timeout: 3000 }).catch(() => false)))
          continue;

        const tagName = await first
          .evaluate((el) => el.tagName)
          .catch(() => "");

        if (String(tagName).toLowerCase() === "select") {
          const isMultiple = await first
            .evaluate((el) => (el as HTMLSelectElement).multiple)
            .catch(() => false);

          if (isMultiple) {
            if (!selectedNativeValues.includes(provinceName))
              selectedNativeValues.push(provinceName);
            await first.selectOption(
              selectedNativeValues.map((value) => ({ label: value }))
            );
          } else {
            await first.selectOption({ label: provinceName });
          }
          return true;
        }

        await first.click();
        await this.page.waitForTimeout(300);

        const option = this.page
          .getByRole("option", { name: new RegExp(`^${provinceName}$`) })
          .first();
        if (await option.isVisible({ timeout: 3000 }).catch(() => false)) {
          await option.click();
          return true;
        }

        const textOption = this.page
          .locator("li, [role='option']")
          .filter({ hasText: new RegExp(`^${provinceName}$`) })
          .first();
        if (
          await textOption.isVisible({ timeout: 3000 }).catch(() => false)
        ) {
          await textOption.click();
          return true;
        }
      }
      return false;
    };

    for (const province of provinceNames) {
      const ok = await selectOne(province);
      if (!ok) return false;
      await this.page.waitForTimeout(500);
    }
    return true;
  }

  // ─── Region Selection ─────────────────────────────────────────────────────

  async selectRegion(regionName: string): Promise<boolean> {
    const candidates: Locator[] = [
      this.tabPanel.getByRole("combobox", { name: /ภาค/i }),
      this.tabPanel.locator("#regionAreaSelect"),
      this.tabPanel.locator("#regionSelect"),
      this.tabPanel.locator("select[name*='region' i]"),
      this.tabPanel.locator("select[id*='region' i]"),
      this.tabPanel.locator("input[placeholder*='ภาค' i]"),
      this.tabPanel.locator("input[name*='region' i]"),
    ];

    for (const selectLocator of candidates) {
      const first = selectLocator.first();
      if (!(await first.isVisible({ timeout: 3000 }).catch(() => false)))
        continue;

      const tagName = await first.evaluate((el) => el.tagName).catch(() => "");

      if (String(tagName).toLowerCase() === "select") {
        await first
          .selectOption({ label: regionName })
          .catch(async () =>
            first.selectOption({ value: regionName })
          );
        return true;
      }

      await first.click();
      await this.page.waitForTimeout(500);

      const optionCandidates = [
        this.page.getByRole("option", {
          name: new RegExp(regionName, "i"),
        }),
        this.page.locator(".select2-results__option", {
          hasText: regionName,
        }),
        this.page.locator(".dropdown-item", { hasText: regionName }),
        this.page.getByText(regionName, { exact: true }),
      ];

      for (const option of optionCandidates) {
        const optFirst = option.first();
        if (await optFirst.isVisible({ timeout: 3000 }).catch(() => false)) {
          await optFirst.click();
          return true;
        }
      }
    }
    return false;
  }

  async selectMultipleRegions(
    regionNames: string[],
    selectedNativeValues: string[] = []
  ): Promise<boolean> {
    const candidates: Locator[] = [
      this.tabPanel.getByRole("combobox", { name: /ภาค/i }),
      this.tabPanel.locator("#regionAreaSelect"),
      this.tabPanel.locator("#regionSelect"),
      this.tabPanel.locator("select[name*='region' i]"),
    ];

    const selectOne = async (regionName: string): Promise<boolean> => {
      for (const selectLocator of candidates) {
        const first = selectLocator.first();
        if (!(await first.isVisible({ timeout: 3000 }).catch(() => false)))
          continue;

        const tagName = await first
          .evaluate((el) => el.tagName)
          .catch(() => "");

        if (String(tagName).toLowerCase() === "select") {
          const isMultiple = await first.evaluate(
            (el) => (el as HTMLSelectElement).multiple
          );
          if (isMultiple) {
            if (!selectedNativeValues.includes(regionName))
              selectedNativeValues.push(regionName);
            await first.selectOption(
              selectedNativeValues.map((v) => ({ label: v }))
            );
          } else {
            await first.selectOption({ label: regionName });
          }
          return true;
        }

        await first.click();
        await this.page.waitForTimeout(300);

        const option = this.page
          .getByRole("option", { name: new RegExp(`^${regionName}$`) })
          .first();
        if (await option.isVisible({ timeout: 3000 }).catch(() => false)) {
          await option.click();
          return true;
        }

        const textOption = this.page
          .locator("li, [role='option']")
          .filter({ hasText: new RegExp(`^${regionName}$`) })
          .first();
        if (
          await textOption.isVisible({ timeout: 3000 }).catch(() => false)
        ) {
          await textOption.click();
          return true;
        }
      }
      return false;
    };

    for (const region of regionNames) {
      const ok = await selectOne(region);
      if (!ok) return false;
      await this.page.waitForTimeout(500);
    }
    return true;
  }

  // ─── Search ───────────────────────────────────────────────────────────────

  waitForAreaApiResponse() {
    return this.page.waitForResponse(
      (response) =>
        response.url().includes("/api/app/capFeed/") &&
        response.url().toLowerCase().includes("area") &&
        response.status() === 200,
      { timeout: 15000 }
    );
  }

  waitForAreaApiRequest() {
    return this.page.waitForRequest(
      (request) =>
        request.url().includes("/api/app/capFeed/") &&
        request.url().toLowerCase().includes("area"),
      { timeout: 15000 }
    );
  }

  async clickSearch(): Promise<void> {
    await this.searchButton.click();
  }

  async searchAndGetResponse() {
    const responsePromise = this.waitForAreaApiResponse();
    await this.clickSearch();
    const response = await responsePromise;
    const data = await response.json();
    await this.page.waitForLoadState("networkidle");
    return data;
  }

  // ─── Advanced Filters ─────────────────────────────────────────────────────

  async openAdvancedFilter(): Promise<boolean> {
    const candidates = [
      this.tabPanel.getByRole("button", { name: /ตัวกรองขั้นสูง/i }),
      this.tabPanel.getByText("ตัวกรองขั้นสูง", { exact: true }),
      this.tabPanel.locator("button, a, p", {
        hasText: "ตัวกรองขั้นสูง",
      }),
    ];

    for (const locator of candidates) {
      if (
        await locator
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await locator.first().click();
        await expect(this.advancedFilterPanel).toBeVisible({ timeout: 10000 });
        return true;
      }
    }
    return false;
  }

  async selectEventFilter(eventLabel: string): Promise<string> {
    await this.eventSelect.selectOption({ label: eventLabel });
    return this.eventSelect.inputValue();
  }

  async tickCheckbox(locator: Locator): Promise<void> {
    if (!(await locator.isChecked().catch(() => false))) {
      await locator.evaluate((el) => (el as HTMLInputElement).click());
    }
    await expect(locator).toBeChecked();
  }

  async getSeverityCheckbox(label: "ร้ายแรงมาก" | "ร้ายแรง"): Promise<Locator> {
    const idMap = { ร้ายแรงมาก: "#severityExtreme", ร้ายแรง: "#severitySevere" };
    const candidates = [
      this.advancedFilterPanel.locator(idMap[label]).first(),
      this.advancedFilterPanel
        .getByRole("checkbox", { name: new RegExp(label, "i") })
        .first(),
      this.advancedFilterPanel
        .locator(`label:has-text("${label}") input[type="checkbox"]`)
        .first(),
    ];
    for (const c of candidates) {
      if (await c.isVisible({ timeout: 3000 }).catch(() => false)) return c;
    }
    throw new Error(`Checkbox "${label}" not found`);
  }

  async getCertaintyCheckbox(
    label: "สังเกตการณ์" | "เป็นไปได้"
  ): Promise<Locator> {
    const idMap = {
      สังเกตการณ์: "#certaintyObserved",
      เป็นไปได้: "#certaintyPossible",
    };
    const candidates = [
      this.advancedFilterPanel.locator(idMap[label]).first(),
      this.advancedFilterPanel
        .getByRole("checkbox", { name: new RegExp(label, "i") })
        .first(),
      this.advancedFilterPanel
        .locator(`label:has-text("${label}") input[type="checkbox"]`)
        .first(),
    ];
    for (const c of candidates) {
      if (await c.isVisible({ timeout: 3000 }).catch(() => false)) return c;
    }
    throw new Error(`Checkbox "${label}" not found`);
  }

  async getUrgencyCheckbox(label: "ทันที" | "คาดหวัง"): Promise<Locator> {
    const idMap = { ทันที: "#urgencyImmediate", คาดหวัง: "#urgencyExpected" };
    const candidates = [
      this.advancedFilterPanel.locator(idMap[label]).first(),
      this.advancedFilterPanel
        .getByRole("checkbox", { name: new RegExp(label, "i") })
        .first(),
      this.advancedFilterPanel
        .locator(`label:has-text("${label}") input[type="checkbox"]`)
        .first(),
    ];
    for (const c of candidates) {
      if (await c.isVisible({ timeout: 3000 }).catch(() => false)) return c;
    }
    throw new Error(`Checkbox "${label}" not found`);
  }

  async clickAdvancedFilterSearch() {
    const responsePromise = this.waitForAreaApiResponse();
    await this.advancedFilterSearchButton.click();
    const response = await responsePromise;
    const data = await response.json();
    await this.page.waitForLoadState("networkidle");
    await this.page.waitForTimeout(500);
    return data;
  }

  async selectSortOrder(label: string): Promise<void> {
    const tagName = await this.sortSelect
      .evaluate((el) => el.tagName.toLowerCase())
      .catch(() => "");

    if (tagName === "select") {
      await this.sortSelect
        .selectOption({ label })
        .catch(async () => this.sortSelect.selectOption({ value: label }));
    } else {
      await this.sortSelect.click();
      await this.page.waitForTimeout(300);
      const candidates = [
        this.page.getByRole("option", { name: new RegExp(label, "i") }).first(),
        this.page
          .locator(".select2-results__option", { hasText: label })
          .first(),
        this.page.getByText(label, { exact: true }).first(),
      ];
      for (const c of candidates) {
        if (await c.isVisible({ timeout: 3000 }).catch(() => false)) {
          await c.click();
          return;
        }
      }
    }
  }

  // ─── Modal ────────────────────────────────────────────────────────────────

  async openFirstCardDetail(): Promise<void> {
    const firstCard = this.tabPanel
      .locator("[class*='card']")
      .filter({ hasText: /ดูรายละเอียด/ })
      .first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });
    await firstCard.getByText("ดูรายละเอียด").click();
    await expect(this.modal).toBeVisible({ timeout: 5000 });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  normalizeText(s: string): string {
    return s.replace(/\s+/g, " ").trim();
  }

  normalizeProvince(value: unknown): string {
    return this.normalizeText(
      String(value ?? "").replace(/^จังหวัด\s*/u, "")
    );
  }

  normalizeRegion(value: unknown): string {
    return this.normalizeText(String(value ?? ""));
  }

  parseDate(value: string): number {
    const text = this.normalizeText(value);
    const iso = Date.parse(text);
    if (!Number.isNaN(iso)) return iso;

    const match =
      text.match(
        /(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/
      ) ||
      text.match(
        /(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/
      );

    if (match) {
      const [, d, m, y, hh = "0", mm = "0"] = match;
      return new Date(+y, +m - 1, +d, +hh, +mm).getTime();
    }
    return NaN;
  }

  formatDate(isoDate: string): string {
    if (!isoDate) return "";
    const date = new Date(isoDate);
    return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
  }
}