import * as THREE from "three";

/* ------------------------------------------------------------------
   Settings you can play with
------------------------------------------------------------------- */
// Moon map, loaded from a CDN so you don't have to upload any images.
// The first one is sharp (4096 x 2048). If it ever fails to load, the next one is used.
// Credit: Solar System Scope (CC BY 4.0), based on NASA imagery - keep the credit line in index.html.
// To use your own picture, add it to the repo and put its file name first, e.g. "moon.jpg".
const MOON_TEXTURES = [
  "https://cdn.jsdelivr.net/gh/FutureNathan/valuemaps@89bb6b6bcacb839149b7c5d78b63936ef4bb95cb/public/tex-moon-hi.jpg",
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/textures/planets/moon_1024.jpg", // backup, softer
];
const SECONDS_PER_TURN = 240;   // one full spin every 4 minutes. Bigger number = slower.
const AXIS_TILT_DEG = 8;        // lean of the moon's spin axis
const MOON_SIZE = 0.47;         // sign-up view: moon radius as a fraction of its area's smaller side
const MOON_SIZE_EXPLORE = 0.4;  // explore view: same idea, a bit smaller so the pins have room
const PX_PER_STAR = 700;        // one star per this many screen pixels (smaller = more stars)
const STAR_MAX = 4000;          // upper limit, for very large screens
const PARALLAX_PX = 14;         // how far the view drifts with the mouse (0 = off)
const LIGHT_INTENSITY = 3.4;    // brightness of the sunlit side
const BUMP_SCALE = 0.35;        // crater/terrain relief along the day/night line (0 = flat)
const FOV = 20;                 // low field of view = flatter, more "telescope" look

// Explore mode
const ZOOM_MIN = 0.7;
const ZOOM_MAX = 3;
const PIN_SIZE = 0.13;          // pin glow size, as a fraction of the moon's radius
const TAP_RADIUS_PX = 26;       // how close (in screen pixels) a tap must be to a pin to pick it
const TAP_MOVE_PX = 6;          // moving less than this still counts as a tap, not a drag

// The sun is to the lower-left, like in the original photo (x = right, y = up, z = toward you)
const SUN_DIRECTION = new THREE.Vector3(-0.805, -0.594, 0.07).normalize();
// "Full light": the sun shines from nearly behind you, so the whole face is lit
const FULL_LIGHT_DIRECTION = new THREE.Vector3(-0.25, 0.35, 1).normalize();

const CAMERA_DISTANCE = 10; // world units; only the proportions matter
const FACE_CAMERA = -Math.PI / 2; // puts the texture's centre (the near side) toward the viewer at the start

init();

