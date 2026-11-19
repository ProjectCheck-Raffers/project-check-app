(function () {
  // Permanent site layout presentation enhancements.
  // Formerly direction-c-trial.js. Behaviour unchanged; trial naming removed.
  // Adds page classification classes and visual enhancements after app.js renders.

  const app = document.getElementById('app');
  if (!app) return;

  const EXACT_EYEBROW_PAGES = {
    'Stage 1 · Building position': { cls: 'dc-page-map', stage: 1, cardSelector: '.container > .card' },
    'Stage 1 · Site boundary': { cls: 'dc-page-map', stage: 1, cardSelector: '.container > .card' },
    'Stage 1 · Client details': { cls: 'dc-page-client', stage: 1, cardSelector: '.container > .card' },
    'Stage 1 complete · Free report': { cls: 'dc-page-report', stage: 1 },
    'Stage 2 complete': { cls: 'dc-page-report', stage: 2 },
    'Stage 2 · Doors & drawing review': { cls: 'dc-page-doorsreview', stage: 2 },
    'Supplier comparison': { cls: 'dc-page-workspace', stage: 0 },
  };

  const ALL_PAGE_CLASSES = [
    'dc-page-question', 'dc-page-map', 'dc-page-client',
    'dc-page-report', 'dc-page-doorsreview', 'dc-page-workspace',
    'dc-page-pricing', 'dc-page-myprojects', 'dc-page-projectworkspace',
    'dc-page-quotations', 'dc-page-stage3', 'dc-page-terms', 'dc-page-privacy',
  ];

  function clearPageClasses() {
    document.body.classList.remove('dc-active', 'dc-stage1-screen', 'dc-stage2-screen');
    ALL_PAGE_CLASSES.forEach(c => document.body.classList.remove(c));
  }

  const HEADER_BANNER_LOGO_SRC = 'assets/project-check-banner-logo.png';
  function syncHeaderLogo() {
    const logo = document.querySelector('.topbar .brand-logo');
    if (!logo) return;
    if (!logo.getAttribute('src').endsWith(HEADER_BANNER_LOGO_SRC)) {
      logo.setAttribute('src', HEADER_BANNER_LOGO_SRC);
    }
  }

  function classify() {
    const eyebrowEl = app.querySelector('.pagehead .eyebrow');
    const eyebrowText = eyebrowEl ? eyebrowEl.textContent.trim() : '';
    const qMatch = eyebrowText.match(/^Stage\s+(1|2)\s+·\s+Question\s+(\d+)\s+of\s+(\d+)/i);
    const s3Match = eyebrowText.match(/^Stage\s+3\s+·/i);

    clearPageClasses();

    let info = null;
    if (qMatch) {
      info = { cls: 'dc-page-question', stage: Number(qMatch[1]) };
    } else if (s3Match) {
      info = { cls: 'dc-page-workspace', stage: 0, stage3: true };
    } else if (Object.prototype.hasOwnProperty.call(EXACT_EYEBROW_PAGES, eyebrowText)) {
      info = EXACT_EYEBROW_PAGES[eyebrowText];
    }

    if (!info) {
      syncHeaderLogo();
      document.querySelectorAll('.nav .dc-nav-active-item').forEach(el => el.classList.remove('dc-nav-active-item'));
      return null;
    }

    document.body.classList.add('dc-active', info.cls);
    if (info.stage === 1) document.body.classList.add('dc-stage1-screen');
    if (info.stage === 2) document.body.classList.add('dc-stage2-screen');
    if (eyebrowText === 'Supplier comparison') document.body.classList.add('dc-page-quotations');
    if (info.stage3) document.body.classList.add('dc-page-stage3');
    syncHeaderLogo();
    return Object.assign({ eyebrowEl, qMatch }, info);
  }

  function ensureProgressLabel(current, total) {
    const progress = app.querySelector('.progressbar');
    if (!progress) return;
    const prev = progress.previousElementSibling;
    if (prev && prev.classList.contains('dc-progress-label')) return;
    const label = document.createElement('div');
    label.className = 'dc-progress-label';
    label.textContent = Math.round((current / total) * 100) + '% complete';
    progress.before(label);
  }

  function ensureBadge(card, stage) {
    if (!card || card.querySelector('.dc-stage-badge')) return;
    const badge = document.createElement('div');
    badge.className = 'dc-stage-badge';
    badge.textContent = stage === 1 ? 'CHECK · STAGE 1 FREE' : 'UNDERSTAND · STAGE 2 FREE';
    const questionContent = card.querySelector('.q-content');
    const heading = (questionContent && questionContent.querySelector('h2')) || card.querySelector('h2');
    if (heading) heading.before(badge);
    else card.prepend(badge);
  }

  function reorderIllustration(card) {
    const questionContent = card.querySelector('.q-content');
    const illustration = card.querySelector(':scope > .q-illustration');
    const actions = questionContent && questionContent.querySelector(':scope > .actions');
    if (questionContent && illustration && actions) actions.before(illustration);
  }

  const REPORT_CARD_TONE = {
    'Industrial building reference visual': 'white',
    'Project summary': 'green-soft',
    'Building specification (customer-supplied)': 'white',
    'Site & footprint information': 'white',
    'Planning position — at Stage 1 level': 'white',
    'Civils & site observations — at Stage 1 level': 'white',
    'Engineering & Compliance — preliminary flags': 'white',
    'Other preliminary flags': 'white',
    'Assumptions / information not yet established': 'amber',
    'Recommended next actions': 'green-strong',
    'Preliminary building illustration': 'white',
    'What Stage 2 will investigate': 'green-strong',
    'Deeper risks': 'white',
    'Recommended actions': 'white',
    'Evidence-based observations': 'green-soft',
    'Planning': 'white',
    'Review & position doors': 'white',
    'Compare suppliers before you commit': 'green-strong',
  };

  function tagReportCards() {
    app.querySelectorAll('.card').forEach(card => {
      const heading = card.querySelector('h3, h2');
      const tone = heading && REPORT_CARD_TONE[heading.textContent.trim()];
      if (tone) card.classList.add('dc-tone-' + tone);
    });
  }

  const STAGE1_DISCIPLINE_SECTIONS = {
    'Planning position — at Stage 1 level': { number: '01', label: 'Planning' },
    'Civils & site observations — at Stage 1 level': { number: '02', label: 'Civils & site' },
    'Engineering & Compliance — preliminary flags': { number: '03', label: 'Engineering & compliance' },
  };

  function enhanceStage1Disciplines() {
    app.querySelectorAll('.card').forEach(card => {
      const h3 = card.querySelector('h3');
      const info = h3 && STAGE1_DISCIPLINE_SECTIONS[h3.textContent.trim()];
      if (!info) return;
      card.classList.add('dc-tone-discipline');
      if (!card.querySelector('.dc-discipline-head')) {
        const head = document.createElement('div');
        head.className = 'dc-discipline-head';
        head.innerHTML = '<span class="dc-discipline-number">' + info.number + '</span>'
          + '<span class="dc-discipline-label">' + info.label + '</span>';
        h3.before(head);
      }
      if (!card.querySelector('.dc-discipline-status')) {
        const status = document.createElement('span');
        status.className = 'dc-discipline-status';
        status.textContent = 'Preliminary';
        card.appendChild(status);
      }
    });
  }

  function enhanceStage1DrawingBadge() {
    app.querySelectorAll('.card').forEach(card => {
      const h3 = card.querySelector('h3');
      if (!h3 || h3.textContent.trim() !== 'Preliminary building illustration') return;
      if (card.querySelector('.dc-drawing-badge')) return;
      const badge = document.createElement('span');
      badge.className = 'dc-drawing-badge';
      badge.textContent = 'Preliminary · not for construction';
      h3.before(badge);
    });
  }

  const DOORSREVIEW_CARD_TONE = { 'Basic geometry check': 'green-soft', 'Doors': 'white', 'Confirm drawing': 'green-strong' };

  function tagDoorsReviewCards() {
    const cards = app.querySelectorAll('.container > .card');
    cards.forEach((card, i) => {
      const h3 = card.querySelector('h3');
      const title = h3 && h3.textContent.trim();
      const isDrawingCard = i === 0 && !h3;
      const isPositionCard = title && /^Position\s/.test(title);
      const tone = isDrawingCard || isPositionCard ? 'white' : (title && DOORSREVIEW_CARD_TONE[title]) || 'white';
      card.classList.add('dc-tone-' + tone);
    });
  }

  function setNavActive(eyebrowText) {
    document.querySelectorAll('.nav .dc-nav-active-item').forEach(el => el.classList.remove('dc-nav-active-item'));
    const target = eyebrowText === 'Business & pricing'
      ? document.querySelector('.nav button[data-route="pricing"]')
      : document.querySelector('.nav #projectsBtn');
    if (target) target.classList.add('dc-nav-active-item');
  }

  function enhance() {
    const info = classify();
    if (!info) return;
    setNavActive(info.eyebrowEl ? info.eyebrowEl.textContent.trim() : '');

    if (info.cls === 'dc-page-question') {
      ensureProgressLabel(Number(info.qMatch[2]), Number(info.qMatch[3]));
      const card = app.querySelector('.stage-layout > .card');
      if (card) {
        ensureBadge(card, info.stage);
        reorderIllustration(card);
      }
    } else if (info.cardSelector) {
      const card = app.querySelector(info.cardSelector);
      if (card) ensureBadge(card, info.stage);
    } else if (info.cls === 'dc-page-report') {
      tagReportCards();
      if (info.stage === 1) {
        enhanceStage1Disciplines();
        enhanceStage1DrawingBadge();
      }
    } else if (info.cls === 'dc-page-doorsreview') {
      tagDoorsReviewCards();
    }
  }

  let queued = false;
  const observer = new MutationObserver(function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      enhance();
    });
  });

  observer.observe(app, { childList: true, subtree: true });
  enhance();
})();
