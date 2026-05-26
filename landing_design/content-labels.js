/* Уместно — клиентские названия категорий (из библиотеки A).
   Единый источник для: выпадающего списка конфигуратора, подписей блоков
   на схеме результата, подстановки в тексты предупреждений.
   system_id = код движка (content_type). socks ↔ socks_regular в рантайме.
   ВАЖНО: swimwear отнесён к underwear (бельё), не к accessories. */
(function (global) {
  var GROUPS = [
    { id: 'underwear',   ru: 'Бельё' },
    { id: 'clothing',    ru: 'Одежда' },
    { id: 'accessories', ru: 'Аксессуары' }
  ];

  var ITEMS = [
    // Бельё
    { id: 'socks',         ru: 'Носки',             group: 'underwear' },
    { id: 'panties',       ru: 'Трусы',             group: 'underwear' },
    { id: 'boxers',        ru: 'Боксеры',           group: 'underwear' },
    { id: 'sport_tops',    ru: 'Спортивные топы',   group: 'underwear' },
    { id: 'bras',          ru: 'Бюстгальтеры',      group: 'underwear' },
    { id: 'tights',        ru: 'Колготки / чулки',  group: 'underwear' },
    { id: 'thermals',      ru: 'Термобельё',        group: 'underwear' },
    { id: 'pajamas',       ru: 'Пижамы',            group: 'underwear' },
    { id: 'nightgowns',    ru: 'Ночные сорочки',    group: 'underwear' },
    { id: 'swimwear',      ru: 'Купальники',        group: 'underwear' },
    // Одежда
    { id: 'tshirts',       ru: 'Майки / футболки',  group: 'clothing' },
    { id: 'longsleeves',   ru: 'Лонгсливы',         group: 'clothing' },
    { id: 'sweaters',      ru: 'Джемперы',          group: 'clothing' },
    { id: 'jeans',         ru: 'Джинсы',            group: 'clothing' },
    { id: 'leggings',      ru: 'Леггинсы',          group: 'clothing' },
    { id: 'shorts',        ru: 'Шорты',             group: 'clothing' },
    // Аксессуары
    { id: 'belts',         ru: 'Ремни',             group: 'accessories' },
    { id: 'jewelry_large', ru: 'Украшения крупные', group: 'accessories' },
    { id: 'jewelry_small', ru: 'Украшения мелкие',  group: 'accessories' },
    { id: 'scarves',       ru: 'Платки / шарфы',    group: 'accessories' },
    { id: 'ties',          ru: 'Галстуки',          group: 'accessories' }
  ];

  // быстрый поиск ru по коду (с алиасом socks_regular → socks)
  var LABEL = {};
  ITEMS.forEach(function (it) { LABEL[it.id] = it.ru; });
  LABEL['socks_regular'] = LABEL['socks'];

  var GROUP_RU = {};
  GROUPS.forEach(function (g) { GROUP_RU[g.id] = g.ru; });

  global.UMESTNO_CONTENT = {
    groups: GROUPS,
    items: ITEMS,
    /** ru-название категории по коду content_type ('bras' → 'Бюстгальтеры') */
    label: function (contentType) { return LABEL[contentType] || contentType; },
    /** ru-название группы по id ('underwear' → 'Бельё') */
    groupLabel: function (groupId) { return GROUP_RU[groupId] || groupId; }
  };
})(window);
