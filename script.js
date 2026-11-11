/* Will you be my Valentine? — 3D rose (Three.js) + animation (GSAP).
   Wording, names and the number of dodges live in CONFIG just below. */

(() => {
  /* =====================================================================
     EDIT ME — names and wording
     ===================================================================== */
  const CONFIG = {
    to: '',                    // their name, e.g. 'Sarah'  (empty = "For you")
    from: '',                  // your name, shown after they say yes
    line: 'Will you be my',
    script: 'Valentine?',
    yesLine: 'You said',
    yesScript: 'Yes!',
    yesNote: 'Best answer I could have hoped for. It’s a date.',
    dodges: 4,                         // how many times the No button runs away
    softNo: 'Not this time',           // what the No button says once it holds still
    settleLine: 'Alright, it will hold still now.',
    noLine: 'That’s',
    noScript: 'okay.',
    noNote: 'Thank you for being honest. I’m glad I asked.',
    wa: '',                            // sender's WhatsApp number, digits with country code
    yesMessage: 'I said yes! 🌹',
    noMessage: 'Thank you for the rose 🌹 I’m sorry — not this time.',
    noLines: [
      'Are you sure?',
      'Really, really sure?',
      'Look — the rose is wilting…',
      'Think about it a little longer.',
      'I’ll bring chocolate.',
      'That button seems shy, doesn’t it?',
      'Pretty please?',
      'The other one is much easier to press.',
    ],
  };

  const $ = (s) => document.querySelector(s);

  /* ---------- personal links ----------
     Names travel in the link itself, after the # (…/#v=…), lightly encoded so
     the address doesn't spoil the surprise. Browsers never send the part after
     # to the server, so the names and number stay between the two devices.
     Plain #to=Sarah&from=James works too, and older ?v=… links are still read. */
  const encodeCard = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const pageUrl = () => location.href.split(/[?#]/)[0];
  function readCard() {
    const h = new URLSearchParams(location.hash.slice(1)), q = new URLSearchParams(location.search);
    const get = (k) => h.get(k) || q.get(k) || '';
    const v = get('v');
    if (v) {
      try { return JSON.parse(decodeURIComponent(escape(atob(v.replace(/-/g, '+').replace(/_/g, '/'))))); } catch (e) {}
    }
    if (get('to') || get('from')) return { t: get('to'), f: get('from'), w: get('wa') };
    return null;
  }
  /* changing only the # part doesn't reload a page, so do it ourselves */
  addEventListener('hashchange', () => location.reload());
  const goTo = (link, url) => link.addEventListener('click', (e) => {
    e.preventDefault();
    if (url) history.replaceState(null, '', url);
    location.reload();
  });
  const card = readCard();
  const MAKER = !card;                         // no names in the link → show the creator
  if (card) {
    CONFIG.to = String(card.t || '').slice(0, 30);
    CONFIG.from = String(card.f || '').slice(0, 30);
    CONFIG.wa = String(card.w || '').replace(/\D/g, '').slice(0, 15);
  }
  const rand = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); };
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- copy ---------- */
  const elLine = $('.title .line'), elScript = $('.title .script');
  function setLine(text) {
    elLine.innerHTML = text.split(' ').map(w =>
      `<span class="word">${[...w].map(c => `<span class="ch">${c}</span>`).join('')}</span>`
    ).join(' ');
  }
  setLine(CONFIG.line);
  elScript.textContent = CONFIG.script;
  $('.eyebrow').textContent = `For ${CONFIG.to || 'you'} · February 14`;

  /* =====================================================================
     3D SCENE
     ===================================================================== */
  const canvas = $('#scene');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) { renderer = null; }

  const state = { droop: 0, camDz: 0, spin: calm ? 0 : 0.12, rain: 1, px: 0, py: 0 };
  const petals = [];           // rose petals
  const fall = [];             // ambient falling petals
  const burst = [];            // celebration petals
  let shed = false, regrowing = false, bloomLevel = 1;
  let scene, camera, rig, sway, head, dust, baseZ = 8, visH = 5, visW = 8;
  const TILT = 0.52;           // lean the bloom toward the viewer

  /* A single petal: a strip that is cupped around the flower's axis,
     bellied outward along its length and curled back at the tip. */
  function petalGeometry(o) {
    const { L, W, Rc, curl = 0, belly = 0, seed = 0, shade = 1, pal } = o;
    const segU = o.segU || 14, segV = o.segV || 18;
    const pos = [], col = [], idx = [];
    const c = new THREE.Color();
    for (let j = 0; j <= segV; j++) {
      const v = j / segV;
      const w = Math.pow(Math.sin(Math.PI * Math.pow(v, 1.6)), 0.6);   // widest ~2/3 up, rounded tip
      for (let i = 0; i <= segU; i++) {
        const u = (i / segU) * 2 - 1;
        const a = (u * w * W * 0.5) / Rc;
        let x = Rc * Math.sin(a);
        let z = -Rc * (1 - Math.cos(a));
        let y = v * L;
        const s = smooth(0.45, 1, v);
        z += curl * L * s * s;
        y -= curl * L * 0.35 * s * s;
        z += belly * L * Math.sin(Math.PI * v) * (1 - 0.5 * u * u);
        z += 0.03 * L * Math.sin(u * 4.5 + seed) * v * v;              // soft ruffle on the rim
        pos.push(x, y, z);

        c.copy(pal.base).lerp(pal.mid, smooth(0, 0.55, v))
         .lerp(pal.edge, Math.min(1, smooth(0.5, 1, v) * 0.75 + Math.pow(Math.abs(u), 3) * 0.35 * v));
        c.multiplyScalar(shade).convertSRGBToLinear();
        col.push(c.r, c.g, c.b);
      }
    }
    for (let j = 0; j < segV; j++) for (let i = 0; i < segU; i++) {
      const a = j * (segU + 1) + i, b = a + 1, d = a + segU + 1, e = d + 1;
      idx.push(a, b, e, a, e, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  const RED = { base: new THREE.Color('#1c0006'), mid: new THREE.Color('#7a0318'), edge: new THREE.Color('#c70f35') };
  const GREEN = { base: new THREE.Color('#12300f'), mid: new THREE.Color('#2c6426'), edge: new THREE.Color('#58933c') };

  function build() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);

    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    /* lights */
    scene.add(new THREE.HemisphereLight(0xfff4ea, 0x7a3a48, 0.5));
    const key = new THREE.DirectionalLight(0xfff1e4, 1.35); key.position.set(3, 6, 5); scene.add(key);
    const rim = new THREE.DirectionalLight(0xff3d6e, 1.3); rim.position.set(-5, 2, -4); scene.add(rim);
    const fill = new THREE.PointLight(0xff8a5c, 0.7, 20); fill.position.set(-2.5, -1.5, 4); scene.add(fill);

    rig = new THREE.Group(); sway = new THREE.Group(); head = new THREE.Group();
    scene.add(rig); rig.add(sway); sway.add(head);
    rig.rotation.x = TILT;

    const petalMat = new THREE.MeshStandardMaterial({
      vertexColors: true, side: THREE.DoubleSide, roughness: 0.58, metalness: 0.02,
      emissive: 0x2a0006, emissiveIntensity: 0.3,
    });
    const leafMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.7 });

    /* ---- bloom: petals on a golden-angle spiral, tight in the heart, open at the rim ---- */
    const N = 38;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const geo = petalGeometry({
        L: lerp(0.82, 1.3, Math.pow(t, 0.75)),
        W: lerp(0.5, 1.62, Math.pow(t, 0.9)),
        Rc: lerp(0.11, 0.95, Math.pow(t, 1.25)),
        curl: lerp(0.0, 0.3, Math.pow(t, 1.4)),
        belly: lerp(0.02, 0.13, t),
        seed: i * 1.7,
        shade: lerp(0.62, 1.08, t),
        pal: RED,
      });
      const pivot = new THREE.Group();
      pivot.rotation.y = i * 2.39996;
      const m = new THREE.Mesh(geo, petalMat);
      m.position.set(0, lerp(0.14, -0.04, t), lerp(0.085, 0.2, t));
      const open = lerp(0.03, 0.96, Math.pow(t, 1.55));
      m.userData = { t, open, closed: open * 0.12 };
      m.rotation.x = m.userData.closed;
      pivot.add(m); head.add(pivot); petals.push(m);
    }

    /* ---- sepals + calyx ---- */
    const sepalGeo = petalGeometry({ L: 0.62, W: 0.3, Rc: 0.5, curl: 0.25, belly: 0.05, pal: GREEN });
    for (let i = 0; i < 5; i++) {
      const pivot = new THREE.Group(); pivot.rotation.y = i * (Math.PI * 2 / 5) + 0.3;
      const m = new THREE.Mesh(sepalGeo, leafMat);
      m.position.set(0, -0.06, 0.16); m.rotation.x = 1.75;
      pivot.add(m); head.add(pivot);
    }
    const calyx = new THREE.Mesh(new THREE.SphereGeometry(0.25, 20, 14),
      new THREE.MeshStandardMaterial({ color: 0x24531f, roughness: 0.75 }));
    calyx.scale.set(1, 0.75, 1); calyx.position.y = -0.1; head.add(calyx);

    /* ---- stem + leaves ---- */
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.1, 0), new THREE.Vector3(0.1, -1.6, 0.05),
      new THREE.Vector3(-0.08, -3.6, 0), new THREE.Vector3(0.12, -6, 0.1), new THREE.Vector3(-0.1, -11, 0), new THREE.Vector3(0, -22, 0),
    ]);
    const stem = new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.075, 10),
      new THREE.MeshStandardMaterial({ color: 0x2a5a24, roughness: 0.7 }));
    sway.add(stem);
    const leafGeo = petalGeometry({ L: 1.25, W: 0.68, Rc: 1.6, curl: 0.12, belly: 0.04, pal: GREEN });
    [[0.08, -2.1, 1.15, 0.4], [-0.06, -3.3, -1.2, 2.6]].forEach(([x, y, rz, ry]) => {
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(x, y, 0); leaf.rotation.set(0.5, ry, rz);
      sway.add(leaf);
    });

    /* ---- loose petals: ambient fall + celebration burst ---- */
    const looseGeo = petalGeometry({ L: 0.34, W: 0.32, Rc: 0.28, curl: 0.22, belly: 0.08, pal: RED, segU: 6, segV: 8 });
    for (let i = 0; i < 44; i++) {
      const m = new THREE.Mesh(looseGeo, petalMat);
      m.userData = { vy: rand(0.25, 0.7), f: rand(0.3, 0.9), ph: rand(0, 6.28), rx: rand(-1, 1), rz: rand(-1, 1), amp: rand(0.2, 0.7) };
      m.scale.setScalar(rand(0.6, 1.5));
      scene.add(m); fall.push(m);
    }
    for (let i = 0; i < 90; i++) {
      const m = new THREE.Mesh(looseGeo, petalMat);
      m.visible = false; scene.add(m); burst.push(m);
    }

    /* ---- drifting light motes ---- */
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const cx = cv.getContext('2d'); const gr = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = gr; cx.fillRect(0, 0, 64, 64);
    const sprite = new THREE.CanvasTexture(cv);
    dust = new THREE.Group(); scene.add(dust);
    [[220, 0.07, 0.55], [60, 0.17, 0.22]].forEach(([count, size, opacity]) => {
      const p = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) { p[i * 3] = rand(-11, 11); p[i * 3 + 1] = rand(-7, 7); p[i * 3 + 2] = rand(-9, 0); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      dust.add(new THREE.Points(g, new THREE.PointsMaterial({
        map: sprite, size, transparent: true, opacity, depthWrite: false,
        color: 0xd9a05f,
      })));
    });

    resize();
    fall.forEach(m => resetFall(m, true));
    addEventListener('resize', resize);
    gsap.ticker.add(tick);
  }

  function resetFall(m, anywhere) {
    const z = rand(-7, 1.5);
    const k = (baseZ - z) / baseZ;                       // widen the range for far petals
    m.position.set(rand(-visW, visW) * 0.62 * k, anywhere ? rand(-visH, visH) * 0.6 * k : visH * 0.62 * k, z);
    m.rotation.set(rand(0, 6.28), rand(0, 6.28), rand(0, 6.28));
    m.userData.floor = -visH * 0.62 * k;
  }

  function resize() {
    const w = innerWidth, h = innerHeight, aspect = w / h;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = aspect;
    baseZ = 8.2 * Math.max(1, 0.78 / aspect);            // pull back on portrait screens
    camera.updateProjectionMatrix();
    visH = 2 * baseZ * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    visW = visH * aspect;
    rig.position.y = visH * 0.15;                        // bloom sits in the upper part of the frame
  }

  let last = 0;
  function tick(time) {
    const dt = Math.min(0.05, time - last); last = time;
    camera.position.z = baseZ + state.camDz;
    head.rotation.y += state.spin * dt;
    sway.rotation.z = Math.sin(time * 0.6) * 0.022 + state.droop;
    sway.rotation.x = Math.sin(time * 0.45 + 1) * 0.018;
    rig.rotation.y += (state.px * 0.3 - rig.rotation.y) * 0.05;
    rig.rotation.x += (TILT + state.py * 0.14 - rig.rotation.x) * 0.05;

    for (const m of fall) {
      const d = m.userData;
      m.position.y -= d.vy * dt * state.rain;
      m.position.x += Math.sin(time * d.f + d.ph) * d.amp * dt;
      m.rotation.x += d.rx * dt; m.rotation.z += d.rz * dt;
      if (m.position.y < d.floor) resetFall(m, false);
    }
    dust.position.y = (time * 0.05) % 2;
    dust.rotation.y = Math.sin(time * 0.05) * 0.12;
    renderer.render(scene, camera);
  }

  function bloomTo(level, duration, ease, stagger) {
    bloomLevel = level;
    petals.forEach(m => {
      const d = m.userData;
      gsap.to(m.rotation, {
        x: lerp(d.closed, d.open, level) + (level > 1 ? 0.06 : 0),
        duration, ease, delay: stagger ? d.t * stagger : 0, overwrite: true,
      });
    });
  }

  if (renderer) build();

  /* ---------- tap the rose: its own petals let go, outer ones first.
     When it is nearly bare it grows a fresh bloom. ---------- */
  const PER_TAP = 3, KEEP = 5;                  // petals lost per tap; regrow when this few remain
  const targetTilt = (d) => lerp(d.closed, d.open, bloomLevel) + (bloomLevel > 1 ? 0.06 : 0);

  function dropPetals() {
    const left = petals.filter(m => m.visible);
    left.slice(-PER_TAP).reverse().forEach((m, k) => {
      /* a stand-in takes the petal's exact pose and falls; the real one waits, hidden, to regrow */
      m.updateWorldMatrix(true, false);
      const f = new THREE.Mesh(m.geometry, m.material);
      m.matrixWorld.decompose(f.position, f.quaternion, f.scale);
      scene.add(f);
      m.visible = false;
      const d = rand(2.8, 4.4);
      gsap.timeline({ delay: k * 0.09, onComplete: () => scene.remove(f) })
        .to(f.position, { x: '+=' + rand(-0.5, 0.5), z: '+=' + rand(0.1, 0.6), duration: 0.5, ease: 'power2.out' })
        .to(f.position, { y: -(visH * 0.62 + 2.5), duration: d, ease: 'power1.in' }, 0.15)
        .to(f.position, { x: '+=' + rand(-1.5, 1.5), duration: d, ease: 'sine.inOut' }, 0.5)
        .to(f.rotation, { x: '+=' + rand(-4, 4), y: '+=' + rand(-3, 3), z: '+=' + rand(-4, 4), duration: d + 0.15, ease: 'power1.in' }, 0);
    });
    gsap.fromTo(head.scale, { x: 1.06, y: 1.06, z: 1.06 }, { x: 1, y: 1, z: 1, duration: 0.8, ease: 'elastic.out(1, 0.4)', overwrite: true });
    if (left.length - PER_TAP <= KEEP) { regrowing = true; gsap.delayedCall(1.1, regrow); }
  }

  function regrow(quick) {
    const gone = petals.filter(m => !m.visible);
    gone.forEach(m => {
      const d = m.userData, delay = quick ? 0 : d.t * 1.1;
      m.visible = true;
      gsap.fromTo(m.scale, { x: 0.01, y: 0.01, z: 0.01 }, { x: 1, y: 1, z: 1, duration: quick ? 0.8 : 1.5, ease: 'back.out(1.3)', delay, overwrite: true });
      if (!quick) gsap.fromTo(m.rotation, { x: d.closed }, { x: targetTilt(d), duration: 1.9, ease: 'power2.out', delay, overwrite: true });
    });
    gsap.delayedCall(quick ? 0.8 : 2.4, () => { regrowing = false; });
  }

  if (renderer) {
    const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
    addEventListener('pointerdown', (e) => {
      if (shed || regrowing || e.target.closest('button, a, input, label')) return;
      ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      ray.setFromCamera(ptr, camera);
      if (ray.intersectObjects(petals.filter(m => m.visible), false).length) dropPetals();
    });
  }

  addEventListener('pointermove', (e) => {
    state.px = (e.clientX / innerWidth) * 2 - 1;
    state.py = (e.clientY / innerHeight) * 2 - 1;
    if (e.pointerType === 'mouse') nearNo(e.clientX, e.clientY);
  });

  /* =====================================================================
     INTRO
     ===================================================================== */
  const ui = $('.ui'), yes = $('#yes'), no = $('#no'), plea = $('.plea'), note = $('.note');
  const maker = $('.maker');
  if (MAKER) { ui.style.display = 'none'; maker.hidden = false; gsap.set(maker, { autoAlpha: 0, y: 24 }); }
  gsap.set(ui, { visibility: 'visible' });
  gsap.set(['.eyebrow', '#yes', '#no'], { autoAlpha: 0, y: 18 });
  gsap.set('.title .ch', { autoAlpha: 0, yPercent: 60, filter: 'blur(8px)' });
  gsap.set(elScript, { clipPath: 'inset(-20% 100% -20% -5%)' });
  gsap.set('.glow', { scale: 0.5, opacity: 0 });

  const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
  intro.from('#scene', { opacity: 0, duration: 1.6, ease: 'power1.out' }, 0)
       .to('.glow', { scale: 1, opacity: 1, duration: 3, ease: 'power2.out' }, 0.2);
  if (renderer) {
    intro.from(state, { camDz: 4.5, duration: 4, ease: 'power2.out' }, 0)
         .from(rig.scale, { x: 0.55, y: 0.55, z: 0.55, duration: 3.6, ease: 'power2.out' }, 0)
         .from(head.rotation, { y: -2.6, duration: 4.2, ease: 'power2.out' }, 0)
         .add(() => bloomTo(1, 2.8, 'power2.out', 1.3), 0.5);
  }
  intro.to('.eyebrow', { autoAlpha: 1, y: 0, duration: 1.2 }, 2.1)
       .to('.title .ch', { autoAlpha: 1, yPercent: 0, filter: 'blur(0px)', duration: 1.1, stagger: 0.045 }, 2.3)
       .to(elScript, { clipPath: 'inset(-20% -5% -20% -5%)', duration: 1.7, ease: 'power2.inOut' }, 2.9)
       .to(['#yes', '#no'], { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.12 }, 4.1);
  if (MAKER) intro.to(maker, { autoAlpha: 1, y: 0, duration: 1.3 }, 2.2);
  gsap.to('.glow', { scale: 1.08, duration: 3.2, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 3.4 });
  if (calm) intro.progress(1);

  /* =====================================================================
     NO — the button that would rather not
     ===================================================================== */
  let answered = false, noCount = 0, lastDodge = 0, noReady = false;

  function nearNo(px, py) {
    if (MAKER || answered || noCount >= CONFIG.dodges || intro.time() < 4.2) return;
    const r = no.getBoundingClientRect();
    const dx = Math.max(r.left - px, 0, px - r.right), dy = Math.max(r.top - py, 0, py - r.bottom);
    if (Math.hypot(dx, dy) < 46 && performance.now() - lastDodge > 320) dodge(px, py);
  }

  function dodge(px, py) {
    if (answered || noCount >= CONFIG.dodges) return;
    lastDodge = performance.now();
    const r = no.getBoundingClientRect(), yr = yes.getBoundingClientRect();
    const baseL = r.left - gsap.getProperty(no, 'x'), baseT = r.top - gsap.getProperty(no, 'y');
    const m = 14, minDist = Math.min(240, innerWidth * 0.4);
    let tx = 0, ty = 0;
    for (let k = 0; k < 40; k++) {
      tx = rand(m, innerWidth - r.width - m);
      ty = rand(innerHeight * 0.1, innerHeight - r.height - m);
      const cx = tx + r.width / 2, cy = ty + r.height / 2;
      const far = Math.hypot(cx - px, cy - py) > minDist;
      const clearOfYes = cx < yr.left - r.width / 2 - 30 || cx > yr.right + r.width / 2 + 30 ||
                         cy < yr.top - r.height / 2 - 24 || cy > yr.bottom + r.height / 2 + 24;
      if (far && clearOfYes) break;
    }
    gsap.to(no, { x: tx - baseL, y: ty - baseT, rotation: rand(-10, 10), duration: calm ? 0.01 : 0.5, ease: 'back.out(1.5)', overwrite: true });

    /* consequences */
    noCount++;
    plea.textContent = CONFIG.noLines[(noCount - 1) % CONFIG.noLines.length];
    gsap.fromTo(plea, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out', overwrite: true });
    gsap.to(yes, { scale: Math.min(1 + noCount * 0.09, 1.75), duration: 0.6, ease: 'elastic.out(1, 0.5)' });
    gsap.to(no, { scale: Math.max(1 - noCount * 0.04, 0.72), duration: 0.4 });
    if (renderer) {
      bloomTo(Math.max(0.42, 1 - noCount * 0.09), 1.1, 'power2.out');
      gsap.to(state, { droop: -Math.min(noCount * 0.035, 0.26), duration: 1.2, ease: 'power2.out' });
      gsap.to('.glow', { opacity: Math.max(0.35, 1 - noCount * 0.1), duration: 1, overwrite: 'auto' });
    }
    if (noCount >= CONFIG.dodges) settle();
  }

  /* after the last dodge the button walks home and becomes a real, gentler answer */
  function settle() {
    gsap.delayedCall(1.2, () => {
      if (answered) return;
      no.textContent = CONFIG.softNo;
      plea.textContent = CONFIG.settleLine;
      gsap.fromTo(plea, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out', overwrite: true });
      gsap.to(yes, { scale: 1, duration: 0.7, ease: 'power2.out', overwrite: true });
      gsap.to(no, { x: 0, y: 0, rotation: 0, scale: 1, duration: 0.9, ease: 'power3.inOut', overwrite: true,
        onComplete: () => { noReady = true; } });
    });
  }

  /* One tap to tell the sender: opens WhatsApp to their number with the message
     written, or the phone's share sheet when no number was given. */
  function setupTell(kind) {
    const tell = $('.tell'), text = kind === 'yes' ? CONFIG.yesMessage : CONFIG.noMessage;
    if (CONFIG.wa) {
      tell.href = `https://wa.me/${CONFIG.wa}?text=${encodeURIComponent(text)}`;
      tell.target = '_blank'; tell.rel = 'noopener';
    } else if (navigator.share) {
      tell.href = '#';
      tell.addEventListener('click', (e) => { e.preventDefault(); navigator.share({ text }).catch(() => {}); });
    } else return;
    tell.textContent = `Tell ${CONFIG.from || 'them'}`;
    tell.className = 'btn tell ' + (kind === 'yes' ? 'yes' : 'no');
    tell.hidden = false;
    gsap.fromTo(tell, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', delay: 1.9 });
  }

  /* every petal lets go, outer ones first, and drifts down off the page */
  function shedPetals() {
    shed = true;
    petals.forEach(m => {
      gsap.delayedCall(0.4 + (1 - m.userData.t) * 2 + rand(0, 0.4), () => {
        gsap.killTweensOf(m.rotation);
        scene.attach(m);                               // leave the spinning bloom, keep the pose
        const d = rand(2.6, 4.4);
        gsap.to(m.position, { y: -(visH * 0.62 + 2.5), duration: d, ease: 'power1.in' });
        gsap.to(m.position, { x: '+=' + rand(-1.7, 1.7), z: '+=' + rand(-0.6, 1.2), duration: d, ease: 'sine.inOut' });
        gsap.to(m.rotation, { x: '+=' + rand(-4, 4), y: '+=' + rand(-3, 3), z: '+=' + rand(-4, 4), duration: d, ease: 'power1.in' });
      });
    });
  }

  function decline() {
    if (answered) return;
    answered = true;
    gsap.killTweensOf([yes, no, plea]);
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.to([yes, no, plea, '.eyebrow'], { autoAlpha: 0, duration: 0.5 }, 0)
      .to('.title', { autoAlpha: 0, y: -24, filter: 'blur(10px)', duration: 0.6, ease: 'power2.in' }, 0)
      .add(() => {
        $('.actions').style.display = 'none'; plea.style.display = 'none'; $('.eyebrow').style.display = 'none';
        setLine(CONFIG.noLine); elScript.textContent = CONFIG.noScript;
        $('.title').setAttribute('aria-label', `${CONFIG.noLine} ${CONFIG.noScript}`);
        note.textContent = CONFIG.noNote;
        if (CONFIG.from) {
          const sign = document.createElement('small');
          sign.textContent = `With care, ${CONFIG.from}`;
          note.appendChild(sign);
        }
        note.style.display = 'block';
        const again = $('.again'); again.textContent = 'Changed your mind?'; again.href = location.href; goTo(again);
        again.style.display = 'inline-block';
        gsap.set([note, again], { autoAlpha: 0 }); gsap.set(note, { y: 16 });
        setupTell('no');
        gsap.set(elScript, { clipPath: 'inset(-20% 100% -20% -5%)' });
      }, 0.65)
      .fromTo('.title', { autoAlpha: 0, y: 30, filter: 'blur(10px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.3 }, 0.9)
      .to(elScript, { clipPath: 'inset(-20% -5% -20% -5%)', duration: 1.5, ease: 'power2.inOut' }, 1.0)
      .to(note, { autoAlpha: 1, y: 0, duration: 1.2 }, 1.9)
      .to('.again', { autoAlpha: 1, duration: 1.2 }, 3.2);
    if (!renderer) return;
    shedPetals();
    gsap.to(state, { droop: 0, rain: 0.45, duration: 2.6, ease: 'power2.out' });
    gsap.to('.glow', { opacity: 0.6, duration: 2, overwrite: true });
  }

  no.addEventListener('pointerdown', (e) => { if (noReady) return; e.preventDefault(); dodge(e.clientX, e.clientY); });
  no.addEventListener('click', (e) => {           // keyboard activation lands here
    if (noReady) return decline();
    if (noCount < CONFIG.dodges && performance.now() - lastDodge > 320) { const r = no.getBoundingClientRect(); dodge(r.left + r.width / 2, r.top + r.height / 2); }
  });

  /* =====================================================================
     CREATOR — type two names, get a link to send
     ===================================================================== */
  if (MAKER) {
    const form = $('.m-form'), result = $('.m-result'), link = $('#m-link'), copy = $('#m-copy'), share = $('#m-share');
    const swap = (hide, show) => gsap.to(hide, { autoAlpha: 0, y: -10, duration: 0.3, onComplete: () => {
      hide.hidden = true; show.hidden = false;
      gsap.fromTo(show, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out' });
    } });
    if (!navigator.share) share.hidden = true;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const t = $('#m-to').value.trim(), f = $('#m-from').value.trim();
      if (!t) return;
      const waEl = $('#m-wa'), w = waEl.value.replace(/\D/g, '');
      if (w && (w.length < 8 || w.length > 15 || w[0] === '0')) {
        waEl.setCustomValidity('Use the full number with country code, for example +62 812 3456 7890');
        waEl.reportValidity();
        return;
      }
      const data = { t, f }; if (w) data.w = w;
      const url = pageUrl() + '#v=' + encodeCard(data);
      link.value = url; $('#m-open').href = url;
      $('.m-hint b').textContent = t;
      $('.m-title').textContent = 'Now send it';
      swap(form, result);
      if (renderer) gsap.to(head.rotation, { y: '+=' + Math.PI, duration: 2, ease: 'power3.out' });
    });
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(link.value); }
      catch (e) { link.select(); document.execCommand('copy'); }
      copy.textContent = 'Copied';
      setTimeout(() => { copy.textContent = 'Copy link'; }, 1800);
    });
    link.addEventListener('focus', () => link.select());
    $('#m-wa').addEventListener('input', (e) => e.target.setCustomValidity(''));
    share.addEventListener('click', () => {
      navigator.share({ title: 'A question for you', url: link.value }).catch(() => {});
    });
    $('.m-back').addEventListener('click', () => {
      $('.m-title').textContent = 'Who is your Valentine?';
      form.reset(); swap(result, form);
    });
  }

  /* =====================================================================
     YES
     ===================================================================== */
  yes.addEventListener('click', () => {
    if (answered) return;
    answered = true;
    intro.progress(1);
    gsap.killTweensOf([yes, no, plea]);

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.to([no, plea, '.eyebrow'], { autoAlpha: 0, duration: 0.4 }, 0)
      .to(yes, { scale: '+=0.25', autoAlpha: 0, duration: 0.55, ease: 'power2.in' }, 0)
      .to('.title', { autoAlpha: 0, y: -24, filter: 'blur(10px)', duration: 0.6, ease: 'power2.in' }, 0)
      .add(() => {
        $('.actions').style.display = 'none'; plea.style.display = 'none'; $('.eyebrow').style.display = 'none';
        setLine(CONFIG.yesLine); elScript.textContent = CONFIG.yesScript;
        $('.title').setAttribute('aria-label', `${CONFIG.yesLine} ${CONFIG.yesScript}`);
        note.textContent = CONFIG.yesNote;
        const sign = document.createElement('small');
        sign.textContent = CONFIG.from ? `With love, ${CONFIG.from}` : 'February 14';
        note.appendChild(sign);
        const again = $('.again'); again.href = pageUrl(); goTo(again, pageUrl());
        again.style.display = 'inline-block'; gsap.set(again, { autoAlpha: 0 });
        setupTell('yes');
        note.style.display = 'block';
        gsap.set(note, { autoAlpha: 0, y: 16 });
        gsap.set(elScript, { clipPath: 'inset(-20% 100% -20% -5%)' });
      }, 0.65)
      .fromTo('.title', { autoAlpha: 0, y: 30, filter: 'blur(10px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.1 }, 0.9)
      .to(elScript, { clipPath: 'inset(-20% -5% -20% -5%)', duration: 1.2, ease: 'power2.inOut' }, 1.0)
      .to(note, { autoAlpha: 1, y: 0, duration: 1 }, 1.7)
      .to('.again', { autoAlpha: 1, duration: 1.2 }, 3.4)
      .to('.warm', { opacity: 1, duration: 2.4, ease: 'power2.out' }, 0.1)
      .to('.glow', { opacity: 1, scale: 1.35, duration: 1.4, overwrite: true }, 0.1);

    if (!renderer) return;
    regrow(true);
    bloomTo(1.18, 1.8, 'elastic.out(1, 0.55)', 0.25);
    gsap.to(state, { droop: 0, duration: 1 });
    gsap.to(rig.scale, { x: 1.12, y: 1.12, z: 1.12, duration: 1.6, ease: 'elastic.out(1, 0.6)' });
    gsap.to(head.rotation, { y: '+=' + Math.PI * 2, duration: 3.2, ease: 'power3.out' });
    gsap.fromTo(state, { rain: 5 }, { rain: 1.8, duration: 5, ease: 'power2.out' });
    gsap.fromTo(state, { camDz: 0 }, { camDz: -0.5, duration: 0.35, ease: 'power2.out', yoyo: true, repeat: 1 });

    const oy = rig.position.y + 0.5;
    burst.forEach(m => {
      const a = rand(0, Math.PI * 2), up = rand(-0.35, 1), d = rand(1.8, visW * 0.55 + 2);
      m.visible = true;
      m.position.set(0, oy, 0.4);
      m.scale.setScalar(0.01);
      m.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
      const life = rand(4.5, 8);
      gsap.timeline({ delay: rand(0, 0.28), onComplete: () => { m.visible = false; } })
        .to(m.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: 'back.out(2)' }, 0)
        .to(m.position, { x: Math.cos(a) * d, y: oy + up * d * 0.75, z: 0.4 + Math.sin(a) * d * 0.55, duration: rand(1, 1.7), ease: 'expo.out' }, 0)
        .to(m.position, { y: '-=' + (visH + 4), x: '+=' + rand(-1.5, 1.5), duration: life, ease: 'power1.in' }, '>-0.15')
        .to(m.rotation, { x: '+=' + rand(-9, 9), y: '+=' + rand(-9, 9), z: '+=' + rand(-9, 9), duration: life + 1.7, ease: 'none' }, 0);
    });
  });
})();
