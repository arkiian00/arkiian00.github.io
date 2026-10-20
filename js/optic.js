/* 호버 광학 유리 (Optical Thick Glass) — 네비게이션 바 · 목록 패널 (프로젝트 카드는 제외)
 *
 *  마우스를 올리면 두꺼운 반투명 아크릴 덩어리처럼 실체화되고, 빛이 굴절되어 맺힘. 각 컴포넌트에 빛 레이어를 넣고 CSS 가 그림(.optic*):
 *   0. Body             : 다단 inset 그림자로 만든 베벨 엣지 · 유리 속 깊이 (호버 동안 backdrop-blur)
 *   1. Ambient Bloom    : 캡슐 뒤에서 숨 쉬듯 퍼지는 넓은 소프트옐로우(#FFF5B5) 광원
 *   2. Liquid Shimmer   : 속도·방향이 다른 톤온톤 그라디언트 3장이 겹쳐 액체처럼 일렁이며 스침 (screen)
 *   3. Specular Hot-spot: 테두리 1px 링(mask-composite) 안에서 순백 하이라이트 코어가 천천히 미끄러짐
 *   4. Internal Bleed   : 외곽의 빛이 유리 안쪽 벽으로 번져 드는 소프트옐로우 (plus-lighter)
 *  호버 세기 --optic-h(0→1): 바는 js/glass.js 의 '도잉' 떠오름 스프링이, 목록 패널은 CSS :hover 가 정함.
 *  평소엔 레이어가 투명하고 애니메이션도 멈춰 있음(비용 없음). 움직임은 transform/opacity 비대칭 키프레임만.
 *  상세 페이지의 바·목록은 페이지마다 새로 들어오므로 #detail 변화를 지켜보며 붙임.
 */
(() => {
  // 목록의 프로젝트 카드(.pcard · .next__card)는 빼고 — 카드는 호버 때 물리적 유리(굴절)와 '도잉' 떠오름만 (js/glass.js)
  const SEL = "#nav, #barTop, #barBottom, #pbar, #pabout, #phome, #plist, #dproj, #dabout, #dhome, #gnbBar, #dback, #nextList";
  const MARKUP =
    '<span class="optic__bloom"></span>' +
    '<span class="optic__body"></span>' +
    '<span class="optic__clip">' +
      '<span class="optic__sh optic__sh--1"></span>' +
      '<span class="optic__sh optic__sh--2"></span>' +
      '<span class="optic__sh optic__sh--3"></span>' +
      '<span class="optic__bleed"></span>' +
    "</span>" +
    '<span class="optic__rim"><span class="optic__spec"></span><span class="optic__spec optic__spec--b"></span></span>';

  function attach(root = document) {
    for (const el of root.querySelectorAll(SEL)) {
      if (el.querySelector(":scope > .optic")) continue;
      const o = document.createElement("span");
      o.className = "optic";
      o.setAttribute("aria-hidden", "true");
      o.innerHTML = MARKUP;
      el.classList.add("optic-host");
      if (el.id === "plist" || el.id === "nextList") el.classList.add("optic-host--panel");
      el.insertBefore(o, el.firstChild);
    }
  }
  attach();
  const detail = document.getElementById("detail");
  if (detail) new MutationObserver(() => attach(detail)).observe(detail, { childList: true, subtree: true });
})();
