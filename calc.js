// Уместно — конфигуратор (configure) interactivity. Vanilla, no framework.
(function () {
  'use strict';

  // Категории и подписи объёма берём из UMESTNO_CONTENT (landing_design/content-labels.js).
  // engine.max_items = 4 → MAX_ROWS = 4.
  var MAX_ROWS = 4;
  var VOLUME_LEVELS = ['small', 'medium', 'large'];

  // Состояние применённого промокода. Заполняется блоком u-promo
  // ниже (live-валидация через POST /api/promo/check). Используется
  // в collectPayload(): если valid=true, отправляется promo_code в
  // /api/calculate, где сервер ещё раз валидирует и применяет.
  // Базовая цена в копейках — fallback на 14900₽; реальное значение
  // приходит в ответе /api/promo/check (base_price_kop) при первом
  // успешном превью. Если юзер не открыл блок промо — цена не
  // меняется, текст кнопки остаётся «149 ₽».
  var BASE_PRICE_KOP = 14900;
  var promoState = { code: null, valid: false, discount_type: null, final_amount_kop: null };

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

  /* ── Prefill формы из существующего расчёта (?t=TOKEN) ──── */
  // Пользователь пришёл с /no-fit/?t=… (после «Вернуться к расчёту»)
  // или, в будущем, с /result/?t=… (после «Изменить параметры»).
  // Подтягиваем input через GET /api/result/:token и подставляем в
  // поля, чтобы не пере-вводить руками. Чекбокс оферты намеренно
  // оставляем пустым — каждый расчёт = отдельное согласие (152-ФЗ).
  (function () {
    var params = new URLSearchParams(location.search);
    var token = params.get('t') || params.get('token');
    if (!token || !itemsRoot) return;

    function fromEngineCt(ct) { return ct === 'socks_regular' ? 'socks' : ct; }

    fetch('/api/result/' + encodeURIComponent(token), { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (payload) {
        var input = payload && payload.input;
        if (!input) return;

        if (input.drawer) {
          ['w','d','h'].forEach(function (k) {
            var inp = document.querySelector('[data-dim="' + k + '"]');
            if (inp && input.drawer[k + '_cm']) inp.value = input.drawer[k + '_cm'];
          });
          // снимаем подсветку преcета — введённые размеры могли не совпадать ни с одним
          document.querySelectorAll('.u-calc__preset').forEach(function (p) { p.classList.remove('is-on'); });
        }

        if (Array.isArray(input.items) && input.items.length > 0) {
          itemsRoot.innerHTML = input.items
            .slice(0, MAX_ROWS)
            .map(function (it) { return rowHTML(fromEngineCt(it.content_type), it.volume_level); })
            .join('');
          refresh();
        }

        if (input.priority) {
          var btn = document.querySelector('.u-calc__pri-btn[data-priority="' + input.priority + '"]');
          if (btn) btn.click();
        }
      })
      .catch(function (e) { console.warn('[prefill] failed', e); });
  })();

  /* ── Submit: показать модалку email → POST /api/calculate → редирект ──
   *
   * Раньше /configure/ сразу слал /api/calculate. Теперь email и согласие
   * с Политикой обработки ПДн собираются модалкой ПЕРЕД отправкой формы —
   * чтобы в /api/calculate уже уйти с заполненным customer.email для
   * фискального чека ЮКассы и записать оба согласия (оферта + ПДн).
   */
  var cta = document.querySelector('.u-calc__cta');

  /* Сброс is-loading после возврата из bfcache (back-forward cache).
   * Когда юзер уходит в ЮКассу и жмёт «назад» в браузере, страница
   * восстанавливается из bfcache ровно в том состоянии, где её
   * оставили — с залоченной кнопкой (dataset.loading='1'). Это
   * приводило к UX-багу: невозможно нажать «Получить расчёт» ещё раз
   * после неудачной/отменённой оплаты. Стандартный паттерн — слушать
   * pageshow.persisted, событие срабатывает только на bfcache-restore. */
  window.addEventListener('pageshow', function (ev) {
    if (!ev.persisted) return;
    if (cta) {
      cta.dataset.loading = '';
      cta.classList.remove('is-loading');
    }
  });

  if (cta) {
    cta.addEventListener('click', function (e) {
      e.preventDefault();
      if (cta.dataset.loading === '1') return;

      var payload = collectPayload();
      var err = validatePayload(payload);
      if (err) { showCalcError(err); return; }

      hideCalcError();
      openEmailModal(payload);
    });
  }

  function submitCalculation(payload) {
    cta.dataset.loading = '1';
    cta.classList.add('is-loading');

    fetch('/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'same-origin'
    })
        .then(function (r) {
          if (r.ok) return r.json();
          // Парсим тело, чтобы достать error-код (rate_limited / consent_required / …)
          return r.json().catch(function () { return {}; }).then(function (body) {
            var e = new Error('http_' + r.status);
            e.status = r.status;
            e.body = body || {};
            throw e;
          });
        })
        .then(function (data) {
          if (!data || !data.token) throw new Error('bad_response');
          var fit = data.fit_status;
          var ok = fit === 'fit_all' || fit === 'fit_all_after_adjustment';

          // Метрика-цели по результату /api/calculate:
          //   calc_submitted — успешный сабмит (получили token + fit_status)
          //   fit_all / fit_partial / no_scheme — разбивка по исходу
          if (window.UMESTNO_TRACK) {
            try {
              window.UMESTNO_TRACK('calc_submitted');
              if (ok)                       window.UMESTNO_TRACK('fit_all');
              else if (fit === 'fit_partial') window.UMESTNO_TRACK('fit_partial');
              else                          window.UMESTNO_TRACK('no_scheme');
            } catch (_) {}
          }

          // Paywall + fit_all: сервер уже создал YooKassa-платёж и вернул
          // payment_url. Редиректим юзера в ЮКассу; после оплаты вернётся
          // на /result/?t=TOKEN, где поллинг ждёт webhook'а.
          if (ok && data.can_pay && data.payment_url) {
            if (window.UMESTNO_TRACK) {
              try { window.UMESTNO_TRACK('payment_redirect_yookassa'); } catch (_) {}
            }
            location.href = data.payment_url;
            return;
          }

          // Dev-режим (или fit_partial / no_scheme):
          // - fit_all → /result/?t=TOKEN
          // - не fit_all → /no-fit/?t=TOKEN
          var path = ok ? '/result/' : '/no-fit/';
          location.href = path + '?t=' + encodeURIComponent(data.token);
        })
        .catch(function (err) {
          cta.dataset.loading = '';
          cta.classList.remove('is-loading');
          // Различаем «сервер ответил с ошибкой» (err.status есть) и
          // «запрос вообще не дошёл» (err.status отсутствует — это
          // network error, в России чаще всего антивирус/расширение).
          if (!err || !err.status) {
            // Стреляем цель в Метрику чтобы потом увидеть масштаб
            // потерь. Запрос в Метрику обычно проходит даже там, где
            // /api/* блокируется (Метрика whitelist'нута у антивирусов).
            if (window.UMESTNO_TRACK) {
              try { window.UMESTNO_TRACK('calc_request_blocked'); } catch (e) {}
            }
            showCalcError('Запрос не дошёл до сервера. Возможно, его блокирует антивирус или расширение браузера. Добавьте umestno-home.ru в исключения антивируса или попробуйте другой браузер.');
            console.error('[calculate] network error (likely blocked locally)', err);
            return;
          }
          showCalcError(humanizeCalcError(err));
          console.error('[calculate] failed', err);
        });
  }

  /* ── Модалка ввода email ───────────────────────────────────
   * Появляется по клику на «Получить расчёт». Юзер вводит email,
   * ставит галочку на ПДн → submitCalculation с расширенным payload'ом.
   * Закрытие — Esc, клик по фону, или крестик. */
  function openEmailModal(basePayload) {
    var existing = document.getElementById('u-email-modal');
    if (existing) existing.remove();

    if (window.UMESTNO_TRACK) {
      try { window.UMESTNO_TRACK('email_modal_open'); } catch (_) {}
    }

    var modal = document.createElement('div');
    modal.id = 'u-email-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(58,56,47,0.45);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;font-family:var(--f-sans,sans-serif);';

    modal.innerHTML =
      '<div role="dialog" aria-modal="true" aria-labelledby="u-email-modal-title" ' +
           'style="background:#FFFDF9;border-radius:14px;max-width:440px;width:100%;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,0.18);position:relative">' +
        '<button type="button" data-close aria-label="Закрыть" ' +
                'style="position:absolute;top:14px;right:14px;background:none;border:none;cursor:pointer;color:#7A6F58;font-size:22px;line-height:1;padding:4px 8px">×</button>' +
        '<h2 id="u-email-modal-title" ' +
            'style="font-family:var(--f-display,serif);font-size:22px;font-weight:500;color:#3A382F;margin:0 0 8px">Куда отправить чек и схему</h2>' +
        '<p style="font-size:13px;color:#7A6F58;margin:0 0 18px;line-height:1.45">Почта нужна для направления чека и итогового результата. Никакого спама.</p>' +
        '<form data-email-form novalidate>' +
          '<input type="email" data-email-input required autocomplete="email" inputmode="email" ' +
                 'placeholder="you@example.com" aria-label="E-mail" ' +
                 'style="width:100%;padding:11px 13px;border:1px solid #DDC59B;border-radius:8px;font-size:15px;color:#3A382F;background:#FFFDF9;box-sizing:border-box;margin-bottom:14px;font-family:inherit" />' +
          '<div class="u-consent" style="display:flex;gap:10px;align-items:flex-start;margin-bottom:18px">' +
            '<input type="checkbox" data-pd-checkbox id="u-pd-consent" required style="margin-top:3px;flex-shrink:0" />' +
            '<label for="u-pd-consent" style="font-size:13px;color:#7A6F58;line-height:1.4;cursor:pointer">' +
              'Я соглашаюсь на обработку персональных данных в соответствии с ' +
              '<a href="../privacy/" target="_blank" rel="noopener" style="color:#7D8C72;text-decoration:underline">Политикой конфиденциальности</a>.' +
            '</label>' +
          '</div>' +
          '<p data-email-error hidden style="color:#B36A4A;font-size:13px;margin:0 0 12px;line-height:1.4"></p>' +
          '<button type="submit" class="u-btn u-btn--accent u-btn--lg" style="width:100%;background-color:rgb(125,140,114)">Продолжить</button>' +
        '</form>' +
      '</div>';

    document.body.appendChild(modal);

    var form = modal.querySelector('[data-email-form]');
    var emailInput = modal.querySelector('[data-email-input]');
    var pdCheckbox = modal.querySelector('[data-pd-checkbox]');
    var errEl = modal.querySelector('[data-email-error]');

    function showErr(msg) {
      if (!errEl) return;
      errEl.textContent = msg;
      errEl.hidden = false;
    }
    function clearErr() { if (errEl) { errEl.hidden = true; errEl.textContent = ''; } }

    function close() {
      document.removeEventListener('keydown', onKeydown);
      modal.remove();
    }
    function onKeydown(ev) {
      if (ev.key === 'Escape') close();
    }
    document.addEventListener('keydown', onKeydown);

    modal.addEventListener('click', function (ev) {
      if (ev.target === modal) close();           // клик по затемнённому фону
      if (ev.target.matches('[data-close]')) close(); // крестик
    });

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      clearErr();
      var email = (emailInput.value || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        showErr('Введите корректный e-mail.');
        emailInput.focus();
        return;
      }
      if (!pdCheckbox.checked) {
        showErr('Нужно согласие на обработку персональных данных, чтобы прислать чек.');
        return;
      }
      var fullPayload = Object.assign({}, basePayload, {
        email: email,
        consent_personal_data: true,
      });
      if (window.UMESTNO_TRACK) {
        try { window.UMESTNO_TRACK('email_modal_submit'); } catch (_) {}
      }
      close();
      submitCalculation(fullPayload);
    });

    // Фокус на email-поле через тик после рендера — чтобы клавиатура
    // на мобиле раскрылась сразу.
    setTimeout(function () { try { emailInput.focus(); } catch (e) {} }, 50);
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
    var p = {
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
    // Промокод — только если прошёл live-валидацию через /api/promo/check.
    // Без этой проверки серверу всё равно отдадим, но фронт не будет
    // показывать пересчитанную цену пользователю.
    if (promoState.valid && promoState.code) p.promo_code = promoState.code;
    return p;
  }

  function validatePayload(p) {
    if (!(p.drawer_width_cm > 0) || !(p.drawer_depth_cm > 0) || !(p.drawer_height_cm > 0))
      return 'Укажите размеры ящика (ширина, глубина, высота) в сантиметрах.';
    if (!p.items.length) return 'Выберите хотя бы одну категорию и объём.';
    if (!p.priority) return 'Выберите приоритет (удобно / вместительно / экономично).';
    if (!p.consent_oferta) return 'Подтвердите согласие с офертой, чтобы продолжить.';
    return null;
  }

  function humanizeCalcError(err) {
    var code = err && err.body && err.body.error;
    if (code === 'rate_limited') {
      var perMin = err.body.scope === 'per_minute';
      return perMin
        ? 'Слишком много запросов за минуту. Попробуйте ещё раз через минуту.'
        : 'Превышен часовой лимит запросов. Попробуйте позже.';
    }
    if (code === 'forbidden_origin') return 'Запрос отклонён. Попробуйте перезагрузить страницу.';
    if (code === 'consent_required' || code === 'consent_oferta_required') return 'Подтвердите согласие с офертой, чтобы продолжить.';
    if (code === 'consent_pd_required') return 'Подтвердите согласие на обработку персональных данных.';
    if (code === 'invalid_request')  return 'Проверьте, что все поля формы заполнены корректно.';
    if (code === 'invalid_promo_code') {
      var reason = err.body && err.body.reason;
      if (reason === 'expired')        return 'Срок действия промокода истёк.';
      if (reason === 'exhausted')      return 'Лимит использований промокода исчерпан.';
      if (reason === 'inactive')       return 'Промокод отключён.';
      if (reason === 'not_yet_valid')  return 'Промокод ещё не действует.';
      return 'Промокод не найден. Проверьте написание.';
    }
    return 'Не получилось рассчитать. Проверьте подключение и попробуйте ещё раз.';
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

  /* ── Промокод: раскрывашка + live-валидация + пересчёт цены ─
   * Юзер кликает «Есть промокод?» → раскрывается поле → вводит код →
   * с debounce 400 мс шлём POST /api/promo/check → красим бордюр поля
   * (зелёный/красный) + текст под полем + обновляем цену в кнопке.
   *
   * Состояние применённого кода живёт в promoState (модульно).
   * collectPayload() читает оттуда и кладёт promo_code в /api/calculate.
   * Реальное применение и инкремент uses_count — на бэкенде, в той же
   * транзакции что INSERT order (см. server/api/calculate.ts).
   */
  (function () {
    var block   = document.querySelector('[data-promo-block]');
    if (!block) return;
    var toggle  = block.querySelector('[data-promo-toggle]');
    var panel   = block.querySelector('[data-promo-panel]');
    var input   = block.querySelector('[data-promo-input]');
    var clearBt = block.querySelector('[data-promo-clear]');
    var msg     = block.querySelector('[data-promo-msg]');
    var ctaPrice = document.querySelector('[data-cta-price]');
    if (!toggle || !panel || !input || !ctaPrice) return;

    // Дефолт текста цены — фиксируем чтобы откатить при сбросе.
    var DEFAULT_PRICE_HTML = ctaPrice.innerHTML;

    function fmtRub(kop) {
      var rub = Math.round(kop / 100);
      return rub.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
    }

    function updateCtaPrice(finalKop, type) {
      if (finalKop === 0) {
        ctaPrice.innerHTML = '<b>бесплатно</b>';
      } else if (finalKop < BASE_PRICE_KOP) {
        ctaPrice.innerHTML =
          '<span data-cta-price-old>' + fmtRub(BASE_PRICE_KOP) + '</span>' +
          '<b>' + fmtRub(finalKop) + '</b>';
      } else {
        ctaPrice.innerHTML = DEFAULT_PRICE_HTML;
      }
      // 'type' пока не используется для отображения, но оставлен на
      // случай расширения копирайта (например, разные тексты для free/percent).
      void type;
    }

    function resetCta() {
      ctaPrice.innerHTML = DEFAULT_PRICE_HTML;
    }

    function setValid(data) {
      promoState = {
        code: data.code,
        valid: true,
        discount_type: data.discount_type,
        final_amount_kop: data.final_amount_kop,
      };
      if (typeof data.base_price_kop === 'number') BASE_PRICE_KOP = data.base_price_kop;
      input.classList.remove('is-invalid');
      input.classList.add('is-valid');
      clearBt.hidden = false;
      msg.hidden = false;
      msg.classList.remove('is-err');
      msg.classList.add('is-ok');
      if (data.final_amount_kop === 0) {
        msg.textContent = 'Промокод «' + data.code + '» применён · бесплатно';
      } else {
        msg.textContent = 'Промокод «' + data.code + '» применён · ' + fmtRub(data.final_amount_kop);
      }
      updateCtaPrice(data.final_amount_kop, data.discount_type);

      if (window.UMESTNO_TRACK) {
        try { window.UMESTNO_TRACK('promo_applied'); } catch (_) {}
      }
    }

    function setInvalid(reason) {
      promoState = { code: null, valid: false, discount_type: null, final_amount_kop: null };
      input.classList.remove('is-valid');
      input.classList.add('is-invalid');
      clearBt.hidden = false;
      msg.hidden = false;
      msg.classList.remove('is-ok');
      msg.classList.add('is-err');
      var text = 'Промокод не найден.';
      if (reason === 'expired')       text = 'Срок действия промокода истёк.';
      else if (reason === 'exhausted')text = 'Лимит использований исчерпан.';
      else if (reason === 'inactive') text = 'Промокод отключён.';
      else if (reason === 'not_yet_valid') text = 'Промокод ещё не начал действовать.';
      msg.textContent = text;
      resetCta();
    }

    function setNeutral() {
      promoState = { code: null, valid: false, discount_type: null, final_amount_kop: null };
      input.classList.remove('is-valid', 'is-invalid');
      clearBt.hidden = !input.value;
      msg.hidden = true;
      msg.textContent = '';
      msg.classList.remove('is-ok', 'is-err');
      resetCta();
    }

    var checkTimer = null;
    var lastSentValue = null;

    function scheduleCheck() {
      var raw = (input.value || '').trim().toUpperCase();
      // Подкрашиваем поле живьём только когда пользователь явно изменил
      // значение — иначе будут «прыгающие» цвета на каждую клавишу.
      if (raw === lastSentValue) return;
      // Меньше 3 символов — преждевременно ходить на сервер; чистим
      // визуальное состояние, но клавиатуру не блокируем.
      if (raw.length < 3) { setNeutral(); return; }

      if (checkTimer) clearTimeout(checkTimer);
      checkTimer = setTimeout(function () {
        lastSentValue = raw;
        fetch('/api/promo/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: raw }),
          credentials: 'same-origin'
        })
          .then(function (r) { return r.json().catch(function () { return {}; }); })
          .then(function (data) {
            // Если пока запрос шёл, пользователь поменял значение —
            // не накладываем устаревший ответ поверх свежего ввода.
            var current = (input.value || '').trim().toUpperCase();
            if (current !== raw) return;
            if (!data || !data.ok) { setInvalid('not_found'); return; }
            if (data.valid) setValid(data);
            else setInvalid(data.reason);
          })
          .catch(function (err) {
            console.warn('[promo/check] failed', err);
            // Сеть упала — не пугаем юзера красным, оставляем нейтрально.
            // На сабмите сервер всё равно перепроверит.
            setNeutral();
          });
      }, 400);
    }

    toggle.addEventListener('click', function () {
      var open = panel.hidden;
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        try { input.focus(); } catch (e) {}
      }
    });

    input.addEventListener('input', scheduleCheck);
    input.addEventListener('blur', scheduleCheck);

    clearBt.addEventListener('click', function () {
      input.value = '';
      lastSentValue = null;
      setNeutral();
      try { input.focus(); } catch (e) {}
    });
  })();
})();
