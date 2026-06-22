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
    'Полная схема и подбор органайзеров за 149 ₽ в конце',
    'Категории и приоритет — в одном шаге',
    'Оплата через ЮKassa. После оплаты — страница с готовой схемой.',
  ];

  var steps   = wiz.querySelectorAll('[data-wiz-step]');
  var fill    = wiz.querySelector('[data-wiz-fill]');
  var labelEl = wiz.querySelector('[data-wiz-label]');
  var curEls  = wiz.querySelectorAll('[data-wiz-cur], [data-wiz-cur2]');
  var backBtns = wiz.querySelectorAll('[data-wiz-back]'); // кнопка «Назад» в футере
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
    // На десктопе места достаточно — показываем ВСЕ выбранные категории.
    // На мобиле экономим строку: первые 3 + «+N».
    var isDesktop = window.matchMedia('(min-width: 960px)').matches;
    if (isDesktop || labels.length <= 3) return labels.join(', ');
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

  // Шаблон «головы» (grip + заголовок + крестик) — общий для всех трёх попапов.
  // Точно как в макете: grip 40×4, Title size 23, mb 0, крестик 30×30.
  // Отступ между головой и контентом задаёт КАЖДЫЙ попап сам (marginBottom),
  // потому что в макете он разный: preview 8, measure 8 (внутри head), prio 6.
  function popupHead(title, em) {
    return '<div class="u-wiz-mp__grip"></div>' +
      '<div class="u-wiz-mp__head">' +
        '<h2 class="u-wiz-mp__title">' + title + ' <em>' + em + '</em></h2>' +
        '<button type="button" class="u-wiz-mp__close" data-wiz-mclose aria-label="Закрыть">✕</button>' +
      '</div>';
  }

  // ── 1. PreviewPopup — особая трёхсекционная структура с CTA-overlap ──
  // В макете: лист {display:flex, flexDirection:column, overflow:hidden,
  // maxHeight: calc(100% - 8px)}, внутри три секции:
  //   head   flex:0 0, padding 10/18/8
  //   body   flex:0 1, padding 0/18, position:relative z-index:1; внутри
  //          превью-карточка {background:#FFFBF5, border, borderRadius:16/16/0/0,
  //          paddingBottom:26, overflow:hidden} с картинкой width:100%
  //   footer flex:0 0, marginTop:-20, z-index:2, padding 10/18/(14+safe),
  //          borderTop, background:bg — НАЕЗЖАЕТ поверх карточки на 20px.
  wiz.querySelectorAll('[data-wiz-preview]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      track('preview_result_open');
      openModal(
        '<div class="u-wiz-mp u-wiz-mp--preview">' +
          '<div class="u-wiz-mp__top">' + popupHead('Как будет', 'выглядеть') + '</div>' +
          '<div class="u-wiz-mp__pvbody">' +
            '<div class="u-wiz-mp__pvcard">' +
              '<img src="../assets/images/result-vert.webp" alt="Пример итоговой схемы хранения" decoding="async" />' +
            '</div>' +
          '</div>' +
          '<div class="u-wiz-mp__pvfoot">' +
            '<button type="button" class="u-wiz-mp__cta" data-wiz-mclose>Понятно, продолжить</button>' +
          '</div>' +
        '</div>'
      );
    });
  });

  // SVG-чертежи (TopViewDiagram / SideViewDiagram из макета). Размер 100×72.
  var TOP_DIAGRAM =
    '<svg class="u-wiz-mp__dia" viewBox="0 0 116 84" aria-hidden="true">' +
      '<rect x="32" y="12" width="62" height="44" rx="8" fill="#F8EEE0" stroke="#DBC8B1" stroke-width="1.3"/>' +
      '<g stroke="#DBC8B1" stroke-width="1" stroke-linecap="round">' +
        '<line x1="32" y1="12" x2="16" y2="12"/><line x1="32" y1="56" x2="16" y2="56"/>' +
        '<line x1="32" y1="58" x2="32" y2="73"/><line x1="94" y1="58" x2="94" y2="73"/></g>' +
      '<g stroke="#D08A72" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" fill="none">' +
        '<line x1="20" y1="13" x2="20" y2="55"/><polyline points="17.5,16 20,13 22.5,16"/><polyline points="17.5,52 20,55 22.5,52"/>' +
        '<line x1="34" y1="70" x2="92" y2="70"/><polyline points="37,67.5 34,70 37,72.5"/><polyline points="89,67.5 92,70 89,72.5"/></g>' +
      '<text x="9" y="37" font-family="JetBrains Mono, monospace" font-size="8.5" fill="#B6735C">Г</text>' +
      '<text x="63" y="81" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="8.5" fill="#B6735C">Ш</text>' +
    '</svg>';
  var SIDE_DIAGRAM =
    '<svg class="u-wiz-mp__dia" viewBox="0 0 116 84" aria-hidden="true">' +
      '<path d="M34 16 V58 H94 V16" fill="none" stroke="#C2A98C" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<line x1="34" y1="26" x2="94" y2="26" stroke="#CDB89C" stroke-width="1.1" stroke-dasharray="3.5 3.5" stroke-linecap="round"/>' +
      '<g stroke="#DBC8B1" stroke-width="1" stroke-linecap="round"><line x1="34" y1="26" x2="18" y2="26"/><line x1="34" y1="58" x2="18" y2="58"/></g>' +
      '<g stroke="#D08A72" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" fill="none">' +
        '<line x1="22" y1="27" x2="22" y2="57"/><polyline points="19.5,30 22,27 24.5,30"/><polyline points="19.5,54 22,57 24.5,54"/></g>' +
      '<text x="11" y="45" font-family="JetBrains Mono, monospace" font-size="8.5" fill="#B6735C">В</text>' +
    '</svg>';

  // ── 2. MeasurePopup — единый padding 12/18/22 (БЕЗ safe-area), всё потоком ──
  // В макете: grip mb=16, head mb=8, lead-блок mb=16, row1 mb=14, row2,
  // Spacer 14, статья-ссылка mb=12, CTA. Никаких секций.
  var measureBtn = wiz.querySelector('[data-wiz-measure]');
  if (measureBtn) measureBtn.addEventListener('click', function () {
    track('measure_help_open');
    openModal(
      '<div class="u-wiz-mp u-wiz-mp--measure">' +
        popupHead('Как измерить', 'ящик') +
        '<div class="u-wiz-mp__lead">' +
          '<img src="../landing_design/assets/measuring_tape.png" alt="" decoding="async" />' +
          '<p>Пожалуйста, измеряйте <b>внутренние</b> стороны. Размеры нужны, чтобы все органайзеры точно подошли.</p>' +
        '</div>' +
        '<div class="u-wiz-mp__rows">' +
          '<div class="u-wiz-mp__row">' + TOP_DIAGRAM +
            '<div class="u-wiz-mp__rowtxt"><div class="t">Ширина и глубина</div>' +
              '<div class="d"><b>ширина:</b> от левого края к правому<br><b>глубина:</b> от передней стенки к задней<br>без фасада, бортиков и направляющих</div></div>' +
          '</div>' +
          '<div class="u-wiz-mp__row u-wiz-mp__row--last">' + SIDE_DIAGRAM +
            '<div class="u-wiz-mp__rowtxt"><div class="t">Высота</div>' +
              '<div class="d">от дна до самой низкой точки сверху, лучше оставить запас 1–2&nbsp;см.</div></div>' +
          '</div>' +
        '</div>' +
        '<a class="u-wiz-mp__article" href="../blog/kak-zamerit-yashchik/" target="_blank" rel="noopener">' +
          '<span class="u-wiz-mp__article-ic"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7D8C72" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h11a2 2 0 0 1 2 2v12H6a2 2 0 0 1-2-2V5z"/><path d="M17 7h3v12H6"/><path d="M8 9h6M8 12h6"/></svg></span>' +
          '<span class="u-wiz-mp__article-tx">' +
            '<span class="eyebrow">Статья в блоге</span>' +
            '<span class="ttl">Как замерить ящик: пошагово</span>' +
            '<span class="meta">5 мин · с фото и примерами</span>' +
          '</span>' +
          '<span class="arr">↗</span>' +
        '</a>' +
        '<button type="button" class="u-wiz-mp__cta" data-wiz-mclose>Понятно</button>' +
      '</div>'
    );
  });

  // ── 3. PrioHelpPopup — единый padding 10/18/(18+safe), всё потоком ──
  // В макете: grip mb=14, head mb=6, p mb=16, список (gap:12), Spacer 18, CTA.
  // У первого режима — кружок с галочкой sageSoft+sageD, у остальных — цифры на line2.
  var prioBtn = wiz.querySelector('[data-wiz-prio]');
  if (prioBtn) prioBtn.addEventListener('click', function () {
    track('priority_help_open');
    var modes = [
      ['convenient', 'Удобно', 'видно каждую вещь, легко доставать'],
      ['capacity', 'Вместительно', 'максимум объёма на каждом см²'],
      ['budget', 'Экономично', 'минимум органайзеров и трат'],
    ];
    // Галочку ставим на РЕАЛЬНО выбранный приоритет (а не жёстко на первый).
    // Остальным режимам — их порядковый номер.
    var selBtn = wiz.querySelector('.u-calc__pri-btn[aria-pressed="true"]');
    var selPriority = selBtn ? selBtn.getAttribute('data-priority') : 'convenient';
    var checkSvg = '<svg width="13" height="13" viewBox="0 0 14 14"><path d="M2.5 7.5 6 11 11.5 3.5" fill="none" stroke="#7D8C72" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    openModal(
      '<div class="u-wiz-mp u-wiz-mp--prio">' +
        popupHead('Что значит', '«важнее»') +
        '<p class="u-wiz-mp__intro">Под выбранный приоритет настроим плотность раскладки и число органайзеров.</p>' +
        '<div class="u-wiz-mp__priolist">' +
          modes.map(function (m, i) {
            var isSel = m[0] === selPriority;
            return '<div class="u-wiz-mp__priorow">' +
              '<span class="u-wiz-mp__prion' + (isSel ? ' is-on' : '') + '">' +
                (isSel ? checkSvg : (i + 1)) +
              '</span>' +
              '<span class="u-wiz-mp__priotx">' +
                '<span class="t">' + m[1] + '</span>' +
                '<span class="d">' + m[2] + '</span>' +
              '</span>' +
            '</div>';
          }).join('') +
        '</div>' +
        '<button type="button" class="u-wiz-mp__cta" data-wiz-mclose>Понятно</button>' +
      '</div>'
    );
  });

  /* ── Оферта: открываем в попапе вместо новой вкладки ────────────────
     Юзер на шаге 3 кликает «Оферты» в чекбоксе согласия — раньше уходил в
     новую вкладку (../oferta/), что разрывает фокус с расчётом. Теперь
     перехватываем клик и показываем оферту в iframe-модалке, форма
     остаётся заполненной, юзер не теряется. */
  wiz.querySelectorAll('[data-wiz-oferta]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      track('oferta_popup_open');
      openModal(
        '<div class="u-wiz-mp u-wiz-mp--oferta">' +
          '<div class="u-wiz-mp__top">' +
            '<div class="u-wiz-mp__grip"></div>' +
            '<div class="u-wiz-mp__head">' +
              '<h2 class="u-wiz-mp__title">Публичная <em>оферта</em></h2>' +
              '<button type="button" class="u-wiz-mp__close" data-wiz-mclose aria-label="Закрыть">✕</button>' +
            '</div>' +
          '</div>' +
          '<div class="u-wiz-mp__oframe">' +
            '<iframe src="../oferta/?embed=1" title="Публичная оферта" loading="eager"></iframe>' +
          '</div>' +
          '<div class="u-wiz-mp__pvfoot">' +
            '<button type="button" class="u-wiz-mp__cta" data-wiz-mclose>Закрыть</button>' +
          '</div>' +
        '</div>'
      );
    });
  });

  /* ── Если зашли с ?t=token (возврат из no-fit) — ведём на ШАГ 2, где
        меняют объём вещей. Размеры (шаг 1) уже заполнены prefill'ом и
        остаются нетронутыми. Переход делаем по сигналу umestno:prefilled
        (calc.js шлёт его, когда реальные данные подставлены) — чтобы юзер
        сразу видел СВОИ вещи, а не дефолтную болванку. Иначе — с шага 1. ─ */
  var params = new URLSearchParams(location.search);
  if (params.get('t') || params.get('token')) {
    render(); // показываем шаг 1 сразу, без пустого экрана
    var jumpedToEdit = false;
    var goToEditStep = function () {
      if (jumpedToEdit) return;
      jumpedToEdit = true;
      go(2);
    };
    document.addEventListener('umestno:prefilled', goToEditStep, { once: true });
    // Страховка: если сигнал не придёт (calc.js упал/заблокирован), всё равно
    // переводим на шаг 2 через 3 c, чтобы не застрять на шаге 1.
    setTimeout(goToEditStep, 3000);
  } else {
    render();
  }

  /* ── AddCat: счётчик N/4 и подпись под кнопкой ──────────────────
     calc.js сам по себе считает строки и скрывает кнопку при достижении
     max=4 (rows < MAX_ROWS). Здесь только обновляем визуальный счётчик и
     текст подписи — следим за изменениями в [data-items] через
     MutationObserver. */
  var itemsRoot = wiz.querySelector('[data-items]');
  var addBtn = wiz.querySelector('[data-add]');
  var addCountEl = wiz.querySelector('[data-wiz-add-count]');
  var addSubEl = wiz.querySelector('[data-wiz-add-sub]');
  var MAX_CAT = 4;
  if (itemsRoot) {
    var updateAddCount = function () {
      var n = itemsRoot.querySelectorAll('.u-calc__item-row').length;
      if (addCountEl) addCountEl.textContent = n + ' / ' + MAX_CAT;
      // «is-full» зажигаем уже на предпоследнем слоте — последний визуальный
      // сигнал перед тем, как calc.js скроет кнопку при достижении лимита.
      if (addBtn) addBtn.classList.toggle('is-full', n >= MAX_CAT - 1);
      if (addSubEl) {
        addSubEl.textContent = n >= MAX_CAT
          ? 'Максимум 4 категории на ящик'
          : 'Не более 4 категорий на один ящик';
      }
    };
    // initial — calc.js рендерит первые 2 строки синхронно, но на всякий
    // случай через setTimeout, чтобы DOM точно был готов.
    setTimeout(updateAddCount, 0);
    new MutationObserver(updateAddCount).observe(itemsRoot, { childList: true });
  }

  /* ── Бургер-меню в топбаре ─────────────────────────────────────
     Переиспользуем штатную мобильную nav сайта (#u-mobile-nav из шапки
     .u-header--sub) — то же меню, что у старого конфигуратора. Boot
     скрывает header через display:none, поэтому переносим nav в body на
     время работы визарда, чтобы оно осталось видимым при открытии. */
  var menuBtn = wiz.querySelector('[data-wiz-menu]');
  var mobileNav = document.getElementById('u-mobile-nav');
  if (menuBtn && mobileNav) {
    if (mobileNav.parentNode && mobileNav.parentNode.tagName !== 'BODY') {
      document.body.appendChild(mobileNav);
    }
    var closeNav = function () {
      mobileNav.hidden = true;
      menuBtn.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('u-nav-open');
    };
    menuBtn.setAttribute('aria-controls', 'u-mobile-nav');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.addEventListener('click', function () {
      var open = menuBtn.getAttribute('aria-expanded') === 'true';
      if (open) return closeNav();
      mobileNav.hidden = false;
      menuBtn.setAttribute('aria-expanded', 'true');
      document.body.classList.add('u-nav-open');
      track('wiz_menu_open');
    });
    mobileNav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', closeNav);
    });
  }

  /* ── Карусель отзывов с автоплеем ─────────────────────────────
     5 отзывов (те же, что в .u-review-slide на лэндинге).
     Управление: стрелки prev/next, клик по точке, клавиатура (←/→).
     Автоплей: 5 секунд, ставится на паузу при любом взаимодействии,
     возобновляется через 12 секунд после последнего действия. */
  var REVIEWS = [
    {
      name: 'Анна', city: 'Москва',
      quote: '«Я бы сама долго собирала это по частям. Здесь сразу понятно, что покупать и как это должно встать внутри»',
      bfr: '../landing_design/assets/review1-bfr.webp',
      aftr: '../landing_design/assets/review1-aftr.webp'
    },
    {
      name: 'Елена', city: 'Владикавказ',
      quote: '«Мне понравилось, что сервис показал не просто товары, а саму логику хранения. Наконец, стало удобно пользоваться ящиком. Не уходит по 10 минут на поиск нужной вещи»',
      bfr: '../landing_design/assets/review2-bfr.webp',
      aftr: '../landing_design/assets/review2-aftr.webp'
    },
    {
      name: 'Максим', city: 'Санкт-Петербург',
      quote: '«Не хотел тратить время на поиски органайзеров и прикидывать размеры вручную. Сразу получил понятную схему и рекомендации, что купить»',
      bfr: '../landing_design/assets/review3-bfr.webp',
      aftr: '../landing_design/assets/review3-aftr.webp'
    },
    {
      name: 'Ирина', city: 'Москва',
      quote: '«Самое полезное — что схема собирается не на глаз. Я бы сама не додумалась разложить именно так. Оказалось удобнее, и порядок поддерживается сам собой»',
      bfr: '../landing_design/assets/review4-bfr.webp',
      aftr: '../landing_design/assets/review4-aftr.webp'
    },
    {
      name: 'Давид', city: 'Екатеринбург',
      quote: '«Ящик большой, но именно поэтому в нём постоянно был беспорядок. Джинсы, шорты, футболки в хаосе, ремни всё время оказывались где-то сбоку. Разложил, как предложил Уместно, и вещи наконец перестали мешать друг другу»',
      bfr: '../landing_design/assets/review5-bfr.webp',
      aftr: '../landing_design/assets/review5-aftr.webp'
    }
  ];

  var reviewsRoot = wiz.querySelector('[data-reviews]');
  if (reviewsRoot) {
    var curR = 0;
    var autoTimer = null;
    var resumeTimer = null;
    var elNum    = reviewsRoot.querySelector('[data-review-num]');
    var elQuote  = reviewsRoot.querySelector('[data-review-quote]');
    var elName   = reviewsRoot.querySelector('[data-review-name]');
    var elCity   = reviewsRoot.querySelector('[data-review-city]');
    var elAvatar = reviewsRoot.querySelector('[data-review-avatar]');
    var elBefore = reviewsRoot.querySelector('[data-review-before]');
    var elAfter  = reviewsRoot.querySelector('[data-review-after]');
    var elDots   = reviewsRoot.querySelector('[data-review-dots]');
    var compareFrame = reviewsRoot.querySelector('.u-wiz__compare-frame');

    // Точки рендерим из массива — на случай, если в HTML или из-за чего-то
    // ещё пришло больше элементов: фиксируем количество = REVIEWS.length.
    if (elDots) {
      elDots.innerHTML = REVIEWS.map(function (_, i) {
        return '<button type="button"' + (i === 0 ? ' class="on"' : '') +
               ' data-review-go="' + i + '" tabindex="-1" aria-label="Отзыв ' + (i + 1) + '"></button>';
      }).join('');
    }

    function renderReview(idx) {
      curR = ((idx % REVIEWS.length) + REVIEWS.length) % REVIEWS.length;
      var r = REVIEWS[curR];
      if (elNum)    elNum.textContent = (curR + 1 < 10 ? '0' : '') + (curR + 1);
      if (elQuote)  elQuote.textContent = r.quote;
      if (elName)   elName.textContent = r.name;
      if (elCity)   elCity.textContent = r.city;
      if (elAvatar) elAvatar.textContent = r.name.charAt(0);
      if (elBefore) elBefore.src = r.bfr;
      if (elAfter)  elAfter.src = r.aftr;
      if (elDots) elDots.querySelectorAll('button').forEach(function (b, i) {
        b.classList.toggle('on', i === curR);
      });
      // сбрасываем позицию compare-слайдера при смене карточки
      if (compareFrame) compareFrame.style.setProperty('--x', '50%');
    }
    // Панель отзывов видна только на десктопе (wizard.css: .u-wiz__rail
    // display:none ниже 960px). Автоплей запускаем ТОЛЬКО когда панель
    // реально на экране и вкладка активна — иначе на мобиле таймер
    // вхолостую крутит карусель и подгружает картинки, которых не видно.
    var mqDesktop = window.matchMedia('(min-width: 960px)');
    function autoAllowed() { return mqDesktop.matches && !document.hidden; }
    function startAuto() {
      stopAuto();
      if (!autoAllowed()) return;
      autoTimer = setInterval(function () { renderReview(curR + 1); }, 5000);
    }
    function stopAuto() {
      if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
      if (resumeTimer) { clearTimeout(resumeTimer); resumeTimer = null; }
    }
    function pauseAuto() {
      stopAuto();
      resumeTimer = setTimeout(startAuto, 12000);
    }

    reviewsRoot.querySelector('[data-review-prev]').addEventListener('click', function () {
      renderReview(curR - 1); pauseAuto();
    });
    reviewsRoot.querySelector('[data-review-next]').addEventListener('click', function () {
      renderReview(curR + 1); pauseAuto();
    });
    if (elDots) elDots.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        renderReview(parseInt(b.getAttribute('data-review-go'), 10)); pauseAuto();
      });
    });
    // Пауза — только при настоящих действиях (клик по стрелке/точке,
    // drag compare, попадание фокуса на интерактивный элемент). Hover
    // мышью НЕ ставит на паузу — иначе с курсором над блоком автоплей
    // никогда не тикает.
    reviewsRoot.addEventListener('focusin', pauseAuto);
    if (compareFrame) {
      compareFrame.addEventListener('mousedown', pauseAuto);
      compareFrame.addEventListener('touchstart', pauseAuto, { passive: true });
    }
    // keydown только на самих стрелках, чтобы не конфликтовать со стрелками
    // compare-слайдера и не реагировать на стрелки в полях формы
    [reviewsRoot.querySelector('[data-review-prev]'),
     reviewsRoot.querySelector('[data-review-next]')].forEach(function (b) {
      b.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft')  { renderReview(curR - 1); pauseAuto(); e.preventDefault(); }
        if (e.key === 'ArrowRight') { renderReview(curR + 1); pauseAuto(); e.preventDefault(); }
      });
    });
    // Вкладку свернули/ушли — глушим таймер; вернулись — пробуем снова
    // (startAuto сам проверит, что мы на десктопе). Смена брейкпоинта
    // (поворот/ресайз) тоже пересматривает автоплей.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopAuto(); else startAuto();
    });
    if (mqDesktop.addEventListener) mqDesktop.addEventListener('change', startAuto);
    else if (mqDesktop.addListener) mqDesktop.addListener(startAuto); // старый Safari

    startAuto();
  }

  /* ── Compare-слайдер «До / После» с вертикальной линией ───────
     Ручка двигает разделитель влево-вправо: слева остаётся «После»
     (верхний слой через clip-path), справа — «До». Управление: мышь,
     touch, клавиатура (стрелки ←/→, Home/End). */
  wiz.querySelectorAll('[data-compare]').forEach(function (root) {
    var frame = root.querySelector('.u-wiz__compare-frame');
    var handle = root.querySelector('[data-compare-handle]');
    if (!frame || !handle) return;
    var dragging = false;

    function setX(pct) {
      pct = Math.max(0, Math.min(100, pct));
      frame.style.setProperty('--x', pct + '%');
      handle.setAttribute('aria-valuenow', Math.round(pct));
    }
    function pctFromClientX(clientX) {
      var r = frame.getBoundingClientRect();
      return ((clientX - r.left) / r.width) * 100;
    }
    function getEventX(e) {
      if (e.touches && e.touches.length) return e.touches[0].clientX;
      if (e.changedTouches && e.changedTouches.length) return e.changedTouches[0].clientX;
      return e.clientX;
    }
    function onDown(e) {
      dragging = true;
      handle.focus({ preventScroll: true });
      setX(pctFromClientX(getEventX(e)));
      e.preventDefault();
    }
    function onMove(e) {
      if (!dragging) return;
      setX(pctFromClientX(getEventX(e)));
      e.preventDefault();
    }
    function onUp() { dragging = false; }

    handle.addEventListener('mousedown', onDown);
    frame.addEventListener('mousedown', onDown);
    handle.addEventListener('touchstart', onDown, { passive: false });
    frame.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    window.addEventListener('touchcancel', onUp);

    handle.addEventListener('keydown', function (e) {
      var cur = parseFloat(handle.getAttribute('aria-valuenow')) || 50;
      var step = e.shiftKey ? 10 : 5;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { setX(cur - step); e.preventDefault(); }
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp')  { setX(cur + step); e.preventDefault(); }
      if (e.key === 'Home') { setX(0);   e.preventDefault(); }
      if (e.key === 'End')  { setX(100); e.preventDefault(); }
    });
  });
})();
