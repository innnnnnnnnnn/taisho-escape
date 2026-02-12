import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// --- UI ---
const $ = (s) => document.querySelector(s);
const canvas = $('#c');
const objectiveEl = $('#objective');
const msgEl = $('#msg');
const btnInteract = $('#btnInteract');
const btnNotes = $('#btnNotes');
const btnInv = $('#btnInv');
const btnMute = $('#btnMute');
const btnReset = $('#btnReset');

const panelNotes = $('#panelNotes');
const panelInv = $('#panelInv');
const closeNotes = $('#closeNotes');
const closeInv = $('#closeInv');
const notesEl = $('#notes');
const invEl = $('#inv');

const hint = $('#hint');
const hintText = $('#hintText');
const hintClose = $('#hintClose');

const stick = $('#stick');
const knob = $('#knob');
const touchpad = $('#touchpad');

const STORAGE = 'hauntedEscape:v0';

function loadState(){
  try{ return JSON.parse(localStorage.getItem(STORAGE) || 'null'); }catch{ return null; }
}
function saveState(){
  try{
    localStorage.setItem(STORAGE, JSON.stringify({
      notes: notesEl.value,
      inv: state.inv,
      sel: state.sel,
      flags: state.flags,
      player: { pos: camera.position.toArray(), yaw: state.yaw, pitch: state.pitch },
    }));
  }catch{}
}

const state = {
  inv: [],
  sel: null,
  flags: {
    foyerKey:false,
    studyCode:false,
    atticUnlocked:false,
  },
  // mobile look
  yaw: 0,
  pitch: 0,
};

const saved = loadState();
if(saved){
  notesEl.value = saved.notes || '';
  state.inv = Array.isArray(saved.inv) ? saved.inv : [];
  state.sel = saved.sel || null;
  state.flags = { ...state.flags, ...(saved.flags||{}) };
}

notesEl.addEventListener('input', ()=>saveState());

function setObjective(text){ objectiveEl.textContent = text; }
function setMsg(text){ msgEl.textContent = text; }
function showHint(text){ hintText.textContent = text; hint.setAttribute('aria-hidden','false'); }
function hideHint(){ hint.setAttribute('aria-hidden','true'); }

hintClose.addEventListener('click', hideHint);
hint.addEventListener('click', (e)=>{ if(e.target === hint) hideHint(); });

function openPanel(el){
  el.setAttribute('aria-hidden','false');
}
function closePanel(el){
  el.setAttribute('aria-hidden','true');
}

btnNotes.addEventListener('click', ()=> openPanel(panelNotes));
btnInv.addEventListener('click', ()=> { renderInv(); openPanel(panelInv); });
closeNotes.addEventListener('click', ()=> closePanel(panelNotes));
closeInv.addEventListener('click', ()=> closePanel(panelInv));

btnReset.addEventListener('click', ()=>{
  if(!confirm('重置存檔與進度？')) return;
  localStorage.removeItem(STORAGE);
  location.reload();
});

// --- Inventory ---
const ITEMS = {
  NOTE: { name:'破碎便條', desc:'字跡被撕掉一角。像是提示某個「三位數」的排列。' },
  KEY:  { name:'銅鑰匙', desc:'沉重。可能打開某扇老舊的門。' },
  RING: { name:'家徽戒指', desc:'背面刻著三個符號：月、眼、樹。' },
};

function addItem(id){
  if(state.inv.includes(id)) return;
  state.inv.push(id);
  state.sel = null;
  setMsg(`取得：${ITEMS[id].name}`);
  saveState();
}

function renderInv(){
  invEl.innerHTML = '';
  const slots = Math.max(8, state.inv.length);
  for(let i=0;i<slots;i++){
    const id = state.inv[i];
    const div = document.createElement('div');
    div.className = 'slot' + (id && id===state.sel ? ' sel' : '');
    if(!id){ invEl.appendChild(div); continue; }
    div.innerHTML = `<div class="name">${ITEMS[id].name}</div><div class="desc">${ITEMS[id].desc}</div>`;
    div.addEventListener('click', ()=>{
      state.sel = (state.sel===id)? null : id;
      setMsg(state.sel ? `使用：${ITEMS[id].name}` : '');
      saveState();
      renderInv();
    });
    invEl.appendChild(div);
  }
}

// --- Three.js scaffold ---
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x070910);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x070910, 0.1, 18);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.01, 100);
camera.position.set(0, 1.6, 3.2);

