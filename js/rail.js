// Section rail on the left of the page.
// 1. Highlights the section you are reading.
// 2. Fills the track to show how far down the page you are.
// Clicking a link jumps to that section (plain anchor links; smooth scrolling comes from the CSS).
(function () {
  var links = Array.prototype.slice.call(document.querySelectorAll('.rail a[data-target]'));
  var fill = document.querySelector('.rail-fill');
  var targets = links.map(function (a) { return document.getElementById(a.dataset.target); });

  function update() {
    var y = window.scrollY + window.innerHeight * 0.35;   // a point a third of the way down the screen
    var active = 0;
    targets.forEach(function (el, i) { if (el && el.offsetTop <= y) active = i; });
    // at the very bottom, the last section (Sources) is the one being read
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) active = targets.length - 1;
    links.forEach(function (a, i) { a.classList.toggle('active', i === active); });

    var max = document.body.scrollHeight - window.innerHeight;
    fill.style.height = (max > 0 ? Math.min(1, window.scrollY / max) * 100 : 0) + '%';
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  window.addEventListener('load', update);   // charts change the page height once they are drawn
  update();
})();
