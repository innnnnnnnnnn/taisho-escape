import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// --- UI ---
const $ = (s) => document.querySelector(s);
const canvas = $('#c');
const objectiveEl = $('#objective');
const msgEl = $('#msg');
const btnInteract = $('#btnInteract');
const btnNotes = $('#btnNotes');
const btnInv = $('#btnInv');
const btnMute = $('#btnMute');
const btnCredits = $('#btnCredits');
const btnReset = $('#btnReset');

const panelNotes = $('#panelNotes');
const panelInv = $('#panelInv');
const panelCredits = $('#panelCredits');
const closeNotes = $('#closeNotes');
const closeInv = $('#closeInv');
const closeCredits = $('#closeCredits');
const notesEl = $('#notes');
const invEl = $('#inv');

const hint = $('#hint');
const hintText = $('#hintText');
const hintClose = $('#hintClose');

const stick = $('#stick');
const knob = $('#knob');
const touchpad = $('#touchpad');

const STORAGE = 'taishoEscape:v0.2';

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
      musicOn,
    }));
  }catch{}
}

const state = {
  inv: [],
  sel: null,
  flags: {
    gotKey:false,
    gotNote:false,
    gotRope:false,
    gotHook:false,
    pulleyRigged:false,
    doorUnlatched:false,
    doorOpened:false,
  },
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

notesEl.addEventListener('input', saveState);

function setObjective(text){ objectiveEl.textContent = text; }
function setMsg(text){ msgEl.textContent = text; }
function showHint(text){ hintText.textContent = text; hint.setAttribute('aria-hidden','false'); }
function hideHint(){ hint.setAttribute('aria-hidden','true'); }

hintClose.addEventListener('click', hideHint);
hint.addEventListener('click', (e)=>{ if(e.target === hint) hideHint(); });

function openPanel(el){ el.setAttribute('aria-hidden','false'); }
function closePanel(el){ el.setAttribute('aria-hidden','true'); }

btnNotes.addEventListener('click', ()=> openPanel(panelNotes));
btnInv.addEventListener('click', ()=> { renderInv(); openPanel(panelInv); });
btnCredits.addEventListener('click', ()=> openPanel(panelCredits));
closeNotes.addEventListener('click', ()=> closePanel(panelNotes));
closeInv.addEventListener('click', ()=> closePanel(panelInv));
closeCredits.addEventListener('click', ()=> closePanel(panelCredits));

btnReset.addEventListener('click', ()=>{
  if(!confirm('重置存檔與進度？')) return;
  localStorage.removeItem(STORAGE);
  location.reload();
});

// --- Inventory ---
const ITEMS = {
  KEY:  { name:'銅鑰匙', desc:'沉重，鑰齒磨損不均。像是只開過同一個方向的門閂。' },
  NOTE: { name:'破碎便條', desc:'邊緣沾著粉塵。上面畫了「滑輪」與一段缺角的結構。' },
  ROPE: { name:'細繩', desc:'柔韌但強韌。摸起來像魚線混麻繩。' },
  HOOK: { name:'掛鉤', desc:'小而鋒利，可卡進木縫或金屬圈。' },
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

function has(id){ return state.inv.includes(id); }

// --- Simple SFX (web-audio beeps + clicks) ---
let ac = null;
function ensureAudio(){
  if(ac) return;
  try{ ac = new (window.AudioContext||window.webkitAudioContext)(); } catch { ac = null; }
}
function tick(freq=880, dur=0.04, gain=0.06, type='square'){
  if(!ac) return;
  const t0 = ac.currentTime;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0+0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
  o.connect(g).connect(ac.destination);
  o.start(t0);
  o.stop(t0+dur+0.02);
}
function sfxOK(){ tick(988); setTimeout(()=>tick(1319,0.06,0.05,'triangle'),35); }
function sfxBad(){ tick(220,0.06,0.05,'square'); setTimeout(()=>tick(180,0.08,0.05,'square'),45); }
function sfxDoor(){ tick(392,0.07,0.05,'sawtooth'); setTimeout(()=>tick(262,0.06,0.04,'triangle'),70); }
function sfxPickup(){ tick(1046,0.04,0.05,'triangle'); }

// --- Background Music (placeholder drone; will be replaced by CC0 file soon) ---
let musicOn = saved?.musicOn || false;
let musicNodes = [];

function startMusic(){
  ensureAudio();
  if(!ac) return;
  const t0 = ac.currentTime;
  const master = ac.createGain();
  master.gain.value = 0.06;
  master.connect(ac.destination);

  const o1 = ac.createOscillator();
  const o2 = ac.createOscillator();
  o1.type = 'sine';
  o2.type = 'sine';
  o1.frequency.value = 98;
  o2.frequency.value = 99.4;

  const lfo = ac.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.06;
  const lfoGain = ac.createGain();
  lfoGain.gain.value = 22;

  const filt = ac.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = 420;
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
  saveState();
});

window.addEventListener('pointerdown', ()=>{
  ensureAudio();
  if(ac && ac.state==='suspended') ac.resume();
  // auto-start music if enabled
  if(musicOn && musicNodes.length===0) startMusic();
}, { once:false });

// --- Three.js ---
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x070910, 0.1, 22);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.01, 120);
camera.position.set(0, 1.6, 3.2);

