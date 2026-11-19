// Ajusta el alto de cada mail a su contenido para que no haya scroll dentro de scroll en el celular.
// Los iframes no ejecutan scripts (sandbox sin allow-scripts); solo se mide su alto desde acá.
(function () {
  function fit(f) {
    var d = f.contentDocument;
    if (!d || !d.documentElement) return;
    var h = Math.max(d.documentElement.scrollHeight, d.body ? d.body.scrollHeight : 0);
    if (h > 0) f.style.height = h + "px";
  }
  function watch(f) {
    var d = f.contentDocument;
    if (!d) return;
    f.style.height = "200px";
    fit(f);
    if ("ResizeObserver" in window && d.body) new ResizeObserver(function () { fit(f); }).observe(d.body);
    Array.prototype.forEach.call(d.images, function (img) { if (!img.complete) img.addEventListener("load", function () { fit(f); }); });
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(function () { fit(f); });
  }
  Array.prototype.forEach.call(document.querySelectorAll("iframe"), function (f) {
    f.addEventListener("load", function () { watch(f); });
    if (f.contentDocument && f.contentDocument.readyState === "complete") watch(f);
  });
  var t;
  window.addEventListener("resize", function () {
    clearTimeout(t);
    t = setTimeout(function () {
      Array.prototype.forEach.call(document.querySelectorAll("iframe"), function (f) { f.style.height = "200px"; fit(f); });
    }, 150);
  });
})();
