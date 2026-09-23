/*
 * landing.js — behaviour for the hand-authored landing pages in public/.
 *
 * Three things, all optional per page: the playable question demo (answer with
 * no account, rationale and CTA revealed on answer), the sticky mobile CTA, and
 * the school wall. Each guards on its own markup being present, so a page can
 * use any subset. Pairs with css/landing.css.
 *
 * The demo reads the question order from the ids present in the document, so a
 * page with two samples needs no change here.
 */
(function () {
  var counter = document.getElementById('count');
  // Read the order from the document rather than a hardcoded list, so a page
  // with two samples or five needs no change here.
  var questions = [].slice.call(document.querySelectorAll('.q'));
  var total = questions.length;
  var answered = 0;

  function show(el) { el.hidden = false; el.classList.add('reveal'); }

  function finish(q) {
    var opts = q.querySelectorAll('.opt');
    var right = true;
    opts.forEach(function (o) {
      var isCorrect = o.hasAttribute('data-correct');
      var picked = o.getAttribute('aria-pressed') === 'true';
      o.disabled = true;
      if (isCorrect) o.classList.add('correct');
      if (picked && !isCorrect) o.classList.add('picked-wrong');
      if (isCorrect !== picked) right = false;
      if (isCorrect || picked) {
        var tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = isCorrect ? (picked ? 'Your answer' : 'Missed') : 'You picked';
        o.appendChild(tag);
      }
    });
    q.classList.add('done');
    var check = q.querySelector('.check-row');
    if (check) check.hidden = true;

    var rat = q.querySelector('.rat');
    rat.querySelector('.verdict').textContent = right
      ? 'Correct.'
      : (q.dataset.type === 'multi' ? 'Not quite. Select all that apply is scored all or nothing.' : 'Not quite.');
    show(rat);

    var after = q.querySelector('.after');
    if (after) show(after);

    answered++;
    var next = questions[answered];
    if (counter) {
      counter.textContent = next
        ? 'Question ' + (answered + 1) + ' of ' + total
        : 'All ' + total + ' answered';
    }
    if (next) show(next);
  }

  questions.forEach(function (q) {
    var multi = q.dataset.type === 'multi';
    q.querySelectorAll('.opt').forEach(function (o) {
      o.addEventListener('click', function () {
        if (o.disabled) return;
        if (multi) {
          o.setAttribute('aria-pressed', o.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
        } else {
          o.setAttribute('aria-pressed', 'true');
          finish(q);
        }
      });
    });
    var check = q.querySelector('.check');
    if (check) check.addEventListener('click', function () { finish(q); });
  });

  // Sticky bar: appears once the first screen is behind you, hides again when the
  // closing CTA is on screen so two asks are never visible at once. Phone only.
  var dock = document.getElementById('dock');
  var close = document.querySelector('.close');
  if (dock && close) {
  function syncDock() {
    var box = close.getBoundingClientRect();
    var closeVisible = box.top < window.innerHeight && box.bottom > 0;
    dock.classList.toggle('up', window.scrollY > 620 && !closeVisible);
  }
  window.addEventListener('scroll', syncDock, { passive: true });
  syncDock();
  }

  // ---- school wall ----
  // The markup carries ONE copy of each row; three are needed for the translate to
  // loop seamlessly, and shipping them in the HTML would repeat 44 school names
  // three times in the indexable source. Clone instead.
  document.querySelectorAll('.sw-track').forEach(function (track) {
    var one = track.innerHTML;
    track.innerHTML = one + one + one;
    track.querySelectorAll('.sw-item').forEach(function (item, i, all) {
      if (i < all.length / 3) return;
      item.setAttribute('role', 'presentation');
      item.setAttribute('aria-hidden', 'true');
    });
    track.classList.add('looped');
  });

  // A logo is only trusted once it has loaded at a usable size. Nothing can know a
  // remote icon's resolution before the bytes arrive, so the check happens on load:
  // below 32px it is Google's generic globe or a 16px .ico that turns to mush on the
  // tile, and the monogram underneath is left in place. Errors fall back the same way.
  var LOGO_MIN_PX = 32;
  function gateLogo(img) {
    if (img.naturalWidth >= LOGO_MIN_PX) {
      img.classList.add('is-visible');
      img.parentNode.classList.add('has-logo');
    } else {
      img.remove();
    }
  }
  // The 132 requests are held until the band is nearly in view: they are all below
  // the fold and the hero has to paint first. This has to be an observer on the
  // SECTION, not `loading="lazy"` on each img. The chips are laid out far off-screen
  // and brought into view by a CSS transform, and a transform does not make the
  // browser reconsider a lazy image, so most of them never load at all.
  function armLogos() {
    document.querySelectorAll('.sw-logo[data-src]').forEach(function (img) {
      img.addEventListener('load', function () { gateLogo(img); });
      img.addEventListener('error', function () { img.remove(); });
      img.src = img.getAttribute('data-src');
      img.removeAttribute('data-src');
    });
  }
  var band = document.querySelector('.sw-band');
  if (band && typeof IntersectionObserver !== 'undefined') {
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) { armLogos(); io.disconnect(); }
    }, { rootMargin: '300px' });
    io.observe(band);
  } else {
    armLogos();
  }
})();
