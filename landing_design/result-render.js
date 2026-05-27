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
  // оставить только прямоугольники, не вложенные в более крупный (free_rectangles перекрываются)
  function cleanReserve(rects) {
    return rects.filter(function (r) {
      if (r.w_cm < 2 || r.d_cm < 2) return false;
      return !rects.some(function (o) {
        return o !== r && o.x_cm <= r.x_cm && o.y_cm <= r.y_cm &&
          (o.x_cm + o.w_cm) >= (r.x_cm + r.w_cm) && (o.y_cm + o.d_cm) >= (r.y_cm + r.d_cm) &&
          (o.w_cm * o.d_cm) > (r.w_cm * r.d_cm);
      });
    });
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
    var reserve = cleanReserve(scheme.reserve_zones || []);
    var e = extents(zones, scheme.reserve_zones || []);
    var W = (drawer && drawer.w_cm) || e.W, D = (drawer && drawer.d_cm) || e.D;

    inner.classList.add('is-data');
    inner.style.aspectRatio = W + ' / ' + D;
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
    var reserve = cleanReserve(scheme.reserve_zones || []);

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

  // «Как сложить вещи» — строка на каждую назначенную категорию
  function renderFolding(result) {
    var list = document.querySelector('.u-res-fold');
    if (!list) return;
    var rows = result.what_to_store_where || [];
    if (!rows.length) return;
    var c = C();
    list.innerHTML = '';
    rows.forEach(function (r) {
      var ct = r.content_type;
      var tip = (c.foldTip && c.foldTip(ct)) || r.instruction || '';
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

  // «Почему эта схема подходит» — компактные факты (без подписей) + правила
  function renderWhy(payload) {
    var list = document.querySelector('.u-res-why');
    if (!list) return;
    var scheme = payload.scheme || payload.scheme_payload || payload;
    var zones = scheme.assigned_zones || [];
    var c = C();
    var bullets = [];

    // Один общий факт — детали (размеры, вещи, приоритет) уже в чипах сверху
    bullets.push({ t: 'Собрана под ваши индивидуальные данные' });

    // Правила: с пояснениями; D06 — только если есть деликатные вещи
    var hasDelicate = zones.some(function (z) { return DELICATE[z.content_type]; });
    var applied = (payload.why_this_layout) || (scheme.layout_plan && scheme.layout_plan.rules_applied) || [];
    applied.forEach(function (id) {
      if (id === 'D06' && !hasDelicate) return;
      var rt = c.ruleText && c.ruleText(id);
      if (rt) bullets.push(rt);
    });

    list.innerHTML = '';
    bullets.forEach(function (b) {
      var li = document.createElement('li');
      li.innerHTML = '<span class="t">' + esc(b.t) + '</span>' + (b.d ? '<span class="d">' + esc(b.d) + '</span>' : '');
      list.appendChild(li);
    });
  }

  // «Обратите внимание» — только SoftHeightWarning; подстановка content_type → ru
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
    soft.forEach(function (w) {
      var msg = w.message || '';
      if (w.content_type) msg = msg.split(w.content_type).join(label(w.content_type));
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

  function render(payload) {
    if (!payload) return;
    var scheme = payload.scheme || payload.scheme_payload || payload;
    renderScheme(scheme, payload.drawer);
    renderSizesTable(scheme);
    renderFolding(payload);
    renderWhy(payload);
    renderWarnings(payload);
  }

  global.UMESTNO = global.UMESTNO || {};
  global.UMESTNO.renderScheme = renderScheme;
  global.UMESTNO.renderSizesTable = renderSizesTable;
  global.UMESTNO.renderFolding = renderFolding;
  global.UMESTNO.renderWhy = renderWhy;
  global.UMESTNO.renderWarnings = renderWarnings;
  global.UMESTNO.render = render;
})(window);
