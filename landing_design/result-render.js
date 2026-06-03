/* Уместно — data-driven рендер результата.
   Принимает scheme_payload движка и строит:
   • схему (блоки по координатам в см + зоны «Резерв» из free_rectangles);
   • таблицу «Размеры блоков…» (строки блоков + строки резерва).
   Визуал — из result.css; рендер задаёт позиции/размеры/подписи/цвета. */
(function (global) {
  var BLOCK_COLORS = ['#EBDFC4', '#A6B38C', '#EDEAE1', '#DDC59B']; // = .b1..b4

  function round(n) { return Math.round(n * 100) / 100; }
  function cm(n) { var v = Math.round(n * 10) / 10; return (Number.isInteger(v) ? v : v.toFixed(1)) + ''; }
  function label(ct) {
    return (global.UMESTNO_CONTENT && global.UMESTNO_CONTENT.label) ? global.UMESTNO_CONTENT.label(ct) : ct;
  }
  function extents(zones, reserve) {
    var xs = zones.map(function (z) { return z.x_cm + z.assigned_w_cm; }).concat(reserve.map(function (r) { return r.x_cm + r.w_cm; }));
    var ys = zones.map(function (z) { return z.y_cm + z.assigned_d_cm; }).concat(reserve.map(function (r) { return r.y_cm + r.d_cm; }));
    return { W: Math.max.apply(null, xs.length ? xs : [1]), D: Math.max.apply(null, ys.length ? ys : [1]) };
  }
  // Резерв = одна правильная прямоугольная зона. Из перекрывающихся free_rectangles
  // берём самый «полезный»: короткая сторона ≥ порога (туда реально влезет органайзер/
  // коробка), максимальная площадь. Мелочь и тонкие сливеры резервом не помечаем.
  var RESERVE_MIN_SIDE = 8; // см
  function bestReserve(rects) {
    var best = null, bestArea = 0;
    (rects || []).forEach(function (r) {
      if (Math.min(r.w_cm, r.d_cm) < RESERVE_MIN_SIDE) return;
      var area = r.w_cm * r.d_cm;
      if (area > bestArea) { best = r; bestArea = area; }
    });
    return best ? [best] : [];
  }
  function place(el, x, y, w, d, W, D) {
    el.style.left = 'calc(' + round(x / W * 100) + '% + 0.55cqw)';
    el.style.bottom = 'calc(' + round(y / D * 100) + '% + 0.55cqw)';
    el.style.width = 'calc(' + round(w / W * 100) + '% - 1.1cqw)';
    el.style.height = 'calc(' + round(d / D * 100) + '% - 1.1cqw)';
  }

  function renderScheme(scheme, drawer) {
    var inner = document.querySelector('.u-res-scheme__inner');
    if (!inner || !scheme) return;
    var zones = scheme.assigned_zones || [];
    var reserve = bestReserve(scheme.reserve_zones || []);
    var e = extents(zones, scheme.reserve_zones || []);
    var W = (drawer && drawer.w_cm) || e.W, D = (drawer && drawer.d_cm) || e.D;

    var schemeEl = inner.closest('.u-res-scheme');
    if (schemeEl) schemeEl.style.setProperty('--ar', round(W / D));
    inner.classList.add('is-data');
    inner.innerHTML = '';

    zones.forEach(function (z, i) {
      var el = document.createElement('div');
      el.className = 'u-res-block b' + ((i % 4) + 1);
      if (z.zone_id) el.dataset.zone = z.zone_id;
      place(el, z.x_cm, z.y_cm, z.assigned_w_cm, z.assigned_d_cm, W, D);
      el.innerHTML = '<span class="u-res-block__n">Блок ' + (i + 1) + '</span>' +
        '<span class="u-res-block__cat">' + label(z.content_type) + '</span>';
      inner.appendChild(el);
    });
    reserve.forEach(function (r) {
      var el = document.createElement('div');
      el.className = 'u-res-block is-reserve' + (r.d_cm > r.w_cm * 1.4 ? ' is-vlabel' : '');
      place(el, r.x_cm, r.y_cm, r.w_cm, r.d_cm, W, D);
      el.innerHTML = '<span class="u-res-block__cat">Резерв</span>';
      inner.appendChild(el);
    });
  }

  function renderSizesTable(scheme) {
    var table = document.querySelector('.u-res-table');
    if (!table || !scheme) return;
    var head = table.querySelector('.u-res-table__head');
    table.innerHTML = '';
    if (head) table.appendChild(head);
    var zones = scheme.assigned_zones || [];
    var reserve = bestReserve(scheme.reserve_zones || []);

    function row(numHtml, what, size) {
      var r = document.createElement('div');
      r.className = 'u-res-table__row';
      r.innerHTML = numHtml + '<span>' + what + '</span><span class="mono">' + size + '</span>';
      return r;
    }
    zones.forEach(function (z, i) {
      var num = '<span class="u-res-table__num" style="background:' + BLOCK_COLORS[i % 4] + '">' + (i + 1) + '</span>';
      table.appendChild(row(num, label(z.content_type), cm(z.assigned_w_cm) + ' × ' + cm(z.assigned_d_cm) + ' × ' + cm(z.assigned_h_cm) + ' см'));
    });
    reserve.forEach(function (r) {
      var num = '<span class="u-res-table__num u-res-table__num--reserve" aria-hidden="true">—</span>';
      table.appendChild(row(num, 'Резерв (свободное место)', cm(r.w_cm) + ' × ' + cm(r.d_cm) + ' см'));
    });
  }

  var ASSET = '../landing_design/assets/';
  function C() { return global.UMESTNO_CONTENT || {}; }
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }

  // «Как сложить вещи» — строка на каждую уникальную категорию из схемы.
  // Текст советов лежит в FOLD_TIP (content-labels.js), сервер их не шлёт.
  function renderFolding(payload) {
    var list = document.querySelector('.u-res-fold');
    if (!list) return;
    var scheme = payload.scheme || payload;
    var zones = scheme.assigned_zones || [];
    var seen = {}, types = [];
    zones.forEach(function (z) {
      var ct = z.content_type;
      if (!ct || seen[ct]) return;
      seen[ct] = true;
      types.push(ct);
    });
    if (!types.length) return;
    var c = C();
    list.innerHTML = '';
    types.forEach(function (ct) {
      var tip = (c.foldTip && c.foldTip(ct)) || '';
      var icon = c.foldIcon && c.foldIcon(ct);
      var li = document.createElement('li');
      li.className = 'u-res-fold-row';
      li.innerHTML =
        '<span class="u-res-fold__ic">' + (icon ? '<img src="' + ASSET + icon + '" alt="" decoding="async" />' : '') + '</span>' +
        '<span class="u-res-fold__body">' +
          '<span class="u-res-fold__cat">' + esc(label(ct)) + '</span>' +
          '<span class="u-res-fold__how">' + esc(tip) + '</span>' +
        '</span>';
      list.appendChild(li);
    });
  }

  // деликатные категории — для них показываем правило D06 (запас по высоте)
  var DELICATE = { bras: 1, swimwear: 1, sport_tops: 1 };

  // «Почему эта схема подходит» — компактные факты + правила.
  // Сервер id правил не шлёт (api-contract решение №1), поэтому список
  // фиксирован на фронте: 1 общий + D01 + D05 (всегда), D04 если есть
  // полезный резерв, D06 если есть деликатные категории.
  function renderWhy(payload) {
    var list = document.querySelector('.u-res-why');
    if (!list) return;
    var scheme = payload.scheme || payload;
    var zones = scheme.assigned_zones || [];
    var hasReserve = (scheme.reserve_zones || []).some(function (r) {
      return Math.min(r.w_cm, r.d_cm) >= RESERVE_MIN_SIDE;
    });
    var hasDelicate = zones.some(function (z) { return DELICATE[z.content_type]; });
    var c = C();
    var bullets = [{ t: 'Собрана под ваши индивидуальные данные' }];
    ['D01', 'D05'].forEach(function (id) {
      var rt = c.ruleText && c.ruleText(id);
      if (rt) bullets.push(rt);
    });
    if (hasReserve) {
      var d4 = c.ruleText && c.ruleText('D04');
      if (d4) bullets.push(d4);
    }
    if (hasDelicate) {
      var d6 = c.ruleText && c.ruleText('D06');
      if (d6) bullets.push(d6);
    }

    list.innerHTML = '';
    bullets.forEach(function (b) {
      var li = document.createElement('li');
      li.innerHTML = '<span class="t">' + esc(b.t) + '</span>' + (b.d ? '<span class="d">' + esc(b.d) + '</span>' : '');
      list.appendChild(li);
    });
  }

  // «Обратите внимание» — SoftHeightWarning'и. Сервер шлёт только
  // warning_code + content_type + zone_id (без текста, чтобы не
  // раскрывать внутренние параметры движка). Финальный текст
  // собираем из WARNING_TEXT в content-labels.js.
  function renderWarnings(payload) {
    var section = document.querySelector('.u-res-warn-card');
    var list = document.querySelector('.u-res-warn');
    if (!list) return;
    var scheme = payload.scheme || payload.scheme_payload || payload;
    var warnings = (payload.content_warnings) || (scheme && scheme.content_warnings) || [];
    var soft = warnings.filter(function (w) {
      return w.warning_code === 'compressed_storage' || w.warning_code === 'deformation_risk';
    });
    list.innerHTML = '';
    if (!soft.length) { if (section) section.hidden = true; return; }
    if (section) section.hidden = false;
    var c = C();
    soft.forEach(function (w) {
      var msg = (c.warningText && c.warningText(w.warning_code, w.content_type)) || '';
      var li = document.createElement('li');
      li.innerHTML = '<span class="u-res-warn__cat">' + esc(label(w.content_type)) + '</span>' +
        '<span class="u-res-warn__msg">' + esc(msg) + '</span>';
      list.appendChild(li);
    });
    markSchemeWarnings(soft);
  }

  // маркер «!» на блоке схемы с предупреждением (по zone_id)
  function markSchemeWarnings(soft) {
    soft.forEach(function (w) {
      if (!w.zone_id) return;
      var block = document.querySelector('.u-res-block[data-zone="' + (window.CSS && CSS.escape ? CSS.escape(w.zone_id) : w.zone_id) + '"]');
      if (block && !block.querySelector('.u-res-block__warn')) {
        block.classList.add('has-warn');
        var badge = document.createElement('span');
        badge.className = 'u-res-block__warn';
        badge.setAttribute('aria-label', 'есть нюанс по высоте');
        badge.textContent = '!';
        block.appendChild(badge);
      }
    });
  }

  // ru-склонение числительного для подписи карточки органайзера
  function pluralRu(n, forms) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return forms[0];
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return forms[1];
    return forms[2];
  }
  var UNIT_STEMS = {
    slots:    ['слот', 'слота', 'слотов'],
    cells:    ['ячейка', 'ячейки', 'ячеек'],
    dividers: ['секция', 'секции', 'секций'],
    open:     null
  };
  var RIGIDITY_RU = { soft: 'мягкий', semi_rigid: 'полужёсткий', rigid: 'жёсткий' };

  // «Подходящие органайзеры» — блок на каждую зону схемы. В каждом блоке
  // либо карточка SKU (если матчер нашёл подходящий товар), либо
  // empty-state с фразой «к сожалению, не нашли — подбирайте сами по
  // размерам».
  //
  // Итерируемся по scheme.assigned_zones, а не по payload.matches, потому
  // что matches содержит ТОЛЬКО успешные подборы — no_match-зоны в нём
  // отсутствуют. Зоны же дают весь список блоков (он же — в таблице
  // «Размеры блоков»). Сопоставляем зону с матчем по zone_id.
  function renderMatches(payload) {
    var root = document.querySelector('[data-matches]');
    if (!root) return;
    var matches = payload.matches || [];
    var scheme = payload.scheme || payload.scheme_payload;
    var zones = (scheme && scheme.assigned_zones) || [];
    root.innerHTML = '';

    var section = root.closest('.u-res-section');
    var noteEl  = section ? section.querySelector('.u-res-note') : null;

    // Никаких зон (no_scheme) — секции тут вообще не место.
    if (zones.length === 0) {
      if (noteEl) noteEl.hidden = true;
      return;
    }

    var matchByZone = {};
    matches.forEach(function (m) {
      if (m.zone_id) matchByZone[m.zone_id] = m;
    });

    // Плашка «изображения товаров — ориентировочные» актуальна только
    // когда есть хотя бы одна реальная карточка с картинкой; для
    // полностью пустого подбора она вводит в заблуждение.
    if (noteEl) noteEl.hidden = matches.length === 0;

    zones.forEach(function (zone, i) {
      var n = i + 1;
      var ct = zone.content_type;
      var m = matchByZone[zone.zone_id];

      // Подзаголовок блока (из BLOCK_DESC). Если есть SKU и у неё
      // division_type — берём соответствующую формулировку (cells/slots →
      // primary, open → open). Для пустых блоков по умолчанию используем
      // primary (движок всегда планирует с primary-варианта).
      var divisionType = (m && m.sku && m.sku.division_type) || 'cells';
      var desc = (window.UMESTNO_CONTENT && UMESTNO_CONTENT.blockDesc(ct, divisionType)) || '';
      var descHtml = desc ? '<div class="u-res-prod-block__desc">' + esc(desc) + '</div>' : '';

      var cardHtml;
      if (m && m.sku && m.sku.sku_id) {
        var sku = m.sku;
        var stems = UNIT_STEMS[sku.division_type];
        var subParts = [];
        if (stems && sku.capacity_units) subParts.push(sku.capacity_units + ' ' + pluralRu(sku.capacity_units, stems));
        if (RIGIDITY_RU[sku.rigidity]) subParts.push(RIGIDITY_RU[sku.rigidity]);
        var sizes = [sku.width_cm, sku.depth_cm, sku.height_cm].map(cm).join(' × ') + ' см';

        // Карточка — целиком кликабельная (если есть product_url): обёртка
        // <a target="_blank" rel="noopener nofollow sponsored">. Если URL
        // нет — оставляем <article>, не падаем.
        var cardInner =
          '<div class="u-res-prod-card__img">' + (sku.image_url ? '<img src="' + esc(sku.image_url) + '" loading="lazy" decoding="async" alt="' + esc(sku.product_title || '') + '" />' : '') + '</div>' +
          '<div class="u-res-prod-card__b">под блок ' + n + '</div>' +
          '<div class="u-res-prod-card__n">' + esc(sku.product_title || '') + '</div>' +
          (subParts.length ? '<div class="u-res-prod-card__sub">' + esc(subParts.join(' · ')) + '</div>' : '') +
          '<div class="u-res-prod-card__sz">' + esc(sizes) + '</div>';
        cardHtml = sku.product_url
          ? '<a class="u-res-prod-card u-res-prod-card--link" href="' + esc(sku.product_url) + '" target="_blank" rel="noopener nofollow sponsored" data-ym-goal="sku_click_' + esc(sku.sku_id || '') + '">' + cardInner + '</a>'
          : '<article class="u-res-prod-card">' + cardInner + '</article>';
      } else {
        // Пустая карточка — каталог не покрывает эти размеры. Текст
        // — копирайт Дзеры, не редактируем сами.
        cardHtml =
          '<article class="u-res-prod-card u-res-prod-card--empty">' +
            '<p class="u-res-prod-card__empty-msg">К сожалению, в текущем каталоге подходящих органайзеров мы не нашли. Вы можете подобрать самостоятельно по размерам выше или использовать собственные.</p>' +
          '</article>';
      }

      var block = document.createElement('div');
      block.className = 'u-res-prod-block';
      block.innerHTML =
        '<div class="u-res-prod-block__intro">' +
          '<span class="u-res-prod-block__n">Блок ' + n + '</span>' +
          '<span class="u-res-prod-block__cat">' + esc(label(ct)) + '</span>' +
          descHtml +
        '</div>' +
        '<div class="u-res-prod-cards">' + cardHtml + '</div>';
      root.appendChild(block);
    });
  }

  function render(payload) {
    if (!payload) return;
    var scheme = payload.scheme || payload.scheme_payload || payload;
    var drawer = (scheme && scheme.drawer) || (payload.input && payload.input.drawer) || payload.drawer;
    renderScheme(scheme, drawer);
    renderSizesTable(scheme);
    renderFolding(payload);
    renderWhy(payload);
    renderWarnings(payload);
    renderMatches(payload);
  }

  global.UMESTNO = global.UMESTNO || {};
  global.UMESTNO.renderScheme = renderScheme;
  global.UMESTNO.renderSizesTable = renderSizesTable;
  global.UMESTNO.renderFolding = renderFolding;
  global.UMESTNO.renderWhy = renderWhy;
  global.UMESTNO.renderWarnings = renderWarnings;
  global.UMESTNO.renderMatches = renderMatches;
  global.UMESTNO.render = render;
})(window);
