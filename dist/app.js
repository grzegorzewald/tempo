const $=id=>document.getElementById(id);let saved={};try{saved=JSON.parse(localStorage.getItem('tempo-settings')||'{}');if(!saved||typeof saved!=='object'||Array.isArray(saved))saved={}}catch{}const valid=(v,f,max=3599)=>Number.isFinite(+v)&&+v>=1?Math.min(max,Math.round(+v)):f;let mode=saved.mode==='mmom'?'mmom':'interval',work=valid(saved.work,40),rest=valid(saved.rest,20),minutes=valid(saved.minutes,10,999),muted=!!saved.muted,presets=[];try{presets=JSON.parse(localStorage.getItem('tempo-presets')||'[]').filter(p=>p&&Number.isInteger(p.work)&&p.work>0&&p.work<=3599&&Number.isInteger(p.rest)&&p.rest>0&&p.rest<=3599).slice(0,16)}catch{}
let running=false,phase='work',cycle=1,remaining=mode==='mmom'?60000:work*1000,deadline=0,lastSecond=null,finished=false,audio,wakeLock,installPrompt;
function toast(t){$('toast').textContent=t;$('toast').style.opacity=1;clearTimeout(toast.t);toast.t=setTimeout(()=>$('toast').style.opacity=0,3000)}function persist(){try{localStorage.setItem('tempo-settings',JSON.stringify({mode,work,rest,minutes,muted}))}catch{toast(t('Pamięć urządzenia jest niedostępna.'))}}function fmt(s){s=Math.max(0,Math.ceil(s));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}function duration(){return mode==='mmom'?60000:(phase==='work'?work:rest)*1000}
// Prime both playback paths synchronously inside the user's tap. Older iOS
// needs a media playback session; newer Safari exposes audioSession directly.
let audioSessionElement, audioWarningShown=false;
function audioWarning(){if(!muted&&!audioWarningShown){audioWarningShown=true;toast(t('Nie można uruchomić dźwięku. Dotknij ikony dźwięku, aby spróbować ponownie.'))}}
function unlock(){
  if(muted)return;
  try{
    if(navigator.audioSession)navigator.audioSession.type='playback';
    if(!audio||audio.state==='closed')audio=new(window.AudioContext||window.webkitAudioContext)();
    if(audio.state!=='running')audio.resume().catch(audioWarning);
    // A source must actually start during the gesture, before awaiting resume().
    const source=audio.createBufferSource();source.buffer=audio.createBuffer(1,1,audio.sampleRate);source.connect(audio.destination);source.start(0);
    if(!audioSessionElement){audioSessionElement=new Audio('./audio-session.wav');audioSessionElement.loop=true;audioSessionElement.preload='auto';audioSessionElement.setAttribute('playsinline','');}
    audioSessionElement.play()?.catch(()=>{if(audio?.state!=='running')audioWarning()});
  }catch{audioWarning()}
}
function stopAudioSession(){if(audioSessionElement)audioSessionElement.pause()}
function beep(long=false){
  if(muted||!audio)return;
  if(audio.state!=='running')audio.resume().catch(audioWarning);
  try{
    const o=audio.createOscillator(),g=audio.createGain(),time=audio.currentTime;
    const duration=long?1:.2,fade=.03;
    o.frequency.value=long?800:1000;
    // Hold the louder tone before a short fade so the final beep stays audible.
    g.gain.setValueAtTime(0,time);
    g.gain.linearRampToValueAtTime(.8,time+.01);
    g.gain.setValueAtTime(.8,time+duration-fade);
    g.gain.linearRampToValueAtTime(0,time+duration);
    o.connect(g);g.connect(audio.destination);
    o.onended=()=>{o.disconnect();g.disconnect()};
    o.start(time);o.stop(time+duration);
  }catch{audioWarning()}
}
async function lock(){try{if('wakeLock'in navigator&&running)wakeLock=await navigator.wakeLock.request('screen')}catch{}}function release(){stopAudioSession();if(wakeLock){wakeLock.release().catch(()=>{});wakeLock=null}}
function render(){document.body.classList.toggle('rest',phase==='rest'&&mode==='interval');$('digits').textContent=fmt(remaining/1000);$('phase').textContent=finished?t('KONIEC'):mode==='mmom'?'EMoM':phase==='work'?t('PRACA'):t('PRZERWA');$('cycle').textContent=String(cycle).padStart(2,'0');$('cycleTotal').textContent=mode==='mmom'?' / '+minutes:' / ∞';$('status').textContent=finished?t('● TRENING UKOŃCZONY'):running?t('● TRENING TRWA'):remaining===duration()&&cycle===1?t('● GOTOWY DO STARTU'):t('● PAUZA');$('start').innerHTML=running?t('<span>Ⅱ</span> Pauza'):finished?t('<span>↺</span> Jeszcze raz'):'<span>▶</span> '+(remaining===duration()&&cycle===1?t('Rozpocznij'):t('Kontynuuj'));$('start').setAttribute('aria-label',$('start').textContent.trim());$('start').title=$('start').textContent.trim();$('progress').style.width=Math.min(100,remaining/duration()*100)+'%';$('next').innerHTML=mode==='mmom'?(finished?t('DOBRA ROBOTA'):cycle===minutes?t('NASTĘPNIE <b>KONIEC TRENINGU</b>'):t('NASTĘPNIE <b>MINUTA ')+(cycle+1)+' · 01:00</b>'):t('NASTĘPNIE <b>')+(phase==='work'?t('PRZERWA · ')+fmt(rest):t('PRACA · ')+fmt(work))+'</b>';$('modeLabel').textContent=mode==='mmom'?t('MINUTA PO MINUCIE'):t('INTERWAŁY');document.title=(running?fmt(remaining/1000)+' · ':'')+t('TEMPO — Timer treningowy');document.querySelectorAll('.fields input,.fields button,.tabs button,#presetList button:not(.delete)').forEach(b=>b.disabled=running)}
function reset(){running=false;finished=false;phase='work';cycle=1;remaining=mode==='mmom'?60000:work*1000;lastSecond=null;release();render()}function tick(){if(!running)return;const now=performance.now();remaining=deadline-now;let transitions=0;while(remaining<=0&&running){transitions++;if(mode==='mmom'){if(cycle>=minutes){remaining=0;running=false;finished=true;release();break}cycle++}else if(phase==='work')phase='rest';else{phase='work';cycle++}deadline+=duration();remaining=deadline-now;lastSecond=null}if(transitions)beep(true);const sec=Math.ceil(remaining/1000);if(running&&sec!==lastSecond){if(sec>=1&&sec<=4&&!transitions)beep();lastSecond=sec}render()}
$('start').onclick=()=>{if(running){tick();running=false;release();render();return}if(finished)reset();audioWarningShown=false;unlock();beep();deadline=performance.now()+remaining;lastSecond=null;running=true;lock();tick()};$(t('reset')).onclick=reset;
function sync(){$('work').value=work;$('rest').value=rest;$('minutes').value=minutes;for(const m of ['interval','mmom']){$(m).classList.toggle('active',mode===m);$(m).setAttribute('aria-selected',mode===m)}$('intervalSettings').hidden=mode!=='interval';$('mmomSettings').hidden=mode!=='mmom';$('modeDesc').textContent=mode==='interval'?t('Praca i odpoczynek. W Twoim tempie.'):t('Nowa minuta. Nowy początek.');$('save').style.display=mode==='mmom'?'none':'flex';$('presets').hidden=mode==='mmom';$('sound').textContent=muted?'♪̸':'♫';$('sound').setAttribute('aria-label',muted?t('Włącz dźwięk'):t('Wyłącz dźwięk'));render()}
for(const m of ['interval','mmom'])$(m).onclick=()=>{mode=m;persist();reset();sync()};function change(id,v){if(running)return;const n=valid(v,id==='work'?work:id==='rest'?rest:minutes,id==='minutes'?999:3599);if(id==='work')work=n;else if(id==='rest')rest=n;else minutes=n;persist();reset();sync()}for(const id of ['work','rest','minutes'])$(id).onchange=e=>change(id,e.target.value);document.querySelectorAll('[data-field]').forEach(b=>b.onclick=()=>change(b.dataset.field,+$(b.dataset.field).value+ +b.dataset.delta));
function storePresets(){try{localStorage.setItem('tempo-presets',JSON.stringify(presets));return true}catch{toast(t('Nie można zapisać ustawień.'));return false}}function renderPresets(){$('presetCount').textContent=presets.length+' / 16';$('presetList').replaceChildren();if(!presets.length){const p=document.createElement('p');p.className='empty';p.textContent=t('Zapisz pierwszy rytm swojego treningu.');$('presetList').append(p)}presets.forEach((p,i)=>{const div=document.createElement('div');div.className='preset';const load=document.createElement('button');load.textContent=String(p.work).padStart(2,'0')+'-'+String(p.rest).padStart(2,'0');load.title=t('Wczytaj ')+p.work+t(' s pracy i ')+p.rest+t(' s przerwy');load.onclick=()=>{work=p.work;rest=p.rest;mode='interval';persist();reset();sync();toast(t('Ustawienia wczytane'))};const del=document.createElement('button');del.className='delete';del.textContent='×';del.setAttribute('aria-label',t('Usuń preset ')+load.textContent);del.onclick=()=>{const old=[...presets];presets.splice(i,1);if(!storePresets())presets=old;renderPresets()};div.append(load,del);$('presetList').append(div)});render()}
$('save').onclick=()=>{if(presets.some(p=>p.work===work&&p.rest===rest)){toast(t('Te ustawienia są już zapisane.'));$('presets').open=true;return}if(presets.length>=16){toast(t('Limit 16 ustawień. Usuń jeden z presetów.'));$('presets').open=true;return}presets.push({work,rest});if(!storePresets()){presets.pop();return}renderPresets();$('presets').open=true;toast(t('Zapamiętano ')+work+'-'+rest)};$('sound').onclick=()=>{muted=!muted;persist();audioWarningShown=false;if(muted)stopAudioSession();else{unlock();beep();if(!running)setTimeout(()=>{if(!running)stopAudioSession()},800)}sync()};$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast(t('Pełny ekran jest dostępny po instalacji aplikacji.'))}catch{toast(t('Pełny ekran jest niedostępny w tej przeglądarce.'))}};
function clock(){$('clock').textContent=new Date().toLocaleTimeString(browserLocale,{hour:'2-digit',minute:'2-digit'});$('clock').dateTime=new Date().toISOString()}document.addEventListener('keydown',e=>{if(/INPUT|BUTTON|SUMMARY/.test(e.target.tagName)||$('installHelp').open||$('settingsDialog').open||$('aboutDialog').open)return;if(e.code==='Space'){e.preventDefault();$('start').click()}if(e.key.toLowerCase()==='r')reset()});document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(running)unlock();tick();lock()}});window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e});$('install').onclick=async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null}else $('installHelp').showModal()};$('closeHelp').onclick=()=>$('installHelp').close();if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(()=>{$('offlineInfo').textContent=t('Timer został przygotowany do pracy offline.')}).catch(()=>{$('offlineInfo').textContent=t('Tryb offline jest niedostępny w tej przeglądarce.')});setInterval(tick,80);setInterval(clock,1000);clock();sync();renderPresets();

