/**
 * Hello 클릭 → Project / About 분리 (Figma 187:290)
 *  - Hello 바가 위(Project, -37px)·아래(About, +45px) 두 바로 물방울처럼 갈라짐
 *    분리되는 동안 몸체는 #gooFilter 액체 레이어가 그려 사이의 목이 늘어났다 끊어짐
 *  - 글자는 상하 회전(rotateX)하며 세로로 늘어나고 물결처럼 휘었다가 제자리로 돌아옴
 *    (두께 변화·RGB 분리 없음, 왜곡만)
 */
(function () {
  const stage = document.getElementById("stage");
  const nav = document.getElementById("nav");
  const split = document.getElementById("split");
  const goo = split.querySelector(".split__goo");
  const blobTop = document.getElementById("blobTop");
  const blobBottom = document.getElementById("blobBottom");
  const neck = document.getElementById("blobNeck");
  const tailTop = document.getElementById("tailTop");
  const tailBottom = document.getElementById("tailBottom");
  const barTop = document.getElementById("barTop");
  const barBottom = document.getElementById("barBottom");
  const warp = document.getElementById("warpDisp");
  const rolls = [...split.querySelectorAll(".roll")];

  // Figma 286:5979: Hello 가 맨 위(19)에 있으므로 Project 는 그 자리, About 은 아래로 (간격 20 → 91)
  const TOP_Y = 0, BOTTOM_Y = 72;
  const BAR_W = 402, BAR_H = 52;
  const NECK_CX = 241, NECK_CY = 146;        // .split__goo 안의 바 중심 (40 + 402/2, 120 + 52/2)
  // 쥬욱 → 도잉: 붙은 채 무겁게 늘어나다가(STRETCH) 목이 끊어지는 순간 튕기며 제자리(SNAP)
  const STRETCH = { stiffness: 0.018, damping: 0.3, mass: 1.8 };  // 쥬욱 — 끈적하게 천천히
  const SNAP = { stiffness: 0.07, damping: 0.14, mass: 1.1 };     // 도잉 — 튕기며 출렁
  const STRETCH_TOP = -6, STRETCH_BOTTOM = 18;                     // 붙은 채 늘어나는 거리 (위는 화면 위라 조금만)
  const SNAP_GAP = 26;                                             // 이만큼 벌어지면 목이 끊어짐
  const TAIL = { stiffness: 0.06, damping: 0.16, mass: 1 };        // 끊어진 꼬리가 바로 빨려 들어가며 출렁
  const ROLL_DELAY = 0.12, ROLL_DUR = 1.0;   // 초
  const GLIDE_MS = 1750;                     // 스크롤 인트로에서 Hello 가 맨 위로 굴러 올라가는 시간 (js/hero.js)

  const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  let openedAt = null;
  new MutationObserver(() => {
    if (openedAt === null && stage.classList.contains("is-open")) openedAt = performance.now();
  }).observe(stage, { attributes: true, attributeFilter: ["class"] });

  let started = false;
  function request() {
    if (started) return;
    started = true;
    // Hello 가 맨 위로 굴러 올라가는 중이면 다 닿은 뒤에 분리 (js/hero.js)
    const wait = () => (window.heroRolling ? setTimeout(wait, 60) : run());
    setTimeout(wait, 30);
  }

  function setT(el, t) {
    if (el._t !== t) { el.style.transform = t; el._t = t; }
  }

  function run() {
    // Hello 바를 같은 자리의 두 바로 교체
    nav.style.opacity = "0";
    nav.style.pointerEvents = "none";
    split.hidden = false;

    const top = { y: 0, v: 0 }, bot = { y: 0, v: 0 };
    const start = performance.now();
    let rollDone = false, bodyDone = false;
    let gap = 0;
    let phase = "stretch", neckK = 1;
    const tails = [{ off: 0, v: 0 }, { off: 0, v: 0 }];
    const bottomOld = rolls.find((r) => r.dataset.dir === "1").children[0];
    bottomOld.style.opacity = "0";   // 겹쳐 있을 땐 Hello 가 하나로 보이도록

    function step(now) {
      const t = (now - start) / 1000;

      // ---- 물방울 분리: 쥬욱 늘어남 → 목 끊어짐 → 도잉 ----
      if (!bodyDone) {
        const snapped = phase === "snap";
        const P = snapped ? SNAP : STRETCH;
        for (const [b, target] of [[top, snapped ? TOP_Y : STRETCH_TOP], [bot, snapped ? BOTTOM_Y : STRETCH_BOTTOM]]) {
          b.v += (P.stiffness * (target - b.y) - P.damping * b.v) / P.mass;
          b.y += b.v;
        }
        gap = bot.y - top.y;
        bottomOld.style.opacity = clamp01(gap / 30).toFixed(2);

        if (!snapped && (gap >= SNAP_GAP || t > 0.75)) {
          // 목이 끊어지는 순간: 각 바에 꼬리가 남아 가운데 쪽으로 늘어져 있음
          phase = "snap";
          tails[0].off = gap * 0.45;     // 위 바의 꼬리는 아래로
          tails[1].off = -gap * 0.45;    // 아래 바의 꼬리는 위로
        }

        // 목: 쥬욱 늘어나는 동안 서서히 가늘어지고, 끊어지면 순식간에 사라짐
        neckK = snapped ? neckK * 0.72 : 1 - 0.65 * clamp01(gap / SNAP_GAP);
        const nw = BAR_W * 0.62 * neckK;
        const nh = gap + 34;
        const cy = NECK_CY + (top.y + bot.y) / 2;
        setT(neck, nw < 0.5 ? "scale(0)"
          : `translate3d(${(NECK_CX - 50).toFixed(1)}px, ${(cy - 50).toFixed(1)}px, 0) scale(${(nw / 100).toFixed(3)}, ${(nh / 100).toFixed(3)})`);

        // 꼬리: 끊어진 자리에서 바 쪽으로 빨려 들어가며 출렁
        for (const [i, b, el, edge] of [[0, top, tailTop, BAR_H / 2], [1, bot, tailBottom, -BAR_H / 2]]) {
          const T = tails[i];
          if (snapped) {
            T.v += (TAIL.stiffness * (0 - T.off) - TAIL.damping * T.v) / TAIL.mass;
            T.off += T.v;
          }
          const r = snapped ? Math.min(6 + Math.abs(T.off) * 0.9, 22) * clamp01(Math.abs(T.off) / 2) : 0;
          const ty = NECK_CY + b.y + edge * 0.7 + T.off;
          setT(el, r < 0.5 ? "scale(0)"
            : `translate3d(${(NECK_CX - 50).toFixed(1)}px, ${(ty - 50).toFixed(1)}px, 0) scale(${(r / 50).toFixed(3)}, ${(r * 1.25 / 50).toFixed(3)})`);
        }

        // 바 몸체: 늘어날 땐 세로로 길어지고(쥬욱), 튕길 땐 속도만큼 늘었다 줄었다(도잉)
        for (const [b, blob, bar] of [[top, blobTop, barTop], [bot, blobBottom, barBottom]]) {
          const s = snapped
            ? Math.max(Math.min(b.v * Math.sign(b.y) * 0.02, 0.14), -0.1)
            : 0.08 * clamp01(gap / SNAP_GAP);
          const tr = `translate3d(0, ${b.y.toFixed(2)}px, 0) scale(${(1 - s * 0.5).toFixed(3)}, ${(1 + s).toFixed(3)})`;
          setT(blob, tr);
          setT(bar, tr);
        }
        if (snapped && t > 1.2 && Math.abs(top.v) + Math.abs(bot.v) + Math.abs(tails[0].v) + Math.abs(tails[1].v) < 0.03 &&
            Math.abs(top.y - TOP_Y) + Math.abs(bot.y - BOTTOM_Y) < 0.3) {
          setT(barTop, `translate3d(0, ${TOP_Y}px, 0)`);
          setT(barBottom, `translate3d(0, ${BOTTOM_Y}px, 0)`);
          barTop.classList.remove("is-liquid");
          barBottom.classList.remove("is-liquid");
          goo.classList.add("is-done");
          bodyDone = true;
        }
      }

      // ---- 글자 전환: 상하 회전 + 왜곡 ----
      if (!rollDone) {
        const r = clamp01((t - ROLL_DELAY) / ROLL_DUR);
        const e = easeInOut(r);
        const bend = Math.sin(Math.PI * e);                       // 회전 중간에 가장 크게 왜곡
        const settle = Math.sin(Math.PI * clamp01((r - 0.72) / 0.28)) * (1 - r) * 4;  // 제자리 직전 살짝 넘침
        for (const roll of rolls) {
          const up = roll.dataset.dir === "-1";                   // 위 바는 위로, 아래 바는 아래로 굴러감
          const sgn = up ? 1 : -1;
          const [oldW, newW] = roll.children;
          const sy = 1 + 0.55 * bend;
          setT(oldW, `rotateX(${(sgn * 90 * e).toFixed(2)}deg) scaleY(${sy.toFixed(3)})`);
          setT(newW, `rotateX(${(-sgn * (90 * (1 - e) - 10 * settle)).toFixed(2)}deg) scaleY(${sy.toFixed(3)})`);
        }
        warp.setAttribute("scale", (22 * bend).toFixed(2));
        if (r >= 1) {
          for (const roll of rolls) {
            setT(roll.children[0], "rotateX(90deg)");
            setT(roll.children[1], "none");
            roll.style.filter = "none";
          }
          warp.setAttribute("scale", "0");
          rollDone = true;
        }
      }

      if (!(rollDone && bodyDone)) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // 처음 화면으로: 분리 전 상태 (Hello 하나, 분리 바·액체 레이어 원래대로)
  function reset() {
    started = false;
    openedAt = null;
    split.hidden = true;
    nav.style.opacity = "";
    nav.style.pointerEvents = "";
    for (const el of [blobTop, blobBottom, neck, tailTop, tailBottom, barTop, barBottom]) {
      el.style.transform = "";
      el._t = undefined;
    }
    barTop.classList.add("is-liquid");
    barBottom.classList.add("is-liquid");
    goo.classList.remove("is-done");
    for (const roll of rolls) {
      roll.style.filter = "";
      for (const w of roll.children) { w.style.transform = ""; w.style.opacity = ""; w._t = undefined; }
    }
    warp.setAttribute("scale", "0");
  }

  nav.addEventListener("click", request);
  window.SplitNav = { request, reset };
})();
