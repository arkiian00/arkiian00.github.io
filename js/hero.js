/* 히어로 (Figma 286:5979 → 187:289) — 스크롤 위치에 맞춰 나오고, 거꾸로 스크롤하면 역재생
 *
 *  스크롤한 거리 D 하나로 전체 장면이 정해짐 (손을 떼면 그 자리에서 멈추고, 위로 스크롤하면 그대로 되감김):
 *   0 → R        Hello 바가 물방울처럼 데구르르 굴러 화면 맨 위 GNB 자리(높이 90, 바 top 19)로 올라감
 *                - 움직이는 속도만큼만 꾸물거림 (scale 0.96~1.05, 8축 모서리 곡률이 살짝 일렁임), 멈추면 스프링으로 반듯하게
 *                - 굴러간 거리만큼 위쪽 하이라이트(inset)·광택(.nav__spec)이 표면을 따라 돌아 구르는 착시 (거꾸로 가면 반대로 돔)
 *                - 글자는 바의 변형을 되돌려(역스케일) 선명하게 유지
 *   AHYUN        물속에서 떠오름 / 가라앉음 (js/intro.js seek) — 다 떠오르면 물방울 호버 시작
 *   Hello, I’m   젖은 종이에 물이 스미듯 번지며 나타남 / 거꾸로 마름
 *   Crafting…·Find me (Figma 187:289) 같은 방식으로 이어서
 *   한 번 더     AHYUN·Hello, I’m·Crafting 은 거꾸로 가라앉고/마르고, Hello 글자가 왜곡되며 세로로 돌아 Project 로 →
 *                바 밑에서 물방울이 떨어져 목록 패널로 부풀고 카드가 내려옴 (Figma 187:308, js/project.js ProjectScrub)
 *                Side bar · Scroll down 은 제자리
 *   더 스크롤    목록이 바 속으로 걷히고 Project → About (같은 원통 글자), About 내용이 스크롤할수록 한 덩어리씩 스며 나옴 (Figma 292:6742)
 *  화면 위치는 실제 스크롤 입력을 스프링으로 부드럽게 따라감 — 빠르게 굴리면 빠르게, 천천히 굴리면 천천히.
 *  모든 움직임은 transform / opacity / 필터 속성만 — 멈추면 인라인 스타일을 지우고 루프도 쉼.
 */
