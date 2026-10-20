/* About (Figma 292:6742 → 296:7141) — 프로젝트에서 더 스크롤하면
 *
 *  js/hero.js 가 About 구간에서 스크롤한 거리 P(px)를 줌 (거꾸로 스크롤하면 그대로 되감김). 스크롤할수록 차례로:
 *   1. Hi I’m Ahhyun / Call me LIa :)  — 젖은 종이에 물이 스미듯 (Hello, I’m 과 같은 번짐 — window.HeroInk)
 *   2. LIa → 물방울 글자 LIA (스마트 애니메이트처럼): 글자 LIa 는 번지며 녹아 사라지고, 자리가 넓어지며
 *      그 자리에서 AHYUN 처럼 액체 덩어리가 부풀어 물방울 글자가 떠오름 (굴절·흐림이 잦아들며 또렷)
 *   3. 소개글이 스며 나옴
 *   4. 강조 글자(flexibly · solve the problem · feel natural)가 Side bar 링크와 같은 물방울 이펙트로 동시에 (js/drip.js DripSet)
 *   5. Careers 전체(제목·사진·경력 목록 한 번에) → 유리 바 한 장씩
 *      경력 줄은 호버하면 같은 물방울 글자 (js/drip.js — [data-drip-hover])
 *   내용이 화면보다 길면 바(GNB 90) 아래로 함께 올라감. 바·목록과 같은 배율(Hello 폭)로 축소.
 *  움직임은 transform / opacity / 필터 속성만.
 */
