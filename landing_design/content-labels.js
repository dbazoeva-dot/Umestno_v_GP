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

  /* ── Памятка «Как сложить» — совет по складыванию на категорию.
     РЕДАКТИРУЕМО: формулировки можно править вручную. ── */
  var FOLD_TIP = {
    socks:         'по парам, в одну ячейку',
    panties:       'тонкими конвертиками, вертикально',
    boxers:        'сложить вдвое, поставить вертикально',
    sport_tops:    'свернуть нетугим рулончиком',
    bras:          'вложить чашку в чашку, не сминая форму',
    tights:        'свернуть рулончиком, по парам',
    thermals:      'сложить прямоугольником, вертикально',
    pajamas:       'сложить комплектом, вертикально',
    nightgowns:    'сложить пополам, поставить вертикально',
    swimwear:      'свернуть нетугим рулончиком',
    tshirts:       'плотными прямоугольниками, вертикально',
    longsleeves:   'сложить прямоугольником, вертикально',
    sweaters:      'сложить стопкой, не сминая',
    jeans:         'сложить пополам и свернуть рулоном',
    leggings:      'свернуть рулончиком',
    shorts:        'сложить вдвое, поставить вертикально',
    belts:         'свернуть в нетугую спираль',
    jewelry_large: 'разложить по отдельным ячейкам',
    jewelry_small: 'разложить по мелким ячейкам',
    scarves:       'свернуть рулончиком',
    ties:          'свернуть рулончиком, по одному в ячейку'
  };
  FOLD_TIP.socks_regular = FOLD_TIP.socks;

  /* иконка категории (файлы в landing_design/assets) */
  var FOLD_ICON = {
    socks: 'socks.png', panties: 'panties.png', boxers: 'boxers.png',
    sport_tops: 'sport_tops.png', bras: 'bras.png', tights: 'tights.png',
    thermals: 'themals.png', nightgowns: 'nightgpwn.png', swimwear: 'swimwear.png',
    tshirts: 'tshirt.png', longsleeves: 'longsleeve.png', sweaters: 'sweater.png',
    jeans: 'jeans.png', leggings: 'leggins.png', shorts: 'shorts.png',
    belts: 'belt.png', jewelry_large: 'jewelry_large.png',
    jewelry_small: 'jewelry_small.png', scarves: 'scarves.png', ties: 'ties.png'
  };
  FOLD_ICON.socks_regular = FOLD_ICON.socks;

  /* ── «Почему эта схема подходит» — человеческий текст по id правил движка.
     Показываем только пользовательски осмысленные; report-only пропускаем.
     РЕДАКТИРУЕМО. ── */
  var RULE_TEXT = {
    D01: { t: 'Категории сгруппированы', d: 'похожие вещи лежат рядом, ничего не теряется' },
    D05: { t: 'Частое — ближе к вам', d: 'то, чем пользуетесь каждый день, в переднем ряду' },
    D06: { t: 'Деликатное не сминается', d: 'для бюстгальтеров оставлен запас по высоте' },
    D04: { t: 'Свободное место — с краю', d: 'резерв вынесен к стенке, его удобно занять позже' }
    // D02, D03, D04b — внутренние/диагностические, пользователю не показываем
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