// Lights (will be dominated by HDR env)
const hemi = new THREE.HemisphereLight(0x8db4ff, 0x06060a, 0.35);
scene.add(hemi);
const keyLight = new THREE.DirectionalLight(0xffe2b6, 0.35);
keyLight.position.set(2, 5, 3);
scene.add(keyLight);

// Load HDRI (CC0 Poly Haven)
const pmrem = new THREE.PMREMGenerator(renderer);
new RGBELoader()
  .setPath('./assets/')
  .load('env_studio_small_09_1k.hdr', (tex)=>{
    const envMap = pmrem.fromEquirectangular(tex).texture;
    scene.environment = envMap;
    scene.background = new THREE.Color(0x070910);
    tex.dispose();
  });

// Load wood floor PBR (CC0 Poly Haven)
const tl = new THREE.TextureLoader();
const woodDiff = tl.load('./assets/wood_floor_deck_diff_1k.jpg');
woodDiff.colorSpace = THREE.SRGBColorSpace;
woodDiff.wrapS = woodDiff.wrapT = THREE.RepeatWrapping;
woodDiff.repeat.set(2,2);

const woodNor = tl.load('./assets/wood_floor_deck_nor_gl_1k.jpg');
woodNor.wrapS = woodNor.wrapT = THREE.RepeatWrapping;
woodNor.repeat.set(2,2);

const woodRough = tl.load('./assets/wood_floor_deck_rough_1k.jpg');
woodRough.wrapS = woodRough.wrapT = THREE.RepeatWrapping;
woodRough.repeat.set(2,2);

const matWall = new THREE.MeshStandardMaterial({ color: 0x111521, roughness: 0.92, metalness: 0.0 });
const matTatami = makeTatamiMaterial();
const matWoodFloor = new THREE.MeshStandardMaterial({
  map: woodDiff,
  normalMap: woodNor,
  roughnessMap: woodRough,
  roughness: 1.0,
  metalness: 0.0,
});

function makeTatamiMaterial(){
  // simple procedural tatami texture (placeholder until ambientCG tatami)
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#6d7a56';
  x.fillRect(0,0,256,256);
  x.globalAlpha = 0.16;
  x.fillStyle = '#2b2f24';
  for(let i=0;i<256;i+=4) x.fillRect(i,0,1,256);
  x.globalAlpha = 0.11;
  x.fillStyle = '#a9b58a';
  for(let i=0;i<256;i+=9) x.fillRect(0,i,256,1);
  x.globalAlpha = 1;
  x.fillStyle = '#2a2b31';
  x.fillRect(0,0,256,10);
  x.fillRect(0,246,256,10);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2,2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 1.0, metalness: 0.0 });
}

