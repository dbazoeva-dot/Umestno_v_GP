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

  /* ── Описание блока в рекомендациях ─────────────────────────────
     Текст, который рендерится в шапке блока рекомендаций ниже категории.
     Зависит от того, **как зона реально размещена**:
       primary — в основном контейнере категории (cells или slots);
       open    — в открытом отсеке (fallback, когда основной не влез).
     Альтернативный контейнер у всех категорий = open, поэтому матрица
     по факту двумерная: content_type × {primary | open}.
     Комментарий рядом подсказывает, в чём именно primary для категории
     и как лежат вещи (storage_method) — чтобы было удобно формулировать.

     РЕДАКТИРУЕМО. Тексты сейчас пустые — заполни их. ── */
  var BLOCK_DESC = {
    // ── БЕЛЬЁ ──────────────────────────────────────────────
    socks:         { primary: 'Рулоны стоят по ячейкам, пары не путаются.',
                     open:    'Рулоны собраны в открытой секции и остаются видны сверху.' },
    panties:       { primary: 'Тонкие прямоугольники стоят отдельно, всё видно сверху.',
                     open:    'Тонкие прямоугольники лежат в одном ряду и не смешиваются с крупным.' },
    boxers:        { primary: 'Прямоугольники стоят в слотах, не расползаются по ящику.',
                     open:    'Прямоугольники собраны в открытом блоке и держат общий порядок.' },
    sport_tops:    { primary: 'Плоская укладка в слотах сохраняет форму и не разъезжается.',
                     open:    'Плоская укладка сохраняет форму без отдельного разделителя.' },
    bras:          { primary: 'Деликатная стопка в слотах, чашки не сминаются.',
                     open:    'Деликатная стопка лежит свободно, чашки не прижаты сверху.' },
    tights:        { primary: 'Рулоны лежат по ячейкам, тонкая ткань не цепляется.',
                     open:    'Рулоны собраны отдельно, тонкая ткань не цепляется за фурнитуру.' },
    thermals:      { primary: 'Комплекты стоят в слотах, верх и низ не теряются.',
                     open:    'Комплекты лежат вместе, верх и низ остаются в одной зоне.' },
    pajamas:       { primary: 'Комплекты стоят в слотах, их легко брать целиком.',
                     open:    'Комплекты собраны в открытом блоке, их удобно брать целиком.' },
    nightgowns:    { primary: 'Прямоугольники стоят в слотах, ткань меньше мнётся.',
                     open:    'Прямоугольники лежат отдельно от фурнитуры и плотных вещей.' },
    swimwear:      { primary: 'Плоская укладка в слотах сохраняет комплекты вместе.',
                     open:    'Плоская укладка держит комплект вместе без лишнего сжатия.' },
    // ── ОДЕЖДА ─────────────────────────────────────────────
    tshirts:       { primary: 'Прямоугольники стоят в слотах, каждый слой виден сверху.',
                     open:    'Прямоугольники стоят в открытом блоке, каждый слой виден сверху.' },
    longsleeves:   { primary: 'Тонкие прямоугольники стоят в слотах, рукава не выбиваются.',
                     open:    'Рукава убраны внутрь, вещи лежат аккуратным рядом.' },
    sweaters:      { primary: 'Крупные прямоугольники стоят в слотах, стопки не заваливаются.',
                     open:    'Крупные прямоугольники лежат свободно и не требуют мелких секций.' },
    jeans:         { primary: 'Крупные прямоугольники стоят в слотах, блок держит форму.',
                     open:    'Крупные прямоугольники собраны в один устойчивый блок.' },
    leggings:      { primary: 'Тонкие прямоугольники стоят в слотах, каждую пару видно.',
                     open:    'Узкие прямоугольники стоят рядом и остаются видны сверху.' },
    shorts:        { primary: 'Прямоугольники стоят в слотах, вещи не перемешиваются.',
                     open:    'Прямоугольники собраны по типу и не смешиваются с мелким.' },
    // ── АКСЕССУАРЫ ─────────────────────────────────────────
    belts:         { primary: 'Спирали лежат по ячейкам, пряжки не цепляют одежду.',
                     open:    'Спирали собраны в отдельной зоне, пряжки не цепляют ткань.' },
    jewelry_large: { primary: 'Каждое украшение лежит отдельно, детали не трутся друг о друга.',
                     open:    'Крупные украшения лежат свободно, без давления друг на друга.' },
    jewelry_small: { primary: 'Маленькие секции разделяют кольца, серьги и цепочки.',
                     open:    'Мелкие украшения собраны в одной зоне, их проще пересыпать во вкладыш.' },
    scarves:       { primary: 'Рулоны стоят в слотах, ткань видно по цветам.',
                     open:    'Рулоны собраны по типу ткани и видны сверху.' },
    ties:          { primary: 'Рулоны лежат по ячейкам, ткань не заламывается.',
                     open:    'Свободные рулоны лежат отдельно и не заламываются под тяжестью.' }
  };
  BLOCK_DESC.socks_regular = BLOCK_DESC.socks; // алиас движка

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
    priorityLabel: function (p) { return PRIORITY_RU[p] || p; },
    /** описание блока в рекомендациях — зависит от фактического division_type
     *  (cells/slots → primary текст; open → open-fallback текст) */
    blockDesc: function (contentType, divisionType) {
      var entry = BLOCK_DESC[contentType];
      if (!entry) return '';
      return (divisionType === 'open') ? (entry.open || '') : (entry.primary || '');
    }
  };
})(window);
