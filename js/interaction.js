/* Wellow interaction — 본문 단어를 Press hold 동안 파란 하이라이트(Figma 67:1656) + 뜻 말풍선(67:1677) */
(() => {
  const article = document.getElementById('article');
  const MOVE_TOLERANCE = 8; // 이 이상 움직이면 스크롤로 보고 취소

  // 본문 텍스트 노드를 단어 단위 <span class="word">로 감싸기 (strong 등 서식 유지)
  const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  textNodes.forEach((node) => {
    const parts = node.textContent.split(/(\s+)/);
    if (parts.every((p) => !p.trim())) return;
    const frag = document.createDocumentFragment();
    parts.forEach((part) => {
      if (!part) return;
      if (!part.trim()) {
        frag.appendChild(document.createTextNode(part));
        return;
      }
      // 앞뒤 문장부호는 하이라이트 밖으로
      const [, lead, core, trail] = part.match(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u);
      if (lead) frag.appendChild(document.createTextNode(lead));
      if (core) {
        const span = document.createElement('span');
        span.className = 'word';
        span.textContent = core;
        frag.appendChild(span);
      }
      if (trail) frag.appendChild(document.createTextNode(trail));
    });
    node.replaceWith(frag);
  });

  // Figma 67:1677 — 뜻 말풍선 (본문 안에 두어 스크롤과 함께 움직임)
  const DICT = window.WELLOW_DICT || {};
  const BUBBLE_OFFSET_X = 28; // 단어 왼쪽 → 말풍선 왼쪽 (Figma 27 → 55)
  const BUBBLE_GAP = 7;       // 말풍선 아래 ↔ 단어 위
  const bubble = document.createElement('div');
  bubble.className = 'word-bubble';
  bubble.setAttribute('role', 'status');
  article.appendChild(bubble);

  // 해석 말풍선과 같은 모션: 단어 머리 바로 위의 작은 베이지 원에서 시작해 뜻 말풍선으로 커짐
  let bubbleDot = null;
  function showBubble(word) {
    bubble.getAnimations().forEach((an) => an.cancel());
    bubble.classList.remove('is-open', 'is-below');
    bubble.replaceChildren();
    const inner = document.createElement('span');
    inner.className = 'word-bubble__text';
    inner.textContent = DICT[word.textContent.toLowerCase()] || word.textContent;
    bubble.appendChild(inner);

    const maxLeft = article.clientWidth - bubble.offsetWidth - 8;
    const left = Math.max(8, Math.min(word.offsetLeft + BUBBLE_OFFSET_X, maxLeft));
    let top = word.offsetTop - bubble.offsetHeight - BUBBLE_GAP;
    const below = top < article.scrollTop + 4; // 위가 모자라면 단어 아래로
    if (below) top = word.offsetTop + word.offsetHeight + BUBBLE_GAP;
    bubble.style.left = `${left}px`;
    bubble.style.top = `${top}px`;
    bubble.classList.toggle('is-below', below);

    const full = {
      left: `${left}px`, top: `${top}px`, width: `${bubble.offsetWidth}px`, height: `${bubble.offsetHeight}px`,
      borderRadius: '12px', padding: '10px 14px',
    };
    // 원은 말풍선 자리의 왼쪽 아래 모서리에서 시작 (말풍선이 아래로 뜨면 단어 쪽인 왼쪽 위)
    bubbleDot = cornerDot(left, top, bubble.offsetHeight, below);
    growFromDot(bubble, inner, dotBox(bubbleDot), full);
  }

  function hideBubble() {
    if (!bubble.classList.contains('is-open') || !bubbleDot) return;
    shrinkToDot(bubble, dotBox(bubbleDot));
  }

  // 말풍선 최종 자리의 왼쪽 아래(아래로 뜨면 왼쪽 위) 모서리 안쪽에 원이 놓이도록
  function cornerDot(left, top, height, below) {
    const r = HEAD_DOT / 2;
    return { x: left + r, y: below ? top + r : top + height - r };
  }

  // 공통: 작은 원이 톡 생겼다가 → 말풍선 크기로 커지고 → 글자가 나타남
  function growFromDot(el, inner, dot, full) {
    el.classList.add('is-open');
    el.animate([
      { ...dot, opacity: 0, transform: 'scale(0.3)' },
      { ...dot, opacity: 1, transform: 'scale(1.15)', offset: 0.7 },
      { ...dot, opacity: 1, transform: 'scale(1)' },
    ], { duration: 220, easing: 'cubic-bezier(0.33, 1, 0.68, 1)' }).finished
      .then(() => el.animate([{ ...dot, opacity: 1 }, { ...full, opacity: 1 }], {
        duration: 460, easing: 'cubic-bezier(0.34, 1.2, 0.64, 1)',
      }).finished)
      .catch(() => {});
    inner.animate([{ opacity: 0 }, { opacity: 0, offset: 0.6 }, { opacity: 1 }], { duration: 760, easing: 'ease-out' });
  }

  // 공통: 글자가 먼저 사라지고 → 원으로 줄어들어 → 사라짐
  function shrinkToDot(el, dot) {
    const inner = el.firstElementChild;
    if (inner) inner.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'forwards' });
    const from = {
      left: `${el.offsetLeft}px`, top: `${el.offsetTop}px`,
      width: `${el.offsetWidth}px`, height: `${el.offsetHeight}px`, borderRadius: '12px', padding: '10px 14px',
    };
    el.getAnimations().forEach((an) => an.cancel());
    el.animate([
      { ...from, opacity: 1 },
      { ...dot, opacity: 1, offset: 0.75 },
      { ...dot, opacity: 0, transform: 'scale(0.3)' },
    ], { duration: 360, easing: 'cubic-bezier(0.45, 0, 0.2, 1)' }).finished
      .then(() => el.classList.remove('is-open'))
      .catch(() => {});
  }

  // 단어 상세 카드(Figma 67:1700)
  // Press 한 채 위로 스와이프 → 하이라이트가 떠오르며 페이드아웃 → Wellow 버튼에서 카드가 덜컹 하고 떨어짐
  const DETAIL = window.WELLOW_DETAIL || {};
  const phone = document.querySelector('.phone');
  const pill = document.querySelector('.wellow-pill');
  const card = document.getElementById('wordCard');
  const HOLD_MS = 200;        // 터치: 이만큼 누르고 있으면 스와이프 모드 (그 전 움직임은 스크롤)
  const SWIPE_TRIGGER = 40;   // 위로 이만큼 쓸면 발동
  const FADE_MS = 420;        // 하이라이트가 위로 떠오르며 사라지는 시간
  const FADE_RISE = 36;       // 사라지면서 떠오르는 거리
  const CARD_DELAY = 200;     // 하이라이트가 반쯤 사라졌을 때 카드 등장
  let cardOpen = false;
  let busy = false;           // 애니메이션 중 입력 무시

  function renderCard(text) {
    const key = text.toLowerCase();
    const detail = DETAIL[key] || {};
    document.getElementById('cardWord').textContent = `${text}  :  `;
    document.getElementById('cardMeaning').textContent = `${DICT[key] || text}   `;
    document.getElementById('cardSenses').textContent = (detail.senses || [DICT[key] || text]).join(' ㅣ ');
    document.getElementById('cardChips').replaceChildren(...(detail.synonyms || []).map((t) => {
      const chip = document.createElement('span');
      chip.className = 'word-card__chip';
      chip.textContent = t;
      return chip;
    }));
    document.getElementById('cardSynonyms').hidden = !detail.synonyms;
  }

  // 기기 프레임 축소 비율 (손가락 이동량 · 좌표 보정)
  const scaleOf = () => phone.getBoundingClientRect().height / phone.offsetHeight || 1;
  // 화면 좌표 → .phone 안의 좌표
  function inPhone(rect) {
    const k = scaleOf();
    const pr = phone.getBoundingClientRect();
    return { x: (rect.left - pr.left) / k, y: (rect.top - pr.top) / k, w: rect.width / k, h: rect.height / k };
  }

  // 1) 하이라이트 색 박스만 살짝 떠오르며 페이드아웃 (글자는 본문에 그대로)
  function fadeUp(word) {
    const from = inPhone(word.getBoundingClientRect());
    const ghost = document.createElement('span');
    ghost.className = 'word-ghost';
    ghost.textContent = word.textContent;
    const cs = getComputedStyle(word);
    ghost.style.fontFamily = cs.fontFamily;
    ghost.style.fontSize = cs.fontSize;
    ghost.style.fontWeight = cs.fontWeight;
    ghost.style.left = `${from.x}px`;
    ghost.style.top = `${from.y}px`;
    ghost.style.height = `${from.h}px`;
    ghost.style.lineHeight = `${from.h}px`; // 원래 하이라이트와 같은 높이 · 글자 위치
    phone.appendChild(ghost);
    const anim = ghost.animate([
      { transform: 'translateY(0)', opacity: 1 },
      { transform: `translateY(${-FADE_RISE}px)`, opacity: 0 },
    ], { duration: FADE_MS, easing: 'ease-out', fill: 'forwards' });
    anim.onfinish = () => ghost.remove();
  }

  // Wellow 버튼 반동 (카드가 버튼 안으로 들어갈 때)
  function gulp() {
    pill.animate([
      { scale: '1' },
      { scale: '1.1 0.9', offset: 0.35 },
      { scale: '0.96 1.05', offset: 0.7 },
      { scale: '1' },
    ], { duration: 320, easing: 'ease-out' });
  }

  // pill 의 기본 위치 (CSS: 가운데 · top 96) — 끌어 옮겨도 카드는 늘 이 자리에서 나오고 들어감
  const HOME_TOP = 96;
  const HOME_CY = HOME_TOP + 22;          // 기본 위치 pill(44) 의 세로 가운데
  let pillHome = true;                    // pill 이 기본 위치에 붙어 있는지
  // 카드가 기본 위치로 들어갈 때: pill 이 거기 있을 때만 꿀꺽 (옮겨져 있으면 원은 그 자리에서 사라짐)
  const gulpHome = () => { if (pillHome) gulp(); };

  // ── 원 → 박스 모션 (언어 패널과 동일): Wellow 버튼에서 베이지 원이 떨어져 나와 박스로 펼쳐지고,
  //    닫을 땐 원으로 모여 위로 올라가 버튼에 합쳐짐 ──
  const CIRCLE = 44;
  function boxOf(el) {
    return { left: el.offsetLeft, width: el.offsetWidth, height: el.offsetHeight, radius: getComputedStyle(el).borderRadius };
  }
  const mergeYOf = (el) => HOME_CY - (el.offsetTop + CIRCLE / 2);
  // 펼쳐지는 동안 안쪽 내용이 다시 줄바꿈되지 않도록 폭을 고정
  function freezeKids(el, kids, box) {
    const cs = getComputedStyle(el);
    const inner = box.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    el.style.overflow = 'hidden';
    el.style.alignItems = 'center';
    kids.forEach((k) => { k.style.width = `${inner}px`; k.style.flex = 'none'; });
    return () => {
      el.style.overflow = '';
      el.style.alignItems = '';
      kids.forEach((k) => { k.style.width = ''; k.style.flex = ''; });
    };
  }

  async function circleIn(el, kids) {
    const box = boxOf(el);
    const dy = mergeYOf(el);
    const unfreeze = freezeKids(el, kids, box);
    const circle = { left: `${box.left + (box.width - CIRCLE) / 2}px`, width: `${CIRCLE}px`, height: `${CIRCLE}px`, borderRadius: `${CIRCLE / 2}px` };
    const full = { left: `${box.left}px`, width: `${box.width}px`, height: `${box.height}px`, borderRadius: box.radius };
    el.animate([circle, circle], { duration: 460 });
    kids.forEach((k) => k.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 460 }));
    await el.animate([
      { transform: `translateY(${dy}px) scale(0.5)`, opacity: 0 },
      { transform: `translateY(${dy + 12}px) scale(0.7)`, opacity: 1, offset: 0.2 },
      { transform: 'translateY(6px) scale(1.04, 0.96)', opacity: 1, offset: 0.7 },
      { transform: 'translateY(0) scale(1)', opacity: 1 },
    ], { duration: 460, easing: 'cubic-bezier(0.33, 1, 0.68, 1)' }).finished;
    const spread = { duration: 520, easing: 'cubic-bezier(0.34, 1.2, 0.64, 1)' };
    el.animate([circle, full], spread);
    await Promise.all(kids.map((k, i) => k.animate([
      { opacity: 0, transform: 'scale(0.85)' },
      { opacity: 0, transform: 'scale(0.85)', offset: 0.35 },
      { opacity: 1, transform: 'scale(1)' },
    ], { ...spread, delay: i * 50 }).finished));
    unfreeze();
  }

  async function circleOut(el, kids) {
    const box = boxOf(el);
    const dy = mergeYOf(el);
    const unfreeze = freezeKids(el, kids, box);
    const circle = { left: `${box.left + (box.width - CIRCLE) / 2}px`, width: `${CIRCLE}px`, height: `${CIRCLE}px`, borderRadius: `${CIRCLE / 2}px` };
    const full = { left: `${box.left}px`, width: `${box.width}px`, height: `${box.height}px`, borderRadius: box.radius };
    const gather = { duration: 400, easing: 'cubic-bezier(0.45, 0, 0.2, 1)', fill: 'forwards' };
    kids.forEach((k) => k.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.85)', offset: 0.6 }, { opacity: 0, transform: 'scale(0.85)' }], gather));
    await el.animate([full, circle], gather).finished;
    await el.animate([
      { transform: 'translateY(0) scale(1)', opacity: 1 },
      { transform: `translateY(${dy}px) scale(0.7)`, opacity: 1, offset: 0.8 },
      { transform: `translateY(${dy}px) scale(0.5)`, opacity: 0 },
    ], { duration: 420, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'forwards' }).finished;
    el.classList.remove('is-open');
    [el, ...kids].forEach((n) => n.getAnimations().forEach((an) => an.cancel()));
    unfreeze();
    gulpHome();
  }

  const cardKids = [...card.children];

  // 2) 단어 카드: Wellow 버튼에서 원이 떨어져 나와 유의어 박스로 펼쳐짐
  function openCard() {
    cardOpen = true;
    card.setAttribute('aria-hidden', 'false');
    card.classList.add('is-open');
    return circleIn(card, cardKids);
  }

  // 닫힐 때는 원으로 모여 위로 올라가 버튼에 합쳐짐
  function closeCard() {
    if (!cardOpen || busy) return;
    busy = true;
    cardOpen = false;
    card.setAttribute('aria-hidden', 'true');
    circleOut(card, cardKids).then(() => { busy = false; });
  }

  function launch(word) {
    busy = true;
    renderCard(word.textContent);
    fadeUp(word);
    release(); // 원래 하이라이트 · 말풍선은 바로 꺼짐 (하이라이트 색 박스만 페이드아웃)
    setTimeout(() => {
      openCard().then(() => { busy = false; });
    }, CARD_DELAY);
  }

  // Press hold → 하이라이트 + 말풍선 / 누른 채 위로 스와이프 → launch / 손 떼면 꺼짐
  let pressed = null;
  let start = null;
  let armed = false;    // 스와이프 가능 상태 (마우스는 바로, 터치는 HOLD_MS 후)
  let holdTimer = 0;

  article.addEventListener('pointerdown', (e) => {
    if (phone.dataset.mode !== 'wellow') return;
    const word = e.target.closest('.word');
    if (!word || cardOpen || busy) return;
    pressed = word;
    start = { x: e.clientX, y: e.clientY, k: scaleOf() };
    armed = e.pointerType === 'mouse';
    clearTimeout(holdTimer);
    if (!armed) holdTimer = setTimeout(() => { armed = true; }, HOLD_MS);
    article.setPointerCapture(e.pointerId);
    word.classList.add('is-highlighted');
    showBubble(word);
  });

  article.addEventListener('pointermove', (e) => {
    if (!pressed) return;
    const dx = (e.clientX - start.x) / start.k;
    const dy = (e.clientY - start.y) / start.k;
    if (!armed) {
      if (Math.hypot(dx, dy) > MOVE_TOLERANCE) release(); // 스크롤로 판단
      return;
    }
    if (-dy > SWIPE_TRIGGER) launch(pressed);
  });

  article.addEventListener('pointerup', () => release());
  article.addEventListener('pointercancel', () => release());
  article.addEventListener('scroll', () => release(), { passive: true });
  // 스와이프 모드에서는 본문이 스크롤되지 않게
  article.addEventListener('touchmove', (e) => { if (pressed && armed) e.preventDefault(); }, { passive: false });
  // 길게 누를 때 뜨는 컨텍스트 메뉴 막기
  article.addEventListener('contextmenu', (e) => e.preventDefault());

  function release() {
    clearTimeout(holdTimer);
    if (pressed) pressed.classList.remove('is-highlighted');
    pressed = null;
    hideBubble();
  }

  // 카드를 위로 쓸어 올리거나 바깥을 누르면 Wellow 버튼 안으로 들어가며 닫힘
  let cardDrag = null;
  card.addEventListener('pointerdown', (e) => {
    cardDrag = { y: e.clientY, k: scaleOf() };
    card.setPointerCapture(e.pointerId);
  });
  card.addEventListener('pointerup', (e) => {
    if (!cardDrag) return;
    const up = (cardDrag.y - e.clientY) / cardDrag.k;
    cardDrag = null;
    if (up > SWIPE_TRIGGER) closeCard();
  });

  phone.addEventListener('pointerdown', (e) => {
    if (!cardOpen || card.contains(e.target)) return;
    e.stopPropagation(); // 닫기만 하고 새 단어 Press 는 시작하지 않음
    closeCard();
  }, true);

  // ── Quote 모드: 문장을 Press hold 하는 동안 문장 전체 하이라이트 (Figma 96:1846) ──
  const QUOTE_LINE_H = 20;
  const QUOTE_PAD_R = 5;     // Figma 박스는 글자 끝보다 오른쪽으로 약 5px 더 김
  const quoteLayer = document.createElement('div');
  quoteLayer.className = 'quote-layer';
  article.appendChild(quoteLayer);

  // 단어 뒤 문장부호가 . ! ? 이면 그 텍스트 노드를 돌려줌 (strong 밖까지 확인)
  function sentenceEnd(word, para) {
    let n = word;
    while (!n.nextSibling && n.parentNode !== para) n = n.parentNode;
    const next = n.nextSibling;
    return next && next.nodeType === 3 && /^[.!?]/.test(next.textContent) ? next : null;
  }

  // 문장 단위로 단어 묶기
  const sentences = [];
  article.querySelectorAll('p').forEach((para) => {
    let current = null;
    para.querySelectorAll('.word').forEach((word) => {
      if (!current) {
        current = { para, words: [], end: null };
        sentences.push(current);
      }
      current.words.push(word);
      word.sentence = current;
      const end = sentenceEnd(word, para);
      if (end) { current.end = end; current = null; }
    });
  });

  // 문장 Range → 줄마다 하나의 박스 (높이 20, 줄 가운데)
  function sentenceLines(sentence) {
    const range = document.createRange();
    range.setStartBefore(sentence.words[0]);
    if (sentence.end) range.setEnd(sentence.end, 1);
    else range.setEndAfter(sentence.words[sentence.words.length - 1]);
    const k = scaleOf();
    const ar = article.getBoundingClientRect();
    const lines = [];
    [...range.getClientRects()].forEach((r) => {
      if (!r.width) return;
      const mid = (r.top + r.height / 2 - ar.top) / k + article.scrollTop;
      const left = (r.left - ar.left) / k;
      const right = (r.right - ar.left) / k;
      const line = lines.find((l) => Math.abs(l.mid - mid) < 6);
      if (line) { line.left = Math.min(line.left, left); line.right = Math.max(line.right, right); }
      else lines.push({ mid, left, right });
    });
    return lines.sort((x, y) => x.mid - y.mid);
  }

  let quotePress = null;

  // 문장 해석 말풍선 (Figma 96:1937) — 홀드하고 있으면 문장 위에 뜸
  const SENTENCES = window.WELLOW_SENTENCES || {};
  const TRANSLATE_DELAY = 350; // 이만큼 누르고 있으면 해석 등장
  const TRANSLATE_GAP = 5;     // 해석 박스 ↔ 첫 줄 하이라이트 (Figma 401 → 406)
  const PILL_SAFE = 48;        // 본문 위쪽에서 Wellow 버튼에 가려지는 높이
  const translation = document.createElement('div');
  translation.className = 'quote-translation';
  translation.setAttribute('role', 'status');
  article.appendChild(translation);
  let translateTimer = 0;

  const sentenceKey = (sentence) => sentence.words.slice(0, 3).map((w) => w.textContent.toLowerCase()).join(' ');

  // 문장 머리(첫 줄 시작)에서 작은 베이지 원으로 시작해 → 해석 말풍선 크기로 커짐, 닫을 땐 다시 원으로 줄어듦
  const HEAD_DOT = 16;
  let headDot = null; // 마지막으로 연 말풍선의 시작 원 위치
  const dotBox = (d) => ({ left: `${d.x - HEAD_DOT / 2}px`, top: `${d.y - HEAD_DOT / 2}px`, width: `${HEAD_DOT}px`, height: `${HEAD_DOT}px`, borderRadius: `${HEAD_DOT / 2}px`, padding: '0px' });

  function showTranslation(sentence, lines) {
    const text = SENTENCES[sentenceKey(sentence)];
    if (!text || !lines.length) return;
    translation.getAnimations().forEach((an) => an.cancel());
    translation.classList.remove('is-open', 'is-below');
    translation.replaceChildren();
    const inner = document.createElement('span');
    inner.className = 'quote-translation__text';
    inner.textContent = text;
    translation.appendChild(inner);

    const firstTop = lines[0].mid - QUOTE_LINE_H / 2;
    const lastBottom = lines[lines.length - 1].mid + QUOTE_LINE_H / 2;
    let top = firstTop - TRANSLATE_GAP - translation.offsetHeight;
    const below = top < article.scrollTop + PILL_SAFE; // 위가 모자라면 문장 아래로
    if (below) top = lastBottom + TRANSLATE_GAP;
    translation.style.top = `${top}px`;
    translation.classList.toggle('is-below', below);

    // 최종 말풍선 크기 · 시작 원 위치
    const full = {
      left: `${translation.offsetLeft}px`, top: `${top}px`,
      width: `${translation.offsetWidth}px`, height: `${translation.offsetHeight}px`, borderRadius: '12px', padding: '10px 14px',
    };
    inner.style.width = `${translation.clientWidth - 28}px`; // 좌우 여백 14 · 14 를 뺀 글자 폭
    // 원은 말풍선 자리의 왼쪽 아래 모서리에서 시작 (말풍선이 아래로 뜨면 문장 쪽인 왼쪽 위)
    headDot = cornerDot(translation.offsetLeft, top, translation.offsetHeight, below);
    const dot = dotBox(headDot);

    growFromDot(translation, inner, dot, full);
  }

  function hideTranslation() {
    clearTimeout(translateTimer);
    if (!translation.classList.contains('is-open') || !headDot) return;
    shrinkToDot(translation, dotBox(headDot));
  }

  function showQuote(sentence) {
    const lines = sentenceLines(sentence);
    clearTimeout(translateTimer);
    translateTimer = setTimeout(() => showTranslation(sentence, lines), TRANSLATE_DELAY);
    quoteLayer.replaceChildren(...lines.map((l, i) => {
      const box = document.createElement('div');
      box.className = 'quote-line';
      box.style.left = `${l.left}px`;
      box.style.top = `${l.mid - QUOTE_LINE_H / 2}px`;
      box.style.width = `${l.right - l.left + QUOTE_PAD_R}px`;
      // 줄마다 왼쪽에서 오른쪽으로 차례로 칠해짐
      box.animate([
        { transform: 'scaleX(0)', opacity: 0.4 },
        { transform: 'scaleX(1)', opacity: 1 },
      ], { duration: 260, delay: i * 55, easing: 'cubic-bezier(0.25, 1, 0.5, 1)', fill: 'backwards' });
      return box;
    }));
  }

  function hideQuote() {
    quotePress = null;
    hideTranslation();
    [...quoteLayer.children].forEach((box) => {
      box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-out', fill: 'forwards' })
        .onfinish = () => box.remove();
    });
  }

  article.addEventListener('pointerdown', (e) => {
    if (phone.dataset.mode !== 'quote') return;
    const word = e.target.closest('.word');
    if (!word) return;
    quotePress = { x: e.clientX, y: e.clientY, k: scaleOf() };
    article.setPointerCapture(e.pointerId);
    showQuote(word.sentence);
  });
  article.addEventListener('pointermove', (e) => {
    if (!quotePress) return;
    const d = Math.hypot(e.clientX - quotePress.x, e.clientY - quotePress.y) / quotePress.k;
    if (d > MOVE_TOLERANCE && e.pointerType !== 'mouse') hideQuote(); // 터치 스크롤
  });
  ['pointerup', 'pointercancel'].forEach((t) => article.addEventListener(t, () => { if (quotePress) hideQuote(); }));
  article.addEventListener('scroll', () => { if (quotePress) hideQuote(); }, { passive: true });

  // ── Wellow pill: 파란 knob 이 선택한 칸으로 스르륵 이동 ──
  const tabs = [...pill.querySelectorAll('.wellow-pill__item')];
  const knob = pill.querySelector('.wellow-pill__knob');
  const SLOT = 60;
  const PAD = 4;
  let activeIndex = tabs.findIndex((t) => t.classList.contains('is-active'));
  knob.style.left = `${PAD + activeIndex * SLOT}px`;

  // 스르륵 미끄러져 가서 → 쫩 하고 붙음 (모양 변형 최소: 크기 2%만 살짝 조였다 풀림)
  function slideKnob(from, to) {
    const a = PAD + from * SLOT;
    const b = PAD + to * SLOT;
    const dir = Math.sign(b - a);
    knob.style.left = `${b}px`;
    knob.animate([
      { left: `${a}px`, transform: 'scale(1)', easing: 'cubic-bezier(0.45, 0, 0.2, 1)' },
      { left: `${b + dir * 2}px`, transform: 'scale(1)', offset: 0.72, easing: 'cubic-bezier(0.3, 0, 0.3, 1)' },
      { left: `${b}px`, transform: 'scale(0.98)', offset: 0.86, easing: 'ease-out' },
      { left: `${b}px`, transform: 'scale(1)' },
    ], { duration: 560, easing: 'linear' });
  }

  // 칸 안의 아이콘 · 이름이 위로 굴러 나갔다가 아래에서 굴러 들어오며 상태가 바뀜 (가운데에서 상태 전환)
  const ROLL_H = 36;
  function rollItem(item, swap, delay = 0) {
    const parts = item.dataset.mode === 'wellow' ? [faces[face]] : [...item.children];
    item.classList.add('is-rolling');
    const out = { duration: 200, delay, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'forwards' };
    Promise.all(parts.map((el) => el.animate([
      { transform: 'translateY(0)', filter: 'blur(0px)', opacity: 1 },
      { transform: `translateY(${-ROLL_H}px)`, filter: 'blur(2.5px)', opacity: 0.3 },
    ], out).finished)).then(() => {
      swap();
      const back = { duration: 380, easing: 'cubic-bezier(0.34, 1.3, 0.64, 1)' };
      return Promise.all(parts.map((el) => {
        el.getAnimations().forEach((an) => an.cancel());
        return el.animate([
          { transform: `translateY(${ROLL_H}px)`, filter: 'blur(2.5px)', opacity: 0.3 },
          { filter: 'blur(1px)', opacity: 0.9, offset: 0.55 },
          { transform: 'translateY(0)', filter: 'blur(0px)', opacity: 1 },
        ], back).finished;
      }));
    }).then(() => item.classList.remove('is-rolling'));
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => {
      if (i === activeIndex) {
        // 선택된 Wellow 를 한 번 더 누르면 설정 버튼(96:2538)을 열고 닫음
        if (tab.dataset.mode === 'wellow') toggleSettings();
        return;
      }
      if (settingsOpen) return; // 설정이 열려 있는 동안 다른 모드 버튼은 숨겨져 있음
      const prev = tabs[activeIndex];
      slideKnob(activeIndex, i);
      activeIndex = i;
      // 파란 원은 그대로 미끄러지고, 두 칸의 아이콘 · 이름은 세로 오도미터로 굴러 바뀜
      rollItem(prev, () => { prev.classList.remove('is-active'); prev.setAttribute('aria-selected', 'false'); });
      rollItem(tab, () => { tab.classList.add('is-active'); tab.setAttribute('aria-selected', 'true'); }, 60);
      // 모드 전환 시 진행 중인 상태 정리
      release();
      hideQuote();
      closeCard();
      phone.dataset.mode = tab.dataset.mode;
      clearTimeout(fullTimer);
      if (tab.dataset.mode === 'full') fullTimer = setTimeout(openFull, FULL_DELAY);
      else closeFull();
    });
  });

  // ── 네비게이션 바(Wellow pill) 를 누른 채 끌어 원하는 위치로 옮기기 ──
  //    6px 넘게 움직이면 끌기로 보고, 놓았을 때의 클릭(모드 전환)은 무시함
  const PILL_DRAG = 6;
  const PILL_SNAP = 32;      // 기본 위치에서 이 거리 안으로 들어오면 자석처럼 딸깍 붙음
  let pillDrag = null;
  let swallowClick = false;
  function updatePillVars() {
    phone.style.setProperty('--pill-x', `${pill.offsetLeft}px`);
    phone.style.setProperty('--pill-y', `${pill.offsetTop}px`);
    // 화면 아래쪽에 두면 설정 · 언어 · 끄기 패널은 pill 위로 열림
    if (pill.offsetTop > phone.offsetHeight * 0.5) phone.dataset.pillLow = '1';
    else delete phone.dataset.pillLow;
  }
  updatePillVars();
  pill.addEventListener('pointerdown', (e) => {
    if (settingsBusy || phone.dataset.mode === 'off') return;
    pillDrag = { x: e.clientX, y: e.clientY, k: scaleOf(), left: pill.offsetLeft, top: pill.offsetTop, moved: false, id: e.pointerId, snap: pillHome };
  });
  // 아이콘 이미지의 기본 '이미지 끌기'가 끼어들면 포인터가 취소되므로 막음
  pill.addEventListener('dragstart', (e) => e.preventDefault());
  // pill 밖으로 손가락이 벗어나도 계속 따라오도록 window 에서 받음
  window.addEventListener('pointermove', (e) => {
    if (!pillDrag) return;
    const dx = (e.clientX - pillDrag.x) / pillDrag.k;
    const dy = (e.clientY - pillDrag.y) / pillDrag.k;
    if (!pillDrag.moved) {
      if (Math.hypot(dx, dy) < PILL_DRAG) return;
      pillDrag.moved = true;
      try { pill.setPointerCapture(pillDrag.id); } catch (err) { /* 무시 */ }
      pill.classList.add('is-dragging');
    }
    // 화면 안(상태바 아래 ~ 하단 툴바 위)으로 제한
    const half = pill.offsetWidth / 2;
    const maxTop = phone.offsetHeight - 82 - pill.offsetHeight - 6;
    const x = Math.max(half + 6, Math.min(phone.offsetWidth - half - 6, pillDrag.left + dx));
    const y = Math.max(44 + 4, Math.min(maxTop, pillDrag.top + dy));
    // 기본 위치 근처면 자석처럼 끌려가 고정 (들어갈 때 · 빠져나올 때 짧게 스르륵)
    const homeX = phone.offsetWidth / 2;
    const snap = Math.hypot(x - homeX, y - HOME_TOP) < PILL_SNAP;
    if (snap !== pillDrag.snap) {
      pillDrag.snap = snap;
      pill.classList.add('is-snapping');
      clearTimeout(pillDrag.snapTimer);
      pillDrag.snapTimer = setTimeout(() => pill.classList.remove('is-snapping'), 220);
      if (snap) pill.animate([{ scale: '1' }, { scale: '1.06 0.94', offset: 0.4 }, { scale: '1' }], { duration: 240, easing: 'ease-out' });
    }
    pill.style.left = `${snap ? homeX : x}px`;
    pill.style.top = `${snap ? HOME_TOP : y}px`;
    updatePillVars();
  });
  const endPillDrag = () => {
    if (!pillDrag) return;
    if (pillDrag.moved) {
      swallowClick = true;
      setTimeout(() => { swallowClick = false; }, 0);   // 놓는 순간의 클릭만 무시
      pill.classList.remove('is-dragging');
      pillHome = !!pillDrag.snap;
      if (pillHome) {
        // 기본 위치에 붙여 놓으면 원래 CSS 위치로 완전히 돌아감
        clearTimeout(pillDrag.snapTimer);
        pill.classList.remove('is-snapping');
        pill.style.left = '';
        pill.style.top = '';
        updatePillVars();
      }
      // 내려놓을 때 살짝 눌렸다 자리 잡음
      pill.animate([{ scale: '1.04' }, { scale: '0.98' }, { scale: '1' }], { duration: 260, easing: 'ease-out' });
    }
    pillDrag = null;
  };
  window.addEventListener('pointerup', endPillDrag);
  window.addEventListener('pointercancel', endPillDrag);
  pill.addEventListener('click', (e) => {
    if (!swallowClick) return;
    e.stopImmediatePropagation();
    e.preventDefault();
  }, true);

  // ── Wellow 를 한 번 더 누르면 (Figma 96:2457): pill 이 Wellow 하나로 접히고, 아래에서 설정 버튼이 덜컹 하고 떨어짐 ──
  // ── 설정의 화살표 · 전원을 누르면 (Figma 96:2558 · 96:2734): 위 버튼이 Language / Turn off 로 바뀌고, 패널이 원에서 펼쳐짐 ──
  const settings = document.getElementById('wellowSettings');
  const langPanel = document.getElementById('wellowLang');
  let settingsOpen = false;   // 설정 단계(설정 버튼 또는 언어 패널)가 열려 있는지
  let langOpen = false;
  let settingsBusy = false;

  const run = (promise) => {
    settingsBusy = true;
    promise.then(() => { settingsBusy = false; });
  };

  function openSettings() {
    settingsOpen = true;
    release();
    closeCard();
    pill.classList.add('is-collapsed');
    knob.style.left = `${PAD}px`; // Wellow 칸이 맨 앞이 됨
    // 단어 카드 · 언어 패널과 같은 모션: 버튼에서 원이 떨어져 나와 화살표 · 전원으로 펼쳐짐
    run(new Promise((r) => setTimeout(r, 120)).then(spreadDown));
  }

  // ── 세로 오도미터: Wellow ↔ Language / Turn off 면이 숫자판처럼 위아래로 굴러가며 바뀜 ──
  // 움직이는 동안 면에 살짝 블러, 칸 위아래 가장자리는 흐리게 가려 자연스럽게 넘어감
  const faces = {
    wellow: pill.querySelector('.odo__face--wellow'),
    lang: pill.querySelector('.odo__face--lang'),
    power: pill.querySelector('.odo__face--power'),
  };
  const odo = pill.querySelector('.odo');
  let face = 'wellow';
  function odoTo(next) {
    if (next === face) return Promise.resolve();
    const ease = 'cubic-bezier(0.34, 1.3, 0.64, 1)'; // 살짝 지나쳤다가 맞물리는 숫자판 느낌
    const forward = next !== 'wellow';                // Wellow 에서 나갈 땐 위로, 돌아올 땐 아래로 굴러감
    const leaving = faces[face];
    const entering = faces[next];
    const out = forward ? '-100%' : '100%';
    const from = forward ? '100%' : '-100%';
    leaving.style.transform = `translateY(${out})`;
    entering.style.transform = 'translateY(0)';
    odo.classList.add('is-rolling');
    leaving.animate([
      { transform: 'translateY(0)', filter: 'blur(0px)', opacity: 1 },
      { transform: `translateY(${out})`, filter: 'blur(2.5px)', opacity: 0.4 },
    ], { duration: 520, easing: ease });
    face = next;
    return entering.animate([
      { transform: `translateY(${from})`, filter: 'blur(2.5px)', opacity: 0.4 },
      { filter: 'blur(1px)', opacity: 0.9, offset: 0.55 },
      { transform: 'translateY(0)', filter: 'blur(0px)', opacity: 1 },
    ], { duration: 520, easing: ease }).finished.then(() => odo.classList.remove('is-rolling'));
  }

  // ── 설정 버튼: 화살표 · 전원이 베이지 원으로 모였다가 → 위로 올라가 pill 에 합쳐짐 ──
  const settingsItems = [...settings.querySelectorAll('.wellow-settings__item')];
  // 설정 · 하위 패널의 '원'(44) 가운데 → pill 가운데까지의 거리
  // (pill 을 끌어 옮겨도 따라가도록 실제 위치로 계산 · pill 이 화면 아래쪽이면 패널은 pill 위로 열림)
  function mergeOffset(panel) {
    const low = phone.dataset.pillLow === '1';
    const px = pill.offsetLeft;                         // pill 은 translate -50% 라 left 가 가운데
    const py = pill.offsetTop + pill.offsetHeight / 2;
    const cx = panel.offsetLeft;                        // 패널도 translate -50% (left = 가운데)
    const cy = low ? pill.offsetTop - 15 - 22 : pill.offsetTop + pill.offsetHeight + 15 + 22;
    return { dx: px - cx, dy: py - cy };
  }
  const near = (o) => `translate(${o.dx}px, ${o.dy}px)`;
  const nearIn = (o) => `translate(${o.dx * 0.8}px, ${o.dy * 0.8}px)`;
  // 내려앉을 때 살짝 지나치는 방향: pill 반대쪽 (pill 이 아래면 위로)
  const settle = (o) => `translateY(${o.dy > 0 ? -6 : 6}px)`;
  async function gatherUp() {
    const mo = mergeOffset(settings);
    const w = settings.offsetWidth; // 128
    const gather = { duration: 380, easing: 'cubic-bezier(0.45, 0, 0.2, 1)', fill: 'forwards' };
    settings.animate([{ width: `${w}px` }, { width: '44px' }], gather);
    settingsItems[0].animate([{ transform: 'translateX(0) scale(1)', opacity: 1 }, { transform: 'translateX(30px) scale(0.6)', opacity: 0 }], gather);
    await settingsItems[1].animate([{ transform: 'translateX(0) scale(1)', opacity: 1 }, { transform: 'translateX(-30px) scale(0.6)', opacity: 0 }], gather).finished;
    await settings.animate([
      { transform: 'translateY(0) scale(1)', opacity: 1 },
      { transform: `${near(mo)} scale(0.7)`, opacity: 1, offset: 0.8 },
      { transform: `${near(mo)} scale(0.5)`, opacity: 0 },
    ], { duration: 420, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'forwards' }).finished;
    settings.classList.remove('is-open');
    settings.setAttribute('aria-hidden', 'true');
    [settings, ...settingsItems].forEach((el) => el.getAnimations().forEach((an) => an.cancel()));
    gulp();
  }

  // 반대로: pill 에서 베이지 원이 떨어져 나와 → 화살표 · 전원으로 펼쳐짐
  async function spreadDown() {
    const mo = mergeOffset(settings);
    settings.classList.add('is-open');
    settings.setAttribute('aria-hidden', 'false');
    const w = 128;
    const hold = { fill: 'backwards' };
    settings.animate([{ width: '44px' }, { width: '44px' }], { duration: 460, ...hold });
    settingsItems.forEach((el) => el.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 460, ...hold }));
    await settings.animate([
      { transform: `${near(mo)} scale(0.5)`, opacity: 0 },
      { transform: `${nearIn(mo)} scale(0.7)`, opacity: 1, offset: 0.2 },
      { transform: `${settle(mo)} scale(1.04, 0.96)`, opacity: 1, offset: 0.7 },
      { transform: 'translateY(0) scale(1)', opacity: 1 },
    ], { duration: 460, easing: 'cubic-bezier(0.33, 1, 0.68, 1)' }).finished;
    const spread = { duration: 420, easing: 'cubic-bezier(0.34, 1.3, 0.64, 1)' };
    settings.animate([{ width: '44px' }, { width: `${w}px` }], spread);
    settingsItems[0].animate([{ transform: 'translateX(30px) scale(0.6)', opacity: 0 }, { transform: 'translateX(0) scale(1)', opacity: 1 }], spread);
    await settingsItems[1].animate([{ transform: 'translateX(-30px) scale(0.6)', opacity: 0 }, { transform: 'translateX(0) scale(1)', opacity: 1 }], spread).finished;
  }

  // ── 패널(언어 · 전원): pill 에서 베이지 원이 떨어져 나와 → 패널로 펼쳐짐, 닫을 땐 원으로 모여 위로 합쳐짐 ──
  // 가운데 정렬(translate -50%)을 유지한 채 폭 · 높이만 바꿔서 원 ↔ 네모
  const langRows = [...langPanel.querySelectorAll('.wellow-lang__group')];
  async function panelCircleIn(panel, kids) {
    const mo = mergeOffset(panel);
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    const radius = getComputedStyle(panel).borderRadius;
    const circle = { width: '44px', height: '44px', borderRadius: '22px' };
    panel.animate([circle, circle], { duration: 460 });
    kids.forEach((el) => el.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 460 }));
    await panel.animate([
      { transform: `${near(mo)} scale(0.5)`, opacity: 0 },
      { transform: `${nearIn(mo)} scale(0.7)`, opacity: 1, offset: 0.2 },
      { transform: `${settle(mo)} scale(1.04, 0.96)`, opacity: 1, offset: 0.7 },
      { transform: 'translateY(0) scale(1)', opacity: 1 },
    ], { duration: 460, easing: 'cubic-bezier(0.33, 1, 0.68, 1)' }).finished;
    const spread = { duration: 480, easing: 'cubic-bezier(0.34, 1.25, 0.64, 1)' };
    panel.animate([circle, { width: `${w}px`, height: `${h}px`, borderRadius: radius }], spread);
    await Promise.all(kids.map((el, i) => el.animate([
      { opacity: 0, transform: 'scale(0.7)' },
      { opacity: 0, transform: 'scale(0.7)', offset: 0.3 },
      { opacity: 1, transform: 'scale(1)' },
    ], { ...spread, delay: i * 40 }).finished));
  }
  async function panelCircleOut(panel, kids) {
    const mo = mergeOffset(panel);
    panel.setAttribute('aria-hidden', 'true');
    const gather = { duration: 380, easing: 'cubic-bezier(0.45, 0, 0.2, 1)', fill: 'forwards' };
    kids.forEach((el) => el.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.7)', offset: 0.6 }, { opacity: 0, transform: 'scale(0.7)' }], gather));
    await panel.animate([
      { width: `${panel.offsetWidth}px`, height: `${panel.offsetHeight}px`, borderRadius: getComputedStyle(panel).borderRadius },
      { width: '44px', height: '44px', borderRadius: '22px' },
    ], gather).finished;
    await panel.animate([
      { transform: 'translateY(0) scale(1)', opacity: 1 },
      { transform: `${near(mo)} scale(0.7)`, opacity: 1, offset: 0.8 },
      { transform: `${near(mo)} scale(0.5)`, opacity: 0 },
    ], { duration: 420, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'forwards' }).finished;
    panel.classList.remove('is-open');
    [panel, ...kids].forEach((el) => el.getAnimations().forEach((an) => an.cancel()));
    gulp();
  }

  // ── 언어 목록 (Figma 96:2641): Auto · 한국어 줄을 누르면 아래로 쫘르륵 펼쳐지고, 고르면 접힘 ──
  const LANGUAGES = ['Auto', '한국어', 'English (US)', 'English (UK)', 'Español', 'Français', 'Deutsch', '日本語', '中文'];
  const isCjk = (v) => /[^\u0000-\u024f]/.test(v); // 한글 · 한자 · 가나는 RIDIBatang
  let openGroup = null;

  function setValue(group, value) {
    const el = group.querySelector('[data-value]');
    el.textContent = value;
    el.classList.toggle('is-cjk', isCjk(value));
  }

  function openLangList(group) {
    if (openGroup && openGroup !== group) closeLangList(true);
    const current = group.querySelector('[data-value]').textContent;
    const list = group.querySelector('.wellow-lang__list');
    list.getAnimations().forEach((an) => an.cancel()); // 닫히던 중이면 멈추고 다시 펼침
    list.replaceChildren(...LANGUAGES.filter((v) => v !== current).map((v) => {
      const opt = document.createElement('button');
      opt.type = 'button';
      opt.className = 'wellow-lang__option';
      opt.setAttribute('role', 'option');
      opt.textContent = v;
      opt.addEventListener('click', () => { setValue(group, v); closeLangList(); });
      return opt;
    }));
    group.classList.add('is-open');
    group.querySelector('.wellow-lang__row').setAttribute('aria-expanded', 'true');
    openGroup = group;
    // 목록 높이가 0 → 끝까지 늘어나며, 항목이 위에서부터 차례로 떨어지듯 나타남
    const h = list.scrollHeight;
    list.animate([{ height: '0px' }, { height: `${h}px` }], { duration: 460, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
    [...list.children].forEach((opt, i) => opt.animate([
      { opacity: 0, transform: 'translateY(-14px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ], { duration: 320, delay: 40 + i * 38, easing: 'cubic-bezier(0.33, 1, 0.68, 1)', fill: 'backwards' }));
  }

  function closeLangList(instant = false) {
    const group = openGroup;
    if (!group) return;
    openGroup = null;
    group.querySelector('.wellow-lang__row').setAttribute('aria-expanded', 'false');
    const list = group.querySelector('.wellow-lang__list');
    if (instant) { group.classList.remove('is-open'); list.replaceChildren(); return; }
    // 아래에서부터 빠르게 거둬들임
    const items = [...list.children].reverse();
    items.forEach((opt, i) => opt.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-8px)' }], { duration: 160, delay: i * 18, fill: 'forwards' }));
    list.animate([{ height: `${list.offsetHeight}px` }, { height: '0px' }], { duration: 320, delay: 60, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'forwards' })
      .finished.then(() => {
        if (openGroup === group) return; // 그 사이 다시 열렸으면 그대로
        group.classList.remove('is-open');
        list.getAnimations().forEach((an) => an.cancel());
        list.replaceChildren();
      });
  }

  langPanel.querySelectorAll('.wellow-lang__group').forEach((group) => {
    setValue(group, group.querySelector('[data-value]').textContent);
    group.querySelector('.wellow-lang__row').addEventListener('click', () => {
      if (openGroup === group) closeLangList();
      else openLangList(group);
    });
  });

  function restorePill(withGulp = true) {
    pill.classList.remove('is-collapsed');
    knob.style.left = `${PAD + activeIndex * SLOT}px`;
    if (withGulp) gulp();
  }

  function closeSettings() {
    settingsOpen = false;
    // 원으로 모여 위로 합쳐진 뒤 pill 이 다시 3칸으로 펼쳐짐
    run(gatherUp().then(() => restorePill(false)));
  }

  // ── 하위 패널: 화살표 → 언어(96:2558), 전원 → 끄기 확인(96:2734) ──
  const powerPanel = document.getElementById('wellowPower');
  const powerKids = [...powerPanel.children];
  const SUBS = {
    lang: { panel: langPanel, kids: langRows, before: () => {}, leave: () => closeLangList(true) },
    power: { panel: powerPanel, kids: powerKids, before: () => {}, leave: () => {} },
  };
  let sub = null; // 지금 열린 하위 패널

  function openSub(key) {
    if (settingsBusy || sub) return;
    sub = key;
    langOpen = key === 'lang';
    run((async () => {
      await gatherUp();                       // 화살표 · 전원이 원으로 모여 위로 합쳐지고
      await odoTo(key);                       // Wellow → Language / Turn off 가 옆으로 굴러 바뀐 뒤
      await panelCircleIn(SUBS[key].panel, SUBS[key].kids); // 원이 떨어져 나와 패널로 펼쳐짐
    })());
  }

  async function closeSub() {
    const s = SUBS[sub];
    sub = null;
    langOpen = false;
    s.leave();
    await panelCircleOut(s.panel, s.kids);    // 패널이 원으로 모여 위로 합쳐지고
    await odoTo('wellow');                    // 다시 Wellow 로
  }

  function backToSettings() {
    run((async () => {
      await closeSub();
      await spreadDown();                     // 원이 떨어져 나와 화살표 · 전원으로 펼쳐짐
    })());
  }

  function closeAll() {
    const hadSub = !!sub;
    settingsOpen = false;
    run((async () => {
      if (hadSub) await closeSub();
      else await gatherUp();
      restorePill(false);
    })());
  }

  // 위 버튼을 다시 누를 때: 하위 패널 → 설정으로
  function toggleSettings() {
    if (settingsBusy || wellowOff) return;
    if (sub) backToSettings();
    else if (settingsOpen) closeSettings();
    else openSettings();
  }

  // ── 끄기 확인: No → 원으로 들어가며 처음 pill 로, Yes → 원으로 합쳐진 뒤 전원 모양 그대로 베이지 원 + 파란 원으로 작아져 위로 사라짐 ──
  let wellowOff = false;
  powerPanel.querySelector('[data-answer="no"]').addEventListener('click', () => {
    if (settingsBusy) return;
    closeAll();
  });
  powerPanel.querySelector('[data-answer="yes"]').addEventListener('click', () => {
    if (settingsBusy) return;
    settingsOpen = false;
    run((async () => {
      // 끄기 화면이 원이 되어 pill 에 합쳐짐 (위 버튼은 전원 모양 그대로, Wellow 로 돌아가지 않음)
      const s = SUBS[sub];
      sub = null;
      await panelCircleOut(s.panel, s.kids);
      // pill(68 × 44) → 베이지 원 44 + 안쪽 파란 원 36 으로 작아짐
      const shrink = { duration: 420, easing: 'cubic-bezier(0.45, 0, 0.2, 1)', fill: 'forwards' };
      pill.animate([{ width: `${pill.offsetWidth}px` }, { width: '44px' }], shrink);
      knob.animate([{ width: '60px', left: `${PAD}px` }, { width: '36px', left: `${PAD}px` }], shrink);
      // 전원 아이콘은 남기고 라벨만 사라지며 칸이 원 크기로 줄어듦
      const wellowItem = tabs[1];
      wellowItem.animate([{ width: '60px' }, { width: '36px' }], shrink);
      wellowItem.querySelector('.odo').animate([{ width: '60px' }, { width: '36px' }], shrink);
      faces.power.querySelector('.wellow-pill__label').animate([{ opacity: 1 }, { opacity: 0 }], { ...shrink, duration: 200 });
      // 원으로 작아지면서 전원 아이콘은 파란 원 속으로 번지듯 스며들며 사라짐
      faces.power.querySelector('.pill-icon').animate([
        { opacity: 1, filter: 'blur(0px)', transform: 'scale(1)' },
        { opacity: 0.6, filter: 'blur(0.6px)', transform: 'scale(0.9)', offset: 0.45 },
        { opacity: 0, filter: 'blur(3px)', transform: 'scale(0.7)' },
      ], { duration: 520, easing: 'ease-in', fill: 'forwards' });
      await pill.animate([{ scale: '1' }, { scale: '0.82' }], shrink).finished;
      // 위로 미끄러져 사라짐
      await pill.animate([
        { transform: 'translateY(0)', opacity: 1 },
        { transform: 'translateY(8px)', opacity: 1, offset: 0.2 },
        { transform: 'translateY(-140px)', opacity: 0 },
      ], { duration: 520, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'forwards' }).finished;
      wellowOff = true;
      phone.dataset.mode = 'off';
      pill.setAttribute('aria-hidden', 'true');
      pill.style.pointerEvents = 'none';
    })());
  });

  settings.querySelector('.wellow-settings__item--language').addEventListener('click', () => openSub('lang'));
  settings.querySelector('.wellow-settings__item--power').addEventListener('click', () => openSub('power'));

  // 설정 · 하위 패널 바깥을 누르면 모두 닫히고 원래 pill 로
  phone.addEventListener('pointerdown', (e) => {
    if (!settingsOpen || settingsBusy) return;
    if (pill.contains(e.target) || settings.contains(e.target) || langPanel.contains(e.target) || powerPanel.contains(e.target)) return;
    e.stopPropagation();
    closeAll();
  }, true);

  // ── Full text 프레임 (Figma 96:2105): 선택 0.8초 뒤 등장, 본문은 드래그해서 읽기 ──
  const FULL_DELAY = 800;
  const full = document.getElementById('fulltext');
  const fullTab = full.querySelector('.fulltext__tab');
  const fullPanel = full.querySelector('.fulltext__panel');
  const fullScroll = document.getElementById('fulltextScroll');
  const summaryPanel = full.querySelector('.fulltext__panel--summary');
  const summaryScroll = document.getElementById('summaryScroll');
  const bottomTab = full.querySelector('.fulltext__tab--bottom');
  const fullParts = [fullTab, fullPanel, summaryPanel, bottomTab];
  let fullTimer = 0;
  let fullOpen = false;
  let fullBusy = null; // 여는 모션이 끝나기 전에 닫히면 기다렸다가 닫음
  let showingSummary = false;
  let flipping = false;

  function resetFullState() {
    fullParts.forEach((el) => el.getAnimations().forEach((an) => an.cancel()));
    full.classList.remove('is-summary', 'is-flipping');
    showingSummary = false;
    flipping = false;
    setPanel(0);
    setSummary(0);
  }

  // ── 베이지 원 → 박스 모션 (유의어 카드와 동일) — 여러 겹(탭 + 패널)으로 된 박스용 ──
  // 박스 대신 같은 색의 '블롭'이 원으로 떨어져 나와 박스 크기로 펼쳐진 뒤, 실제 내용이 그 위로 나타남
  function rectInPhone(els) {
    const k = scaleOf();
    const pr = phone.getBoundingClientRect();
    const rs = els.map((el) => el.getBoundingClientRect());
    const left = Math.min(...rs.map((r) => r.left));
    const top = Math.min(...rs.map((r) => r.top));
    const right = Math.max(...rs.map((r) => r.right));
    const bottom = Math.max(...rs.map((r) => r.bottom));
    return { left: (left - pr.left) / k, top: (top - pr.top) / k, width: (right - left) / k, height: (bottom - top) / k };
  }
  function makeBlob(rect) {
    const blob = document.createElement('div');
    blob.className = 'morph-blob';
    Object.assign(blob.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    phone.appendChild(blob);
    return blob;
  }
  const blobCircle = (rect) => ({
    left: `${rect.left + rect.width / 2 - CIRCLE / 2}px`, top: `${rect.top}px`,
    width: `${CIRCLE}px`, height: `${CIRCLE}px`, borderRadius: `${CIRCLE / 2}px`,
  });
  const blobFull = (rect) => ({
    left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, borderRadius: '20px',
  });
  const pillMergeY = (rect) => HOME_CY - (rect.top + CIRCLE / 2);

  async function blobIn(rect, content) {
    const blob = makeBlob(rect);
    const dy = pillMergeY(rect);
    content.style.opacity = '0';
    blob.animate([blobCircle(rect), blobCircle(rect)], { duration: 460 });
    await blob.animate([
      { transform: `translateY(${dy}px) scale(0.5)`, opacity: 0 },
      { transform: `translateY(${dy + 12}px) scale(0.7)`, opacity: 1, offset: 0.2 },
      { transform: 'translateY(6px) scale(1.04, 0.96)', opacity: 1, offset: 0.7 },
      { transform: 'translateY(0) scale(1)', opacity: 1 },
    ], { duration: 460, easing: 'cubic-bezier(0.33, 1, 0.68, 1)' }).finished;
    await blob.animate([blobCircle(rect), blobFull(rect)], { duration: 520, easing: 'cubic-bezier(0.34, 1.2, 0.64, 1)' }).finished;
    // 펼쳐진 블롭 위로 실제 박스가 나타나고 블롭은 빠짐
    content.style.opacity = '';
    content.animate([{ opacity: 0, transform: 'scale(0.98)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' });
    await blob.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease-out', fill: 'forwards' }).finished;
    blob.remove();
  }

  async function blobOut(rect, content) {
    const blob = makeBlob(rect);
    blob.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, fill: 'forwards' });
    await content.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }).finished;
    await blob.animate([blobFull(rect), blobCircle(rect)], { duration: 400, easing: 'cubic-bezier(0.45, 0, 0.2, 1)', fill: 'forwards' }).finished;
    const dy = pillMergeY(rect);
    await blob.animate([
      { transform: 'translateY(0) scale(1)', opacity: 1 },
      { transform: `translateY(${dy}px) scale(0.7)`, opacity: 1, offset: 0.8 },
      { transform: `translateY(${dy}px) scale(0.5)`, opacity: 0 },
    ], { duration: 420, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'forwards' }).finished;
    blob.remove();
    gulpHome();
  }

  function openFull() {
    if (fullOpen) return;
    fullOpen = true;
    resetFullState();
    fullScroll.scrollTop = 0;
    summaryScroll.scrollTop = 0;
    updateFade(fullScroll);
    updateFade(summaryScroll);
    full.classList.add('is-open');
    full.setAttribute('aria-hidden', 'false');
    // 베이지 원이 떨어져 나옴 → 베이지 박스(전문 패널)로 펼쳐짐 → 뒤의 파란 박스가 뿅 하고 튀어나옴
    fullTab.style.opacity = '0';
    fullBusy = blobIn(rectInPhone([fullPanel]), full).then(() => {
      fullTab.style.opacity = '';
      return fullTab.animate([
        { transform: 'translateY(36px) scale(0.92, 0.6)', opacity: 0 },
        { transform: 'translateY(-7px) scale(1.02, 1.04)', opacity: 1, offset: 0.55 },
        { transform: 'translateY(2px) scale(1, 0.99)', offset: 0.8 },
        { transform: 'translateY(0) scale(1)', opacity: 1 },
      ], { duration: 460, easing: 'cubic-bezier(0.34, 1.3, 0.64, 1)' }).finished;
    });
  }

  function closeFull() {
    clearTimeout(fullTimer);
    if (!fullOpen) return;
    fullOpen = false;
    full.setAttribute('aria-hidden', 'true');
    // 나올 때의 반대: 파란 박스가 뿅 하고 베이지 박스 뒤로 들어간 뒤 → 베이지 박스가 원으로 작아져 버튼에 합쳐짐
    // 전문은 위쪽 파란 박스가 아래로, 요약은 아래쪽 파란 박스가 위로 들어감
    const summary = showingSummary;
    const tab = summary ? bottomTab : fullTab;
    const panel = summary ? summaryPanel : fullPanel;
    const dir = summary ? -1 : 1;
    Promise.resolve(fullBusy).then(() => tab.animate([
      { transform: 'translateY(0) scale(1)', opacity: 1 },
      { transform: `translateY(${-7 * dir}px) scale(1.02, 1.04)`, opacity: 1, offset: 0.35 },
      { transform: `translateY(${36 * dir}px) scale(0.92, 0.6)`, opacity: 0 },
    ], { duration: 380, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'forwards' }).finished)
      .then(() => blobOut(rectInPhone([panel]), full))
      .then(() => {
        if (fullOpen) return;
        full.classList.remove('is-open');
        full.getAnimations().forEach((an) => an.cancel());
        resetFullState();
      });
  }

  // 끝까지 읽으면 아래 그라디언트 숨김
  function updateFade(scroller) {
    const end = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
    scroller.parentElement.classList.toggle('is-end', end);
  }

  // 마우스로도 끌어서 스크롤 (터치는 기본 스크롤) + 놓으면 관성
  function dragScroll(el) {
    let drag = null;
    el.addEventListener('scroll', () => updateFade(el), { passive: true });
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      drag = { y: e.clientY, top: el.scrollTop, k: scaleOf(), v: 0, t: performance.now(), last: e.clientY };
      el.setPointerCapture(e.pointerId);
      el.classList.add('is-dragging');
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const now = performance.now();
      drag.v = ((drag.last - e.clientY) / drag.k) / Math.max(1, now - drag.t); // px/ms, 위로 끌면 양수
      drag.t = now;
      drag.last = e.clientY;
      el.scrollTop = drag.top + (drag.y - e.clientY) / drag.k;
    });
    const end = () => {
      if (!drag) return;
      let v = Math.max(-30, Math.min(30, drag.v * 16)); // px/frame, 너무 멀리 튀지 않게 제한
      drag = null;
      el.classList.remove('is-dragging');
      const glide = () => {
        if (Math.abs(v) < 0.3) return;
        el.scrollTop += v;
        v *= 0.94;
        requestAnimationFrame(glide);
      };
      requestAnimationFrame(glide);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    return { cancel() { drag = null; el.classList.remove('is-dragging'); } };
  }
  const fullScrollDrag = dragScroll(fullScroll);
  const summaryScrollDrag = dragScroll(summaryScroll);

  // ── 패널을 아래로 스와이프 → 파란 탭의 아이콘 카드(Figma 96:2232) 노출 ──
  // ── 아이콘을 본 뒤 더 아래로 스와이프 → 카드가 넘겨지며 요약 페이지(96:2353) ──
  const REVEAL = 57;            // 패널 top 14 → 71
  const FLIP_PULL = 70;         // 아이콘이 다 보인 뒤 이만큼 더 당기면 카드 넘김
  const MAX_PULL = 246 - 14 - 40; // 탭 높이 - 패널 시작 위치 - 여유(모서리 · 기울기)
  // 요약 쪽 (Figma 96:2382): 평소엔 아래 탭이 14px만 보이고, 위로 올려 72px 보이면 Full text 아이콘 노출
  const SUM_PEEK = 14;            // 평소 요약 카드 아래로 삐져나오는 파란 탭 높이
  const SUM_REVEAL = 72 - SUM_PEEK; // 58px 올리면 아이콘이 다 보임
  const SUM_TAB_H = 275;
  const SUM_MAX_PULL = SUM_TAB_H - SUM_PEEK - 40;
  const SNAP = 'transform 0.5s cubic-bezier(0.34, 1.45, 0.64, 1)';
  const FLIP = { duration: 760, easing: 'cubic-bezier(0.45, 0, 0.2, 1)', fill: 'forwards' };
  let panelOffset = 0;
  let panelTilt = 0;
  let panelDrag = null;

  function setPanel(offset, transition, tilt = 0) {
    panelOffset = offset;
    panelTilt = tilt;
    fullPanel.style.transition = transition || 'none';
    fullPanel.style.transform = offset || tilt ? `translateY(${offset}px) rotateX(${tilt}deg)` : '';
    full.style.setProperty('--reveal', Math.max(0, Math.min(1, offset / REVEAL)).toFixed(3));
    full.classList.toggle('is-revealed', offset >= REVEAL);
  }

  let sumOffset = 0;
  let sumTilt = 0;
  // 요약 카드: 위로 offset 만큼 올라가고, 아래쪽이 앞으로 tilt 만큼 기울어짐
  function setSummary(offset, transition, tilt = 0) {
    sumOffset = offset;
    sumTilt = tilt;
    summaryPanel.style.transition = transition || 'none';
    summaryPanel.style.transform = offset || tilt ? `translateY(${-offset}px) rotateX(${tilt}deg)` : '';
    full.style.setProperty('--reveal-sum', Math.max(0, Math.min(1, offset / SUM_REVEAL)).toFixed(3));
  }

  // 아이콘이 다 보인 뒤로는 고무줄처럼 덜 따라오면서, 위쪽이 앞으로 살짝 기울어 "넘어갈 것 같은" 느낌
  function pullTo(raw) {
    if (raw < 0) return setPanel(raw * 0.3);
    if (raw <= REVEAL) return setPanel(raw);
    const over = raw - REVEAL;
    // 패널 윗변이 파란 탭(높이 246) 끝을 넘지 않게 제한 → 뒤 배경이 보이지 않음
    setPanel(Math.min(REVEAL + over * 0.35, MAX_PULL), null, -Math.min(over * 0.16, 14));
  }

  // 전문 카드 → 요약 카드 (위가 앞으로 넘어오며 아래로 뒤집힘)
  function flipToSummary() {
    flipping = true;
    summaryScroll.scrollTop = 0;
    updateFade(summaryScroll);
    full.classList.add('is-flipping');
    // 뒤집힌 파란 탭은 요약 카드 아래로 14px만 보이게, 나머지는 카드 뒤에 숨김 (높이 275)
    bottomTab.style.top = `${summaryPanel.offsetHeight + SUM_PEEK - SUM_TAB_H}px`;
    fullPanel.style.transition = 'none';
    fullPanel.animate([
      { transform: `translateY(${panelOffset}px) rotateX(${panelTilt}deg)` },
      { transform: 'translateY(-14px) rotateX(-180deg)' },
    ], FLIP);
    summaryPanel.animate([
      { transform: `translateY(${panelOffset + 14}px) rotateX(${180 + panelTilt}deg)` },
      { transform: 'translateY(0) rotateX(0deg)' },
    ], FLIP);
    fullTab.animate([
      { transform: 'translateY(0)', opacity: 1 },
      { transform: 'translateY(60px)', opacity: 0 },
    ], { duration: 320, easing: 'ease-in', fill: 'forwards' });
    bottomTab.animate([
      { transform: 'translateY(-60px)', opacity: 0 },
      { transform: 'translateY(4px)', opacity: 1, offset: 0.7 },
      { transform: 'translateY(0)', opacity: 1 },
    ], { duration: 460, delay: 480, easing: 'cubic-bezier(0.33, 1, 0.68, 1)', fill: 'backwards' })
      .finished.then(() => {
        if (!flipping) return;
        full.classList.add('is-summary');
        full.classList.remove('is-flipping');
        [fullPanel, summaryPanel, fullTab].forEach((el) => el.getAnimations().forEach((an) => an.cancel()));
        setPanel(0);
        showingSummary = true;
        flipping = false;
      });
  }

  // 요약 카드 → 전문 카드 (전문 → 요약과 똑같은 모션을 위아래만 뒤집어서)
  function flipToFull() {
    flipping = true;
    showingSummary = false;
    full.classList.add('is-flipping');
    full.classList.remove('is-summary');
    summaryPanel.style.transition = 'none';
    summaryPanel.animate([
      { transform: `translateY(${-sumOffset}px) rotateX(${sumTilt}deg)` },
      { transform: 'translateY(14px) rotateX(180deg)' },
    ], FLIP);
    fullPanel.animate([
      { transform: `translateY(${-sumOffset - 14}px) rotateX(${-180 + sumTilt}deg)` },
      { transform: 'translateY(0) rotateX(0deg)' },
    ], FLIP);
    bottomTab.animate([
      { transform: 'translateY(0)', opacity: 1 },
      { transform: 'translateY(-60px)', opacity: 0 },
    ], { duration: 320, easing: 'ease-in', fill: 'forwards' });
    fullTab.animate([
      { transform: 'translateY(60px)', opacity: 0 },
      { transform: 'translateY(-4px)', opacity: 1, offset: 0.7 },
      { transform: 'translateY(0)', opacity: 1 },
    ], { duration: 460, delay: 480, easing: 'cubic-bezier(0.33, 1, 0.68, 1)', fill: 'backwards' })
      .finished.then(() => {
        if (!flipping) return;
        resetFullState();
      });
  }

  fullPanel.addEventListener('pointerdown', (e) => {
    if (flipping || showingSummary) return;
    const inBody = !!e.target.closest('.fulltext__body');
    if (inBody && e.pointerType !== 'mouse') return; // 터치로 본문을 끌면 기본 스크롤
    panelDrag = { y: e.clientY, k: scaleOf(), base: panelOffset, inBody, mode: null };
    if (!inBody) fullPanel.setPointerCapture(e.pointerId);
  });

  fullPanel.addEventListener('pointermove', (e) => {
    if (!panelDrag) return;
    const dy = (e.clientY - panelDrag.y) / panelDrag.k;
    if (!panelDrag.mode) {
      if (Math.abs(dy) < 4) return;
      // 본문에서는 맨 위에서 아래로 당길 때만 패널을 끌어내림, 나머지는 본문 스크롤
      const pullDown = dy > 0 && fullScroll.scrollTop <= 0;
      panelDrag.mode = !panelDrag.inBody || pullDown ? 'panel' : 'scroll';
      if (panelDrag.mode === 'panel' && panelDrag.inBody) fullScrollDrag.cancel();
    }
    if (panelDrag.mode === 'panel') {
      panelDrag.raw = panelDrag.base + dy;
      pullTo(panelDrag.raw);
    }
  });

  const endPanelDrag = () => {
    if (!panelDrag) return;
    const { mode, raw = 0 } = panelDrag;
    panelDrag = null;
    if (mode !== 'panel') return;
    // 끝까지 당겼을 때만 뒤집힘, 중간에 손을 떼면 원래 화면으로 복귀
    if (raw > REVEAL + FLIP_PULL) return flipToSummary();
    setPanel(0, SNAP);
  };
  fullPanel.addEventListener('pointerup', endPanelDrag);
  fullPanel.addEventListener('pointercancel', endPanelDrag);

  // ── 요약 카드를 위로 스와이프 → 아래 아이콘 카드(Full text) 노출 → 더 올리면 전문으로 넘김 ──
  // 전문 쪽 pullTo 와 같은 규칙(고무줄 · 기울기 · 스냅)을 위아래만 뒤집어 적용
  function pullSummary(raw) {
    if (raw < 0) return setSummary(raw * 0.3);
    if (raw <= SUM_REVEAL) return setSummary(raw);
    const over = raw - SUM_REVEAL;
    setSummary(Math.min(SUM_REVEAL + over * 0.35, SUM_MAX_PULL), null, Math.min(over * 0.16, 14));
  }

  let summaryDrag = null;
  summaryPanel.addEventListener('pointerdown', (e) => {
    if (flipping || !showingSummary) return;
    const inBody = !!e.target.closest('.fulltext__body');
    if (inBody && e.pointerType !== 'mouse') return; // 터치로 본문을 끌면 기본 스크롤
    summaryDrag = { y: e.clientY, k: scaleOf(), base: sumOffset, inBody, mode: null };
    if (!inBody) summaryPanel.setPointerCapture(e.pointerId);
  });
  summaryPanel.addEventListener('pointermove', (e) => {
    if (!summaryDrag) return;
    const up = (summaryDrag.y - e.clientY) / summaryDrag.k;
    if (!summaryDrag.mode) {
      if (Math.abs(up) < 4) return;
      // 본문에서는 끝까지 읽은 상태에서 위로 올릴 때만 카드를 끌어올림, 나머지는 본문 스크롤
      const atEnd = summaryScroll.scrollTop + summaryScroll.clientHeight >= summaryScroll.scrollHeight - 2;
      summaryDrag.mode = !summaryDrag.inBody || (up > 0 && atEnd) ? 'panel' : 'scroll';
      if (summaryDrag.mode === 'panel' && summaryDrag.inBody) summaryScrollDrag.cancel();
    }
    if (summaryDrag.mode === 'panel') {
      summaryDrag.raw = summaryDrag.base + up;
      pullSummary(summaryDrag.raw);
    }
  });
  const endSummaryDrag = () => {
    if (!summaryDrag) return;
    const { mode, raw = 0 } = summaryDrag;
    summaryDrag = null;
    if (mode !== 'panel') return;
    // 끝까지 스와이프했을 때만 뒤집힘, 중간에 손을 떼면 14px만 보이는 원래 화면으로 복귀
    if (raw > SUM_REVEAL + FLIP_PULL) return flipToFull();
    setSummary(0, SNAP);
  };
  summaryPanel.addEventListener('pointerup', endSummaryDrag);
  summaryPanel.addEventListener('pointercancel', endSummaryDrag);

  // ── 온보딩 (Figma 67:1381 → 67:1528 → 67:1582)
  //    1 시작 → (권한 · Skip) → 2 원문 언어 → (Save) → 3 번역 언어 → (Save) → 본 화면 ──
  const onboarding = document.getElementById('onboarding');
  const obPages = [...onboarding.querySelectorAll('.onboarding__page')];
  const pageOf = (step) => obPages.find((p) => p.dataset.step === String(step));
  let onboardingDone = false;
  let stepping = false;

  async function finishOnboarding() {
    if (onboardingDone) return;
    onboardingDone = true;
    // 지금 화면의 내용이 가라앉고 배경이 걷히며 Wellow 버튼이 꿀꺽
    [pageOf(onboarding.dataset.step), onboarding.querySelector('.onboarding__progress')].forEach((el) => el.animate(
      [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(16px)' }],
      { duration: 300, easing: 'ease-in', fill: 'forwards' }));
    await onboarding.animate([{ backgroundColor: 'rgba(250, 244, 233, 1)' }, { backgroundColor: 'rgba(250, 244, 233, 0)' }],
      { duration: 520, delay: 200, easing: 'ease-out', fill: 'forwards' }).finished;
    onboarding.querySelector('.onboarding__status').style.visibility = 'hidden';
    gulp();
    onboarding.classList.add('is-gone');
    onboarding.setAttribute('aria-hidden', 'true');
  }

  // ── 진행 점 (페이지와 따로 떠 있어 페이드되지 않음) ──
  const progressDots = [...onboarding.querySelectorAll('.onboarding__progress span')];
  let progressAt = 0;
  // 다음 점이 먼저 늘어나며 파래지고(앞 점과 붙어 보임) → 앞 점이 뒤늦게 줄어들며 회색으로: 쫀득하게 넘어감
  function stepProgress(to) {
    const from = progressAt;
    if (to === from) return;
    progressAt = to;
    const a = progressDots[from];
    const b = progressDots[to];
    const blue = 'rgb(87, 117, 167)';
    const grey = 'rgb(200, 200, 200)';
    b.animate([
      { width: '6px', backgroundColor: grey },
      { width: '26px', backgroundColor: blue, offset: 0.55 },
      { width: '18px', backgroundColor: blue, offset: 0.8 },
      { width: '20px', backgroundColor: blue },
    ], { duration: 560, easing: 'cubic-bezier(0.34, 1.2, 0.64, 1)' });
    a.animate([
      { width: '20px', backgroundColor: blue },
      { width: '20px', backgroundColor: blue, offset: 0.25 },
      { width: '4px', backgroundColor: grey, offset: 0.75 },
      { width: '6px', backgroundColor: grey },
    ], { duration: 560, easing: 'cubic-bezier(0.45, 0, 0.2, 1)' });
    a.classList.remove('is-on');
    b.classList.add('is-on');
  }

  // ── 언어 목록 (원문 · 번역 공통) ──
  //    고르면 파란 알약이 네비게이션 바의 파란 원처럼 위아래로 스르륵 미끄러져 쫩, 글자는 세로 오도미터로 굴러 바뀜
  const OB_ROLL = 26;
  function rollRow(row, swap, delay = 0) {
    const parts = [...row.querySelectorAll('.ob-lang__text, .ob-lang__icon')];
    const base = (el) => (el.classList.contains('ob-lang__icon--left') ? 'scaleX(-1) ' : '');
    row.classList.add('is-rolling');
    Promise.all(parts.map((el) => el.animate([
      { transform: `${base(el)}translateY(0)`, filter: 'blur(0px)', opacity: 1 },
      { transform: `${base(el)}translateY(${-OB_ROLL}px)`, filter: 'blur(2px)', opacity: 0.2 },
    ], { duration: 180, delay, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'forwards' }).finished)).then(() => {
      swap();
      return Promise.all(parts.map((el) => {
        el.getAnimations().forEach((an) => an.cancel());
        return el.animate([
          { transform: `${base(el)}translateY(${OB_ROLL}px)`, filter: 'blur(2px)', opacity: 0.2 },
          { transform: `${base(el)}translateY(0)`, filter: 'blur(0px)', opacity: 1 },
        ], { duration: 340, easing: 'cubic-bezier(0.34, 1.3, 0.64, 1)' }).finished;
      }));
    }).catch(() => {}).then(() => row.classList.remove('is-rolling'));
  }

  function setupLangList(page) {
    const list = page.querySelector('.ob-lang__list');
    const opts = [...list.querySelectorAll('.ob-lang__opt')];
    const slider = list.querySelector('.ob-lang__slider');
    const sliderTop = (opt) => opt.offsetTop + 0.5;
    const selected = () => opts.find((o) => o.classList.contains('is-selected'));
    slider.style.top = `${sliderTop(selected())}px`;

    opts.forEach((opt) => opt.addEventListener('click', () => {
      if (opt.classList.contains('is-selected')) return;
      const prev = selected();
      const a = sliderTop(prev);
      const b = sliderTop(opt);
      const dir = Math.sign(b - a);
      slider.style.top = `${b}px`;
      // 스르륵 미끄러져 가서 → 2px 지나쳤다가 쫩 (모양 변형 최소)
      slider.animate([
        { top: `${a}px`, transform: 'scale(1)', easing: 'cubic-bezier(0.45, 0, 0.2, 1)' },
        { top: `${b + dir * 2}px`, transform: 'scale(1)', offset: 0.72, easing: 'cubic-bezier(0.3, 0, 0.3, 1)' },
        { top: `${b}px`, transform: 'scale(0.98)', offset: 0.86, easing: 'ease-out' },
        { top: `${b}px`, transform: 'scale(1)' },
      ], { duration: Math.min(720, 360 + Math.abs(b - a) * 0.8), easing: 'linear' });
      prev.setAttribute('aria-selected', 'false');
      rollRow(prev, () => prev.classList.remove('is-selected'));
      opt.setAttribute('aria-selected', 'true');
      rollRow(opt, () => opt.classList.add('is-selected'), 120);
    }));

    // ── 원 ↔ 목록 모양 바꾸기 ──
    // clip-path 애니메이션은 브라우저(사파리 등)에 따라 무시되어 흰 목록 전체가 박스로 보일 수 있어서,
    // 목록 배경은 잠시 비우고 같은 색의 '흰 블롭' 요소의 크기 · 위치 · 모서리를 직접 움직임
    const blob = document.createElement('span');
    blob.className = 'ob-lang__blob';
    blob.setAttribute('aria-hidden', 'true');
    list.insertBefore(blob, slider);
    const R = 60;                                    // 흰 원 = 파란 원(48) + 사방 6px
    const geo = () => {
      const W = list.offsetWidth;
      const H = list.offsetHeight;
      return { W, H };
    };
    const px = (o) => Object.fromEntries(Object.entries(o).map(([k2, v]) => [k2, typeof v === 'number' ? `${v}px` : v]));
    const blobCircle = (W, top) => px({ left: (W - R) / 2, top, width: R, height: R, borderRadius: R / 2 });
    const blobInner = (W, top) => px({ left: (W - 48) / 2, top: top + 6, width: 48, height: 48, borderRadius: 24 });
    const blobBand = (W, top) => px({ left: 0, top, width: W, height: R, borderRadius: R / 2 });
    const blobFull = (W, H) => px({ left: 0, top: 0, width: W, height: H, borderRadius: 20 });
    const sliderCircle = (W, top) => px({ left: (W - 48) / 2, top: top + 6, width: 48 });
    const sliderBand = (W, top) => px({ left: 6, top: top + 6, width: W - 12 });
    const sliderFull = (W, top) => px({ left: 4, top: top + 6, width: W - 8 });
    function shaping(on) {
      list.classList.toggle('is-shaping', on);
      if (!on) blob.getAnimations().forEach((an) => an.cancel());
    }

    // 등장: 고른 줄 자리에서 흰 원 + 파란 원이 톡 → 그 줄이 양쪽으로 펼쳐짐 → 나머지 언어가 위아래로 쫘르륵
    //   mode: 기본 = 둘이 함께 톡 / 'blue' = 파란 원은 이미 와 있고 흰 원만 둘레로 뿅 / true = 앞 화면 원을 이어받아 바로 펼침
    async function enter(mode = false) {
      const sel = selected();
      const { W, H } = geo();
      const bandTop = sel.offsetTop - 5.5;           // 흰 원이 놓일 띠의 위쪽
      const others = opts.filter((o) => o !== sel);
      const selBits = [...sel.querySelectorAll('.ob-lang__text, .ob-lang__icon')];
      shaping(true);
      const keep = { fill: 'forwards' };
      const hold = (els, frame, ms) => els.forEach((el) => el.animate([frame, frame], { duration: ms, fill: 'backwards' }));
      hold(others, { opacity: 0 }, 1600);
      hold(selBits, { opacity: 0 }, 900);
      slider.animate([sliderCircle(W, bandTop), sliderCircle(W, bandTop)], { duration: 400 });

      // 1) 흰 원(60) + 파란 원(48)
      if (mode === 'blue') {
        await blob.animate([blobInner(W, bandTop), blobCircle(W, bandTop)],
          { duration: 360, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', ...keep }).finished;
      } else if (mode) {
        blob.animate([blobCircle(W, bandTop), blobCircle(W, bandTop)], { duration: 80, ...keep });
        await new Promise((r) => setTimeout(r, 60));
      } else {
        const pop = [{ transform: 'scale(0.3)', opacity: 0 }, { transform: 'scale(1.08)', opacity: 1, offset: 0.65 }, { transform: 'scale(1)', opacity: 1 }];
        slider.animate(pop.map((f) => ({ ...f, ...sliderCircle(W, bandTop) })), { duration: 380, easing: 'cubic-bezier(0.33, 1, 0.68, 1)' });
        await blob.animate(pop.map((f) => ({ ...f, ...blobCircle(W, bandTop) })),
          { duration: 380, easing: 'cubic-bezier(0.33, 1, 0.68, 1)', ...keep }).finished;
      }

      // 2) 고른 줄이 가운데에서 양쪽으로 펼쳐짐 — 흰 띠와 파란 알약이 같은 속도로, 사이 여백 6px 유지
      const spread = { duration: 520, easing: 'cubic-bezier(0.34, 1.15, 0.64, 1)', ...keep };
      slider.getAnimations().forEach((an) => an.cancel());
      blob.getAnimations().forEach((an) => an.cancel());
      blob.animate([blobCircle(W, bandTop), blobBand(W, bandTop)], spread);
      selBits.forEach((el) => el.animate([{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1 }], { duration: 640, easing: 'ease-out' }));
      await slider.animate([sliderCircle(W, bandTop), sliderBand(W, bandTop)], spread).finished;

      // 3) 나머지 언어가 고른 줄에서부터 위아래로 쫘르륵 (흰 띠 → 흰 카드, 파란 알약 여백 6 → 4)
      const growT = { duration: 560, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', ...keep };
      slider.getAnimations().forEach((an) => an.cancel());
      blob.getAnimations().forEach((an) => an.cancel());
      blob.animate([blobBand(W, bandTop), blobFull(W, H)], growT);
      const sGrow = slider.animate([sliderBand(W, bandTop), sliderFull(W, bandTop)], growT);
      const selIdx = opts.indexOf(sel);
      others.forEach((el) => {
        el.getAnimations().forEach((an) => an.cancel());
        const d = opts.indexOf(el) - selIdx;           // 위쪽 줄은 위로, 아래쪽 줄은 아래로 펼쳐짐
        el.animate([{ opacity: 0, transform: `translateY(${d > 0 ? -14 : 14}px)` }, { opacity: 1, transform: 'translateY(0)' }],
          { duration: 320, delay: 40 + (Math.abs(d) - 1) * 42, easing: 'cubic-bezier(0.33, 1, 0.68, 1)', fill: 'backwards' });
      });
      await sGrow.finished;
      slider.getAnimations().forEach((an) => an.cancel());
      slider.style.top = `${sliderTop(sel)}px`;
      shaping(false);
    }

    // 퇴장 (Save): 나머지 언어가 고른 줄로 쫘르륵 합쳐짐 + Save 버튼도 글자가 오도미터로 굴러 사라지며
    // 쫀득하게 파란 원으로 모여 고른 줄로 올라가 합쳐짐 → 흰 원 + 파란 원 → (다음 화면) Auto 자리로 돌아감
    async function leave(saveBtn, toIndex = null) {
      const sel = selected();
      const k = scaleOf();
      const { W, H } = geo();
      let bandTop = sel.offsetTop - 5.5;
      const keep = { fill: 'forwards' };
      shaping(true);

      // 1-a) 나머지 언어가 바깥쪽부터 고른 줄로 모이며 사라지고, 흰 카드도 고른 줄 띠로 접힘
      const selIdx = opts.indexOf(sel);
      const far = Math.max(...opts.map((o, i) => Math.abs(i - selIdx)));
      opts.filter((o) => o !== sel).forEach((el) => {
        const d = opts.indexOf(el) - selIdx;
        el.animate([{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: `translateY(${d > 0 ? -14 : 14}px)` }],
          { duration: 260, delay: (far - Math.abs(d)) * 34, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', ...keep });
      });
      const collapseT = { duration: 300 + far * 34, easing: 'cubic-bezier(0.5, 0, 0.3, 1)', ...keep };
      const collapse = blob.animate([blobFull(W, H), blobBand(W, bandTop)], collapseT);
      slider.animate([sliderFull(W, bandTop), sliderBand(W, bandTop)], collapseT);

      // 1-b) 동시에 Save: 글자는 위로 굴러 사라지고(오도미터), 버튼은 바 모양 그대로
      const label = saveBtn.querySelector('.onboarding__btn-label');
      await label.animate([
        { transform: 'translateY(0)', filter: 'blur(0px)', opacity: 1 },
        { transform: 'translateY(-22px)', filter: 'blur(2px)', opacity: 0 },
      ], { duration: 240, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', ...keep }).finished;

      // 2) Save 바가 고른 줄의 파란 바로 경계 없이 녹아들듯 합쳐짐
      //    - 그림자 · 테두리를 먼저 걷어 '겹친 종이' 느낌을 없애고
      //    - 늘리기(scale) 대신 실제 폭 · 높이 · 모서리를 파란 바(330 × 48, 모서리 24)와 똑같이 맞춰
      //      닿는 순간 두 바가 한 덩어리가 되면 그대로 사라짐 (투명해지며 겹쳐 보이지 않게)
      const lr = list.getBoundingClientRect();
      const br = saveBtn.getBoundingClientRect();
      const barW = W - 12;
      const dy = ((lr.top + (bandTop + R / 2) * k) - (br.top + br.height / 2)) / k;
      saveBtn.style.alignSelf = 'center';
      saveBtn.animate([
        { boxShadow: '-1px -1px 1px #f7f7f7, 1px 1px 2px rgba(0, 0, 0, 0.25)', borderColor: 'rgb(87, 117, 167)' },
        { boxShadow: '0 0 0 rgba(0, 0, 0, 0)', borderColor: 'rgba(87, 117, 167, 0)' },
      ], { duration: 160, ...keep });
      await collapse.finished;
      // 고른 줄의 글자 · 아이콘은 Save 가 닿기 전에 먼저 비워 둠 (합쳐진 뒤 글자가 다시 비치지 않게)
      sel.querySelectorAll('.ob-lang__text, .ob-lang__icon').forEach((el) => el.animate([{ opacity: 1 }, { opacity: 0 }],
        { duration: 240, easing: 'ease-out', ...keep }));
      const bw = br.width / k;
      // 올라가는 동안 Save 바가 언어 파란 바 크기(330 × 48, 모서리 24)로 자연스럽게 맞춰지며 겹쳐 합쳐짐
      await saveBtn.animate([
        { transform: 'translateY(0)', width: `${bw}px`, height: '44px', borderRadius: '20px' },
        { transform: `translateY(${dy}px)`, width: `${barW}px`, height: '48px', borderRadius: '24px' },
      ], { duration: 560, easing: 'cubic-bezier(0.45, 0, 0.2, 1)', ...keep }).finished;
      saveBtn.style.visibility = 'hidden';               // 이미 같은 자리 · 같은 모양이라 사라져도 티가 나지 않음 (출렁임 없음)

      // 3) 고른 줄이 흰 원(60) + 파란 원(48) 으로 작아짐 (같은 속도로) — 글자는 이미 비워 둠
      const gather = { duration: 420, easing: 'cubic-bezier(0.45, 0, 0.2, 1)', ...keep };
      slider.getAnimations().forEach((an) => an.cancel());
      blob.getAnimations().forEach((an) => an.cancel());
      blob.animate([blobBand(W, bandTop), blobCircle(W, bandTop)], gather);
      await slider.animate([sliderBand(W, bandTop), sliderCircle(W, bandTop)], gather).finished;

      // 4) 다음 화면에서 고른 줄(Auto) 자리로 원이 미끄러져 돌아감
      if (toIndex !== null && opts[toIndex] && opts[toIndex] !== sel) {
        const to = opts[toIndex].offsetTop - 5.5;
        const glide = { duration: 460, easing: 'cubic-bezier(0.45, 0, 0.2, 1)', ...keep };
        slider.getAnimations().forEach((an) => an.cancel());
        blob.getAnimations().forEach((an) => an.cancel());
        blob.animate([blobCircle(W, bandTop), blobCircle(W, to)], glide);
        await slider.animate([sliderCircle(W, bandTop), sliderCircle(W, to)], glide).finished;
        bandTop = to;
      }
    }

    return { selected, enter, leave };
  }

  const langLists = { 2: setupLangList(pageOf(2)), 3: setupLangList(pageOf(3)) };

  // 다음 단계로: 지금 화면 내용은 페이드아웃(배경만 남음) → 진행 점이 쫀득하게 넘어감 →
  // 새 제목 · 설명 · Save 는 페이드인, 언어 목록은 원에서 펼쳐짐
  async function goStep(next, seamless = false) {
    if ((stepping && !seamless) || onboardingDone) return;
    stepping = true;
    const current = pageOf(onboarding.dataset.step);
    const page = pageOf(next);
    stepProgress(next - 1);
    if (seamless) {
      // 앞 화면 원이 그대로 이어지도록: 제목 · 설명만 바꿔치기하고 목록은 원 상태에서 바로 펼침
      const oldHead = current.querySelector('.ob-lang__head');
      await oldHead.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-in', fill: 'forwards' }).finished;
    } else {
      await current.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: 'ease-in', fill: 'forwards' }).finished;
    }
    onboarding.dataset.step = String(next);
    current.setAttribute('aria-hidden', 'true');
    page.setAttribute('aria-hidden', 'false');
    const soft = [page.querySelector('.ob-lang__head'), page.querySelector('.onboarding__actions--lang')];
    soft.forEach((el, i) => el.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 520, delay: 120 + i * 80, easing: 'ease-out', fill: 'backwards' }));
    const entering = langLists[next].enter(seamless);
    current.getAnimations({ subtree: true }).forEach((an) => an.cancel());
    await entering;
    stepping = false;
  }

  onboarding.querySelector('[data-onboard="skip"]').addEventListener('click', () => goStep(2));

  // 권한 버튼: 파란 원으로 작아짐 → 원과 진행 점 빼고 모두 페이드아웃 → 파란 원이 다음 화면 Auto 자리로 이동 →
  // 흰 원이 뿅 → 이후는 기존과 같이 Auto 가 펼쳐지고 나머지 언어가 쫘르륵
  onboarding.querySelector('[data-onboard="grant"]').addEventListener('click', async (e) => {
    if (stepping || onboardingDone) return;
    stepping = true;
    const btn = e.currentTarget;
    const page1 = pageOf(1);
    const page2 = pageOf(2);
    const k = scaleOf();
    const keep = { fill: 'forwards' };
    stepProgress(1);

    // 1) 버튼 → 파란 원 (글자는 위로 굴러 사라짐)
    btn.querySelector('.onboarding__btn-label').animate([
      { transform: 'translateY(0)', filter: 'blur(0px)', opacity: 1 },
      { transform: 'translateY(-22px)', filter: 'blur(2px)', opacity: 0 },
    ], { duration: 240, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', ...keep });
    btn.style.alignSelf = 'center';
    const shrink = btn.animate([
      { width: `${btn.offsetWidth}px`, height: '44px', borderRadius: '20px' },
      { width: '60px', height: '40px', borderRadius: '20px', offset: 0.55 },
      { width: '44px', height: '50px', borderRadius: '24px', offset: 0.8 },
      { width: '48px', height: '48px', borderRadius: '24px' },
    ], { duration: 520, easing: 'cubic-bezier(0.45, 0, 0.2, 1)', ...keep });

    // 2) 원과 진행 점을 뺀 나머지 페이드아웃
    [...page1.querySelectorAll('.onboarding__intro, .onboarding__card-wrap, [data-onboard="skip"]')]
      .forEach((el) => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: 'ease-in', ...keep }));
    await shrink.finished;

    // 3) 파란 원이 다음 화면 Auto 자리(파란 알약 자리 가운데)로 이동
    const list2 = page2.querySelector('.ob-lang__list');
    const auto2 = page2.querySelector('.ob-lang__opt');
    const lr = list2.getBoundingClientRect();
    const tx = lr.left + lr.width / 2;
    const ty = lr.top + (auto2.offsetTop + 0.5 + 24) * k;
    const br = btn.getBoundingClientRect();
    const dx = (tx - (br.left + br.width / 2)) / k;
    const dy = (ty - (br.top + br.height / 2)) / k;
    await btn.animate([
      { transform: 'translate(0, 0) scale(1, 1)' },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.6}px) scale(0.92, 1.1)`, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy + 3}px) scale(1.06, 0.94)`, offset: 0.85 },
      { transform: `translate(${dx}px, ${dy}px) scale(1, 1)` },
    ], { duration: 560, easing: 'cubic-bezier(0.45, 0, 0.2, 1)', ...keep }).finished;

    // 4) 화면 전환: 날아온 파란 원 = 다음 화면의 파란 알약(원 상태), 그 둘레로 흰 원이 뿅 → 기존 인터랙션
    onboarding.dataset.step = '2';
    page1.setAttribute('aria-hidden', 'true');
    page2.setAttribute('aria-hidden', 'false');
    const soft = [page2.querySelector('.ob-lang__head'), page2.querySelector('.onboarding__actions--lang')];
    soft.forEach((el, i) => el.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 520, delay: 120 + i * 80, easing: 'ease-out', fill: 'backwards' }));
    const entering = langLists[2].enter('blue');
    page1.getAnimations({ subtree: true }).forEach((an) => an.cancel());
    btn.style.alignSelf = '';
    await entering;
    stepping = false;
  });
  // 원문 언어 Save → 번역 언어 화면, 번역 언어 Save → 본 화면 (고른 언어는 Wellow 언어 설정에 반영)
  const pickedText = (step) => langLists[step].selected().querySelector('.ob-lang__text').textContent;
  onboarding.querySelector('[data-onboard="save-from"]').addEventListener('click', async (e) => {
    if (stepping) return;
    stepping = true;
    setValue(langPanel.querySelector('[data-role="source"]'), pickedText(2));
    const nextAuto = 0;                          // 다음 화면은 Auto 에서 시작
    await langLists[2].leave(e.currentTarget, nextAuto); // Save 가 Auto 원 속으로 합쳐지고
    goStep(3, true);                             // 바로 그 원이 다음 화면에서 다시 펼쳐짐
  });
  onboarding.querySelector('[data-onboard="save-to"]').addEventListener('click', async (e) => {
    if (stepping) return;
    stepping = true;
    setValue(langPanel.querySelector('[data-role="target"]'), pickedText(3));
    await langLists[3].leave(e.currentTarget);   // 합쳐져 흰 + 파란 원이 되면
    await goDockStep();                          // 그 자리에서 페이드아웃 → Dock 안내 화면 페이드인
  });

  // ── 온보딩 4 (Figma 67:1423 · 67:1458 · 67:1493): Dock 위치 안내 ──
  // 작은 화면 속 Dock 이 위 가운데 → 오른쪽 가운데 → 왼쪽 아래 → 다시 위로, 집어 들 듯 살짝 커졌다 놓이며 반복 (스마트 애니메이트)
  const dock = onboarding.querySelector('.ob-dock__dock');
  let dockLoop = null;
  function startDockLoop() {
    if (dockLoop) return;
    const P1 = { left: '37.42px', top: '-1.58px' };
    const P2 = { left: '68.42px', top: '96.42px' };
    const P3 = { left: '14.42px', top: '197.42px' };
    const lift = { transform: 'scale(1.1)', boxShadow: '0 6px 12px rgba(87, 117, 167, 0.35)' };
    const rest = { transform: 'scale(1)', boxShadow: '0 0 0 rgba(87, 117, 167, 0)' };
    const ease = 'cubic-bezier(0.45, 0, 0.2, 1)';
    dockLoop = dock.animate([
      { ...P1, ...rest, offset: 0 },
      { ...P1, ...rest, offset: 0.14, easing: 'ease-out' },
      { ...P1, ...lift, offset: 0.18, easing: ease },
      { ...P2, ...lift, offset: 0.32, easing: 'ease-in' },
      { ...P2, ...rest, offset: 0.36 },
      { ...P2, ...rest, offset: 0.48, easing: 'ease-out' },
      { ...P2, ...lift, offset: 0.52, easing: ease },
      { ...P3, ...lift, offset: 0.66, easing: 'ease-in' },
      { ...P3, ...rest, offset: 0.70 },
      { ...P3, ...rest, offset: 0.82, easing: 'ease-out' },
      { ...P3, ...lift, offset: 0.86, easing: ease },
      { ...P1, ...lift, offset: 0.97, easing: 'ease-in' },
      { ...P1, ...rest, offset: 1 },
    ], { duration: 6200, iterations: Infinity });
  }

  // 흰 + 파란 원이 된 그 자리에서 페이드아웃 → 진행 점은 쫀득하게 넘어가고 → Dock 안내 화면 페이드인
  async function goDockStep() {
    const current = pageOf(3);
    const page = pageOf(4);
    stepProgress(3);
    await current.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 360, easing: 'ease-in', fill: 'forwards' }).finished;
    onboarding.dataset.step = '4';
    current.setAttribute('aria-hidden', 'true');
    page.setAttribute('aria-hidden', 'false');
    current.getAnimations({ subtree: true }).forEach((an) => an.cancel());
    [page.querySelector('.ob-lang__head'), page.querySelector('.ob-dock'), page.querySelector('.onboarding__actions--lang')]
      .forEach((el, i) => el.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 560, delay: 80 + i * 90, easing: 'ease-out', fill: 'backwards' }));
    startDockLoop();
    stepping = false;
  }

  // Get started (Figma 206:1970 중간 로딩):
  // 버튼이 파란 원으로 작아짐 · 배경 빼고 모두 페이드아웃 → 원이 화면 가운데로 → 뿅 + 로고가 오도미터로 →
  // 동시에 WE / Follow 가 위로 슬라이드되며 나왔다 들어감 → 로고가 오도미터로 빠지고 원은 위로 화면 밖 →
  // 네비게이션 바가 화면 밖(위)에서 슬라이드인 해 짠 펼쳐짐
  const loader = onboarding.querySelector('.ob-loader');
  onboarding.querySelector('[data-onboard="start"]').addEventListener('click', async (e) => {
    if (stepping || onboardingDone) return;
    stepping = true;
    onboardingDone = true;
    const btn = e.currentTarget;
    const page = pageOf(4);
    const keep = { fill: 'forwards' };
    const k = scaleOf();
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));

    // 1) 버튼 → 파란 원(48), 배경 빼고 모두 페이드아웃 (진행 점 포함)
    btn.querySelector('.onboarding__btn-label').animate([
      { transform: 'translateY(0)', filter: 'blur(0px)', opacity: 1 },
      { transform: 'translateY(-22px)', filter: 'blur(2px)', opacity: 0 },
    ], { duration: 240, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', ...keep });
    btn.style.alignSelf = 'center';
    const shrink = btn.animate([
      { width: `${btn.offsetWidth}px`, height: '44px', borderRadius: '20px' },
      { width: '60px', height: '40px', borderRadius: '20px', offset: 0.55 },
      { width: '44px', height: '50px', borderRadius: '24px', offset: 0.8 },
      { width: '48px', height: '48px', borderRadius: '24px' },
    ], { duration: 520, easing: 'cubic-bezier(0.45, 0, 0.2, 1)', ...keep });
    [page.querySelector('.ob-lang__head'), page.querySelector('.ob-dock'), onboarding.querySelector('.onboarding__progress'), onboarding.querySelector('.onboarding__status')]
      .forEach((el) => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: 'ease-in', ...keep }));
    await shrink.finished;

    // 2) 원이 화면 가운데(로딩 원 자리)로 쫀득하게 이동
    loader.classList.add('is-on');
    const circle = loader.querySelector('.ob-loader__circle');
    const cr = circle.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    const dx = (cr.left + cr.width / 2 - (br.left + br.width / 2)) / k;
    const dy = (cr.top + cr.height / 2 - (br.top + br.height / 2)) / k;
    circle.style.visibility = 'hidden';
    await btn.animate([
      { transform: 'translate(0, 0) scale(1, 1)' },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.6}px) scale(0.92, 1.12)`, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy + 4}px) scale(1.06, 0.94)`, offset: 0.85 },
      { transform: `translate(${dx}px, ${dy}px) scale(1, 1)` },
    ], { duration: 600, easing: 'cubic-bezier(0.45, 0, 0.2, 1)', ...keep }).finished;
    circle.style.visibility = '';
    btn.style.visibility = 'hidden';

    // 3) 뿅: 원이 톡 튐 + 로고가 아래에서 굴러 올라옴 (오도미터)
    circle.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.16)', offset: 0.35 }, { transform: 'scale(0.96)', offset: 0.7 }, { transform: 'scale(1)' }],
      { duration: 460, easing: 'ease-out' });
    const logo = circle.querySelector('.ob-loader__logo');
    logo.animate([
      { transform: 'translateY(100%)', filter: 'blur(2.5px)', opacity: 0.3 },
      { transform: 'translateY(0)', filter: 'blur(0px)', opacity: 1 },
    ], { duration: 460, delay: 80, easing: 'cubic-bezier(0.34, 1.3, 0.64, 1)', ...keep });

    // 4) 동시에 WE / Follow 가 아래에서 위로 슬라이드되며 나타남
    const words = [...loader.querySelectorAll('.ob-loader__word span')];
    words.forEach((w, i) => w.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }],
      { duration: 480, delay: 140 + i * 90, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', ...keep }));
    await wait(140 + 90 + 480 + 700);   // 잠깐 머묾

    // 5) WE / Follow 는 위로 슬라이드되며 들어가고, 로고는 위로 굴러 빠짐 (오도미터)
    words.forEach((w, i) => w.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }],
      { duration: 380, delay: i * 70, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', ...keep }));
    await logo.animate([
      { transform: 'translateY(0)', filter: 'blur(0px)', opacity: 1 },
      { transform: 'translateY(-100%)', filter: 'blur(2.5px)', opacity: 0.3 },
    ], { duration: 320, delay: 80, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', ...keep }).finished;

    // 6) 원이 위로 올라가 화면 밖으로 + 크림 배경이 걷힘
    const up = -((cr.top - phone.getBoundingClientRect().top) / k) - 80;
    pill.style.opacity = '0';                    // 본 화면이 드러나도 네비게이션 바는 아직 숨김
    onboarding.animate([{ backgroundColor: 'rgba(250, 244, 233, 1)' }, { backgroundColor: 'rgba(250, 244, 233, 0)' }],
      { duration: 520, delay: 160, easing: 'ease-out', ...keep });
    await circle.animate([
      { transform: 'translateY(0) scale(1, 1)' },
      { transform: 'translateY(10px) scale(1.06, 0.92)', offset: 0.15 },
      { transform: `translateY(${up * 0.6}px) scale(0.9, 1.14)`, offset: 0.6 },
      { transform: `translateY(${up}px) scale(0.86, 1.04)` },
    ], { duration: 620, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', ...keep }).finished;

    onboarding.classList.add('is-gone');
    onboarding.setAttribute('aria-hidden', 'true');
    dockLoop?.cancel();
    // 7) 원이 완전히 나가고 1초 뒤, 네비게이션 바가 화면 밖(위)에서 슬라이드인 → 짠 펼쳐짐
    await wait(1000);
    await navEnter();
    stepping = false;
  });

  // 네비게이션 바 등장 = 끄기(Yes) 퇴장의 정반대:
  // 위에서 베이지 원(44) + 파란 원(36) 이 내려와 자리 잡고 → 3칸 bar 로 펼쳐지며 → 아이콘이 오도미터로 굴러 들어옴
  async function navEnter() {
    const keep = { fill: 'forwards' };
    const wellowItem = tabs[1];
    const odoBox = wellowItem.querySelector('.odo');
    const iconParts = tabs.map((t) => (t.dataset.mode === 'wellow' ? [faces[face]] : [...t.children]));
    // 원 상태로 바로 바꿈 — 파란 원 · 칸이 옆으로 미끄러지는 전환이 끼어들면 떨어지는 동안 곡선처럼 보이므로 잠시 끔
    pill.classList.add('no-transition', 'is-collapsed');
    knob.style.left = `${PAD}px`;
    void pill.offsetWidth;
    const fullW = 188;
    // 시작 상태: 원 크기
    pill.animate([{ width: '44px' }, { width: '44px' }], { duration: 600, ...keep });
    knob.animate([{ width: '36px' }, { width: '36px' }], { duration: 600, ...keep });
    wellowItem.animate([{ width: '36px' }, { width: '36px' }], { duration: 600, ...keep });
    odoBox.animate([{ width: '36px' }, { width: '36px' }], { duration: 600, ...keep });
    iconParts.flat().forEach((el) => el.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 1600, fill: 'backwards' }));
    pill.style.opacity = '';

    // 1) 위에서 미끄러져 내려오며 커짐 (종료 때 82% 크기 · 위로 140px 에서 시작)
    await pill.animate([
      { transform: 'translateY(-160px)', scale: '0.82', opacity: 1 },   // 원이 나간 화면 밖(위)에서 가운데 수직으로 떨어짐
      { transform: 'translateY(8px)', scale: '1', opacity: 1, offset: 0.75 },
      { transform: 'translateY(0)', scale: '1', opacity: 1 },
    ], { duration: 600, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }).finished;

    // 2) 3칸 bar 로 펼쳐짐 — 파란 원은 Wellow 칸(가운데)으로
    [pill, knob, wellowItem, odoBox].forEach((el) => el.getAnimations().forEach((an) => an.cancel()));
    pill.classList.remove('no-transition');
    const spread = { duration: 520, easing: 'cubic-bezier(0.34, 1.2, 0.64, 1)' };
    pill.classList.remove('is-collapsed');
    pill.animate([{ width: '44px' }, { width: `${fullW}px` }], spread);
    wellowItem.animate([{ width: '36px' }, { width: '60px' }], spread);
    odoBox.animate([{ width: '36px' }, { width: '60px' }], spread);
    knob.style.left = `${PAD + activeIndex * SLOT}px`;
    knob.animate([{ width: '36px', left: `${PAD}px` }, { width: '60px', left: `${PAD + activeIndex * SLOT}px` }], spread);

    // 3) 아이콘 · 이름이 아래에서 굴러 올라오며 나타남 (오도미터)
    await new Promise((r) => setTimeout(r, 220));
    const rolls = iconParts.map((parts, i) => Promise.all(parts.map((el) => {
      el.getAnimations().forEach((an) => an.cancel());
      return el.animate([
        { transform: 'translateY(36px)', filter: 'blur(2.5px)', opacity: 0.2 },
        { filter: 'blur(1px)', opacity: 0.9, offset: 0.55 },
        { transform: 'translateY(0)', filter: 'blur(0px)', opacity: 1 },
      ], { duration: 460, delay: i * 80, easing: 'cubic-bezier(0.34, 1.3, 0.64, 1)', fill: 'backwards' }).finished;
    })));
    await Promise.all(rolls);   // 펼쳐진 뒤 출렁임(꿀꺽) 없이 그대로 멈춤
  }


  // ── 시작 화면 바로 가기 (데모 페이지 상단 Onboarding / Main / Setting, 또는 주소 #main · #settings) ──
  const START = window.WELLOW_START || location.hash.slice(1);
  if (START === 'main' || START === 'settings') {
    onboardingDone = true;                  // 온보딩 없이 본 화면부터
    onboarding.classList.add('is-gone');
    onboarding.setAttribute('aria-hidden', 'true');
    // Setting: 3칸 바가 잠깐 보인 뒤 → Wellow 로 모이고 → 설정이 펼쳐짐 (Wellow 를 한 번 더 누른 것과 같음)
    if (START === 'settings') setTimeout(toggleSettings, 700);
    else {
      // Main: Get started 뒤처럼 네비게이션 바가 화면 밖(위)에서 떨어져 들어와 펼쳐지는 것부터
      pill.style.opacity = '0';
      setTimeout(navEnter, 600);
    }
  }

  // 창 높이가 프레임(812px)보다 낮으면 비율 유지 축소
  const device = document.getElementById('device');
  const fit = () => {
    const scale = Math.min(1, (window.innerHeight - 48) / device.offsetHeight, (window.innerWidth - 32) / device.offsetWidth);
    device.style.setProperty('--fit', scale);
  };
  fit();
  window.addEventListener('resize', fit);
})();
