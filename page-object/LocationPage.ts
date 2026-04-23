// ============================================================
// page-object/location.page.ts
// Page Object Model for the "ค้นหาจากตำแหน่ง" section
// ============================================================
//
// Auto-healing strategy applied here:
//
// 1. Tab / section opener: tries getByRole("tab") → getByRole("button") →
//    getByText() in that order — stops at the first visible match.
//    Rationale: The app uses different element types across versions.
//
// 2. Lat/Lng inputs: prefers getByRole("spinbutton", {name}) then falls
//    back to id/name/placeholder CSS selectors.
//    Rationale: Thai aria-labels are most stable; CSS attrs change more.
//
// 3. Advanced filter opener: same 3-candidate fallback as original.
//    Rationale: UI ships as button/link/paragraph depending on viewport.
//
// 4. Checkbox clicks: uses .evaluate() click to fire native change events
//    on custom-styled checkboxes that block Playwright's synthetic click.
//    Rationale: Original code did this — kept and encapsulated.
//
// 5. Dropdown sort: scoped to explicit ID with label-based selection.
//    Rationale: Label text is the most stable hook for a <select>.
//
// ============================================================

import { Page, Locator, expect } from "@playwright/test";
import { PORTAL_URL } from "../test-data/Location.data.ts";
import { REGION_TO_PROVINCES } from "../test-data/Location.data.ts";
export class LocationPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // -----------------------------------------------------------
  // Navigation
  // -----------------------------------------------------------

  async goto() {
    await this.page.goto(PORTAL_URL);
    await this.page.waitForLoadState("networkidle");
  }

  // -----------------------------------------------------------
  // Section opener — auto-healing: tries 3 locator strategies
  // -----------------------------------------------------------

  async openLocationTab() {
    const candidates: Locator[] = [
      this.page.getByRole("tab", { name: /ค้นหาจากตำแหน่ง/i }),
      this.page.getByRole("button", { name: /ค้นหาจากตำแหน่ง/i }),
      this.page.getByText("ค้นหาจากตำแหน่ง", { exact: true }),
    ];
    for (const loc of candidates) {
      if (await loc.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        await loc.first().click();
        return;
      }
    }
    throw new Error("ไม่พบ tab 'ค้นหาจากตำแหน่ง'");
  }

  // -----------------------------------------------------------
  // "ใช้ตำแหน่งปัจจุบัน" button — auto-healing: 3 strategies
  // -----------------------------------------------------------

  async clickUseCurrentLocation() {
    const candidates: Locator[] = [
      this.page.getByRole("button", { name: /ใช้ตำแหน่งปัจจุบัน/i }),
      this.page.getByText("ใช้ตำแหน่งปัจจุบัน", { exact: true }),
      this.page.locator("p", { hasText: "ใช้ตำแหน่งปัจจุบัน" }),
    ];
    for (const loc of candidates) {
      if (await loc.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        await loc.first().click();
        return;
      }
    }
    throw new Error("ไม่พบปุ่ม 'ใช้ตำแหน่งปัจจุบัน'");
  }

  // -----------------------------------------------------------
  // Lat/Lng inputs
  // Preferred: getByRole spinbutton with Thai label (aria-label)
  // Fallback: CSS id/name/placeholder selectors
  // Rationale: aria-label is the most resilient; CSS attrs vary
  // -----------------------------------------------------------

  latInput(): Locator {
    return this.page
      .getByRole("spinbutton", { name: "ละติจูด" })
      .or(
        this.page.locator(
          'input[id="lat"], input[name="Lat"], input[placeholder*="at"]',
        ),
      )
      .first();
  }

  lngInput(): Locator {
    return this.page
      .getByRole("spinbutton", { name: "ลองจิจูด" })
      .or(
        this.page.locator(
          'input[id="lng"], input[id="lon"], input[name="Lng"], input[name="Lon"], input[placeholder*="on"]',
        ),
      )
      .first();
  }

  async fillCoordinates(lat: number, lng: number) {
    await this.latInput().fill(String(lat));
    await this.lngInput().fill(String(lng));
  }

  async assertCoordinateFilled(lat: number, lng: number) {
    await expect(this.latInput()).toHaveValue(String(lat));
    await expect(this.lngInput()).toHaveValue(String(lng));
  }

  // -----------------------------------------------------------
  // Search button (main section)
  // -----------------------------------------------------------

  async clickSearch() {
    await this.page.getByRole("button", { name: "ค้นหา", exact: true }).click();
  }

  async clickSearchById() {
    await this.page.locator("#searchByLocation").click();
  }

  // -----------------------------------------------------------
  // API response waiter
  // -----------------------------------------------------------

  waitForLocationApiResponse() {
    return this.page.waitForResponse(
      (r) =>
        r.url().includes("/api/app/capFeed/getCapFeedLocationDataList") &&
        r.status() === 200,
    );
  }

  waitForLocationApiResponseWithEvent(eventId: string) {
    return this.page.waitForResponse(
      (r) =>
        r.url().includes("/api/app/capFeed/getCapFeedLocationDataList") &&
        r.url().includes(`eventId=${eventId}`) &&
        r.status() === 200,
    );
  }

  // -----------------------------------------------------------
  // Card container
  // -----------------------------------------------------------

  cards(): Locator {
    return this.page
      .locator("#capFeedLocationCardContainer")
      .first()
      .locator(".card");
  }

  async assertCardsVisible() {
    await expect(this.cards().first()).toBeVisible({ timeout: 10000 });
    const count = await this.cards().count();
    expect(count).toBeGreaterThan(0);
    return count;
  }

  // -----------------------------------------------------------
  // Section scoped locator (used for text assertions inside section)
  // -----------------------------------------------------------

  section(): Locator {
    return this.page.getByLabel("ค้นหาจากตำแหน่ง");
  }

  // -----------------------------------------------------------
  // Advanced filter opener
  // auto-healing: tries button role → text → locator with text
  // -----------------------------------------------------------

  async openAdvancedFilter() {
    const section = this.section();
    const candidates: Locator[] = [
      section.getByRole("button", { name: /ตัวกรองขั้นสูง/i }),
      section.getByText("ตัวกรองขั้นสูง", { exact: true }),
      section.locator("button, a, p", { hasText: "ตัวกรองขั้นสูง" }),
    ];
    for (const loc of candidates) {
      if (await loc.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        await loc.first().click();
        await this.page.waitForTimeout(1000); // wait for panel animation
        return;
      }
    }
    throw new Error("ไม่พบปุ่ม 'ตัวกรองขั้นสูง'");
  }

  advancedFilterPanel(): Locator {
    return this.page.locator("#capAdvanceFilterLocation");
  }

  // -----------------------------------------------------------
  // Event dropdown
  // -----------------------------------------------------------

  eventDropdown(): Locator {
    return this.page.locator("#eventLocationSelect");
  }

  async selectEventByLabel(label: string) {
    await this.page.selectOption("#eventLocationSelect", { label });
  }

  async selectEventByValue(value: string) {
    await this.page.selectOption("#eventLocationSelect", value);
  }

  async getSelectedEventId(): Promise<string> {
    return this.eventDropdown().inputValue();
  }

  // -----------------------------------------------------------
  // Severity checkboxes
  // Checkbox clicks use .evaluate() to fire native change events
  // on custom-styled elements that block synthetic Playwright clicks.
  // -----------------------------------------------------------

  async checkSeverity(id: string) {
    const cb = this.advancedFilterPanel().locator(`#${id}`).first();
    if (!(await cb.isChecked())) {
      await cb.evaluate((el) => (el as HTMLInputElement).click());
    }
    await expect(cb).toBeChecked();
    return cb;
  }

  async checkSeverityExtreme() {
    return this.checkSeverity("severityExtreme");
  }

  async checkSeveritySevere() {
    return this.checkSeverity("severitySevere");
  }

  // -----------------------------------------------------------
  // Certainty checkboxes
  // -----------------------------------------------------------

  async checkCertainty(id: string) {
    const cb = this.advancedFilterPanel().locator(`#${id}`).first();
    if (!(await cb.isChecked())) {
      await cb.evaluate((el) => (el as HTMLInputElement).click());
    }
    await expect(cb).toBeChecked();
    return cb;
  }

  async checkCertaintyObserved() {
    return this.checkCertainty("certaintyObserved");
  }

  async checkCertaintyLikely() {
    return this.checkCertainty("certaintyLikely");
  }

  // -----------------------------------------------------------
  // Urgency checkboxes
  // -----------------------------------------------------------

  async checkUrgency(id: string) {
    const cb = this.advancedFilterPanel().locator(`#${id}`).first();
    if (!(await cb.isChecked())) {
      await cb.evaluate((el) => (el as HTMLInputElement).click());
    }
    await expect(cb).toBeChecked();
    return cb;
  }

  async checkUrgencyImmediate() {
    return this.checkUrgency("urgencyImmediate");
  }

  async checkUrgencyExpected() {
    return this.checkUrgency("urgencyExpected");
  }

  // -----------------------------------------------------------
  // Advanced filter search / clear buttons
  // -----------------------------------------------------------

  async clickAdvancedSearch() {
    await this.advancedFilterPanel()
      .getByRole("button", { name: "ค้นหา" })
      .click();
  }

  async clickClearFilter() {
    await this.advancedFilterPanel()
      .getByRole("button", { name: "ล้างตัวเลือก" })
      .click();
  }

  // -----------------------------------------------------------
  // Sort dropdown
  // -----------------------------------------------------------

  sortDropdown(): Locator {
    return this.page
      .locator(
        '#sortLocationSelect, #eventTimeLocationSelect, select[id*="sort"][id*="ocation"], select[id*="time"][id*="ocation"]',
      )
      .first();
  }

  async selectSort(label: string) {
    await expect(this.sortDropdown()).toBeVisible({ timeout: 5000 });
    await this.sortDropdown().selectOption({ label });
  }

  // -----------------------------------------------------------
  // ATOM filter
  // -----------------------------------------------------------

  async clickAtomButton() {
    await this.page.getByRole("button", { name: "ATOM" }).click();
  }

  atomCopyRow(): Locator {
    return this.section().locator(".atom-copy").first();
  }

  async getAtomCopyUrl(): Promise<string> {
    return (await this.atomCopyRow().locator("span").first().innerText()).trim();
  }

  async clickAtomCopyIcon() {
    await this.atomCopyRow().locator(".ic-copy").click();
    await this.page.waitForTimeout(500);
  }

  // -----------------------------------------------------------
  // Detail modal
  // -----------------------------------------------------------

  async openFirstCardDetail() {
    const firstCard = this.cards().first();
    const btn = firstCard
      .locator("button.card-content, button:has-text('ดูรายละเอียด')")
      .first();
    await expect(btn).toBeVisible({ timeout: 10000 });
    await btn.click();
  }

  detailContainer(): Locator {
    return this.page
      .locator("#capFeedDetailContainer, .modal.show, [role='dialog']")
      .first();
  }

  modal(): Locator {
    return this.page.locator(".modal.show, [role='dialog']").first();
  }

  async assertModalVisible() {
    await expect(this.modal()).toBeVisible({ timeout: 10000 });
  }

  // -----------------------------------------------------------
  // Validation error locators
  // -----------------------------------------------------------

  latValidationError(): Locator {
    return this.page
      .locator('[data-valmsg-for="Lat"], .field-validation-error')
      .filter({ hasText: /กรุณากรอกละติจูด/ })
      .first();
  }

  lngValidationError(): Locator {
    return this.page
      .locator(
        '[data-valmsg-for="Lng"], [data-valmsg-for="Lon"], .field-validation-error',
      )
      .filter({ hasText: /กรุณากรอกลองจิจูด/ })
      .first();
  }

  latRangeError(): Locator {
    return this.page
      .locator('[data-valmsg-for="Lat"], .field-validation-error')
      .filter({ hasText: /ละติจูดต้องอยู่ระหว่าง/ })
      .first();
  }

  lngRangeError(): Locator {
    return this.page
      .locator(
        '[data-valmsg-for="Lng"], [data-valmsg-for="Lon"], .field-validation-error',
      )
      .filter({ hasText: /ลองจิจูดต้องอยู่ระหว่าง/ })
      .first();
  }

  // -----------------------------------------------------------
  // Page size dropdown (for pagination)
  // -----------------------------------------------------------

  pageSizeDropdown(): Locator {
    return this.page.locator("#pageSizeDropdown").first();
  }

  async getPageSize(): Promise<number> {
    return Number(await this.pageSizeDropdown().inputValue());
  }

  // -----------------------------------------------------------
  // Pagination: navigate to page number
  // -----------------------------------------------------------

  async goToPage(pageNumber: number) {
    await this.section()
      .locator("a.pointer.mx-1", { hasText: String(pageNumber) })
      .first()
      .click();
    await this.page.waitForTimeout(300);
  }

  // ============================================================