// Lights (placeholder)
const hemi = new THREE.HemisphereLight(0x8db4ff, 0x06060a, 0.55);
scene.add(hemi);
const keyLight = new THREE.DirectionalLight(0xffe2b6, 0.65);
keyLight.position.set(2, 5, 3);
scene.add(keyLight);

// Room geometry (placeholder: 3 rooms as boxes connected)
const matWall = new THREE.MeshStandardMaterial({ color: 0x101826, roughness: 0.95, metalness: 0.0 });
const matFloor = new THREE.MeshStandardMaterial({ color: 0x0a0b10, roughness: 1.0, metalness: 0.0 });

function addRoom({x,z,w,d,h=3}){
  // floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), matFloor);
  floor.rotation.x = -Math.PI/2;
  floor.position.set(x, 0, z);
  scene.add(floor);

  // walls (simple)
  const t = 0.1;
  const wall1 = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), matWall);
  wall1.position.set(x, h/2, z - d/2);
  scene.add(wall1);
  const wall2 = wall1.clone();
  wall2.position.set(x, h/2, z + d/2);
  scene.add(wall2);
  const wall3 = new THREE.Mesh(new THREE.BoxGeometry(t, h, d), matWall);
  wall3.position.set(x - w/2, h/2, z);
  scene.add(wall3);
  const wall4 = wall3.clone();
  wall4.position.set(x + w/2, h/2, z);
  scene.add(wall4);

  return { floor };
}

// foyer, study, attic entrance
addRoom({x:0, z:3, w:6, d:6});
addRoom({x:0, z:-4, w:6, d:6});
addRoom({x:0, z:-11, w:6, d:6});

// Doorways (holes not cut yet; we just place "portal" triggers)

// Interactable objects (simple meshes with metadata)
const interactables = [];
function addInteractable(mesh, meta){
  mesh.userData.meta = meta;
  scene.add(mesh);
  interactables.push(mesh);
}

// A: foyer key under rug
{
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.9), new THREE.MeshStandardMaterial({ color: 0x1b2130, roughness: 1 }));
  rug.rotation.x = -Math.PI/2;
  rug.position.set(-1.6, 0.01, 4.6);
  scene.add(rug);

  const key = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.05, 0.08), new THREE.MeshStandardMaterial({ color: 0xffd36e, roughness: 0.3 }));
  key.position.set(-1.55, 0.03, 4.65);
  addInteractable(key, {
    id:'key',
    label:'銅鑰匙',
    hint:'門邊的鎖孔太新，這把鑰匙太舊…但也許是某個內門。',
    can: () => !state.flags.foyerKey,
    act: () => { state.flags.foyerKey=true; addItem('KEY'); key.visible=false; setObjective('目標：找到書房裡的線索'); }
  });
}

// B: study note on desk
{
  const desk = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.8), new THREE.MeshStandardMaterial({ color: 0x2a2b31, roughness: 0.9 }));
  desk.position.set(1.4, 0.4, -3.6);
  scene.add(desk);

  const note = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.16), new THREE.MeshStandardMaterial({ color: 0x77d6ff, roughness: 0.6 }));
  note.position.set(1.15, 0.82, -3.55);
  addInteractable(note, {
    id:'note',
    label:'破碎便條',
    hint:'三個符號…可能對應三個房間的物件。',
    can: () => !state.inv.includes('NOTE'),
    act: () => { addItem('NOTE'); note.visible=false; setMsg('便條背面沾著灰：閣樓門很久沒開過。'); }
  });
}

// C: attic door (locked until KEY + deduction)
{
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.2, 0.12), new THREE.MeshStandardMaterial({ color: 0x161a24, roughness: 0.95 }));
  door.position.set(0, 1.1, -12.6);
  addInteractable(door, {
    id:'attic',
    label:'閣樓門',
    hint:'鎖孔的磨損不均，像是有人刻意只轉到一半。',
    can: () => true,
    act: () => {
      // Hard-core rule: require both KEY and NOTE to unlock (clue-based)
      if(!state.inv.includes('KEY')) return fail('需要鑰匙');
      if(!state.inv.includes('NOTE')) return fail('線索不足');
      if(!state.flags.atticUnlocked){
        state.flags.atticUnlocked = true;
        setMsg('咔哒。門開了。');
        setObjective('目標：深入閣樓，找出離開的方法');
        // Move player into last room
        camera.position.set(0, 1.6, -10.6);
        saveState();
        return;
      }
      ok('已開啟');
    }
  });
}

