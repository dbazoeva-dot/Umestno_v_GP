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

  /* ── Result: reveal e-mail field on click, then "send" ── */
  document.querySelectorAll('[data-mail-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var wrap = btn.closest('.u-res-mail');
      if (!wrap) return;
      btn.hidden = true;
      var form = wrap.querySelector('[data-mail-form]');
      if (form) {
        form.hidden = false;
        var inp = form.querySelector('input');
        if (inp) inp.focus();
      }
    });
  });
  document.querySelectorAll('[data-mail-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      // TODO: wire to a mailing service (Formspree / EmailJS / backend) — none connected yet
      var wrap = form.closest('.u-res-mail');
      form.hidden = true;
      if (wrap) {
        var done = wrap.querySelector('.u-res-mail__done');
        if (done) done.hidden = false;
      }
    });
  });

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
    var compareEl = slide.querySelector('.u-review-slide__compare');
    var baImg = el.bfr ? el.bfr.closest('.u-review-slide__img') : null;
    var baMq = window.matchMedia('(max-width: 768px)');
    var setBaH = function () {
      if (!compareEl || !baImg) return;
      var h = baImg.offsetHeight - 58;
      if (h > 80) compareEl.style.setProperty('--ba-h', h + 'px');
    };
    var resetBa = function () {
      if (!compareEl) return;
      compareEl.style.setProperty('--ba', '50%');
      compareEl.style.setProperty('--ban', '1');
      setBaH();
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
      resetBa();
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
      /* on mobile the compare IS the before/after slider, so don't
         hijack horizontal drags for review switching there */
      if (!baMq.matches && Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) { go(dx < 0 ? 1 : -1); }
      startX = startY = null;
    }, { passive: true });

    /* before/after drag slider (mobile) */
    if (compareEl) {
      var baDragging = false;
      var setBa = function (clientX) {
        var rect = compareEl.getBoundingClientRect();
        var x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        compareEl.style.setProperty('--ba', (x * 100).toFixed(1) + '%');
        /* show the caption of the dominant side; fade the other out */
        compareEl.style.setProperty('--ban', x <= 0.5 ? '1' : '0');
      };
      compareEl.addEventListener('pointerdown', function (e) {
        if (!baMq.matches) return;
        baDragging = true; setBa(e.clientX);
      });
      window.addEventListener('pointermove', function (e) { if (baDragging) setBa(e.clientX); });
      window.addEventListener('pointerup', function () { baDragging = false; });
      window.addEventListener('pointercancel', function () { baDragging = false; });
      window.addEventListener('resize', setBaH);
      window.addEventListener('load', setBaH);
      requestAnimationFrame(setBaH);
    }

    render();
  }

  /* ── Steps timeline: fill the rail + light up nodes on scroll ── */
  var stepsTrack = document.querySelector('.u-steps--4');
  if (stepsTrack) {
    var stepCards = Array.prototype.slice.call(stepsTrack.querySelectorAll('.u-step-card'));
    var railInset = 24;   /* matches ::before/::after top/bottom inset */
    var updateSteps = function () {
      var rect = stepsTrack.getBoundingClientRect();
      var anchor = window.innerHeight * 0.55;   /* progress reaches here */
      var fill = anchor - (rect.top + railInset);
      var maxFill = rect.height - railInset * 2;
      fill = Math.max(0, Math.min(maxFill, fill));
      stepsTrack.style.setProperty('--steps-progress', fill + 'px');
      stepCards.forEach(function (c) {
        var node = c.querySelector('.u-step-card__num');
        var nr = node.getBoundingClientRect();
        c.classList.toggle('is-reached', (nr.top + nr.height / 2) <= anchor);
      });
    };
    updateSteps();
    window.addEventListener('scroll', function () {
      window.requestAnimationFrame(updateSteps);
    }, { passive: true });
    window.addEventListener('resize', updateSteps);
  }

  /* ── config2 CTA: in the form on desktop, a footer on mobile ── */
  var cfg = document.querySelector('.u-config2');
  var cfgForm = document.querySelector('.u-config2__form');
  var cfgCta = document.querySelector('.u-config2__cta-area');
  if (cfg && cfgForm && cfgCta) {
    var cfgMq = window.matchMedia('(max-width: 900px)');
    var placeCta = function () {
      if (cfgMq.matches) {
        if (cfgCta.parentNode !== cfg) cfg.appendChild(cfgCta);
        cfgCta.classList.add('is-footer');
      } else {
        if (cfgCta.parentNode !== cfgForm) cfgForm.appendChild(cfgCta);
        cfgCta.classList.remove('is-footer');
      }
    };
    placeCta();
    cfgMq.addEventListener('change', placeCta);
  }

  /* ── config2 «assembly» animation (scroll-triggered, once) ── */
  var c2 = document.querySelector('.u-config2');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (c2 && !reduceMotion && 'IntersectionObserver' in window) {
    c2.classList.add('anim-armed');

    // 1) size fields are "typed in" one after another, digit by digit
    var sizeInputs = Array.prototype.slice.call(c2.querySelectorAll('[data-dim]'));
    var rmetaEl = c2.querySelector('[data-rmeta]');
    var sizesWrap = c2.querySelector('.u-config2__sizes');
    var sizeTargets = sizeInputs.map(function (inp) { return String(parseInt(inp.value, 10) || 0); });
    sizeInputs.forEach(function (inp) { inp.value = ''; });
    if (rmetaEl) rmetaEl.textContent = '';
    var countPlayed = false;
    var playCount = function () {
      if (countPlayed) return; countPlayed = true;
      var charMs = 110, fieldGapMs = 180, clock = 0;
      sizeInputs.forEach(function (inp, idx) {
        var str = sizeTargets[idx];
        var wrap = inp.parentNode;
        for (var k = 1; k <= str.length; k++) {
          (function (k) {
            setTimeout(function () {
              inp.value = str.slice(0, k);
              wrap.classList.add('is-filling');
            }, clock + k * charMs);
          })(k);
        }
        clock += str.length * charMs;
        // field done: drop the glow, advance the live meta
        (function (idx, at) {
          setTimeout(function () {
            sizeInputs[idx].parentNode.classList.remove('is-filling');
            if (rmetaEl) rmetaEl.textContent = sizeTargets.slice(0, idx + 1).join('×');
          }, at);
        })(idx, clock);
        clock += fieldGapMs;
      });
    };

    // 2) result assembles: scheme, then product cards 01→04
    var schema = c2.querySelector('.u-config2__schema');
    var resultEl = c2.querySelector('.u-config2__result');
    var prCards = Array.prototype.slice.call(c2.querySelectorAll('.u-config2__pr-card'));
    var revealPlayed = false;
    var playReveal = function () {
      if (revealPlayed) return; revealPlayed = true;
      if (schema) setTimeout(function () { schema.classList.add('is-in'); }, 80);
      prCards.forEach(function (card, i) {
        setTimeout(function () { card.classList.add('is-in'); }, 280 + i * 150);
      });
    };

    var observe = function (target, cb) {
      if (!target) { cb(); return; }
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { io.disconnect(); cb(); } });
      }, { threshold: 0.3 });
      io.observe(target);
    };
    observe(sizesWrap, playCount);
    observe(resultEl, playReveal);

    // mobile connector: the bead rides up/down the rail with the scroll
    var divider = c2.querySelector('.u-config2__divider');
    if (divider && window.matchMedia('(max-width: 900px)').matches) {
      var DOT = 11, PAD = 6;
      var syncBead = function () {
        var r = divider.getBoundingClientRect();
        var vh = window.innerHeight || document.documentElement.clientHeight;
        var prog = (vh - r.top) / (vh + r.height);
        prog = Math.max(0, Math.min(1, prog));
        var travel = Math.max(0, r.height - PAD * 2 - DOT);
        divider.style.setProperty('--c2-dot', (PAD + prog * travel) + 'px');
        divider.classList.toggle('is-active', r.top < vh && r.bottom > 0);
      };
      syncBead();
      window.addEventListener('scroll', function () { window.requestAnimationFrame(syncBead); }, { passive: true });
      window.addEventListener('resize', syncBead);
    }
  }

  /* ── Result checklist: reveal rows + checks on scroll (mobile) ── */
  var rcards = document.querySelector('.u-result-cards');
  if (rcards && !reduceMotion && 'IntersectionObserver' in window &&
      window.matchMedia('(max-width: 768px)').matches) {
    rcards.classList.add('reveal-armed');
    var rio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); rio.unobserve(en.target); }
      });
    }, { threshold: 0.35 });
    rcards.querySelectorAll('.u-result-card').forEach(function (c) { rio.observe(c); });
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
