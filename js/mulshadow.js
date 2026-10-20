/* 상세 페이지 컴포넌트 그림자 — 진짜 Multiply
 *
 *  상세 페이지의 바·목록·버튼은 사진 위에 떠 있어서 미리 곱한 그림자 색으로는 multiply 가 되지 않음.
 *  box-shadow 는 자기 그림자에만 blend 를 줄 수 없고, 컴포넌트 안에 넣으면 부모(쌓임 맥락)에 갇혀 아래 사진과 섞이지 않음.
 *  → 화면 최상위에 그림자만 그리는 레이어(.mul-shadows, mix-blend-mode: multiply)를 두고
 *    각 컴포넌트 자리에 같은 모양의 투명 상자 + 원래 그림자를 그림 (바깥 그림자는 상자 바깥에만 그려져 몸체를 가리지 않음).
 *  컴포넌트 자신의 그림자는 끔 (CSS: body.is-detail [data-mul-shadow]).
 *  매 프레임 위치·크기·투명도를 맞춤 (상세 페이지가 열려 있는 동안만).
 */
(() => {
  // Figma P-1 drop shadow 가 있는 컴포넌트: 상단 바 · Next 목록 · 메뉴 바 · Get component · 본문 유리 프레임
  const SEL = '#gnbBar, #dback, #nextList, .dmenu .pbar, .detail [class*="shadow-[5px_8px_8px_3px"]';
  const HIDE = ["is-unified", "is-drip", "is-liquid", "is-splitting"];   // 물방울 모핑 중에는 액체 레이어가 그림자를 그림

  const layer = document.createElement("div");
  layer.className = "mul-shadows";
  layer.setAttribute("aria-hidden", "true");
  layer.hidden = true;
  document.body.appendChild(layer);

  let items = [];            // { el, sh, k }
  let raf = 0;

  function collect() {
    const els = [...document.querySelectorAll(SEL)];
    for (const it of items) if (!els.includes(it.el)) it.sh.remove();
    items = els.map((el) => {
      const old = items.find((it) => it.el === el);
      if (old) return old;
      el.setAttribute("data-mul-shadow", "");
      const sh = document.createElement("div");
      sh.className = "mul-shadow";
      layer.appendChild(sh);
      return { el, sh, k: "" };
    });
  }

  // 조상까지 곱한 투명도 (메뉴·Next 목록이 서서히 나타나고 사라짐)
  function alpha(el) {
    let a = 1;
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      if (n.hidden) return 0;
      const cs = getComputedStyle(n);
      if (cs.display === "none" || cs.visibility === "hidden") return 0;
      a *= +cs.opacity;
      if (a < 0.01) return 0;
    }
    return a;
  }

  function tick() {
    raf = requestAnimationFrame(tick);
    const vh = innerHeight;
    for (const it of items) {
      const { el, sh } = it;
      const r = el.getBoundingClientRect();
      const a = r.width && r.bottom > -40 && r.top < vh + 40 && !HIDE.some((c) => el.classList.contains(c)) ? alpha(el) : 0;
      const rad = el.style.borderRadius || getComputedStyle(el).borderTopLeftRadius;
      const k = a ? `${r.left.toFixed(1)}|${r.top.toFixed(1)}|${r.width.toFixed(1)}|${r.height.toFixed(1)}|${rad}|${a.toFixed(2)}` : "0";
      if (k === it.k) continue;
      it.k = k;
      if (!a) { sh.style.opacity = "0"; continue; }
      sh.style.width = `${r.width}px`;
      sh.style.height = `${r.height}px`;
      sh.style.borderRadius = rad;
      sh.style.transform = `translate3d(${r.left}px, ${r.top}px, 0)`;
      sh.style.opacity = a.toFixed(2);
    }
  }

  function sync() {
    const on = document.body.classList.contains("is-detail");
    if (on) {
      collect();
      layer.hidden = false;
      if (!raf) raf = requestAnimationFrame(tick);
    } else {
      layer.hidden = true;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }
  }
  // 상세 페이지가 열리고 닫힐 때 (body 클래스) · 내용이 바뀔 때 (다른 프로젝트로 이동) 다시 모음
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  const detail = document.getElementById("detail");
  if (detail) new MutationObserver(() => document.body.classList.contains("is-detail") && collect())
    .observe(detail, { childList: true });
  sync();
})();