// 🔽 GEO UTILS (moved from geo.utils.ts)
// ============================================================

// ---------------- polygon check ----------------
private isPointInPolygon(
  lat: number,
  lng: number,
  polygonStr: string,
): boolean {
  const points = polygonStr
    .trim()
    .split(/\s+/)
    .map((p) => {
      const [pLat, pLng] = p.split(",").map(Number);
      return { lat: pLat, lng: pLng };
    })
    .filter((p) => !isNaN(p.lat) && !isNaN(p.lng));

  if (points.length < 3) return false;

  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].lng,
      yi = points[i].lat;
    const xj = points[j].lng,
      yj = points[j].lat;

    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }
  return inside;
}

// ---------------- region extract ----------------
private extractRegions(text: string): string[] {
  return Array.from(
    new Set((text.match(/ภาค[^\s,\/]+/g) ?? []).map((r) => r.trim())),
  );
}

// ⚠️ ต้อง import ตัวนี้ด้านบน
// import { REGION_TO_PROVINCES } from "../test-data/location.data";

private isProvinceInRegion(province: string, region: string): boolean {
  return (REGION_TO_PROVINCES[region] ?? []).some(
    (p) => p.includes(province) || province.includes(p),
  );
}

private isProvinceInAnyRegion(
  province: string,
  regionText: string,
): boolean {
  return this.extractRegions(regionText).some((region) =>
    this.isProvinceInRegion(province, region),
  );
}

