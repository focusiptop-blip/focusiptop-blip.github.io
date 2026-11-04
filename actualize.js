/*
 * ASG actualize.js — актуальный домен для плееров ASG на чужих сайтах.
 * Подключение на сайте (один раз, в любом месте страницы):
 *   <script src="https://focusiptop-blip.github.io/actualize.js" async></script>
 * Живёт на GitHub Pages — его почти не блокируют. Копия того же файла раздаётся и самим ASG (/actualize.js).
 *
 * Что делает: среди доменов ASG выбирает первый, который доступен этому зрителю (/ping), и во всех
 * фреймах ASG на странице — и в отложенных (data-src, lazyload), и добавленных позже — меняет домен
 * на него. Путь и параметры (личная ссылка, ?t=…) не трогает: проверки «только на подтверждённых
 * сайтах» работают как прежде, ведь все домены ведут на один и тот же ASG.
 *
 * Заблокировали домен — поставьте рабочий первым в DOMAINS (и добавьте новый, если он появился).
 */
(function () {
  if (window.__asgActualize) return;
  window.__asgActualize = 1;

  // Домены ASG по порядку предпочтения: первый доступный зрителю станет рабочим.
  // Старые (заблокированные) оставляйте в списке — фреймы с ними тоже переведутся на рабочий.
  var DOMAINS = ['asgold.work'];
  // Только домены из списка, только страницы плеера — чужие фреймы не трогаем
  var PATH = /^\/(watch\/\d|embed\/kp\/\d|s\/)/;
  var KEY = 'asg.actualDomain';
  var actual = null;

  function isAsg(u) {
    return u && DOMAINS.indexOf(u.hostname) !== -1 && PATH.test(u.pathname);
  }
  function parse(src) {
    try { return new URL(src, location.href); } catch (e) { return null; }
  }

  // Рабочий домен: из сессии (уже проверяли) или первый, ответивший на /ping за 4 с
  function pick(done) {
    try { var saved = sessionStorage.getItem(KEY); if (saved && DOMAINS.indexOf(saved) !== -1) return done(saved); } catch (e) {}
    if (DOMAINS.length === 1 || !window.fetch) return done(DOMAINS[0]);
    var i = 0;
    (function next() {
      if (i >= DOMAINS.length) return done(DOMAINS[0]);   // никто не ответил — оставляем основной
      var d = DOMAINS[i++];
      var ctl = window.AbortController ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 4000);
      fetch('https://' + d + '/ping', { cache: 'no-store', mode: 'cors', signal: ctl && ctl.signal })
        .then(function (r) { clearTimeout(timer); if (r.ok) { try { sessionStorage.setItem(KEY, d); } catch (e) {} done(d); } else next(); })
        .catch(function () { clearTimeout(timer); next(); });
    })();
  }

  // Один фрейм: src (и data-src у отложенных) — на рабочий домен
  function fix(f) {
    ['src', 'data-src'].forEach(function (attr) {
      var u = parse(f.getAttribute(attr));
      if (!isAsg(u) || u.hostname === actual) return;
      u.hostname = actual;
      f.setAttribute(attr, u.href);
    });
  }
  function scan(root) {
    var list = (root || document).getElementsByTagName('iframe');
    for (var i = 0; i < list.length; i++) fix(list[i]);
  }

  pick(function (d) {
    actual = d;
    scan();
    // Фреймы, которые сайт добавит или поменяет позже (каталоги, «показать ещё», lazyload)
    if (window.MutationObserver) {
      new MutationObserver(function (muts) {
        muts.forEach(function (m) {
          if (m.type === 'attributes') fix(m.target);
          else m.addedNodes.forEach(function (n) {
            if (n.nodeType !== 1) return;
            if (n.tagName === 'IFRAME') fix(n); else scan(n);
          });
        });
      }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'data-src'] });
    } else setInterval(scan, 1000);
  });
})();