// --- Rooms ---
function addRoom({x,z,w,d,h=3, floor='tatami'}){
  const floorMat = floor==='wood' ? matWoodFloor : matTatami;
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat);
  floorMesh.rotation.x = -Math.PI/2;
  floorMesh.position.set(x, 0, z);
  scene.add(floorMesh);

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
}

// Foyer (tatami), Study (wood), Corridor/Locked room (wood)
addRoom({x:0, z:3, w:6, d:6, floor:'tatami'});
addRoom({x:0, z:-4, w:6, d:6, floor:'wood'});
addRoom({x:0, z:-11, w:6, d:6, floor:'wood'});

// Shoji vibe panels
const shojiMat = new THREE.MeshStandardMaterial({ color: 0xe7e1cf, roughness: 0.95, metalness: 0.0, emissive: 0x1a1a10, emissiveIntensity: 0.18 });
function addShoji(x,y,z,w=1.6,h=2.1,rotY=0){
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w,h), shojiMat);
  m.position.set(x,y,z);
  m.rotation.y = rotY;
  scene.add(m);
}
addShoji(-2.9,1.1, 2.2, 1.8,2.1, Math.PI/2);
addShoji( 2.9,1.1, 2.2, 1.8,2.1,-Math.PI/2);
addShoji(-2.9,1.1,-4.8, 1.8,2.1, Math.PI/2);
addShoji( 2.9,1.1,-4.8, 1.8,2.1,-Math.PI/2);

// --- Interactables ---
const interactables = [];
function addInteractable(mesh, meta){
  mesh.userData.meta = meta;
  scene.add(mesh);
  interactables.push(mesh);
}

function fail(why){ setMsg(`失敗：${why}`); sfxBad(); }
function ok(text){ setMsg(text); sfxOK(); }

// Key under rug (foyer)
{
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.9), new THREE.MeshStandardMaterial({ color: 0x1b2130, roughness: 1 }));
  rug.rotation.x = -Math.PI/2;
  rug.position.set(-1.6, 0.01, 4.6);
  scene.add(rug);

  const key = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.05, 0.08), new THREE.MeshStandardMaterial({ color: 0xffd36e, roughness: 0.3 }));
  key.position.set(-1.55, 0.03, 4.65);
  addInteractable(key, {
    label:'銅鑰匙',
    hint:'門邊的鎖孔太新，這把鑰匙太舊。但鑰齒的磨損…像只開過「門閂」，不是掛鎖。',
    can: () => !state.flags.gotKey,
    act: () => { state.flags.gotKey=true; addItem('KEY'); key.visible=false; sfxPickup(); }
  });
}

// Rope in corridor room (z -11)
{
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.6), new THREE.MeshStandardMaterial({ color: 0x202533, roughness: 0.95 }));
  box.position.set(-1.6, 0.35, -10.2);
  scene.add(box);

  const rope = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 10, 18), new THREE.MeshStandardMaterial({ color: 0xd7caa8, roughness: 1 }));
  rope.position.set(-1.55, 0.75, -10.25);
  rope.rotation.x = Math.PI/2;
  addInteractable(rope, {
    label:'細繩',
    hint:'繩面有細微刮痕——像是曾經穿過某個滑輪。',
    can: () => !state.flags.gotRope,
    act: () => { state.flags.gotRope=true; addItem('ROPE'); rope.visible=false; sfxPickup(); }
  });
}

