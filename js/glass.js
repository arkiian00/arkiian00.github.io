/**
 * 목차 카드 호버 → 카드 자체가 두꺼운 유리로 '도잉' 실체화 (레퍼런스: 투명 알약 유리)
 *  - 모서리가 둥글게 부풀고 살짝 커지며 떠오름 (스프링 → 한 번 출렁)
 *  - 카드 이미지가 유리 두께만큼 굴절: 가운데는 살짝 확대, 테두리는 안쪽으로 휘어 감김 (feDisplacementMap)
 *    글자는 굴절하지 않아 선명, 굴절된 이미지는 흰 림의 둥근 모서리 안으로 잘림
 *  - 얇은 밝은 림 · 아래쪽 안쪽 그늘 · 옅은 무지개 번짐 · 마우스를 따라 움직이는 반사광
 *  - 마우스 위치만큼 3D 로 기울어짐, 바닥 그림자가 깊어짐
 *  - 마우스가 나가면 다시 평평한 카드로 녹아듦
 *  가벼움: 굴절 필터는 호버 중인 카드(약 340×80)에만 걸고 쉬면 떼어냄, 움직임은 transform,
 *          변위 맵은 크기별로 한 번만 생성, 모든 카드가 멈추면 루프 정지
 *  프로젝트 목록(.pcard)과 상세 페이지 Next 목록 카드 모두 (Next 목록은 나중에 붙으므로 위임으로 처리)
 */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const defs = document.querySelector("svg.defs");
  if (!defs || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const CARD_SEL = ".pcard, .next__list > div:not([aria-hidden])";
  // 바 버튼: Hello(home) · Project · About · 프로젝트 화면 Project/About/Home · 상세 페이지 Project/Next
  const BAR_SEL = "#nav, #barTop, #barBottom, #pbar, #pabout, #phome, #dproj, #dabout, #dhome, .detail__bar, #dback, .get-btn";   // #dback: 상세 페이지 되돌아가기 방울
  const SEL = `${CARD_SEL}, ${BAR_SEL}`;
  const GUIDE = 0.22;            // 바: 가장자리에서 가이드선까지 거리 (높이 대비) — 이 부근이 가장 투명
  const CLEAR = 0.1;             // 가장 투명한 곳의 불투명도
  const CARD_SEMI = 0.7;         // 목록 카드: 반투명 부분의 불투명도 (카드 배경·이미지)
  const CARD_CLEAR = 0.5;        // 목록 카드: 가장 투명한 곳의 불투명도
  const BULGE = 16;              // 모서리가 이만큼 더 둥글어짐 (최대 높이의 절반 = 알약)
  const MAG = 0.035;             // 가운데 확대
  const RIM = 10;                // 테두리에서 안쪽 내용을 끌어오는 거리 (px)
  const BEZEL = 24;              // 휘는 테두리 폭 (px)
  const LIFT = 4, GROW = 0.045;  // 떠오름 · 커짐
  const TILT_X = 6, TILT_Y = 8;  // 최대 기울기 (deg)
  const MAT = { stiffness: 0.07, damping: 0.2, mass: 1 };     // 실체화 '도잉'
  const TILT = { stiffness: 0.08, damping: 0.34, mass: 1 };

  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const step1D = (s, target, P) => {
    s.v += (P.stiffness * (target - s.x) - P.damping * s.v) / P.mass;
    s.x += s.v;
  };

  // ---- 변위 맵 (둥근 사각형 유리판, 크기별 1회) ----
  const maps = {};
  function getMap(w, h, rr) {
    const key = `${w}x${h}x${rr}`;
    if (maps[key]) return maps[key];
    const r = rr, hw = w / 2, hh = h / 2;
    const S = Math.ceil((MAG * hw + RIM) * 2 + 4);
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const ctx = cv.getContext("2d");
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const px = x + 0.5 - hw, py = y + 0.5 - hh;
        const qx = Math.abs(px) - (hw - r), qy = Math.abs(py) - (hh - r);
        const ox = Math.max(qx, 0), oy = Math.max(qy, 0), out = Math.hypot(ox, oy);
        const depth = r - out - Math.min(Math.max(qx, qy), 0);     // 테두리까지 거리 (안쪽 +)
        let dx = -px * MAG, dy = -py * MAG;
        if (depth > 0 && depth < BEZEL) {
          let nx, ny;                                               // 바깥 방향 법선
          if (out > 0) { nx = Math.sign(px) * ox / out; ny = Math.sign(py) * oy / out; }
          else if (qx > qy) { nx = Math.sign(px); ny = 0; }
          else { nx = 0; ny = Math.sign(py); }
          const t = 1 - depth / BEZEL, k = RIM * t * t;
          dx -= nx * k; dy -= ny * k;
        }
        const i = (y * w + x) * 4;
        d[i] = clamp(Math.round(255 * (dx / S + 0.5)), 0, 255);
        d[i + 1] = clamp(Math.round(255 * (dy / S + 0.5)), 0, 255);
        d[i + 2] = 128;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return (maps[key] = { url: cv.toDataURL(), S });
  }

  // ---- 카드별 준비 (처음 호버할 때 한 번) ----
  let uid = 0;
  function setup(card) {
    if (card._g && card._g.card.isConnected) return card._g;
    if (card.matches(BAR_SEL)) return setupBar(card);
    // 광학 유리 카드(js/optic.js): 예전 굴절·유리판·채움 마스크 없이 '도잉' 움직임·그림자 + 빛 세기(--optic-h)만
    if (card.classList.contains("optic-host")) {
      const clip = card.classList.contains("pcard") ? card.querySelector(".pcard__inner") : card.querySelector(".overflow-clip");
      if (!clip) return null;
      const R0 = parseFloat(getComputedStyle(clip).borderTopLeftRadius) || 14;
      const glass = document.createElement("span");        // 쓰지 않지만 공통 코드가 다룰 수 있게 (CSS 로 숨김)
      glass.className = "gcard__glass";
      return (card._g = {
        card, clip, target: null, glass, R0, R1: Math.min(R0 + BULGE, clip.offsetHeight / 2), optic: true,
        bgLayer: null, shapes: card.classList.contains("pcard") ? [card, clip] : [clip],
        shadowEl: card.classList.contains("pcard") ? card : clip,
        m: { x: 0, v: 0 }, rx: { x: 0, v: 0 }, ry: { x: 0, v: 0 },
        on: false, tx: 0, ty: 0, last: {},
      });
    }
    const isP = card.classList.contains("pcard");
    const clip = isP ? card.querySelector(".pcard__inner") : card.querySelector(".overflow-clip");
    if (!clip) return null;
    const w = clip.offsetWidth, h = clip.offsetHeight;
    // 굴절은 이미지에만 (글자는 선명하게 유지). 이미지 상자 기준으로 카드 영역에 맵을 맞춰 놓음 (선언 순서상 아래에서 계산)
    // 굴절된 이미지는 둥근 모서리로 잘리는 카드(clip) 안쪽에 있으므로 흰 림 바깥으로 새지 않음
    const img = isP ? card.querySelector(".pcard__img") : clip.querySelector(".overflow-hidden");
    const target = img || clip;
    const ox = target === clip ? 0 : -target.offsetLeft, oy = target === clip ? 0 : -target.offsetTop;
    const R0 = parseFloat(getComputedStyle(clip).borderTopLeftRadius) || 14;
    const R1 = Math.min(R0 + BULGE, h / 2);
    const map = getMap(w, h, R1);
    // 카드 배경 덩어리(색·이미지·그라디언트) — 바와 같은 반투명-투명-반투명 그라데이션을 마스크로 (글자 제외)
    const bgLayer = isP ? card.querySelector(".pcard__bg") : clip.querySelector(":scope > [aria-hidden]");

    const id = `glassCard${++uid}`;
    const f = document.createElementNS(NS, "filter");
    f.id = id;
    for (const [k, v] of Object.entries({ x: ox, y: oy, width: w, height: h, filterUnits: "userSpaceOnUse",
      primitiveUnits: "userSpaceOnUse", "color-interpolation-filters": "sRGB" })) f.setAttribute(k, v);
    const im = document.createElementNS(NS, "feImage");
    for (const [k, v] of Object.entries({ x: ox, y: oy, width: w, height: h, preserveAspectRatio: "none", result: "map" })) im.setAttribute(k, v);
    im.setAttribute("href", map.url);
    const dm = document.createElementNS(NS, "feDisplacementMap");
    for (const [k, v] of Object.entries({ in: "SourceGraphic", in2: "map", scale: 0, xChannelSelector: "R", yChannelSelector: "G" })) dm.setAttribute(k, v);
    f.append(im, dm);
    defs.appendChild(f);

    const glass = document.createElement("span");
    glass.className = "gcard__glass";
    glass.setAttribute("aria-hidden", "true");
    clip.parentElement.appendChild(glass);

    glass.style.borderRadius = `${R0}px`;
    return (card._g = {
      card, clip, target, glass, dm, id, S: map.S, R0, R1,
      bgLayer, profile: bgLayer ? fillMask(w, h, R1, CARD_SEMI, CARD_CLEAR) : null,
      shapes: isP ? [card, clip, glass] : [clip, glass],
      shadowEl: isP ? card : clip,
      m: { x: 0, v: 0 }, rx: { x: 0, v: 0 }, ry: { x: 0, v: 0 },
      on: false, tx: 0, ty: 0, last: {},
    });
  }

  // 바 버튼: 글자뿐이라 굴절 없이 유리 몸체·도잉·기울기·그림자만.
  // 바는 원래 자기 transform 으로 움직이므로(분리·이동 애니메이션) 겹치지 않게 개별 속성 translate/rotate/scale 사용
  function setupBar(el) {
    const glass = document.createElement("span");
    glass.className = "gcard__glass";
    glass.setAttribute("aria-hidden", "true");
    el.appendChild(glass);
    // 무지갯빛 테두리: 마스크 된 링(::before) 바깥으로 빛이 번지도록 필터는 감싸는 요소에
    const halo = document.createElement("span");
    halo.className = "gcard__halo";
    glass.appendChild(halo);
    const iri = document.createElement("span");
    iri.className = "gcard__iri";
    glass.appendChild(iri);
    // 채움 그라데이션 레이어 (글자 아래): 가장자리 반투명 → 가이드선(높이의 22% 안쪽) 부근 10% → 가운데 반투명
    const fill = document.createElement("span");
    fill.className = "gcard__fill";
    fill.setAttribute("aria-hidden", "true");
    el.insertBefore(fill, el.firstChild);
    const cs = getComputedStyle(el);
    const R0 = parseFloat(cs.borderTopLeftRadius) || 20;
    glass.style.borderRadius = `${R0}px`;
    // transform-origin 이 가운데가 아닌 바(#pbar: 0 0)도 가운데서 커지도록 보정할 거리
    const [ox, oy] = cs.transformOrigin.split(" ").map(parseFloat);
    return (el._g = {
      cx: el.offsetWidth / 2 - ox, cy: el.offsetHeight / 2 - oy,
      card: el, clip: el, target: null, glass, fill, bar: true, R0, R1: Math.min(R0 + BULGE, el.offsetHeight / 2),
      optic: el.classList.contains("optic-host"),          // 광학 유리 바: 예전 유리판·채움 대신 빛 세기(--optic-h)만
      shapes: [el, glass], shadowEl: el,
      m: { x: 0, v: 0 }, rx: { x: 0, v: 0 }, ry: { x: 0, v: 0 },
      on: false, tx: 0, ty: 0, last: {},
    });
  }

  // 바의 채움 (바 자체 배경 또는 Figma 구조의 배경 레이어) — 호버 동안 가장자리는 10% 로, 가운데는 원래 채움 유지
  const rgba = (str) => {
    const m = str.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, gg, b, a = 1] = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);
    return { r, g: gg, b, a };
  };
  // 둥근 사각형 모양을 따라가는 채움 그라데이션 (가장자리에서 안쪽으로 거리 d 에 따른 불투명도), 크기별 1회 생성
  const fillMasks = {};
  function fillMask(w, h, r, a0, clear = CLEAR) {
    w = Math.round(w); h = Math.round(h);
    const key = `${w}x${h}x${r.toFixed(1)}x${a0.toFixed(2)}x${clear.toFixed(2)}`;
    if (fillMasks[key]) return fillMasks[key];
    const I = h * GUIDE, hw = w / 2, hh = h / 2;
    const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const ctx = cv.getContext("2d");
    const img = ctx.createImageData(w, h);
    const D = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const qx = Math.abs(x + 0.5 - hw) - (hw - r), qy = Math.abs(y + 0.5 - hh) - (hh - r);
        const d = r - Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - Math.min(Math.max(qx, qy), 0);   // 가장자리까지 거리
        // 반투명(가장자리) → 투명(가이드선 부근) → 반투명(가운데)
        const k = Math.max(1 - smooth(d / (0.55 * I)), smooth((d - 0.8 * I) / (1.1 * I)));
        const a = d <= 0 ? 0 : clear + (a0 - clear) * k;
        const i = (y * w + x) * 4;
        D[i] = D[i + 1] = D[i + 2] = 255;
        D[i + 3] = Math.round(255 * a);
      }
    }
    ctx.putImageData(img, 0, 0);
    return (fillMasks[key] = `url(${cv.toDataURL()})`);
  }

  // 바의 원래 채움 (바 자체 배경 또는 Figma 구조의 배경 레이어) — 호버 동안 이 채움을 그라데이션 채움으로 바꿈
  function rememberFill(g) {
    const el = g.card;
    const cands = [el, ...el.querySelectorAll(":scope > [aria-hidden]:not(.gcard__glass):not(.gcard__fill)")];
    g.fills = [];
    let main = null;
    for (const n of cands) {
      n.style.backgroundColor = "";
      const c = rgba(getComputedStyle(n).backgroundColor);
      if (!c || c.a <= 0) continue;
      g.fills.push({ n, c });
      if (!main || c.a > main.a) main = c;
    }
    main = main || { r: 244, g: 240, b: 232, a: 0.4 };
    const a0 = Math.max(main.a, 0.3);                       // 반투명 부분
    g.fill.style.background = `rgb(${main.r}, ${main.g}, ${main.b})`;
    const m = fillMask(el.offsetWidth, el.offsetHeight, g.R1, a0);
    g.fill.style.webkitMaskImage = g.fill.style.maskImage = m;
  }

  const active = new Set();
  let raf = 0;
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };

  function apply(g) {
    const m = g.m.x, mc = clamp(m, 0, 1);
    const live = m > 0.002 || g.on;
    const L = g.last;
    if (!live) {
      // 완전히 평평해지면 모든 흔적 제거 (필터도 떼어 비용 0)
      if (g.bar) g.card.style.translate = g.card.style.rotate = g.card.style.scale = "";
      else g.card.style.transform = "";
      if (g.target) g.target.style.filter = "";
      g.shadowEl.style.boxShadow = "";
      for (const el of g.shapes) el.style.borderRadius = "";
      g.glass.style.opacity = "";
      if (g.optic) g.card.style.removeProperty("--optic-h");
      if (g.bgLayer) g.bgLayer.style.webkitMaskImage = g.bgLayer.style.maskImage = "";
      if (g.bar) {
        g.fill.style.opacity = "";
        for (const f of g.fills || []) f.n.style.backgroundColor = "";
      }
      g.card.classList.remove("is-glass");
      g.last = {};
      return;
    }
    const s = 1 + GROW * m, j = clamp(g.m.v * 0.9, -0.05, 0.05);   // 출렁: 가로↔세로가 번갈아 눌림
    if (g.bar) {
      const ax = g.rx.x, ay = g.ry.x, ang = Math.hypot(ax, ay);   // 두 축 기울기 → 축-각 하나로
      g.card.style.translate = `${((1 - s - j) * g.cx).toFixed(2)}px ${((1 - s + j) * g.cy - LIFT * m).toFixed(2)}px`;
      g.card.style.rotate = ang > 0.01 ? `${(ax / ang).toFixed(4)} ${(ay / ang).toFixed(4)} 0 ${ang.toFixed(2)}deg` : "";
      g.card.style.scale = `${(s + j).toFixed(4)} ${(s - j).toFixed(4)}`;
    } else g.card.style.transform =
      // 카드: 가로 폭은 그대로(목록 프레임 밖으로 나가지 않게) — 떠오름과 세로로만 '도잉' 출렁, 앞뒤 기울기(rotateX)만
      `perspective(700px) translate3d(0, ${(-LIFT * m).toFixed(2)}px, 0) rotateX(${g.rx.x.toFixed(2)}deg) scale(1, ${(s - j).toFixed(4)})`;
    const rad = `${(g.R0 + (g.R1 - g.R0) * mc).toFixed(1)}px`;
    if (L.rad !== rad) {
      for (const el of g.shapes) el.style.borderRadius = rad;
      L.rad = rad;
    }
    if (g.target) {
      const sc = (g.S * clamp(m, 0, 1.15)).toFixed(1);
      if (L.sc !== sc) { g.dm.setAttribute("scale", sc); L.sc = sc; }
      if (!L.f) { g.target.style.filter = `url(#${g.id})`; L.f = true; }
    }
    const op = mc.toFixed(3);
    if (L.op !== op) {
      g.glass.style.opacity = op;
      if (g.bgLayer) {
        // 고르게 불투명(1) → 그라데이션: 균일층(1-m) 위에 그라데이션 마스크를 겹쳐 서서히 바뀜
        const u = (1 - mc).toFixed(3);
        g.bgLayer.style.webkitMaskImage = g.bgLayer.style.maskImage =
          `${g.profile}, linear-gradient(rgba(0,0,0,${u}), rgba(0,0,0,${u}))`;
      }
      if (g.optic) {
        g.card.style.setProperty("--optic-h", op);        // 호버(떠오름)만큼 광학 유리가 실체화되고 빛이 맺힘
      } else if (g.bar) {
        // 원래의 고른 채움 → 모양을 따라가는 반투명-투명-반투명 그라데이션 채움으로 교차
        g.fill.style.opacity = op;
        for (const f of g.fills || []) {
          f.n.style.backgroundColor = `rgba(${f.c.r}, ${f.c.g}, ${f.c.b}, ${(f.c.a * (1 - mc)).toFixed(3)})`;
        }
      }
      // 떠오른 유리판의 그림자 (Multiply 색 — 배경과 곱한 색): 부드럽게 퍼지는 바닥 그림자 + 가까운 접지 그림자
      g.shadowEl.style.boxShadow =
        `0 ${(6 + 12 * mc).toFixed(1)}px ${(12 + 18 * mc).toFixed(1)}px -6px rgb(var(--shadow-deep) / ${(0.08 + 0.1 * mc).toFixed(3)}), ` +
        `0 2px 4px rgb(var(--shadow-deep) / ${(0.06 * mc).toFixed(3)})` +
        (g.base ? `, ${g.base}` : "");
      L.op = op;
    }
  }

  function tick() {
    raf = 0;
    for (const g of active) {
      step1D(g.m, g.on ? 1 : 0, MAT);
      step1D(g.rx, g.on ? g.tx : 0, TILT);
      step1D(g.ry, g.on ? g.ty : 0, TILT);
      apply(g);
      const still = Math.abs(g.m.v) + Math.abs(g.rx.v) + Math.abs(g.ry.v) < 0.002 &&
        Math.abs(g.m.x - (g.on ? 1 : 0)) < 0.002 &&
        Math.abs(g.rx.x - (g.on ? g.tx : 0)) + Math.abs(g.ry.x - (g.on ? g.ty : 0)) < 0.02;
      if (still) {
        if (!g.on) { g.m.x = 0; g.m.v = 0; g.rx.x = g.ry.x = 0; apply(g); active.delete(g); }
        else if (Math.abs(g.m.x - 1) < 0.002) { active.delete(g); }        // 다 떠오른 채 정지 (마우스가 움직이면 다시 시작)
      }
    }
    if (active.size) kick();
  }

  // 마우스 위치 → 기울기 목표 · 반사광 위치
  function aim(g, e) {
    const r = g.card.getBoundingClientRect();
    const nx = clamp((e.clientX - r.left) / r.width, 0, 1), ny = clamp((e.clientY - r.top) / r.height, 0, 1);
    g.ty = (nx - 0.5) * 2 * TILT_Y;
    g.tx = -(ny - 0.5) * 2 * TILT_X;
    g.glass.style.setProperty("--mx", `${(nx * 100).toFixed(1)}%`);
    g.glass.style.setProperty("--my", `${(ny * 100).toFixed(1)}%`);
  }

  let hovered = null;
  let locked = false;
  // 메뉴 분리 같은 큰 인터랙션 동안은 호버 유리 효과를 끄고, 이미 떠 있는 것은 원래대로 되돌림
  // 상세 페이지 유리(배경 굴절·흐림)에서도 같은 둥근 사각형 굴절 맵을 씀
  window.glassMap = getMap;

  window.glassLock = (on) => {
    locked = on;
    if (on) {
      leave();
      for (const g of active) g.on = false;
      kick();
    }
  };
  function enter(card, e) {
    if (locked) return;
    if (card.classList.contains("is-liquid") || "noGlass" in card.dataset) return;     // 물방울 모핑 중인 바는 그대로
    const g = setup(card);
    if (!g) return;
    if (!g.last.op) {                                       // 원래 그림자(유리 바의 안쪽 빛 등)는 유지하고 위에 더함
      g.shadowEl.style.boxShadow = "";
      const b = getComputedStyle(g.shadowEl).boxShadow;
      g.base = b && b !== "none" ? b : "";
      if (g.bar) rememberFill(g);
    }
    hovered = g;
    g.on = true;
    g.card.classList.add("is-glass");      // 입장 전환(transition) 이 손으로 움직이는 transform 을 늦추지 않도록
    aim(g, e);
    active.add(g);
    kick();
  }
  function leave() {
    if (!hovered) return;
    hovered.on = false;
    active.add(hovered);
    hovered = null;
    kick();
  }

  // 다른 애니메이션이 이 요소를 움직이기 시작할 때 호버 유리 효과를 풀어 줌
  window.glassRelease = (el) => { if (hovered && hovered.card === el) leave(); el.dataset.noGlass = ""; };

  document.addEventListener("pointerover", (e) => {
    if (e.pointerType === "touch") return;
    const card = e.target.closest(SEL);
    if (!card || (hovered && hovered.card === card)) return;
    leave();
    enter(card, e);
  });
  document.addEventListener("pointerout", (e) => {
    if (!hovered) return;
    if (e.relatedTarget && hovered.card.contains(e.relatedTarget)) return;
    leave();
  });
  document.addEventListener("pointermove", (e) => {
    if (!hovered || locked) return;
    aim(hovered, e);
    active.add(hovered);
    kick();
  }, { passive: true });
})();
