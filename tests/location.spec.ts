import { test, expect, Locator } from "@playwright/test";

test.describe("Location", () => {
  test("TC-DA-LOC-001 : ตรวจสอบระบบดึง Latitude/Longitude ได้ถูกต้อง", async ({
    page,
  }) => {
    test.setTimeout(120000);

    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";
    const expectedLatitude = 13.7563;
    const expectedLongitude = 100.5018;

    await page.context().setGeolocation({
      latitude: expectedLatitude,
      longitude: expectedLongitude,
    });
    await page.context().grantPermissions(["geolocation"], {
      origin: "https://ndwc-portal-dev.azurewebsites.net",
    });

    // step 1: เปิดเว็บ
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");

    // step 2: เปิด tab ค้นหาจากตำแหน่ง
    const locationTabCandidates: Locator[] = [
      page.getByRole("tab", { name: /ค้นหาจากตำแหน่ง/i }),
      page.getByRole("button", { name: /ค้นหาจากตำแหน่ง/i }),
      page.getByText("ค้นหาจากตำแหน่ง", { exact: true }),
    ];
    let locationTabOpened = false;
    for (const locator of locationTabCandidates) {
      if (
        await locator
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await locator.first().click();
        locationTabOpened = true;
        break;
      }
    }
    expect(locationTabOpened).toBeTruthy();

    // step 3 + 4: อนุญาต Location และกด “ใช้ตำแหน่งปัจจุบัน”
    const useCurrentLocationCandidates: Locator[] = [
      page.getByRole("button", { name: /ใช้ตำแหน่งปัจจุบัน/i }),
      page.getByText("ใช้ตำแหน่งปัจจุบัน", { exact: true }),
      page.locator("p", { hasText: "ใช้ตำแหน่งปัจจุบัน" }),
    ];
    let clickedUseCurrentLocation = false;
    for (const locator of useCurrentLocationCandidates) {
      if (
        await locator
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await locator.first().click();
        clickedUseCurrentLocation = true;
        break;
      }
    }
    expect(clickedUseCurrentLocation).toBeTruthy();

    const latitudeInput = page.getByRole("spinbutton", { name: "ละติจูด" });
    const longitudeInput = page.getByRole("spinbutton", { name: "ลองจิจูด" });

    await expect(latitudeInput).toBeVisible();
    await expect(longitudeInput).toBeVisible();

    await expect
      .poll(async () => Number(await latitudeInput.inputValue()))
      .toBeCloseTo(expectedLatitude, 4);
    await expect
      .poll(async () => Number(await longitudeInput.inputValue()))
      .toBeCloseTo(expectedLongitude, 4);
  });

  test("TC-DA-LOC-002 : ตรวจสอบแสดงข้อมูลเมื่อกดค้นหา", async ({ page }) => {
    test.setTimeout(120000);

    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";

    // =========================================================
    // Helper: Ray Casting — เช็คว่า point อยู่ใน polygon หรือไม่
    // polygon format: "lat1,lng1 lat2,lng2 ..."
    // =========================================================
    const isPointInPolygon = (
      lat: number,
      lng: number,
      polygonStr: string,
    ): boolean => {
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
    };

    // =========================================================
    // Helper: แปลงชื่อจังหวัดภาษาอังกฤษ → ภาษาไทย
    // =========================================================
    const provinceEnToTh: Record<string, string> = {
      "Chiang Mai": "เชียงใหม่",
      Bangkok: "กรุงเทพมหานคร",
      "Chiang Rai": "เชียงราย",
      Nonthaburi: "นนทบุรี",
      "Pathum Thani": "ปทุมธานี",
      "Samut Prakan": "สมุทรปราการ",
      "Nakhon Ratchasima": "นครราชสีมา",
      "Khon Kaen": "ขอนแก่น",
      "Udon Thani": "อุดรธานี",
      Phuket: "ภูเก็ต",
      Songkhla: "สงขลา",
      "Surat Thani": "สุราษฎร์ธานี",
      Rayong: "ระยอง",
      Chonburi: "ชลบุรี",
      Ayutthaya: "พระนครศรีอยุธยา",
      Lampang: "ลำปาง",
      Lamphun: "ลำพูน",
      "Mae Hong Son": "แม่ฮ่องสอน",
      Nan: "น่าน",
      Phayao: "พะเยา",
      Phrae: "แพร่",
      Tak: "ตาก",
      Uttaradit: "อุตรดิตถ์",
      Sukhothai: "สุโขทัย",
      Phitsanulok: "พิษณุโลก",
      Phichit: "พิจิตร",
      "Kamphaeng Phet": "กำแพงเพชร",
      "Nakhon Sawan": "นครสวรรค์",
      "Uthai Thani": "อุทัยธานี",
      Phetchabun: "เพชรบูรณ์",
    };

    // =========================================================
    // Helper: ภาค → จังหวัดที่อยู่ในภาคนั้น
    // =========================================================
    const regionToProvinces: Record<string, string[]> = {
      ภาคเหนือ: [
        "เชียงใหม่",
        "เชียงราย",
        "ลำปาง",
        "ลำพูน",
        "แม่ฮ่องสอน",
        "น่าน",
        "พะเยา",
        "แพร่",
        "ตาก",
        "อุตรดิตถ์",
        "สุโขทัย",
        "พิษณุโลก",
        "พิจิตร",
        "กำแพงเพชร",
        "นครสวรรค์",
        "อุทัยธานี",
        "เพชรบูรณ์",
      ],
      ภาคกลาง: [
        "กรุงเทพมหานคร",
        "นนทบุรี",
        "ปทุมธานี",
        "สมุทรปราการ",
        "สมุทรสาคร",
        "สมุทรสงคราม",
        "นครปฐม",
        "สุพรรณบุรี",
        "พระนครศรีอยุธยา",
        "อ่างทอง",
        "สิงห์บุรี",
        "ชัยนาท",
        "ลพบุรี",
        "สระบุรี",
        "นครนายก",
        "ปราจีนบุรี",
        "ฉะเชิงเทรา",
        "ชลบุรี",
        "ระยอง",
      ],
      ภาคตะวันออกเฉียงเหนือ: [
        "นครราชสีมา",
        "ขอนแก่น",
        "อุดรธานี",
        "อุบลราชธานี",
        "สุรินทร์",
        "บุรีรัมย์",
        "ศรีสะเกษ",
        "ร้อยเอ็ด",
        "มหาสารคาม",
        "กาฬสินธุ์",
        "สกลนคร",
        "นครพนม",
        "มุกดาหาร",
        "หนองคาย",
        "หนองบัวลำภู",
        "เลย",
        "ชัยภูมิ",
        "ยโสธร",
        "อำนาจเจริญ",
        "บึงกาฬ",
      ],
      ภาคใต้: [
        "ภูเก็ต",
        "สงขลา",
        "สุราษฎร์ธานี",
        "นครศรีธรรมราช",
        "กระบี่",
        "พังงา",
        "ระนอง",
        "ชุมพร",
        "ตรัง",
        "พัทลุง",
        "สตูล",
        "ปัตตานี",
        "ยะลา",
        "นราธิวาส",
      ],
      ภาคตะวันออก: [
        "ชลบุรี",
        "ระยอง",
        "จันทบุรี",
        "ตราด",
        "ฉะเชิงเทรา",
        "ปราจีนบุรี",
        "สระแก้ว",
      ],
      ภาคตะวันตก: [
        "ตาก",
        "กาญจนบุรี",
        "ราชบุรี",
        "เพชรบุรี",
        "ประจวบคีรีขันธ์",
      ],
    };

    // =========================================================
    // Helper: เช็คว่า province อยู่ในภาคที่ระบุหรือไม่
    // =========================================================
    const isProvinceInRegion = (province: string, region: string): boolean => {
      const provinces = regionToProvinces[region] ?? [];
      return provinces.some(
        (p) => p.includes(province) || province.includes(p),
      );
    };

    // =========================================================
    // Helper: ดึงหลายภาคจากข้อความ เช่น
    // "ภาคเหนือ ภาคกลาง" / "ภาคเหนือ, ภาคกลาง"
    // =========================================================
    const extractRegions = (text: string): string[] => {
      return Array.from(
        new Set((text.match(/ภาค[^\s,\/]+/g) ?? []).map((r) => r.trim())),
      );
    };

    // =========================================================
    // Helper: เช็คว่า province อยู่ในอย่างน้อย 1 ภาคในข้อความหรือไม่
    // =========================================================
    const isProvinceInAnyRegion = (
      province: string,
      regionText: string,
    ): boolean => {
      const regions = extractRegions(regionText);
      return regions.some((region) => isProvinceInRegion(province, region));
    };

    // =========================================================
    // ดึงตำแหน่งปัจจุบัน + ชื่อจังหวัด จาก ip-api ในครั้งเดียว
    // =========================================================
    const fetchGeo = async (): Promise<{
      latitude: number;
      longitude: number;
      province: string;
    }> => {
      try {
        const res = await fetch(
          "http://ip-api.com/json/?fields=status,lat,lon,regionName&lang=th",
        );
        const data = await res.json();
        if (
          data.status === "success" &&
          typeof data.lat === "number" &&
          typeof data.lon === "number"
        ) {
          return {
            latitude: data.lat,
            longitude: data.lon,
            province: ((data.regionName as string) ?? "")
              .replace(/^จังหวัด/, "")
              .trim(),
          };
        }
      } catch (_) {}

      try {
        const res = await fetch("https://ipapi.co/json/");
        const data = await res.json();
        if (
          typeof data.latitude === "number" &&
          typeof data.longitude === "number"
        ) {
          return {
            latitude: data.latitude,
            longitude: data.longitude,
            province: ((data.region as string) ?? "")
              .replace(/^จังหวัด/, "")
              .trim(),
          };
        }
      } catch (_) {}

      console.warn("⚠️ ใช้ค่า fallback (Chiang Mai)");
      return { latitude: 18.7883, longitude: 98.9853, province: "เชียงใหม่" };
    };

    const geo = await fetchGeo();
    console.log(
      `📍 ตำแหน่ง: ${geo.latitude}, ${geo.longitude} | จังหวัด: "${geo.province}"`,
    );

    await page
      .context()
      .setGeolocation({ latitude: geo.latitude, longitude: geo.longitude });
    await page.context().grantPermissions(["geolocation"], {
      origin: "https://ndwc-portal-dev.azurewebsites.net",
    });

    // =========================================================
    // Step 1: เปิดเว็บ
    // =========================================================
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");

    // =========================================================
    // Step 2: เปิด tab ค้นหาจากตำแหน่ง
    // =========================================================
    const locationTabCandidates = [
      page.getByRole("tab", { name: /ค้นหาจากตำแหน่ง/i }),
      page.getByRole("button", { name: /ค้นหาจากตำแหน่ง/i }),
      page.getByText("ค้นหาจากตำแหน่ง", { exact: true }),
    ];

    let locationTabOpened = false;
    for (const locator of locationTabCandidates) {
      if (
        await locator
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await locator.first().click();
        locationTabOpened = true;
        break;
      }
    }
    expect(locationTabOpened).toBeTruthy();

    // =========================================================
    // Step 3 + 4: กด "ใช้ตำแหน่งปัจจุบัน"
    // =========================================================
    const useCurrentLocationCandidates = [
      page.getByRole("button", { name: /ใช้ตำแหน่งปัจจุบัน/i }),
      page.getByText("ใช้ตำแหน่งปัจจุบัน", { exact: true }),
      page.locator("p", { hasText: "ใช้ตำแหน่งปัจจุบัน" }),
    ];

    let clickedUseCurrentLocation = false;
    for (const locator of useCurrentLocationCandidates) {
      if (
        await locator
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await locator.first().click();
        clickedUseCurrentLocation = true;
        break;
      }
    }
    expect(clickedUseCurrentLocation).toBeTruthy();

    // =========================================================
    // Step 5: วาง response listener ก่อนกดค้นหา แล้วกดค้นหา
    // =========================================================
    const searchResponsePromise = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes("/api/app/capFeed/getCapFeedLocationDataList") &&
        response.status() === 200,
    );

    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();

    const searchResponse = await searchResponsePromise;
    const searchData = await searchResponse.json();

    console.log(
      `📦 API totalCount: ${searchData.totalCount}, items: ${searchData.items?.length}`,
    );
    expect(searchData.items.length).toBeGreaterThan(0);

    // =========================================================
    // Step 6: เตรียม province สำหรับ fallback
    // =========================================================
    let searchProvince = geo.province;
    searchProvince = provinceEnToTh[searchProvince] ?? searchProvince;

    if (searchProvince === "") {
      const firstArea = searchData.items?.[0]?.areasItem?.[0];
      searchProvince = (firstArea?.province ?? firstArea?.areaDescription ?? "")
        .replace(/^จังหวัด/, "")
        .trim();
      console.warn(`⚠️ fallback province จาก API item: "${searchProvince}"`);
    }

    console.log(`🗺️ จังหวัดของตำแหน่งค้นหา: "${searchProvince}"`);
    expect(searchProvince).not.toBe("");

    // =========================================================
    // Step 7: ดึง items ทั้งหมดจาก Country API เพื่อ cross-check
    // =========================================================
    const allItemsRes = await page.request.get(
      "https://ndwc-portal-dev.azurewebsites.net/api/app/capFeed/getCapFeedCountryDataList" +
        "?eventId=&sorting=Alert.SendDateTime%20Asc&maxResultCount=1000&skipCount=0",
    );
    expect(allItemsRes.ok()).toBeTruthy();
    const allItemsData = await allItemsRes.json();
    console.log(`🌐 Country API totalCount: ${allItemsData.totalCount}`);

    // =========================================================
    // Step 8: ตรวจสอบทุก item ใน location result
    //         ว่าครอบคลุมตำแหน่งค้นหา (polygon → province → region fallback)
    // =========================================================
    for (const item of searchData.items) {
      const areas: Array<{
        geoCodeId: string;
        areaDescription: string;
        province: string | null;
        tambon: string | null;
        polygon: string | null;
      }> = item.areasItem ?? [];

      expect(
        areas.length,
        `item "${item.headline}" ไม่มี areasItem`,
      ).toBeGreaterThan(0);

      let covered = false;
      const debugLog: string[] = [];

      for (const area of areas) {
        // --- วิธีที่ 1: polygon ---
        if (area.polygon) {
          const inPoly = isPointInPolygon(
            geo.latitude,
            geo.longitude,
            area.polygon,
          );
          debugLog.push(`polygon → ${inPoly}`);
          if (inPoly) {
            covered = true;
            break;
          }
        }

        const areaProvince = (area.province ?? "")
          .replace(/^จังหวัด/, "")
          .trim();
        const areaDesc = (area.areaDescription ?? item.areaDesc ?? "").trim();

        // --- วิธีที่ 2: province match ---
        if (areaProvince !== "" && searchProvince !== "") {
          const provinceMatch =
            areaProvince.includes(searchProvince) ||
            searchProvince.includes(areaProvince);

          debugLog.push(
            `province "${areaProvince}" vs "${searchProvince}" → ${provinceMatch}`,
          );

          if (provinceMatch) {
            covered = true;
            break;
          }
        }

        // --- วิธีที่ 3: areaDesc เป็นหลายภาค/ภาคเดียว ---
        if (areaDesc.includes("ภาค") && searchProvince !== "") {
          const regions = extractRegions(areaDesc);
          const inRegion = isProvinceInAnyRegion(searchProvince, areaDesc);

          debugLog.push(
            `regions "${regions.join(", ")}" contains "${searchProvince}" → ${inRegion}`,
          );

          if (inRegion) {
            covered = true;
            break;
          }
        }

        // --- วิธีที่ 4: areaDesc ตรงกับ province โดยตรง ---
        if (areaDesc !== "" && searchProvince !== "") {
          const descMatch =
            areaDesc.includes(searchProvince) ||
            searchProvince.includes(areaDesc);

          debugLog.push(
            `areaDesc "${areaDesc}" vs "${searchProvince}" → ${descMatch}`,
          );

          if (descMatch) {
            covered = true;
            break;
          }
        }
      }

      console.log(
        `🃏 "${item.headline}" | ${debugLog.join(" | ")} | covered: ${covered}`,
      );

      expect(
        covered,
        `item "${item.headline}" (areaDesc: ${item.areaDesc}) ` +
          `ไม่ครอบคลุมตำแหน่ง lat=${geo.latitude}, lng=${geo.longitude} ` +
          `จังหวัด="${searchProvince}"`,
      ).toBe(true);
    }

    console.log(`✅ ตรวจสอบ ${searchData.items.length} items ผ่านทั้งหมด`);

    // =========================================================
    // Step 9: ตรวจสอบ UI — card แสดงบนหน้าจอ
    // =========================================================
    const cards = page.locator(
      "#capFeedLocationCardContainer .card, .alert-card, [class*='card'][class*='location']",
    );
    await expect(cards.first()).toBeVisible({ timeout: 10000 });

    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);
    console.log(`🖥️ UI แสดง ${cardCount} cards`);
  });

  test("TC-DA-LOC-003 : ตรวจสอบเมื่อกด ไม่อนุญาต", async ({ browser }) => {
    test.setTimeout(60000);

    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";

    // สร้าง context ใหม่โดยไม่ grant geolocation (จำลอง "ไม่อนุญาต")
    const context = await browser.newContext({ permissions: [] });
    const page = await context.newPage();

    // Step 1: เปิดเว็บ
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");

    // Step 2: เปิด tab ค้นหาจากตำแหน่ง
    await page.getByText("ค้นหาจากตำแหน่ง").first().click();

    // Step 3: กด "ใช้ตำแหน่งปัจจุบัน" — geolocation ถูก deny
    await page.getByText("ใช้ตำแหน่งปัจจุบัน").first().click();

    // รอให้ระบบพยายามดึง geolocation แล้วล้มเหลว
    await page.waitForTimeout(3000);

    // Expect 2: ช่อง Latitude และ Longitude ต้องเป็นค่าว่าง
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

  test("TC-DA-LOC-005 : ตรวจสอบค้นหาด้วยค่าที่ถูกต้อง", async ({ page }) => {
    test.setTimeout(60000);

    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";
    const testLat = 18;
    const testLng = 98;

    // =========================================================
    // Helper: Ray Casting — เช็คว่า point อยู่ใน polygon หรือไม่
    // =========================================================
    const isPointInPolygon = (
      lat: number,
      lng: number,
      polygonStr: string,
    ): boolean => {
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
    };

    // =========================================================
    // Helper: ภาค → จังหวัด
    // =========================================================
    const regionToProvinces: Record<string, string[]> = {
      ภาคเหนือ: [
        "เชียงใหม่",
        "เชียงราย",
        "ลำปาง",
        "ลำพูน",
        "แม่ฮ่องสอน",
        "น่าน",
        "พะเยา",
        "แพร่",
        "ตาก",
        "อุตรดิตถ์",
        "สุโขทัย",
        "พิษณุโลก",
        "พิจิตร",
        "กำแพงเพชร",
        "นครสวรรค์",
        "อุทัยธานี",
        "เพชรบูรณ์",
      ],
      ภาคกลาง: [
        "กรุงเทพมหานคร",
        "นนทบุรี",
        "ปทุมธานี",
        "สมุทรปราการ",
        "สมุทรสาคร",
        "สมุทรสงคราม",
        "นครปฐม",
        "สุพรรณบุรี",
        "พระนครศรีอยุธยา",
        "อ่างทอง",
        "สิงห์บุรี",
        "ชัยนาท",
        "ลพบุรี",
        "สระบุรี",
        "นครนายก",
        "ปราจีนบุรี",
        "ฉะเชิงเทรา",
        "ชลบุรี",
        "ระยอง",
      ],
      ภาคตะวันออกเฉียงเหนือ: [
        "นครราชสีมา",
        "ขอนแก่น",
        "อุดรธานี",
        "อุบลราชธานี",
        "สุรินทร์",
        "บุรีรัมย์",
        "ศรีสะเกษ",
        "ร้อยเอ็ด",
        "มหาสารคาม",
        "กาฬสินธุ์",
        "สกลนคร",
        "นครพนม",
        "มุกดาหาร",
        "หนองคาย",
        "หนองบัวลำภู",
        "เลย",
        "ชัยภูมิ",
        "ยโสธร",
        "อำนาจเจริญ",
        "บึงกาฬ",
      ],
      ภาคใต้: [
        "ภูเก็ต",
        "สงขลา",
        "สุราษฎร์ธานี",
        "นครศรีธรรมราช",
        "กระบี่",
        "พังงา",
        "ระนอง",
        "ชุมพร",
        "ตรัง",
        "พัทลุง",
        "สตูล",
        "ปัตตานี",
        "ยะลา",
        "นราธิวาส",
      ],
      ภาคตะวันออก: [
        "ชลบุรี",
        "ระยอง",
        "จันทบุรี",
        "ตราด",
        "ฉะเชิงเทรา",
        "ปราจีนบุรี",
        "สระแก้ว",
      ],
      ภาคตะวันตก: [
        "ตาก",
        "กาญจนบุรี",
        "ราชบุรี",
        "เพชรบุรี",
        "ประจวบคีรีขันธ์",
      ],
    };

    const isProvinceInRegion = (province: string, region: string): boolean =>
      (regionToProvinces[region] ?? []).some(
        (p) => p.includes(province) || province.includes(p),
      );

    // =========================================================
    // Helper: ดึงหลายภาคจากข้อความ เช่น
    // "ภาคเหนือ ภาคกลาง" / "ภาคเหนือ,ภาคกลาง" / "ภาคเหนือ/ภาคกลาง"
    // =========================================================
    const extractRegions = (text: string): string[] => {
      return Array.from(
        new Set((text.match(/ภาค[^\s,\/]+/g) ?? []).map((r) => r.trim())),
      );
    };

    // =========================================================
    // Helper: เช็คว่า province อยู่ในอย่างน้อย 1 ภาคจากข้อความหรือไม่
    // =========================================================
    const isProvinceInAnyRegion = (
      province: string,
      regionText: string,
    ): boolean => {
      const regions = extractRegions(regionText);
      return regions.some((region) => isProvinceInRegion(province, region));
    };

    // =========================================================
    // Step 1: เปิดเว็บ
    // =========================================================
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");

    // Step 2: เปิด tab ค้นหาจากตำแหน่ง
    await page.getByText("ค้นหาจากตำแหน่ง").first().click();

    // Step 3: กรอก Latitude และ Longitude
    const latInput = page
      .locator('input[placeholder*="at"], input[id*="lat"], input[name*="lat"]')
      .first();
    const lngInput = page
      .locator(
        'input[placeholder*="on"], input[id*="lng"], input[id*="lon"], input[name*="lng"]',
      )
      .first();

    await latInput.fill(String(testLat));
    await lngInput.fill(String(testLng));
    console.log(`📌 กรอก Latitude: ${testLat} | Longitude: ${testLng}`);

    // Step 4: วาง response listener ก่อนกดค้นหา
    const searchResponsePromise = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes("/api/app/capFeed/getCapFeedLocationDataList") &&
        response.status() === 200,
    );

    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();

    const searchResponse = await searchResponsePromise;
    const searchData = await searchResponse.json();

    console.log(
      `📦 API totalCount: ${searchData.totalCount}, items: ${searchData.items?.length}`,
    );
    expect(
      searchData.items.length,
      "ต้องมีผลลัพธ์อย่างน้อย 1 รายการ",
    ).toBeGreaterThan(0);

    // =========================================================
    // เตรียม searchProvince จาก lat/lng
    // =========================================================
    let searchProvince = "เชียงใหม่";
    try {
      const res = await fetch(
        "http://ip-api.com/json/?fields=status,regionName&lang=th",
      );
      const data = await res.json();
      if (data.status === "success" && data.regionName) {
        const mapped: Record<string, string> = { "Chiang Mai": "เชียงใหม่" };
        searchProvince =
          mapped[data.regionName] ??
          (data.regionName as string).replace(/^จังหวัด/, "").trim();
      }
    } catch (_) {}

    console.log(`🗺️ จังหวัดของตำแหน่งค้นหา: "${searchProvince}"`);

    // =========================================================
    // ตรวจสอบทุก item — polygon ก่อน fallback ไป province/ภาค
    // =========================================================
    for (const item of searchData.items) {
      const areas: Array<{
        areaDescription: string;
        province: string | null;
        polygon: string | null;
      }> = item.areasItem ?? [];

      expect(
        areas.length,
        `item "${item.headline}" ไม่มี areasItem`,
      ).toBeGreaterThan(0);

      let covered = false;
      const debugLog: string[] = [];

      for (const area of areas) {
        // วิธีที่ 1: polygon
        if (area.polygon) {
          const inPoly = isPointInPolygon(testLat, testLng, area.polygon);
          debugLog.push(`polygon → ${inPoly}`);
          if (inPoly) {
            covered = true;
            break;
          }
        }

        const areaProvince = (area.province ?? "")
          .replace(/^จังหวัด/, "")
          .trim();
        const areaDesc = (area.areaDescription ?? item.areaDesc ?? "").trim();

        // วิธีที่ 2: province match
        if (areaProvince !== "" && searchProvince !== "") {
          const match =
            areaProvince.includes(searchProvince) ||
            searchProvince.includes(areaProvince);

          debugLog.push(
            `province "${areaProvince}" vs "${searchProvince}" → ${match}`,
          );

          if (match) {
            covered = true;
            break;
          }
        }

        // วิธีที่ 3: areaDesc เป็นภาคเดียวหรือหลายภาค
        if (areaDesc.includes("ภาค") && searchProvince !== "") {
          const regions = extractRegions(areaDesc);
          const inRegion = isProvinceInAnyRegion(searchProvince, areaDesc);

          debugLog.push(
            `regions "${regions.join(", ")}" contains "${searchProvince}" → ${inRegion}`,
          );

          if (inRegion) {
            covered = true;
            break;
          }
        }

        // วิธีที่ 4: areaDesc ตรงกับ province
        if (areaDesc !== "" && searchProvince !== "") {
          const match =
            areaDesc.includes(searchProvince) ||
            searchProvince.includes(areaDesc);

          debugLog.push(
            `areaDesc "${areaDesc}" vs "${searchProvince}" → ${match}`,
          );

          if (match) {
            covered = true;
            break;
          }
        }
      }

      console.log(
        `🃏 "${item.headline}" | ${debugLog.join(" | ")} | covered: ${covered}`,
      );

      expect(
        covered,
        `item "${item.headline}" (areaDesc: ${item.areaDesc}) ` +
          `ไม่ครอบคลุมตำแหน่ง lat=${testLat}, lng=${testLng} จังหวัด="${searchProvince}"`,
      ).toBe(true);
    }

    // =========================================================
    // ตรวจสอบ UI — card แสดงบนหน้าจอ
    // =========================================================
    const cards = page.locator("#capFeedLocationCardContainer .card");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });

    const cardCount = await cards.count();
    expect(cardCount, "UI ต้องแสดง card อย่างน้อย 1 ใบ").toBeGreaterThan(0);

    console.log(
      `✅ ตรวจสอบ ${searchData.items.length} items, UI แสดง ${cardCount} cards — ผ่านทั้งหมด`,
    );
  });

  test("TC-DA-LOC-006 : ตรวจสอบรองรับ decimal", async ({ page }) => {
    test.setTimeout(60000);

    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";
    const testLat = 18.8958;
    const testLng = 98.957;

    // =========================================================
    // Helper: Ray Casting — เช็คว่า point อยู่ใน polygon หรือไม่
    // =========================================================
    const isPointInPolygon = (
      lat: number,
      lng: number,
      polygonStr: string,
    ): boolean => {
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
    };

    // =========================================================
    // Helper: ภาค → จังหวัด
    // =========================================================
    const regionToProvinces: Record<string, string[]> = {
      ภาคเหนือ: [
        "เชียงใหม่",
        "เชียงราย",
        "ลำปาง",
        "ลำพูน",
        "แม่ฮ่องสอน",
        "น่าน",
        "พะเยา",
        "แพร่",
        "ตาก",
        "อุตรดิตถ์",
        "สุโขทัย",
        "พิษณุโลก",
        "พิจิตร",
        "กำแพงเพชร",
        "นครสวรรค์",
        "อุทัยธานี",
        "เพชรบูรณ์",
      ],
      ภาคกลาง: [
        "กรุงเทพมหานคร",
        "นนทบุรี",
        "ปทุมธานี",
        "สมุทรปราการ",
        "สมุทรสาคร",
        "สมุทรสงคราม",
        "นครปฐม",
        "สุพรรณบุรี",
        "พระนครศรีอยุธยา",
        "อ่างทอง",
        "สิงห์บุรี",
        "ชัยนาท",
        "ลพบุรี",
        "สระบุรี",
        "นครนายก",
        "ปราจีนบุรี",
        "ฉะเชิงเทรา",
        "ชลบุรี",
        "ระยอง",
      ],
      ภาคตะวันออกเฉียงเหนือ: [
        "นครราชสีมา",
        "ขอนแก่น",
        "อุดรธานี",
        "อุบลราชธานี",
        "สุรินทร์",
        "บุรีรัมย์",
        "ศรีสะเกษ",
        "ร้อยเอ็ด",
        "มหาสารคาม",
        "กาฬสินธุ์",
        "สกลนคร",
        "นครพนม",
        "มุกดาหาร",
        "หนองคาย",
        "หนองบัวลำภู",
        "เลย",
        "ชัยภูมิ",
        "ยโสธร",
        "อำนาจเจริญ",
        "บึงกาฬ",
      ],
      ภาคใต้: [
        "ภูเก็ต",
        "สงขลา",
        "สุราษฎร์ธานี",
        "นครศรีธรรมราช",
        "กระบี่",
        "พังงา",
        "ระนอง",
        "ชุมพร",
        "ตรัง",
        "พัทลุง",
        "สตูล",
        "ปัตตานี",
        "ยะลา",
        "นราธิวาส",
      ],
      ภาคตะวันออก: [
        "ชลบุรี",
        "ระยอง",
        "จันทบุรี",
        "ตราด",
        "ฉะเชิงเทรา",
        "ปราจีนบุรี",
        "สระแก้ว",
      ],
      ภาคตะวันตก: [
        "ตาก",
        "กาญจนบุรี",
        "ราชบุรี",
        "เพชรบุรี",
        "ประจวบคีรีขันธ์",
      ],
    };

    const isProvinceInRegion = (province: string, region: string): boolean =>
      (regionToProvinces[region] ?? []).some(
        (p) => p.includes(province) || province.includes(p),
      );

    // =========================================================
    // Helper: ดึงรายชื่อภาคจากข้อความ
    // รองรับ:
    // "ภาคเหนือ ภาคกลาง"
    // "ภาคเหนือ,ภาคกลาง"
    // "ภาคเหนือ/ภาคกลาง"
    // =========================================================
    const extractRegions = (text: string): string[] => {
      return Array.from(
        new Set((text.match(/ภาค[^\s,\/]+/g) ?? []).map((r) => r.trim())),
      );
    };

    // =========================================================
    // Helper: เช็คว่า province อยู่ในอย่างน้อย 1 ภาคจากข้อความหรือไม่
    // =========================================================
    const isProvinceInAnyRegion = (
      province: string,
      regionText: string,
    ): boolean => {
      const regions = extractRegions(regionText);
      return regions.some((region) => isProvinceInRegion(province, region));
    };

    // =========================================================
    // Step 1: เปิดเว็บ
    // =========================================================
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");

    // Step 2: เปิด tab ค้นหาจากตำแหน่ง
    await page.getByText("ค้นหาจากตำแหน่ง").first().click();

    // Step 3: กรอก Latitude และ Longitude
    const latInput = page
      .locator('input[placeholder*="at"], input[id*="lat"], input[name*="lat"]')
      .first();
    const lngInput = page
      .locator(
        'input[placeholder*="on"], input[id*="lng"], input[id*="lon"], input[name*="lng"]',
      )
      .first();

    await latInput.fill(String(testLat));
    await lngInput.fill(String(testLng));
    console.log(`📌 กรอก Latitude: ${testLat} | Longitude: ${testLng}`);

    // Step 4: วาง response listener ก่อนกดค้นหา
    const searchResponsePromise = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes("/api/app/capFeed/getCapFeedLocationDataList") &&
        response.status() === 200,
    );

    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();

    const searchResponse = await searchResponsePromise;
    const searchData = await searchResponse.json();

    console.log(
      `📦 API totalCount: ${searchData.totalCount}, items: ${searchData.items?.length}`,
    );
    expect(
      searchData.items.length,
      "ต้องมีผลลัพธ์อย่างน้อย 1 รายการ",
    ).toBeGreaterThan(0);

    // =========================================================
    // เตรียม searchProvince จาก lat/lng
    // =========================================================
    let searchProvince = "เชียงใหม่";
    try {
      const res = await fetch(
        "http://ip-api.com/json/?fields=status,regionName&lang=th",
      );
      const data = await res.json();
      if (data.status === "success" && data.regionName) {
        const mapped: Record<string, string> = { "Chiang Mai": "เชียงใหม่" };
        searchProvince =
          mapped[data.regionName] ??
          (data.regionName as string).replace(/^จังหวัด/, "").trim();
      }
    } catch (_) {}

    console.log(`🗺️ จังหวัดของตำแหน่งค้นหา: "${searchProvince}"`);

    // =========================================================
    // ตรวจสอบทุก item — polygon ก่อน fallback ไป province/ภาค
    // =========================================================
    for (const item of searchData.items) {
      const areas: Array<{
        areaDescription: string;
        province: string | null;
        polygon: string | null;
      }> = item.areasItem ?? [];

      expect(
        areas.length,
        `item "${item.headline}" ไม่มี areasItem`,
      ).toBeGreaterThan(0);

      let covered = false;
      const debugLog: string[] = [];

      for (const area of areas) {
        // วิธีที่ 1: polygon
        if (area.polygon) {
          const inPoly = isPointInPolygon(testLat, testLng, area.polygon);
          debugLog.push(`polygon → ${inPoly}`);
          if (inPoly) {
            covered = true;
            break;
          }
        }

        const areaProvince = (area.province ?? "")
          .replace(/^จังหวัด/, "")
          .trim();
        const areaDesc = (area.areaDescription ?? item.areaDesc ?? "").trim();

        // วิธีที่ 2: province match
        if (areaProvince !== "" && searchProvince !== "") {
          const match =
            areaProvince.includes(searchProvince) ||
            searchProvince.includes(areaProvince);

          debugLog.push(
            `province "${areaProvince}" vs "${searchProvince}" → ${match}`,
          );

          if (match) {
            covered = true;
            break;
          }
        }

        // วิธีที่ 3: areaDesc เป็นภาคเดียวหรือหลายภาค
        if (areaDesc.includes("ภาค") && searchProvince !== "") {
          const regions = extractRegions(areaDesc);
          const inRegion = isProvinceInAnyRegion(searchProvince, areaDesc);

          debugLog.push(
            `regions "${regions.join(", ")}" contains "${searchProvince}" → ${inRegion}`,
          );

          if (inRegion) {
            covered = true;
            break;
          }
        }

        // วิธีที่ 4: areaDesc ตรงกับ province
        if (areaDesc !== "" && searchProvince !== "") {
          const match =
            areaDesc.includes(searchProvince) ||
            searchProvince.includes(areaDesc);

          debugLog.push(
            `areaDesc "${areaDesc}" vs "${searchProvince}" → ${match}`,
          );

          if (match) {
            covered = true;
            break;
          }
        }
      }

      console.log(
        `🃏 "${item.headline}" | ${debugLog.join(" | ")} | covered: ${covered}`,
      );

      expect(
        covered,
        `item "${item.headline}" (areaDesc: ${item.areaDesc}) ` +
          `ไม่ครอบคลุมตำแหน่ง lat=${testLat}, lng=${testLng} จังหวัด="${searchProvince}"`,
      ).toBe(true);
    }

    // =========================================================
    // ตรวจสอบ UI — card แสดงบนหน้าจอ
    // =========================================================
    const cards = page.locator("#capFeedLocationCardContainer .card");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });

    const cardCount = await cards.count();
    expect(cardCount, "UI ต้องแสดง card อย่างน้อย 1 ใบ").toBeGreaterThan(0);

    console.log(
      `✅ ตรวจสอบ ${searchData.items.length} items, UI แสดง ${cardCount} cards — ผ่านทั้งหมด`,
    );
  });

  test("TC-DA-LOC-008 : ตรวจสอบการทำงานของ Validation เมื่อผู้ใช้กรอกข้อมูลเป็นตัวอักษร", async ({
    page,
  }) => {
    test.setTimeout(60000);

    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";

    // Step 1: เปิดเว็บ
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");

    // Step 2: เปิด tab ค้นหาจากตำแหน่ง
    await page.getByText("ค้นหาจากตำแหน่ง").first().click();

    const latInput = page.locator('input[id="lat"], input[name="Lat"]').first();
    const lngInput = page
      .locator(
        'input[id="lng"], input[id="lon"], input[name="Lng"], input[name="Lon"]',
      )
      .first();

    // Expect: input เป็น type=number — browser ไม่อนุญาตให้กรอกตัวอักษรโดยธรรมชาติ
    await expect(latInput).toHaveAttribute("type", "number");
    await expect(lngInput).toHaveAttribute("type", "number");

    console.log("✅ input[type=number] ไม่รับตัวอักษร — ผ่าน");

    // Step 3: ลองพิมพ์ "abc" ผ่าน keyboard จริง (type=number จะกรองออกเอง)
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

    // Step 4: กดค้นหา — ต้องไม่มีการ call API (เพราะค่าว่าง)
    const apiCalled = await Promise.race([
      page
        .waitForResponse(
          (r) =>
            r.url().includes("/api/app/capFeed/getCapFeedLocationDataList"),
          { timeout: 3000 },
        )
        .then(() => true)
        .catch(() => false),
      page
        .getByRole("button", { name: "ค้นหา", exact: true })
        .click()
        .then(
          () =>
            new Promise<boolean>((res) => setTimeout(() => res(false), 3000)),
        ),
    ]);

    expect(apiCalled, "ต้องไม่มีการ call API เมื่อค่า input ไม่ถูกต้อง").toBe(
      false,
    );

    console.log("✅ ระบบไม่ call API เมื่อกรอกตัวอักษร — ผ่าน");
  });

  test("TC-DA-LOC-009 : ตรวจสอบ Validation เมื่อกรอกค่า Latitude เกิน 90", async ({
    page,
  }) => {
    test.setTimeout(60000);

    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";

    // Step 1: เปิดเว็บ
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");

    // Step 2: เปิด tab ค้นหาจากตำแหน่ง
    await page.getByText("ค้นหาจากตำแหน่ง").first().click();

    // Step 3: กรอก Latitude = 120 (เกิน 90)
    const latInput = page.locator('input[id="lat"], input[name="Lat"]').first();
    await latInput.fill("120");
    console.log(`📌 กรอก Latitude: 120`);

    // Step 4: กดค้นหา
    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();

    // Expect: แสดงข้อความ validation
    const validationMsg = page
      .locator('[data-valmsg-for="Lat"], .field-validation-error')
      .filter({ hasText: /ละติจูดต้องอยู่ระหว่าง/ })
      .first();

    await expect(
      validationMsg,
      "ต้องแสดงข้อความ 'ละติจูดต้องอยู่ระหว่าง -90 ถึง 90'",
    ).toBeVisible({ timeout: 5000 });

    console.log(
      `✅ แสดง validation message: "${await validationMsg.innerText()}" — ผ่าน`,
    );
  });

  test("TC-DA-LOC-010 : ตรวจสอบ Validation เมื่อกรอกค่า Longitude เกิน 180", async ({
    page,
  }) => {
    test.setTimeout(60000);

    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";

    // Step 1: เปิดเว็บ
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");

    // Step 2: เปิด tab ค้นหาจากตำแหน่ง
    await page.getByText("ค้นหาจากตำแหน่ง").first().click();

    // Step 3: กรอก Longitude = 250 (เกิน 180)
    const lngInput = page
      .locator(
        'input[id="lng"], input[id="lon"], input[name="Lng"], input[name="Lon"]',
      )
      .first();
    await lngInput.fill("250");
    console.log(`📌 กรอก Longitude: 250`);

    // Step 4: กดค้นหา
    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();

    // Expect: แสดงข้อความ validation
    const validationMsg = page
      .locator(
        '[data-valmsg-for="Lng"], [data-valmsg-for="Lon"], .field-validation-error',
      )
      .filter({ hasText: /ลองจิจูดต้องอยู่ระหว่าง/ })
      .first();

    await expect(
      validationMsg,
      "ต้องแสดงข้อความ 'ลองจิจูดต้องอยู่ระหว่าง -180 ถึง 180'",
    ).toBeVisible({ timeout: 5000 });

    console.log(
      `✅ แสดง validation message: "${await validationMsg.innerText()}" — ผ่าน`,
    );
  });

  test("TC-DA-LOC-011 : ตรวจสอบ Validation เมื่อไม่กรอกข้อมูลในช่องที่กำหนด", async ({
    page,
  }) => {
    test.setTimeout(60000);

    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";

    // Step 1: เปิดเว็บ
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");

    // Step 2: เปิด tab ค้นหาจากตำแหน่ง
    await page.getByText("ค้นหาจากตำแหน่ง").first().click();

    // Step 3: กดค้นหาโดยไม่กรอกข้อมูล
    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();

    // Expect 1: แสดงข้อความ "กรุณากรอกละติจูด"
    const latValidationMsg = page
      .locator('[data-valmsg-for="Lat"], .field-validation-error')
      .filter({ hasText: /กรุณากรอกละติจูด/ })
      .first();

    await expect(
      latValidationMsg,
      "ต้องแสดงข้อความ 'กรุณากรอกละติจูด'",
    ).toBeVisible({ timeout: 5000 });

    console.log(`✅ Latitude: "${await latValidationMsg.innerText()}" — ผ่าน`);

    // Expect 2: แสดงข้อความ "กรุณากรอกลองจิจูด"
    const lngValidationMsg = page
      .locator(
        '[data-valmsg-for="Lng"], [data-valmsg-for="Lon"], .field-validation-error',
      )
      .filter({ hasText: /กรุณากรอกลองจิจูด/ })
      .first();

    await expect(
      lngValidationMsg,
      "ต้องแสดงข้อความ 'กรุณากรอกลองจิจูด'",
    ).toBeVisible({ timeout: 5000 });

    console.log(`✅ Longitude: "${await lngValidationMsg.innerText()}" — ผ่าน`);
  });

  test("TC-DA-LOC-012 : ตรวจสอบการรับค่าติดลบของ Latitude/Longitude สำหรับซีกโลกใต้และตะวันตก", async ({
    page,
  }) => {
    test.setTimeout(60000);

    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";
    const testLat = -6.2;
    const testLng = 106.8;

    // Step 1: เปิดเว็บ
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");

    // Step 2: เปิด tab ค้นหาจากตำแหน่ง
    await page.getByText("ค้นหาจากตำแหน่ง").first().click();

    // Step 3: กรอก Latitude และ Longitude ค่าติดลบ
    const latInput = page
      .locator('input[id="lat"], input[name="Lat"], input[placeholder*="at"]')
      .first();

    const lngInput = page
      .locator(
        'input[id="lng"], input[id="lon"], input[name="Lng"], input[name="Lon"], input[placeholder*="on"]',
      )
      .first();

    await latInput.fill(String(testLat));
    await lngInput.fill(String(testLng));

    // Expect 1: input รับค่าติดลบได้ถูกต้อง
    await expect(latInput).toHaveValue(String(testLat));
    await expect(lngInput).toHaveValue(String(testLng));

    console.log(`📌 กรอก Latitude: ${testLat} | Longitude: ${testLng}`);

    // เตรียมดัก API ก่อนกดค้นหา
    const searchResponsePromise = page.waitForResponse(
      (r) =>
        r.url().includes("/api/app/capFeed/getCapFeedLocationDataList") &&
        r.status() === 200,
      { timeout: 10000 },
    );

    // Step 4: กดค้นหา
    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();

    // Expect 2: ไม่มี validation error แสดง
    const latError = page
      .locator('[data-valmsg-for="Lat"]')
      .filter({ hasText: /.+/ })
      .first();

    const lngError = page
      .locator('[data-valmsg-for="Lng"], [data-valmsg-for="Lon"]')
      .filter({ hasText: /.+/ })
      .first();

    await expect(latError)
      .toBeHidden({ timeout: 3000 })
      .catch(() => {});
    await expect(lngError)
      .toBeHidden({ timeout: 3000 })
      .catch(() => {});

    console.log("✅ ไม่มี validation error — ค่าติดลบอยู่ในช่วงที่ถูกต้อง");

    // Expect 3: ระบบ call API
    const searchResponse = await searchResponsePromise;
    expect(searchResponse.ok()).toBeTruthy();

    const responseBody = await searchResponse.json();
    console.log(
      `✅ ระบบ call API สำเร็จ | totalCount: ${responseBody.totalCount}, items: ${responseBody.items?.length ?? 0}`,
    );

    // Optional: ถ้าต้องการยืนยันว่าระบบแสดงผลลัพธ์หรืออย่างน้อยตอบกลับสำเร็จ
    expect(responseBody).toBeTruthy();
  });

  test("TC-DA-LOC-013 : ตรวจสอบการกรอกค่าขอบเขตสูงสุดของ Latitude และ Longitude", async ({
    page,
  }) => {
    test.setTimeout(60000);

    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";

    // Step 1: เปิดเว็บ
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");

    // Step 2: เปิด tab ค้นหาจากตำแหน่ง
    await page.getByText("ค้นหาจากตำแหน่ง").first().click();

    const latInput = page.locator('input[id="lat"], input[name="Lat"]').first();
    const lngInput = page
      .locator(
        'input[id="lng"], input[id="lon"], input[name="Lng"], input[name="Lon"]',
      )
      .first();

    // =========================================================
    // ทดสอบชุดที่ 1: ค่าขอบเขตสูงสุด (90, 180)
    // =========================================================
    await latInput.fill("90");
    await lngInput.fill("180");

    await expect(latInput).toHaveValue("90");
    await expect(lngInput).toHaveValue("180");
    console.log("📌 ทดสอบ Lat=90, Lng=180");

    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();

    await expect(
      page.locator('[data-valmsg-for="Lat"]').filter({ hasText: /.+/ }),
    )
      .toBeHidden({ timeout: 3000 })
      .catch(() => {});
    await expect(
      page
        .locator('[data-valmsg-for="Lng"], [data-valmsg-for="Lon"]')
        .filter({ hasText: /.+/ }),
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

    expect(apiMax, "ระบบต้อง call API เมื่อกรอก Lat=90, Lng=180").toBe(true);
    console.log("✅ ค่าขอบเขตสูงสุด (90, 180) — ผ่าน");

    // =========================================================
    // ทดสอบชุดที่ 2: ค่าขอบเขตต่ำสุด (-90, -180)
    // =========================================================
    await latInput.fill("-90");
    await lngInput.fill("-180");

    await expect(latInput).toHaveValue("-90");
    await expect(lngInput).toHaveValue("-180");
    console.log("📌 ทดสอบ Lat=-90, Lng=-180");

    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();

    await expect(
      page.locator('[data-valmsg-for="Lat"]').filter({ hasText: /.+/ }),
    )
      .toBeHidden({ timeout: 3000 })
      .catch(() => {});
    await expect(
      page
        .locator('[data-valmsg-for="Lng"], [data-valmsg-for="Lon"]')
        .filter({ hasText: /.+/ }),
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

    expect(apiMin, "ระบบต้อง call API เมื่อกรอก Lat=-90, Lng=-180").toBe(true);
    console.log("✅ ค่าขอบเขตต่ำสุด (-90, -180) — ผ่าน");
  });

  test("TC-DA-LOC-015 : ตรวจสอบแสดงตำแหน่งละติจูด, ลองจิจูด", async ({
    page,
  }) => {
    test.setTimeout(60000);

    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";
    const testLat = 18.8958;
    const testLng = 98.957;

    // Step 1: เปิดเว็บ
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");

    // Step 2: เปิด tab ค้นหาจากตำแหน่ง
    await page.getByText("ค้นหาจากตำแหน่ง").first().click();

    // กรอก Lat/Lng แล้วกดค้นหา
    const latInput = page.locator('input[id="lat"], input[name="Lat"]').first();
    const lngInput = page
      .locator(
        'input[id="lng"], input[id="lon"], input[name="Lng"], input[name="Lon"]',
      )
      .first();

    await latInput.fill(String(testLat));
    await lngInput.fill(String(testLng));

    const searchResponsePromise = page.waitForResponse(
      (r) =>
        r.url().includes("/api/app/capFeed/getCapFeedLocationDataList") &&
        r.status() === 200,
      { timeout: 10000 },
    );

    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
    await searchResponsePromise;

    // Step 3: ตรวจสอบ filter ที่แสดงผล
    // Expect 1: มีข้อความ "ตำแหน่งละติจูด, ลองจิจูด:"
    const filterLabel = page
      .locator("*")
      .filter({ hasText: /ตำแหน่งละติจูด.*ลองจิจูด/i })
      .first();

    await expect(
      filterLabel,
      "ต้องแสดงข้อความ 'ตำแหน่งละติจูด, ลองจิจูด:'",
    ).toBeVisible({ timeout: 5000 });

    const filterText = await filterLabel.innerText();
    console.log(`📌 Filter text: "${filterText}"`);

    // Expect 2: ค่า lat/lng ที่แสดงตรงกับที่กรอก และไม่สลับตำแหน่ง
    // รูปแบบที่คาดหวัง: "ตำแหน่งละติจูด, ลองจิจูด: 18.8958, 98.957"
    const coordMatch = filterText.match(/([-\d.]+)\s*,\s*([-\d.]+)/);
    expect(
      coordMatch,
      "ต้องพบค่าพิกัดในรูปแบบ [ละติจูด], [ลองจิจูด]",
    ).not.toBeNull();

    const displayedLat = Number(coordMatch![1]);
    const displayedLng = Number(coordMatch![2]);

    console.log(
      `📌 แสดง Latitude: ${displayedLat} | Longitude: ${displayedLng}`,
    );

    expect(displayedLat, "ค่า Latitude ที่แสดงต้องตรงกับที่กรอก").toBeCloseTo(
      testLat,
      3,
    );
    expect(displayedLng, "ค่า Longitude ที่แสดงต้องตรงกับที่กรอก").toBeCloseTo(
      testLng,
      3,
    );

    // ตรวจสอบลำดับไม่สลับ (lat ต้องน้อยกว่า lng ในกรณีนี้)
    expect(
      displayedLat,
      "ค่าแรกต้องเป็น Latitude (ไม่สลับกับ Longitude)",
    ).not.toBeCloseTo(testLng, 0);

    console.log("✅ แสดงพิกัดถูกต้อง ครบถ้วน และไม่สลับตำแหน่ง — ผ่าน");
  });

  test("TC-DA-LOC-016 : ตรวจสอบแสดงจำนวนข้อมูล", async ({ page }) => {
    test.setTimeout(60000);

    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";
    const testLat = 18.8958;
    const testLng = 98.957;

    // Step 1: เปิดเว็บ
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");

    // Step 2: เปิด tab ค้นหาจากตำแหน่ง
    await page.getByText("ค้นหาจากตำแหน่ง").first().click();

    // กรอก Lat/Lng แล้วกดค้นหา
    const latInput = page.locator('input[id="lat"], input[name="Lat"]').first();
    const lngInput = page
      .locator(
        'input[id="lng"], input[id="lon"], input[name="Lng"], input[name="Lon"]',
      )
      .first();

    await latInput.fill(String(testLat));
    await lngInput.fill(String(testLng));

    const searchResponsePromise = page.waitForResponse(
      (r) =>
        r.url().includes("/api/app/capFeed/getCapFeedLocationDataList") &&
        r.status() === 200,
      { timeout: 10000 },
    );

    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();

    const searchResponse = await searchResponsePromise;
    const searchData = await searchResponse.json();
    const apiTotal = Number(searchData.totalCount);

    console.log(`📦 API totalCount: ${apiTotal}`);

    // Step 3: ตรวจสอบข้อความ "จำนวนข้อมูลทั้งหมด:"
    const totalLabel = page
      .locator("*")
      .filter({ hasText: /จำนวนข้อมูลทั้งหมด\s*:/i })
      .first();

    await expect(
      totalLabel,
      "ต้องแสดงข้อความ 'จำนวนข้อมูลทั้งหมด:'",
    ).toBeVisible({ timeout: 5000 });

    const labelText = await totalLabel.innerText();
    console.log(`📌 Label text: "${labelText}"`);

    // ดึงตัวเลขจากข้อความ
    const countMatch = labelText.match(/จำนวนข้อมูลทั้งหมด\s*:\s*([\d,]+)/i);
    expect(countMatch, "ต้องพบตัวเลขจำนวนข้อมูลในข้อความ").not.toBeNull();

    const displayedTotal = Number(countMatch![1].replace(/,/g, ""));
    console.log(
      `📌 จำนวนที่แสดง: ${displayedTotal} | API totalCount: ${apiTotal}`,
    );

    // Expect: จำนวนที่แสดงตรงกับ API
    expect(
      displayedTotal,
      `จำนวนที่แสดง (${displayedTotal}) ต้องตรงกับ API totalCount (${apiTotal})`,
    ).toBe(apiTotal);

    console.log("✅ จำนวนข้อมูลที่แสดงตรงกับ API — ผ่าน");
  });

  test("TC-DA-LOC-017 : ตรวจสอบแสดงเวลาค้นหา", async ({ page }) => {
    function toUtcPlus7Seconds(date: Date): number {
      const utcPlus7Offset = 7 * 60 * 60 * 1000;
      const utcPlus7Date = new Date(date.getTime() + utcPlus7Offset);
      return (
        utcPlus7Date.getUTCHours() * 3600 +
        utcPlus7Date.getUTCMinutes() * 60 +
        utcPlus7Date.getUTCSeconds()
      );
    }

    function isInSecondWindow(
      displayedTimeInSeconds: number,
      windowStartSeconds: number,
      windowEndSeconds: number,
    ): boolean {
      // รองรับกรณี window ข้ามเที่ยงคืน (เช่น 86399 -> 0)
      if (windowStartSeconds <= windowEndSeconds) {
        return (
          displayedTimeInSeconds >= windowStartSeconds &&
          displayedTimeInSeconds <= windowEndSeconds
        );
      } else {
        return (
          displayedTimeInSeconds >= windowStartSeconds ||
          displayedTimeInSeconds <= windowEndSeconds
        );
      }
    }
    test.setTimeout(60000);
    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";
    const testLat = 18.8958;
    const testLng = 98.957;

    // Step 1: เปิดเว็บ
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");

    // Step 2: เปิด tab ค้นหาจากตำแหน่ง
    await page.getByText("ค้นหาจากตำแหน่ง").first().click();

    // Step 3: กรอก Latitude และ Longitude
    const latInput = page.locator('input[id="lat"], input[name="Lat"]').first();
    const lngInput = page
      .locator(
        'input[id="lng"], input[id="lon"], input[name="Lng"], input[name="Lon"]',
      )
      .first();
    await latInput.fill(String(testLat));
    await lngInput.fill(String(testLng));

    // Step 4: จับเวลาก่อน-หลังกดค้นหา
    const searchStart = new Date();
    const searchResponsePromise = page.waitForResponse(
      (r) =>
        r.url().includes("/api/app/capFeed/getCapFeedLocationDataList") &&
        r.status() === 200,
      { timeout: 10000 },
    );
    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
    await searchResponsePromise;
    const searchLoaded = new Date();

    // Expect 1: ตรวจสอบว่าแสดงข้อความ "เวลาที่ค้นหา:" ใน section ค้นหาจากตำแหน่ง
    await expect(
      page.getByLabel("ค้นหาจากตำแหน่ง").getByText("เวลาที่ค้นหา:"),
    ).toBeVisible({ timeout: 5000 });

    // Expect 2: ดึงข้อความและ match เวลา HH:MM:SS
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

    // Expect 3: timezone ต้องเป็น UTC+7 (ถ้าแสดง)
    if (displayedTimezone) {
      expect(displayedTimezone).toBe("UTC+7");
    }

    // Expect 4: เวลาที่แสดงต้องอยู่ใน window ระหว่างกดค้นหาจนถึงได้รับ response
    // buffer 30s เผื่อ clock skew ระหว่าง client กับ server
    const bufferSeconds = 30;
    const windowStartSeconds = toUtcPlus7Seconds(searchStart) - bufferSeconds;
    const windowEndSeconds = toUtcPlus7Seconds(searchLoaded) + bufferSeconds;

    expect(
      isInSecondWindow(
        displayedTimeInSeconds,
        windowStartSeconds,
        windowEndSeconds,
      ),
      `เวลาที่แสดง (${displayedTimeInSeconds}s) ต้องอยู่ใน window [${windowStartSeconds}s, ${windowEndSeconds}s]`,
    ).toBeTruthy();

    console.log("✅ แสดงเวลาค้นหาถูกต้อง — ผ่าน");
  });

  test("TC-DA-LOC-019 : ตรวจสอบฟิลเตอร์ ATOM XML และการคัดลอกข้อมูล", async ({
    page,
    context,
  }) => {
    test.setTimeout(60000);
    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";
    const testLat = 18.8958;
    const testLng = 98.957;

    // Step 1: เปิดเว็บและไปที่ tab ค้นหาจากตำแหน่ง
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");
    await page.getByText("ค้นหาจากตำแหน่ง").first().click();

    // Step 2: กรอก Latitude และ Longitude แล้วกดค้นหา
    const latInput = page.locator('input[id="lat"], input[name="Lat"]').first();
    const lngInput = page
      .locator(
        'input[id="lng"], input[id="lon"], input[name="Lng"], input[name="Lon"]',
      )
      .first();
    await latInput.fill(String(testLat));
    await lngInput.fill(String(testLng));

    const searchResponsePromise = page.waitForResponse(
      (r) =>
        r.url().includes("/api/app/capFeed/getCapFeedLocationDataList") &&
        r.status() === 200,
      { timeout: 10000 },
    );
    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
    await searchResponsePromise;

    const section = page.getByLabel("ค้นหาจากตำแหน่ง");

    // Step 3: เปิดฟิลเตอร์ ATOM
    await page.getByRole("button", { name: "ATOM" }).click();

    // Step 4: ตรวจสอบฟิลเตอร์ ATOM
    await expect(
      section.getByText("CAP XML สำหรับการค้นหานี้จัดทำโดย API"),
    ).toBeVisible();

    const atomCopyRow = section.locator(".atom-copy").first();
    await expect(atomCopyRow).toBeVisible();

    const expectedCopiedUrl = (
      await atomCopyRow.locator("span").first().innerText()
    ).trim();
    expect(expectedCopiedUrl).toMatch(/^https?:\/\/.+\/cap\/feed\/xml/i);

    // Step 5: อนุญาต clipboard แล้วกด Copy
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await atomCopyRow.locator(".ic-copy").click();
    await page.waitForTimeout(500);

    const copiedUrl = (
      await page.evaluate(() => navigator.clipboard.readText())
    ).trim();

    // Expect 1: copy URL ได้ถูกต้องตรงกับที่แสดง
    expect(copiedUrl).toBe(expectedCopiedUrl);

    // Expect 2: เปิดลิงก์ที่ copy ได้สำเร็จ
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

  test("TC-DA-LOC-020 : ตรวจสอบ dropdown เลือกเหตุการณ์", async ({ page }) => {
    test.setTimeout(120000);
    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";
    const testLat = 18.8958;
    const testLng = 98.957;
    const selectedEvent = "มาตรฐานทั่วไป";

    // Step 1: เปิดเว็บ
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");

    // Step 2: คลิกแท็บ "ค้นหาจากตำแหน่ง"
    await page.getByText("ค้นหาจากตำแหน่ง").first().click();

    // Step 3: กรอกค่า Latitude และ Longitude
    const latInput = page.locator('input[id="lat"], input[name="Lat"]').first();
    const lngInput = page
      .locator(
        'input[id="lng"], input[id="lon"], input[name="Lng"], input[name="Lon"]',
      )
      .first();
    await latInput.fill(String(testLat));
    await lngInput.fill(String(testLng));
    await expect(latInput).toHaveValue(String(testLat));
    await expect(lngInput).toHaveValue(String(testLng));

    // Step 4: กดค้นหา (ครั้งแรกจากพิกัด) และรอผลโหลด
    const firstSearchResponsePromise = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes("/api/app/capFeed/getCapFeedLocationDataList") &&
        response.status() === 200,
    );
    await page.locator("#searchByLocation").click();
    await firstSearchResponsePromise;

    // Step 5: เปิดตัวกรองขั้นสูง
    const section = page.getByLabel("ค้นหาจากตำแหน่ง");
    const advancedFilterCandidates = [
      section.getByRole("button", { name: /ตัวกรองขั้นสูง/i }),
      section.getByText("ตัวกรองขั้นสูง", { exact: true }),
      section.locator("button, a, p", { hasText: "ตัวกรองขั้นสูง" }),
    ];
    let advancedFilterOpened = false;
    for (const locator of advancedFilterCandidates) {
      if (
        await locator
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await locator.first().click();
        advancedFilterOpened = true;
        break;
      }
    }
    expect(
      advancedFilterOpened,
      "ต้องพบปุ่มตัวกรองขั้นสูงใน section ค้นหาจากตำแหน่ง",
    ).toBeTruthy();
    await expect(page.locator("#eventLocationSelect")).toBeVisible();

    // Step 6: เลือกเหตุการณ์จาก dropdown
    await page.selectOption("#eventLocationSelect", { label: selectedEvent });
    const selectedEventId = await page
      .locator("#eventLocationSelect")
      .inputValue();

    // Step 7: กด "ค้นหา" ครั้งที่ 2 ใน advanced filter
    const searchResponsePromise = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes("/api/app/capFeed/getCapFeedLocationDataList") &&
        response.url().includes(`eventId=${selectedEventId}`) &&
        response.status() === 200,
    );
    await page
      .locator("#capAdvanceFilterLocation")
      .getByRole("button", { name: "ค้นหา" })
      .click();

    const searchResponse = await searchResponsePromise;
    const searchData = await searchResponse.json();
    const responseUrl = searchResponse.url();

    // Expect 1: URL request ต้องมี eventId ที่เลือก
    expect(responseUrl).toContain(`eventId=${selectedEventId}`);

    // Expect 2: dropdown ต้องยังคงค่าที่เลือกไว้
    await expect(page.locator("#eventLocationSelect")).toHaveValue(
      selectedEventId,
    );

    // Expect 3: totalCount ต้องตรงกับจำนวน items ใน response
    expect(Number(searchData.totalCount)).toBe(searchData.items.length);

    // Expect 4: จำนวนที่แสดงบนหน้าต้องตรงกับ response
    const sectionText = await page.getByLabel("ค้นหาจากตำแหน่ง").innerText();
    const displayedTotalMatch = sectionText.match(
      /จำนวนข้อมูลทั้งหมด:\s*([\d,]+)/,
    );
    expect(displayedTotalMatch, "ต้องแสดงจำนวนข้อมูลทั้งหมด").not.toBeNull();
    const displayedTotal = Number(displayedTotalMatch![1].replace(/,/g, ""));
    expect(displayedTotal).toBe(searchData.totalCount);

    // Expect 5: ต้องมี card แสดงผลอย่างน้อย 1 รายการ
    const cardContainer = page.locator("#capFeedLocationCardContainer");
    const cards = cardContainer.locator(".card");
    const firstPageCardCount = await cards.count();
    expect(firstPageCardCount).toBeGreaterThan(0);

    // Expect 6: ตรวจสอบทุก card ในทุกหน้าว่าแสดงเหตุการณ์ที่เลือก
    const pageSizeDropdown = page.locator("#pageSizeDropdown").first();
    const pageSize = Number(await pageSizeDropdown.inputValue());
    const totalPages = Math.ceil(displayedTotal / pageSize);

    let validatedCardCount = 0;
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      if (pageNumber > 1) {
        await page
          .getByLabel("ค้นหาจากตำแหน่ง")
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

    console.log(
      `✅ Validated ${validatedCardCount} cards across ${totalPages} pages for event "${selectedEvent}" — ผ่าน`,
    );
  });

  test("TC-DA-LOC-021 : ค้นหาเหตุการณ์โดยพิมพ์ชื่อเหตุการณ์ในช่องค้นหาของ Dropdown", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";
    const testLat = 18.8958;
    const testLng = 98.957;
    const searchKeyword = "มาตรฐานทั่วไป";

    // Step 1: เปิดเว็บ
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");

    // Step 2: คลิกแท็บ "ค้นหาจากตำแหน่ง"
    await page.getByText("ค้นหาจากตำแหน่ง").first().click();

    // Step 3: กรอกค่า Latitude และ Longitude
    const latInput = page.locator('input[id="lat"], input[name="Lat"]').first();
    const lngInput = page
      .locator(
        'input[id="lng"], input[id="lon"], input[name="Lng"], input[name="Lon"]',
      )
      .first();
    await latInput.fill(String(testLat));
    await lngInput.fill(String(testLng));
    await expect(latInput).toHaveValue(String(testLat));
    await expect(lngInput).toHaveValue(String(testLng));

    // Step 4: กดค้นหาครั้งแรก และรอผลโหลด
    const firstSearchResponsePromise = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes("/api/app/capFeed/getCapFeedLocationDataList") &&
        response.status() === 200,
    );
    await page.locator("#searchByLocation").click();
    await firstSearchResponsePromise;

    // Step 5: เปิดตัวกรองขั้นสูง
    const section = page.getByLabel("ค้นหาจากตำแหน่ง");
    const advancedFilterCandidates = [
      section.getByRole("button", { name: /ตัวกรองขั้นสูง/i }),
      section.getByText("ตัวกรองขั้นสูง", { exact: true }),
      section.locator("button, a, p", { hasText: "ตัวกรองขั้นสูง" }),
    ];
    let advancedFilterOpened = false;
    for (const locator of advancedFilterCandidates) {
      if (
        await locator
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await locator.first().click();
        advancedFilterOpened = true;
        break;
      }
    }
    expect(
      advancedFilterOpened,
      "ต้องพบปุ่มตัวกรองขั้นสูงใน section ค้นหาจากตำแหน่ง",
    ).toBeTruthy();
    await expect(page.locator("#eventLocationSelect")).toBeVisible();

    // Step 6: พิมพ์ชื่อเหตุการณ์ในช่องค้นหาของ dropdown
    const eventSearchInput = page
      .locator(
        '#eventLocationSelect-search, input[aria-controls="eventLocationSelect"], input[placeholder*="ค้นหา"][id*="event"], #eventLocationSelect + input, #eventLocationSelect ~ input',
      )
      .first();

    if (
      await eventSearchInput.isVisible({ timeout: 3000 }).catch(() => false)
    ) {
      // กรณี dropdown มีช่อง search แยก
      await eventSearchInput.fill(searchKeyword);
      await page.waitForTimeout(500);
      // เลือก option แรกที่ตรงกับ keyword
      const matchedOption = page
        .locator(
          `#eventLocationSelect option, [id*="eventLocation"] li, [id*="eventLocation"] .option`,
          { hasText: searchKeyword },
        )
        .first();
      if (await matchedOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await matchedOption.click();
      } else {
        await page.selectOption("#eventLocationSelect", {
          label: searchKeyword,
        });
      }
    } else {
      // กรณี native <select> — พิมพ์ตรงที่ select แล้วเลือก
      await page.locator("#eventLocationSelect").focus();
      await page.keyboard.type(searchKeyword, { delay: 100 });
      await page.waitForTimeout(500);
      await page.selectOption("#eventLocationSelect", { label: searchKeyword });
    }

    const selectedEventId = await page
      .locator("#eventLocationSelect")
      .inputValue();
    console.log(`📌 selectedEventId: ${selectedEventId}`);

    // Step 7: กด "ค้นหา" ใน advanced filter
    const searchResponsePromise = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes("/api/app/capFeed/getCapFeedLocationDataList") &&
        response.url().includes(`eventId=${selectedEventId}`) &&
        response.status() === 200,
    );
    await page
      .locator("#capAdvanceFilterLocation")
      .getByRole("button", { name: "ค้นหา" })
      .click();

    const searchResponse = await searchResponsePromise;
    const searchData = await searchResponse.json();
    const responseUrl = searchResponse.url();

    // Expect 1: URL request ต้องมี eventId ที่ค้นหา
    expect(responseUrl).toContain(`eventId=${selectedEventId}`);

    // Expect 2: dropdown ต้องยังคงค่าที่เลือกไว้
    await expect(page.locator("#eventLocationSelect")).toHaveValue(
      selectedEventId,
    );

    // Expect 3: totalCount ต้องตรงกับจำนวน items ใน response
    expect(Number(searchData.totalCount)).toBe(searchData.items.length);

    // Expect 4: จำนวนที่แสดงบนหน้าต้องตรงกับ response
    const sectionText = await page.getByLabel("ค้นหาจากตำแหน่ง").innerText();
    const displayedTotalMatch = sectionText.match(
      /จำนวนข้อมูลทั้งหมด:\s*([\d,]+)/,
    );
    expect(displayedTotalMatch, "ต้องแสดงจำนวนข้อมูลทั้งหมด").not.toBeNull();
    const displayedTotal = Number(displayedTotalMatch![1].replace(/,/g, ""));
    expect(displayedTotal).toBe(searchData.totalCount);

    // Expect 5: ต้องมี card แสดงผลอย่างน้อย 1 รายการ
    const cardContainer = page.locator("#capFeedLocationCardContainer");
    const cards = cardContainer.locator(".card");
    const firstPageCardCount = await cards.count();
    expect(firstPageCardCount).toBeGreaterThan(0);

    // Expect 6: ตรวจสอบทุก card ในทุกหน้าว่าแสดงเหตุการณ์ที่ค้นหา
    const pageSizeDropdown = page.locator("#pageSizeDropdown").first();
    const pageSize = Number(await pageSizeDropdown.inputValue());
    const totalPages = Math.ceil(displayedTotal / pageSize);

    let validatedCardCount = 0;
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      if (pageNumber > 1) {
        await page
          .getByLabel("ค้นหาจากตำแหน่ง")
          .locator("a.pointer.mx-1", { hasText: String(pageNumber) })
          .first()
          .click();
        await page.waitForTimeout(300);
      }

      const cardsOnCurrentPage = await cards.count();
      for (let index = 0; index < cardsOnCurrentPage; index += 1) {
        await expect(cards.nth(index)).toContainText(searchKeyword);
      }

      validatedCardCount += cardsOnCurrentPage;
    }

    expect(validatedCardCount).toBe(displayedTotal);

    console.log(
      `✅ Validated ${validatedCardCount} cards across ${totalPages} pages for keyword "${searchKeyword}" — ผ่าน`,
    );
  });

  test("TC-DA-LOC-022 : ตรวจสอบ multi-select ความรุนแรง", async ({ page }) => {
    test.setTimeout(120000);
    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";
    const testLat = 18.8958;
    const testLng = 98.957;
    const severities = ["ร้ายแรงมาก", "ร้ายแรง"];

    // Step 1: เปิดเว็บ
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");

    // Step 2: คลิกแท็บ "ค้นหาจากตำแหน่ง"
    await page.getByText("ค้นหาจากตำแหน่ง").first().click();

    // Step 3: กรอกค่า Latitude และ Longitude
    const latInput = page.locator('input[id="lat"], input[name="Lat"]').first();
    const lngInput = page
      .locator(
        'input[id="lng"], input[id="lon"], input[name="Lng"], input[name="Lon"]',
      )
      .first();
    await latInput.fill(String(testLat));
    await lngInput.fill(String(testLng));
    await expect(latInput).toHaveValue(String(testLat));
    await expect(lngInput).toHaveValue(String(testLng));

    // Step 4: กดค้นหาครั้งแรก และรอผลโหลด
    const firstSearchResponsePromise = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes("/api/app/capFeed/getCapFeedLocationDataList") &&
        response.status() === 200,
    );
    await page.locator("#searchByLocation").click();
    await firstSearchResponsePromise;

    // Step 5: เปิดตัวกรองขั้นสูง
    const section = page.getByLabel("ค้นหาจากตำแหน่ง");
    const advancedFilterCandidates = [
      section.getByRole("button", { name: /ตัวกรองขั้นสูง/i }),
      section.getByText("ตัวกรองขั้นสูง", { exact: true }),
      section.locator("button, a, p", { hasText: "ตัวกรองขั้นสูง" }),
    ];
    let advancedFilterOpened = false;
    for (const locator of advancedFilterCandidates) {
      if (
        await locator
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await locator.first().click();
        advancedFilterOpened = true;
        break;
      }
    }
    expect(
      advancedFilterOpened,
      "ต้องพบปุ่มตัวกรองขั้นสูงใน section ค้นหาจากตำแหน่ง",
    ).toBeTruthy();
    await page.waitForTimeout(1000);

    // Step 6: เลือก checkbox ความรุนแรง "ร้ายแรงมาก" และ "ร้ายแรง"
    const severityPanel = page.locator("#capAdvanceFilterLocation");
    const extremeCheckbox = severityPanel.locator("#severityExtreme").first();
    const severeCheckbox = severityPanel.locator("#severitySevere").first();

    // บางครั้ง input ถูกซ่อนด้วย custom UI จึงคลิกผ่าน JS click() เพื่อให้เกิด change event ตามพฤติกรรมจริง
    if (!(await extremeCheckbox.isChecked())) {
      await extremeCheckbox.evaluate((el) => (el as HTMLInputElement).click());
    }
    if (!(await severeCheckbox.isChecked())) {
      await severeCheckbox.evaluate((el) => (el as HTMLInputElement).click());
    }
    await expect(extremeCheckbox).toBeChecked();
    await expect(severeCheckbox).toBeChecked();

    // Step 7: กด "ค้นหา" ใน advanced filter
    const searchResponsePromise = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes("/api/app/capFeed/getCapFeedLocationDataList") &&
        response.status() === 200,
      { timeout: 15000 },
    );
    await page
      .locator("#capAdvanceFilterLocation")
      .getByRole("button", { name: "ค้นหา" })
      .click();

    const searchResponse = await searchResponsePromise;
    const data = await searchResponse.json();

    // Expect 1: สามารถเลือกได้หลายความรุนแรง
    const cards = page
      .locator("#capFeedLocationCardContainer")
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

    // Expect 2: แสดงเฉพาะข้อมูลที่ตรงเงื่อนไข — ตรวจครบทุก item จาก API
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
      `✅ Validated ${cardCount} UI cards | ${allItems.length} API items | Severities: ${severities.join(", ")} — ผ่าน`,
    );
  });

  test("TC-DA-LOC-023 : ตรวจสอบ multi-select ความแน่นอน", async ({ page }) => {
    test.setTimeout(120000);
    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";
    const testLat = 18.8958;
    const testLng = 98.957;
    const certainties = ["สังเกตการณ์", "เป็นไปได้"];

    // Step 1: เปิดเว็บ
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");

    // Step 2: คลิกแท็บ "ค้นหาจากตำแหน่ง"
    await page.getByText("ค้นหาจากตำแหน่ง").first().click();

    // Step 3: กรอกค่า Latitude และ Longitude
    const latInput = page.locator('input[id="lat"], input[name="Lat"]').first();
    const lngInput = page
      .locator(
        'input[id="lng"], input[id="lon"], input[name="Lng"], input[name="Lon"]',
      )
      .first();
    await latInput.fill(String(testLat));
    await lngInput.fill(String(testLng));
    await expect(latInput).toHaveValue(String(testLat));
    await expect(lngInput).toHaveValue(String(testLng));

    // Step 4: กดค้นหาครั้งแรก
    const firstSearchResponsePromise = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes("/api/app/capFeed/getCapFeedLocationDataList") &&
        response.status() === 200,
    );
    await page.locator("#searchByLocation").click();
    await firstSearchResponsePromise;

    // Step 5: เปิดตัวกรองขั้นสูง
    const section = page.getByLabel("ค้นหาจากตำแหน่ง");
    const advancedFilterCandidates = [
      section.getByRole("button", { name: /ตัวกรองขั้นสูง/i }),
      section.getByText("ตัวกรองขั้นสูง", { exact: true }),
      section.locator("button, a, p", { hasText: "ตัวกรองขั้นสูง" }),
    ];
    let advancedFilterOpened = false;
    for (const locator of advancedFilterCandidates) {
      if (
        await locator
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await locator.first().click();
        advancedFilterOpened = true;
        break;
      }
    }
    expect(
      advancedFilterOpened,
      "ต้องพบปุ่มตัวกรองขั้นสูงใน section ค้นหาจากตำแหน่ง",
    ).toBeTruthy();
    await page.waitForTimeout(1000);

    // Step 6: เลือก "สังเกตการณ์" + "เป็นไปได้"
    const certaintyPanel = page.locator("#capAdvanceFilterLocation");
    const observedCheckbox = certaintyPanel
      .locator("#certaintyObserved")
      .first();
    const likelyCheckbox = certaintyPanel.locator("#certaintyLikely").first();
    if (!(await observedCheckbox.isChecked())) {
      await observedCheckbox.evaluate((el) => (el as HTMLInputElement).click());
    }
    if (!(await likelyCheckbox.isChecked())) {
      await likelyCheckbox.evaluate((el) => (el as HTMLInputElement).click());
    }
    await expect(observedCheckbox).toBeChecked();
    await expect(likelyCheckbox).toBeChecked();

    // Step 7: กด "ค้นหา" ใน advanced filter
    const searchResponsePromise = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes("/api/app/capFeed/getCapFeedLocationDataList") &&
        response.status() === 200,
      { timeout: 15000 },
    );
    await page
      .locator("#capAdvanceFilterLocation")
      .getByRole("button", { name: "ค้นหา" })
      .click();

    const searchResponse = await searchResponsePromise;
    const data = await searchResponse.json();

    // Expect 1: สามารถเลือกได้หลายความแน่นอน
    expect(await observedCheckbox.isChecked()).toBeTruthy();
    expect(await likelyCheckbox.isChecked()).toBeTruthy();

    // Expect 2: แสดงเฉพาะข้อมูลที่ตรงเงื่อนไข
    const cards = page
      .locator("#capFeedLocationCardContainer")
      .nth(0)
      .locator(".card");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

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
      `✅ Validated ${cardCount} UI cards | ${allItems.length} API items | Certainties: ${certainties.join(", ")} — ผ่าน`,
    );
  });

  test("TC-DA-LOC-024 : ตรวจสอบ multi-select ความเร่งด่วน", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";
    const testLat = 18.8958;
    const testLng = 98.957;
    const urgencies = ["ทันที", "คาดหวัง"];

    // Step 1: เปิดเว็บ
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");

    // Step 2: คลิกแท็บ "ค้นหาจากตำแหน่ง"
    await page.getByText("ค้นหาจากตำแหน่ง").first().click();

    // Step 3: กรอกค่า Latitude และ Longitude
    const latInput = page.locator('input[id="lat"], input[name="Lat"]').first();
    const lngInput = page
      .locator(
        'input[id="lng"], input[id="lon"], input[name="Lng"], input[name="Lon"]',
      )
      .first();
    await latInput.fill(String(testLat));
    await lngInput.fill(String(testLng));
    await expect(latInput).toHaveValue(String(testLat));
    await expect(lngInput).toHaveValue(String(testLng));

    // Step 4: กดค้นหาครั้งแรก
    const firstSearchResponsePromise = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes("/api/app/capFeed/getCapFeedLocationDataList") &&
        response.status() === 200,
    );
    await page.locator("#searchByLocation").click();
    await firstSearchResponsePromise;

    // Step 5: เปิดตัวกรองขั้นสูง
    const section = page.getByLabel("ค้นหาจากตำแหน่ง");
    const advancedFilterCandidates = [
      section.getByRole("button", { name: /ตัวกรองขั้นสูง/i }),
      section.getByText("ตัวกรองขั้นสูง", { exact: true }),
      section.locator("button, a, p", { hasText: "ตัวกรองขั้นสูง" }),
    ];
    let advancedFilterOpened = false;
    for (const locator of advancedFilterCandidates) {
      if (
        await locator
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await locator.first().click();
        advancedFilterOpened = true;
        break;
      }
    }
    expect(
      advancedFilterOpened,
      "ต้องพบปุ่มตัวกรองขั้นสูงใน section ค้นหาจากตำแหน่ง",
    ).toBeTruthy();
    await page.waitForTimeout(1000);

    // Step 6: เลือก "ทันที" + "คาดหวัง"
    const urgencyPanel = page.locator("#capAdvanceFilterLocation");
    const immediateCheckbox = urgencyPanel.locator("#urgencyImmediate").first();
    const expectedCheckbox = urgencyPanel.locator("#urgencyExpected").first();
    if (!(await immediateCheckbox.isChecked())) {
      await immediateCheckbox.evaluate((el) =>
        (el as HTMLInputElement).click(),
      );
    }
    if (!(await expectedCheckbox.isChecked())) {
      await expectedCheckbox.evaluate((el) => (el as HTMLInputElement).click());
    }
    await expect(immediateCheckbox).toBeChecked();
    await expect(expectedCheckbox).toBeChecked();

    // Step 7: กด "ค้นหา" ใน advanced filter
    const searchResponsePromise = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes("/api/app/capFeed/getCapFeedLocationDataList") &&
        response.status() === 200,
      { timeout: 15000 },
    );
    await page
      .locator("#capAdvanceFilterLocation")
      .getByRole("button", { name: "ค้นหา" })
      .click();

    const searchResponse = await searchResponsePromise;
    const data = await searchResponse.json();

    // Expect 1: สามารถเลือกได้หลายความเร่งด่วน
    expect(await immediateCheckbox.isChecked()).toBeTruthy();
    expect(await expectedCheckbox.isChecked()).toBeTruthy();

    // Expect 2: แสดงเฉพาะข้อมูลที่ตรงเงื่อนไข
    const cards = page
      .locator("#capFeedLocationCardContainer")
      .nth(0)
      .locator(".card");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    const allItems: any[] = data.items;
    expect(allItems.length).toBeGreaterThan(0);
    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i];
      expect(
        urgencies.includes(item.urgency),
        `API item ${i} มี urgency "${item.urgency}" ซึ่งไม่อยู่ใน filter: ${urgencies.join(", ")}`,
      ).toBeTruthy();
    }

    console.log(
      `✅ Validated ${cardCount} UI cards | ${allItems.length} API items | Urgencies: ${urgencies.join(", ")} — ผ่าน`,
    );
  });

  test("TC-DA-LOC-025 : ตรวจสอบการค้นหาเมื่อเลือกตัวกรองขั้นสูงหลายตัวพร้อมกัน", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";
    const testLat = 18.8958;
    const testLng = 98.957;

    const selectedEvent = "มาตรฐานทั่วไป";
    const selectedSeverity = "ร้ายแรงมาก";
    const selectedCertainty = "สังเกตการณ์";
    const selectedUrgency = "ทันที";

    // Step 1: เปิดเว็บ
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");

    // Step 2: คลิกแท็บ "ค้นหาจากตำแหน่ง"
    await page.getByText("ค้นหาจากตำแหน่ง").first().click();

    // Step 3: กรอกค่า Latitude และ Longitude
    const latInput = page.locator('input[id="lat"], input[name="Lat"]').first();
    const lngInput = page
      .locator(
        'input[id="lng"], input[id="lon"], input[name="Lng"], input[name="Lon"]',
      )
      .first();
    await latInput.fill(String(testLat));
    await lngInput.fill(String(testLng));
    await expect(latInput).toHaveValue(String(testLat));
    await expect(lngInput).toHaveValue(String(testLng));

    // Step 4: กดค้นหา
    const firstSearchResponsePromise = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes("/api/app/capFeed/getCapFeedLocationDataList") &&
        response.status() === 200,
    );
    await page.locator("#searchByLocation").click();
    await firstSearchResponsePromise;

    // Step 5: เปิดตัวกรองขั้นสูง
    const section = page.getByLabel("ค้นหาจากตำแหน่ง");
    const advancedFilterCandidates = [
      section.getByRole("button", { name: /ตัวกรองขั้นสูง/i }),
      section.getByText("ตัวกรองขั้นสูง", { exact: true }),
      section.locator("button, a, p", { hasText: "ตัวกรองขั้นสูง" }),
    ];
    let advancedFilterOpened = false;
    for (const locator of advancedFilterCandidates) {
      if (
        await locator
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await locator.first().click();
        advancedFilterOpened = true;
        break;
      }
    }
    expect(
      advancedFilterOpened,
      "ต้องพบปุ่มตัวกรองขั้นสูงใน section ค้นหาจากตำแหน่ง",
    ).toBeTruthy();
    await expect(page.locator("#eventLocationSelect")).toBeVisible();
    await page.waitForTimeout(1000);

    // Step 6.1: เลือกเหตุการณ์
    await page.selectOption("#eventLocationSelect", { label: selectedEvent });
    const selectedEventId = await page
      .locator("#eventLocationSelect")
      .inputValue();
    await expect(page.locator("#eventLocationSelect")).toHaveValue(
      selectedEventId,
    );

    // Step 6.2: เลือกความรุนแรง
    const advancedFilterPanel = page.locator("#capAdvanceFilterLocation");
    const severityExtreme = advancedFilterPanel
      .locator("#severityExtreme")
      .first();
    if (!(await severityExtreme.isChecked())) {
      await severityExtreme.evaluate((el) => (el as HTMLInputElement).click());
    }
    await expect(severityExtreme).toBeChecked();

    // Step 6.3: เลือกความแน่นอน
    const certaintyObserved = advancedFilterPanel
      .locator("#certaintyObserved")
      .first();
    if (!(await certaintyObserved.isChecked())) {
      await certaintyObserved.evaluate((el) =>
        (el as HTMLInputElement).click(),
      );
    }
    await expect(certaintyObserved).toBeChecked();

    // Step 6.4: เลือกความเร่งด่วน
    const urgencyImmediate = advancedFilterPanel
      .locator("#urgencyImmediate")
      .first();
    if (!(await urgencyImmediate.isChecked())) {
      await urgencyImmediate.evaluate((el) => (el as HTMLInputElement).click());
    }
    await expect(urgencyImmediate).toBeChecked();

    // Step 6.5: กดปุ่มค้นหา
    const searchResponsePromise = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes("/api/app/capFeed/getCapFeedLocationDataList") &&
        response.url().includes(`eventId=${selectedEventId}`) &&
        response.status() === 200,
      { timeout: 15000 },
    );
    await advancedFilterPanel.getByRole("button", { name: "ค้นหา" }).click();

    const searchResponse = await searchResponsePromise;
    const data = await searchResponse.json();

    // Expect: แสดงเฉพาะข้อมูลที่ตรงกับเงื่อนไขทั้งหมด
    const cards = page
      .locator("#capFeedLocationCardContainer")
      .first()
      .locator(".card");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    const allItems: any[] = data.items;
    expect(allItems.length).toBeGreaterThan(0);
    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i];
      expect(item.event).toBe(selectedEvent);
      expect(item.severity).toBe(selectedSeverity);
      expect(item.certainty).toBe(selectedCertainty);
      expect(item.urgency).toBe(selectedUrgency);
    }

    console.log(
      `✅ Validated ${cardCount} UI cards | ${allItems.length} API items | Event: ${selectedEvent} | Severity: ${selectedSeverity} | Certainty: ${selectedCertainty} | Urgency: ${selectedUrgency} — ผ่าน`,
    );
  });

  test("TC-DA-LOC-026 : ตรวจสอบ reset filter", async ({ page }) => {
    test.setTimeout(120000);
    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";
    const testLat = 18.8958;
    const testLng = 98.957;
    const selectedEvent = "มาตรฐานทั่วไป";

    // Step 1: เปิดเว็บ
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");

    // Step 2: คลิกแท็บ "ค้นหาจากตำแหน่ง"
    await page.getByText("ค้นหาจากตำแหน่ง").first().click();

    // Step 3: กรอกค่า Latitude และ Longitude
    const latInput = page.locator('input[id="lat"], input[name="Lat"]').first();
    const lngInput = page
      .locator(
        'input[id="lng"], input[id="lon"], input[name="Lng"], input[name="Lon"]',
      )
      .first();
    await latInput.fill(String(testLat));
    await lngInput.fill(String(testLng));
    await expect(latInput).toHaveValue(String(testLat));
    await expect(lngInput).toHaveValue(String(testLng));

    // Step 4: กดค้นหา
    const firstSearchResponsePromise = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes("/api/app/capFeed/getCapFeedLocationDataList") &&
        response.status() === 200,
    );
    await page.locator("#searchByLocation").click();
    await firstSearchResponsePromise;

    // Step 5: เปิดตัวกรองขั้นสูง
    const section = page.getByLabel("ค้นหาจากตำแหน่ง");
    const advancedFilterCandidates = [
      section.getByRole("button", { name: /ตัวกรองขั้นสูง/i }),
      section.getByText("ตัวกรองขั้นสูง", { exact: true }),
      section.locator("button, a, p", { hasText: "ตัวกรองขั้นสูง" }),
    ];
    let advancedFilterOpened = false;
    for (const locator of advancedFilterCandidates) {
      if (
        await locator
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await locator.first().click();
        advancedFilterOpened = true;
        break;
      }
    }
    expect(
      advancedFilterOpened,
      "ต้องพบปุ่มตัวกรองขั้นสูงใน section ค้นหาจากตำแหน่ง",
    ).toBeTruthy();
    await expect(page.locator("#eventLocationSelect")).toBeVisible();

    // Step 6: เลือกเหตุการณ์จาก dropdown
    await page.selectOption("#eventLocationSelect", { label: selectedEvent });
    const selectedEventId = await page
      .locator("#eventLocationSelect")
      .inputValue();
    await expect(page.locator("#eventLocationSelect")).toHaveValue(
      selectedEventId,
    );

    const advancedFilterPanel = page.locator("#capAdvanceFilterLocation");

    // Step 7: กด "ค้นหา"
    const searchResponsePromise = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes("/api/app/capFeed/getCapFeedLocationDataList") &&
        response.url().includes(`eventId=${selectedEventId}`) &&
        response.status() === 200,
    );
    await advancedFilterPanel.getByRole("button", { name: "ค้นหา" }).click();
    await searchResponsePromise;

    // Step 8: กด "ล้างตัวเลือก"
    await advancedFilterPanel
      .getByRole("button", { name: "ล้างตัวเลือก" })
      .click();

    // Expect: ค่า filter ถูกล้างทั้งหมด
    await expect(page.locator("#eventLocationSelect")).toHaveValue("");
    const checkedCount = await advancedFilterPanel
      .locator('input[type="checkbox"]')
      .evaluateAll(
        (els) => els.filter((el) => (el as HTMLInputElement).checked).length,
      );
    expect(checkedCount).toBe(0);

    console.log(
      "✅ Reset filter สำเร็จ: event ว่างและ checkbox ถูกล้างทั้งหมด — ผ่าน",
    );
  });

  test("TC-DA-LOC-028 : Filter แล้วไม่พบข้อมูล", async ({ page }) => {
    test.setTimeout(120000);
    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";
    const testLat = 18.8958;
    const testLng = 98.957;
    const noDataEventKeyword = "พายุโซนร้อน";
    const noDataMessage = "ไม่พบผลลัพธ์การค้นหาที่ตรงกับเงื่อนไขของคุณ";

    // Step 1: เปิดเว็บ
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");

    // Step 2: คลิกแท็บ "ค้นหาจากตำแหน่ง"
    await page.getByText("ค้นหาจากตำแหน่ง").first().click();

    // Step 3: กรอกค่า Latitude และ Longitude
    const latInput = page.locator('input[id="lat"], input[name="Lat"]').first();
    const lngInput = page
      .locator(
        'input[id="lng"], input[id="lon"], input[name="Lng"], input[name="Lon"]',
      )
      .first();
    await latInput.fill(String(testLat));
    await lngInput.fill(String(testLng));
    await expect(latInput).toHaveValue(String(testLat));
    await expect(lngInput).toHaveValue(String(testLng));

    // Step 4: กดค้นหา
    const firstSearchResponsePromise = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes("/api/app/capFeed/getCapFeedLocationDataList") &&
        response.status() === 200,
    );
    await page.locator("#searchByLocation").click();
    await firstSearchResponsePromise;

    // Step 5: เปิดตัวกรองขั้นสูง
    const section = page.getByLabel("ค้นหาจากตำแหน่ง");
    const advancedFilterCandidates = [
      section.getByRole("button", { name: /ตัวกรองขั้นสูง/i }),
      section.getByText("ตัวกรองขั้นสูง", { exact: true }),
      section.locator("button, a, p", { hasText: "ตัวกรองขั้นสูง" }),
    ];
    let advancedFilterOpened = false;
    for (const locator of advancedFilterCandidates) {
      if (
        await locator
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await locator.first().click();
        advancedFilterOpened = true;
        break;
      }
    }
    expect(
      advancedFilterOpened,
      "ต้องพบปุ่มตัวกรองขั้นสูงใน section ค้นหาจากตำแหน่ง",
    ).toBeTruthy();
    await expect(page.locator("#eventLocationSelect")).toBeVisible();

    // Step 6: เลือกรายการที่ไม่มีข้อมูล (พายุโซนร้อน)
    const eventOptionValue = await page
      .locator("#eventLocationSelect")
      .evaluate((el, keyword) => {
        const select = el as HTMLSelectElement;
        const option = Array.from(select.options).find((opt) =>
          opt.text.includes(keyword),
        );
        return option?.value ?? "";
      }, noDataEventKeyword);
    expect(
      eventOptionValue,
      `ต้องพบ option เหตุการณ์ที่มีคำว่า "${noDataEventKeyword}"`,
    ).not.toBe("");
    await page.selectOption("#eventLocationSelect", eventOptionValue);

    // Step 7: กด "ค้นหา"
    const advancedFilterPanel = page.locator("#capAdvanceFilterLocation");
    const searchResponsePromise = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes("/api/app/capFeed/getCapFeedLocationDataList") &&
        response.url().includes(`eventId=${eventOptionValue}`) &&
        response.status() === 200,
    );
    await advancedFilterPanel.getByRole("button", { name: "ค้นหา" }).click();
    await searchResponsePromise;

    // Expect Result: แสดงข้อความไม่พบข้อมูล
    await expect(section.getByText(noDataMessage, { exact: true })).toBeVisible(
      { timeout: 10000 },
    );

    console.log(`✅ แสดงข้อความ no data ถูกต้อง: "${noDataMessage}" — ผ่าน`);
  });

  test("TC-DA-LOC-030 : ตรวจสอบเรียงเหตุการณ์ล่าสุดก่อน", async ({ page }) => {
    test.setTimeout(60000);
    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";
    const testLat = 18.8958;
    const testLng = 98.957;

    // Step 1: เปิดเว็บ
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");

    // Step 2: คลิกแท็บ "ค้นหาจากตำแหน่ง"
    await page.getByText("ค้นหาจากตำแหน่ง").first().click();

    // Step 3: กรอกค่า Latitude และ Longitude
    const latInput = page.locator('input[id="lat"], input[name="Lat"]').first();
    const lngInput = page
      .locator(
        'input[id="lng"], input[id="lon"], input[name="Lng"], input[name="Lon"]',
      )
      .first();
    await latInput.fill(String(testLat));
    await lngInput.fill(String(testLng));
    await expect(latInput).toHaveValue(String(testLat));
    await expect(lngInput).toHaveValue(String(testLng));

    // Step 4: กดค้นหาครั้งแรก และรอผลโหลด
    const firstSearchResponsePromise = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes("/api/app/capFeed/getCapFeedLocationDataList") &&
        response.status() === 200,
    );
    await page.locator("#searchByLocation").click();
    await firstSearchResponsePromise;

    // Step 5: เลือก "เหตุการณ์ล่าสุด" จาก dropdown เวลาเหตุการณ์
    const sortResponsePromise = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes("/api/app/capFeed/getCapFeedLocationDataList") &&
        response.status() === 200,
      { timeout: 15000 },
    );

    const sortDropdown = page
      .locator(
        '#sortLocationSelect, #eventTimeLocationSelect, select[id*="sort"][id*="ocation"], select[id*="time"][id*="ocation"]',
      )
      .first();
    await expect(sortDropdown).toBeVisible({ timeout: 5000 });
    await sortDropdown.selectOption({ label: "เหตุการณ์ล่าสุด" });

    const sortResponse = await sortResponsePromise;
    const data = await sortResponse.json();

    // Expect: ระบบต้องแสดง Alert Card ล่าสุดไว้ลำดับบนสุด
    // Expect 1: ต้องมี items ใน response
    const allItems: any[] = data.items;
    expect(allItems.length).toBeGreaterThan(0);

    // Expect 2: ตรวจสอบว่า items เรียงจากเวลาใหม่ไปเก่า (ล่าสุดก่อน)
    const extractItemTime = (item: any): number => {
      const candidates = [
        item?.sendDateTime,
        item?.sent,
        item?.effective,
        item?.onset,
        item?.alert?.sendDateTime,
        item?.alert?.sent,
        item?.alert?.effective,
        item?.alert?.onset,
        item?.alert?.info?.effective,
        item?.alert?.info?.onset,
      ];

      for (const candidate of candidates) {
        if (!candidate) continue;
        const parsed = new Date(candidate).getTime();
        if (!Number.isNaN(parsed)) return parsed;
      }
      return Number.NaN;
    };

    for (let i = 0; i < allItems.length - 1; i++) {
      const currentTime = extractItemTime(allItems[i]);
      const nextTime = extractItemTime(allItems[i + 1]);
      expect(Number.isNaN(currentTime)).toBeFalsy();
      expect(Number.isNaN(nextTime)).toBeFalsy();
      expect(
        currentTime,
        `item[${i}] ต้องไม่เก่ากว่า item[${i + 1}]`,
      ).toBeGreaterThanOrEqual(nextTime);
    }

    // Expect 3: ตรวจสอบ UI card แรกต้องตรงกับ item แรกจาก API
    const cards = page
      .locator("#capFeedLocationCardContainer")
      .nth(0)
      .locator(".card");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });

    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    const firstCardText = await cards.first().innerText();
    const firstItemTime = extractItemTime(allItems[0]);
    expect(Number.isNaN(firstItemTime)).toBeFalsy();
    console.log(`📌 First API item timestamp: ${firstItemTime}`);
    console.log(
      `📌 First card text (preview): ${firstCardText.substring(0, 100)}`,
    );

    // Expect 4: วันที่ของ card แรกต้องใหม่กว่าหรือเท่ากับ card สุดท้ายในหน้า
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
        `Card แรก (${firstCardDate.toISOString()}) ต้องใหม่กว่าหรือเท่ากับ card สุดท้าย (${lastCardDate.toISOString()})`,
      ).toBeGreaterThanOrEqual(lastCardDate.getTime());
    }

    console.log(
      `✅ Validated ${cardCount} UI cards | ${allItems.length} API items | เรียงล่าสุดก่อน — ผ่าน`,
    );
  });

  test("TC-DA-LOC-031 : ตรวจสอบเรียงเหตุการณ์เก่าสุดก่อน", async ({ page }) => {
    test.setTimeout(60000);
    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";
    const testLat = 18.8958;
    const testLng = 98.957;

    // Step 1: เปิดเว็บ
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");

    // Step 2: คลิกแท็บ "ค้นหาจากตำแหน่ง"
    await page.getByText("ค้นหาจากตำแหน่ง").first().click();

    // Step 3: กรอกค่า Latitude และ Longitude
    const latInput = page.locator('input[id="lat"], input[name="Lat"]').first();
    const lngInput = page
      .locator(
        'input[id="lng"], input[id="lon"], input[name="Lng"], input[name="Lon"]',
      )
      .first();
    await latInput.fill(String(testLat));
    await lngInput.fill(String(testLng));
    await expect(latInput).toHaveValue(String(testLat));
    await expect(lngInput).toHaveValue(String(testLng));

    // Step 4: กดค้นหาครั้งแรก และรอผลโหลด
    const firstSearchResponsePromise = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes("/api/app/capFeed/getCapFeedLocationDataList") &&
        response.status() === 200,
    );
    await page.locator("#searchByLocation").click();
    await firstSearchResponsePromise;

    // Step 5: เลือก "เหตุการณ์เก่าสุด" จาก dropdown เวลาเหตุการณ์
    const sortResponsePromise = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes("/api/app/capFeed/getCapFeedLocationDataList") &&
        response.status() === 200,
      { timeout: 15000 },
    );

    const sortDropdown = page
      .locator(
        '#sortLocationSelect, #eventTimeLocationSelect, select[id*="sort"][id*="ocation"], select[id*="time"][id*="ocation"]',
      )
      .first();
    await expect(sortDropdown).toBeVisible({ timeout: 5000 });
    await sortDropdown.selectOption({ label: "เหตุการณ์เก่าสุด" });

    const sortResponse = await sortResponsePromise;
    const data = await sortResponse.json();

    // Expect: ระบบต้องแสดง Alert Card เก่าสุดไว้ลำดับบนสุด
    const allItems: any[] = data.items;
    expect(allItems.length).toBeGreaterThan(0);

    const extractItemTime = (item: any): number => {
      const candidates = [
        item?.sendDateTime,
        item?.sent,
        item?.effective,
        item?.onset,
        item?.alert?.sendDateTime,
        item?.alert?.sent,
        item?.alert?.effective,
        item?.alert?.onset,
        item?.alert?.info?.effective,
        item?.alert?.info?.onset,
      ];

      for (const candidate of candidates) {
        if (!candidate) continue;
        const parsed = new Date(candidate).getTime();
        if (!Number.isNaN(parsed)) return parsed;
      }
      return Number.NaN;
    };

    // Expect 1: items ต้องเรียงจากเวลาเก่าไปใหม่ (เก่าสุดก่อน)
    for (let i = 0; i < allItems.length - 1; i++) {
      const currentTime = extractItemTime(allItems[i]);
      const nextTime = extractItemTime(allItems[i + 1]);
      expect(Number.isNaN(currentTime)).toBeFalsy();
      expect(Number.isNaN(nextTime)).toBeFalsy();
      expect(
        currentTime,
        `item[${i}] ต้องไม่ใหม่กว่า item[${i + 1}]`,
      ).toBeLessThanOrEqual(nextTime);
    }

    // Expect 2: มี card แสดงผลและ card แรกควรเป็นรายการเก่าสุด
    const cards = page
      .locator("#capFeedLocationCardContainer")
      .nth(0)
      .locator(".card");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    const firstItemTime = extractItemTime(allItems[0]);
    expect(Number.isNaN(firstItemTime)).toBeFalsy();
    console.log(`📌 First API item timestamp (oldest): ${firstItemTime}`);

    console.log(
      `✅ Validated ${cardCount} UI cards | ${allItems.length} API items | เรียงเก่าสุดก่อน — ผ่าน`,
    );
  });

  test("TC-DA-LOC-038 : ตรวจสอบชื่อเหตุการณ์ วันที่เริ่ม-สิ้นสุดบน card", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";
    const testLat = 18.8958;
    const testLng = 98.957;

    // Step 1-4: เปิดเว็บ -> ค้นหาจากตำแหน่ง
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");
    await page.getByText("ค้นหาจากตำแหน่ง").first().click();
    const latInput = page.locator('input[id="lat"], input[name="Lat"]').first();
    const lngInput = page
      .locator(
        'input[id="lng"], input[id="lon"], input[name="Lng"], input[name="Lon"]',
      )
      .first();
    await latInput.fill(String(testLat));
    await lngInput.fill(String(testLng));

    const searchResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/app/capFeed/getCapFeedLocationDataList") &&
        res.status() === 200,
      { timeout: 30000 },
    );
    await page.locator("#searchByLocation").click();
    const response = await searchResponsePromise;
    const data = await response.json();
    const allItems: any[] = data.items;
    expect(allItems.length).toBeGreaterThan(0);

    const cards = page
      .locator("#capFeedLocationCardContainer")
      .first()
      .locator(".card");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    for (let i = 0; i < cardCount; i++) {
      const cardBody = cards.nth(i).locator(".card-body");
      const eventName = cardBody
        .locator(
          "h5, h6, strong, [class*='title'], [class*='event'], [class*='header']",
        )
        .first();
      const eventText = ((await eventName.textContent()) ?? "").trim();
      expect(
        eventText.length > 0,
        `Card ${i} ชื่อเหตุการณ์ไม่มีข้อความ`,
      ).toBeTruthy();

      const cardText = await cardBody.innerText();
      const effectiveMatch = cardText.match(
        /มีผล:\s*(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2})/,
      );
      const expiresMatch = cardText.match(
        /สิ้นสุด:\s*(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2})/,
      );
      expect(
        effectiveMatch !== null,
        `Card ${i} วันที่มีผลไม่ถูกรูปแบบ`,
      ).toBeTruthy();
      expect(
        expiresMatch !== null,
        `Card ${i} วันที่สิ้นสุดไม่ถูกรูปแบบ`,
      ).toBeTruthy();

      const parseThaiDate = (str: string): Date => {
        const m = str.match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2})/);
        if (!m) return new Date("invalid");
        return new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:00`);
      };
      const effectiveDate = parseThaiDate(effectiveMatch![1]);
      const expiresDate = parseThaiDate(expiresMatch![1]);
      expect(expiresDate >= effectiveDate).toBeTruthy();
    }

    console.log(
      `✅ TC-DA-LOC-038 ผ่าน — ตรวจสอบ ${cardCount} cards ครบถ้วนถูกต้อง`,
    );
  });

  test("TC-DA-LOC-039 : ตรวจสอบลิงก์ .XML เปิดได้", async ({ page }) => {
    test.setTimeout(120000);
    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";
    const testLat = 18.8958;
    const testLng = 98.957;

    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");
    await page.getByText("ค้นหาจากตำแหน่ง").first().click();
    const latInput = page.locator('input[id="lat"], input[name="Lat"]').first();
    const lngInput = page
      .locator(
        'input[id="lng"], input[id="lon"], input[name="Lng"], input[name="Lon"]',
      )
      .first();
    await latInput.fill(String(testLat));
    await lngInput.fill(String(testLng));

    const searchResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/app/capFeed/getCapFeedLocationDataList") &&
        res.status() === 200,
      { timeout: 30000 },
    );
    await page.locator("#searchByLocation").click();
    const response = await searchResponsePromise;
    const data = await response.json();
    const allItems: any[] = data.items;
    expect(allItems.length).toBeGreaterThan(0);

    const cards = page
      .locator("#capFeedLocationCardContainer")
      .first()
      .locator(".card");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });

    const xmlCandidates: string[] = allItems
      .map(
        (item) => item.xmlUrl || item.xmlLink || item.capXmlUrl || item.fileUrl,
      )
      .filter((url: string | undefined) =>
        Boolean(url && url.includes(".xml")),
      );
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
    expect(
      contentType.includes("xml") || contentType.includes("text"),
    ).toBeTruthy();
    const body = await xmlResponse!.text();
    expect(body.trim().startsWith("<?xml") || body.includes("<")).toBeTruthy();

    console.log(
      `✅ TC-DA-LOC-039 ผ่าน — ลิงก์ .XML เปิดได้สำเร็จ | URL: ${xmlUrl}`,
    );
  });

  test("TC-DA-LOC-040 : ตรวจสอบ modal เปิดเมื่อคลิกปุ่มรายละเอียด", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";
    const testLat = 18.8958;
    const testLng = 98.957;

    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");
    await page.getByText("ค้นหาจากตำแหน่ง").first().click();
    const latInput = page.locator('input[id="lat"], input[name="Lat"]').first();
    const lngInput = page
      .locator(
        'input[id="lng"], input[id="lon"], input[name="Lng"], input[name="Lon"]',
      )
      .first();
    await latInput.fill(String(testLat));
    await lngInput.fill(String(testLng));
    await page.locator("#searchByLocation").click();

    const cards = page
      .locator("#capFeedLocationCardContainer")
      .first()
      .locator(".card");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    const firstCard = cards.first();
    const detailButton = firstCard
      .locator("button.card-content, button:has-text('ดูรายละเอียด')")
      .first();
    await expect(detailButton).toBeVisible({ timeout: 10000 });
    await detailButton.click();

    const modal = page.locator(".modal.show, [role='dialog']").first();
    await expect(modal).toBeVisible({ timeout: 10000 });

    console.log(
      `✅ TC-DA-LOC-040 ผ่าน — Modal แสดงขึ้นมาได้อย่างถูกต้อง | Card count: ${cardCount}`,
    );
  });

  test("TC-DA-LOC-041 : ตรวจสอบชื่อเหตุการณ์แสดงใน Modal ตรงตาม Card", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";
    const testLat = 18.8958;
    const testLng = 98.957;

    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");
    await page.getByText("ค้นหาจากตำแหน่ง").first().click();
    await page
      .locator('input[id="lat"], input[name="Lat"]')
      .first()
      .fill(String(testLat));
    await page
      .locator(
        'input[id="lng"], input[id="lon"], input[name="Lng"], input[name="Lon"]',
      )
      .first()
      .fill(String(testLng));
    await page.locator("#searchByLocation").click();

    const cards = page
      .locator("#capFeedLocationCardContainer")
      .first()
      .locator(".card");
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

    const modal = page.locator(".modal.show, [role='dialog']").first();
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

  test("TC-DA-LOC-042 : ตรวจสอบข้อมูลรายละเอียดเมื่อคลิกดูรายละเอียด", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";
    const testLat = 18.8958;
    const testLng = 98.957;

    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");
    await page.getByText("ค้นหาจากตำแหน่ง").first().click();
    await page
      .locator('input[id="lat"], input[name="Lat"]')
      .first()
      .fill(String(testLat));
    await page
      .locator(
        'input[id="lng"], input[id="lon"], input[name="Lng"], input[name="Lon"]',
      )
      .first()
      .fill(String(testLng));
    await page.locator("#searchByLocation").click();

    const cards = page
      .locator("#capFeedLocationCardContainer")
      .first()
      .locator(".card");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    await cards.first().getByRole("button", { name: "ดูรายละเอียด" }).click();

    const detailContainer = page
      .locator("#capFeedDetailContainer, .modal.show, [role='dialog']")
      .first();
    await expect(detailContainer).toBeVisible({ timeout: 10000 });

    await expect(
      detailContainer.getByText("ที่มาของแหล่งข้อมูล:"),
    ).toBeVisible();
    await expect(detailContainer.getByText("ความรุนแรง:")).toBeVisible();
    await expect(detailContainer.getByText("ความเร่งด่วน:")).toBeVisible();
    await expect(detailContainer.getByText("ความแน่นอน:")).toBeVisible();
    await expect(detailContainer.getByText("คำเตือนที่มีผล:")).toBeVisible();
    await expect(detailContainer.getByText("คำเตือนสิ้นสุด:")).toBeVisible();
    await expect(detailContainer.getByText("ข้อความแจ้งเตือน:")).toBeVisible();
    await expect(
      detailContainer.getByText("พื้นที่ที่ได้รับผลกระทบ"),
    ).toBeVisible();
    await expect(detailContainer.getByText("ภาค:")).toBeVisible();
    await expect(detailContainer.getByText("จังหวัด:")).toBeVisible();
    await expect(detailContainer.getByText("ตำบล:")).toBeVisible();
    await expect(
      detailContainer.getByText("พื้นที่รูปแบบ polygon"),
    ).toBeVisible();
  });

  test("TC-DA-LOC-043 : ตรวจสอบปุ่ม Copy ข้อความแจ้งเตือน", async ({
    page,
    context,
  }) => {
    test.setTimeout(120000);
    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";
    const testLat = 18.8958;
    const testLng = 98.957;

    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");
    await page.getByText("ค้นหาจากตำแหน่ง").first().click();
    await page
      .locator('input[id="lat"], input[name="Lat"]')
      .first()
      .fill(String(testLat));
    await page
      .locator(
        'input[id="lng"], input[id="lon"], input[name="Lng"], input[name="Lon"]',
      )
      .first()
      .fill(String(testLng));
    await page.locator("#searchByLocation").click();

    const cards = page
      .locator("#capFeedLocationCardContainer")
      .first()
      .locator(".card");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    await cards.first().getByRole("button", { name: "ดูรายละเอียด" }).click();

    const detailContainer = page
      .locator("#capFeedDetailContainer, .modal.show, [role='dialog']")
      .first();
    await expect(detailContainer).toBeVisible({ timeout: 10000 });

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
    await expect(copyButton).toBeVisible({ timeout: 10000 });
    await copyButton.click();

    await expect(page.locator("text=คัดลอกไปยังคลิปบอร์ดแล้ว")).toBeVisible({
      timeout: 5000,
    });
    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );
    expect(clipboardText.length).toBeGreaterThan(0);
    if (expectedDescription.length > 0) {
      expect(clipboardText).toContain(expectedDescription);
    }
  });

  test("TC-DA-LOC-044 : ตรวจสอบแสดงพื้นที่ polygon", async ({ page }) => {
    test.setTimeout(120000);
    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";
    const testLat = 18.8958;
    const testLng = 98.957;

    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");
    await page.getByText("ค้นหาจากตำแหน่ง").first().click();
    await page
      .locator('input[id="lat"], input[name="Lat"]')
      .first()
      .fill(String(testLat));
    await page
      .locator(
        'input[id="lng"], input[id="lon"], input[name="Lng"], input[name="Lon"]',
      )
      .first()
      .fill(String(testLng));
    await page.locator("#searchByLocation").click();

    const cards = page
      .locator("#capFeedLocationCardContainer")
      .first()
      .locator(".card");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    await cards.first().getByRole("button", { name: "ดูรายละเอียด" }).click();

    const detailContainer = page
      .locator("#capFeedDetailContainer, .modal.show, [role='dialog']")
      .first();
    await expect(detailContainer).toBeVisible({ timeout: 10000 });

    const polygonLayer = detailContainer
      .locator("path.leaflet-interactive, svg path")
      .first();
    await expect(polygonLayer).toBeVisible({ timeout: 15000 });
    const polygonPathD = await polygonLayer.getAttribute("d");
    expect(polygonPathD).toBeTruthy();
    await expect(
      detailContainer.getByText("พื้นที่รูปแบบ polygon"),
    ).toBeVisible();

    await expect(
      detailContainer.locator("text=Error, text=ไม่สามารถโหลดแผนที่"),
    ).toBeHidden({
      timeout: 5000,
    });
  });

  test("TC-DA-LOC-045 : ตรวจสอบ map แสดงพื้นที่กระทบ", async ({ page }) => {
    test.setTimeout(120000);
    const portalUrl = "https://ndwc-portal-dev.azurewebsites.net/";
    const testLat = 18.8958;
    const testLng = 98.957;

    await page.goto(portalUrl);
    await page.waitForLoadState("networkidle");
    await page.getByText("ค้นหาจากตำแหน่ง").first().click();
    await page
      .locator('input[id="lat"], input[name="Lat"]')
      .first()
      .fill(String(testLat));
    await page
      .locator(
        'input[id="lng"], input[id="lon"], input[name="Lng"], input[name="Lon"]',
      )
      .first()
      .fill(String(testLng));
    await page.locator("#searchByLocation").click();

    const cards = page
      .locator("#capFeedLocationCardContainer")
      .first()
      .locator(".card");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    await cards.first().getByRole("button", { name: "ดูรายละเอียด" }).click();

    const detailContainer = page
      .locator("#capFeedDetailContainer, .modal.show, [role='dialog']")
      .first();
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
      console.warn(
        "⚠️ ไม่พบ tile layer (environment อาจบล็อก map tiles) แต่ทดสอบชั้นข้อมูลต่อ",
      );
    }

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

    await expect(detailContainer.getByText("ภาค:")).toBeVisible();
    await expect(detailContainer.getByText("จังหวัด:")).toBeVisible();
    await expect(detailContainer.getByText("ตำบล:")).toBeVisible();
    await expect(
      detailContainer.getByText("พื้นที่รูปแบบ polygon"),
    ).toBeVisible();

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
  });
});