function closeSettings(){$('settingsDialog').close();$('settingsOpen').focus()}
$('settingsOpen').onclick=()=>$('settingsDialog').showModal();
$('settingsClose').onclick=closeSettings;
$('settingsDone').onclick=closeSettings;
$('settingsDialog').addEventListener('click',e=>{if(e.target===$('settingsDialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeSettings()}});

// A tap also restores audio after an OS interruption or route change.
document.addEventListener('pointerdown',()=>{if(running&&!muted&&audio?.state!=='running')unlock()},{passive:true});

// Keep the displayed version in sync with the release-managed JSON, also offline.
fetch('./app-metadata.json').then(response=>{
  if(!response.ok)throw new Error('Version unavailable');
  return response.json();
}).then(data=>{
  if(typeof data.version!=='string'||!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(data.version))throw new Error('Invalid version');
  $('appVersion').textContent=data.version;
  for(const [id,key] of [['repositoryLink','repository'],['pagesLink','homepage'],['issuesLink','bugs']]){
    const url=new URL(data[key]);
    if(url.protocol!=='https:'&&url.protocol!=='http:')throw new Error('Invalid project URL');
    $(id).href=url.href;
  }
}).catch(()=>{$('appVersion').textContent=t('Wersja niedostępna')});
$('aboutOpen').onclick=()=>$('aboutDialog').showModal();
$('aboutClose').onclick=()=>$('aboutDialog').close();
$('aboutDialog').addEventListener('close',()=>$('aboutOpen').focus());
$('aboutDialog').addEventListener('click',e=>{
  if(e.target!==$('aboutDialog'))return;
  const r=e.target.getBoundingClientRect();
  if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('aboutDialog').close();
});
