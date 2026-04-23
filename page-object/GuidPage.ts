import { Page, Locator, expect } from "@playwright/test";
import type { Response as PlaywrightResponse } from "@playwright/test";
import { GUID_DATA } from "../test-data/guid.data";

export class GuidPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // =========================
  // Core locators
  // =========================
  get guidTab(): Locator {
    return this.page.getByText(GUID_DATA.TEXT.TAB_NAME).first();
  }

  get guidTabPanel(): Locator {
    return this.page.getByRole("tabpanel", { name: GUID_DATA.TEXT.TAB_NAME });
  }

  get searchButton(): Locator {
    return this.page.getByRole("button", {
      name: GUID_DATA.TEXT.SEARCH_BUTTON,
      exact: true,
    });
  }

  get detailButtons(): Locator {
    return this.guidTabPanel.getByRole("button", {
      name: GUID_DATA.TEXT.DETAIL_BUTTON,
    });
  }

  get modal(): Locator {
    return this.page
      .locator(
        ".modal.show, #capFeedDetailContainer, .modal-dialog, [role='dialog']",
      )
      .first();
  }

  get detailContainer(): Locator {
    return this.page
      .locator("#capFeedDetailContainer, .modal.show, [role='dialog']")
      .first();
  }

  // =========================
  // Navigation
  // =========================
  async goto(): Promise<void> {
    await this.page.goto(GUID_DATA.URL);
    await this.page.waitForLoadState("networkidle");
  }

  async openGuidTab(): Promise<void> {
    await this.safeClick(this.guidTab);
  }

  // =========================
  // Auto-healing locators
  // =========================
  getGuidInputCandidates(): Locator[] {
    return [
      this.page.locator("#searchById").first(),
      this.page.locator("#alertId").first(),
      this.guidTabPanel.getByPlaceholder(/GUID/i).first(),
      this.guidTabPanel.getByPlaceholder(/Id/i).first(),
      this.guidTabPanel.locator('input[placeholder*="GUID"]').first(),
      this.guidTabPanel.locator('input[placeholder*="Id"]').first(),
      this.guidTabPanel.getByRole("textbox").first(),
      this.page.getByRole("textbox").first(),
    ];
  }

  async getVisibleGuidInput(): Promise<Locator> {
    for (const candidate of this.getGuidInputCandidates()) {
      const visible = await candidate.isVisible().catch(() => false);
      if (visible) {
        return candidate;
      }
    }
    throw new Error("ต้องพบช่องกรอก GUID");
  }

  async fillGuid(guid: string): Promise<void> {
    const input = await this.getVisibleGuidInput();
    await this.safeFill(input, guid);
  }

  async clearGuid(): Promise<void> {
    const input = await this.getVisibleGuidInput();
    await this.safeFill(input, "");
  }

  async expectGuidInputEmpty(): Promise<void> {
    const input = await this.getVisibleGuidInput();
    await expect(input).toHaveValue("");
  }

  // =========================
  // API helpers
  // =========================
  async waitForGuidSearchResponse(
    guid?: string,
    timeout = 15000,
  ): Promise<PlaywrightResponse> {
    return this.page.waitForResponse(
      (response) => {
        const url = response.url();
        return (
          url.includes(GUID_DATA.API.GUID_LIST) &&
          (!guid || url.includes(`guid=${guid}`)) &&
          response.status() === 200
        );
      },
      { timeout },
    );
  }

  // =========================
  // Common actions
  // =========================
  async clickSearch(): Promise<void> {
    await this.safeClick(this.searchButton);
  }

  async searchGuid(guid: string): Promise<any> {
    await this.fillGuid(guid);
    const responsePromise = this.waitForGuidSearchResponse(guid);
    await this.clickSearch();
    const response = await responsePromise;
    const data = await response.json();
    await this.page.waitForLoadState("networkidle");
    return data;
  }

  async openFirstDetail(): Promise<void> {
    const detailButton = this.detailButtons.first();
    await expect(detailButton).toBeVisible({ timeout: 10000 });
    await this.safeClick(detailButton);
  }

  async waitForModalVisible(): Promise<void> {
    await expect(this.modal).toBeVisible({ timeout: 10000 });
  }

  async grantClipboard(): Promise<void> {
    await this.page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);
  }

  async clickCopyXmlButton(): Promise<void> {
    const copyButtonCandidates: Locator[] = [
      this.guidTabPanel.locator(".ic-copy").first(),
      this.guidTabPanel.locator("[class*='copy']").first(),
      this.guidTabPanel
        .getByRole("button", { name: /copy|คัดลอก/i })
        .first(),
    ];

    const button = await this.pickVisibleLocator(
      copyButtonCandidates,
      "ต้องพบปุ่ม copy XML link",
    );
    await this.safeClick(button);
  }

  async clickCopyDescriptionButtonInModal(): Promise<void> {
    const copyButtonCandidates: Locator[] = [
      this.modal
        .locator("button, span, i")
        .filter({ hasText: /copy|คัดลอก/i })
        .first(),
      this.modal.locator(".ic-copy, [class*='copy']").first(),
    ];

    const button = await this.pickVisibleLocator(
      copyButtonCandidates,
      "ต้องพบปุ่ม Copy ใน Modal",
    );
    await this.safeClick(button);
  }

  async readClipboardText(): Promise<string> {
    return (await this.page.evaluate(() => navigator.clipboard.readText())).trim();
  }

  async getTabPanelText(): Promise<string> {
    return this.guidTabPanel.innerText();
  }

  async getModalText(): Promise<string> {
    return this.modal.innerText();
  }

  async getModalHeaderText(): Promise<string> {
    const modalHeader = this.modal
      .locator(
        ".modal-header, .modal-title, [class*='modal-header'], [class*='modal-title']",
      )
      .first();

    await expect(modalHeader, "Modal ต้องมี header").toBeVisible({
      timeout: 3000,
    });

    return (await modalHeader.innerText()).trim();
  }

  async getMapOverlayCount(): Promise<number> {
    const polygonPath = this.detailContainer.locator(
      "path.leaflet-interactive, svg path",
    );
    const marker = this.detailContainer.locator(
      ".leaflet-marker-icon, [data-testid='map-marker']",
    );
    return (await polygonPath.count()) + (await marker.count());
  }

  async getMapTileCount(): Promise<number> {
    return this.detailContainer
      .locator(".leaflet-tile-loaded, .leaflet-layer, canvas")
      .count();
  }

  async getMapBounds(): Promise<any> {
    return this.page.evaluate(() => {
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
  }

  // =========================
  // Utility helpers
  // =========================
  async safeClick(locator: Locator): Promise<void> {
    try {
      await locator.waitFor({ state: "visible", timeout: 5000 });
      await expect(locator).toBeEnabled({ timeout: 5000 });
      await locator.click();
    } catch {
      await this.page.waitForTimeout(300);
      await locator.click();
    }
  }

  async safeFill(locator: Locator, value: string): Promise<void> {
    try {
      await locator.waitFor({ state: "visible", timeout: 5000 });
      await locator.fill(value);
    } catch {
      await this.page.waitForTimeout(300);
      await locator.fill(value);
    }
  }

  async pickVisibleLocator(
    candidates: Locator[],
    errorMessage: string,
  ): Promise<Locator> {
    for (const candidate of candidates) {
      if (await candidate.isVisible().catch(() => false)) {
        return candidate;
      }
    }
    throw new Error(errorMessage);
  }

  formatDisplayDateCandidates(isoDate: string): string[] {
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
  }

  formatShortDate(isoDate: string): string {
    if (!isoDate) return "";

    const date = new Date(isoDate);

    return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
  }
}