function init() {
  const canvas = document.getElementById("space");
  const moonArea = document.getElementById("moon-area"); // the moon is centred on this element

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch (err) {
    // No WebGL (old browser / blocked GPU): fall back to the original photo.
    console.warn("WebGL unavailable, using the static photo instead.", err);
    canvas.remove();
    moonArea.style.background = "url(nasa-pd4lo70LdbI-unsplash.jpg) center / cover no-repeat";
    const hint = document.querySelector(".hint");
    if (hint) hint.remove();
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 1);

  // People who ask their system for less motion get a still moon and steady stars.
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 500);
  camera.position.set(0, 0, CAMERA_DISTANCE);
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2));

  /* ---------------- Moon ---------------- */
  const moonMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    metalness: 0,
    bumpScale: BUMP_SCALE,
  });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), moonMaterial);
  moon.visible = false; // shown once the texture has loaded

  // rig = position + size on screen; tilt = lean of the axis (and what you turn when you drag);
  // moon = the ball itself, which also spins slowly on its own
  const tilt = new THREE.Group();
  tilt.rotation.z = THREE.MathUtils.degToRad(AXIS_TILT_DEG);
  tilt.add(moon);
  const tiltHome = tilt.quaternion.clone(); // where the moon settles back to in the sign-up view
  const moonRig = new THREE.Group();
  moonRig.add(tilt);
  scene.add(moonRig);

  const textureLoader = new THREE.TextureLoader();
  function loadMoonTexture(i) {
    textureLoader.load(
      MOON_TEXTURES[i],
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        moonMaterial.map = texture;
        moonMaterial.bumpMap = texture; // brightness doubles as relief, so craters catch the light
        moonMaterial.needsUpdate = true;
        moon.visible = true;
      },
      undefined,
      (err) => {
        console.warn(`Could not load moon texture: ${MOON_TEXTURES[i]}`, err);
        if (i + 1 < MOON_TEXTURES.length) loadMoonTexture(i + 1); // try the backup
      }
    );
  }
  loadMoonTexture(0);

  /* ---------------- Light ---------------- */
  const sun = new THREE.DirectionalLight(0xffffff, LIGHT_INTENSITY);
  const sunDir = SUN_DIRECTION.clone(); // the direction the sun is "really" at; eases toward its goal
  sun.position.copy(sunDir).multiplyScalar(10);
  scene.add(sun);
  const ambient = new THREE.AmbientLight(0xffffff, 0.02); // tiny, so the night side stays black
  scene.add(ambient);

  /* ---------------- Stars (cover the whole page) ---------------- */
  // Each star is stored as a screen position (-1..1) plus a depth behind the moon.
  // layout() turns those into 3D positions for the current screen size.
  const starNdc = new Float32Array(STAR_MAX * 2);
  const starDepth = new Float32Array(STAR_MAX);
  const starPositions = new Float32Array(STAR_MAX * 3);
  const starColors = new Float32Array(STAR_MAX * 3);
  const starSizes = new Float32Array(STAR_MAX);
  const starPhases = new Float32Array(STAR_MAX);

  const tints = [
    [1.0, 1.0, 1.0], // white
    [0.78, 0.86, 1.0], // blue-white
    [1.0, 0.93, 0.8], // warm
  ];
  const SLACK = 1.12; // generate a little past the edges so mouse parallax never shows gaps
  for (let i = 0; i < STAR_MAX; i++) {
    starNdc[i * 2] = (Math.random() * 2 - 1) * SLACK;
    starNdc[i * 2 + 1] = (Math.random() * 2 - 1) * SLACK;
    starDepth[i] = 8 + Math.random() * 90;

    const brightness = 0.3 + Math.pow(Math.random(), 2) * 0.7; // mostly dim, a few bright
    const tint = tints[Math.floor(Math.random() * tints.length)];
    starColors.set([tint[0] * brightness, tint[1] * brightness, tint[2] * brightness], i * 3);

    starSizes[i] = Math.random() < 0.04 ? 3.5 + Math.random() * 1.5 : 1.2 + Math.random() * 1.4;
    starPhases[i] = Math.random();
  }

  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  starGeometry.setAttribute("aColor", new THREE.BufferAttribute(starColors, 3));
  starGeometry.setAttribute("aSize", new THREE.BufferAttribute(starSizes, 1));
  starGeometry.setAttribute("aPhase", new THREE.BufferAttribute(starPhases, 1));

  const starUniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uTwinkle: { value: reduceMotion ? 0 : 0.35 },
  };
  const starMaterial = new THREE.ShaderMaterial({
    uniforms: starUniforms,
    transparent: true,
    depthWrite: false, // stars never hide each other...
    depthTest: true, //   ...but the moon still hides the stars behind it
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aPhase;
      uniform float uTime;
      uniform float uPixelRatio;
      uniform float uTwinkle;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vColor = aColor;
        vAlpha = 1.0 - uTwinkle * (0.5 + 0.5 * sin(uTime * (0.8 + aPhase) + aPhase * 40.0));
        gl_PointSize = aSize * uPixelRatio;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        float glow = smoothstep(0.5, 0.0, d); // soft round dot instead of a square
        gl_FragColor = vec4(vColor, glow * vAlpha);
      }
    `,
  });
  const stars = new THREE.Points(starGeometry, starMaterial);
  stars.frustumCulled = false;
  scene.add(stars);

  /* ---------------- Layout ---------------- */
  let W = 1;
  let H = 1;
  let unitsPerPx = 1; // world units per CSS pixel on the plane the moon sits in

  function layout() {
    W = Math.max(canvas.clientWidth, 1);
    H = Math.max(canvas.clientHeight, 1);
    renderer.setSize(W, H, false); // CSS already sizes the canvas to the window
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    unitsPerPx = (2 * CAMERA_DISTANCE * tanHalf) / H;

    // More screen = more stars, same density on a phone and on a big monitor.
    starGeometry.setDrawRange(0, Math.min(STAR_MAX, Math.round((W * H) / PX_PER_STAR)));

    for (let i = 0; i < STAR_MAX; i++) {
      const depthFromCamera = CAMERA_DISTANCE + starDepth[i];
      const halfH = depthFromCamera * tanHalf;
      const halfW = halfH * camera.aspect;
      starPositions[i * 3] = starNdc[i * 2] * halfW;
      starPositions[i * 3 + 1] = starNdc[i * 2 + 1] * halfH;
      starPositions[i * 3 + 2] = -starDepth[i];
    }
    starGeometry.attributes.position.needsUpdate = true;
  }
  new ResizeObserver(layout).observe(canvas);
  layout();

  /* ---------------- Where the moon sits on screen ---------------- */
  const exploreEl = document.getElementById("explore");
  const exploreStage = document.getElementById("explore-stage"); // empty box = where the moon goes in explore mode

  let exploring = false;
  let zoom = 1; // eased toward zoomTarget
  let zoomTarget = 1;
  // The moon's current centre and radius in screen pixels. They glide to a new spot
  // (view.easing > 0) when you switch between sign-up and explore, and follow exactly otherwise.
  const view = { cx: 0, cy: 0, r: 1, ready: false, easing: 0 };

  function placeMoon(dt) {
    const area = exploring && exploreStage ? exploreStage : moonArea;
    const rect = area.getBoundingClientRect();
    const target = {
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2,
      r: Math.min(rect.width, rect.height) * (exploring ? MOON_SIZE_EXPLORE : MOON_SIZE),
    };

    zoom += (zoomTarget - zoom) * (1 - Math.exp(-dt * 10));
    target.r *= zoom;

    if (!view.ready) {
      Object.assign(view, target, { ready: true });
    } else {
      const k = view.easing > 0 ? 1 - Math.exp(-dt * 7) : 1;
      view.cx += (target.cx - view.cx) * k;
      view.cy += (target.cy - view.cy) * k;
      view.r += (target.r - view.r) * k;
    }
    view.easing = Math.max(0, view.easing - dt);

    // Turn "radius on screen" into a sphere radius in world units, allowing for perspective
    const t = (view.r * unitsPerPx) / CAMERA_DISTANCE;
    const radius = (CAMERA_DISTANCE * t) / Math.sqrt(1 + t * t);

    moonRig.position.set((view.cx - W / 2) * unitsPerPx, -(view.cy - H / 2) * unitsPerPx, 0);
    moonRig.scale.setScalar(radius);
  }

  /* ---------------- Mouse parallax ---------------- */
  const parallax = reduceMotion ? 0 : PARALLAX_PX;
  const pointer = { x: 0, y: 0 };
  const eased = { x: 0, y: 0 };
  window.addEventListener("pointermove", (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  });

  /* ---------------- Explore mode: shared state ---------------- */
  const X_AXIS = new THREE.Vector3(1, 0, 0);
  const Y_AXIS = new THREE.Vector3(0, 1, 0);
  const _p = new THREE.Vector3();
  const _c = new THREE.Vector3();
  const _n = new THREE.Vector3();
  const _toCam = new THREE.Vector3();
  const _target = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _step = new THREE.Quaternion();
  const _spin = new THREE.Quaternion();

  const pinsGroup = new THREE.Group(); // pins ride on the moon, so they turn with it
  pinsGroup.visible = false;
  moon.add(pinsGroup);

  let pins = []; // { site, dir, sprite, base }
  let selected = null; // the pin whose info is showing
  let focusing = false; // true while the moon turns itself to face the selected pin
  let dragging = false;
  let lightFull = false;
  let pinFade = 0;
  let labelEl = null; // floating name tag next to the selected pin (set in buildExplore)
  const inertia = { x: 0, y: 0 }; // flick momentum, in radians per second

  // Turn the moon around the screen's own axes (so dragging always feels the same, whatever it shows)
  function rotateBy(ax, ay) {
    _spin.setFromAxisAngle(Y_AXIS, ay);
    tilt.quaternion.premultiply(_spin);
    _spin.setFromAxisAngle(X_AXIS, ax);
    tilt.quaternion.premultiply(_spin);
  }

  // Latitude/longitude (degrees) <-> a point on the unit sphere, matching how the moon map wraps around
  // three.js's sphere: longitude 0 faces +x, and east goes toward -z.
  function latLonToVector(latDeg, lonDeg, out) {
    const lat = THREE.MathUtils.degToRad(latDeg);
    const lon = THREE.MathUtils.degToRad(lonDeg);
    return out.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
  }
  function vectorToLatLon(v) {
    return {
      lat: THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(v.y, -1, 1))),
      lon: THREE.MathUtils.radToDeg(Math.atan2(-v.z, v.x)),
    };
  }
  function formatDegrees(value, plus, minus) {
    return `${Math.abs(value).toFixed(2)}\u00B0 ${value >= 0 ? plus : minus}`;
  }

  // Which point of the moon is under this screen position? (null = missed it)
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function intersectMoon(clientX, clientY) {
    if (!moon.visible) return null;
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObject(moon, false);
    return hits.length ? hits[0] : null;
  }

  // Each frame while a pin is selected: nudge the moon so that pin comes to the middle, facing you.
  // "Facing you" means pointing straight at the camera from wherever the moon sits on screen
  // (the moon is usually off to one side, so that is not exactly the same as pointing along the z axis).
  function stepFocus(dt) {
    moonRig.updateMatrixWorld(true);
    selected.sprite.getWorldPosition(_p);
    moon.getWorldPosition(_c);
    _p.sub(_c).normalize();
    _target.copy(camera.position).sub(_c).normalize();
    if (_p.angleTo(_target) < 0.004) {
      focusing = false;
      return;
    }
    _q.setFromUnitVectors(_p, _target);
    _step.identity().slerp(_q, 1 - Math.exp(-dt * 6));
    tilt.quaternion.premultiply(_step);
  }

  // Keep the selected pin's name tag stuck next to it (and hide it when the pin is on the far side)
  function updateLabel() {
    if (!labelEl) return;
    if (!exploring || !selected) {
      labelEl.style.opacity = "0";
      return;
    }
    selected.sprite.getWorldPosition(_p);
    moon.getWorldPosition(_c);
    _n.copy(_p).sub(_c).normalize();
    _toCam.copy(camera.position).sub(_p).normalize();
    const facing = _n.dot(_toCam) > 0.05;
    _p.project(camera);
    labelEl.style.opacity = facing ? "1" : "0";
    labelEl.style.transform = `translate(${(_p.x * 0.5 + 0.5) * W}px, ${(-_p.y * 0.5 + 0.5) * H}px) translate(-50%, -190%)`;
  }

  function updatePins(time) {
    for (const pin of pins) {
      const isSelected = pin === selected;
      pin.sprite.scale.setScalar(pin.base * (isSelected ? 1.7 + 0.25 * Math.sin(time * 4) : 1));
      pin.sprite.material.opacity = pinFade * (isSelected ? 1 : 0.85);
    }
  }

  /* ---------------- Explore mode: the screen, the buttons and the gestures ---------------- */
  // Everything here needs moon-data.js. It is loaded separately, so if that file is ever
  // missing the stars and the moon above still work and the sign-up page is unaffected.
  function buildExplore({ SITES, FACTS }) {
    const byId = (id) => document.getElementById(id);
    const pageEl = document.querySelector(".page");
    const chipsEl = byId("site-chips");
    const cardEl = byId("site-card");
    const factsEl = byId("facts-list");
    const coordsEl = byId("coords");
    const hintEl = byId("explore-hint");
    const panelEl = byId("explore-panel");
    const backBtn = byId("explore-back");
    const lightBtn = byId("light-toggle");
    const tabSites = byId("tab-sites");
    const tabFacts = byId("tab-facts");
    const viewSites = byId("view-sites");
    const viewFacts = byId("view-facts");
    labelEl = byId("pin-label");

    const needed = [exploreEl, exploreStage, pageEl, chipsEl, cardEl, factsEl, coordsEl, hintEl, panelEl, backBtn, lightBtn, tabSites, tabFacts, viewSites, viewFacts, labelEl];
    if (needed.some((node) => !node)) {
      console.warn("Explore mode is off: some of its HTML is missing from index.html.");
      return;
    }

    // tiny helper: h("p", { class: "meta", text: "hello" }) builds <p class="meta">hello</p>
    function h(tag, props = {}) {
      const node = document.createElement(tag);
      for (const [key, value] of Object.entries(props)) {
        if (key === "text") node.textContent = value;
        else if (key === "class") node.className = value;
        else node.setAttribute(key, value);
      }
      return node;
    }

    /* ----- pins on the moon ----- */
    const glowCanvas = document.createElement("canvas");
    glowCanvas.width = glowCanvas.height = 64;
    const g = glowCanvas.getContext("2d");
    const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.2, "rgba(255,255,255,0.95)");
    gradient.addColorStop(0.38, "rgba(255,255,255,0.3)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gradient;
    g.fillRect(0, 0, 64, 64);
    const glowTexture = new THREE.CanvasTexture(glowCanvas);
    glowTexture.colorSpace = THREE.SRGBColorSpace;

    pins = SITES.map((site) => {
      const dir = latLonToVector(site.lat, site.lon, new THREE.Vector3());
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTexture,
          color: site.kind === "robot" ? 0x6bd6ff : 0xffc857,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      sprite.position.copy(dir).multiplyScalar(1.012); // just above the surface
      sprite.scale.setScalar(PIN_SIZE);
      pinsGroup.add(sprite);
      return { site, dir, sprite, base: PIN_SIZE };
    });

    /* ----- the info panel ----- */
    function renderCard(site) {
      cardEl.replaceChildren();
      if (!site) {
        cardEl.append(
          h("h3", { text: "Pick a mission" }),
          h("p", {
            text: "Choose a mission above, or tap a glowing pin on the Moon. Amber pins are Apollo landings with astronauts. Blue pins are robot missions.",
          })
        );
        return;
      }
      cardEl.append(
        h("h3", { text: site.name }),
        h("p", { class: "subtitle", text: site.tagline }),
        h("p", { class: "meta", text: `${site.date} \u00B7 ${site.place}` }),
        h("p", { class: "meta", text: `${formatDegrees(site.lat, "N", "S")}, ${formatDegrees(site.lon, "E", "W")}` }),
        h("p", { text: site.crew }),
        h("p", { text: site.story }),
        h("p", { class: "fact", text: `Did you know? ${site.fact}` })
      );
    }

    for (const site of SITES) {
      const chip = h("button", { type: "button", class: `chip ${site.kind}`, "aria-pressed": "false", "data-id": site.id, text: site.short });
      chip.addEventListener("click", () => select(selected && selected.site.id === site.id ? null : site.id));
      chipsEl.append(chip);
    }
    for (const fact of FACTS) {
      const item = h("li");
      item.append(h("strong", { text: fact.label }), document.createTextNode(` ${fact.text}`));
      factsEl.append(item);
    }

    function showTab(name) {
      const sites = name === "sites";
      tabSites.setAttribute("aria-selected", String(sites));
      tabFacts.setAttribute("aria-selected", String(!sites));
      viewSites.hidden = !sites;
      viewFacts.hidden = sites;
    }
    tabSites.addEventListener("click", () => showTab("sites"));
    tabFacts.addEventListener("click", () => showTab("facts"));

    function setCoords(text) {
      coordsEl.textContent = text;
      coordsEl.classList.toggle("is-on", Boolean(text));
    }

    function select(id) {
      selected = id ? pins.find((pin) => pin.site.id === id) || null : null;
      for (const chip of chipsEl.children) {
        chip.setAttribute("aria-pressed", String(Boolean(selected) && chip.dataset.id === selected.site.id));
      }
      renderCard(selected ? selected.site : null);
      panelEl.scrollTop = 0;
      focusing = Boolean(selected);
      if (selected) {
        showTab("sites");
        labelEl.textContent = selected.site.name;
        const chip = chipsEl.querySelector(`[data-id="${selected.site.id}"]`);
        if (chip && chip.scrollIntoView) chip.scrollIntoView({ block: "nearest", inline: "center" });
      }
    }
    renderCard(null);

    lightBtn.addEventListener("click", () => {
      lightFull = !lightFull;
      lightBtn.setAttribute("aria-pressed", String(lightFull));
    });

    /* ----- going in and out ----- */
    let savedScroll = 0;

    function enterExplore(pushHistory = true) {
      if (exploring) return;
      exploring = true;
      savedScroll = window.scrollY;
      window.scrollTo(0, 0);
      document.body.classList.add("exploring");
      pageEl.setAttribute("inert", ""); // the form can't be tabbed to or read while hidden
      exploreEl.removeAttribute("inert");
      exploreEl.setAttribute("aria-hidden", "false");
      hintEl.classList.remove("is-gone");
      view.easing = 1.1;
      zoomTarget = 1;
      if (pushHistory) history.pushState({ explore: true }, "", "#explore"); // so the phone's Back button works
      backBtn.focus({ preventScroll: true });
    }

    function leaveExplore() {
      if (!exploring) return;
      exploring = false;
      document.body.classList.remove("exploring", "dragging");
      pageEl.removeAttribute("inert");
      exploreEl.setAttribute("inert", "");
      exploreEl.setAttribute("aria-hidden", "true");
      select(null);
      setCoords("");
      lightFull = false;
      lightBtn.setAttribute("aria-pressed", "false");
      zoomTarget = 1;
      focusing = false;
      dragging = false;
      inertia.x = inertia.y = 0;
      pointers.clear();
      drag = null;
      pinch = null;
      view.easing = 1.1;
      window.scrollTo(0, savedScroll);
    }

    function requestExit() {
      if (history.state && history.state.explore) {
        history.back(); // popstate below does the rest
      } else {
        leaveExplore();
        if (location.hash === "#explore") history.replaceState(null, "", location.pathname + location.search);
      }
    }

    backBtn.addEventListener("click", requestExit);
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && exploring) requestExit();
    });
    window.addEventListener("popstate", () => {
      if (location.hash === "#explore") enterExplore(false);
      else leaveExplore();
    });

    /* ----- tapping the moon on the sign-up page ----- */
    moonArea.setAttribute("role", "button");
    moonArea.setAttribute("tabindex", "0");
    moonArea.setAttribute("aria-label", "Explore the Moon");
    moonArea.addEventListener("click", (e) => {
      if (!exploring && intersectMoon(e.clientX, e.clientY)) enterExplore();
    });
    moonArea.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target === moonArea) {
        e.preventDefault();
        enterExplore();
      }
    });
    moonArea.addEventListener("pointermove", (e) => {
      if (exploring || e.pointerType === "touch") return;
      moonArea.classList.toggle("moon-hover", Boolean(intersectMoon(e.clientX, e.clientY)));
    });
    moonArea.addEventListener("pointerleave", () => moonArea.classList.remove("moon-hover"));

    /* ----- drag to turn, pinch / wheel to zoom, tap a pin ----- */
    const pointers = new Map(); // every finger (or mouse button) currently down
    let drag = null;
    let pinch = null;

    function hideHint() {
      hintEl.classList.add("is-gone");
    }

    function handleTap(x, y) {
      const hit = intersectMoon(x, y);
      if (!hit) {
        setCoords("");
        return;
      }
      const local = moon.worldToLocal(hit.point.clone()).normalize(); // where on the moon's own surface
      let best = null;
      let bestAngle = TAP_RADIUS_PX / view.r; // pixels -> radians (small-angle shortcut)
      for (const pin of pins) {
        const angle = Math.acos(THREE.MathUtils.clamp(pin.dir.dot(local), -1, 1));
        if (angle < bestAngle) {
          best = pin;
          bestAngle = angle;
        }
      }
      if (best) {
        select(best.site.id);
        setCoords("");
      } else {
        const { lat, lon } = vectorToLatLon(local);
        setCoords(`You tapped: ${formatDegrees(lat, "N", "S")}, ${formatDegrees(lon, "E", "W")}`);
      }
    }

    canvas.addEventListener("pointerdown", (e) => {
      if (!exploring) return;
      if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        const now = performance.now();
        drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, t0: now, lastT: now, moved: false };
        inertia.x = inertia.y = 0;
      } else if (pointers.size === 2) {
        if (drag) drag.moved = true; // two fingers is never a tap
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: zoomTarget };
      }
      dragging = true;
      focusing = false;
      document.body.classList.add("dragging");
      hideHint();
    });

    canvas.addEventListener("pointermove", (e) => {
      if (!exploring || !pointers.has(e.pointerId)) return;
      const prev = pointers.get(e.pointerId);
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 2 && pinch) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        zoomTarget = THREE.MathUtils.clamp(pinch.zoom * (d / pinch.d), ZOOM_MIN, ZOOM_MAX);
        return;
      }
      if (!drag || drag.id !== e.pointerId) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > TAP_MOVE_PX) drag.moved = true;
      if (drag.moved) {
        const now = performance.now();
        const seconds = Math.max(now - drag.lastT, 1) / 1000;
        drag.lastT = now;
        // 1 pixel of drag = 1 pixel of surface movement: angle = distance / radius
        const ay = dx / view.r;
        const ax = dy / view.r;
        rotateBy(ax, ay);
        inertia.x = THREE.MathUtils.clamp(inertia.x * 0.6 + (ax / seconds) * 0.4, -8, 8);
        inertia.y = THREE.MathUtils.clamp(inertia.y * 0.6 + (ay / seconds) * 0.4, -8, 8);
      }
    });

    function endPointer(e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;

      if (drag && drag.id === e.pointerId) {
        const now = performance.now();
        const wasTap = !drag.moved && e.type === "pointerup" && now - drag.t0 < 500;
        if (now - drag.lastT > 90) inertia.x = inertia.y = 0; // finger rested before lifting: no flick
        drag = null;
        if (wasTap) {
          inertia.x = inertia.y = 0;
          handleTap(e.clientX, e.clientY);
        }
      }
      if (pointers.size === 0) {
        dragging = false;
        document.body.classList.remove("dragging");
      } else if (pointers.size === 1) {
        // one finger left after a pinch: carry on dragging from where it is, without a jump
        const [[id, p]] = [...pointers.entries()];
        const now = performance.now();
        drag = { id, sx: p.x, sy: p.y, t0: now, lastT: now, moved: true };
      }
    }
    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", endPointer);

    canvas.addEventListener(
      "wheel",
      (e) => {
        if (!exploring) return;
        e.preventDefault();
        zoomTarget = THREE.MathUtils.clamp(zoomTarget * Math.exp(-e.deltaY * 0.0015), ZOOM_MIN, ZOOM_MAX);
        hideHint();
      },
      { passive: false }
    );

    // Opened with a link that ends in #explore? Go straight in.
    if (location.hash === "#explore") enterExplore(false);
  }

  // moon-data.js is loaded on its own so a missing file can't break the stars or the sign-up page
  import("./moon-data.js")
    .then((data) => {
      if (exploreEl && exploreStage) buildExplore(data);
      else console.warn("Explore mode is off: the explore HTML is missing from index.html.");
    })
    .catch((err) => console.warn("Explore mode is off (could not load moon-data.js).", err));

  /* ---------------- Render loop ---------------- */
  const spinPerSecond = reduceMotion ? 0 : (Math.PI * 2) / SECONDS_PER_TURN;
  const clock = new THREE.Clock();
  let time = 0;
  let spinAngle = FACE_CAMERA;
  let spinFactor = 1; // 1 = full slow spin, 0 = holding still (while you look at something)

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.1); // capped so a hidden tab doesn't cause a jump
    time += dt;
    starUniforms.uTime.value = time;

    // The moon's own slow spin. It rests while you are dragging, flicking or reading about a site.
    const busy = dragging || focusing || Boolean(selected) || Math.hypot(inertia.x, inertia.y) > 0.05;
    const spinGoal = !exploring ? 1 : busy ? 0 : 0.5;
    spinFactor += (spinGoal - spinFactor) * (1 - Math.exp(-dt * 3));
    spinAngle += spinPerSecond * spinFactor * dt;
    moon.rotation.y = spinAngle;

    if (!exploring) {
      // back on the sign-up page: settle into the original pose
      tilt.quaternion.slerp(tiltHome, 1 - Math.exp(-dt * 4));
    } else {
      if (!dragging && (inertia.x || inertia.y)) {
        rotateBy(inertia.x * dt, inertia.y * dt); // coast after a flick, then slow down
        const decay = Math.exp(-dt * 2.8);
        inertia.x *= decay;
        inertia.y *= decay;
        if (Math.hypot(inertia.x, inertia.y) < 0.02) inertia.x = inertia.y = 0;
      }
      if (focusing && selected) stepFocus(dt);
    }

    pinFade += ((exploring ? 1 : 0) - pinFade) * (1 - Math.exp(-dt * 5));
    pinsGroup.visible = pinFade > 0.01;
    if (pinsGroup.visible) updatePins(time);
    updateLabel();

    // sunlight: half-lit "phase" look, or lit from the front so the whole face shows
    sunDir.lerp(lightFull ? FULL_LIGHT_DIRECTION : SUN_DIRECTION, 1 - Math.exp(-dt * 3)).normalize();
    sun.position.copy(sunDir).multiplyScalar(10);
    ambient.intensity += ((lightFull ? 0.06 : 0.02) - ambient.intensity) * (1 - Math.exp(-dt * 3));

    // the mouse nudges the view a little, except while exploring (dragging is the control there)
    const px = exploring ? 0 : pointer.x;
    const py = exploring ? 0 : pointer.y;
    eased.x += (px - eased.x) * 0.05;
    eased.y += (py - eased.y) * 0.05;
    camera.position.set(eased.x * parallax * unitsPerPx, -eased.y * parallax * unitsPerPx, CAMERA_DISTANCE);

    placeMoon(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  frame();
}
