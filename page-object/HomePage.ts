import { expect, Locator, Page, Response } from "@playwright/test";
import { HOME_DATA, HomeCombinedFilter } from "../test-data/home.data";

export class HomePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  get countryPanel(): Locator {
    return this.page.getByLabel(HOME_DATA.COUNTRY_LABEL);
  }

  get cards(): Locator {
    return this.page
      .locator(HOME_DATA.SELECTORS.countryCardContainer)
      .locator(HOME_DATA.SELECTORS.card);
  }

  get modal(): Locator {
    return this.page.locator(HOME_DATA.SELECTORS.modal).first();
  }

  get detailContainer(): Locator {
    return this.page.locator(HOME_DATA.SELECTORS.modal).first();
  }

  async goto(): Promise<void> {
    await this.page.goto(HOME_DATA.URL);
    await this.page.waitForLoadState("networkidle");
  }

  async reload(): Promise<void> {
    await this.page.reload();
    await this.page.waitForLoadState("networkidle");
  }

  async grantClipboardPermissions(): Promise<void> {
    await this.page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);
  }

  async waitForCountryListResponse(
    predicate?: (response: Response) => boolean,
    timeout = 15000,
  ): Promise<Response> {
    return this.page.waitForResponse(
      (response) =>
        response.url().includes(HOME_DATA.API.COUNTRY_LIST) &&
        response.status() === 200 &&
        (predicate ? predicate(response) : true),
      { timeout },
    );
  }

  waitForPossibleDetailResponse(timeout = 5000): Promise<Response | null> {
    return this.page
      .waitForResponse(
        (response) =>
          response.url().includes(HOME_DATA.API.DETAIL) &&
          !response.url().includes(HOME_DATA.API.COUNTRY_LIST) &&
          response.status() === 200,
        { timeout },
      )
      .catch(() => null);
  }

  async openAdvancedFilter(): Promise<void> {
    await this.safeClick(
      this.page.getByRole("button", { name: HOME_DATA.FILTER_BUTTON }),
    );
    await this.page.waitForTimeout(300);
  }

  async openAtom(): Promise<void> {
    await this.safeClick(
      this.page.getByRole("button", { name: HOME_DATA.ATOM_BUTTON }),
    );
  }

  async clickSearch(): Promise<void> {
    await this.safeClick(
      this.page.getByRole("button", {
        name: HOME_DATA.SEARCH_BUTTON,
        exact: true,
      }),
    );
  }

  async clickReset(): Promise<void> {
    await this.safeClick(
      this.page.getByRole("button", {
        name: HOME_DATA.RESET_BUTTON,
        exact: true,
      }),
    );
  }

  async selectEventByNativeSelect(label: string): Promise<void> {
    const select = this.page.locator(HOME_DATA.SELECTORS.eventSelect);
    await expect(select).toBeVisible();
    await select.selectOption({ label });
  }

  async selectEventBySelect2(label: string): Promise<void> {
    await this.safeClick(
      this.page.getByRole("combobox", { name: HOME_DATA.EVENT_COMBOBOX }),
    );
    const dropdown = this.page.locator(HOME_DATA.SELECTORS.select2Open);
    const input = dropdown.locator(HOME_DATA.SELECTORS.select2Search);
    await expect(input).toBeVisible();
    await input.fill(label);

    const option = dropdown
      .locator(HOME_DATA.SELECTORS.select2Option, { hasText: label })
      .first();
    await expect(option).toBeVisible();
    await this.safeClick(option);
  }

  async getSelectedEventId(): Promise<string> {
    return this.page.locator(HOME_DATA.SELECTORS.eventSelect).inputValue();
  }

  async checkCheckbox(selector: string): Promise<Locator> {
    const checkbox = this.page.locator(selector).nth(0);
    await checkbox.scrollIntoViewIfNeeded();
    await checkbox.check();
    await expect(checkbox).toBeChecked();
    return checkbox;
  }

  async applySeverityFilter(): Promise<void> {
    await this.checkCheckbox(HOME_DATA.SELECTORS.severityExtreme);
    await this.checkCheckbox(HOME_DATA.SELECTORS.severitySevere);
  }

  async applyCertaintyFilter(): Promise<void> {
    await this.checkCheckbox(HOME_DATA.SELECTORS.certaintyObserved);
    await this.checkCheckbox(HOME_DATA.SELECTORS.certaintyUnknown);
  }

  async applyUrgencyFilter(): Promise<void> {
    await this.checkCheckbox(HOME_DATA.SELECTORS.urgencyImmediate);
    await this.checkCheckbox(HOME_DATA.SELECTORS.urgencyUnknown);
  }

  async applyCombinedFilter(filterData: HomeCombinedFilter): Promise<string> {
    await this.selectEventByNativeSelect(filterData.event);
    const selectedEventId = await this.getSelectedEventId();
    await this.checkCheckbox(HOME_DATA.SELECTORS.severityExtreme);
    await this.checkCheckbox(HOME_DATA.SELECTORS.certaintyObserved);
    await this.checkCheckbox(HOME_DATA.SELECTORS.urgencyImmediate);
    return selectedEventId;
  }

  async getBodyText(): Promise<string> {
    return this.page.locator("body").innerText();
  }

  async getCountryPanelText(): Promise<string> {
    await expect(this.countryPanel).toBeVisible();
    return this.countryPanel.innerText();
  }

  extractDisplayedTotal(text: string): number {
    const match = text.match(/จำนวนข้อมูลทั้งหมด:\s*([\d,]+)/);
    expect(match).not.toBeNull();
    return Number(match![1].replace(/,/g, ""));
  }

  async getDisplayedTotalFromCountryPanel(): Promise<number> {
    return this.extractDisplayedTotal(await this.getCountryPanelText());
  }

  async getPageSize(): Promise<number> {
    const pageSizeDropdown = this.countryPanel
      .locator(HOME_DATA.SELECTORS.pageSizeDropdown)
      .first();
    return Number(await pageSizeDropdown.inputValue());
  }

  async getCardCount(): Promise<number> {
    await expect(this.cards.first()).toBeVisible({ timeout: 10000 });
    return this.cards.count();
  }

  async getCardsText(): Promise<string[]> {
    const count = await this.cards.count();
    const items: string[] = [];
    for (let index = 0; index < count; index += 1) {
      items.push(await this.cards.nth(index).innerText());
    }
    return items;
  }

  async clickPagination(pageNumber: number, waitForDomChange = false): Promise<void> {
    const pageLink = this.countryPanel
      .locator(HOME_DATA.SELECTORS.paginationLink, {
        hasText: String(pageNumber),
      })
      .first();

    if (!waitForDomChange) {
      await this.safeClick(pageLink);
      await this.page.waitForTimeout(300);
      return;
    }

    const firstCardBefore = await this.cards.first().innerText();
    await this.safeClick(pageLink);
    await expect(this.cards.first()).not.toHaveText(firstCardBefore);
  }

  async sortBy(optionName: string): Promise<void> {
    await this.safeClick(
      this.page.getByRole("combobox", { name: HOME_DATA.SORT_COMBOBOX }),
    );
    await this.safeClick(this.page.getByRole("option", { name: optionName }));
  }

  async getAtomCopyRow(): Promise<Locator> {
    const row = this.countryPanel.locator(HOME_DATA.SELECTORS.atomCopyRow).first();
    await expect(row).toBeVisible();
    return row;
  }

  async clickAtomCopy(): Promise<void> {
    const row = await this.getAtomCopyRow();
    await this.safeClick(row.locator(HOME_DATA.SELECTORS.atomCopyIcon).first());
  }

  async getClipboardText(): Promise<string> {
    return this.page.evaluate(() => navigator.clipboard.readText());
  }

  async openFirstCardDetail(): Promise<void> {
    const firstCard = this.cards.first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });

    const primaryButton = firstCard.getByRole("button", {
      name: HOME_DATA.DETAIL_BUTTON,
    });

    if (await primaryButton.count()) {
      await this.safeClick(primaryButton.first());
      return;
    }

    await this.safeClick(
      firstCard.locator(HOME_DATA.SELECTORS.detailButton).first(),
    );
  }

  async getModalHeaderText(): Promise<string> {
    const header = this.modal.locator(HOME_DATA.SELECTORS.modalHeader).first();
    await expect(header).toBeVisible({ timeout: 10000 });
    return ((await header.textContent()) ?? "").trim();
  }

  async getFirstCardEventName(): Promise<string> {
    return (
      ((await this.cards
        .first()
        .locator(HOME_DATA.SELECTORS.cardEvent)
        .first()
        .textContent()) ?? "").trim()
    );
  }

  async getVisibleDetailContainer(): Promise<Locator> {
    const candidates = [
      this.page.locator("#capFeedDetailContainer").first(),
      this.page.locator(".modal.show").first(),
      this.page.locator(".modal.fade.show").first(),
      this.page.locator("[role='dialog']").first(),
      this.page.locator(".modal-dialog").first(),
    ];

    for (const candidate of candidates) {
      const visible = await candidate.isVisible().catch(() => false);
      if (visible) {
        return candidate;
      }
    }

    const labelCandidates = [
      this.page.getByText(HOME_DATA.LABELS.detail.source).first(),
      this.page.getByText(HOME_DATA.LABELS.detail.severity).first(),
      this.page.getByText(HOME_DATA.LABELS.detail.effective).first(),
    ];

    for (const label of labelCandidates) {
      const visible = await label.isVisible().catch(() => false);
      if (visible) {
        return this.page.locator("body");
      }
    }

    await this.page.waitForFunction(
      () => {
        const modal = document.querySelector(
          ".modal.show, [role='dialog'], #capFeedDetailContainer",
        );
        return modal !== null && (modal as HTMLElement).offsetParent !== null;
      },
      { timeout: 8000 },
    );

    return this.page
      .locator(".modal.show, [role='dialog'], #capFeedDetailContainer")
      .first();
  }

  async getDescriptionTextFromDetail(detailContainer: Locator): Promise<string> {
    const descriptionBlock = detailContainer
      .locator(`text=${HOME_DATA.LABELS.detail.description}`)
      .first();
    await expect(descriptionBlock).toBeVisible();
    return (
      ((await descriptionBlock
        .locator("xpath=following-sibling::*[1]")
        .textContent()) ?? "").trim()
    );
  }

  async clickCopyDescription(detailContainer: Locator): Promise<void> {
    const copyButton = detailContainer
      .locator(
        "[data-testid='btn-copy-description'], button:has-text('คัดลอก'), img",
      )
      .first();

    await expect(copyButton).toBeVisible({ timeout: 10000 });
    await this.safeClick(copyButton);
  }

  async getMapBounds():
    Promise<
      | null
      | {
          northEast: unknown;
          southWest: unknown;
          center: unknown;
          zoom: number;
        }
    > {
    return this.page.evaluate(() => {
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
  }

  toUtcPlus7Seconds(date: Date): number {
    const UTC_PLUS_7_OFFSET_MINUTES = 7 * 60;
    const utcMillis = date.getTime() + date.getTimezoneOffset() * 60_000;
    const utcPlus7 = new Date(utcMillis + UTC_PLUS_7_OFFSET_MINUTES * 60_000);

    return (
      utcPlus7.getHours() * 3600 +
      utcPlus7.getMinutes() * 60 +
      utcPlus7.getSeconds()
    );
  }

  isInSecondWindow(
    valueSeconds: number,
    startSeconds: number,
    endSeconds: number,
  ): boolean {
    if (startSeconds <= endSeconds) {
      return valueSeconds >= startSeconds && valueSeconds <= endSeconds;
    }

    return valueSeconds >= startSeconds || valueSeconds <= endSeconds;
  }

  parseThaiDate(dateText: string): Date {
    const match = dateText.match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2})/);
    if (!match) {
      return new Date("invalid");
    }

    return new Date(`${match[3]}-${match[2]}-${match[1]}T${match[4]}:00`);
  }

  async safeClick(locator: Locator): Promise<void> {
    const errors: unknown[] = [];

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await locator.waitFor({ state: "visible", timeout: 5000 });
        await locator.scrollIntoViewIfNeeded().catch(() => undefined);
        await expect(locator).toBeEnabled({ timeout: 5000 });
        await locator.click({ timeout: 5000 });
        return;
      } catch (error) {
        errors.push(error);
        await this.page.waitForTimeout(250);
      }
    }

    throw errors[errors.length - 1];
  }
}
