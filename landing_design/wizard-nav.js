// wizard-nav.js — навигация пошагового конфигуратора (визард).
// Работает ПОВЕРХ calc.js: вся бизнес-логика (сбор payload, промокод,
// fit_partial, сабмит, prefill) остаётся в calc.js, который биндится к тем
// же хукам (.u-calc__choice, [data-dim], [data-items], .u-calc__pri-btn,
// .u-calc__cta, [data-promo-block], #u-consent-oferta). Здесь — только UI
// шагов: показ/скрытие, прогресс, гейтинг «Далее», сводка и модалки.
//
// Запускается только если визард присутствует в DOM (boot-флаг оставил его).
// При выключенном флаге [data-wiz] удалён → скрипт ничего не делает.
(function () {
  'use strict';

  var wiz = document.querySelector('[data-wiz]');
  if (!wiz) return;

  var TOTAL = 3;
  var STEP_LABELS = ['Ваш ящик', 'Что внутри', 'Оплата'];
  var NOTES = [
    'Полная схема и подбор органайзеров — 149 ₽ в конце',
    'Категории и приоритет — в одном шаге',
    'Оплата через ЮKassa. После оплаты — страница с готовой схемой.',
  ];

  var steps   = wiz.querySelectorAll('[data-wiz-step]');
  var fill    = wiz.querySelector('[data-wiz-fill]');
  var labelEl = wiz.querySelector('[data-wiz-label]');
  var curEls  = wiz.querySelectorAll('[data-wiz-cur], [data-wiz-cur2]');
  var backBtns = wiz.querySelectorAll('[data-wiz-back]'); // топбар (мобайл) + футер (десктоп)
  var nextBtn = wiz.querySelector('[data-wiz-next]');
  var finalEl = wiz.querySelector('[data-wiz-final]');
  var noteEl  = wiz.querySelector('[data-wiz-note]');
  var scroll  = wiz.querySelector('.u-wiz__scroll');
  var summary = wiz.querySelector('[data-wiz-summary]');

  var cur = 1;

  function track(goal) {
    if (window.UMESTNO_TRACK) { try { window.UMESTNO_TRACK(goal); } catch (e) {} }
  }

  /* ── Гейтинг перехода «Далее» ─────────────────────────────── */
  function dim(k) {
    var inp = wiz.querySelector('[data-dim="' + k + '"]');
    return inp ? Number(inp.value) : NaN;
  }
  function step1Valid() {
    return dim('w') > 0 && dim('d') > 0 && dim('h') > 0;
  }
  function step2Valid() {
    var ok = false;
    wiz.querySelectorAll('.u-calc__item-row').forEach(function (row) {
      var t = row.querySelector('select[data-role="type"]');
      var q = row.querySelector('select[data-role="qty"]');
      if (t && q && t.value && q.value) ok = true;
    });
    return ok;
  }
  function stepValid(n) {
    if (n === 1) return step1Valid();
    if (n === 2) return step2Valid();
    return true;
  }

  /* ── Сводка на шаге 3 ─────────────────────────────────────── */
  function selectedChoiceText(groupIdx) {
    var groups = wiz.querySelectorAll('.u-calc__choices');
    var g = groups[groupIdx];
    if (!g) return '';
    var on = g.querySelector('.u-calc__choice.is-on .u-calc__choice-t');
    return on ? on.textContent.trim() : '';
  }
  function categoriesText() {
    var labels = [];
    wiz.querySelectorAll('.u-calc__item-row').forEach(function (row) {
      var t = row.querySelector('select[data-role="type"]');
      if (t && t.value && t.selectedIndex >= 0) {
        var txt = t.options[t.selectedIndex].textContent.trim();
        if (txt) labels.push(txt);
      }
    });
    if (!labels.length) return '—';
    if (labels.length <= 3) return labels.join(', ');
    return labels.slice(0, 3).join(', ') + ' +' + (labels.length - 3);
  }
  function priorityText() {
    var on = wiz.querySelector('.u-calc__pri-btn[aria-pressed="true"] .ttl');
    return on ? on.textContent.trim() : '—';
  }
  function buildSummary() {
    if (!summary) return;
    var typeTxt = selectedChoiceText(0);
    var whatTxt = selectedChoiceText(1);
    var rows = [
      ['Тип', (typeTxt && whatTxt) ? (typeTxt + ' · ' + whatTxt) : (typeTxt || whatTxt || '—'), 1],
      ['Размеры', (dim('w') || '—') + ' × ' + (dim('d') || '—') + ' × ' + (dim('h') || '—') + ' см', 1],
      ['Храним', categoriesText(), 2],
      ['Важно', priorityText(), 2],
    ];
    var editSvg = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z"/></svg>';
    summary.innerHTML = rows.map(function (r) {
      return '<div class="u-wiz__sumrow">' +
        '<span class="k">' + r[0] + '</span>' +
        '<span class="v">' + escapeHtml(r[1]) + '</span>' +
        '<button type="button" class="edit" data-wiz-goto="' + r[2] + '">' + editSvg + 'Изменить</button>' +
      '</div>';
    }).join('');
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }

  /* ── Рендер текущего шага ─────────────────────────────────── */
  function render() {
    steps.forEach(function (s) {
      s.classList.toggle('is-on', Number(s.getAttribute('data-wiz-step')) === cur);
    });
    if (fill) fill.style.width = Math.round((cur / TOTAL) * 100) + '%';
    if (labelEl) labelEl.textContent = STEP_LABELS[cur - 1];
    curEls.forEach(function (el) { el.textContent = String(cur); });
    backBtns.forEach(function (b) { b.disabled = cur === 1; });
    if (noteEl) noteEl.textContent = NOTES[cur - 1];

    var last = cur === TOTAL;
    if (nextBtn) nextBtn.hidden = last;
    if (finalEl) finalEl.hidden = !last;

    if (last) buildSummary();
    if (scroll) scroll.scrollTop = 0;
  }

  function go(n) {
    n = Math.max(1, Math.min(TOTAL, n));
    if (n > cur && !stepValid(cur)) { flashInvalid(); return; }
    cur = n;
    render();
    track('wiz_step_' + cur);
  }

  function flashInvalid() {
    // Мягкая подсветка незаполненного: трясём кнопку и подсвечиваем
    // пустые размеры/категории.
    if (cur === 1) {
      ['w', 'd', 'h'].forEach(function (k) {
        var inp = wiz.querySelector('[data-dim="' + k + '"]');
        if (inp && !(Number(inp.value) > 0)) {
          inp.style.borderColor = '#D08A72';
          inp.addEventListener('input', function clr() { inp.style.borderColor = ''; inp.removeEventListener('input', clr); });
        }
      });
    }
    if (nextBtn) {
      nextBtn.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }],
        { duration: 240 }
      );
    }
  }

  /* ── Кнопки навигации ─────────────────────────────────────── */
  if (nextBtn) nextBtn.addEventListener('click', function () { go(cur + 1); });
  backBtns.forEach(function (b) { b.addEventListener('click', function () { go(cur - 1); }); });

  // «Изменить» в сводке → прыжок на нужный шаг
  if (summary) summary.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-wiz-goto]');
    if (btn) go(Number(btn.getAttribute('data-wiz-goto')));
  });

  /* ── Модалки (нижний лист) ────────────────────────────────── */
  function openModal(html) {
    closeModal();
    var m = document.createElement('div');
    m.className = 'u-wiz-modal';
    m.setAttribute('data-wiz-modal', '');
    m.innerHTML = '<div class="u-wiz-modal__sheet" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(m);
    document.body.style.overflow = 'hidden';
    m.addEventListener('click', function (e) {
      if (e.target === m || e.target.closest('[data-wiz-mclose]')) closeModal();
    });
    document.addEventListener('keydown', onEsc);
    return m;
  }
  function closeModal() {
    var m = document.querySelector('[data-wiz-modal]');
    if (m) m.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onEsc);
  }
  function onEsc(e) { if (e.key === 'Escape') closeModal(); }

  var modalHead = function (title, em) {
    return '<div class="u-wiz-modal__grip"></div>' +
      '<div class="u-wiz-modal__head">' +
        '<h2 class="u-wiz-modal__title">' + title + ' <em>' + em + '</em></h2>' +
        '<button type="button" class="u-wiz-modal__close" data-wiz-mclose aria-label="Закрыть">✕</button>' +
      '</div>';
  };

  // Превью результата — главная фича для конверсии: показываем пример
  // готовой схемы ДО оплаты, чтобы снять «кота в мешке».
  wiz.querySelectorAll('[data-wiz-preview]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      track('preview_result_open');
      openModal(
        modalHead('Как будет', 'выглядеть') +
        '<div class="u-wiz-modal__body">' +
          '<div class="u-wiz-modal__preview">' +
            '<img src="../landing_design/assets/sample-scheme-mobile.webp" alt="Пример готовой схемы хранения" decoding="async" />' +
          '</div>' +
          '<p class="u-wiz-modal__p" style="margin-top:14px">Пример готовой схемы. Ваша будет под ваши размеры и категории — со схемой раскладки, подбором органайзеров и памяткой, как сложить вещи.</p>' +
        '</div>' +
        '<button type="button" class="u-wiz-modal__cta" data-wiz-mclose>Понятно, продолжить</button>'
      );
    });
  });

  // Как измерить
  var measureBtn = wiz.querySelector('[data-wiz-measure]');
  if (measureBtn) measureBtn.addEventListener('click', function () {
    track('measure_help_open');
    openModal(
      modalHead('Как измерить', 'ящик') +
      '<div class="u-wiz-modal__body">' +
        '<p class="u-wiz-modal__p">Пожалуйста, измеряйте <b style="color:#2E2E2E">внутренние</b> стороны. Размеры нужны, чтобы все органайзеры точно подошли.</p>' +
        '<p class="u-wiz-modal__p" style="margin:0"><b style="color:#2E2E2E">Ширина и глубина:</b> от стенки к стенке внутри ящика, без фасада, бортиков и направляющих.<br><b style="color:#2E2E2E">Высота:</b> от дна до самой низкой точки сверху — лучше оставить запас 1–2&nbsp;см.</p>' +
        '<a class="u-wiz-measure__article" href="../blog/kak-zamerit-yashchik/" target="_blank" rel="noopener">' +
          '<span class="u-wiz-measure__article-ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h11a2 2 0 0 1 2 2v12H6a2 2 0 0 1-2-2V5z"/><path d="M17 7h3v12H6"/><path d="M8 9h6M8 12h6"/></svg></span>' +
          '<span style="display:flex;flex-direction:column;min-width:0">' +
            '<span class="eyebrow">Статья в блоге</span>' +
            '<span class="ttl">Как замерить ящик: пошагово</span>' +
            '<span class="meta">5 мин · с фото и примерами</span>' +
          '</span>' +
          '<span class="arr">↗</span>' +
        '</a>' +
      '</div>' +
      '<button type="button" class="u-wiz-modal__cta" data-wiz-mclose>Понятно</button>'
    );
  });

  // Что значит «важнее»
  var prioBtn = wiz.querySelector('[data-wiz-prio]');
  if (prioBtn) prioBtn.addEventListener('click', function () {
    track('priority_help_open');
    var modes = [
      ['Удобно', 'видно каждую вещь, легко доставать'],
      ['Вместительно', 'максимум объёма на каждом см²'],
      ['Экономично', 'минимум органайзеров и трат'],
    ];
    openModal(
      modalHead('Что значит', '«важнее»') +
      '<div class="u-wiz-modal__body">' +
        '<p class="u-wiz-modal__p">Под выбранный приоритет настроим плотность раскладки и число органайзеров.</p>' +
        '<div class="u-wiz-prio">' +
          modes.map(function (m, i) {
            return '<div class="u-wiz-prio__row">' +
              '<span class="u-wiz-prio__n">' + (i + 1) + '</span>' +
              '<span><span class="u-wiz-prio__t">' + m[0] + '</span><span class="u-wiz-prio__d">' + m[1] + '</span></span>' +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>' +
      '<button type="button" class="u-wiz-modal__cta" data-wiz-mclose>Понятно</button>'
    );
  });

  /* ── Если зашли с ?t=token (prefill) — начинаем с шага 3, чтобы юзер
        сразу увидел сводку и пошёл на оплату. Иначе — с шага 1. ──── */
  var params = new URLSearchParams(location.search);
  if (params.get('t') || params.get('token')) {
    // calc.js асинхронно подтянет значения; сводку построим после небольшой
    // задержки, чтобы поля успели заполниться.
    setTimeout(function () { go(3); }, 400);
  } else {
    render();
  }
})();
