/**
 * Hello hover 인트로 (Figma 187:278 → 97:825) + AHYUN metaball 인터랙션
 *
 * 인트로
 *  - Hello 바가 H의 가로획 위치로 물방울처럼 이동 (CSS)
 *  - 위에서 내려다본 수면: AHYUN 글자가 물속에서 떠오름
 *      · 각 글자 중심에서 몽글한 방울이 퍼지며 드러남 (gooey 마스크)
 *      · 단어 가운데 글자부터 바깥쪽으로 차례로
 *  - portfoilo 도 같은 시점으로 수면 아래에서 떠오름
 *
 * metaball (Pulling Blob)
 *  - 글자 패스 좌표는 그대로 두고, 글자별 transform 으로만 커서 쪽으로 말랑하게 끌려갔다 출렁이며 복귀
 *  - 글자 안쪽에 숨어 있는 둥근 '당김 방울'(div)이 커서가 윤곽선 60px 안에 오면
 *    커서 쪽으로 빠져나오며 커짐 → 멀어질수록 글자와 이어진 목이 가늘게 조여드는 메타볼
 *  - 글자·당김 방울·커서 방울이 같은 래퍼(.goo) 안에 있고 래퍼에만 #gooFilter 를 1번 적용
 *    → 픽셀이 섞여 커서 쪽 윤곽선만 찰흙처럼 부풀어 쭈욱 늘어나 보임
 *  - 60px 을 넘으면 당김 방울이 탄력 있게 획 안으로 쏙 들어가며 원래 모양으로 돌아감
 *  - 화면에 보이는 커서 방울은 지름 20px 고정 (반응 반경과 별개)
 *  - 모든 움직임은 transform: translate3d + scale, requestAnimationFrame 으로만 갱신
 */
