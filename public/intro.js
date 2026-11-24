import { createServoScene } from './robotics.js';
import { createCloudFlight } from './sky-depth.js';

const intro = document.getElementById('intro');
const field = document.getElementById('cloud-field');
const motion = document.getElementById('cloud-motion');
const preference = matchMedia('(prefers-reduced-motion: reduce)');
let enabled = !preference.matches;
let visible = false;
let useWebGL = true;
let instance = null;
let scripts;
let revision = 0;
let scrollFrame = 0;
let lookX = 0, lookY = 0, flightProgress = 0;
const flight = createCloudFlight(document.getElementById('cloud-flight'));
const root = document.documentElement;
const studioMotion = document.getElementById('studio-motion');
const servos = createServoScene(document.querySelector('.robot-backdrop'));
function driveFlight() {
  flight(enabled && visible && !document.hidden, lookX, lookY, flightProgress);
}
function syncScroll() {
  scrollFrame = 0;
  const viewport = root.clientHeight;
  const pageRange = Math.max(1, root.scrollHeight - viewport);
  const progress = Math.max(0, Math.min(1, window.scrollY / pageRange));
  root.style.setProperty('--page-progress', progress);
  const bounds = intro.getBoundingClientRect();
  flightProgress = Math.max(0, Math.min(1, -bounds.top / Math.max(1,bounds.height)));
  intro.style.setProperty('--cloud-descent', enabled ? Math.round(flightProgress * viewport * .22) + 'px' : '0px');
  intro.style.setProperty('--flight-zoom', enabled ? 1 + flightProgress * .24 : 1);
  intro.style.setProperty('--title-lift', enabled ? -flightProgress * 36 + 'px' : '0px');
  driveFlight();
}
function scheduleScroll() {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(syncScroll);
}
window.addEventListener('scroll', scheduleScroll, {passive:true});
window.addEventListener('resize', scheduleScroll);
new ResizeObserver(scheduleScroll).observe(document.body);

// Animate a section once, only when it actually enters the viewport. Content is
// visible before JS loads, when motion is paused, and when reached by keyboard.
const entrances = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const el = entry.target;
    if (enabled) el.classList.add('scroll-entrant');
    entrances.unobserve(el);
  }
}, {threshold:.06});
for (const el of document.querySelectorAll('main > .heading, .layout > .panel, .games-head, .game-card, .practice')) entrances.observe(el);

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.onload = resolve;
    script.onerror = () => reject(new Error('Cloud script unavailable'));
    script.src = src;
    document.head.append(script);
  });
}

function stop() {
  if (!instance) return;
  const renderer = instance.renderer;
  instance.destroy();
  renderer?.dispose();
  renderer?.forceContextLoss();
  instance = null;
}

async function update() {
  const token = ++revision;
  motion.textContent = enabled ? 'Pause motion' : 'Play motion';
  motion.hidden = false;
  studioMotion.hidden = false;
  studioMotion.textContent = motion.textContent;
  servos.setMotion(enabled);
  const animate = enabled && visible && !document.hidden;
  intro.classList.toggle('in-flight', animate);
  root.classList.toggle('motion-enabled', enabled);
  scheduleScroll();
  driveFlight();
  if (!animate) clearLook();
  if (!animate || !useWebGL) {
    stop();
    return;
  }
  if (instance) return;
  try {
    scripts ??= loadScript('/fx/three.min.js').then(() => loadScript('/fx/vanta.clouds.min.js'));
    await scripts;
    if (token !== revision) return;
    instance = window.VANTA.CLOUDS({
      el: field, THREE: window.THREE, mouseControls: true, touchControls: true, gyroControls: false,
      skyColor: 0x182c50, cloudColor: 0xb193a3, cloudShadowColor: 0x101d37,
      sunColor: 0xffb361, sunGlareColor: 0xe0784a, sunlightColor: 0xf2ad71, speed: 1.1,
      scale: 3, scaleMobile: 5
    });
    if (!instance?.renderer || !field.querySelector('canvas')) throw new Error('Cloud renderer unavailable');
  } catch {
    useWebGL = false;
    field.hidden = true;
    stop();
  }
}
function clearLook() {
  lookX = lookY = 0;
  driveFlight();
  intro.style.removeProperty('--look-x');
  intro.style.removeProperty('--look-y');
}
intro.addEventListener('pointermove', event => {
  if (!enabled || !visible || event.pointerType === 'touch') return;
  const box = intro.getBoundingClientRect();
  lookX = ((event.clientX - box.left) / box.width - .5) * 2;
  lookY = ((event.clientY - box.top) / box.height - .5) * 2;
  intro.style.setProperty('--look-x', lookX * 19 + 'px');
  intro.style.setProperty('--look-y', lookY * 10 + 'px');
  driveFlight();
});
intro.addEventListener('pointerleave', clearLook);
function toggleMotion() { enabled = !enabled; update(); }
motion.addEventListener('click', toggleMotion);
studioMotion.addEventListener('click', toggleMotion);
preference.addEventListener('change', () => { enabled = !preference.matches; update(); });
new IntersectionObserver(([entry]) => {
  visible = entry.isIntersecting;
  update();
}).observe(intro);
document.addEventListener('visibilitychange', update);
window.addEventListener('pagehide', () => { revision++; flight(false,0,0,0); stop(); });
window.addEventListener('pageshow', update);