(() => {
  const stage = document.getElementById("stage");
  const nav = document.getElementById("nav");
  const label = nav && nav.querySelector(".nav__label");
  const spec = nav && nav.querySelector(".nav__spec");
  const hi = document.getElementById("heroHi");
  const craftLines = [...document.querySelectorAll("#heroCraft p")];
  const find = document.getElementById("heroFind");
  const inkSrc = document.getElementById("inkBleed");
  if (!stage || !nav || !label) return;

  const HOME_Y = 374;               // 처음 가운데 자리 (스테이지 좌표)
  const GNB_H = 90, BAR_H = 52;     // 맨 위 GNB 높이(패딩 포함) · 바 높이
  const RAD = 20;                   // 반듯한 알약 바 모서리
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const clamp01 = (v) => clamp(v, 0, 1);
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const range = (D, a, b) => clamp01((D - a) / (b - a));

  // 열린 Hello 의 스테이지 좌표 top: 화면(viewport) 맨 위 GNB 90 안 가운데에 오도록 (스테이지는 축소·가운데 정렬됨)
  // 상단 바는 폭 402 고정, 화면이 402 + 좌우 30 보다 좁으면 비율 유지 축소 (k). 스테이지는 따로 s 배율이므로 바에는 k / s
  const colK = () => Math.min(1, (innerWidth - 60) / 402);
  let NK = 1;
  function fitNav() {
    const s = Math.min(1, innerWidth / 1200);
    NK = colK() / s;
    stage.style.setProperty("--nk", NK.toFixed(4));
  }
  fitNav();
  addEventListener("resize", fitNav);
  function navTop() {
    const s = parseFloat(getComputedStyle(stage.parentElement).getPropertyValue("--s")) || 1;
    const r = stage.getBoundingClientRect();
    return (GNB_H / 2 - r.top) / s - BAR_H / 2;      // 가운데 기준 축소이므로 바 가운데가 GNB 90 의 가운데(45)
  }
  let R = HOME_Y - 19;              // 굴러 올라가는 거리 = 스크롤 구간 길이 (열 때 다시 잼)
  function placeTop() {
    const T = navTop();
    stage.style.setProperty("--nav-y", `${T.toFixed(2)}px`);
    stage.style.setProperty("--nav-dy", `${(T - 19).toFixed(2)}px`);
    R = HOME_Y - T;
  }
  addEventListener("resize", () => { if (stage.classList.contains("is-open")) placeTop(); });

  const CRAFT_STEP = 90;            // Crafting 네 줄이 한 줄씩 — 줄 사이 스크롤 간격
  // 스크롤 구간 (D 단위 = 스크롤 px)
  const seg = () => ({
    ahyun: [0.45 * R, R + 140],
    hi: [0.8 * R, R + 170],
    craft: [R + 200, R + 350],      // Crafting 첫 줄 (다음 줄은 CRAFT_STEP 씩 뒤에)
    find: [R + 540, R + 760],
    out: [R + 830, R + 1430],       // AHYUN·문구가 천천히 되감기며 사라짐 (스크롤 600)
    proj: [R + 1330, R + 2230],     // 프로젝트 화면 (스크롤 900 — 천천히, 거의 다 사라진 뒤)
    // 프로젝트 목록이 다 펼쳐진 뒤 스크롤 300 동안은 그대로 머묾 (카드를 고르고 누를 여유)
    aboutBar: [R + 2530, R + 3530], // 목록이 천천히 걷힘 + Project → About (js/project.js, 스크롤 1000)
    about: R + 3370,                // About 내용이 한 덩어리씩 스며 나옴·내용 스크롤 시작 (js/about.js)
    end: R + 3370 + (window.AboutLength ? window.AboutLength() : 1400),
  });

  // ---------- 상태 ----------
  let target = 0;                   // 스크롤 입력이 정한 위치
  const pos = { x: 0, v: 0 };       // 화면이 따라가는 위치 (스프링)
  const sx = { x: 1, v: 0 }, sy = { x: 1, v: 0 }, ph = { x: 0, v: 0 }, amp = { x: 0, v: 0 };
  const rad = Array.from({ length: 8 }, () => ({ x: RAD, v: 0 }));
  let running = false, locked = false, last = 0, drawn = -1;
  window.heroRolling = false;

  // 상세 페이지 · 프로젝트 메뉴(About/Home)·이동 중에는 스크롤 장면을 움직이지 않음
  const blocked = () => locked || document.body.classList.contains("is-detail") ||
    (window.ProjectScrollable ? !window.ProjectScrollable() : false);
  const SHAPE = { k: 0.14, c: 0.2 };
  const spring = (o, to, P) => { o.v += (to - o.x) * P.k - o.v * P.c; o.x += o.v; };

  function scrollBy(d, fromTween) {
    if (!fromTween) tween = null;                          // 직접 스크롤하면 페이지 이동(클릭)은 멈춤
    if (blocked()) return;
    if (!stage.classList.contains("is-open") && d <= 0) return;
    if (!stage.classList.contains("is-open")) {
      placeTop();
      stage.classList.add("is-open");                       // CSS: nav top = --nav-y — 아래 transform 으로 가운데에서 출발
      nav.style.transform = `translate3d(0, ${R}px, 0) scale(${NK.toFixed(4)})`;
      window.glassLock && window.glassLock(true);
    }
    target = clamp(target + d, 0, seg().end);
    if (reduce) { pos.x = target; pos.v = 0; }
    kick();
  }
  function kick() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  // ---------- 젖은 종이 번짐: 진행도 e(0 → 1)의 모습을 그대로 그림 — 요소마다 #inkBleed 복제 ----------
  const inks = new Map();
  let inkN = 0;
  function inkFor(el) {
    if (inks.has(el)) return inks.get(el);
    const f = inkSrc.cloneNode(true);
    f.id = `inkBleed-${++inkN}`;
    for (const n of f.querySelectorAll("[id]")) n.removeAttribute("id");
    inkSrc.parentNode.appendChild(f);
    const ink = { url: `url(#${f.id})`, blur: f.querySelector("feGaussianBlur"), disp: f.querySelector("feDisplacementMap"), a: f.querySelector("feFuncA"), k: -1 };
    inks.set(el, ink);
    return ink;
  }
  function ink(el, k) {
    if (!el) return;
    if (!inkSrc || reduce) { el.style.opacity = k > 0.5 ? 1 : ""; return; }
    const I = inkFor(el);
    if (Math.abs(I.k - k) < 0.0005) return;
    I.k = k;
    if (k <= 0 || k >= 1) {                                  // 다 마름 / 다 스밈 → 필터 떼기
      el.style.filter = "";
      el.style.opacity = k >= 1 ? "1" : "";
      return;
    }
    const e = easeOut(k);
    if (el.style.filter !== I.url) el.style.filter = I.url;
    I.blur.setAttribute("stdDeviation", (7 * (1 - e)).toFixed(2));
    I.disp.setAttribute("scale", (16 * (1 - e)).toFixed(2));
    // 알파 문턱이 내려가며 얼룩이 가장자리부터 스며 퍼짐
    I.a.setAttribute("slope", lerp(1.5, 1, e).toFixed(3));
    I.a.setAttribute("intercept", lerp(-0.6, 0, e).toFixed(3));
    el.style.opacity = Math.min(1, k * 1.6).toFixed(3);
  }

  // ---------- 한 프레임 ----------
  function frame(now) {
    if (blocked() && !locked) { running = false; return; }
    const dt = Math.min((now - last) / 16.667, 3);
    last = now;
    // 페이지 이동(클릭): 목표 위치를 천천히 옮겨 그 사이 장면이 스크롤처럼 자연스럽게 지나감
    if (tween) {
      const k = clamp01((now - tween.t0) / tween.ms);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      target = tween.from + (tween.to - tween.from) * e;
      if (k >= 1) tween = null;
    }

    // 스크롤 입력을 바로 따라가되 부드럽게 (거의 임계 감쇠 — 빠르게 굴리면 빠르게, 거꾸로면 거꾸로)
    const before = pos.x;
    for (let i = 0; i < dt; i++) { pos.v += (target - pos.x) * 0.1 - pos.v * 0.55; pos.x += pos.v; }
    if (Math.abs(target - pos.x) < 0.05 && Math.abs(pos.v) < 0.02) { pos.x = target; pos.v = 0; }
    const S = seg();
    const D = pos.x;

    // 1) Hello 굴러 올라감 / 내려옴
    const off = R - Math.min(D, R);                          // 맨 위까지 남은 거리
    const rollV = (Math.min(D, R) - Math.min(before, R)) / Math.max(dt, 0.001);   // 올라가면 +, 내려가면 -
    const a = clamp01(Math.abs(rollV) / 7);
    spring(amp, a, { k: 0.2, c: 0.32 });
    ph.x += rollV * dt / 26;                                 // 굴러간 거리 → 표면이 도는 각도 (바 반지름 26)
    if (a < 0.15) ph.x += (Math.round(ph.x / (2 * Math.PI)) * 2 * Math.PI - ph.x) * 0.08 * dt;
    const A = clamp01(amp.x), p = ph.x;
    spring(sy, 1 + A * (0.03 + 0.02 * Math.sin(p * 2)), SHAPE);
    spring(sx, 1 - A * (0.025 + 0.015 * Math.sin(p * 2 + 1.2)), SHAPE);
    for (let i = 0; i < 8; i++) spring(rad[i], RAD + A * 5 * Math.sin(p * 1.5 + i * 0.9 + now * 0.004), SHAPE);
    const shapeIdle = A < 0.01 && Math.abs(sx.x - 1) < 0.001 && Math.abs(sy.x - 1) < 0.001 && rad.every((o) => Math.abs(o.x - RAD) < 0.05);

    if (off > 0.2 || !shapeIdle) {
      const X = clamp(sx.x, 0.96, 1.05), Y = clamp(sy.x, 0.96, 1.05);
      const r = rad.map((o) => `${clamp(o.x, 14, 26).toFixed(1)}px`);
      nav.style.borderRadius = `${r[0]} ${r[1]} ${r[2]} ${r[3]} / ${r[4]} ${r[5]} ${r[6]} ${r[7]}`;
      nav.style.transform = `translate3d(0, ${off.toFixed(2)}px, 0) scale(${(X * NK).toFixed(4)}, ${(Y * NK).toFixed(4)})`;
      label.style.transform = `scale(${(1 / X).toFixed(4)}, ${(1 / Y).toFixed(4)})`;   // 글자는 그대로 선명하게
      const c = Math.cos(p), sn = Math.sin(p);
      nav.style.boxShadow = `var(--glass-drop), inset ${(2 * c).toFixed(2)}px ${(3 * c).toFixed(2)}px 7px 0 rgba(255, 245, 181, ${(0.5 * (0.55 + 0.45 * c)).toFixed(3)}), inset ${(-2 * sn * A).toFixed(2)}px ${(-3 * c * A).toFixed(2)}px 6px 0 rgba(255, 255, 255, ${(0.18 * A).toFixed(3)})`;
      if (spec) {
        spec.style.setProperty("--spec-y", `${((1 - c) * 0.5 * (BAR_H + 4)).toFixed(2)}px`);
        spec.style.setProperty("--spec-o", (A * (0.35 + 0.65 * (0.5 + 0.5 * c))).toFixed(3));
      }
    } else clearRoll();

    // 2) 나머지 장면은 위치 그대로 (같은 위치면 다시 그리지 않음)
    if (D !== drawn) {
      drawn = D;
      pagerSet(pageAt(D, S));
      // 사라질 때는 나타난 순서의 거꾸로, 겹쳐 가며 천천히: Crafting 아래 줄부터 → Hello, I’m → AHYUN 가라앉음
      const [o0, o1] = S.out, ol = o1 - o0;
      const outAt = (a, b) => range(D, o0 + ol * a, o0 + ol * b);
      window.IntroSeek && window.IntroSeek(Math.min(range(D, ...S.ahyun), 1 - outAt(0.4, 1)));
      ink(hi, Math.min(range(D, ...S.hi), 1 - outAt(0.3, 0.75)));
      const nL = craftLines.length;
      craftLines.forEach((el, i) => {
        const j = nL - 1 - i;                                       // 아래 줄부터
        ink(el, Math.min(range(D, S.craft[0] + i * CRAFT_STEP, S.craft[1] + i * CRAFT_STEP), 1 - outAt(j * 0.1, j * 0.1 + 0.3)));
      });
      ink(find, range(D, ...S.find));
      window.ProjectScrub && window.ProjectScrub(range(D, ...S.proj), pos.v / (S.proj[1] - S.proj[0]));
      window.ProjectAbout && window.ProjectAbout(range(D, ...S.aboutBar));
      window.AboutScrub && window.AboutScrub(D - S.about);
      if (find) find.classList.toggle("is-on", D >= S.find[1]);
    }

    // Hello 가 맨 위에서 멈춰 있으면 분리(클릭) 가능 · 호버 유리 효과 다시 켬
    const atTop = off <= 0.2 && shapeIdle;
    window.heroRolling = !atTop;

    const still = !tween && pos.x === target && shapeIdle;
    if (still && D <= 0) { home(); running = false; return; }
    if (still) {
      if (atTop) window.glassLock && window.glassLock(false);
      running = false;
      return;
    }
    requestAnimationFrame(frame);
  }

  function clearRoll() {
    nav.style.transform = nav.style.borderRadius = nav.style.boxShadow = "";
    label.style.transform = "";
    if (spec) { spec.style.removeProperty("--spec-y"); spec.style.removeProperty("--spec-o"); }
  }
  // 끝까지 되감김 → 처음 화면 (Hello 가운데, AHYUN 물속)
  function home() {
    clearRoll();
    stage.classList.remove("is-open");
    window.heroRolling = false;
    window.glassLock && window.glassLock(false);
  }

  function clear() {
    target = pos.x = pos.v = 0;
    drawn = -1;
    tween = null;
    pagerSet("hello");
    locked = false;
    window.heroRolling = false;
    clearRoll();
    for (const el of [hi, ...craftLines, find]) if (el) { el.style.opacity = ""; el.style.filter = ""; }
    for (const I of inks.values()) I.k = -1;
    find && find.classList.remove("is-on");
  }
  // 상세 페이지에서 Project 로 바로 왔을 때: 스크롤 장면을 끝(프로젝트 화면)에 맞춰 둠 — 위로 스크롤하면 그대로 되감김
  window.HeroToEnd = () => {
    placeTop();
    stage.classList.add("is-open");
    const S = seg();
    target = pos.x = drawn = S.proj[1];      // 프로젝트 목록까지 (About 은 더 스크롤하면)
    pagerSet("project", true);
    pos.v = 0;
    clearRoll();
    window.IntroSeek && window.IntroSeek(0);
    ink(hi, 0); craftLines.forEach((el) => ink(el, 0)); ink(find, 1);
    find && find.classList.add("is-on");
    window.heroRolling = false;
  };
  window.HeroInk = ink;                       // About 내용도 같은 번짐 (js/about.js)
  // 처음 화면으로 되돌릴 때(Home) 히어로도 처음 상태로
  const baseReset = window.IntroReset;
  window.IntroReset = (...a) => { clear(); return baseReset && baseReset(...a); };

  // ---------- 페이지 표시 (Figma 303:7250): 왼쪽 30 · 화면 세로 가운데 고정, 위부터 Hello · Project · About ----------
  //  지금 페이지는 Onpage(유리 방울, 20), 나머지는 Default(올리브 multiply, 10)
  //  바뀔 때 새 페이지는 방울이 '뽀용' 솟아 나오고, 떠난 페이지는 그 거꾸로 (같은 애니메이션 역재생)
  //  누르면 그 페이지로 스크롤 장면이 천천히 이동 (tween)
  let tween = null;
  const pager = document.getElementById("pager");
  const pages = pager ? [...pager.querySelectorAll("[data-page]")] : [];
  function pageAt(D, S) {
    if (D < S.proj[0] + 120) return "hello";
    if (D < S.aboutBar[0] + (S.aboutBar[1] - S.aboutBar[0]) * 0.45) return "project";
    return "about";
  }
  // 나타날 때: 물방울 — 작은 동그란 방울이 맺혀(흐림 → 또렷) 표면 장력으로 천천히 옆으로 번져 펴짐 (튕김 없이)
  const POP = [
    { opacity: 0, transform: "scale(0.3, 0.55)", filter: "blur(1.6px)" },
    { opacity: 1, transform: "scale(0.34, 1.08)", filter: "blur(0.6px)", offset: 0.3 },
    { opacity: 1, transform: "scale(0.7, 1.02)", filter: "blur(0.2px)", offset: 0.58 },
    { opacity: 1, transform: "scale(1.02, 0.97)", filter: "blur(0px)", offset: 0.85 },
    { opacity: 1, transform: "scale(1, 1)", filter: "blur(0px)" },
  ];
  // Onpage → Default: 유리 방울이 20 → 10 으로 빠르게 줄어들며 색이 Default(올리브 60%)로 바뀜 — 한 덩어리처럼
  const SHRINK = [
    { opacity: 1, transform: "scaleX(1)" },
    { opacity: 0, transform: "scaleX(0.5)" },
  ];
  const DOT_SHRINK = [
    { opacity: 0, transform: "scaleX(2)" },
    { opacity: 0.6, transform: "scaleX(1)" },
  ];
  const DOT_OUT = [
    { opacity: 0.6, transform: "scaleX(1)" },
    { opacity: 0, transform: "scaleX(1.8)" },
  ];
  let curPage = null;
  function pagerSet(page, instant) {
    if (!pager || page === curPage) return;
    const prev = curPage;
    curPage = page;
    for (const b of pages) {
      const on = b.dataset.page === page, was = b.dataset.page === prev;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-current", on ? "page" : "false");
      if (!on && !was) continue;
      const drop = b.querySelector(".pager__drop"), dot = b.querySelector(".pager__dot");
      drop.getAnimations().forEach((a) => a.cancel());
      dot.getAnimations().forEach((a) => a.cancel());
      if (instant || reduce) {
        drop.style.opacity = on ? "1" : "0"; dot.style.opacity = on ? "0" : "0.6";
        continue;
      }
      drop.style.opacity = dot.style.opacity = "";
      if (on) {
        drop.animate(POP, { duration: 1200, easing: "cubic-bezier(.4,0,.2,1)", fill: "both" });
        dot.animate(DOT_OUT, { duration: 500, easing: "ease-out", fill: "both" });
      } else {
        const o = { duration: 320, easing: "cubic-bezier(.3,0,.2,1)", fill: "both" };   // 빠르게 줄어듦
        drop.animate(SHRINK, o);
        dot.animate(DOT_SHRINK, o);
      }
    }
  }
  pagerSet("hello", true);
  function goPage(page) {
    if (!pager || blocked()) return;
    const S = seg();
    const to = page === "hello" ? S.find[1] : page === "project" ? S.proj[1] + 120 : S.about + 520;
    if (!stage.classList.contains("is-open")) scrollBy(1, true);
    const from = target;
    if (Math.abs(to - from) < 2) return;
    tween = { from, to, t0: performance.now(), ms: Math.min(2600, 900 + Math.abs(to - from) * 0.55) };
    kick();
  }
  for (const b of pages) b.addEventListener("click", () => goPage(b.dataset.page));
  // 처음 화면 가운데 Hello 를 누르면: 스크롤하지 않아도 Hello 가 맨 위 고정(GNB) 자리로 굴러 올라감
  //  (스크롤로 올라갈 때와 같은 장면 — AHYUN 이 떠오르고 Hello, I’m 이 스며 나온 자리까지, 위로 스크롤하면 그대로 되감김)
  nav && nav.addEventListener("click", () => {
    if (blocked()) return;
    if (stage.classList.contains("is-open") && target >= R) return;      // 이미 맨 위에 붙어 있음
    if (!stage.classList.contains("is-open")) scrollBy(1, true);         // 열면서 굴러 올라갈 거리(R)를 새로 잼 → 그 뒤에 목표 계산
    const to = seg().hi[1];
    const from = target;
    tween = { from, to, t0: performance.now(), ms: 1100 };
    kick();
  });

  // ---------- 스크롤 입력: 휠 · 쓸어올림/내림 · 키 ----------
  addEventListener("wheel", (e) => {
    const d = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
    if (d) scrollBy(clamp(d, -120, 120));
  }, { passive: true });
  let ty = null;
  addEventListener("touchstart", (e) => { ty = e.touches[0].clientY; }, { passive: true });
  addEventListener("touchmove", (e) => {
    if (ty === null) return;
    const y = e.touches[0].clientY;
    scrollBy((ty - y) * 1.4);
    ty = y;
  }, { passive: true });
  addEventListener("touchend", () => { ty = null; }, { passive: true });
  const KEYS = { ArrowDown: 80, ArrowUp: -80, PageDown: 300, PageUp: -300, " ": 300 };
  addEventListener("keydown", (e) => {
    if (e.key in KEYS) scrollBy(e.shiftKey && e.key === " " ? -300 : KEYS[e.key]);
    else if (e.key === "End") scrollBy(1e6);
    else if (e.key === "Home") scrollBy(-1e6);
  });
})();
