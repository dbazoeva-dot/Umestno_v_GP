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

  function render(payload) {
    if (!payload) return;
    var scheme = payload.scheme || payload.scheme_payload || payload;
    renderScheme(scheme, payload.drawer);
    renderSizesTable(scheme);
  }

  global.UMESTNO = global.UMESTNO || {};
  global.UMESTNO.renderScheme = renderScheme;
  global.UMESTNO.renderSizesTable = renderSizesTable;
  global.UMESTNO.render = render;
})(window);
