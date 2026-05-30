// Smoke-тест: подключение к Postgres → загрузка каталога →
// краткая сводка по division/rigidity + первые 3 SKU. Запускается
// один раз для проверки, что сервер видит БД.
//
// Запуск:
//   PGPASSWORD=... node dist/server/test/testCatalogFromDb.js

import { createPool } from "../db/pool.js";
import { loadCatalogFromDb } from "../catalog/loadCatalogFromDb.js";

async function main() {
  const pool = createPool();
  try {
    const catalog = await loadCatalogFromDb(pool);
    console.log(`✓ загружено ${catalog.length} активных SKU`);

    const byDiv: Record<string, number> = {};
    const byRig: Record<string, number> = {};
    for (const s of catalog) {
      byDiv[s.division_type] = (byDiv[s.division_type] ?? 0) + 1;
      byRig[s.rigidity]      = (byRig[s.rigidity]      ?? 0) + 1;
    }
    console.log("  по division:", byDiv);
    console.log("  по rigidity:", byRig);

    console.log("\nпервые 3:");
    for (const s of catalog.slice(0, 3)) {
      console.log(
        `  ${s.sku_id}  ${s.division_type}/${s.rigidity}  ` +
        `${s.width_cm}×${s.depth_cm}×${s.height_cm}  cap=${s.capacity_units}  set=${s.set_quantity}  ` +
        `can_rotate=${s.can_rotate}`,
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("✗ failed:", e);
  process.exit(1);
});
