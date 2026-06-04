/*
 * pdf-render.js — наполняет шаблон /pdf/index.html (дизайн v3) данными
 * из GET /api/result/:token.
 *
 * Что заполняем:
 *   - masthead: номер заказа + дата
 *   - схема: вызываем UMESTNO.renderScheme — рисует .u-res-block внутри
 *     .u-res-scheme__inner, которая лежит внутри .scheme__plate
 *   - размеры ящика + спек-таблица блоков с цветными номерами + резерв
 *   - warnings (страница 2): если есть compressed_storage / deformation_risk
 *   - складывание: одна карточка на категорию (без дублей), цвет номера
 *     совпадает с цветом блока на схеме; картинка из folding/*.webp где
 *     есть, иначе только заголовок
 *   - runhead (стр. 2) + ftband row 2: номер заказа
 *
 * Когда DOM готов — ставит data-pdf-ready="1" на <html>. Puppeteer
 * ждёт этот атрибут перед снятием PDF (см. waitForFunction в pdf.ts).
 */

(function () {
  'use strict';

  // Картинки фолдинга в landing_design/assets/folding/.
  // Для остальных категорий fold-card рисуется БЕЗ картинки (только head).
  var FOLDING_IMAGES = {
    panties:       'panties.webp',
    boxers:        'boxers.webp',
    socks:         'socks.webp',
    socks_regular: 'socks.webp',
    sport_tops:    'sport_tops.webp'
  };

  // Цветовая палитра зон — совпадает с BLOCK_COLORS в result-render.js
  // (= .b1..b4 в результирующей схеме на сайте).
  var BLOCK_COLORS = ['#EBDFC4', '#A6B38C', '#EDEAE1', '#DDC59B'];

  // bestReserve — выбираем самый крупный reserve_zone (по площади),
  // при условии что обе стороны >= 8 см. Логика из result-render.js;
  // дублируем потому что наружу она не экспортирована.
  var RESERVE_MIN_SIDE = 8;
  function bestReserve(rects) {
    var best = null, bestArea = 0;
    (rects || []).forEach(function (r) {
      if (Math.min(r.w_cm, r.d_cm) < RESERVE_MIN_SIDE) return;
      var area = r.w_cm * r.d_cm;
      if (area > bestArea) { best = r; bestArea = area; }
    });
    return best;
  }

  var params = new URLSearchParams(location.search);
  var token = params.get('t') || params.get('token');

  function setText(slot, value) {
    document.querySelectorAll('[data-pdf="' + slot + '"]').forEach(function (el) {
      el.textContent = value;
    });
  }
  function setHTML(slot, html) {
    document.querySelectorAll('[data-pdf="' + slot + '"]').forEach(function (el) {
      el.innerHTML = html;
    });
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var dd = String(d.getDate()).padStart(2, '0');
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    return dd + '.' + mm + '.' + d.getFullYear();
  }
  function fmtCm(n) {
    if (n == null) return '—';
    return Number(n).toFixed(Number(n) % 1 ? 1 : 0).replace('.', ',');
  }

  function render(payload) {
    var scheme = payload.scheme || payload.scheme_payload || {};
    var drawer = (scheme.drawer) || (payload.input && payload.input.drawer) || {};
    var zones  = scheme.assigned_zones || [];

    // Номер заказа — короткий 8-hex код, как у курьерских сервисов
    var orderShort = payload.order_id ? payload.order_id.split('-')[0].toUpperCase() : '—';
    setText('order-num', '№ ' + orderShort);
    setText('runhead-order', 'ЗАКАЗ № ' + orderShort);
    setText('ftband-order', 'Заказ № ' + orderShort);

    // Дата (формат 28.05.2026 — как в дизайн-образце)
    setText('date', fmtDate(payload.created_at));

    // Размеры ящика
    setText('drawer',
      fmtCm(drawer.w_cm) + ' × ' + fmtCm(drawer.d_cm) + ' × ' + fmtCm(drawer.h_cm) + ' см');

    // Спек-таблица: один .brow на каждую assigned_zone, потом (опц.) .brow--rs.
    var label = (window.UMESTNO_CONTENT && UMESTNO_CONTENT.label) || function (s) { return s; };
    var rowsHtml = zones.map(function (z, i) {
      var color = BLOCK_COLORS[i % BLOCK_COLORS.length];
      return '<div class="brow">' +
        '<span class="brow__num" style="background:' + color + '">' + (i + 1) + '</span>' +
        '<span class="brow__name">' + esc(label(z.content_type)) + '</span>' +
        '<span class="brow__dim">' + fmtCm(z.assigned_w_cm) + ' × ' + fmtCm(z.assigned_d_cm) + ' × ' + fmtCm(z.assigned_h_cm) + ' см</span>' +
      '</div>';
    }).join('');
    var reserve = bestReserve(scheme.reserve_zones || []);
    if (reserve) {
      rowsHtml += '<div class="brow brow--rs">' +
        '<span class="brow__num brow__num--rs">—</span>' +
        '<span class="brow__name">Резерв · свободное место</span>' +
        '<span class="brow__dim">' + fmtCm(reserve.w_cm) + ' × ' + fmtCm(reserve.d_cm) + ' см</span>' +
      '</div>';
    }
    setHTML('blocks-rows', rowsHtml);

    // Схема — переиспользуем рендер с /result/. Он сам разбирается с
    // assigned_zones и reserve_zones (плюс bestReserve мёрджит резерв).
    if (window.UMESTNO && typeof UMESTNO.renderScheme === 'function') {
      UMESTNO.renderScheme(scheme, drawer);
    }

    // Warnings (страница 2, если есть)
    var warnings = (scheme.content_warnings || []).filter(function (w) {
      return w && (w.warning_code === 'compressed_storage' || w.warning_code === 'deformation_risk');
    });
    var warningsSection = document.querySelector('[data-pdf="warnings-section"]');
    if (warnings.length === 0) {
      if (warningsSection) warningsSection.hidden = true;
    } else {
      if (warningsSection) warningsSection.hidden = false;
      var wHtml = warnings.map(function (w) {
        var catLabel = label(w.content_type) || w.content_type;
        var msg = (window.UMESTNO_CONTENT && UMESTNO_CONTENT.warningText)
          ? UMESTNO_CONTENT.warningText(w.warning_code, w.content_type)
          : '';
        return '<div class="warn">' +
                 '<span class="warn__dot">!</span>' +
                 '<div>' +
                   '<div class="warn__cat">' + esc(catLabel) + '</div>' +
                   '<p class="warn__msg">' + esc(msg) + '</p>' +
                 '</div>' +
               '</div>';
      }).join('');
      setHTML('warnings', wHtml);
    }

    // Складывание: одна .fold-card на каждую уникальную категорию из зон.
    // Цвет номера = цвет блока (берём первое появление в зонах). Картинку
    // показываем только для категорий из FOLDING_IMAGES; для остальных
    // оставляем .fold-card без картинки (head + рамка-разделитель).
    var seen = {};
    var foldCards = [];
    zones.forEach(function (z, i) {
      var ct = z.content_type;
      if (!ct || seen[ct]) return;
      seen[ct] = true;
      var color = BLOCK_COLORS[i % BLOCK_COLORS.length];
      var imgFile = FOLDING_IMAGES[ct];
      var imgHtml = imgFile
        ? '<div class="fold-card__img"><img src="../landing_design/assets/folding/' + esc(imgFile) + '" alt="" /></div>'
        : '';
      foldCards.push(
        '<div class="fold-card">' +
          '<div class="fold-card__head">' +
            '<span class="fold-card__n" style="background:' + color + '">' + (i + 1) + '</span>' +
            '<span class="fold-card__title">' + esc(label(ct)) + '</span>' +
          '</div>' +
          imgHtml +
        '</div>'
      );
    });
    setHTML('folding', foldCards.join(''));

    // Сигнал Puppeteer'у что DOM готов и можно снимать PDF.
    document.documentElement.setAttribute('data-pdf-ready', '1');
  }

  function fail(msg) {
    document.body.innerHTML = '<div style="padding:40mm;font-family:sans-serif;color:#B36A4A;font-size:14pt">' + esc(msg) + '</div>';
    document.documentElement.setAttribute('data-pdf-ready', '1');
  }

  if (!token) {
    fail('Отсутствует токен расчёта.');
    return;
  }

  fetch('/api/result/' + encodeURIComponent(token), { credentials: 'same-origin' })
    .then(function (r) {
      if (r.status === 402) throw new Error('payment_required');
      if (r.status === 404) throw new Error('not_found');
      if (!r.ok) throw new Error('http_' + r.status);
      return r.json();
    })
    .then(render)
    .catch(function (e) {
      console.error('[pdf-render] failed', e);
      fail('Не удалось загрузить данные расчёта (' + (e && e.message || 'unknown') + ').');
    });
})();
