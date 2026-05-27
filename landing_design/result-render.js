/* Уместно — data-driven рендер схемы результата.
   Принимает scheme_payload от движка и расставляет блоки по реальным
   координатам в см (внутри лотка). Визуал (дерево/бархат/cqw) — из result.css,
   рендер только задаёт позиции/размеры/подписи/цвета. */
(function (global) {
  function round(n) { return Math.round(n * 1000) / 1000; }
  function label(ct) {
    return (global.UMESTNO_CONTENT && global.UMESTNO_CONTENT.label)
      ? global.UMESTNO_CONTENT.label(ct) : ct;
  }

  /**
   * @param {object} scheme  scheme_payload движка (assigned_zones, reserve_zones, fit_status)
   * @param {{w_cm:number,d_cm:number}} [drawer]  размеры ящика (если нет — выводим из экстентов)
   */
  function renderScheme(scheme, drawer) {
    var inner = document.querySelector('.u-res-scheme__inner');
    if (!inner || !scheme) return;
    var zones = scheme.assigned_zones || [];
    var reserve = scheme.reserve_zones || [];

    var extentX = zones.map(function (z) { return z.x_cm + z.assigned_w_cm; })
      .concat(reserve.map(function (r) { return r.x_cm + r.w_cm; }));
    var extentY = zones.map(function (z) { return z.y_cm + z.assigned_d_cm; })
      .concat(reserve.map(function (r) { return r.y_cm + r.d_cm; }));
    var W = (drawer && drawer.w_cm) || Math.max.apply(null, extentX.length ? extentX : [1]);
    var D = (drawer && drawer.d_cm) || Math.max.apply(null, extentY.length ? extentY : [1]);

    inner.classList.add('is-data');
    inner.style.aspectRatio = W + ' / ' + D;
    inner.innerHTML = '';

    zones.forEach(function (z, i) {
      var el = document.createElement('div');
      el.className = 'u-res-block b' + ((i % 4) + 1);
      // позиция/размер в % от лотка, минус небольшой зазор (cqw) для «бортика»
      el.style.left = 'calc(' + round(z.x_cm / W * 100) + '% + 0.55cqw)';
      el.style.bottom = 'calc(' + round(z.y_cm / D * 100) + '% + 0.55cqw)';
      el.style.width = 'calc(' + round(z.assigned_w_cm / W * 100) + '% - 1.1cqw)';
      el.style.height = 'calc(' + round(z.assigned_d_cm / D * 100) + '% - 1.1cqw)';
      el.innerHTML =
        '<span class="u-res-block__n">Блок ' + (i + 1) + '</span>' +
        '<span class="u-res-block__cat">' + label(z.content_type) + '</span>';
      inner.appendChild(el);
    });
  }

  global.UMESTNO = global.UMESTNO || {};
  global.UMESTNO.renderScheme = renderScheme;
})(window);
