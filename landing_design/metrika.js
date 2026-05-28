/* Яндекс.Метрика — счётчик 109478352.
   Загружается на всех страницах при загрузке DOM. */
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
  if (document.readyState !== 'loading') load();
  else document.addEventListener('DOMContentLoaded', load);
})();
