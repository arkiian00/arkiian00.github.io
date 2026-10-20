/* Liquid Distortion — 요소(글자·자식 요소)의 외곽선이 물결처럼 불규칙하게 계속 일렁임
 *
 *  사용법: <span data-liquid data-liquid-speed="1" data-liquid-scale="3" data-liquid-frequency="0.04">…</span>
 *   - speed     : 일렁이는 속도 (기본 1)
 *   - scale     : 왜곡 세기 = feDisplacementMap scale, px (기본 3)
 *   - frequency : 물결의 조밀함 = feTurbulence baseFrequency (기본 0.04)
 *  또는 JS: window.LiquidDistort(el, { speed, scale, frequency }) → { set(opts), destroy() }
 *
 *  구현: 요소마다 인라인 SVG 필터(feTurbulence → feDisplacementMap) 하나.
 *        requestAnimationFrame 에서 baseFrequency 를 사인·코사인 조합으로 부드럽고 불규칙하게 바꿔 끊임없이 일렁임
 *        (상태/리렌더 없이 DOM 속성만 직접 바꿈).
 *  제약: 순수한 형태 변위만 — 색 분리·그라데이션·글로우 없음. 색은 원래 요소 그대로 (변위 맵은 R·G 채널만 위치 계산에 씀).
 *        화면에 보이지 않을 때(탭 숨김 · 상세 페이지 · 투명)는 프레임을 멈춤.
 */
(() => {
  const NS = "http://www.w3.org/2000/svg";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let host = null;
  function defs() {
    if (host) return host;
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.setAttribute("aria-hidden", "true");
    svg.style.position = "absolute";
    host = document.createElementNS(NS, "defs");
    svg.appendChild(host);
    document.body.appendChild(svg);
    return host;
  }

  let n = 0;
  const live = new Set();
  let raf = 0;

  function LiquidDistort(el, opts = {}) {
    const o = { speed: 1, scale: 3, frequency: 0.04 };
    for (const k in opts) if (opts[k] !== undefined) o[k] = opts[k];
    const id = `liquid-${++n}`;
    const f = document.createElementNS(NS, "filter");
    f.id = id;
    // 변위가 상자 밖으로 나가도 잘리지 않게 여유
    f.setAttribute("x", "-10%"); f.setAttribute("y", "-30%");
    f.setAttribute("width", "120%"); f.setAttribute("height", "160%");
    f.setAttribute("color-interpolation-filters", "sRGB");
    const turb = document.createElementNS(NS, "feTurbulence");
    turb.setAttribute("type", "fractalNoise");
    turb.setAttribute("numOctaves", "2");
    turb.setAttribute("seed", String(3 + n));
    turb.setAttribute("result", "noise");
    const disp = document.createElementNS(NS, "feDisplacementMap");
    disp.setAttribute("in", "SourceGraphic");
    disp.setAttribute("in2", "noise");
    disp.setAttribute("xChannelSelector", "R");
    disp.setAttribute("yChannelSelector", "G");
    f.append(turb, disp);
    defs().appendChild(f);

    const prevFilter = el.style.filter;
    el.style.filter = `url(#${id})`;
    const item = {
      el, o, turb, disp, phase: Math.random() * 100,
      set(next) { Object.assign(o, next); disp.setAttribute("scale", String(o.scale)); },
      destroy() { live.delete(item); f.remove(); el.style.filter = prevFilter; },
    };
    item.set({});
    draw(item, performance.now() / 1000);
    if (!reduce) { live.add(item); start(); }
    return item;
  }

  // 물결: 서로 다른 속도의 사인·코사인을 겹쳐 반복이 느껴지지 않게, 가로·세로 조밀함을 따로 일렁임
  function draw(it, t) {
    const { speed, frequency } = it.o;
    const s = t * speed + it.phase;
    const fx = frequency * (1 + 0.18 * Math.sin(s * 0.9) + 0.09 * Math.cos(s * 1.7 + 1.3));
    const fy = frequency * (1.35 + 0.22 * Math.cos(s * 0.7 + 0.4) + 0.1 * Math.sin(s * 2.3));
    it.turb.setAttribute("baseFrequency", `${fx.toFixed(5)} ${fy.toFixed(5)}`);
  }

  const visible = (el) => !document.hidden && el.isConnected && el.getClientRects().length > 0 &&
    !document.body.classList.contains("is-detail") && +getComputedStyle(el).opacity > 0.01;

  function tick(now) {
    raf = 0;
    if (!live.size) return;
    const t = now / 1000;
    let any = false;
    for (const it of live) if (visible(it.el)) { draw(it, t); any = true; }
    // 보이는 게 없으면 천천히 다시 확인 (프레임 비용 없음)
    if (any) raf = requestAnimationFrame(tick);
    else setTimeout(start, 500);
  }
  function start() { if (!raf && live.size) raf = requestAnimationFrame(tick); }
  document.addEventListener("visibilitychange", start);

  window.LiquidDistort = LiquidDistort;
  for (const el of document.querySelectorAll("[data-liquid]")) {
    const d = el.dataset;
    LiquidDistort(el, {
      speed: d.liquidSpeed ? +d.liquidSpeed : undefined,
      scale: d.liquidScale ? +d.liquidScale : undefined,
      frequency: d.liquidFrequency ? +d.liquidFrequency : undefined,
    });
  }
})();

