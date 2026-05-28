/* Яндекс.Метрика — счётчик 109478352.
   Загружается на всех страницах при загрузке DOM.
   ── Цели ─────────────────────────────────────────────
   Элементы с атрибутом data-ym-goal="<имя>" по клику
   отправляют reachGoal(имя). Формы с data-ym-goal-submit
   отправляют по сабмиту. FAQ-аккордеон ловится отдельно
   (он рендерится JS-ом, атрибут проставить заранее нельзя). */
(function () {
  var YM_ID = 109478352;
  function load() {
    if (window.ym && typeof window.ym === 'function') return;
    (function (m, e, t, r, i) {
      m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
      m[i].l = 1 * new Date();
      for (var j = 0; j < document.scripts.length; j++) { if (document.scripts[j].src === r) { return; } }
      var k = e.createElement(t), a = e.getElementsByTagName(t)[0];
      k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
    })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js?id=' + YM_ID, 'ym');
    window.ym(YM_ID, 'init', {
      ssr: true, webvisor: true, clickmap: true,
      ecommerce: 'dataLayer',
      referrer: document.referrer, url: location.href,
      accurateTrackBounce: true, trackLinks: true
    });
  }

  function reachGoal(name) {
    if (!name) return;
    if (window.ym) window.ym(YM_ID, 'reachGoal', name);
  }

  function bindGoals() {
    // Клик на элементах с data-ym-goal (работает и для вложенных <svg> и т.п.)
    document.addEventListener('click', function (e) {
      var el = e.target && e.target.closest && e.target.closest('[data-ym-goal]');
      if (el) reachGoal(el.getAttribute('data-ym-goal'));
      // FAQ — раскрытие любого вопроса
      var faq = e.target && e.target.closest && e.target.closest('[data-faq] .u-faq__q');
      if (faq) reachGoal('faq_open');
    }, { capture: true });

    // Сабмит формы с data-ym-goal-submit
    document.addEventListener('submit', function (e) {
      var form = e.target && e.target.getAttribute && e.target.getAttribute('data-ym-goal-submit');
      if (form) reachGoal(form);
    }, { capture: true });
  }

  function init() { load(); bindGoals(); }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
