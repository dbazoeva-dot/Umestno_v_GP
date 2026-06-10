// Подбор уменьшения объёма категории на fit_partial.
//
// Контекст: движок отдал fit_partial — часть категорий поместилась,
// часть нет. На /no-fit/ юзеру нужно показать конкретное предложение
// «не вошли носки, можем уместить если уменьшите количество с
// Много (17+ пар) до 16 пар. Согласны?».
//
// Чтобы это сгенерировать, нужно знать:
// 1. Какая именно категория не влезла (берём из fit_result.unplaced_zones)
// 2. На какой объёмный уровень её надо снизить, чтобы влезло (large→medium→small)
// 3. Точное число штук/пар на этом уровне (из libraries.volumeToCount)
//
// Логика жёстко ограничена: предлагаем suggestion ТОЛЬКО когда
// не влезла ровно 1 категория. Если 2+ — сценарий слишком сложный,
// юзер запутается, отправляем на стандартный /no-fit/ как раньше.
//
// На каждом снижении мы заново гоняем движок — это до 2 итераций
// (large→medium, потом если не помогло medium→small). Цена одной
// итерации движка ~10-30 мс, поэтому суммарно ≤60 мс — пренебрежимо.

import { runUmestnoEngine } from "../../engine/index.js";
import type { SkuCatalogRow, VolumeLevel } from "../../engine/types.js";
import { defaultLibraries } from "../../engine/libraries/defaultLibraries.js";

// Используем тот же тип, что приходит в /api/calculate body.
// Не импортируем CalculateRequest напрямую чтобы не плодить зависимости
// service → api.
interface ReducibleInput {
  drawer_width_cm: number;
  drawer_depth_cm: number;
  drawer_height_cm: number;
  storage_category: "underwear" | "soft_clothes" | "accessories" | "mixed";
  items: Array<{ content_type: string; volume_level: VolumeLevel }>;
  priority: "convenient" | "capacity" | "budget";
  color_preference?: string;
}

export interface FitReductionSuggestion {
  /** Engine content_type (например 'socks_regular' для носков). */
  category_id: string;
  /** Текущий уровень объёма этой категории. */
  original_level: VolumeLevel;
  /** Уровень, до которого надо снизить чтобы всё влезло. */
  suggested_level: VolumeLevel;
  /** Точное число штук/пар/комплектов на suggested_level. Берётся
   *  из libraries.volumeToCount — это ровно то число, под которое
   *  движок будет считать схему. */
  suggested_count: number;
  /** Единица измерения для UI ('пар', 'шт', 'компл.'). */
  count_unit: string;
}

const LEVEL_ORDER: VolumeLevel[] = ["small", "medium", "large"];

/** Возвращает true если fit_status считается «успехом»
 *  (юзер увидит схему и может оплатить). */
function isSuccess(status: string): boolean {
  return status === "fit_all" || status === "fit_all_after_adjustment";
}

/** Подобрать минимальное снижение объёма для unplaced категории.
 *  Возвращает suggestion или null, если:
 *  - unplaced категорий не ровно 1
 *  - даже Мало (small) не помогает
 *  - категория уже на Мало и снижать некуда
 *
 *  catalog нужен для повтора engine (он принимает skuCatalog через libraries). */
export function findReduction(
  originalInput: ReducibleInput,
  unplacedCategories: string[],
  catalog: SkuCatalogRow[],
): FitReductionSuggestion | null {
  if (unplacedCategories.length !== 1) return null;
  const unplacedCategory = unplacedCategories[0];

  // Ищем в items оригинального инпута эту категорию (по точному
  // совпадению content_type). normalizeInput движка трансформирует
  // 'socks' в 'socks_regular', но unplaced_zones возвращаются уже
  // с post-нормализационным content_type — оба должны совпадать.
  const originalItem = originalInput.items.find(
    (it) => it.content_type === unplacedCategory || it.content_type + "_regular" === unplacedCategory,
  );
  if (!originalItem) return null;
  const originalLevel = originalItem.volume_level;

  const originalIdx = LEVEL_ORDER.indexOf(originalLevel);
  if (originalIdx <= 0) return null; // уже small, снижать некуда

  const libraries = { ...defaultLibraries, skuCatalog: catalog };

  // Идём от текущего уровня вниз (medium, потом small если medium не помог).
  // Меньшее снижение лучше — юзер потеряет меньше штук.
  for (let tryIdx = originalIdx - 1; tryIdx >= 0; tryIdx--) {
    const tryLevel = LEVEL_ORDER[tryIdx];

    // Создаём модифицированный input — заменяем уровень только у unplaced категории.
    const modifiedInput: ReducibleInput = {
      ...originalInput,
      items: originalInput.items.map((it) =>
        it === originalItem ? { ...it, volume_level: tryLevel } : it,
      ),
    };

    const tryResult = runUmestnoEngine(
      modifiedInput as Parameters<typeof runUmestnoEngine>[0],
      libraries,
    ) as { scheme_payload: { fit_status: string } | null };

    if (tryResult.scheme_payload && isSuccess(tryResult.scheme_payload.fit_status)) {
      // Нашли! Достаём точное число для UI из volumeToCount таблицы.
      const row = libraries.volumeToCount.find(
        (r) => r.content_type === unplacedCategory && r.volume_level === tryLevel,
      );
      if (!row) return null;
      return {
        category_id: unplacedCategory,
        original_level: originalLevel,
        suggested_level: tryLevel,
        suggested_count: row.count,
        count_unit: row.count_unit,
      };
    }
  }
  return null;
}

