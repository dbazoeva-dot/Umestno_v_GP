"use client";
import { useState } from "react";
import type { StorageCategory, VolumeLevel } from "@engine/types.js";

const CONTENT_TYPES: Record<StorageCategory, { value: string; label: string }[]> = {
  underwear: [
    { value: "socks_regular", label: "Носки" },
    { value: "panties", label: "Трусы (женские)" },
    { value: "boxers", label: "Трусы (мужские)" },
    { value: "bras", label: "Бюстгалтеры" },
    { value: "tights", label: "Колготки / чулки" },
  ],
  soft_clothes: [
    { value: "tshirts", label: "Футболки" },
    { value: "longsleeves", label: "Лонгсливы" },
    { value: "sweaters", label: "Свитеры / худи" },
    { value: "jeans", label: "Джинсы / брюки" },
    { value: "shorts", label: "Шорты" },
    { value: "leggings", label: "Леггинсы" },
    { value: "sport_tops", label: "Спортивные топы" },
    { value: "swimwear", label: "Купальники" },
    { value: "thermals", label: "Термобельё" },
    { value: "pajamas", label: "Пижамы" },
    { value: "nightgowns", label: "Ночные рубашки" },
  ],
  accessories: [
    { value: "belts", label: "Ремни" },
    { value: "scarves", label: "Шарфы / платки" },
    { value: "ties", label: "Галстуки" },
    { value: "jewelry_large", label: "Украшения крупные" },
    { value: "jewelry_small", label: "Украшения мелкие" },
  ],
  mixed: [
    { value: "socks_regular", label: "Носки" },
    { value: "panties", label: "Трусы (женские)" },
    { value: "boxers", label: "Трусы (мужские)" },
    { value: "bras", label: "Бюстгалтеры" },
    { value: "tights", label: "Колготки / чулки" },
    { value: "tshirts", label: "Футболки" },
    { value: "longsleeves", label: "Лонгсливы" },
    { value: "sweaters", label: "Свитеры / худи" },
    { value: "jeans", label: "Джинсы / брюки" },
    { value: "shorts", label: "Шорты" },
    { value: "leggings", label: "Леггинсы" },
    { value: "sport_tops", label: "Спортивные топы" },
    { value: "swimwear", label: "Купальники" },
    { value: "thermals", label: "Термобельё" },
    { value: "pajamas", label: "Пижамы" },
    { value: "nightgowns", label: "Ночные рубашки" },
    { value: "belts", label: "Ремни" },
    { value: "scarves", label: "Шарфы / платки" },
    { value: "ties", label: "Галстуки" },
    { value: "jewelry_large", label: "Украшения крупные" },
    { value: "jewelry_small", label: "Украшения мелкие" },
  ],
};

const VOLUME_LABELS: Record<VolumeLevel, string> = {
  small: "Мало",
  medium: "Средне",
  large: "Много",
};

const CATEGORY_LABELS: Record<StorageCategory, string> = {
  underwear: "Нижнее бельё",
  soft_clothes: "Одежда",
  accessories: "Аксессуары",
  mixed: "Смешанное",
};

const PRIORITY_LABELS = [
  { value: "convenient", label: "Удобно" },
  { value: "capacity", label: "Вместительно" },
  { value: "budget", label: "Бюджетно" },
];

interface Item {
  content_type: string;
  volume_level: VolumeLevel;
}

export default function Home() {
  const [width, setWidth] = useState("");
  const [depth, setDepth] = useState("");
  const [height, setHeight] = useState("");
  const [category] = useState<StorageCategory>("soft_clothes");
  const [items, setItems] = useState<Item[]>([{ content_type: "", volume_level: "medium" }]);
  const [priority, setPriority] = useState("convenient");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ configuration_id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const availableTypes = CONTENT_TYPES[category];

  function addItem() {
    if (items.length < 4) setItems([...items, { content_type: "", volume_level: "medium" }]);
  }

  function removeItem(i: number) {
    setItems(items.filter((_, idx) => idx !== i));
  }

  function updateItem(i: number, field: keyof Item, value: string) {
    setItems(items.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    const body: Record<string, unknown> = {
      drawer_width_cm: Number(width),
      drawer_depth_cm: Number(depth),
      drawer_height_cm: Number(height),
      storage_category: category,
      priority,
    };

    items.forEach((item, i) => {
      if (item.content_type) {
        body[`item_${i + 1}_content_type`] = item.content_type;
        body[`item_${i + 1}_volume_level`] = item.volume_level;
      }
    });

    try {
      const res = await fetch("/api/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Ошибка сервера");
      else setResult(data);
    } catch {
      setError("Не удалось подключиться к серверу");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-lg mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Уместно — конфигуратор</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">

        <section>
          <h2 className="font-semibold mb-2">1. Где хранить</h2>
          <span className="inline-block px-3 py-1 rounded border text-sm bg-black text-white">
            Выдвижной ящик
          </span>
        </section>

        <section>
          <h2 className="font-semibold mb-2">2. Размеры ящика (см)</h2>
          <div className="flex gap-3">
            {[
              { label: "Ширина (Ш)", val: width, set: setWidth },
              { label: "Глубина (Г)", val: depth, set: setDepth },
              { label: "Высота (В)", val: height, set: setHeight },
            ].map(({ label, val, set }) => (
              <label key={label} className="flex flex-col gap-1 flex-1 text-sm">
                {label}
                <input
                  type="number" min="1" max="200" required
                  value={val} onChange={e => set(e.target.value)}
                  className="border rounded px-2 py-1"
                />
              </label>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-semibold mb-2">3. Тип вещей</h2>
          <span className="inline-block px-3 py-1 rounded border text-sm bg-black text-white">
            Одежда
          </span>
        </section>

        <section>
          <h2 className="font-semibold mb-2">4. Что хранить (до 4 видов)</h2>
          <div className="flex flex-col gap-2">
            {items.map((item, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select
                  required
                  value={item.content_type}
                  onChange={e => updateItem(i, "content_type", e.target.value)}
                  className="border rounded px-2 py-1 flex-1 text-sm"
                >
                  <option value="">— выберите —</option>
                  {availableTypes.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <select
                  value={item.volume_level}
                  onChange={e => updateItem(i, "volume_level", e.target.value as VolumeLevel)}
                  className="border rounded px-2 py-1 text-sm"
                >
                  {(Object.entries(VOLUME_LABELS) as [VolumeLevel, string][]).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(i)} className="text-gray-400 hover:text-red-500 text-lg leading-none">×</button>
                )}
              </div>
            ))}
            {items.length < 4 && (
              <button type="button" onClick={addItem} className="text-sm text-blue-600 hover:underline w-fit">
                + добавить вид
              </button>
            )}
          </div>
        </section>

        <section>
          <h2 className="font-semibold mb-2">Приоритет</h2>
          <div className="flex gap-2">
            {PRIORITY_LABELS.map(p => (
              <button
                key={p.value} type="button"
                onClick={() => setPriority(p.value)}
                className={`px-3 py-1 rounded border text-sm ${priority === p.value ? "bg-black text-white" : "bg-white"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </section>

        <button
          type="submit" disabled={loading}
          className="bg-black text-white py-2 rounded font-medium disabled:opacity-50"
        >
          {loading ? "Считаю…" : "Рассчитать"}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-sm">
          <p className="font-semibold">Готово!</p>
          <p className="text-gray-600 mt-1">ID конфигурации: <code>{result.configuration_id}</code></p>
        </div>
      )}
    </main>
  );
}