// ---------------- GEO API ----------------
async fetchGeo(): Promise<{
  latitude: number;
  longitude: number;
  province: string;
}> {
  try {
    const res = await fetch(
      "http://ip-api.com/json/?fields=status,lat,lon,regionName&lang=th",
    );
    const data = await res.json();

    if (
      data.status === "success" &&
      typeof data.lat === "number"
    ) {
      return {
        latitude: data.lat,
        longitude: data.lon,
        province: ((data.regionName as string) ?? "")
          .replace(/^จังหวัด/, "")
          .trim(),
      };
    }
  } catch {}

  try {
    const res = await fetch("https://ipapi.co/json/");
    const data = await res.json();

    if (typeof data.latitude === "number") {
      return {
        latitude: data.latitude,
        longitude: data.longitude,
        province: ((data.region as string) ?? "")
          .replace(/^จังหวัด/, "")
          .trim(),
      };
    }
  } catch {}

  console.warn("⚠️ fallback Chiang Mai");
  return { latitude: 18.7883, longitude: 98.9853, province: "เชียงใหม่" };
}

// ---------------- coverage check ----------------
checkAreaCoverage(
  lat: number,
  lng: number,
  searchProvince: string,
  areas: Array<{
    polygon?: string | null;
    province?: string | null;
    areaDescription?: string | null;
  }>,
  itemAreaDesc?: string,
): { covered: boolean; debugLog: string[] } {
  let covered = false;
  const debugLog: string[] = [];

  for (const area of areas) {
    // polygon
    if (area.polygon) {
      const inPoly = this.isPointInPolygon(lat, lng, area.polygon);
      debugLog.push(`polygon → ${inPoly}`);
      if (inPoly) {
        covered = true;
        break;
      }
    }

    const areaProvince = (area.province ?? "").replace(/^จังหวัด/, "").trim();
    const areaDesc = (area.areaDescription ?? itemAreaDesc ?? "").trim();

    // province match
    if (areaProvince && searchProvince) {
      const match =
        areaProvince.includes(searchProvince) ||
        searchProvince.includes(areaProvince);

      debugLog.push(`province → ${match}`);
      if (match) {
        covered = true;
        break;
      }
    }

    // region match
    if (areaDesc.includes("ภาค") && searchProvince) {
      const inRegion = this.isProvinceInAnyRegion(
        searchProvince,
        areaDesc,
      );

      debugLog.push(`region → ${inRegion}`);
      if (inRegion) {
        covered = true;
        break;
      }
    }

    // direct match
    if (areaDesc && searchProvince) {
      const match =
        areaDesc.includes(searchProvince) ||
        searchProvince.includes(areaDesc);

      debugLog.push(`desc → ${match}`);
      if (match) {
        covered = true;
        break;
      }
    }
  }

  return { covered, debugLog };
}

// ---------------- time utils ----------------
toUtcPlus7Seconds(date: Date): number {
  const offset = 7 * 60 * 60 * 1000;
  const d = new Date(date.getTime() + offset);
  return d.getUTCHours() * 3600 +
         d.getUTCMinutes() * 60 +
         d.getUTCSeconds();
}

isInSecondWindow(
  displayed: number,
  start: number,
  end: number,
): boolean {
  if (start <= end) {
    return displayed >= start && displayed <= end;
  }
  return displayed >= start || displayed <= end;
}

extractItemTime(item: any): number {
  const candidates = [
    item?.sendDateTime,
    item?.sent,
    item?.effective,
    item?.onset,
    item?.alert?.sendDateTime,
    item?.alert?.sent,
    item?.alert?.effective,
    item?.alert?.onset,
  ];

  for (const c of candidates) {
    if (!c) continue;
    const t = new Date(c).getTime();
    if (!isNaN(t)) return t;
  }
  return NaN;
}
}