function fail(why){
  setMsg(`失敗：${why}`);
  flash(0xff5c74, 0.12);
}
function ok(text){
  setMsg(text);
  flash(0xffd36e, 0.10);
}

let flashT = 0;
let flashColor = 0x000000;
let flashAlpha = 0;
function flash(color, alpha){
  flashT = 0.18;
  flashColor = color;
  flashAlpha = alpha;
}

// --- Controls (desktop + mobile) ---
const controls = new PointerLockControls(camera, document.body);
let usePointerLock = matchMedia('(pointer:fine)').matches;

let move = { f:0, b:0, l:0, r:0 };
let velocity = new THREE.Vector3();
let dir = new THREE.Vector3();

function onKey(e, down){
  if(e.code==='KeyW') move.f = down?1:0;
  if(e.code==='KeyS') move.b = down?1:0;
  if(e.code==='KeyA') move.l = down?1:0;
  if(e.code==='KeyD') move.r = down?1:0;
  if(e.code==='KeyE' && down) doInteract();
  if(e.code==='Escape' && down) { /* pointer lock handled by browser */ }
}
window.addEventListener('keydown', (e)=>onKey(e,true));
window.addEventListener('keyup', (e)=>onKey(e,false));

canvas.addEventListener('click', ()=>{
  if(usePointerLock){
    controls.lock();
    setMsg('');
  }
});

btnInteract.addEventListener('click', ()=>doInteract());

// Mobile: joystick for movement
let stickActive = false;
let stickCenter = {x:0,y:0};
let stickVec = {x:0,y:0};

function setKnob(x,y){
  knob.style.transform = `translate(${x}px, ${y}px)`;
}

stick.addEventListener('pointerdown', (e)=>{
  stickActive = true;
  stick.setPointerCapture(e.pointerId);
  const r = stick.getBoundingClientRect();
  stickCenter = { x: r.left + r.width/2, y: r.top + r.height/2 };
  stickVec = {x:0,y:0};
  setKnob(0,0);
});

stick.addEventListener('pointermove', (e)=>{
  if(!stickActive) return;
  const dx = e.clientX - stickCenter.x;
  const dy = e.clientY - stickCenter.y;
  const max = 34;
  const len = Math.hypot(dx,dy);
  const k = len>max ? max/len : 1;
  const vx = dx*k;
  const vy = dy*k;
  stickVec = { x: vx/max, y: vy/max };
  setKnob(vx, vy);
});

stick.addEventListener('pointerup', ()=>{
  stickActive = false;
  stickVec = {x:0,y:0};
  setKnob(0,0);
});

// Mobile look: drag on touchpad to rotate
let lookActive=false;
let lastLook={x:0,y:0};

touchpad.addEventListener('pointerdown', (e)=>{
  lookActive = true;
  touchpad.setPointerCapture(e.pointerId);
  lastLook = { x: e.clientX, y: e.clientY };
});

touchpad.addEventListener('pointermove', (e)=>{
  if(!lookActive) return;
  const dx = e.clientX - lastLook.x;
  const dy = e.clientY - lastLook.y;
  lastLook = { x: e.clientX, y: e.clientY };

  const s = 0.004;
  state.yaw -= dx * s;
  state.pitch -= dy * s;
  state.pitch = Math.max(-1.2, Math.min(1.2, state.pitch));
});

touchpad.addEventListener('pointerup', ()=>{ lookActive=false; });

function applyMobileLook(){
  camera.rotation.set(state.pitch, state.yaw, 0, 'YXZ');
}

// --- Raycast interact ---
const ray = new THREE.Raycaster();
const tmp = new THREE.Vector2();

function doInteract(){
  // if any panel is open, close first
  if(panelNotes.getAttribute('aria-hidden')==='false'){ closePanel(panelNotes); return; }
  if(panelInv.getAttribute('aria-hidden')==='false'){ closePanel(panelInv); return; }

  // ray from center
  tmp.set(0,0);
  ray.setFromCamera(tmp, camera);
  const hits = ray.intersectObjects(interactables.filter(m=>m.visible!==false), false);
  if(hits.length===0){ setMsg('沒有可互動物件'); return; }
  const obj = hits[0].object;
  const meta = obj.userData.meta;
  if(meta?.hint) setMsg(meta.label);
  if(meta?.can && !meta.can()) { setMsg('已完成'); return; }
  if(meta?.act) meta.act();
  if(meta?.hint) showHint(meta.hint);
  setObjectiveAuto();
  saveState();
}

