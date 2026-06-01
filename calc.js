// Уместно — конфигуратор (configure) interactivity. Vanilla, no framework.
(function () {
  'use strict';

  // Категории и подписи объёма берём из UMESTNO_CONTENT (landing_design/content-labels.js).
  // engine.max_items = 4 → MAX_ROWS = 4.
  var MAX_ROWS = 4;
  var VOLUME_LEVELS = ['small', 'medium', 'large'];

  /* ── Choice cards (single-select within each group) ──── */
  document.querySelectorAll('.u-calc__choices').forEach(function (group) {
    group.querySelectorAll('.u-calc__choice').forEach(function (btn) {
      if (btn.disabled || btn.classList.contains('is-soon')) return;
      btn.addEventListener('click', function () {
        group.querySelectorAll('.u-calc__choice').forEach(function (b) {
          b.classList.remove('is-on');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('is-on');
        btn.setAttribute('aria-pressed', 'true');
      });
    });
  });

  /* ── Sizes: presets + "unknown" dim ──────────────────── */
  var sizes = document.querySelector('.u-calc__sizes');
  if (sizes) {
    var sizeInput = function (k) { return sizes.querySelector('[data-dim="' + k + '"]'); };
    var presets = document.querySelectorAll('.u-calc__preset');
    presets.forEach(function (p) {
      p.addEventListener('click', function () {
        ['w', 'd', 'h'].forEach(function (k) {
          var inp = sizeInput(k);
          if (inp && p.dataset[k] != null) inp.value = p.dataset[k];
        });
        presets.forEach(function (q) { q.classList.remove('is-on'); });
        p.classList.add('is-on');
        var chk = document.querySelector('.u-calc__check input');
        if (chk && chk.checked) { chk.checked = false; chk.dispatchEvent(new Event('change')); }
      });
    });
    sizes.querySelectorAll('[data-dim]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        presets.forEach(function (q) { q.classList.remove('is-on'); });
      });
    });
    var unknown = document.querySelector('.u-calc__check input');
    if (unknown) {
      var checkSVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>';
      var box = unknown.parentElement.querySelector('.box');
      var syncUnknown = function () {
        sizes.classList.toggle('is-dim', unknown.checked);
        if (box) box.innerHTML = unknown.checked ? checkSVG : '';
      };
      unknown.addEventListener('change', syncUnknown);
      syncUnknown();
    }
  }

  /* ── Item rows: add / remove (default 2, max 4) ───────── */
  var itemsRoot = document.querySelector('[data-items]');
  var addBtn = document.querySelector('[data-add]');
  if (itemsRoot) {
    var chevron = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
    var trash = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 7h14M9 7V5h6v2m-8 0v12h10V7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    var content = window.UMESTNO_CONTENT;

    var escape = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]; }); };

    var typeOptionsHTML = function (selectedId) {
      var html = '<option value="">— выбрать —</option>';
      content.groups.forEach(function (g) {
        html += '<optgroup label="' + escape(g.ru) + '">';
        content.items.filter(function (it) { return it.group === g.id; }).forEach(function (it) {
          html += '<option value="' + it.id + '"' + (it.id === selectedId ? ' selected' : '') + '>' + escape(it.ru) + '</option>';
        });
        html += '</optgroup>';
      });
      return html;
    };

    var qtyOptionsHTML = function (contentType, selectedLevel) {
      if (!contentType || !content.volumeBounds(contentType)) {
        return '<option value="">— сначала выберите категорию —</option>';
      }
      return VOLUME_LEVELS.map(function (lvl) {
        return '<option value="' + lvl + '"' + (lvl === selectedLevel ? ' selected' : '') + '>' + escape(content.volumeLabel(contentType, lvl)) + '</option>';
      }).join('');
    };

    var rowHTML = function (typeId, level) {
      var qtyDisabled = !typeId || !content.volumeBounds(typeId);
      return '<div class="u-calc__item-row">' +
        '<label class="u-calc__field"><span class="u-calc__field-lbl">Что хранить</span>' +
          '<div class="u-calc__select-wrap"><select data-role="type">' + typeOptionsHTML(typeId) + '</select>' + chevron + '</div></label>' +
        '<label class="u-calc__field"><span class="u-calc__field-lbl">Объем</span>' +
          '<div class="u-calc__select-wrap"><select data-role="qty"' + (qtyDisabled ? ' disabled' : '') + '>' + qtyOptionsHTML(typeId, level) + '</select>' + chevron + '</div></label>' +
        '<button type="button" class="u-calc__item-rm" aria-label="Удалить строку">' + trash + '</button>' +
      '</div>';
    };

    var refresh = function () {
      var rows = itemsRoot.querySelectorAll('.u-calc__item-row');
      rows.forEach(function (row) {
        var rm = row.querySelector('.u-calc__item-rm');
        if (rm) rm.style.display = rows.length > 1 ? '' : 'none';
      });
      if (addBtn) addBtn.style.display = rows.length < MAX_ROWS ? '' : 'none';
    };

    // default 2 rows
    itemsRoot.innerHTML = rowHTML('socks', 'medium') + rowHTML('panties', 'medium');

    itemsRoot.addEventListener('click', function (e) {
      var rm = e.target.closest('.u-calc__item-rm');
      if (rm && itemsRoot.querySelectorAll('.u-calc__item-row').length > 1) {
        rm.closest('.u-calc__item-row').remove();
        refresh();
      }
    });
    itemsRoot.addEventListener('change', function (e) {
      var sel = e.target;
      if (sel.tagName !== 'SELECT' || sel.dataset.role !== 'type') return;
      var row = sel.closest('.u-calc__item-row');
      var qty = row && row.querySelector('select[data-role="qty"]');
      if (!qty) return;
      var prev = qty.value;
      var typeId = sel.value;
      qty.innerHTML = qtyOptionsHTML(typeId, prev || 'medium');
      qty.disabled = !typeId || !content.volumeBounds(typeId);
    });
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        if (itemsRoot.querySelectorAll('.u-calc__item-row').length >= MAX_ROWS) return;
        itemsRoot.insertAdjacentHTML('beforeend', rowHTML('', ''));
        refresh();
      });
    }
    refresh();
  }

  /* ── Priority: single-select toggle ───────────────────── */
  var pri = document.querySelector('.u-calc__priority');
  if (pri) {
    var priCheck = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>';
    pri.querySelectorAll('.u-calc__pri-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        pri.querySelectorAll('.u-calc__pri-btn').forEach(function (b) {
          b.classList.remove('is-on');
          b.setAttribute('aria-pressed', 'false');
          var c = b.querySelector('.u-calc__pri-check');
          if (c) c.innerHTML = '';
        });
        btn.classList.add('is-on');
        btn.setAttribute('aria-pressed', 'true');
        var c = btn.querySelector('.u-calc__pri-check');
        if (c) c.innerHTML = priCheck;
      });
    });
  }

  /* ── Submit: POST /api/calculate → редирект по fit_status ── */
  // CTA остаётся <a href="../no-fit/"> как fallback: если JS не загрузился
  // или сломался, клик уведёт на /no-fit/ (безопасный исход). Тут мы
  // перехватываем клик, гоним POST и редиректим по результату.
  var cta = document.querySelector('.u-calc__cta');
  if (cta) {
    cta.addEventListener('click', function (e) {
      e.preventDefault();
      if (cta.dataset.loading === '1') return;

      var payload = collectPayload();
      var err = validatePayload(payload);
      if (err) { showCalcError(err); return; }

      cta.dataset.loading = '1';
      cta.classList.add('is-loading');
      hideCalcError();

      fetch('/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'same-origin'
      })
        .then(function (r) {
          if (!r.ok) throw new Error('http ' + r.status);
          return r.json();
        })
        .then(function (data) {
          if (!data || !data.token) throw new Error('bad_response');
          var fit = data.fit_status;
          var path = (fit === 'fit_none' || fit === 'no_scheme') ? '/no-fit/' : '/result/';
          location.href = path + '?t=' + encodeURIComponent(data.token);
        })
        .catch(function (err) {
          cta.dataset.loading = '';
          cta.classList.remove('is-loading');
          showCalcError('Не получилось рассчитать. Проверьте подключение и попробуйте ещё раз.');
          console.error('[calculate] failed', err);
        });
    });
  }

  // Алиас фронт↔движок (см. content-labels.js строка 4). Только socks
  // отличается id'шником; на остальных категориях фронтовый id совпадает с
  // content_type движка.
  function toEngineCt(id) { return id === 'socks' ? 'socks_regular' : id; }

  function collectPayload() {
    function dim(k) { var inp = document.querySelector('[data-dim="' + k + '"]'); return inp ? Number(inp.value) : NaN; }
    var items = [];
    document.querySelectorAll('.u-calc__item-row').forEach(function (row) {
      var t = row.querySelector('select[data-role=type]');
      var q = row.querySelector('select[data-role=qty]');
      if (t && q && t.value && q.value) items.push({ content_type: toEngineCt(t.value), volume_level: q.value });
    });
    var pri = document.querySelector('.u-calc__pri-btn[aria-pressed="true"]');
    var consent = document.querySelector('#u-consent-oferta');
    return {
      drawer_width_cm: dim('w'),
      drawer_depth_cm: dim('d'),
      drawer_height_cm: dim('h'),
      // сервер всегда подставляет mixed (api-contract решение #1),
      // но validateRequest требует строку — шлём 'mixed' явно.
      storage_category: 'mixed',
      items: items,
      priority: pri ? pri.getAttribute('data-priority') : '',
      consent_oferta: !!(consent && consent.checked)
    };
  }

  function validatePayload(p) {
    if (!(p.drawer_width_cm > 0) || !(p.drawer_depth_cm > 0) || !(p.drawer_height_cm > 0))
      return 'Укажите размеры ящика (ширина, глубина, высота) в сантиметрах.';
    if (!p.items.length) return 'Выберите хотя бы одну категорию и объём.';
    if (!p.priority) return 'Выберите приоритет (удобно / вместительно / экономично).';
    if (!p.consent_oferta) return 'Подтвердите согласие с офертой, чтобы продолжить.';
    return null;
  }

  function showCalcError(msg) {
    var box = document.querySelector('[data-calc-error]');
    if (!box) {
      box = document.createElement('div');
      box.setAttribute('data-calc-error', '');
      box.setAttribute('role', 'alert');
      box.style.cssText = 'background:#fff3eb;border:1px solid #d27a4d;color:#7a3a1a;padding:10px 12px;border-radius:8px;margin:8px 0 12px;font-size:14px;line-height:1.4';
      var actions = document.querySelector('.u-calc__actions');
      if (actions) actions.parentNode.insertBefore(box, actions);
    }
    box.textContent = msg;
    box.hidden = false;
  }
  function hideCalcError() {
    var box = document.querySelector('[data-calc-error]');
    if (box) box.hidden = true;
  }

  /* ── Carousel (auto-rotate + dots) ────────────────────── */
  var carousel = document.querySelector('.u-calc__carousel');
  if (carousel) {
    var imgs = carousel.querySelectorAll('.u-calc__carousel-frame img');
    var dots = carousel.querySelectorAll('.u-calc__carousel-dots .dot');
    var caps = [
      { cap: 'Зонирование под бельё и аксессуары', meta: 'Анна, Москва' },
      { cap: 'Категории по понятным блокам', meta: 'Елена, Владикавказ' },
      { cap: 'Своё место под частоту использования', meta: 'Максим, Санкт-Петербург' },
      { cap: 'Бельевые категории собраны рядом', meta: 'Ирина, Москва' },
      { cap: 'Каждая вещь по своим зонам', meta: 'Давид, Екатеринбург' }
    ];
    var capEl = carousel.querySelector('.u-calc__carousel-cap');
    var subEl = carousel.querySelector('.u-calc__carousel-sub');
    var cur = 0, timer = null;
    var show = function (n) {
      cur = (n + imgs.length) % imgs.length;
      imgs.forEach(function (im, i) { im.classList.toggle('is-on', i === cur); });
      dots.forEach(function (d, i) { d.classList.toggle('is-on', i === cur); });
      if (capEl && caps[cur]) capEl.textContent = caps[cur].cap;
      if (subEl && caps[cur]) subEl.textContent = caps[cur].meta;
    };
    var start = function () { timer = setInterval(function () { show(cur + 1); }, 4200); };
    var reset = function () { clearInterval(timer); start(); };
    dots.forEach(function (d, i) {
      d.addEventListener('click', function () { show(i); reset(); });
    });
    show(0);
    start();
  }
})();
