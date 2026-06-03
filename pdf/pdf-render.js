/*
 * pdf-render.js
 *
 * Заполняет шаблон /pdf/index.html данными из GET /api/result/:token.
 * Этот скрипт работает в контексте Puppeteer (когда сервер рендерит PDF)
 * И в контексте обычного браузера (если открыть /pdf/?t=TOKEN — будет
 * preview-режим, см. @media screen в pdf.css).
 *
 * Сервер вызовет Puppeteer с параметром ?t=TOKEN. Если /api/result отдаёт
 * 402 — мы выводим заглушку «не оплачено» (но реально серверный gate в
 * /api/pdf/:token не даст до этого дойти, защита second-line).
 *
 * Категории, для которых у нас уже есть «полноценная» webp-картинка
 * фолдинга в landing_design/assets/folding/:
 *   - panties, boxers, socks (=socks_regular), sport_tops
 *
 * Для остальных категорий — только текст из FOLD_TIP. После релиза
 * Дзера добавит остальные картинки, и эта таблица расширится.
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

    // дата + номер расчёта
    setText('date', fmtDate(payload.created_at));
    setText('token-line', token ? 'Номер расчёта: ' + token : '');

    // размеры ящика
    setText('drawer',
      fmtCm(drawer.w_cm) + ' × ' + fmtCm(drawer.d_cm) + ' × ' + fmtCm(drawer.h_cm) + ' см');

    // таблица блоков
    var label = (window.UMESTNO_CONTENT && UMESTNO_CONTENT.label) || function (s) { return s; };
    var rowsHtml = zones.map(function (z, i) {
      var n = i + 1;
      return '<tr>' +
        '<td>' + n + '</td>' +
        '<td>' + esc(label(z.content_type)) + '</td>' +
        '<td>' + fmtCm(z.assigned_w_cm) + ' × ' + fmtCm(z.assigned_d_cm) + ' × ' + fmtCm(z.assigned_h_cm) + ' см</td>' +
      '</tr>';
    }).join('');
    setHTML('blocks-tbody', rowsHtml);

    // схема — SVG (упрощённая версия рендера из result-render.js)
    setHTML('scheme', renderSchemeSvg(scheme, drawer));

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
                 '<div class="pdf-warning-item__title">' + esc(catLabel) + '</div>' +
                 '<div>' + esc(msg) + '</div>' +
               '</div>';
      }).join('');
      setHTML('warnings', wHtml);
    }

    // складывание — по одной карточке на каждую категорию-зону, без дублей
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
          '<div class="pdf-folding-card__img">' + imgHtml + '</div>' +
          '<div class="pdf-folding-card__b">' +
            '<div class="pdf-folding-card__cat">' + esc(label(ct)) + '</div>' +
            '<p class="pdf-folding-card__steps">' + esc(tip) + '</p>' +
          '</div>' +
        '</div>'
      );
    });
    setHTML('folding', foldCards.join(''));

    // Сигнал Puppeteer'у что рендер закончен (можно вызывать page.pdf())
    document.documentElement.setAttribute('data-pdf-ready', '1');
  }

  /**
   * Упрощённый SVG-рендерер схемы. Принимает scheme (с assigned_zones и
   * reserve_zones) и drawer (w_cm, d_cm). Рисует прямоугольник-ящик и
   * внутри него — заполненные зоны.
   */
  function renderSchemeSvg(scheme, drawer) {
    var w = Number(drawer.w_cm) || 0;
    var d = Number(drawer.d_cm) || 0;
    if (!w || !d) return '';
    var zones = scheme.assigned_zones || [];
    var reserves = scheme.reserve_zones || [];
    var labelFn = (window.UMESTNO_CONTENT && UMESTNO_CONTENT.label) || function (s) { return s; };

    // viewBox в см с padding 2см вокруг
    var pad = 2;
    var vbW = w + pad * 2;
    var vbH = d + pad * 2;

    var parts = [];
    parts.push('<svg viewBox="0 0 ' + vbW + ' ' + vbH + '" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;max-height:90mm">');
    // фон-ящик
    parts.push('<rect x="' + pad + '" y="' + pad + '" width="' + w + '" height="' + d + '" fill="#EFE6D2" stroke="#B8AC92" stroke-width="0.2"/>');
    // assigned zones
    var palette = ['#D8C8A8', '#C9D6B8', '#E8D8B8', '#D0C0B0', '#CFC2A6', '#BDD3B0'];
    zones.forEach(function (z, i) {
      var x = pad + Number(z.x_cm || 0);
      var y = pad + Number(z.y_cm || 0);
      var ww = Number(z.assigned_w_cm || 0);
      var dd = Number(z.assigned_d_cm || 0);
      parts.push('<rect x="' + x + '" y="' + y + '" width="' + ww + '" height="' + dd + '" fill="' + palette[i % palette.length] + '" stroke="#8A7E5E" stroke-width="0.15"/>');
      // подпись блока — номер сверху, категория ниже
      var cx = x + ww / 2;
      var cy = y + dd / 2;
      parts.push('<text x="' + cx + '" y="' + (cy - 1) + '" text-anchor="middle" font-family="Cormorant Garamond, serif" font-size="2" fill="#3A382F">Блок ' + (i + 1) + '</text>');
      parts.push('<text x="' + cx + '" y="' + (cy + 1.5) + '" text-anchor="middle" font-family="Manrope, sans-serif" font-size="1.6" fill="#5A5240">' + esc(labelFn(z.content_type)) + '</text>');
    });
    // reserve zones — пунктиром
    reserves.forEach(function (r) {
      var x = pad + Number(r.x_cm || 0);
      var y = pad + Number(r.y_cm || 0);
      var ww = Number(r.w_cm || 0);
      var dd = Number(r.d_cm || 0);
      parts.push('<rect x="' + x + '" y="' + y + '" width="' + ww + '" height="' + dd + '" fill="none" stroke="#8A7E5E" stroke-width="0.15" stroke-dasharray="0.8 0.6"/>');
      var cx = x + ww / 2;
      var cy = y + dd / 2;
      parts.push('<text x="' + cx + '" y="' + (cy + 0.5) + '" text-anchor="middle" font-family="Manrope, sans-serif" font-size="1.4" fill="#7A6F58">резерв</text>');
    });
    parts.push('</svg>');
    return parts.join('');
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