// Hook in study drawer (z -4)
{
  const desk = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.8), new THREE.MeshStandardMaterial({ color: 0x2a2b31, roughness: 0.9 }));
  desk.position.set(1.4, 0.4, -3.6);
  scene.add(desk);

  const hook = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 0.03), new THREE.MeshStandardMaterial({ color: 0xb0b6c4, roughness: 0.6, metalness: 0.6 }));
  hook.position.set(1.1, 0.82, -3.55);
  addInteractable(hook, {
    label:'掛鉤',
    hint:'小得剛好。可以卡進木縫，也能勾住金屬圈。',
    can: () => !state.flags.gotHook,
    act: () => { state.flags.gotHook=true; addItem('HOOK'); hook.visible=false; sfxPickup(); }
  });

  const note = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.16), new THREE.MeshStandardMaterial({ color: 0x77d6ff, roughness: 0.6 }));
  note.position.set(1.55, 0.82, -3.65);
  addInteractable(note, {
    label:'破碎便條',
    hint:'「滑輪」畫得很細，但缺角那一段最像…天井。',
    can: () => !state.flags.gotNote,
    act: () => { state.flags.gotNote=true; addItem('NOTE'); note.visible=false; sfxPickup(); }
  });
}

// Pulley in ceiling near locked door (z -11)
let ropeLine = null;
{
  const pulley = new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.14,0.06,16), new THREE.MeshStandardMaterial({ color: 0x3a3f4f, roughness: 0.7, metalness: 0.7 }));
  pulley.position.set(0.9, 2.75, -12.0);
  pulley.rotation.z = Math.PI/2;
  addInteractable(pulley, {
    label:'天井滑輪',
    hint:'滑輪旁的木頭有新舊兩層磨損。有人最近才再次使用過它。',
    can: () => true,
    act: () => {
      if(state.flags.pulleyRigged){ ok('滑輪已裝好'); return; }
      if(!(has('ROPE') && has('HOOK'))) return fail('需要「細繩」與「掛鉤」');
      state.flags.pulleyRigged = true;
      ok('你把細繩穿過滑輪，掛鉤固定在木縫。');
      // create a visible rope line
      const pts = [
        new THREE.Vector3(pulley.position.x, pulley.position.y, pulley.position.z),
        new THREE.Vector3(0.9, 0.8, -11.0),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: 0xd7caa8 });
      ropeLine = new THREE.Line(geo, mat);
      scene.add(ropeLine);
      saveState();
    }
  });
}

// Locked door (mechanical latch)
{
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.2, 0.12), new THREE.MeshStandardMaterial({ color: 0x1b2230, roughness: 0.95 }));
  door.position.set(0, 1.1, -12.6);

  // latch indicator (small metal piece)
  const latch = new THREE.Mesh(new THREE.BoxGeometry(0.14,0.06,0.02), new THREE.MeshStandardMaterial({ color: 0xb0b6c4, roughness: 0.4, metalness: 0.8 }));
  latch.position.set(0.33, 1.05, -12.52);
  scene.add(latch);

  addInteractable(door, {
    label:'密室拉門',
    hint:'門閂不在門上。你聽到的那聲「咔哒」，更像是上方回彈。',
    can: () => true,
    act: () => {
      if(state.flags.doorOpened){ ok('門已開'); return; }
      if(!state.flags.pulleyRigged) return fail('門被門閂卡住：找機關');
      if(!state.flags.doorUnlatched){
        // Hard-core rule: require KEY + NOTE as justification before pulling
        if(!has('NOTE')) return fail('線索不足');
        if(!has('KEY')) return fail('缺少可操作的金屬');
        state.flags.doorUnlatched = true;
        ok('你用鑰匙當作小槓桿，反向拉動繩索：門閂鬆了。');
        sfxDoor();
        latch.position.x += 0.22;
        saveState();
        return;
      }
      // open door
      state.flags.doorOpened = true;
      ok('你推開門。');
      sfxDoor();
      door.position.z += 0.8;
      saveState();
    }
  });
}

// --- Controls (desktop + mobile) ---
const controls = new PointerLockControls(camera, document.body);
let usePointerLock = matchMedia('(pointer:fine)').matches;

let move = { f:0, b:0, l:0, r:0 };
let dir = new THREE.Vector3();
let velocity = new THREE.Vector3();

function onKey(e, down){
  if(e.code==='KeyW') move.f = down?1:0;
  if(e.code==='KeyS') move.b = down?1:0;
  if(e.code==='KeyA') move.l = down?1:0;
  if(e.code==='KeyD') move.r = down?1:0;
  if(e.code==='KeyE' && down) doInteract();
}
window.addEventListener('keydown', (e)=>onKey(e,true));
window.addEventListener('keyup', (e)=>onKey(e,false));