function setObjectiveAuto(){
  if(!state.flags.foyerKey) return setObjective('目標：在玄關找可用的東西');
  if(!state.inv.includes('NOTE')) return setObjective('目標：到書房找線索');
  if(!state.flags.atticUnlocked) return setObjective('目標：推理閣樓門的開法');
  return setObjective('目標：深入閣樓');
}
setObjectiveAuto();

// --- Music (placeholder synth ambience, will be replaced by CC0 track) ---
let ac = null;
let musicOn = false;
let musicNodes = [];

function ensureAudio(){
  if(ac) return;
  try{ ac = new (window.AudioContext||window.webkitAudioContext)(); }
  catch { ac = null; }
}

function startMusic(){
  ensureAudio();
  if(!ac) return;
  const t0 = ac.currentTime;
  const master = ac.createGain();
  master.gain.value = 0.08;
  master.connect(ac.destination);

  // two detuned sines + slow LFO (mystery drone)
  const o1 = ac.createOscillator();
  const o2 = ac.createOscillator();
  o1.type = 'sine';
  o2.type = 'sine';
  o1.frequency.value = 110;
  o2.frequency.value = 111.6;

  const lfo = ac.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.08;
  const lfoGain = ac.createGain();
  lfoGain.gain.value = 18;

  const filt = ac.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = 520;
  filt.Q.value = 0.8;

  lfo.connect(lfoGain);
  lfoGain.connect(filt.frequency);

  o1.connect(filt);
  o2.connect(filt);
  filt.connect(master);

  o1.start(t0);
  o2.start(t0);
  lfo.start(t0);

  musicNodes = [o1,o2,lfo,master,filt,lfoGain];
}

function stopMusic(){
  if(!ac) return;
  for(const n of musicNodes){
    try{ if(n.stop) n.stop(); }catch{}
    try{ if(n.disconnect) n.disconnect(); }catch{}
  }
  musicNodes = [];
}

btnMute.addEventListener('click', ()=>{
  musicOn = !musicOn;
  if(musicOn){ startMusic(); setMsg('音樂：開'); }
  else { stopMusic(); setMsg('音樂：關'); }
});

// Try resume audio on first user gesture
window.addEventListener('pointerdown', ()=>{
  ensureAudio();
  if(ac && ac.state==='suspended') ac.resume();
},{ once:false });

// Restore player pos
if(saved?.player?.pos && Array.isArray(saved.player.pos)){
  camera.position.fromArray(saved.player.pos);
  state.yaw = saved.player.yaw || 0;
  state.pitch = saved.player.pitch || 0;
  applyMobileLook();
}

// --- Render loop ---
const clock = new THREE.Clock();

function clampPlayer(){
  // simple bounds to keep inside rooms (placeholder)
  camera.position.y = 1.6;
  camera.position.x = THREE.MathUtils.clamp(camera.position.x, -2.6, 2.6);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, -13.2, 6.2);
}

function step(dt){
  // Desktop pointer lock rotation handled by controls.
  if(!usePointerLock) applyMobileLook();

  // Movement vector
  const speed = 2.2;
  let mx=0, mz=0;

  if(usePointerLock){
    mx = (move.r - move.l);
    mz = (move.f - move.b);
  } else {
    // stickVec: y is down, so invert for forward
    mx = stickVec.x;
    mz = -stickVec.y;
  }

  dir.set(mx, 0, mz);
  if(dir.lengthSq() > 1e-6) dir.normalize();

  // Move in camera space
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0; forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0,1,0)).normalize();

  velocity.set(0,0,0);
  velocity.addScaledVector(forward, dir.z * speed * dt);
  velocity.addScaledVector(right, dir.x * speed * dt);
  camera.position.add(velocity);

  clampPlayer();

  if(flashT>0) flashT -= dt;
}

function drawOverlay(){
  if(flashT<=0) return;
  // draw a full-screen quad flash by setting clearColor temporarily (cheap)
  // Instead: use CSS? We'll keep minimal by flickering msg pill.
  msgEl.style.borderColor = `rgba(255,211,110,${0.2 + 0.5*(flashT/0.18)})`;
}

function animate(){
  const dt = Math.min(0.033, clock.getDelta());
  step(dt);
  renderer.render(scene, camera);
  drawOverlay();
  requestAnimationFrame(animate);
}
animate();

window.addEventListener('resize', ()=>{
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
});

setMsg(saved ? '存檔已載入' : '點一下畫面開始');