/* Per-character floating — 글자마다 물 위에 뜬 듯 (Scroll down — data-float)
 *  - 지그재그: 이웃한 글자끼리 늘 반대로 오르내리고, 기울기도 서로 반대로 와리가리
 *  - 불규칙: 글자마다 높이(1 ~ 2 px)·기울기 폭이 다르고 따로 천천히 출렁이며, 박자도 살짝 밀렸다 당겨짐
 *  - data-float-speed (기본 1.6 rad/s). 리렌더 없이 transform 만 직접. 안 보일 때는 멈춤.
 *  data-drip-static(물방울 글자) 안이면 보이는 유리 글자(.drip__glass)를 글자 단위로 나눔
 *
 *  문구 바뀜 (window.ScrollHintSay(text)) — 페이드 없이:
 *   1) 흡수: 글자 가운데에 글자 두께만 한 가로 막대가 생기고, 글자들이 모양 그대로 위·아래 끝부터 막대로 빨려 들어감
 *   2) 늘어남/줄어듦: 막대가 다음 문구의 폭으로 늘어나거나 줄어듦
 *   3) 나옴: 막대에서 새 글자들이 위·아래로 솟아 나오며 일렁이다(굴절) 또렷해짐
 */
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const AMP_MIN = 1, AMP_MAX = 2;                 // 세로 폭 (px)
  const ROT_MIN = 3, ROT_MAX = 7;                 // 기울기 폭 (deg)
  const PRESS_MS = 300, STRETCH_MS = 380, OPEN_MS = 620;   // 눌림 · 폭 바뀜 · 나옴
  const hash = (i) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
  const clamp01 = (v) => Math.min(Math.max(v, 0), 1);

  function split(target, text) {
    if (text !== undefined) target.textContent = text;
    text = target.textContent;
    target.textContent = "";
    const chars = [];
    let k = -1;                                                       // 공백을 뺀 글자 순번 (지그재그 짝·홀)
    [...text].forEach((ch, i) => {
      if (ch.trim()) k++;
      const s = document.createElement("span");
      s.textContent = ch;
      s.style.display = "inline-block";
      s.style.whiteSpace = "pre";
      s.style.willChange = "transform";
      target.appendChild(s);
      chars.push({
        el: s,
        dir: k % 2 ? -1 : 1,
        ampY: AMP_MIN + (AMP_MAX - AMP_MIN) * hash(i),
        rot: ROT_MIN + (ROT_MAX - ROT_MIN) * hash(i + 17),
        phase: (hash(i + 31) - 0.5) * 0.5,
        p2: hash(i + 71) * 6.28,
        cx: 0,
      });
    });
    return chars;
  }
  function measure(it) {
    const w = it.box.offsetWidth;
    it.mid = w / 2;
    for (const c of it.chars) c.cx = c.el.offsetLeft + c.el.offsetWidth / 2;
  }

  const items = [];
  for (const el of document.querySelectorAll("[data-float]")) {
    const glass = el.querySelector(".drip__glass");
    const ink = el.querySelector(".drip__ink");
    const box = glass || el;
    const it = { el, box, ink, text: box.textContent, chars: split(box), speed: +(el.dataset.floatSpeed || 1.6), g: 0, morph: null, want: null };
    if (ink) split(ink);                                  // 숨은 원래 글자도 같은 폭 유지
    items.push(it);
  }
  if (!items.length) return;
  requestAnimationFrame(() => items.forEach(measure));
  addEventListener("resize", () => items.forEach(measure));
  document.fonts && document.fonts.ready.then(() => items.forEach(measure));

  // ---- 문구 바꾸기 ----
  function setText(it, text) {
    it.text = text;
    it.chars = split(it.box, text);
    if (it.ink) split(it.ink, text);
    measure(it);
  }
  function say(text, el) {
    const it = el ? items.find((x) => x.el === el) : items[0];
    if (!it) return;
    it.want = text;
    if (reduce) { if (text !== it.text) setText(it, text); it.want = null; return; }
    if (it.morph) return;                                 // 진행 중이면 모였을 때 최신 문구로 바뀜
    if (text === it.text) { it.want = null; return; }
    it.morph = { phase: "press", t0: performance.now(), from: it.g };
    start();
  }
  window.ScrollHintSay = say;

  const visible = (el) => !document.hidden && el.getClientRects().length > 0 &&
    !document.body.classList.contains("is-detail") && +getComputedStyle(el).opacity > 0.01;
  const easeIn = (t) => t * t * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  // g: 모인 정도 (0 → 1) — 부풂(dilate)·흐림, wob: 일렁임(굴절)
  function fxSet(fx, g, wob) {
    if (fx.dil) fx.dil.setAttribute("radius", (0.2 + 0.35 * Math.sin(Math.PI * g)).toFixed(2));   // 빨려 들어가는 동안만 막대와 살짝 녹아 붙음
    fx.blur.setAttribute("stdDeviation", (0.15 * g).toFixed(2));
    fx.disp.setAttribute("scale", Math.max(0, wob).toFixed(2));
  }
  function stepMorph(it, now) {
    const m = it.morph;
    if (!m) return;
    const fx = window.DripFx ? window.DripFx(it.box.closest(".drip")) : null;
    const wantNew = it.want !== null && it.want !== it.text;
    if (m.phase === "press") {
      // 1) 제자리에서 위아래로 눌려 가로 막대로 (글자끼리 부풀어 붙음)
      const k = clamp01((now - m.t0) / PRESS_MS);
      it.g = m.from + (1 - m.from) * easeIn(k);
      if (fx) fxSet(fx, it.g, 0);
      if (k >= 1) {
        const w0 = it.box.offsetWidth;                      // 지금 막대 폭
        if (wantNew) setText(it, it.want);                  // 막대 안에서 글자가 바뀜
        it.want = null;
        const w1 = it.box.offsetWidth || 1;
        it.sx = w0 / w1;                                    // 새 글자 폭 기준으로 예전 폭만큼 늘려(줄여) 둔 채 시작
        it.morph = { phase: "stretch", t0: now, from: it.sx };
      }
    } else if (m.phase === "stretch") {
      // 2) 막대가 다음 문구의 폭으로 늘어나거나 줄어듦
      if (wantNew) {                                        // 그 사이 또 바뀌면 지금 보이는 폭에서 다시 맞춤
        const cur = it.box.offsetWidth * it.sx;
        setText(it, it.want);
        it.want = null;
        it.sx = cur / (it.box.offsetWidth || 1);
        it.morph = { phase: "stretch", t0: now, from: it.sx };
        return;
      }
      const k = clamp01((now - m.t0) / STRETCH_MS);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      it.sx = m.from + (1 - m.from) * e;
      if (fx) fxSet(fx, 1, 2 * Math.sin(Math.PI * k));     // 늘어나며 살짝 출렁
      if (k >= 1) { it.sx = 1; it.morph = { phase: "open", t0: now }; }
    } else {
      // 3) 막대에서 새 글자가 위아래로 펴지며 일렁이다 또렷해짐
      const k = clamp01((now - m.t0) / OPEN_MS);
      if (wantNew && k > 0.2) { it.morph = { phase: "press", t0: now, from: it.g }; return; }
      it.g = 1 - easeOut(k);
      if (fx) {
        fxSet(fx, it.g, 9 * Math.sin(Math.PI * Math.min(1, k * 1.15)) * (1 - k * 0.6));
        fx.noise.setAttribute("baseFrequency", `${(0.06 + 0.012 * Math.sin(now / 260)).toFixed(4)} ${(0.09 + 0.015 * Math.cos(now / 330)).toFixed(4)}`);
      }
      if (k >= 1) {
        it.g = 0;
        if (fx) fxSet(fx, 0, 0);
        it.morph = null;
        if (it.want !== null && it.want !== it.text) say(it.want, it.el);
      }
    }
  }

  let raf = 0;
  function tick(now) {
    raf = 0;
    const t = now / 1000;
    let any = false;
    for (const it of items) {
      if (it.morph) stepMorph(it, now);
      if (!visible(it.el)) { if (it.morph) any = true; continue; }
      any = true;
      const g = it.g;
      // 가로 막대: 글자들이 눌려 들어가 하나로 이어지는 몸통 (유리 필터 안 — 같은 물방울 유리로 그려짐)
      if (!it.bar || !it.bar.isConnected) {
        it.bar = document.createElement("span");
        it.bar.className = "hint-bar";
        it.box.appendChild(it.bar);
        it._barG = -1;
      }
      // 막대는 흡수가 시작되자마자 먼저 나타나 글자를 받아들임
      const bg = Math.min(1, g * 4);
      if (it._barG !== bg) { it.bar.style.transform = `scaleY(${bg.toFixed(3)})`; it._barG = bg; }
      const bx = it.sx === undefined ? 1 : it.sx;
      if (it._bx !== bx) { it.box.style.transform = bx === 1 ? "" : `scaleX(${bx.toFixed(4)})`; it._bx = bx; }
      for (const c of it.chars) {
        let y = 0, deg = 0;
        if (!reduce) {
          const a = t * it.speed + c.phase + 0.28 * Math.sin(t * it.speed * 0.23 + c.p2);
          const sw = 0.5 + 0.5 * Math.sin(t * it.speed * 0.37 + c.p2);
          const amp = Math.min(AMP_MAX, Math.max(AMP_MIN, c.ampY * 0.5 + (AMP_MIN + (AMP_MAX - AMP_MIN) * sw) * 0.5));
          const r = (Math.sin(a + 0.5) + 0.18 * Math.sin(a * 1.87 + c.p2 + 1.1)) / 1.18;
          y = c.dir * amp * Math.sin(a);
          deg = c.dir * c.rot * (0.75 + 0.25 * sw) * r;
        }
        // 흡수: 글자 모양은 그대로, 위·아래 끝부터 가운데 막대 쪽으로 빨려 들어가 사라짐 (찌그러짐 없음, g 0 → 1)
        c.el.style.transform = `translate3d(0, ${(y * (1 - g)).toFixed(2)}px, 0) rotate(${(deg * (1 - g)).toFixed(2)}deg)`;
        const cut = g >= 0.999 ? 50.5 : 50 * g;
        const clip = g > 0 ? `inset(${cut.toFixed(2)}% -4px ${cut.toFixed(2)}% -4px)` : "";
        if (c._clip !== clip) { c.el.style.clipPath = clip; c._clip = clip; }
      }
    }
    if (any) raf = requestAnimationFrame(tick);
    else setTimeout(start, 500);
  }
  function start() { if (!raf) raf = requestAnimationFrame(tick); }
  document.addEventListener("visibilitychange", start);
  start();

  // ---- 어디에 커서가 있느냐에 따라 Scroll down 문구 (히어로 AHYUN · 프로젝트 카드 · About 경력) ----
  const DEFAULT = "Scroll down";
  const CAREER = {
    "Framer Market": "Design Engineering",
    "Uniquegood Company": "Graphic Design",
    "RocklyAlive": "Fabric Graphic Design",
    "Korea Broadcast Art Center": "Graphic / Coordinator",
    "Freelancer illustrator": "Book Cover Design",
    "Graphic Tshirt Brand": "Fashion Graphic Design",
    "F&F MLB(Korea Fashion Marketing)": "Marketing",
    "Luxury Fashion Grapic": "Fashion Graphic Design",
    "Ever&Ever": "[Funding Project] Graphic Design",
    "Konkuk University Graduation": "Craft Design",
  };
  let hoverText = null;                                   // 카드·경력 줄 위 (요소 호버)
  let overAhyun = false;
  const update = () => say(hoverText || (overAhyun ? "Hover" : DEFAULT));

  // 프로젝트 목록: 버튼(카드)을 감싸는 프레임에 들어오면 View — 안의 카드 위에서도 그대로 View 유지
  const plist = document.getElementById("plist");
  if (plist) {
    plist.addEventListener("pointerenter", () => { hoverText = "View"; update(); });
    plist.addEventListener("pointerleave", () => { hoverText = null; update(); });
  }
  for (const li of document.querySelectorAll(".about__list li")) {
    const first = li.firstElementChild;                  // drip.js 가 원래 글자를 .drip__ink 에 옮겨 둠
    const name = first ? (first.querySelector(".drip__ink") || first).textContent.trim() : "";
    const label = CAREER[name];
    if (!label) continue;
    // 마우스: 호버 동안 / 터치(모바일): 누르면 그 경력 문구로 바뀌고 다른 경력을 누를 때까지 그대로 (손을 떼도 돌아가지 않음)
    li.addEventListener("pointerenter", (e) => { if (e.pointerType === "touch") return; hoverText = label; update(); });
    li.addEventListener("pointerleave", (e) => { if (e.pointerType === "touch") return; hoverText = null; update(); });
    li.addEventListener("click", () => { hoverText = label; update(); });
  }
  // AHYUN 은 pointer-events 가 없어 화면 위치로 판단 (다 떠올라 있고 히어로 화면일 때만)
  const name = document.getElementById("name");
  const stage = document.getElementById("stage");
  let lastCheck = 0;
  addEventListener("pointermove", (e) => {
    const now = performance.now();
    if (now - lastCheck < 50) return;
    lastCheck = now;
    let on = false;
    if (name && window.IntroUp && window.IntroUp() && !stage.classList.contains("is-project") && !document.body.classList.contains("is-detail")) {
      const r = name.getBoundingClientRect();
      on = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    }
    if (on !== overAhyun) { overAhyun = on; update(); }
  }, { passive: true });
  // 스크롤로 장면이 바뀌어 AHYUN 이 가라앉으면 원래 문구로
  setInterval(() => {
    if (overAhyun && !(window.IntroUp && window.IntroUp())) { overAhyun = false; update(); }
    // 터치로 고른 경력 문구는 About 경력이 화면에서 사라지면 원래 문구로
    if (hoverText && hoverText !== "View" && !document.querySelector(".about__careers.is-live")) { hoverText = null; update(); }
  }, 300);
})();
