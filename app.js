// Уместно — landing interactivity (vanilla, no framework)
(function () {
  'use strict';

  /* ── Burger / mobile nav ─────────────────────────────── */
  var burger = document.querySelector('.u-burger');
  var mobileNav = document.getElementById('u-mobile-nav');
  if (burger && mobileNav) {
    var closeNav = function () {
      mobileNav.hidden = true;
      burger.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('u-nav-open');
    };
    burger.addEventListener('click', function () {
      var open = burger.getAttribute('aria-expanded') === 'true';
      if (open) { closeNav(); return; }
      mobileNav.hidden = false;
      burger.setAttribute('aria-expanded', 'true');
      document.body.classList.add('u-nav-open');
    });
    mobileNav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', closeNav);
    });
  }

  /* ── Configurator: priority + live size meta ─────────── */
  var priList = document.querySelector('.u-config2__pri-list');
  if (priList) {
    var checkSVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>';
    priList.querySelectorAll('.u-config2__pri').forEach(function (btn) {
      btn.addEventListener('click', function () {
        priList.querySelectorAll('.u-config2__pri').forEach(function (b) {
          b.classList.remove('on');
          var c = b.querySelector('.u-config2__check');
          if (c) c.innerHTML = '';
        });
        btn.classList.add('on');
        var c = btn.querySelector('.u-config2__check');
        if (c) c.innerHTML = checkSVG;
      });
    });
  }
  var rmeta = document.querySelector('[data-rmeta]');
  if (rmeta) {
    var dims = { w: '80', d: '45', h: '15' };
    var syncMeta = function () { rmeta.textContent = dims.w + '×' + dims.d + '×' + dims.h; };
    document.querySelectorAll('[data-dim]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        dims[inp.getAttribute('data-dim')] = inp.value || '—';
        syncMeta();
      });
    });
  }

  /* ── Reviews slider (one at a time, swipeable) ───────── */
  var REVIEWS = [
    { name: 'Анна', city: 'Москва',
      quote: 'Я бы сама очень долго собирала это по частям. Здесь сразу стало понятно, что покупать и как это должно встать внутри.',
      bfr: 'landing_design/assets/review1-bfr.webp', aftr: 'landing_design/assets/review1-aftr.webp',
      bfrCap: 'Вещи лежат вместе, зоны хранения не выделены.',
      aftrCap: 'Пространство разделено на отдельные зоны — для белья и аксессуаров.' },
    { name: 'Елена', city: 'Владикавказ',
      quote: 'Мне понравилось, что сервис показал не просто товары, а саму логику хранения. Наконец, стало удобно пользоваться ящиком — не уходит по 10 минут на поиск нужной вещи.',
      bfr: 'landing_design/assets/review2-bfr.webp', aftr: 'landing_design/assets/review2-aftr.webp',
      bfrCap: 'Вещи лежали обычными стопками и быстро смешивались.',
      aftrCap: 'Каждая категория разделена по понятным блокам с удобным доступом.' },
    { name: 'Максим', city: 'Санкт-Петербург',
      quote: 'Я не хотел тратить время на поиски нужных органайзеров и прикидывать размеры вручную. Как же это удобно, что можно сразу получил понятную схему, ещё и рекомендации, что купить.',
      bfr: 'landing_design/assets/review3-bfr.webp', aftr: 'landing_design/assets/review3-aftr.webp',
      bfrCap: 'Вещи помещаются, но пользоваться ящиком неудобно.',
      aftrCap: 'У каждой категории появляется своё место под частоту использования.' },
    { name: 'Ирина', city: 'Москва',
      quote: 'Самое полезное, что схема собирается не на глаз. Я бы сама точно не додумалась, как разложить всё именно так. Оказалось, что так удобнее, и порядок поддерживается как будто сам собой.',
      bfr: 'landing_design/assets/review4-bfr.webp', aftr: 'landing_design/assets/review4-aftr.webp',
      bfrCap: 'Все вещи лежали вперемешку, деликатные вещи могли деформироваться.',
      aftrCap: 'Бельевые категории собраны рядом, а для каждой зоны есть своё назначение.' },
    { name: 'Давид', city: 'Екатеринбург',
      quote: 'Ящик большой, но именно поэтому в нём постоянно был беспорядок. Джинсы, шорты, футболки в хаосе, ремни всё время оказывались где-то сбоку. Разложил, как предложил Уместно — вещи наконец перестали мешать друг другу.',
      bfr: 'landing_design/assets/review5-bfr.webp', aftr: 'landing_design/assets/review5-aftr.webp',
      bfrCap: 'Крупные вещи и аксессуары лежат вместе и перемешиваются в большом ящике.',
      aftrCap: 'Джинсы, шорты, футболки и ремни разложены по отдельным зонам.' }
  ];
  var slide = document.querySelector('[data-reviews]');
  if (slide) {
    var idx = 0;
    var el = {
      num: slide.querySelector('[data-review-num]'),
      quote: slide.querySelector('[data-review-quote]'),
      av: slide.querySelector('[data-review-av]'),
      name: slide.querySelector('[data-review-name]'),
      city: slide.querySelector('[data-review-city]'),
      bfr: slide.querySelector('[data-review-bfr]'),
      aftr: slide.querySelector('[data-review-aftr]'),
      bfrCap: slide.querySelector('[data-review-bfr-cap]'),
      aftrCap: slide.querySelector('[data-review-aftr-cap]'),
      dots: slide.querySelector('[data-review-dots]')
    };
    // build dots
    REVIEWS.forEach(function (_, i) {
      var b = document.createElement('button');
      b.setAttribute('aria-label', 'Отзыв ' + (i + 1));
      b.addEventListener('click', function () { idx = i; render(); });
      el.dots.appendChild(b);
    });
    var render = function () {
      var r = REVIEWS[idx];
      if (el.num) el.num.textContent = (idx + 1 < 10 ? '0' : '') + (idx + 1);
      if (el.quote) el.quote.textContent = r.quote;
      if (el.av) el.av.textContent = r.name.charAt(0);
      if (el.name) el.name.textContent = r.name;
      if (el.city) el.city.textContent = r.city;
      if (el.bfr) el.bfr.src = r.bfr;
      if (el.aftr) el.aftr.src = r.aftr;
      if (el.bfrCap) el.bfrCap.textContent = r.bfrCap;
      if (el.aftrCap) el.aftrCap.textContent = r.aftrCap;
      el.dots.querySelectorAll('button').forEach(function (b, i) {
        b.classList.toggle('active', i === idx);
      });
    };
    var go = function (delta) { idx = (idx + delta + REVIEWS.length) % REVIEWS.length; render(); };
    var prev = slide.querySelector('[data-review-prev]');
    var next = slide.querySelector('[data-review-next]');
    if (prev) prev.addEventListener('click', function () { go(-1); });
    if (next) next.addEventListener('click', function () { go(1); });

    // touch swipe (one review at a time)
    var startX = null, startY = null;
    var swipeArea = slide.querySelector('.u-review-slide__compare') || slide;
    swipeArea.addEventListener('touchstart', function (e) {
      startX = e.touches[0].clientX; startY = e.touches[0].clientY;
    }, { passive: true });
    swipeArea.addEventListener('touchend', function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      var dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) { go(dx < 0 ? 1 : -1); }
      startX = startY = null;
    }, { passive: true });

    render();
  }

  /* ── Steps accordion (mobile: tap a spine to open) ───── */
  var stepsTrack = document.querySelector('.u-steps--4');
  if (stepsTrack) {
    var stepCards = Array.prototype.slice.call(stepsTrack.querySelectorAll('.u-step-card'));
    var openStep = function (card) {
      stepCards.forEach(function (c) {
        var on = c === card;
        c.classList.toggle('is-open', on);
        c.setAttribute('aria-expanded', on ? 'true' : 'false');
      });
    };
    stepCards.forEach(function (card, i) {
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      if (i === 0) card.classList.add('is-open');
      card.setAttribute('aria-expanded', i === 0 ? 'true' : 'false');
      card.addEventListener('click', function () { openStep(card); });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openStep(card); }
      });
    });
  }

  /* ── FAQ accordion ───────────────────────────────────── */
  var FAQS = [
    { q: 'Что я получу после расчёта?', a: 'Вы получите готовую схему хранения под ваши размеры и выбранные вещи. В результате будут показаны зоны хранения, назначение и точные размеры каждого блока, рекомендации по складыванию вещей и подходящие товары под каждый блок схемы. Это не просто список органайзеров, а конфигурация, которую можно использовать при покупке и организации пространства.' },
    { q: 'Это просто подборка органайзеров?', a: 'Нет. Рекомендуемые товары — только часть результата. Сначала Уместно собирает схему: какие зоны нужны, что где хранить и какой формат подходит для каждой категории вещей. И уже после этого показывает товары под конкретные блоки схемы.' },
    { q: 'Можно ли сохранить результат?', a: 'Да. Итоговую схему можно скачать или отправить себе на почту, чтобы вернуться к ней перед покупкой органайзеров или при организации хранения.' },
    { q: 'Нужно ли точно считать все вещи?', a: 'Нет, пересчитывать каждую вещь до штуки не нужно. В калькуляторе для каждого типа вещей будут свои понятные диапазоны: мало / средне / много с указанием количества. Например, для носков это будет количество пар, для белья — количество штук, для маек — примерное количество сложенных вещей. Вы выбираете ближайший вариант, а система использует его для расчёта зоны, формата хранения и вместимости.' },
    { q: 'Нужно ли знать точные размеры ящика?', a: 'Да, лучше указать внутренние размеры пространства: ширину, глубину и полезную высоту. Важно измерять именно внутреннюю часть, а не внешние размеры мебели. Особенно важна высота: если её не учесть, органайзер может мешать закрытию. Если точных размеров пока нет, можно сделать расчёт на базе примерных размеров, но перед покупкой товаров лучше сверить их с реальными замерами.' },
    { q: 'В чём разница между режимами расчёта?', a: '«Удобно» направлен на то, чтобы вещи было проще видеть и доставать. «Вместительно» — чтобы использовать пространство максимально плотно. «Экономично» — чтобы собрать рекомендации из более простых и доступных вариантов. Режим влияет на то, как система расставляет приоритеты при подборе схемы и товаров.' },
    { q: 'Почему типы вещей и места хранения ограничены?', a: 'Потому что Уместно не делает абстрактных советов «для всего дома сразу». Мы стараемся расширять места применения и типы вещей, но на эффективное тестирование системы уходит определённое время, чтобы результат был гарантированно удачным. Поэтому на первом этапе сервис работает с теми сценариями, в которых мы точно уверены. Так схема получается не общей рекомендацией, а рабочей конфигурацией.' },
    { q: 'Какую систему организации пространства вы используете?', a: 'Перед проектированием конфигуратора мы изучили подходы профессиональных организаторов пространства и известные методики домашнего хранения, включая принципы Мари Кондо, вертикального складывания, группировки вещей и хранения по частоте использования. Уместно не копирует одну систему целиком. Мы переводим лучшие практики в расчётную логику: какие вещи держать рядом, какой формат хранения выбрать, какие зоны сделать доступнее и как собрать всё в одну конфигурацию.' },
    { q: 'Можно ли использовать свои органайзеры?', a: 'Да. Рекомендованные товары помогают быстрее собрать решение, но вы можете использовать похожие органайзеры, если они подходят по размеру, высоте и формату хранения. Главное — сохранить логику схемы: какие блоки нужны, что в них хранить и как они должны работать вместе.' },
    { q: 'Что делать, если схема не подходит?', a: 'Напишите нам на help@umestno-home.ru и расскажите, что именно не сработало: схема выглядит неверно, товар не подходит под блок или результат не совпал с вашими размерами. Мы проверим расчёт вручную. Если ошибка была на стороне Уместно, пересоберём схему или вернём деньги. Чтобы быстрее разобраться, можно приложить фото пространства или скрин результата.' }
  ];
  var faqRoot = document.querySelector('[data-faq]');
  if (faqRoot) {
    var plusSVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5v14"/></svg>';
    var openIdx = 0;
    FAQS.forEach(function (f, i) {
      var item = document.createElement('div');
      item.className = 'u-faq__item' + (i === openIdx ? ' open' : '');
      var num = (i + 1 < 10 ? '0' : '') + (i + 1);
      item.innerHTML =
        '<div class="u-faq__q">' +
          '<div style="display:flex;gap:14px;align-items:baseline">' +
            '<span style="font-family:var(--f-display);font-size:var(--fs-md);color:var(--u-accent);min-width:24px">' + num + '</span>' +
            '<span></span>' +
          '</div>' +
          '<span class="ic">' + plusSVG + '</span>' +
        '</div>' +
        '<div class="u-faq__a"><div class="u-faq__a__inner"></div></div>';
      item.querySelector('.u-faq__q span:last-of-type').textContent = f.q;
      item.querySelector('.u-faq__a__inner').textContent = f.a;
      var ans = item.querySelector('.u-faq__a');
      var inner = item.querySelector('.u-faq__a__inner');
      faqRoot.appendChild(item);
      var setHeight = function () {
        ans.style.maxHeight = item.classList.contains('open') ? inner.scrollHeight + 'px' : '0px';
      };
      item.querySelector('.u-faq__q').addEventListener('click', function () {
        var wasOpen = item.classList.contains('open');
        faqRoot.querySelectorAll('.u-faq__item').forEach(function (it) {
          it.classList.remove('open');
          it.querySelector('.u-faq__a').style.maxHeight = '0px';
        });
        if (!wasOpen) { item.classList.add('open'); setHeight(); }
      });
      setHeight();
    });
    window.addEventListener('resize', function () {
      faqRoot.querySelectorAll('.u-faq__item.open').forEach(function (it) {
        it.querySelector('.u-faq__a').style.maxHeight = it.querySelector('.u-faq__a__inner').scrollHeight + 'px';
      });
    });
  }
})();