(function () {
  const NS = "http://www.w3.org/2000/svg";

  // ---------- 상세 페이지 푸터용 AHYUN: 처음 화면의 AHYUN(#goo)을 통째로 복제 (id 뒤에 "-f") ----------
  // 같은 글자·마스크·필터·물방울 구조 → 같은 장면 코드(makeScene)가 등장 모션·메타볼 호버를 그대로 돌림
  // (처음 화면 장면이 손대기 전, 이 스크립트 맨 처음에 복제)
  function renameIds(root, sfx) {
    const els = [root, ...root.querySelectorAll("[id]")].filter((el) => el.id);
    const map = {};
    for (const el of els) { map[el.id] = el.id + sfx; el.id += sfx; }
    const fix = (v) => v.replace(/url\(#([^)]+)\)/g, (m, id) => (map[id] ? `url(#${map[id]})` : m))
      .replace(/^#(.+)$/, (m, id) => (map[id] ? `#${map[id]}` : m));
    for (const el of [root, ...root.querySelectorAll("*")]) {
      for (const a of ["mask", "filter", "clip-path", "fill", "stroke", "href", "xlink:href", "style"]) {
        const v = el.getAttribute(a);
        if (v && v.includes("#")) el.setAttribute(a, fix(v));
      }
    }
  }
  // H 가로획 (Figma 286:5979 · 256:4455): 두 획에서 20 씩 떨어진 높이 20, radius 8 막대 — 처음 화면·푸터 모두 AHYUN 글자와 같은 몸
  const BAR_D = "M253.75 91.875H586.42A8 8 0 0 1 594.42 99.875V103.875A8 8 0 0 1 586.42 111.875H253.75A8 8 0 0 1 245.75 103.875V99.875A8 8 0 0 1 253.75 91.875Z";
  (function addBar() {
    const g = document.getElementById("glyph"), L = document.getElementById("letters");
    if (!g || !L || document.getElementById("lt6")) return;
    g.setAttribute("d", g.getAttribute("d") + BAR_D);
    const bar = document.createElementNS(NS, "path");
    bar.id = "lt6";
    bar.setAttribute("class", "lt");
    bar.setAttribute("d", BAR_D);
    L.appendChild(bar);
  })();

  function buildFoot() {
    const host = document.getElementById("footAhyun");
    const src = document.getElementById("goo");
    const filt = document.getElementById("ahyunGoo");
    if (!host || !src || !filt) return false;
    const c = src.cloneNode(true);
    c.removeAttribute("role");
    c.removeAttribute("aria-label");
    c.setAttribute("aria-hidden", "true");
    renameIds(c, "-f");                              // H 가로획(lt6)도 함께 복제됨
    const f = filt.cloneNode(true);
    renameIds(f, "-f");
    filt.parentNode.appendChild(f);
    c.style.filter = "url(#ahyunGoo-f)";
    host.insertBefore(c, host.firstChild);
    return true;
  }
  const hasFoot = buildFoot();

  // ---------- AHYUN 장면: sfx = id 접미사 ("" 처음 화면, "-f" 푸터), home = 처음 화면 전용 요소(portfoilo·Hello) 사용 ----------
  function makeScene(sfx, home) {
  const $ = (id) => document.getElementById(id + sfx);
  const stage = home ? document.getElementById("stage") : null;
  const name = $("name");
  const glyph = $("glyph");
  const layer = $("riseLayer");
  const masked = name.querySelector("[mask]");
  const liquid = name.querySelector(`[filter="url(#liquid${sfx})"]`);
  const noise = $("liquidNoise");
  const disp = $("liquidDisp");
  const blur = $("liquidBlur");
  const floatText = home ? document.getElementById("floatText") : null;
  const textNoise = home ? document.getElementById("textNoise") : null;
  const textDisp = home ? document.getElementById("textDisp") : null;
  const dropEl = $("gooDrop");
  const pullEl = $("gooPull");
  const MASK_ATTR = masked.getAttribute("mask");          // 처음 상태로 되돌릴 때 다시 씌움
  const LIQUID_ATTR = liquid.getAttribute("filter");

  // ---------- 글자 영역 (svg 좌표, 인트로 마스크·근접 판정용) ----------
  const WORD_CENTER = 600;
  const BOXES = [
    [3.75, 1.875, 179.9, 205],     // A
    [205.58, 1.875, 225.75, 205],  // H 왼쪽 획
    [614.42, 1.875, 634.58, 205],  // H 오른쪽 획
    [647.02, 1.875, 804.22, 205],  // Y
    [814.16, 1.875, 975.15, 205],  // U
    [1000.3, 1.875, 1181.25, 205], // N
  ];
  const BAR_I = 6;                                   // 푸터의 H 가로획 글자 번호 (있을 때만)
  const hasBar = !!$("lt6");
  if (hasBar) BOXES.push([245.75, 91.875, 594.42, 111.875]);
  const letters = BOXES.map(([x0, y0, x1, y1], i) => {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hw = (x1 - x0) / 2, hh = (y1 - y0) / 2;

    const core = document.createElementNS(NS, "ellipse");
    core.setAttribute("cx", cx);
    core.setAttribute("cy", cy);
    layer.appendChild(core);

    // 가장자리에서 함께 부풀어 오르는 작은 방울들
    const blobs = Array.from({ length: 6 }, (_, k) => {
      const c = document.createElementNS(NS, "circle");
      layer.appendChild(c);
      const a = (k / 6) * Math.PI * 2 + Math.random() * 0.6;
      return { el: c, a, d: 0.45 + Math.random() * 0.4, lag: Math.random() * 0.25, wob: Math.random() * 6 };
    });

    const dist = Math.abs(cx - WORD_CENTER) / WORD_CENTER;
    return { cx, cy, hw, hh, core, blobs, delay: 0.3 + dist * 0.55, seed: i * 1.3 };
  });

  const DURATION = 1.9;
  const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  // 수면에 닿을 때 살짝 넘쳤다가 가라앉는 커브
  const surfaceScale = (p) => 0.84 + 0.16 * easeOut(p) + 0.025 * Math.sin(Math.PI * clamp01((p - 0.55) / 0.45));
  const grey = (v) => { const c = Math.round(255 * v); return `rgb(${c},${c},${c})`; };

  function drawLetter(L, p, t) {
    const e = easeOut(p);
    // 마스크 밝기 = 불투명도 (깊을 때 옅게)
    const fill = grey(0.25 + 0.75 * e);
    const breathe = 1 + 0.06 * Math.sin(t * 5 + L.seed) * (1 - p);
    L.core.setAttribute("fill", fill);
    L.core.setAttribute("rx", (Math.max((L.hw + 14) * 1.5 * e, 0) * breathe).toFixed(2));
    L.core.setAttribute("ry", (Math.max((L.hh + 14) * 1.5 * e, 0) / breathe).toFixed(2));

    for (const b of L.blobs) {
      const q = easeOut(clamp01((p - b.lag) / (1 - b.lag)));
      const live = p > 0 && p < 0.97;
      const ang = b.a + Math.sin(t * 1.4 + b.wob) * 0.3;
      b.el.setAttribute("fill", fill);
      b.el.setAttribute("cx", (L.cx + Math.cos(ang) * L.hw * b.d * (0.4 + q)).toFixed(1));
      b.el.setAttribute("cy", (L.cy + Math.sin(ang) * L.hh * b.d * (0.4 + q)).toFixed(1));
      b.el.setAttribute("r", live ? (Math.sin(Math.PI * q) * (10 + Math.min(L.hw, 40) * 0.5)).toFixed(1) : 0);
    }
  }

  letters.forEach((L) => drawLetter(L, 0, 0));

  // ---------- portfoilo ----------
  const TEXT_DELAY = 1.25, TEXT_DURATION = 1.8;
  function drawText(p, t) {
    if (!floatText) return;
    const e = easeOut(p);
    const depth = 1 - e;
    floatText.style.opacity = (0.15 + 0.85 * e).toFixed(3) * (p > 0 ? 1 : 0);
    floatText.style.transform = `scale(${surfaceScale(p).toFixed(4)})`;
    floatText.style.filter = `url(#liquidText) blur(${(7 * depth).toFixed(2)}px)`;
    textNoise.setAttribute("baseFrequency", `${(0.02 + 0.004 * Math.sin(t * 1.7)).toFixed(4)} ${(0.03 + 0.005 * Math.cos(t * 1.3)).toFixed(4)}`);
    textDisp.setAttribute("scale", (16 * depth * depth).toFixed(2));
  }

  // ---------- metaball 인터랙션: 연결 브릿지 ----------
  const pointer = { x: 0, y: 0, inside: false };
  addEventListener("pointermove", (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.inside = true;
  }, { passive: true });
  document.addEventListener("pointerleave", () => { pointer.inside = false; });

  const PAD = 80;          // .goo 래퍼 여백 (svg 좌표 → 래퍼 px 오프셋)
  const BASE_R = 10;       // 방울 div 기본 반지름 (20px 원)
  const SAMPLE = 3;        // 표면 탐색용 앵커 간격 (svg 단위, 화면에 그리지 않음)
  const MAX_OUT = 80;      // 방울이 윤곽선 밖으로 나올 수 있는 최대 길이 (넓은 언덕처럼 크게 부풂)
  // 반응 범위와 보이는 크기는 분리 — 둘 다 화면 px 기준 (스테이지 축소와 무관하게 유지)
  const RANGE_PX = 100;    // 커서가 윤곽선에서 100px 안이면 당김, 넘으면 복귀
  const DROP_PX = 20;      // 화면에 보이는 커서 방울 지름 (고정)
  const SWELL_R = 27;      // 글자 위에서 획을 부풀리는 방울 반지름 (svg 단위, 획 두께 20)
  let range = RANGE_PX;    // svg 단위로 환산한 값 (매 프레임 갱신)
  let dropRadius = DROP_PX / 2;

  // Spring physics — a = (stiffness·Δx − damping·v) / mass
  // 낮은 stiffness + 임계감쇠에 가까운 damping → 튕기지 않고 쥬-욱 천천히 나오고 들어감
  const PULL = { stiffness: 0.035, damping: 0.4, mass: 1.6 };    // 당길 때: 끈적하게 쥬-욱 늘어나옴
  const BACK = { stiffness: 0.022, damping: 0.36, mass: 1.8 };   // 놓을 때: 팅 하지 않고 쥬-욱 빨려 들어감
  const JELLY = { stiffness: 0.06, damping: 1.2, mass: 1.2 };   // 글자 몸통: 빠르게 따라오되 출렁임은 작게
  const LETTER_MOVE = 9;      // 글자가 커서 쪽으로 끌려가는 최대 거리 (svg 단위)
  const LETTER_STRETCH = 0;    // 글자는 찌그러뜨리지 않음 (타원 변형 없음), 위치만 끌려감 // 당길 때 글자가 늘어나는 정도
  const DROP_GROW = { stiffness: 0.04, damping: 0.42, mass: 1.2 };
  const DROP_SHRINK = { stiffness: 0.025, damping: 0.36, mass: 1.3 };
  const GLIDE = { stiffness: 0.03, damping: 0.36, mass: 1 };   // 당김 자리가 윤곽선·글자 사이를 떠가는 속도
  const DROP_MOVE = { stiffness: 0.07, damping: 0.5, mass: 1 };

  function spring(pos, vel, tx, ty, P) {
    vel.x += (P.stiffness * (tx - pos.x) - P.damping * vel.x) / P.mass;
    vel.y += (P.stiffness * (ty - pos.y) - P.damping * vel.y) / P.mass;
    pos.x += vel.x;
    pos.y += vel.y;
  }

  // 커서 방울 = 20px div, translate3d + scale 로만 이동. 값이 바뀔 때만 씀
  function place(el, x, y, r) {
    const t = r < 0.3
      ? "scale(0)"
      : `translate3d(${(x + PAD - BASE_R).toFixed(1)}px, ${(y + PAD - BASE_R).toFixed(1)}px, 0) scale(${(r / BASE_R).toFixed(3)})`;
    if (el._t !== t) { el.style.transform = t; el._t = t; }
  }

  // ---- 표면 앵커 (가장 가까운 표면 지점 찾기용, 화면에 그리지 않음) ----
  // 하위 패스 순서: A 바깥, A 안쪽, H 왼쪽 획, H 오른쪽 획, Y, U, N → 글자 번호
  const SUB_LETTER = [0, 0, 1, 2, 3, 4, 5, 6];       // 마지막(6) = 푸터의 H 가로획
  let anchors = new Float32Array(0);
  function buildAnchors() {
    const tmp = document.createElementNS(NS, "path");
    name.appendChild(tmp);
    const pts = [];
    const subs = glyph.getAttribute("d").split(/(?=M)/);
    for (let i = 0; i < subs.length; i++) {
      const d = subs[i];
      tmp.setAttribute("d", d);
      const len = tmp.getTotalLength();
      const n = Math.max(8, Math.round(len / SAMPLE));
      for (let k = 0; k < n; k++) {
        const p = tmp.getPointAtLength((k / n) * len);
        pts.push(p.x, p.y, SUB_LETTER[i] ?? 0);
      }
    }
    tmp.remove();
    anchors = new Float32Array(pts);
  }
  function nearestSurface(m) {
    let bd = Infinity, bx = 0, by = 0, bl = 0;
    for (let k = 0; k < anchors.length; k += 3) {
      const dx = anchors[k] - m.x, dy = anchors[k + 1] - m.y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; bx = anchors[k]; by = anchors[k + 1]; bl = anchors[k + 2]; }
    }
    return { x: bx, y: by, d: Math.sqrt(bd), letter: bl };
  }

  // ---- 글자 몸통 (글자별 transform 만 바꿈, 패스 좌표는 그대로) ----
  const bodies = [...$("letters").querySelectorAll(".lt")].map((el, i) => ({
    el, L: letters[i], off: { x: 0, y: 0 }, offV: { x: 0, y: 0 }, e: 0, eV: 0, ang: 0, t: "", M: new DOMMatrix(),
  }));
  // 푸터: 목록 호버 동안 H 가로획이 물방울처럼 일렁임 (detail.js 가 0~1 세기를 넘김)
  let wobA = 0;
  function moveBodies(pulled, dir, out) {
    const tw = performance.now() / 1000;
    for (let i = 0; i < bodies.length; i++) {
      const B = bodies[i], on = i === pulled;
      const k = on ? Math.min(out / MAX_OUT, 1) : 0;
      if (on) B.ang = Math.atan2(dir.y, dir.x) * 180 / Math.PI;
      // 감쇠를 암시적으로 적용 → damping 이 커도 떨리지 않고 출렁임만 줄어듦
      const J = JELLY, keep = 1 / (1 + J.damping / J.mass);
      const tx = dir.x * LETTER_MOVE * k, ty = dir.y * LETTER_MOVE * k;
      B.offV.x = (B.offV.x + J.stiffness * (tx - B.off.x) / J.mass) * keep;
      B.offV.y = (B.offV.y + J.stiffness * (ty - B.off.y) / J.mass) * keep;
      B.off.x += B.offV.x;
      B.off.y += B.offV.y;
      B.eV = (B.eV + J.stiffness * (LETTER_STRETCH * k - B.e) / J.mass) * keep;
      B.e += B.eV;
      const s = 1 + B.e;
      B.M = new DOMMatrix()
        .translate(B.L.cx + B.off.x, B.L.cy + B.off.y)
        .rotate(B.ang).scale(s, 1 / Math.sqrt(Math.max(s, 0.5))).rotate(-B.ang)
        .translate(-B.L.cx, -B.L.cy);
      const wob = i === BAR_I && wobA > 0.002;
      if (wob) {
        // 가로·세로가 번갈아 눌리고 살짝 오르내림 (막대 가운데 기준)
        const s1 = Math.sin(tw * 3.4), s2 = Math.sin(tw * 2.3 + 1.2);
        B.M = B.M.translate(B.L.cx, B.L.cy + 2 * wobA * s2)
          .scale(1 + 0.03 * wobA * s1, 1 - 0.28 * wobA * s1 + 0.1 * wobA * s2)
          .translate(-B.L.cx, -B.L.cy);
      }
      const M = B.M;
      const t = !wob && Math.abs(B.off.x) + Math.abs(B.off.y) + Math.abs(B.e) < 0.002
        ? ""
        : `matrix(${M.a.toFixed(4)} ${M.b.toFixed(4)} ${M.c.toFixed(4)} ${M.d.toFixed(4)} ${M.e.toFixed(2)} ${M.f.toFixed(2)})`;
      if (t !== B.t) {
        if (t) B.el.setAttribute("transform", t); else B.el.removeAttribute("transform");
        B.t = t;
      }
    }
  }

  // ---- 당김 방울 ----
  // 상태: G = 잡힌 윤곽선 지점, dir = G→커서 방향, out = 윤곽선 밖으로 나온 길이(스프링)
  const pull = { G: null, Gv: { x: 0, y: 0 }, W: null, letter: -1, dir: { x: 0, y: 1 }, out: 0, outV: 0, el: pullEl };

  // 당김 물방울: 전부 원(circle) — 윤곽선에서 둥근 방울이 부풀어 올라 커서 쪽으로 나옴
  //  - 큰 원 1개: 나올수록 커지는 둥근 방울
  //  - 목 원 1개: 글자와 방울 사이를 잇는 작은 원
  //  - 밑동 원 2개: 윤곽선 양옆에 살짝 묻혀 부드럽게 퍼지는 자리
  //  각 원은 1차 지연으로 따라감 (튕김 없음), gooey 필터가 한 덩어리로 녹여 붙임
  const NODES = [];
  {
    const parent = pullEl.parentNode;
    pullEl.style.display = "none";
    for (let i = 0; i < 4; i++) {
      const el = document.createElement("div");
      el.className = "goo__blob";
      parent.insertBefore(el, dropEl);
      NODES.push({ el, x: 0, y: 0, r: 0, on: false });
    }
  }
  function placePull() {
    const P = pull;
    if (!P.W || P.out < 0.3) {
      for (const N of NODES) {
        N.r += (0 - N.r) * 0.2;
        if (N.r < 0.3) { N.r = 0; N.on = false; }
        place(N.el, N.x, N.y, N.r);
      }
      return;
    }
    const o = P.out, k = clamp01(o / MAX_OUT), sk = Math.sqrt(k);
    const d = P.dir, n = { x: -d.y, y: d.x }, W = P.W;
    let idx = 0;
    const put = (tx, ty, tr, follow) => {
      const N = NODES[idx++];
      if (!N.on) { N.x = tx; N.y = ty; N.r = 0; N.on = true; }
      N.x += (tx - N.x) * follow;
      N.y += (ty - N.y) * follow;
      N.r += (tr - N.r) * 0.25;
      place(N.el, N.x, N.y, N.r);
    };
    // 둥근 방울: 반지름이 나온 길이를 따라 커짐, 바깥 끝이 커서 쪽 o 에 닿음
    const R = 5 + 25 * sk;
    put(W.x + d.x * (o - R), W.y + d.y * (o - R), R, 0.22);
    // 목: 글자 윤곽선 바로 위
    put(W.x + d.x * (o - R) * 0.35, W.y + d.y * (o - R) * 0.35, 6 + 9 * sk, 0.3);
    // 밑동: 양옆으로 살짝 퍼짐 (원, 윤곽선 안쪽에 묻힘)
    const spread = 6 + 16 * sk;
    for (const sg of [-1, 1]) put(W.x + n.x * sg * spread - d.x * 3, W.y + n.y * sg * spread - d.y * 3, 5 + 6 * sk, 0.3);
  }

  const dropS = { r: 0, rv: 0, pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, home: { x: 0, y: 0 } };

  // 물방울 테두리 글로우: #ahyunGoo 의 점광원이 커서를 따라감 (메타볼 경계에 맺히는 하이라이트)
  // svg 단위 = 래퍼 px, 래퍼 여백 80px
  const iri = {
    light: $("ahyunLight"),
    spec: $("ahyunSpec"),
    prims: [...($("ahyunGoo") ? $("ahyunGoo").querySelectorAll(".iriPrim") : [])],
    a: 0, x: -999, y: -999, k: "",
  };
  function placeIri(m, inside, dist, t) {
    if (!iri.light) return;
    const goal = m ? clamp01(1 - (inside ? 0 : dist) / (range * 2.4)) : 0;
    iri.a += (goal - iri.a) * (goal > iri.a ? 0.12 : 0.05);
    if (iri.a < 0.01 && goal === 0) {
      if (iri.k !== "off") { iri.spec.setAttribute("specularConstant", "0"); setWin(-10, -10, 1); iri.k = "off"; }
      return;
    }
    if (m) {
      if (iri.x < -900) { iri.x = m.x; iri.y = m.y; }
      iri.x += (m.x - iri.x) * 0.2;
      iri.y += (m.y - iri.y) * 0.2;
    }
    // 커서가 멈추면 빛도 멈춤 → 필터를 다시 계산하지 않음 (컴포넌트 빛 물결과 함께 돌아도 60fps)
    const lx = (iri.x + 80).toFixed(1), ly = (iri.y + 80).toFixed(1);
    const sc = (iri.a * 0.9).toFixed(3);
    const k = lx + ly + sc;
    if (k === iri.k) return;
    iri.k = k;
    iri.light.setAttribute("x", lx);
    iri.light.setAttribute("y", ly);
    iri.light.setAttribute("pointsAtX", lx);
    iri.light.setAttribute("pointsAtY", ly);
    iri.spec.setAttribute("specularConstant", sc);
    setWin(+lx - WIN / 2, +ly - WIN / 2, WIN);
  }
  const WIN = 380;
  function setWin(x, y, w) {
    const X = x.toFixed(0), Y = y.toFixed(0), W = String(w);
    for (const p of iri.prims) {
      p.setAttribute("x", X); p.setAttribute("y", Y);
      p.setAttribute("width", W); p.setAttribute("height", W);
    }
  }
  function resetIri() {
    if (!iri.light) return;
    iri.a = 0; iri.x = iri.y = -999; iri.k = "off";
    iri.spec.setAttribute("specularConstant", "0");
    setWin(-10, -10, 1);
  }


  let viscGen = 0;                 // 처음 화면으로 돌아가면 이전 루프 정지
  function startViscous() {
    buildAnchors();
    const my = ++viscGen;

    function step() {
      if (my !== viscGen) return;
      requestAnimationFrame(step);
      const ctm = name.getScreenCTM();
      let m = null;
      if (ctm) {
        if (pointer.inside) {
          const p = new DOMPoint(pointer.x, pointer.y).matrixTransform(ctm.inverse());
          m = { x: p.x, y: p.y };
        }
        // 화면 px → svg 단위 (스테이지가 축소돼도 60px / 20px 유지)
        range = RANGE_PX / ctm.a;
        dropRadius = DROP_PX / 2 / ctm.a;
      }

      // 커서가 윤곽선 밖 60px 안이면 가장 가까운 지점에서 커서 쪽으로 당김
      let target = 0, dist = Infinity;
      if (m && !glyph.isPointInFill({ x: m.x, y: m.y })) {
        const near = nearestSurface(m);
        dist = near.d;
        if (dist <= range) {
          const P = pull;
          if (!P.G || P.out < 0.5) {
            // 새로 잡을 때만 그 지점에서 시작 (보이지 않을 만큼 작을 때)
            P.G = { x: near.x, y: near.y };
            P.Gv = { x: 0, y: 0 };
            P.letter = near.letter;
          } else {
            // 잡힌 자리는 끊기지 않고 스프링으로 유유히 떠감 — 다른 글자로 넘어갈 때도 순간이동 없이
            // 글자 사이 틈을 비눗방울처럼 천천히 지나 다음 글자에 닿음 (임계감쇠: 튕김 없음)
            spring(P.G, P.Gv, near.x, near.y, GLIDE);
            P.letter = near.letter;
          }
          const dx = m.x - P.G.x, dy = m.y - P.G.y, len = Math.hypot(dx, dy) || 1;
          P.dir.x += (dx / len - P.dir.x) * 0.2;
          P.dir.y += (dy / len - P.dir.y) * 0.2;
          const dl = Math.hypot(P.dir.x, P.dir.y) || 1;
          P.dir.x /= dl; P.dir.y /= dl;
          // 저항: 멀어질수록 덜 따라 나옴 → 커서에 닿을 만큼 쭈욱
          target = Math.min(len * (1 - 0.3 * Math.pow(len / range, 2)), MAX_OUT);
        }
      }
      const S = target > pull.out ? PULL : BACK;
      pull.outV += (S.stiffness * (target - pull.out) - S.damping * pull.outV) / S.mass;
      pull.out = Math.max(pull.out + pull.outV, 0);
      // 글자도 방울과 함께 커서 쪽으로 말랑하게 끌려감 → 당김 방울은 움직인 글자에 붙어 있음
      moveBodies(pull.letter, pull.dir, pull.out);
      if (pull.G && pull.letter >= 0) {
        const w = bodies[pull.letter].M.transformPoint(pull.G);
        pull.W = { x: w.x, y: w.y };
      }
      placePull();

      // 커서 방울: 늘어난 윤곽선 끝에 닿아 있을 때만, 20px 고정
      let dropTarget = 0;
      const inside = !!(m && glyph.isPointInFill({ x: m.x, y: m.y }));
      if (inside) {
        // 글자 위: 커서 자리에 큰 방울 → 획이 커서를 따라 둥글게 부풀며 모핑
        dropTarget = SWELL_R;
      } else if (m && pull.G && target > 0) {
        const gap = dist - pull.out;
        dropTarget = dropRadius * clamp01(1 - (gap - dropRadius) / 14);
      }
      if (pull.W) { dropS.home.x = pull.W.x; dropS.home.y = pull.W.y; }
      if (dropTarget > 0.5 && dropS.r < 0.5) {
        // 새로 생길 때는 윤곽선에서 출발 (글자 위라면 커서 자리에서)
        const o = inside ? m : dropS.home;
        dropS.pos.x = o.x; dropS.pos.y = o.y;
        dropS.vel.x = dropS.vel.y = 0;
      }
      const g = dropTarget > dropS.r ? DROP_GROW : DROP_SHRINK;
      dropS.rv += (g.stiffness * (dropTarget - dropS.r) - g.damping * dropS.rv) / g.mass;
      dropS.r = Math.max(dropS.r + dropS.rv, 0);
      // 붙어 있을 때는 커서로, 떨어지면 윤곽선 쪽으로 흡수
      const goal = dropTarget > 0.5 && m ? m : dropS.home;
      spring(dropS.pos, dropS.vel, goal.x, goal.y, DROP_MOVE);
      place(dropEl, dropS.pos.x, dropS.pos.y, dropS.r);

      if (m && !inside && dist === Infinity) {
        // 글자 상자에서 멀면 윤곽선 탐색 생략 (성능)
        const R = range * 2.2;
        if (m.x > -R && m.x < 1191.25 + R && m.y > -R && m.y < 216.875 + R) dist = nearestSurface(m).d;
      }
      placeIri(m, inside, dist, performance.now());
    }
    requestAnimationFrame(step);
  }

  function finishLetters() {
    lettersDone = true;
    state = "open";
    masked.removeAttribute("mask");
    liquid.removeAttribute("filter");
    startViscous();
  }

  // ---------- 인트로 루프 ----------
  let lettersDone = false;
  let startTime = null;
  let tickGen = 0;
  let curT = 0, resumeT = 0;                       // 지금 진행 시간(초) — 가라앉다 다시 떠오를 때 그 자리부터
  let state = "hidden";                            // hidden · rising · open · sinking
  function tick(now) {
    if (tick.gen !== tickGen) return;
    if (startTime === null) startTime = now - resumeT * 1000;
    const t = (now - startTime) / 1000;
    curT = t;

    if (!lettersDone) {
      let depthSum = 0, done = true;
      for (const L of letters) {
        const p = clamp01((t - L.delay) / DURATION);
        drawLetter(L, p, t);
        depthSum += 1 - easeOut(p);
        if (p < 1) done = false;
      }
      const depth = depthSum / letters.length;
      // 수면 굴절: 노이즈가 천천히 흐르도록
      noise.setAttribute("baseFrequency",
        `${(0.014 + 0.003 * Math.sin(t * 1.5)).toFixed(4)} ${(0.02 + 0.004 * Math.cos(t * 1.1)).toFixed(4)}`);
      disp.setAttribute("scale", (26 * depth * depth).toFixed(2));
      blur.setAttribute("stdDeviation", (6 * depth).toFixed(2));
      if (done) {
        // 글자 등장 완료 → 마스크 제거하고 metaball 인터랙션 시작
        blur.setAttribute("stdDeviation", 0);
        finishLetters();
      }
    }

    const tp = clamp01((t - TEXT_DELAY) / TEXT_DURATION);
    drawText(tp, t);

    if (lettersDone && (tp >= 1 || !floatText)) {
      if (floatText) {
        floatText.style.cssText = "opacity: 1";
        floatText.classList.add("is-floating");
      }
      return;
    }
    requestAnimationFrame(tick);
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let opened = false;
  function open() {
    if (state === "sinking") {                     // 가라앉는 중이면 그 자리에서 다시 떠오름
      sinkGen++;
      resumeT = curT;
      startTime = null;
      opened = true;
      state = "rising";
      tick.gen = tickGen;
      requestAnimationFrame(tick);
      return;
    }
    if (opened) return;
    opened = true;
    state = "rising";
    resumeT = 0;
    if (stage) stage.classList.add("is-open");
    if (reduceMotion) {
      if (floatText) floatText.style.opacity = 1;
      finishLetters();
      return;
    }
    tick.gen = tickGen;
    requestAnimationFrame(tick);
  }

  // 처음 화면(Hello 만 가운데)으로 되돌림: 글자는 다시 물속, portfoilo 숨김, 당김 방울 정지
  function reset() {
    tickGen++;
    viscGen++;
    lettersDone = false;
    startTime = null;
    opened = false;
    state = "hidden";
    curT = resumeT = 0;
    sinkGen++;
    if (stage) stage.classList.remove("is-open");
    if (MASK_ATTR) masked.setAttribute("mask", MASK_ATTR);
    if (LIQUID_ATTR) liquid.setAttribute("filter", LIQUID_ATTR);
    letters.forEach((L) => drawLetter(L, 0, 0));
    for (const B of bodies) {
      B.off.x = B.off.y = B.offV.x = B.offV.y = B.e = B.eV = 0;
      B.M = new DOMMatrix();
      B.el.removeAttribute("transform");
      B.t = "";
    }
    pull.G = pull.W = null;
    pull.letter = -1;
    pull.out = pull.outV = 0;
    for (const N of NODES) { N.r = 0; N.on = false; place(N.el, 0, 0, 0); }
    dropS.r = dropS.rv = 0;
    place(dropEl, 0, 0, 0);
    resetIri();
    if (floatText) {
      floatText.classList.remove("is-floating");
      floatText.style.cssText = "";
    }
  }
  // ---------- 역재생: 떠오른 것을 거꾸로 — 글자가 다시 물속으로 '슈룩' 가라앉음 (푸터에서 위로 스크롤할 때) ----------
  const SINK = 2.6;                                 // 떠오를 때보다 2.6배 빠르게 '슈룩' (약 1초)
  const T_END = Math.max(...letters.map((L) => L.delay)) + DURATION;
  let sinkGen = 0;
  // 메타볼을 멈추고 늘어나 있던 글자·방울·글로우는 제자리로, 수면 마스크·굴절을 다시 씌움 (다시 물속으로 갈 준비)
  function unsettle() {
    viscGen++;                                      // 메타볼 정지
    for (const B of bodies) {
      B.off.x = B.off.y = B.offV.x = B.offV.y = B.e = B.eV = 0;
      B.M = new DOMMatrix();
      B.el.removeAttribute("transform");
      B.t = "";
    }
    pull.G = pull.W = null;
    pull.letter = -1;
    pull.out = pull.outV = 0;
    for (const N of NODES) { N.r = 0; N.on = false; place(N.el, 0, 0, 0); }
    dropS.r = dropS.rv = 0;
    place(dropEl, 0, 0, 0);
    resetIri();
    if (MASK_ATTR) masked.setAttribute("mask", MASK_ATTR);
    if (LIQUID_ATTR) liquid.setAttribute("filter", LIQUID_ATTR);
    lettersDone = false;
  }
  // ---------- 스크롤에 맞춰 떠오름·가라앉음: 진행도 k(0 물속 → 1 다 떠오름)의 장면을 그대로 그림 (js/hero.js) ----------
  function seek(k) {
    const t = clamp01(k) * T_END;
    tickGen++;
    sinkGen++;
    if (t >= T_END) {
      if (lettersDone) return;
      for (const L of letters) drawLetter(L, 1, T_END);
      disp.setAttribute("scale", 0);
      blur.setAttribute("stdDeviation", 0);
      curT = T_END;
      opened = true;
      finishLetters();                              // 메타볼 호버 시작
      return;
    }
    if (lettersDone) unsettle();
    curT = resumeT = t;
    startTime = null;
    opened = t > 0;
    state = t > 0 ? "rising" : "hidden";
    let depthSum = 0;
    for (const L of letters) {
      const p = clamp01((t - L.delay) / DURATION);
      drawLetter(L, p, t);
      depthSum += 1 - easeOut(p);
    }
    const depth = depthSum / letters.length;
    noise.setAttribute("baseFrequency",
      `${(0.014 + 0.003 * Math.sin(t * 1.5)).toFixed(4)} ${(0.02 + 0.004 * Math.cos(t * 1.1)).toFixed(4)}`);
    disp.setAttribute("scale", (26 * depth * depth).toFixed(2));
    blur.setAttribute("stdDeviation", (6 * depth).toFixed(2));
  }
  function close() {
    if (state === "hidden" || state === "sinking") return;
    tickGen++;                                      // 떠오르던 중이면 멈춤
    unsettle();
    state = "sinking";
    let t = Math.min(curT || T_END, T_END), last = null;
    const my = ++sinkGen;
    function step(now) {
      if (my !== sinkGen) return;
      if (last === null) last = now;
      t -= ((now - last) / 1000) * SINK;
      last = now;
      curT = Math.max(t, 0);
      let depthSum = 0;
      for (const L of letters) {
        const p = clamp01((t - L.delay) / DURATION);
        drawLetter(L, p, Math.max(t, 0));
        depthSum += 1 - easeOut(p);
      }
      const depth = depthSum / letters.length;
      noise.setAttribute("baseFrequency",
        `${(0.014 + 0.003 * Math.sin(t * 1.5)).toFixed(4)} ${(0.02 + 0.004 * Math.cos(t * 1.1)).toFixed(4)}`);
      disp.setAttribute("scale", (26 * depth * depth).toFixed(2));
      blur.setAttribute("stdDeviation", (6 * depth).toFixed(2));
      if (t <= 0) { reset(); return; }             // 다 가라앉음 → 처음(물속) 상태
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  return { open, reset, close, seek, state: () => state, isOpen: () => opened, setWobble: (a) => { wobA = a; } };
  }

  // ---------- 처음 화면: 1200 미만 비율 축소 · Hello 에 닿으면 등장 ----------
  const stage = document.getElementById("stage");
  const fit = stage.parentElement;
  function resize() {
    fit.style.setProperty("--s", Math.min(1, innerWidth / 1200));
  }
  addEventListener("resize", resize);
  resize();

  const homeScene = makeScene("", true);
  window.IntroOpen = homeScene.open;            // 스크롤하면 떠오름 (js/hero.js)
  window.IntroReset = homeScene.reset;
  window.IntroClose = homeScene.close;
  window.IntroUp = () => homeScene.state() === "open";   // AHYUN 이 다 떠올라 있는지 (Scroll down 'Hover' 문구)
  window.IntroSeek = homeScene.seek;            // 스크롤 진행도에 맞춰 떠오름/가라앉음 (js/hero.js)          // 프로젝트 화면으로 넘어갈 때: 떠오른 것을 되감듯 가라앉음

  // ---------- 상세 페이지 푸터 AHYUN (detail.js 가 프레임이 다 내려오면 open, 걷히면 reset) ----------
  if (hasFoot) window.FootAhyun = makeScene("-f", false);
})();
