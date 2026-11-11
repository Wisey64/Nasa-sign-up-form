import * as THREE from "three";

/* ------------------------------------------------------------------
   Settings you can play with
------------------------------------------------------------------- */
const MOON_TEXTURE = "moon.jpg";
const SECONDS_PER_TURN = 240;   // one full spin every 4 minutes. Bigger number = slower.
const AXIS_TILT_DEG = 8;        // lean of the moon's spin axis
const MOON_SIZE = 0.47;         // moon radius as a fraction of its area's smaller side
const PX_PER_STAR = 700;        // one star per this many screen pixels (smaller = more stars)
const STAR_MAX = 4000;          // upper limit, for very large screens
const PARALLAX_PX = 14;         // how far the view drifts with the mouse (0 = off)
const LIGHT_INTENSITY = 3.4;    // brightness of the sunlit side
const BUMP_SCALE = 0.6;         // crater/terrain relief along the day/night line
const FOV = 20;                 // low field of view = flatter, more "telescope" look

// The sun is to the lower-left, like in the original photo (x = right, y = up, z = toward you)
const SUN_DIRECTION = new THREE.Vector3(-0.805, -0.594, 0.07).normalize();

const CAMERA_DISTANCE = 10; // world units; only the proportions matter

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

  // rig = position + size on screen; tilt = lean of the axis; moon = the spinning ball
  const tilt = new THREE.Group();
  tilt.rotation.z = THREE.MathUtils.degToRad(AXIS_TILT_DEG);
  tilt.add(moon);
  const moonRig = new THREE.Group();
  moonRig.add(tilt);
  scene.add(moonRig);

  new THREE.TextureLoader().load(
    MOON_TEXTURE,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      moonMaterial.map = texture;
      moonMaterial.bumpMap = texture; // brightness doubles as relief, so craters catch the light
      moonMaterial.needsUpdate = true;
      moon.visible = true;
    },
    undefined,
    (err) => console.error(`Could not load ${MOON_TEXTURE}. Are you running a local server?`, err)
  );

  /* ---------------- Light (fixed) ---------------- */
  const sun = new THREE.DirectionalLight(0xffffff, LIGHT_INTENSITY);
  sun.position.copy(SUN_DIRECTION).multiplyScalar(10);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, 0.02)); // tiny, so the night side stays black

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

  // Called every frame: park the moon in the middle of #moon-area, wherever that is right now
  // (top of the page on a phone, left half on a desktop, and it follows the page as it scrolls).
  function placeMoon() {
    const rect = moonArea.getBoundingClientRect();
    const centreX = rect.left + rect.width / 2;
    const centreY = rect.top + rect.height / 2;
    const radiusPx = Math.min(rect.width, rect.height) * MOON_SIZE;

    // Turn "radiusPx on screen" into a sphere radius in world units, allowing for perspective
    const t = (radiusPx * unitsPerPx) / CAMERA_DISTANCE;
    const radius = (CAMERA_DISTANCE * t) / Math.sqrt(1 + t * t);

    moonRig.position.set((centreX - W / 2) * unitsPerPx, -(centreY - H / 2) * unitsPerPx, 0);
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

  /* ---------------- Render loop ---------------- */
  const FACE_CAMERA = -Math.PI / 2; // puts the texture's centre (the near side) toward the viewer at the start
  const spinPerSecond = reduceMotion ? 0 : (Math.PI * 2) / SECONDS_PER_TURN;
  const clock = new THREE.Clock();

  function frame() {
    const t = clock.getElapsedTime();
    starUniforms.uTime.value = t;
    moon.rotation.y = FACE_CAMERA + t * spinPerSecond; // slow, steady spin

    eased.x += (pointer.x - eased.x) * 0.05;
    eased.y += (pointer.y - eased.y) * 0.05;
    camera.position.set(eased.x * parallax * unitsPerPx, -eased.y * parallax * unitsPerPx, CAMERA_DISTANCE);

    placeMoon();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  frame();
}
