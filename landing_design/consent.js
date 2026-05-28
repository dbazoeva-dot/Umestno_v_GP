/* Cookie-consent + ленивая загрузка аналитики.
   Яндекс.Метрика стартует ТОЛЬКО после явного согласия (essential+analytics).
   Выбор хранится в localStorage. Открыть настройки повторно — функция
   `umestnoCookieSettings()` (вызывается из подвала). */
(function () {
  var KEY = 'umestno-consent-v1';
  var YM_ID = 109478352;

  function getConsent() {
    try {
      var s = localStorage.getItem(KEY);
      return s ? JSON.parse(s) : null;
    } catch (e) { return null; }
  }
  function setConsent(obj) {
    try { localStorage.setItem(KEY, JSON.stringify(Object.assign({}, obj, { ts: Date.now() }))); }
    catch (e) { /* приватный режим / закрытый storage — ну и ладно */ }
  }

  // Загрузить Метрику ровно тем сниппетом, что выдаёт сам Яндекс.
  function loadMetrika() {
    if (window.ym && typeof window.ym === 'function') return; // уже загружена
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

  function applyConsent(c) {
    if (c && c.analytics) loadMetrika();
  }

  // Понять, какая у нас глубина URL, чтобы корректно сослаться на /privacy/.
  function privacyHref() {
    var path = location.pathname.replace(/^\/+|\/+$/g, '');
    var segments = path ? path.split('/').filter(function (s) { return s && !/\.html?$/i.test(s); }) : [];
    var depth = segments.length;
    if (depth === 0) return '/privacy/';
    return new Array(depth + 1).join('../') + 'privacy/';
  }

  function showBanner() {
    if (document.querySelector('.u-cookie')) return;
    var bar = document.createElement('div');
    bar.className = 'u-cookie';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Согласие на использование cookies');
    bar.innerHTML =
      '<div class="u-cookie__text">' +
        'Мы используем cookies, чтобы сайт работал корректно, и собираем обезличенную аналитику посещений. ' +
        'Подробности — в <a href="' + privacyHref() + '">Политике конфиденциальности</a>.' +
      '</div>' +
      '<div class="u-cookie__btns">' +
        '<button type="button" data-act="essential">Только необходимые</button>' +
        '<button type="button" data-act="all" class="primary">Принять все</button>' +
      '</div>';
    document.body.appendChild(bar);
    bar.addEventListener('click', function (e) {
      var act = e.target && e.target.getAttribute && e.target.getAttribute('data-act');
      if (!act) return;
      var consent = { essential: true, analytics: act === 'all' };
      setConsent(consent);
      applyConsent(consent);
      bar.remove();
    });
  }

  // Глобальная функция для ссылки «Настройки cookies» в подвале.
  window.umestnoCookieSettings = function () {
    var existing = document.querySelector('.u-cookie');
    if (existing) existing.remove();
    showBanner();
  };

  function init() {
    var c = getConsent();
    if (!c) showBanner(); else applyConsent(c);
  }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