canvas.addEventListener('click', ()=>{
  if(usePointerLock){ controls.lock(); setMsg(''); }
});

btnInteract.addEventListener('click', doInteract);

// Mobile joystick
let stickActive = false;
let stickCenter = {x:0,y:0};
let stickVec = {x:0,y:0};
function setKnob(x,y){ knob.style.transform = `translate(${x}px, ${y}px)`; }

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

// Mobile look
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

function applyMobileLook(){ camera.rotation.set(state.pitch, state.yaw, 0, 'YXZ'); }

// Restore player
if(saved?.player?.pos && Array.isArray(saved.player.pos)){
  camera.position.fromArray(saved.player.pos);
  state.yaw = saved.player.yaw || 0;
  state.pitch = saved.player.pitch || 0;
  applyMobileLook();
}

// --- Raycast interact ---
const ray = new THREE.Raycaster();
const tmp2 = new THREE.Vector2();

function doInteract(){
  if(panelNotes.getAttribute('aria-hidden')==='false'){ closePanel(panelNotes); return; }
  if(panelInv.getAttribute('aria-hidden')==='false'){ closePanel(panelInv); return; }
  if(panelCredits.getAttribute('aria-hidden')==='false'){ closePanel(panelCredits); return; }

  tmp2.set(0,0);
  ray.setFromCamera(tmp2, camera);
  const hits = ray.intersectObjects(interactables.filter(m=>m.visible!==false), false);
  if(hits.length===0){ setMsg('沒有可互動物件'); sfxBad(); return; }
  const obj = hits[0].object;
  const meta = obj.userData.meta;
  if(meta?.label) setMsg(meta.label);
  if(meta?.act) meta.act();
  if(meta?.hint) showHint(meta.hint);
  setObjectiveAuto();
  saveState();
}

function setObjectiveAuto(){
  // objective pacing for first mechanical door puzzle
  if(!state.flags.gotKey) return setObjective('目標：在玄關找可用的東西');
  if(!state.flags.gotNote) return setObjective('目標：到書房找線索');
  if(!state.flags.gotHook) return setObjective('目標：找能固定繩索的東西');
  if(!state.flags.gotRope) return setObjective('目標：去倉庫找繩子');
  if(!state.flags.pulleyRigged) return setObjective('目標：把繩子裝上天井滑輪');
  if(!state.flags.doorUnlatched) return setObjective('目標：反向解除門閂');
  if(!state.flags.doorOpened) return setObjective('目標：推開門');
  return setObjective('目標：進入下一區域（未完待續）');
}
setObjectiveAuto();

// --- Loop ---
const clock = new THREE.Clock();

function clampPlayer(){
  camera.position.y = 1.6;
  camera.position.x = THREE.MathUtils.clamp(camera.position.x, -2.6, 2.6);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, -13.6, 6.2);
}

function step(dt){
  if(!usePointerLock) applyMobileLook();

  const speed = 2.2;
  let mx=0, mz=0;
  if(usePointerLock){
    mx = (move.r - move.l);
    mz = (move.f - move.b);
  } else {
    mx = stickVec.x;
    mz = -stickVec.y;
  }

  dir.set(mx, 0, mz);
  if(dir.lengthSq() > 1e-6) dir.normalize();

  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0; forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0,1,0)).normalize();

  velocity.set(0,0,0);
  velocity.addScaledVector(forward, dir.z * speed * dt);
  velocity.addScaledVector(right, dir.x * speed * dt);
  camera.position.add(velocity);

  clampPlayer();
}

function animate(){
  const dt = Math.min(0.033, clock.getDelta());
  step(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

window.addEventListener('resize', ()=>{
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
});

setMsg(saved ? '存檔已載入' : '點一下畫面開始');
if(musicOn) startMusic();
