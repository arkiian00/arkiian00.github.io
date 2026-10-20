/**
 * WebGL background
 *  Pass 1 (scene): Figma 배경 이미지 + shadergradient 스타일 noise 흐름
 *                  + 마우스 근처 물결/소용돌이 + 별 글로우 확대·일렁임
 *  Pass 2 (glass): [data-glass] 요소 영역에 liquid-glass 굴절·블러·림 하이라이트
 */
(function () {
  const canvas = document.getElementById("bg");
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, premultipliedAlpha: false });
  if (!gl) {
    document.body.classList.add("no-gl");
    return;
  }

  const MAX_GLASS = 8;

  const VERT = `#version 300 es
  in vec2 aPos;
  void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

  // classic 3D perlin noise (shadergradient 와 동일한 glsl-noise 구현)
  const NOISE = `
  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  vec3 fade(vec3 t){return t*t*t*(t*(t*6.0-15.0)+10.0);}
  float cnoise(vec3 P){
    vec3 Pi0=floor(P),Pi1=Pi0+vec3(1.0);Pi0=mod289(Pi0);Pi1=mod289(Pi1);
    vec3 Pf0=fract(P),Pf1=Pf0-vec3(1.0);
    vec4 ix=vec4(Pi0.x,Pi1.x,Pi0.x,Pi1.x),iy=vec4(Pi0.yy,Pi1.yy);
    vec4 iz0=Pi0.zzzz,iz1=Pi1.zzzz;
    vec4 ixy=permute(permute(ix)+iy),ixy0=permute(ixy+iz0),ixy1=permute(ixy+iz1);
    vec4 gx0=ixy0*(1.0/7.0),gy0=fract(floor(gx0)*(1.0/7.0))-0.5;gx0=fract(gx0);
    vec4 gz0=vec4(0.5)-abs(gx0)-abs(gy0),sz0=step(gz0,vec4(0.0));
    gx0-=sz0*(step(0.0,gx0)-0.5);gy0-=sz0*(step(0.0,gy0)-0.5);
    vec4 gx1=ixy1*(1.0/7.0),gy1=fract(floor(gx1)*(1.0/7.0))-0.5;gx1=fract(gx1);
    vec4 gz1=vec4(0.5)-abs(gx1)-abs(gy1),sz1=step(gz1,vec4(0.0));
    gx1-=sz1*(step(0.0,gx1)-0.5);gy1-=sz1*(step(0.0,gy1)-0.5);
    vec3 g000=vec3(gx0.x,gy0.x,gz0.x),g100=vec3(gx0.y,gy0.y,gz0.y),g010=vec3(gx0.z,gy0.z,gz0.z),g110=vec3(gx0.w,gy0.w,gz0.w);
    vec3 g001=vec3(gx1.x,gy1.x,gz1.x),g101=vec3(gx1.y,gy1.y,gz1.y),g011=vec3(gx1.z,gy1.z,gz1.z),g111=vec3(gx1.w,gy1.w,gz1.w);
    vec4 n0=taylorInvSqrt(vec4(dot(g000,g000),dot(g010,g010),dot(g100,g100),dot(g110,g110)));
    g000*=n0.x;g010*=n0.y;g100*=n0.z;g110*=n0.w;
    vec4 n1=taylorInvSqrt(vec4(dot(g001,g001),dot(g011,g011),dot(g101,g101),dot(g111,g111)));
    g001*=n1.x;g011*=n1.y;g101*=n1.z;g111*=n1.w;
    float n000=dot(g000,Pf0),n100=dot(g100,vec3(Pf1.x,Pf0.yz)),n010=dot(g010,vec3(Pf0.x,Pf1.y,Pf0.z)),n110=dot(g110,vec3(Pf1.xy,Pf0.z));
    float n001=dot(g001,vec3(Pf0.xy,Pf1.z)),n101=dot(g101,vec3(Pf1.x,Pf0.y,Pf1.z)),n011=dot(g011,vec3(Pf0.x,Pf1.yz)),n111=dot(g111,Pf1);
    vec3 f=fade(Pf0);
    vec4 nz=mix(vec4(n000,n100,n010,n110),vec4(n001,n101,n011,n111),f.z);
    vec2 nyz=mix(nz.xy,nz.zw,f.y);
    return 2.2*mix(nyz.x,nyz.y,f.x);
  }`;

  const SCENE_FRAG = `#version 300 es
  precision highp float;
  uniform sampler2D uImage;
  uniform vec2 uRes;        // device px
  uniform vec2 uImgRes;
  uniform float uTime;
  uniform vec2 uMouse;      // device px, top-left origin (smoothed)
  uniform float uEnergy;    // 마우스 속도 (0..1)
  uniform float uPresence;  // 마우스가 화면 안에 있는지 (0..1)
  out vec4 outColor;
  ${NOISE}

  vec2 coverUV(vec2 p) {
    vec2 uv = p / uRes;
    float sa = uRes.x / uRes.y, ia = uImgRes.x / uImgRes.y;
    if (sa > ia) uv.y = (uv.y - 0.5) * ia / sa + 0.5;
    else         uv.x = (uv.x - 0.5) * sa / ia + 0.5;
    return uv;
  }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

  void main() {
    vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
    vec2 uv = coverUV(p);
    vec2 m = coverUV(uMouse);
    vec2 k = vec2(uImgRes.x / uImgRes.y, 1.0);
    vec2 star = vec2(0.5, 0.53);
    float t = uTime;

    // 1) shadergradient 스타일 느린 노이즈 흐름
    vec2 flow = vec2(cnoise(vec3(uv * 1.6, t * 0.07)),
                     cnoise(vec3(uv * 1.6 + 7.3, t * 0.07 + 3.1)));
    uv += flow * 0.012;

    // 2) 마우스 주변 물결 + 소용돌이
    vec2 dm = (uv - m) * k;
    float dist = length(dm);
    float field = exp(-dist * dist / 0.045) * uPresence;
    float ripple = sin(dist * 34.0 - t * 2.6) * field * (0.003 + 0.010 * uEnergy);
    uv += (dm / max(dist, 1e-4)) / k * ripple;
    uv = m + rot(field * (0.06 + 0.22 * uEnergy)) * (uv - m);

    // 3) 별 글로우: 마우스가 가까울수록 / 움직일수록 커지고 일렁임
    float prox = exp(-pow(length((m - star) * k), 2.0) / 0.09) * uPresence;
    float grow = clamp(prox * 0.85 + uEnergy * 0.45 + 0.05 + 0.05 * sin(t * 0.8), 0.0, 1.3);
    vec2 sd = (uv - star) * k;
    float r = length(sd);
    float a = atan(sd.y, sd.x);
    float wob = cnoise(vec3(cos(a) * 1.4, sin(a) * 1.4, t * 0.55 - r * 2.5));
    float scale = 1.0 + grow * 0.24 + wob * (0.035 + 0.09 * grow);
    float w = exp(-r * r / 0.16);
    uv = mix(uv, star + (uv - star) / scale, w);
    // 별이 마우스 쪽으로 살짝 기울어짐
    uv -= (m - star) * prox * 0.04 * w;

    vec3 col = texture(uImage, uv).rgb;

    // bloom (밝은 영역 추출, mip 블러)
    vec3 b = textureLod(uImage, uv, 4.0).rgb;
    vec3 bright = max(b - 0.80, 0.0);
    col += bright * (0.15 + 1.6 * grow) * w;
    col += vec3(1.0, 0.99, 0.92) * exp(-r * r / (0.003 + 0.012 * grow)) * 0.22 * grow;

    // 마우스 라이트
    col += vec3(1.0, 0.97, 0.88) * field * (0.05 + 0.10 * uEnergy);

    // film grain
    col += (hash(p + fract(t * 7.0) * 113.0) - 0.5) * 0.035;

    outColor = vec4(col, 1.0);
  }`;

  const GLASS_FRAG = `#version 300 es
  precision highp float;
  uniform sampler2D uScene;
  uniform vec2 uRes;
  uniform float uDpr;
  uniform int uCount;
  uniform vec4 uRects[${MAX_GLASS}];   // x, y, w, h (device px, top-left)
  uniform vec2 uShape[${MAX_GLASS}];   // radius (device px), alpha
  out vec4 outColor;

  float sdRBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
  vec3 sampleBlur(vec2 px, float lod, float spread) {
    vec2 inv = 1.0 / uRes;
    vec2 uv = vec2(px.x, uRes.y - px.y) * inv;
    vec3 c = textureLod(uScene, uv, lod).rgb * 0.36;
    c += textureLod(uScene, uv + vec2( spread,  spread) * inv, lod).rgb * 0.16;
    c += textureLod(uScene, uv + vec2(-spread,  spread) * inv, lod).rgb * 0.16;
    c += textureLod(uScene, uv + vec2( spread, -spread) * inv, lod).rgb * 0.16;
    c += textureLod(uScene, uv + vec2(-spread, -spread) * inv, lod).rgb * 0.16;
    return c;
  }

  void main() {
    vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
    vec3 col = texture(uScene, gl_FragCoord.xy / uRes).rgb;

    for (int i = 0; i < ${MAX_GLASS}; i++) {
      if (i >= uCount) break;
      vec4 R = uRects[i];
      vec2 half_ = R.zw * 0.5;
      vec2 c = R.xy + half_;
      float rad = min(uShape[i].x, min(half_.x, half_.y));
      vec2 q = p - c;
      float d = sdRBox(q, half_, rad);
      if (d > 1.5) continue;

      float e = 1.0;
      vec2 n = normalize(vec2(
        sdRBox(q + vec2(e, 0.0), half_, rad) - sdRBox(q - vec2(e, 0.0), half_, rad),
        sdRBox(q + vec2(0.0, e), half_, rad) - sdRBox(q - vec2(0.0, e), half_, rad)) + 1e-6);

      float minHalf = min(half_.x, half_.y);
      float inside = max(-d, 0.0);
      float edge = clamp(1.0 - inside / (minHalf * 0.95), 0.0, 1.0);
      float bend = edge * edge * edge;
      vec2 offs = -n * bend * minHalf * 0.6;

      // Figma Glass radius 30 → blur
      float blurPx = clamp(minHalf * 0.6, 3.0 * uDpr, 15.0 * uDpr);
      float lod = log2(blurPx * 0.5);
      vec3 g;
      g.r = sampleBlur(p + offs * 1.08, lod, blurPx * 0.5).r;
      g.g = sampleBlur(p + offs,        lod, blurPx * 0.5).g;
      g.b = sampleBlur(p + offs * 0.92, lod, blurPx * 0.5).b;

      // rim / specular (좌상단 광원)
      float rim = smoothstep(2.5 * uDpr, 0.0, inside);
      float light = dot(n, normalize(vec2(-0.6, -0.8)));
      g += rim * (0.10 + 0.45 * max(light, 0.0));
      g -= rim * 0.06 * max(-light, 0.0);

      float alpha = (1.0 - smoothstep(-0.75, 0.75, d)) * uShape[i].y;
      col = mix(col, g, alpha);
    }
    outColor = vec4(col, 1.0);
  }`;

  // ---------- GL helpers ----------
  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, "aPos");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, "");
      u[name] = gl.getUniformLocation(p, name);
    }
    return { p, u };
  }

  let scene, glass;
  try {
    scene = program(SCENE_FRAG);
    glass = program(GLASS_FRAG);
  } catch (err) {
    console.error(err);
    document.body.classList.add("no-gl");
    return;
  }

  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  function mipTexture() {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  const imgTex = mipTexture();
  const imgSize = [1200, 800];
  let imgReady = false;
  const img = new Image();
  img.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, imgTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    imgSize[0] = img.naturalWidth;
    imgSize[1] = img.naturalHeight;
    imgReady = true;
  };
  img.src = "assets/bg.jpg";

  const sceneTex = mipTexture();
  const fbo = gl.createFramebuffer();

  // ---------- size ----------
  let W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.round(innerWidth * dpr);
    H = Math.round(innerHeight * dpr);
    canvas.width = W;
    canvas.height = H;
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sceneTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  addEventListener("resize", resize);
  resize();

  // ---------- pointer ----------
  const raw = { x: innerWidth / 2, y: innerHeight / 2 };
  const smooth = { x: raw.x, y: raw.y };
  const prev = { x: raw.x, y: raw.y };
  let inside = false, energy = 0, presence = 0;
  addEventListener("pointermove", (e) => {
    raw.x = e.clientX;
    raw.y = e.clientY;
    inside = true;
  }, { passive: true });
  document.addEventListener("pointerleave", () => { inside = false; });
  addEventListener("blur", () => { inside = false; });

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- glass elements ----------
  const rects = new Float32Array(MAX_GLASS * 4);
  const shapes = new Float32Array(MAX_GLASS * 2);
  function collectGlass() {
    const els = document.querySelectorAll("[data-glass]");
    let n = 0;
    for (const el of els) {
      if (n >= MAX_GLASS) break;
      let alpha = 1;
      for (let node = el; node && node !== document.body; node = node.parentElement) {
        alpha *= parseFloat(getComputedStyle(node).opacity);
      }
      if (alpha < 0.01) continue;
      if (getComputedStyle(el).visibility === "hidden") continue;   // 숨겨 둔 요소는 유리도 그리지 않음
      // 액체 레이어가 몸체를 대신 그리는 동안(분리·회전·물방울)은 유리 틀을 그리지 않음
      if (el.classList.contains("is-liquid") || el.classList.contains("is-splitting")) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.bottom < 0 || r.top > innerHeight) continue;
      rects.set([r.left * dpr, r.top * dpr, r.width * dpr, r.height * dpr], n * 4);
      const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      const sx = el.offsetWidth ? r.width / el.offsetWidth : 1; // transform scale 반영
      shapes.set([radius * sx * dpr, alpha], n * 2);
      n++;
    }
    return n;
  }


  // ---------- loop ----------
  const start = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (!imgReady) return;
    if (document.body.classList.contains("is-detail")) return;   // 상세 페이지가 배경을 덮는 동안 렌더 중지

    const t = ((now - start) / 1000) * (reduceMotion ? 0.3 : 1);

    const vel = Math.hypot(raw.x - prev.x, raw.y - prev.y);
    prev.x = raw.x;
    prev.y = raw.y;
    const target = Math.min(vel / 35, 1);
    energy += (target - energy) * (target > energy ? 0.12 : 0.025);
    presence += ((inside ? 1 : 0) - presence) * 0.04;
    smooth.x += (raw.x - smooth.x) * 0.07;
    smooth.y += (raw.y - smooth.y) * 0.07;

    // pass 1: scene → fbo
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, W, H);
    gl.useProgram(scene.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, imgTex);
    gl.uniform1i(scene.u.uImage, 0);
    gl.uniform2f(scene.u.uRes, W, H);
    gl.uniform2f(scene.u.uImgRes, imgSize[0], imgSize[1]);
    gl.uniform1f(scene.u.uTime, t);
    gl.uniform2f(scene.u.uMouse, smooth.x * dpr, smooth.y * dpr);
    gl.uniform1f(scene.u.uEnergy, energy);
    gl.uniform1f(scene.u.uPresence, presence);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.generateMipmap(gl.TEXTURE_2D);

    // pass 2: glass composite → screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(glass.p);
    gl.uniform1i(glass.u.uScene, 0);
    gl.uniform2f(glass.u.uRes, W, H);
    gl.uniform1f(glass.u.uDpr, dpr);
    gl.uniform1i(glass.u.uCount, collectGlass());
    gl.uniform4fv(glass.u.uRects, rects);
    gl.uniform2fv(glass.u.uShape, shapes);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  requestAnimationFrame(frame);
})();
