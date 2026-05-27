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
    { id: 'tshirts',       ru: 'Футболки',          group: 'clothing' },
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

  /* ── Памятка «Как сложить» — совет по складыванию на категорию.
     Источник: таблица библиотеки A (мэтчинг иконок + тексты). ── */
  var FOLD_TIP = {
    panties:       'сложить тонкими конвертиками, поставить вертикально',
    boxers:        'сложить в прямоугольник, поставить вертикально',
    bras:          'вложить каждый в свою секцию, лямки убрать внутрь',
    socks:         'свернуть пару в компактный рулон и поставить в ячейку',
    tights:        'сложить в прямоугольник и поставить вертикально',
    tank_tops:     'сложить в прямоугольник и поставить вертикально',
    tshirts:       'сложить в прямоугольник и поставить вертикально',
    sport_tops:    'сложить тонкими конвертиками, поставить вертикально',
    longsleeves:   'сложить в прямоугольник и поставить вертикально',
    pajamas:       'сложить верх и низ вместе одним прямоугольником',
    thermals:      'сложить верх и низ вместе одним прямоугольником',
    leggings:      'сложить по длине и поставить вертикально',
    nightgowns:    'сложить бретели внутрь и убрать в отдельный блок',
    jeans:         'сложить в прямоугольник, поставить вертикально',
    shorts:        'сложить в прямоугольник, поставить вертикально',
    sweaters:      'убрать рукава внутрь и сложить в прямоугольник',
    swimwear:      'хранить комплектом, сложить тонким конвертиком',
    belts:         'свернуть в нетугую спираль пряжкой наружу',
    ties:          'свернуть свободным рулоном от узкого конца',
    scarves:       'тонкие свернуть рулоном, плотные — прямоугольником',
    jewelry_small: 'разложить по отдельным секциям',
    jewelry_large: 'разложить по отдельным открытым секциям'
  };
  FOLD_TIP.socks_regular = FOLD_TIP.socks;

  /* иконка категории (файлы в landing_design/assets).
     ВНИМАНИЕ: pajamas.png и tank_top.png пока отсутствуют в assets. */
  var FOLD_ICON = {
    panties: 'panties.png', boxers: 'boxers.png', bras: 'bras.png',
    socks: 'socks.png', tights: 'tights.png', tank_tops: 'tank_top.png',
    tshirts: 'tshirt.png', sport_tops: 'sport_tops.png', longsleeves: 'longsleeve.png',
    pajamas: 'pajamas.png', thermals: 'thermals.png', leggings: 'leggings.png',
    nightgowns: 'nightgown.png', jeans: 'jeans.png', shorts: 'shorts.png',
    sweaters: 'sweater.png', swimwear: 'swimwear.png', belts: 'belt.png',
    ties: 'ties.png', scarves: 'scarves.png',
    jewelry_small: 'jewelry_small.png', jewelry_large: 'jewelry_large.png'
  };
  FOLD_ICON.socks_regular = FOLD_ICON.socks;

  /* ── «Почему эта схема подходит» — человеческий текст по id правил движка.
     Показываем только пользовательски осмысленные; report-only пропускаем.
     РЕДАКТИРУЕМО. ── */
  var RULE_TEXT = {
    D01: { t: 'Каждой категории вещей своё хранение', d: 'вещи не смешиваются и их проще вернуть на место' },
    D04: { t: 'Есть место для запаса', d: 'резерв вынесен к краю, его можно использовать под доп. хранение' },
    D05: { t: 'Частое используемое — ближе к вам', d: 'повседневные вещи проще доставать' },
    D06: { t: 'Деликатное не сминается', d: 'для деликатных вещей оставлен запас по высоте' }
    // D02, D03, D04b — внутренние/диагностические, пользователю не показываем
    // D06 показывается только если в схеме есть деликатные вещи (см. result-render.js)
  };

  var PRIORITY_RU = { convenient: 'удобно', capacity: 'вместительно' };

  global.UMESTNO_CONTENT = {
    groups: GROUPS,
    items: ITEMS,
    /** ru-название категории по коду content_type ('bras' → 'Бюстгальтеры') */
    label: function (contentType) { return LABEL[contentType] || contentType; },
    /** ru-название группы по id ('underwear' → 'Бельё') */
    groupLabel: function (groupId) { return GROUP_RU[groupId] || groupId; },
    /** совет по складыванию для категории */
    foldTip: function (contentType) { return FOLD_TIP[contentType] || ''; },
    /** имя файла иконки категории */
    foldIcon: function (contentType) { return FOLD_ICON[contentType] || ''; },
    /** {t,d} текст правила раскладки или null, если правило не показываем */
    ruleText: function (ruleId) { return RULE_TEXT[ruleId] || null; },
    /** ru-название приоритета */
    priorityLabel: function (p) { return PRIORITY_RU[p] || p; }
  };
})(window);
