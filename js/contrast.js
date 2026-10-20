/* 컴포넌트 글자색 자동 대비 — 밝은 배경 위에서는 검정, 어두운 배경 위에서는 흰색 (부드럽게 바뀜)
 *
 *  각 유리 컴포넌트(바·버튼) 뒤에 실제로 무엇이 있는지 몇 지점을 찍어 밝기를 잼:
 *   - 이미지(사진·움직이는 화면)면 그 자리 픽셀을 작은 캔버스에서 읽음 (object-fit 반영, 투명하면 그 아래로)
 *   - 아니면 위로 올라가며 처음 만나는 불투명 배경색
 *  평균 밝기가 기준보다 밝으면 검정, 어두우면 흰색 — 기준 근처에서는 깜빡이지 않게 여유(히스테리시스)를 둠.
 *  색 바뀜은 CSS transition (--fg). 스크롤·크기 변화 때 0.12초 간격으로만 다시 잼.
 */
(() => {
  // 프로젝트 화면의 Project 바(#pbar)는 항상 검정 글자라 제외
  const SEL = "#nav, #barTop, #barBottom, #pabout, #phome, #gnbBar, #dback, #dproj, #dabout, #dhome, .get-btn";
  const LIGHT = 0.6, BAND = 0.05;        // 상대 휘도 기준 (올리브 #B8C987 ≈ 0.54 → 흰색, 크림 ≈ 0.94 → 검정)
  const DARK_FG = "#000", LIGHT_FG = "#fff";

  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const parse = (s) => {
    const m = s && s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
  };

  // 이미지는 32px 축소본을 한 번만 그려 두고 픽셀을 읽음 (같은 출처 이미지)
  const samples = new WeakMap();
  function sampler(img) {
    if (samples.has(img)) return samples.get(img);
    if (!img.complete || !img.naturalWidth) return null;
    let s = null;
    try {
      const W = 32, H = Math.max(1, Math.round((32 * img.naturalHeight) / img.naturalWidth));
      const cv = document.createElement("canvas");
      cv.width = W; cv.height = H;
      const ctx = cv.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, W, H);
      s = { W, H, d: ctx.getImageData(0, 0, W, H).data };
    } catch (e) { s = null; }
    samples.set(img, s);
    return s;
  }
  // 화면 좌표 → 이미지 픽셀 (object-fit cover / contain / fill, 가운데 정렬)
  function imgPixel(img, x, y) {
    const s = sampler(img);
    if (!s) return null;
    const r = img.getBoundingClientRect();
    const fit = getComputedStyle(img).objectFit;
    const nw = img.naturalWidth, nh = img.naturalHeight;
    let sx = r.width / nw, sy = r.height / nh;
    if (fit === "cover") sx = sy = Math.max(sx, sy);
    else if (fit === "contain") sx = sy = Math.min(sx, sy);
    const ox = (r.width - nw * sx) / 2, oy = (r.height - nh * sy) / 2;
    const u = (x - r.left - ox) / (nw * sx), v = (y - r.top - oy) / (nh * sy);
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return { a: 0 };
    const i = (Math.floor(v * s.H) * s.W + Math.floor(u * s.W)) * 4;
    return { r: s.d[i], g: s.d[i + 1], b: s.d[i + 2], a: s.d[i + 3] / 255 };
  }
  function bgOf(el) {
    for (let n = el; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.5) return c;
    }
    return parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255 };
  }
  // 한 지점 뒤의 밝기 (컴포넌트 자신·그 안쪽은 건너뜀)
  function lumAt(bar, x, y) {
    if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return null;
    // 푸터(#foot)는 pointer-events: none 이라 hit test 에 안 잡힘 → 이 지점을 덮고 있으면 그 배경색으로 (Next 목록 #nextGroup 은 푸터 위)
    const foot = document.getElementById("foot"), ff = foot && !foot.hidden && document.getElementById("footFrame");
    const fb = ff && ff.getBoundingClientRect();
    const onFoot = fb && x >= fb.left && x < fb.right && y >= fb.top && y < fb.bottom;
    for (const el of document.elementsFromPoint(x, y)) {
      if (bar.contains(el) || el.closest(SEL)) continue;
      if (onFoot && !el.closest("#nextGroup")) { const c = parse(getComputedStyle(ff).backgroundColor); if (c && c.a > 0.5) return lum(c.r, c.g, c.b); }
      if (el.tagName === "IMG") {
        const p = imgPixel(el, x, y);
        if (p && p.a > 0.5) return lum(p.r, p.g, p.b);
        if (p) continue;                       // 투명한 자리 → 그 아래
      }
      // pointer-events: none 인 이미지(표지 등)는 hit test 에 안 잡힘 → 잡힌 상자 안의 이미지 중 이 지점을 덮는 것 (위에 그려진 것부터)
      const imgs = el.querySelectorAll("img");
      if (imgs.length && imgs.length <= 24) {
        for (let i = imgs.length - 1; i >= 0; i--) {
          const im = imgs[i], b = im.getBoundingClientRect();
          if (x < b.left || x >= b.right || y < b.top || y >= b.bottom) continue;
          const p = imgPixel(im, x, y);
          if (p && p.a > 0.5) return lum(p.r, p.g, p.b);
        }
      }
      const c = bgOf(el);
      return lum(c.r, c.g, c.b);
    }
    return null;
  }

  function update() {
    for (const bar of document.querySelectorAll(SEL)) {
      if (!bar.offsetParent && getComputedStyle(bar).position !== "fixed") continue;
      const r = bar.getBoundingClientRect();
      if (!r.width || r.bottom < 0 || r.top > innerHeight) continue;
      // 바가 뒤를 가리므로 hit test 동안만 잠시 통과시킴
      const pe = bar.style.pointerEvents;
      bar.style.pointerEvents = "none";
      let sum = 0, n = 0;
      for (const fx of [0.15, 0.5, 0.85]) for (const fy of [0.3, 0.7]) {
        const L = lumAt(bar, r.left + r.width * fx, r.top + r.height * fy);
        if (L !== null) { sum += L; n++; }
      }
      bar.style.pointerEvents = pe;
      if (!n) continue;
      const L = sum / n;
      const was = bar.dataset.fg;                // "dark" = 검정 글씨, "light" = 흰 글씨
      const dark = was === "dark" ? L > LIGHT - BAND : L > LIGHT + BAND;
      const next = dark ? "dark" : "light";
      if (next !== was) {
        bar.dataset.fg = next;
        bar.style.setProperty("--fg", dark ? DARK_FG : LIGHT_FG);
      }
    }
  }

  let t = 0;
  const kick = () => { if (!t) t = setTimeout(() => { t = 0; requestAnimationFrame(update); }, 120); };
  addEventListener("scroll", kick, { passive: true });
  addEventListener("resize", kick);
  // 화면 전환(목록·상세·메뉴·로딩)·이미지 로드 뒤에도 다시 잼
  new MutationObserver(kick).observe(document.body, { attributes: true, subtree: true, childList: true, attributeFilter: ["class", "hidden"] });
  addEventListener("load", kick, true);
  setInterval(kick, 1000);                       // 움직이는 배경(애니메이션) 대비 가벼운 주기 점검
  kick();
})();