(() => {
  const about = document.getElementById("about");
  if (!about) return;
  const col = about.querySelector(".about__col");
  const inner = about.querySelector(".about__inner");
  const $ = (s) => about.querySelector(s);
  const lia = document.getElementById("lia");
  const liaText = lia.querySelector(".lia__text");
  const drop = document.getElementById("liaDrop");
  const [hl1, hl2, hl3] = about.querySelectorAll(".about__text [data-drip-scroll]");
  const fbBox = $(".about__fb");
  const fbs = [...fbBox.querySelectorAll(".fb")];   // 동료 피드백 카드 (Figma 320:7802)
  const careers = $(".about__careers");

  const PAUSE = 160;                               // 소개글·강조 다음 쉬는 텀 (휠 한 번 정도)
  // 차례 (gap = 앞 단계에서 이만큼 더 스크롤하면 시작, fade = 다 되는 데 드는 스크롤)
  const steps = [
    { el: $(".about__title"), kind: "ink", gap: 0, fade: 170 },
    { el: lia, kind: "lia", gap: 200, fade: 280, view: $(".about__title") },
    { el: $(".about__text"), kind: "ink", gap: 300, fade: 190 },
    { el: [hl1, hl2, hl3], kind: "drip", gap: 220, fade: 170, view: hl1 },   // 강조 단어 셋이 동시에
    // 강조가 끝나고 한 번 쉰 뒤 → 소개 아래 제자리에서 My Colleagues Say... 가 스며 나옴 (Hi I’m Ahhyun 과 같은 번짐, 슬라이드 없음)
    { el: $(".about__h--fb"), kind: "ink", gap: 170 + PAUSE, fade: 170 },
    // 피드백 카드: 아래 카드부터 한 장씩 천천히 떨어져 내려앉음 (스며 나옴 + 위에서 미끄러져 내려옴 + 닿을 때 출렁)
    // 피드백 카드: 이 자리에 닿으면 한 번에 (스크롤과 무관한 시간 애니메이션으로) 아래 카드부터 도로록 떨어져 묶음으로 뭉침
    { el: fbBox, kind: "fbt", gap: 200, fade: 1, view: fbs[fbs.length - 1] },
    { el: $(".about__careers"), kind: "ink", gap: 200, fade: 190 },
    { el: $(".about__find"), kind: "ink", gap: 200, fade: 170, narrow: true },   // 화면 폭 462 이하에서만 보이는 Find me (Careers 다음)
  ];
  let at = 0;
  for (const s of steps) { at += s.gap; s.at = at; s.at0 = at; }
  // 피드백 카드가 떨어지기 시작하면(fbt) 그때부터 스크롤만큼 내용이 위로 올라가며
  //  소개가 스크롤에 맞춰 역재생되며 사라짐: LIA 물방울 → Hi I’m Ahhyun 제목 → 소개글 (강조 포함, 겹쳐 가며)
  const SCROLL_AT = steps.find((x) => x.kind === "fbt").at;
  const LEAD = SCROLL_AT;
  // 사라지는 길이 = My Colleagues Say... 가 소개글 자리까지 올라가는 거리 (measure) — 그 사이 서서히: LIA → 제목 → 소개글(강조 포함)
  let OUT_LEN = 300;
  const OUT_LIA = [0, 0.35], OUT_TITLE = [0.2, 0.6], OUT_HL = [0.45, 0.75], OUT_TEXT = [0.5, 1];
  const VIEW = 160;                                // 화면 아래에서 이만큼 들어와야 다 됨
  const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  let ps = 1, py = 0, maxOff = 0, measured = false, last = -1;
  function fit() {
    ps = Math.min(1, (innerWidth - 60) / 402);           // 상단 바·목록과 같은 402 고정 · 좁으면 비율 축소
    py = 45 - 45 * ps;
    col.style.setProperty("--ps", ps.toFixed(4));
    col.style.setProperty("--py", `${py.toFixed(2)}px`);
    measured = false;
  }
  // ---- LIa 자리 폭: " LIa " → 공백 7칸 (Figma: "Call me       :)") ----
  let w0 = 0, w1 = 0;
  function measure() {
    const was = about.hidden;
    about.hidden = false;
    const t = inner.style.transform;
    inner.style.transform = "none";
    lia.style.width = "";
    w0 = lia.offsetWidth;
    const txt = liaText.textContent;
    liaText.textContent = "       ";
    w1 = lia.offsetWidth;
    liaText.textContent = txt;
    // 물방울 글자 높이: Figma 에서 글자 상자 위가 둘째 줄 위에서 (61.64 - 20 - 줄높이) — 이미지는 그보다 3 위
    const lineH = $(".about__title").offsetHeight / 2;
    drop.style.top = `${(61.64 - 20 - lineH - 3).toFixed(2)}px`;
    const ir = inner.getBoundingClientRect();
    for (const s of steps) {
      const v = s.view || s.el;
      s.top = (v.getBoundingClientRect().top - ir.top) / ps;
    }
    maxOff = Math.max(0, py + inner.offsetHeight * ps - innerHeight);
    const fbTitleStep = steps.find((x) => x.el === $(".about__h--fb"));
    OUT_LEN = Math.max(120, (fbTitleStep.top - steps[2].top) * ps);   // 제목이 소개글 자리에 닿을 때 다 사라짐
    inner.style.transform = t;
    about.hidden = was;
    measured = true;
  }
  fit();

  // ---- 물방울 글자 LIA 가 떠오름: 글자마다 액체 덩어리(마스크) + 곁방울, 굴절·흐림이 깊이만큼 (AHYUN 과 같은 재료) ----
  const NS = "http://www.w3.org/2000/svg";
  const defs = document.querySelector("svg.defs defs") || document.querySelector("svg.defs");
  const lf = document.createElementNS(NS, "filter");
  lf.id = "liaRise";
  lf.setAttribute("x", "-20%"); lf.setAttribute("y", "-30%"); lf.setAttribute("width", "140%"); lf.setAttribute("height", "160%");
  lf.innerHTML = `<feTurbulence type="fractalNoise" baseFrequency="0.05 0.08" numOctaves="2" seed="5" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="0" xChannelSelector="R" yChannelSelector="G"/>
    <feGaussianBlur stdDeviation="0"/>`;
  defs.appendChild(lf);
  const lNoise = lf.querySelector("feTurbulence"), lDisp = lf.querySelector("feDisplacementMap"), lBlur = lf.querySelector("feGaussianBlur");
  // 글자 L · I · A 의 중심·반폭 (이미지 78.29 × 54.36 안, Figma 경로 기준)
  const LET = [
    { cx: 16.8, hw: 10.8, lag: 0 },
    { cx: 31.2, hw: 5, lag: 0.16 },
    { cx: 49.1, hw: 13.2, lag: 0.08 },
  ].map((L) => ({ ...L, side: [0, 1].map(() => ({ a: Math.random() * 6.28, d: 0.6 + Math.random() * 0.5, lag: 0.1 + Math.random() * 0.3, wob: Math.random() * 6 })) }));
  const CY = 19.2, HH = 16.2;
  let liaK = -1;
  function liaSet(k) {
    if (k === liaK) return;
    liaK = k;
    const e = easeIO(k);
    // 자리 넓어짐 (스마트 애니메이트처럼 :) 가 옆으로 밀려남)
    lia.style.width = k > 0 ? `${lerp(w0, w1, e).toFixed(2)}px` : "";
    // 글자 LIa: 번지며 녹아 사라짐
    const m = clamp01(k / 0.6);
    liaText.style.opacity = (1 - easeOut(m)).toFixed(3);
    liaText.style.filter = m > 0 && m < 1 ? `blur(${(3 * m).toFixed(2)}px)` : "";
    liaText.style.transform = m > 0 ? `translateY(${(-3 * m).toFixed(2)}px) scale(${(1 + 0.2 * m).toFixed(3)})` : "";
    // 물방울 LIA: 떠오름
    const p = clamp01((k - 0.15) / 0.85);
    if (p <= 0) { drop.style.opacity = "0"; drop.style.filter = ""; return; }
    const t = performance.now() / 1000;
    const layers = [];
    let depth = 0;
    for (const L of LET) {
      const q = clamp01((p - L.lag) / (1 - L.lag));
      const qe = easeOut(q);
      depth += 1 - qe;
      const br = 1 + 0.06 * Math.sin(t * 5 + L.cx) * (1 - q);
      const rx = (L.hw + 8) * 1.6 * qe * br, ry = (HH + 8) * 1.6 * qe / br;
      if (rx > 0.2) layers.push(`radial-gradient(${rx.toFixed(1)}px ${ry.toFixed(1)}px at ${L.cx}px ${CY}px, #000 60%, transparent 100%)`);
      if (q > 0 && q < 0.97) for (const s of L.side) {
        const qs = easeOut(clamp01((q - s.lag) / (1 - s.lag)));
        const r = Math.sin(Math.PI * qs) * (3 + HH * 0.35);
        if (r < 0.3) continue;
        const ang = s.a + Math.sin(t * 1.4 + s.wob) * 0.3;
        const x = L.cx + Math.cos(ang) * L.hw * s.d * (0.4 + qs), y = CY + Math.sin(ang) * HH * s.d * (0.4 + qs);
        layers.push(`radial-gradient(${r.toFixed(1)}px ${r.toFixed(1)}px at ${x.toFixed(1)}px ${y.toFixed(1)}px, #000 55%, transparent 100%)`);
      }
    }
    depth /= LET.length;
    drop.style.webkitMaskImage = drop.style.maskImage = p >= 1 ? "none" : (layers.join(",") || "linear-gradient(transparent, transparent)");
    lNoise.setAttribute("baseFrequency", `${(0.05 + 0.01 * Math.sin(t * 1.5)).toFixed(4)} ${(0.08 + 0.012 * Math.cos(t * 1.1)).toFixed(4)}`);
    lDisp.setAttribute("scale", (12 * depth * depth).toFixed(2));
    lBlur.setAttribute("stdDeviation", (3 * depth).toFixed(2));
    drop.style.filter = p >= 1 ? "" : "url(#liaRise)";
    drop.style.opacity = (0.25 + 0.75 * easeOut(p)).toFixed(3);
  }

  // About 구간 전체 길이 (스크롤 px)
  window.AboutLength = () => {
    if (!measured) measure();
    const narrowOn = getComputedStyle($(".about__find")).display !== "none";
    const lastStep = [...steps].reverse().find((x) => !x.narrow || narrowOn);
    return Math.max(SCROLL_AT + maxOff + VIEW, lastStep.at + lastStep.fade);
  };

  // 피드백 카드 (Figma 320:7802 묶음)
  //  네 장 모두 제목 20 아래에서 출발해, 아래 카드부터 하나씩 자기 묶음 자리로 바로 떨어지며 뭉침
  //  — 천천히 출발해 빨라지고(중력) 닿는 순간 '덜커덩' 작게 튀고 '꿀렁울렁' 눌림 ↔ 늘어남,
  //    위 카드가 얹힐 때마다 아래에 먼저 쌓인 카드들도 충격에 같이 꿀렁 (아래로 갈수록 약하게)
  //  한 번의 스크롤로 재생되는 시간 애니메이션. 다 쌓이면 변형 · 필터를 떼어 겹친 뒤가 서리 유리(backdrop blur 20)로 가려짐
  const FB_H = [91.849, 135.591, 142.211, 102.749], FB_GAP = -60;   // 320:7802
  const tK = FB_H.reduce((a, h, i) => (a.push(i ? a[i - 1] + FB_H[i - 1] + FB_GAP : 0), a), []);
  const FB_PAD = 40, FB_START = 20;                                     // 묶음 위 여백 40 · 시작 = 제목 아래 20
  const fbStart = tK.map((t) => (FB_START - FB_PAD) - t);              // 묶음 자리 → 시작 자리 (위로)
  function fbSet(el, k) {
    if (el._k === k) return;
    el._k = k;
    window.HeroInk && window.HeroInk(el, clamp01(k / 0.3));             // 출발하며 액체처럼 번져 나타남
    fbDirty = true;
  }
  let fbDirty = false;
  const FALL = 0.42;                                                     // k 0 ~ FALL 떨어짐 · FALL ~ 1 닿은 뒤 출렁
  const land = (t) => {
    const d = Math.exp(-4.4 * t);
    return {
      y: -9 * Math.abs(Math.sin(Math.PI * 2.2 * t)) * Math.exp(-6 * t),  // 덜커덩
      sq: 0.1 * d * Math.cos(Math.PI * 4.2 * t),                           // + 눌림 / − 늘어남
      r: 1.4 * d * Math.sin(Math.PI * 3.2 * t),                            // 갸웃
    };
  };
  function fbRender() {
    if (!fbDirty) return;
    fbDirty = false;
    const n = fbs.length;
    for (let j = 0; j < n; j++) {
      const el = fbs[j], k = el._k || 0;
      let y = 0, sq = 0, r = 0;
      if (k <= 0) { el._m = null; if (el._t !== "") { el.style.transform = ""; el._t = ""; } continue; }
      if (k < FALL) {
        const f = k / FALL;
        y = fbStart[j] * (1 - f * f);
        sq = -0.05 * f * f;
      } else if (k < 1) {
        const L = land((k - FALL) / (1 - FALL));
        y = L.y; sq = L.sq; r = L.r;
      }
      for (let i = j - 1; i >= 0; i--) {                                   // 위 카드가 얹히는 충격
        const ki = fbs[i]._k || 0;
        if (ki <= FALL || ki >= 1) continue;
        const L = land((ki - FALL) / (1 - FALL)), w = 0.5 / (j - i);
        y += Math.max(L.sq, 0) * 30 * w;
        sq += L.sq * w;
        r -= L.r * w * 0.6;
      }
      el._m = { y, sx: 1 + sq, sy: 1 - sq, r };
      const t = Math.abs(y) < 0.01 && Math.abs(sq) < 0.0005 && Math.abs(r) < 0.01 ? "" :
        `translate3d(0, ${y.toFixed(2)}px, 0) rotate(${r.toFixed(3)}deg) scale(${(1 + sq).toFixed(4)}, ${(1 - sq).toFixed(4)})`;
      if (el._t !== t) { el.style.transform = t; el._t = t; }
    }
  }
  const backOut = (t, c = 1.5) => 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);

  // ---- 한 번의 스크롤로 재생되는 타임라인 (초) — 아래 카드부터 STAG 간격으로 떨어져 쌓임 ----
  const FB_HOLD = 160;
  const STAG = 0.2, CARD_S = 1.15, TOTAL = 3 * STAG + CARD_S;
  let fbT = 0, fbDir = 0, fbRaf = 0, fbAt = 0;
  function fbFrame(now) {
    fbRaf = 0;
    const dt = Math.min((now - fbAt) / 1000, 0.05);
    fbAt = now;
    fbT = clamp01(fbT + (fbDir > 0 ? dt / TOTAL : -dt / (TOTAL * 0.45)));   // 되돌아갈 땐 빠르게
    const T = fbT * TOTAL;
    fbs.forEach((el, i) => fbSet(el, clamp01((T - (fbs.length - 1 - i) * STAG) / CARD_S)));   // 아래 카드부터
    fbRender();
    fbBox.classList.toggle("is-live", fbT >= 1);
    if ((fbDir > 0 && fbT < 1) || (fbDir < 0 && fbT > 0)) fbRaf = requestAnimationFrame(fbFrame);
  }
  function fbPlay(to) {
    const dir = to ? 1 : -1;
    if (dir === fbDir && (fbRaf || fbT === to)) return;
    fbDir = dir;
    if (!fbRaf && fbT !== to) { fbAt = performance.now(); fbRaf = requestAnimationFrame(fbFrame); }
  }

  function apply(s, k) {
    if (s.kind === "ink") window.HeroInk && window.HeroInk(s.el, k);
    else if (s.kind === "fb") fbSet(s.el, k);
    else if (s.kind === "fbt") { if (k >= 1) fbPlay(1); else if (k <= 0 && s.back) fbPlay(0); }   // 되돌리기는 한참 위로 올렸을 때만 (스크롤 출렁임에 다시 재생되지 않게)
    else if (s.kind === "lia") liaSet(k);
    else if (s.kind === "drip") for (const el of [].concat(s.el)) window.DripSet && window.DripSet(el, k);
  }

  window.AboutScrub = (P) => {
    if (P <= 0) {
      if (!about.hidden) {
        about.hidden = true;
        for (const s of steps) apply(s, 0);
        careers.classList.remove("is-live");
        fbBox.classList.remove("is-live");
        if (fbRaf) cancelAnimationFrame(fbRaf);
        fbRaf = 0; fbDir = 0; fbT = 0;
        for (const el of fbs) fbSet(el, 0);
        fbRender();
        inner.style.transform = "";
        last = -1;
      }
      return;
    }
    if (about.hidden) { about.hidden = false; if (!measured) measure(); }
    if (P === last) return;
    last = P;
    const d = Math.max(P - SCROLL_AT, 0);
    const off = Math.min(d, maxOff);                                   // 화면 px — 스크롤만큼 올라감
    const outK = ([a, b]) => 1 - clamp01((d / OUT_LEN - a) / (b - a)); // 1 = 그대로 · 0 = 다 사라짐 (역재생)
    inner.style.transform = `translate3d(0, ${(-off / ps).toFixed(2)}px, 0)`;
    for (const s of steps) {
      const top = py + s.top * ps - off;                     // 화면에서 이 덩어리 위쪽
      const view = clamp01((innerHeight - 40 - top) / (s.narrow ? 60 : VIEW));   // 맨 끝 Find me 는 화면 끝까지 올라오지 못하므로 짧게
      const seq = clamp01((P - s.at) / s.fade);
      let k = s.kind === "fbt" ? seq : Math.min(view, seq);   // 피드백 카드는 이 차례에 닿는 순간 재생
      if (s.kind === "fbt") s.back = P < s.at - 80;
      if (s === steps[0]) k = Math.min(k, outK(OUT_TITLE));            // Hi I’m Ahhyun / Call me … :) 마름
      else if (s === steps[1]) k = Math.min(k, outK(OUT_LIA));         // LIA 물방울 글자 → 다시 LIa
      else if (s === steps[2]) k = Math.min(k, outK(OUT_TEXT));        // 소개글 마름
      else if (s === steps[3]) k = Math.min(k, outK(OUT_HL));          // 강조 물방울 → 다시 글자
      apply(s, k);
      if (s.el === careers) careers.classList.toggle("is-live", k >= 1);
      if (s.narrow) s.el.classList.toggle("is-live", k >= 1);
    }

  };

  addEventListener("resize", () => { fit(); last = -1; liaK = -1; });

  // ---------- Careers 사진 (Figma 320:7677): 경력 줄에 호버하면 그 경력 사진으로 — 액자 크기도 사진에 맞춰 바뀜 ----------
  //  사진 크기 = Figma 변형별 이미지 크기 (액자는 사방 16 여백). 사진이 없는 경력은 지금 사진 그대로, 목록을 벗어나면 첫 사진으로
  //  [사진 자리 폭, 높이, 파일, 안쪽 여백] — 움직이는 사진(Figma 원본 GIF)은 같은 장면 · 같은 박자의 애니메이션 WebP 로 (훨씬 가벼움)
  //  luxury (Figma 323:7828): 212 자리 안에 20 여백을 두고 사진(172 × 174)
  const SHOTS = {
    framer: [264, 212, "framer.webp"], uniquegood: [286, 177, "uniquegood.webp"], rockly: [286, 176, "rockly.webp"],
    kbs: [286, 215, "kbs.webp"], freelancer: [150, 212, "freelancer.webp"], graphic: [216, 212, "graphic.webp"],
    mlb: [161, 212, "mlb.jpg"], luxury: [212, 212, "luxury.jpg", 20], ever: [286, 198, "ever.jpg"], graduation: [141, 212, "graduation.webp"],
  };
  // 경계선 블러 마스크: 사진 경계 양쪽 2~3px 만 살짝 흐려 칼 같은 픽셀 단차만 없앰 (안쪽으로 번지는 비네팅 아님)
  //  사진 상자를 사방 FEATHER_BLEED 만큼 키워 두고(CSS --bleed), 마스크 사각형은 원래 사진 경계 그대로(rx 40) · σ FEATHER_SD
  //  → 사진 면적 그대로, 투명도 0 은 상자 끝(클리핑 경계)보다 2px 안쪽에서 끝남 (BLEED = 2 + 3σ)
  const FEATHER_SD = 1.5, FEATHER_BLEED = 2 + 3 * FEATHER_SD;
  const masks = {};
  function featherMask(img, w, h) {
    if (!w) { img.style.webkitMaskImage = img.style.maskImage = "none"; return; }
    const B = FEATHER_BLEED, W = w + 2 * B, H = h + 2 * B, key = `${w}x${h}`;
    if (!masks[key]) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
        `<filter id="f" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${FEATHER_SD}"/></filter>` +
        `<mask id="m" x="-10%" y="-10%" width="120%" height="120%"><rect x="${B}" y="${B}" width="${w}" height="${h}" rx="40" ry="40" fill="#fff" filter="url(#f)"/></mask>` +
        `<rect width="${W}" height="${H}" fill="#fff" mask="url(#m)"/></svg>`;
      masks[key] = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    }
    img.style.webkitMaskImage = img.style.maskImage = masks[key];
  }
  const shot = document.getElementById("careerShot");
  if (shot) {
    const layers = [...shot.querySelectorAll(".about__layer")];
    let cur = "framer", front = 0;
    featherMask(layers[0].querySelector(".about__img"), SHOTS.framer[0], SHOTS.framer[1]);
    const show = (key) => {
      if (!SHOTS[key] || key === cur) return;
      cur = key;
      const [w, h, file, pad = 0] = SHOTS[key];
      const src = `assets/careers/${file}`;
      const next = layers[1 - front];
      const nimg = next.querySelector(".about__img");
      nimg.src = src;
      featherMask(nimg, pad ? 0 : w, h);                                  // luxury 는 효과 없이 Figma 그대로
      next.classList.toggle("is-pad", pad > 0);
      next.style.setProperty("--pad", `${pad}px`);
      const go = () => {
        if (cur !== key) return;
        next.classList.add("is-on");
        layers[front].classList.remove("is-on");
        front = 1 - front;
      };
      const img = next.querySelector(".about__img");
      img.complete ? go() : img.addEventListener("load", go, { once: true });
      shot.style.width = `${w}px`;
      shot.style.height = `${h}px`;
    };
    // 미리 받아 둠 (처음 호버 때 깜빡이지 않게)
    //  — About 의 Careers 가 처음 나타날 때 한 번 (첫 화면 로딩에는 부담 없게)
    let warmed = false;
    const warm = () => { if (warmed) return; warmed = true; for (const v of Object.values(SHOTS)) { const im = new Image(); im.src = `assets/careers/${v[2]}`; } };
    new MutationObserver(() => careers.classList.contains("is-live") && warm()).observe(careers, { attributes: true, attributeFilter: ["class"] });
    const list = about.querySelector(".about__list");
    // 마우스: 호버로 바뀌고 목록을 벗어나면 첫 사진 / 터치(모바일): 누르면 그 경력 사진으로 바뀌고 다른 줄을 누를 때까지 그대로
    list.addEventListener("pointerover", (e) => { if (e.pointerType === "touch") return; const li = e.target.closest("li[data-shot]"); if (li) show(li.dataset.shot); });
    list.addEventListener("pointerleave", (e) => { if (e.pointerType !== "touch") show("framer"); });
    list.addEventListener("click", (e) => { const li = e.target.closest("li[data-shot]"); if (li) show(li.dataset.shot); });
  }
})();
