/* Side bar 링크 호버 (Figma 292:6730 — Frame 148): 물방울 글자가 스며 오름
 *
 *  AHYUN 이 물속에서 떠오르는 방식(js/intro.js)과 같은 재료:
 *   - 글자 자리마다 액체 덩어리(마스크 타원)가 부풀어 오르고 곁방울이 부풀었다 꺼지며 이어 붙음
 *   - 수면 굴절(노이즈 변위)·흐림이 깊이에 따라 잦아들며 또렷해짐
 *   - 다 오르면 AHYUN 과 같은 물방울 유리 (배경 위 #F4F0E8 20% 투명 채움 · multiply 그림자 · 노란 안쪽 그림자 — 빛나지 않음)
 *  마우스를 떼면 그 자리부터 거꾸로 더 빠르게 가라앉음 (AHYUN 역재생과 같은 비율).
 *  링크마다 필터를 하나씩 복제해 따로 움직이고, 움직이는 동안만 프레임을 돌림.
 */
(() => {
  const links = [...document.querySelectorAll(".drip")];
  if (!links.length) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const RISE = 0.55;                // 초 — 떠오름 (호버라 빠르게: Side bar · Careers 줄 모두)
  const SINK = 2.6;                 // 가라앉을 때는 이만큼 빠르게 (AHYUN 과 같음)

  const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const NS = "http://www.w3.org/2000/svg";

  // 필터를 넣을 defs (index 의 공용 svg)
  const defs = document.querySelector("svg.defs defs") || document.querySelector("svg.defs");

  // 굴절(변위) → 흐림 → AHYUN 유리 음영 (글자가 가늘어 그림자·안쪽 빛은 작게)
  function makeFilter(i, fillA = 0.2, goo = false) {   // fillA: 유리 채움(#F4F0E8) 불투명도, goo: 커서 방울 메타볼
    const f = document.createElementNS(NS, "filter");
    f.id = `dripGlass${i}`;
    if (goo) { f.setAttribute("x", "-60%"); f.setAttribute("y", "-200%"); f.setAttribute("width", "220%"); f.setAttribute("height", "500%"); }
    else { f.setAttribute("x", "-20%"); f.setAttribute("y", "-60%"); f.setAttribute("width", "140%"); f.setAttribute("height", "240%"); }
    f.setAttribute("color-interpolation-filters", "sRGB");
    f.innerHTML = `
      <feTurbulence type="fractalNoise" baseFrequency="0.06 0.09" numOctaves="2" seed="${11 + i}" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G" result="warp"/>
      <feGaussianBlur in="warp" stdDeviation="0" result="soft"/>
      <!-- AHYUN 과 같은 물방울 몸체: 살짝 두껍게 · 끝을 둥글게(흐림 → 문턱) -->
      <feMorphology in="soft" operator="dilate" radius="0.2"/>
      <feGaussianBlur stdDeviation="0.5"/>
      <feComponentTransfer result="${goo ? "solidT" : "solid"}"><feFuncA type="table" tableValues="0 0 0 0 0 1 1 1 1 1"/></feComponentTransfer>
      ${goo ? `<!-- 메타볼 (AHYUN 과 같은 원리, 글자끼리는 붙지 않게): 필터 안에서 색으로 글자(크림)와 커서 방울(빨강)을 나눠
           각각 넓게 흐린 뒤 '방울 + 방울×글자' 만 문턱을 넘김 → 방울 몸체와, 방울이 가까이 간 글자 쪽으로만 목(브릿지)이 생김.
           선명한 글자는 그대로 위에 합침. (색은 마지막 음영에 쓰이지 않음 — 모양만) -->
      <feColorMatrix in="warp" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 1.06 0 0 0"/>
      <feGaussianBlur stdDeviation="2.6" result="tF"/>
      <feColorMatrix in="warp" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 -1 0 0 0"/>
      <feGaussianBlur stdDeviation="2.6" result="dF"/>
      <feComposite in="tF" in2="dF" operator="arithmetic" k1="4" k2="0" k3="1" k4="0"/>
      <feComponentTransfer result="gooA"><feFuncA type="table" tableValues="0 0 0 0 0 1 1 1 1 1"/></feComponentTransfer>
      <feMerge result="solid"><feMergeNode in="gooA"/><feMergeNode in="solidT"/></feMerge>` : ""}
      <!-- 채움: 배경 위 #F4F0E8 20% (빛나지 않게 — AHYUN 과 같은 투명 유리) -->
      <feColorMatrix in="solid" type="matrix" values="0 0 0 0 0.957  0 0 0 0 0.941  0 0 0 0 0.910  0 0 0 ${fillA} 0" result="body"/>
      <feOffset in="solid" dx="1.05" dy="1.68"/>
      <feGaussianBlur stdDeviation="0.84"/>
      <feComposite in2="solid" operator="out" result="dropA"/>
      <feFlood style="flood-color: rgb(var(--shadow-mul))" flood-opacity="0.5"/>
      <feComposite in2="dropA" operator="in" result="drop"/>
      <feOffset in="solid" dx="0.42" dy="0.63"/>
      <feGaussianBlur stdDeviation="0.74"/>
      <feComposite in2="solid" operator="arithmetic" k2="-1" k3="1"/>
      <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 0.961  0 0 0 0 0.709  0 0 0 0.5 0"/>
      <feBlend mode="screen" in2="body" result="shaded"/>
      <feMerge><feMergeNode in="drop"/><feMergeNode in="shaded"/></feMerge>`;
    defs.appendChild(f);
    return {
      url: `url(#${f.id})`,
      noise: f.querySelector("feTurbulence"),
      disp: f.querySelector("feDisplacementMap"),
      blur: f.querySelector("feGaussianBlur"),
      dil: f.querySelector('feMorphology[operator="dilate"]'),
    };
  }

  const items = links.map((a, i) => {
    const text = a.textContent;
    a.textContent = "";
    const ink = document.createElement("span");          // 원래 글자 (multiply 올리브) — 유리 글자가 오르면 옅어짐
    ink.className = "drip__ink";
    ink.textContent = text;
    const glass = document.createElement("span");        // 물방울 유리 글자
    glass.className = "drip__glass";
    glass.setAttribute("aria-hidden", "true");
    glass.textContent = text;
    a.append(ink, glass);
    // 메타볼 커서 방울 (Side bar — data-drip-goo): 유리 글자 안에서 같은 필터를 거쳐 글자와 끈적하게 이어짐
    let drop = null;
    if ("dripGoo" in a.dataset) {
      drop = document.createElement("span");
      drop.className = "drip__drop";
      glass.appendChild(drop);
    }
    // Side bar (Figma 286:5962 Hover): 왼쪽에 화살표가 생기며 글자가 옆으로 밀려남 (화살표 22.5 + 간격 5)
    let arrow = null;
    if ("dripArrow" in a.dataset) {
      arrow = document.createElement("img");
      arrow.className = "drip__arrow";
      arrow.src = "assets/side-arrow.svg";
      arrow.alt = "";
      arrow.setAttribute("aria-hidden", "true");
      a.prepend(arrow);
    }
    // 글자 자리마다 액체 덩어리 하나씩 (글자 수에 맞춰 1~4개) + 곁방울
    const n = Math.max(1, Math.min(4, Math.round(text.length / 2.5)));
    const blobs = Array.from({ length: n }, (_, k) => ({
      fx: (k + 0.5) / n,
      lag: [0, 0.14, 0.07, 0.2][k] || 0,
      side: Array.from({ length: 2 }, () => ({
        a: Math.random() * Math.PI * 2, d: 0.6 + Math.random() * 0.5, lag: 0.1 + Math.random() * 0.3, wob: Math.random() * 6,
      })),
    }));
    return { a, ink, glass, arrow, drop, bx: 0, by: 0, bvx: 0, bvy: 0, bs: 0, bsv: 0, hover: false, gooRun: false, f: makeFilter(i, 0.5, "dripGoo" in a.dataset), blobs   /* 유리 채움 50% — Scroll down · Side bar · 경력 줄 · 소개글 강조 모두 같게 */, p: 0, goal: 0, run: false, last: 0, t: 0, w: 0, h: 0 };
  });
  const byEl = new Map(items.map((it) => [it.a, it]));
  window.DripFx = (el) => byEl.get(el)?.f || null;       // 유리 글자 필터 (Scroll down 글자 바뀜에서 흐림·굴절을 직접 씀)

  // 스크롤로 움직이는 강조 글자 (About — data-drip-scroll): 호버 대신 진행도 p 를 직접 받아 같은 모습으로 그림
  window.DripSet = (el, p) => {
    const it = byEl.get(el);
    if (!it) return;
    p = clamp01(p);
    if (p === it.p) return;
    if (!it.w) { it.w = it.ink.offsetWidth; it.h = it.ink.offsetHeight; }
    it.t = performance.now() / 1000;
    it.p = reduce ? (p > 0.5 ? 1 : 0) : p;
    draw(it, 0);
  };

  const SHIFT = 27.5;                // 화살표 22.5 + 간격 5 만큼 글자가 옆으로
  function slide(it) {
    if (!it.arrow) return;
    const e = easeOut(it.p);
    const x = it.p > 0 ? `translateX(${(SHIFT * e).toFixed(2)}px)` : "";
    it.ink.style.transform = it.glass.style.transform = x;
    const A = it.arrow;
    if (it.p <= 0) { A.style.opacity = "0"; A.style.transform = A.style.filter = ""; A.style.webkitMaskImage = A.style.maskImage = ""; return; }
    // 화살표: 왼쪽에서 미끄러져 들어오며 물이 번지듯 왼쪽부터 스며 나오고 흐림이 걷힘
    A.style.opacity = Math.min(1, e * 1.4).toFixed(3);
    A.style.transform = `translateX(${(-8 * (1 - e)).toFixed(2)}px)`;
    A.style.filter = it.p < 1 ? `blur(${(1.6 * (1 - e)).toFixed(2)}px)` : "";
    const m = it.p < 1 ? `linear-gradient(to right, #000 ${(-30 + 130 * e).toFixed(1)}%, transparent ${(130 * e).toFixed(1)}%)` : "none";
    A.style.webkitMaskImage = A.style.maskImage = m;
  }
  function draw(it, now) {
    slide(it);
    const { glass, ink, f, blobs, p } = it;
    if (p <= 0) {
      glass.style.opacity = "0";
      glass.style.filter = "";
      ink.style.opacity = "";
      return;
    }
    const w = it.w, h = it.h, t = it.t;
    const layers = [];
    let depthSum = 0;
    for (const b of blobs) {
      const q = clamp01((p - b.lag) / (1 - b.lag));
      const e = easeOut(q);
      depthSum += 1 - e;
      const breathe = 1 + 0.06 * Math.sin(t * 5 + b.fx * 9) * (1 - q);
      // 가운데 덩어리: 글자 자리에서 부풀어 퍼짐 (다 오르면 넉넉히 덮음)
      const rx = (w / blobs.length / 2 + 8) * 1.6 * e * breathe;
      const ry = (h / 2 + 8) * 1.6 * e / breathe;
      const cx = w * b.fx, cy = h * 0.55;
      if (rx > 0.2) layers.push(`radial-gradient(${rx.toFixed(1)}px ${ry.toFixed(1)}px at ${cx.toFixed(1)}px ${cy.toFixed(1)}px, #000 60%, transparent 100%)`);
      // 곁방울: 떠오르는 동안만 부풀었다 꺼지며 덩어리에 붙음
      for (const s of b.side) {
        const qs = easeOut(clamp01((q - s.lag) / (1 - s.lag)));
        if (q <= 0 || q >= 0.97) continue;
        const ang = s.a + Math.sin(t * 1.4 + s.wob) * 0.3;
        const r = Math.sin(Math.PI * qs) * (3 + h * 0.25);
        if (r < 0.3) continue;
        const x = cx + Math.cos(ang) * (w / blobs.length / 2) * s.d * (0.4 + qs);
        const y = cy + Math.sin(ang) * (h / 2) * s.d * (0.4 + qs);
        layers.push(`radial-gradient(${r.toFixed(1)}px ${r.toFixed(1)}px at ${x.toFixed(1)}px ${y.toFixed(1)}px, #000 55%, transparent 100%)`);
      }
    }
    const depth = depthSum / blobs.length;
    const m = layers.length ? layers.join(",") : "linear-gradient(transparent, transparent)";
    glass.style.webkitMaskImage = glass.style.maskImage = m;
    // 수면 굴절·흐림이 깊이에 따라 잦아듦 (AHYUN 과 같은 곡선)
    f.noise.setAttribute("baseFrequency", `${(0.06 + 0.01 * Math.sin(t * 1.5)).toFixed(4)} ${(0.09 + 0.012 * Math.cos(t * 1.1)).toFixed(4)}`);
    f.disp.setAttribute("scale", (10 * depth * depth).toFixed(2));
    f.blur.setAttribute("stdDeviation", (2.4 * depth).toFixed(2));
    if (glass.style.filter !== f.url) glass.style.filter = f.url;
    const e = easeOut(p);
    glass.style.opacity = (0.25 + 0.75 * e).toFixed(3);
    ink.style.opacity = (1 - e).toFixed(3);                 // 다 오르면 유리 글자만 (AHYUN 처럼)
    if (p >= 1) glass.style.webkitMaskImage = glass.style.maskImage = "none";   // 다 오름 → 마스크 떼기
  }

  function frame(it) {
    return function f(now) {
      const dt = Math.min((now - it.last) / 1000, 0.05);
      it.last = now;
      it.t += dt;
      const dir = it.goal > it.p ? 1 : -1;
      it.p = clamp01(it.p + (dir > 0 ? dt / RISE : -(dt / RISE) * SINK));
      if ((dir > 0 && it.p > it.goal) || (dir < 0 && it.p < it.goal)) it.p = it.goal;
      draw(it, now);
      if (it.p !== it.goal) requestAnimationFrame(f);
      else it.run = false;
    };
  }
  // ---- 메타볼: 커서를 끈적하게 따라가는 방울. 글자에서 멀어지면 목이 늘어나다 끊어지고 글자로 빨려 들어감 ----
  const ptr = { x: -1e4, y: -1e4 };
  addEventListener("pointermove", (e) => { ptr.x = e.clientX; ptr.y = e.clientY; }, { passive: true });
  const REACH = 30;                   // 글자 상자에서 이만큼 멀어지면 끊어짐
  function gooLoop(it) {
    if (it.gooRun || !it.drop) return;
    it.gooRun = true;
    const r0 = it.a.getBoundingClientRect();
    if (!it.bs) { const k0 = r0.width / (it.a.offsetWidth || 1) || 1; it.bx = (ptr.x - r0.left) / k0; it.by = (ptr.y - r0.top) / k0; }
    function f() {
      const r = it.a.getBoundingClientRect();
      const w = it.ink.offsetWidth, h = it.ink.offsetHeight;
      const k = r.width / (it.a.offsetWidth || 1) || 1;   // 조상 축소 배율 (화면 px → 요소 단위)
      let tx = (ptr.x - r.left) / k, ty = (ptr.y - r.top) / k;
      // 글자 상자에서 가장 가까운 점까지 거리 — 멀면 떨어져 나가 글자 쪽으로 흡수
      const nx = Math.min(Math.max(tx, 0), w), ny = Math.min(Math.max(ty, 0), h);
      const d = Math.hypot(tx - nx, ty - ny);
      const attached = (it.hover || it.p > 0.3) && d < REACH;     // 떠나도 잠깐은 붙은 채 목이 늘어남
      if (!attached) { tx = nx; ty = ny; }
      // 끈적하게 늦게 따라감 (살짝 출렁)
      it.bvx += (tx - it.bx) * 0.16 - it.bvx * 0.32; it.bx += it.bvx;
      it.bvy += (ty - it.by) * 0.16 - it.bvy * 0.32; it.by += it.bvy;
      const sGoal = attached ? Math.max(0.35, 1 - d / REACH * 0.5) * it.p : 0;
      it.bsv += (sGoal - it.bs) * 0.2 - it.bsv * 0.35; it.bs = Math.max(0, it.bs + it.bsv);
      // 움직이는 방향으로 살짝 늘어남
      const sp = Math.min(Math.hypot(it.bvx, it.bvy) * 0.04, 0.35);
      const ang = Math.atan2(it.bvy, it.bvx) * 180 / Math.PI;
      it.drop.style.transform = `translate(${it.bx.toFixed(2)}px, ${it.by.toFixed(2)}px) rotate(${ang.toFixed(1)}deg) scale(${(it.bs * (1 + sp)).toFixed(3)}, ${(it.bs * (1 - sp * 0.5)).toFixed(3)})`;
      if (!it.hover && it.p <= 0.3 && it.bs < 0.01 && Math.abs(it.bsv) < 0.005) {
        it.bs = 0; it.drop.style.transform = "scale(0)"; it.gooRun = false; return;
      }
      requestAnimationFrame(f);
    }
    requestAnimationFrame(f);
  }

  function go(it, goal) {
    it.goal = goal;
    it.hover = goal > 0;
    if (it.drop && !reduce) gooLoop(it);
    if (reduce) { it.p = goal; draw(it, 0); return; }
    if (it.run) return;
    it.w = it.ink.offsetWidth; it.h = it.ink.offsetHeight;   // 요소 자체 단위 (조상이 축소돼 있어도 마스크 좌표가 맞게)
    it.run = true;
    it.last = performance.now();
    requestAnimationFrame(frame(it));
  }
  // 늘 물방울 글자로 (Scroll down — data-drip-static)
  for (const it of items) if ("dripStatic" in it.a.dataset) { it.p = 1; draw(it, 0); }
  // 터치(모바일): 호버가 없으므로 누르면 그 줄(또는 링크)이 물방울 글자로 바뀌고, 다른 곳을 누를 때까지 그대로
  //  (손을 떼는 순간 pointerleave 가 와도 되돌리지 않음) — About Careers · Find me
  const groups = new Map();
  let touched = null;
  const touchOn = (t) => {
    if (touched === t) return;
    if (touched) for (const it of groups.get(touched)) go(it, 0);
    touched = t;
    if (t) for (const it of groups.get(t)) go(it, 1);
  };
  for (const it of items) {
    if ("dripScroll" in it.a.dataset || "dripStatic" in it.a.dataset) continue;
    // [data-drip-hover] 안의 글자들은 그 줄 전체에 호버하면 함께 (About Careers 줄: 회사명 · 연도)
    const t = it.a.closest("[data-drip-hover]") || it.a;
    if (!groups.has(t)) {
      groups.set(t, []);
      t.addEventListener("pointerdown", (e) => { if (e.pointerType === "touch") touchOn(t); });
    }
    groups.get(t).push(it);
    t.addEventListener("pointerenter", (e) => { if (e.pointerType !== "touch") go(it, 1); });
    t.addEventListener("pointerleave", (e) => { if (e.pointerType !== "touch" && touched !== t) go(it, 0); });
    it.a.addEventListener("focus", () => go(it, 1));
    it.a.addEventListener("blur", () => { if (touched !== t) go(it, 0); });
  }
  // 다른 곳을 누르면 원래 글자로
  document.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch" || !touched) return;
    for (const t of groups.keys()) if (t.contains(e.target)) return;
    touchOn(null);
  }, true);
})();
