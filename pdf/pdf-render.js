/*
 * pdf-render.js
 *
 * Заполняет шаблон /pdf/index.html данными из GET /api/result/:token.
 * Используется и Puppeteer'ом (для PDF-рендера на сервере), и в браузере
 * как preview-режим.
 *
 * Схему НЕ рендерим самостоятельно — переиспользуем UMESTNO.renderScheme
 * из landing_design/result-render.js. Это даёт тот же визуал что на
 * сайте + автоматически работает merge-логика reserve_zones (через
 * bestReserve внутри renderScheme).
 *
 * Картинки фолдинга в landing_design/assets/folding/ есть только для
 * panties / boxers / socks / sport_tops. Для остальных категорий
 * карточка показывается без картинки — только заголовок и текст.
 */

(function () {
  'use strict';

  var FOLDING_IMAGES = {
    panties:       'panties.webp',
    boxers:        'boxers.webp',
    socks:         'socks.webp',
    socks_regular: 'socks.webp',
    sport_tops:    'sport_tops.webp'
  };

  // Палитра блоков — совпадает с BLOCK_COLORS в result-render.js (= .b1..b4).
  var BLOCK_COLORS = ['#EBDFC4', '#A6B38C', '#EDEAE1', '#DDC59B'];

  // bestReserve — выбираем самый крупный reserve_zone (по площади), при
  // условии что обе стороны >= RESERVE_MIN_SIDE. Та же логика что в
  // result-render.js; дублируем потому что наружу она не экспортирована.
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

  function setText(selector, value) {
    document.querySelectorAll('[data-pdf="' + selector + '"]').forEach(function (el) {
      el.textContent = value;
    });
  }
  function setHTML(selector, html) {
    document.querySelectorAll('[data-pdf="' + selector + '"]').forEach(function (el) {
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
    var months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
    return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear() + ' г.';
  }
  function fmtCm(n) {
    if (n == null) return '—';
    return Number(n).toFixed(Number(n) % 1 ? 1 : 0).replace('.', ',');
  }

  function render(payload) {
    var scheme = payload.scheme || payload.scheme_payload || {};
    var drawer = (scheme.drawer) || (payload.input && payload.input.drawer) || {};
    var zones  = scheme.assigned_zones || [];

    // дата + номер заказа (первые 8 hex-знаков uuid → короткий
    // человеческий идентификатор, как у курьерских сервисов)
    setText('date', fmtDate(payload.created_at));
    var orderShort = payload.order_id ? payload.order_id.split('-')[0].toUpperCase() : '—';
    setText('order-number', 'Номер заказа: № ' + orderShort);

    // размеры ящика
    setText('drawer',
      fmtCm(drawer.w_cm) + ' × ' + fmtCm(drawer.d_cm) + ' × ' + fmtCm(drawer.h_cm) + ' см');

    // таблица блоков — номер в цветном кружке, как на /result/. Резерв
    // (если есть) показываем последней строкой с прочерком вместо номера.
    var label = (window.UMESTNO_CONTENT && UMESTNO_CONTENT.label) || function (s) { return s; };
    var rowsHtml = zones.map(function (z, i) {
      var color = BLOCK_COLORS[i % BLOCK_COLORS.length];
      var num = '<span class="pdf-blocks__num" style="background:' + color + '">' + (i + 1) + '</span>';
      return '<tr>' +
        '<td>' + num + '</td>' +
        '<td>' + esc(label(z.content_type)) + '</td>' +
        '<td>' + fmtCm(z.assigned_w_cm) + ' × ' + fmtCm(z.assigned_d_cm) + ' × ' + fmtCm(z.assigned_h_cm) + ' см</td>' +
      '</tr>';
    }).join('');
    var reserve = bestReserve(scheme.reserve_zones || []);
    if (reserve) {
      rowsHtml += '<tr>' +
        '<td><span class="pdf-blocks__num pdf-blocks__num--reserve">—</span></td>' +
        '<td>Резерв (свободное место)</td>' +
        '<td>' + fmtCm(reserve.w_cm) + ' × ' + fmtCm(reserve.d_cm) + ' см</td>' +
      '</tr>';
    }
    setHTML('blocks-tbody', rowsHtml);

    // Схема — переиспользуем рендер с /result/. Он сам разбирается с
    // assigned_zones и reserve_zones (плюс bestReserve мёрджит).
    if (window.UMESTNO && typeof UMESTNO.renderScheme === 'function') {
      UMESTNO.renderScheme(scheme, drawer);
    }

    // warnings
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
        return '<div class="pdf-warning-item">' +
                 '<div class="pdf-warning-item__cat">' + esc(catLabel) + '</div>' +
                 '<div>' + esc(msg) + '</div>' +
               '</div>';
      }).join('');
      setHTML('warnings', wHtml);
    }

    // Складывание — карточка на каждую категорию-зону, без дублей.
    // Структура: картинка сверху (большая), под ней заголовок, текст.
    var foldTip = (window.UMESTNO_CONTENT && UMESTNO_CONTENT.foldTip) || function () { return ''; };
    var seen = {};
    var foldCards = [];
    zones.forEach(function (z) {
      var ct = z.content_type;
      if (!ct || seen[ct]) return;
      seen[ct] = true;
      var tip = foldTip(ct);
      var imgFile = FOLDING_IMAGES[ct];
      var imgHtml = imgFile
        ? '<img src="../landing_design/assets/folding/' + esc(imgFile) + '" alt="" />'
        : '';
      foldCards.push(
        '<div class="pdf-folding-card">' +
          '<div class="pdf-folding-card__title">' + esc(label(ct)) + '</div>' +
          '<div class="pdf-folding-card__img">' + imgHtml + '</div>' +
          '<p class="pdf-folding-card__steps">' + esc(tip) + '</p>' +
        '</div>'
      );
    });
    setHTML('folding', foldCards.join(''));

    // Сигнал Puppeteer'у что рендер закончен (можно вызывать page.pdf())
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
