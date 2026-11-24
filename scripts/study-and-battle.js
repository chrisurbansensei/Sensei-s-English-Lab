const WB=(id)=>document.getElementById(id);
const WB_COUNTS={B1:739,B2:771,both:1510};
let wbPool='both',wbTab='browse',wbPage=0,wbFiltered=[],wbTimer=0;
let wbRound=[],wbIndex=0,wbStage='none',wbMisses=0,wbFirstTry=0;
const WF_SPELLING_EQUIVALENTS={"behavior":"behaviour","behaviour":"behavior","behaviors":"behaviours","behaviours":"behaviors","misbehavior":"misbehaviour","misbehaviour":"misbehavior","favor":"favour","favour":"favor","favorable":"favourable","favourable":"favorable","favorably":"favourably","favourably":"favorably","favored":"favoured","favoured":"favored","favoring":"favouring","favouring":"favoring","favorite":"favourite","favourite":"favorite","favoritism":"favouritism","favouritism":"favoritism","favors":"favours","favours":"favors","unfavorable":"unfavourable","unfavourable":"unfavorable","unfavorably":"unfavourably","unfavourably":"unfavorably","industrialisation":"industrialization","industrialization":"industrialisation","industrialise":"industrialize","industrialize":"industrialise","industrialised":"industrialized","industrialized":"industrialised","industrialises":"industrializes","industrializes":"industrialises","industrialising":"industrializing","industrializing":"industrialising","labeled":"labelled","labelled":"labeled","labeling":"labelling","labelling":"labeling","unlabeled":"unlabelled","unlabelled":"unlabeled","pressurise":"pressurize","pressurize":"pressurise","pressurised":"pressurized","pressurized":"pressurised","pressurises":"pressurizes","pressurizes":"pressurises","pressurising":"pressurizing","pressurizing":"pressurising","prioritise":"prioritize","prioritize":"prioritise","prioritised":"prioritized","prioritized":"prioritised","prioritises":"prioritizes","prioritizes":"prioritises","prioritising":"prioritizing","prioritizing":"prioritising","recognisably":"recognizably","recognizably":"recognisably","recognise":"recognize","recognize":"recognise","recognised":"recognized","recognized":"recognised","recognises":"recognizes","recognizes":"recognises","recognising":"recognizing","recognizing":"recognising","specialise":"specialize","specialize":"specialise","specialised":"specialized","specialized":"specialised","specialises":"specializes","specializes":"specialises","specialising":"specializing","specializing":"specialising"};
const wbLetters=(s)=>String(s||'').trim().toLowerCase();
function wbActive(){return WB_FORMS.filter(r=>!r.exclude_from_study&&(wbPool==='both'||r.level===wbPool)&&(!WB('wbSearch').value.trim()||[r.word,r.lemma,r.study_family,r.derivational_branch,r.meaning_note,r.part_of_speech,r.grammatical_function].some(v=>wbLetters(v).includes(wbLetters(WB('wbSearch').value)))));}
function wbClear(el){el.replaceChildren();}
function wbElt(tag,text,klass){let el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(klass)el.className=klass;return el;}
function wbDefinition(word){const def=WB_DEFS[wbLetters(word)];WB('wbDefinition').textContent=def?word+' — '+def:word+' — The source bank has not yet recorded a checked definition for this form.';}
function wbSetPool(pool){clearTimeout(wbTimer);wbPool=pool;document.querySelectorAll('[data-bank-pool]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.bankPool===pool)));wbPage=0;wbRound=[];wbStage='none';WB('wbCardZone').classList.add('hidden');wbRender();}
function wbGroupName(r){if(r.meaning_note)return (r.derivational_branch||'Related meanings')+' — '+r.part_of_speech;const c=wbLetters(r.part_of_speech);return c==='noun'?'Nouns':c==='adjective'?'Adjectives':c==='adverb'?'Adverbs':c==='verb'?'Verbs':c==='negative'?'Negative forms':c==='exam answer'?'Attested exam answers':c==='exam base'?'Exam starting words':String(r.part_of_speech||'Other forms');}
function wbRender(){
 wbFiltered=wbActive();
 const families=new Map();
 for(const r of wbFiltered){const key=wbLetters(r.study_family||r.lemma);if(!families.has(key))families.set(key,[]);families.get(key).push(r);}
 const keys=[...families.keys()].sort((a,b)=>a.localeCompare(b,'en'));const max=Math.max(1,Math.ceil(keys.length/12));wbPage=Math.min(wbPage,max-1);
 const stat=WB('wbStats');wbClear(stat);
 for(const txt of [`${keys.length} study families available`,wbPool==='both'?'B1 + B2':wbPool+' only',`${wbFiltered.filter(r=>r.origin==='official_answer').length} exam-answer records`])stat.append(wbElt('span',txt,'wb-stat'));
 const out=WB('wbFamilyCards');wbClear(out);
 for(const base of keys.slice(wbPage*12,wbPage*12+12)){
  const rs=families.get(base);const card=wbElt('article',undefined,'wb-family');const head=wbElt('div',undefined,'wb-familyhead');head.append(wbElt('h3',base),wbElt('span',[...new Set(rs.map(r=>r.level))].sort().join(' + '),'wb-levels'));card.append(head);
  const groups=new Map();for(const r of rs){const g=wbGroupName(r);if(!groups.has(g))groups.set(g,[]);groups.get(g).push(r)}
  for(const [cat,records] of groups){const line=wbElt('div',undefined,'wb-familyrow');line.append(wbElt('strong',cat));const content=wbElt('div',undefined,'wb-forms');
   const unique=new Map();for(const r of records){const key=wbLetters(r.word);if(!unique.has(key))unique.set(key,[]);unique.get(key).push(r)}
   let i=0;for(const [w,records2] of unique){if(i++)content.append(document.createTextNode(' · '));const b=wbElt('button',records2[0].word,'wb-word');b.type='button';b.title=[WB_DEFS[w]||'Click for details',records2[0].meaning_note].filter(Boolean).join(' — ');b.setAttribute('aria-label',records2[0].word+(records2.some(r=>r.origin==='official_answer')?' — exam-attested answer':''));if(records2.some(r=>r.origin==='official_answer'))b.classList.add('wb-exam');b.addEventListener('click',()=>wbDefinition(records2[0].word));b.addEventListener('focus',()=>wbDefinition(records2[0].word));content.append(b)}line.append(content);card.append(line)
  }out.append(card);
 }
 WB('wbPageLabel').textContent=`Families ${keys.length?wbPage*12+1:0}–${Math.min((wbPage+1)*12,keys.length)} of ${keys.length}`;
 WB('wbPrev').disabled=wbPage===0;WB('wbNext').disabled=wbPage>=max-1;
 if(!keys.length)out.append(wbElt('p','No matching word families. Try a different search.'));
}
function wbSwitchTab(tab){wbTab=tab;WB('wbBrowse').classList.toggle('hidden',tab!=='browse');WB('wbRecall').classList.toggle('hidden',tab!=='recall');WB('wbTabBrowse').classList.toggle('active',tab==='browse');WB('wbTabRecall').classList.toggle('active',tab==='recall');WB('wbTabBrowse').setAttribute('aria-pressed',String(tab==='browse'));WB('wbTabRecall').setAttribute('aria-pressed',String(tab==='recall'));}
function wbSample(){let a=[...wbFiltered];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}const n=WB('wbCount').value==='all'?a.length:Number(WB('wbCount').value);return a.slice(0,n);}
function wbStart(){clearTimeout(wbTimer);wbRender();wbRound=wbSample();wbIndex=0;wbMisses=0;wbFirstTry=0;if(!wbRound.length){WB('wbDefinition').textContent='No matching forms to practise. Try changing the search or B1/B2 pool.';return;}WB('wbCardZone').classList.remove('hidden');wbDisplay();WB('wbCardZone').scrollIntoView({behavior:'smooth',block:'start'});}
function wbDisplay(){clearTimeout(wbTimer);if(wbIndex>=wbRound.length){wbStage='done';WB('wbCardProgress').textContent='Round complete';WB('wbCardSource').textContent=wbPool==='both'?'B1 + B2':wbPool;WB('wbCardBase').textContent='Training complete! 🥋';WB('wbCardPart').textContent='You can choose another vocabulary pool or begin a new round.';WB('wbCardWord').textContent='🌟';WB('wbCardPrompt').textContent=`${wbFirstTry} of ${wbRound.length} cards recalled on your first try.`;WB('wbCardAnswer').classList.add('hidden');WB('wbHide').classList.add('hidden');WB('wbSkip').classList.add('hidden');WB('wbCardFeedback').textContent='Great work! Practice is saved only during this browser session.';return;}
 const r=wbRound[wbIndex];wbMisses=0;wbStage='study';WB('wbCardProgress').textContent=`Card ${wbIndex+1} / ${wbRound.length}`;WB('wbCardSource').textContent=r.level+' word bank';WB('wbCardBase').textContent=r.study_family||r.lemma;WB('wbCardPart').textContent=(r.derivational_branch||wbGroupName(r))+' · '+(r.origin==='official_answer'?'Exam-attested answer':'Study-bank form');WB('wbCardWord').textContent=r.word;WB('wbCardPrompt').textContent='Read the word, notice its spelling, then hide it and try to remember it.';WB('wbCardAnswer').classList.add('hidden');WB('wbRecallInput').value='';WB('wbCardFeedback').textContent='';WB('wbHide').classList.remove('hidden');WB('wbSkip').classList.add('hidden');}
function wbHide(){wbStage='type';WB('wbCardWord').textContent='•••••';WB('wbCardPrompt').textContent='Write the form you just studied.';WB('wbCardAnswer').classList.remove('hidden');WB('wbHide').classList.add('hidden');WB('wbSkip').classList.remove('hidden');WB('wbRecallInput').focus()}
function wbCheck(){if(wbStage!=='type'&&wbStage!=='correct')return;const r=wbRound[wbIndex];const typed=wbLetters(WB('wbRecallInput').value);if(!typed)return;
 if(typed===wbLetters(r.word)||typed===WF_SPELLING_EQUIVALENTS[wbLetters(r.word)]||SenseiSpellings.matchesStudy(typed,r.word,r)){if(!wbMisses)wbFirstTry++;const variantAccepted=typed!==wbLetters(r.word);WB('wbCardFeedback').textContent=variantAccepted?`Correct! Both ${r.word} and ${typed} are accepted spellings. 🌍`:(wbMisses?'Good recovery! You corrected the spelling.':'Excellent! You remembered the word! 🔥');WB('wbCardWord').textContent=r.word;wbStage='feedback';WB('wbCardAnswer').classList.add('hidden');WB('wbSkip').classList.add('hidden');wbTimer=setTimeout(()=>{wbIndex++;wbDisplay()},wbMisses?1600:1200);return;}
 wbMisses++;if(wbMisses===1){WB('wbCardFeedback').textContent='Almost! Check the spelling. It starts with “'+r.word.charAt(0)+'” and has '+r.word.length+' characters.';}
 else {wbStage='correct';WB('wbCardWord').textContent=r.word;WB('wbCardFeedback').textContent='Study the correct form above, then type it accurately to continue.';WB('wbCardPrompt').textContent='Learning includes correcting your own mistakes.';WB('wbSkip').classList.add('hidden');}WB('wbRecallInput').select();}
function wbReveal(){if(wbStage!=='type')return;wbMisses=Math.max(wbMisses,2);wbStage='correct';const r=wbRound[wbIndex];WB('wbCardWord').textContent=r.word;WB('wbCardFeedback').textContent='Read the form, then type it correctly before moving on.';WB('wbCardPrompt').textContent='Take another look at the spelling.';WB('wbSkip').classList.add('hidden');WB('wbRecallInput').focus();}
if(WB('bankBtn'))WB('bankBtn').addEventListener('click',()=>{const active=document.querySelector('[data-pool][aria-pressed="true"]');wbSetPool(active?.dataset.pool||'both');wbSwitchTab('browse');show('bankView');window.scrollTo({top:0,behavior:'smooth'})});
WB('bankBack').addEventListener('click',()=>{clearTimeout(wbTimer);show('setup')});
document.querySelectorAll('[data-bank-pool]').forEach(b=>b.addEventListener('click',()=>wbSetPool(b.dataset.bankPool)));
WB('wbSearch').addEventListener('input',()=>{clearTimeout(wbTimer);wbPage=0;wbRound=[];WB('wbCardZone').classList.add('hidden');wbRender()});
WB('wbPrev').addEventListener('click',()=>{wbPage=Math.max(0,wbPage-1);wbRender()});WB('wbNext').addEventListener('click',()=>{wbPage++;wbRender()});
WB('wbTabBrowse').addEventListener('click',()=>wbSwitchTab('browse'));WB('wbTabRecall').addEventListener('click',()=>wbSwitchTab('recall'));
WB('wbStart').addEventListener('click',wbStart);WB('wbHide').addEventListener('click',wbHide);WB('wbSkip').addEventListener('click',wbReveal);WB('wbRecallCheck').addEventListener('click',wbCheck);
WB('wbRecallInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();wbCheck()}});

// Populate the ten-second word-family guide for ALL B1/B2 families from the embedded corpus.
// Keep manually curated family groups in place; add missing families and genuine imported forms.
(function v54HydrateFamilyAtlas(){
 const categoryFor=r=>{
   const pos=String(r.part_of_speech||'').toLowerCase();const fn=String(r.grammatical_function||'').toLowerCase();
   if(pos==='noun')return 'Nouns';if(pos==='adjective')return 'Adjectives';if(pos==='adverb')return 'Adverbs';if(pos==='verb')return 'Verbs';if(pos==='negative')return 'Negative forms';
   if(/participle|gerund|\-ing/.test(fn))return '-ing forms';return null;
 };
 for(const r of WB_FORMS){const root=String(r.study_family||r.lemma||'').toLowerCase(),word=String(r.word||'').trim();if(!root||!word)continue;
   if(!FAMILIES[root])FAMILIES[root]={};const type=categoryFor(r);
   if(!type)continue;if(!FAMILIES[root][type])FAMILIES[root][type]=[];
   if(!FAMILIES[root][type].some(x=>x.toLowerCase()===word.toLowerCase())&&FAMILIES[root][type].length<28)FAMILIES[root][type].push(word);
   if((r.grammatical_function||'').toLowerCase().includes('negative')&&FAMILIES[root]['Negative forms']?.length<12){const arr=FAMILIES[root]['Negative forms']||(FAMILIES[root]['Negative forms']=[]);if(!arr.includes(word))arr.push(word);}
 }
  for(const f of Object.values(FAMILIES)){
    if(f['-ing forms']){f['-ing forms']=f['-ing forms'].filter(w=>/ing$/i.test(w));if(!f['-ing forms'].length)delete f['-ing forms'];}
    delete f['Other forms'];
  }
})();

wbSetPool('both');

// V6_4: main vocabulary game => cinematic end-battle integration
const V64Shield={pending:false};
const V64Combat={active:false,shown:false,iframe:null,damagePending:0,damageTimer:0,reason:'goal',loadToken:0};
function v64RenderHp(){
 const panel=document.getElementById('v64HPParts');if(!panel)return;
 const capacity=(V54_DIFFICULTY[V54.difficulty]??3)+1;
 const spent=Math.min(capacity,Math.max(0,V54.failures));
 panel.replaceChildren();for(let i=0;i<capacity;i++){const div=document.createElement('span');div.className='hp-part'+(i<spent?' lost':'');div.title=`HP ${i+1}`;panel.append(div)}
 const remaining=Math.max(0,capacity-spent);
 document.getElementById('v64HPLabel').textContent=`${remaining} / ${capacity} HP · ${game.shields} 🛡️`;const finisherHint=document.getElementById('v65FinisherHint');if(finisherHint)finisherHint.textContent=`🐉 Mizoryo attacks only at 0 HP · 🏆 ${Math.max(0,V54.winTarget-V54.wins)} wins until graduation`;
}
function v64HitNotice(message){
 const element=document.getElementById('v64HitMessage');element.textContent=message;element.classList.add('show');
 clearTimeout(V64Combat.damageTimer);V64Combat.damageTimer=setTimeout(()=>element.classList.remove('show'),1500);
}

// V6_6: cinematic per-mistake reactions share the same rigged battle scene.
const V65Strike={active:false,count:0,pending:null,ko:false,frameToken:0,session:0};
function v65QueueStrike(blocked){
 if(V64Combat.active || V65Strike.active)return;
 const sequence=['wind','sweep','throw'];
 const type=sequence[V65Strike.count%sequence.length];V65Strike.count++;
 const capacity=(V54_DIFFICULTY[V54.difficulty]??3)+1;
 const ko=false; // final HP never uses a generic K.O.; it always opens Mizoryo
 V65Strike.pending={type,blocked,ko};
 v65OpenStrike();
}
function v65OpenStrike(){
 if(!V65Strike.pending||V65Strike.active||V64Combat.active)return;
 const clip=V65Strike.pending;V65Strike.active=true;V65Strike.session=game.cycle;V65Strike.frameToken++;
 const frame=document.getElementById('v64BattleFrame'),layer=document.getElementById('v64BattleOverlay');
 const token=V65Strike.frameToken;layer.hidden=false;
 frame.addEventListener('load',()=>{
   if(!V65Strike.active||token!==V65Strike.frameToken||game.cycle!==V65Strike.session)return;
   frame.contentWindow.postMessage({source:'WF_DOJO_V64_HOST',kind:'strike',attack:clip.type,blocked:clip.blocked,ko:clip.ko,maxHp:(V54_DIFFICULTY[V54.difficulty]??3)+1,hp:Math.max(0,(V54_DIFFICULTY[V54.difficulty]??3)+1-V54.failures-V64Combat.damagePending)},'*');
 },{once:true});
 frame.src=V67_BATTLE_URL;
}
function v65FinishStrike(event){
 if(!V65Strike.active || event.source!==document.getElementById('v64BattleFrame').contentWindow || event.data?.source!=='WF_DOJO_V64' || event.data.kind!=='strike-finished')return;
 V65Strike.active=false;V65Strike.pending=null;V65Strike.ko=false;
 const layer=document.getElementById('v64BattleOverlay');layer.hidden=true;
 const frame=document.getElementById('v64BattleFrame');setTimeout(()=>{if(!V65Strike.active&&!V64Combat.active)frame.src='about:blank';},350);
 if(game.phase==='active'){
  const typed=document.getElementById('typed');if(typed&&!typed.disabled&&!typed.classList.contains('hidden'))typed.focus();
 }
}
window.addEventListener('message',v65FinishStrike);

function v64OnFirstMistake(){
 // The Magic Shield is an exclusive final-dragon defence and cannot block this attack.
 v64HitNotice('⚔️ A strike landed! One HP segment lost.');
 v64RenderHp();v65QueueStrike(false);
}
const v64OriginalProcessCompletion=v54ProcessCompletion;
// Hook named completion while preserving all existing answer/recovery logic.
// The original code calls the declared function directly, so integrate through its tail below.
function v64ShowShieldClaim(){
 if(!V64Shield.pending){v54Resume();return;}
 document.getElementById('v64RewardOverlay').hidden=false;
 const btn=document.getElementById('v64ClaimButton');btn.focus();
}
document.getElementById('v64ClaimButton').addEventListener('click',()=>{
 if(!V64Shield.pending)return;V64Shield.pending=false;
 game.shields=Math.max(0,Math.min(1,game.shields+1));
 sessionEvents.emit('streak.shield.earned',{via:v61Mini.mode,charges:game.shields});
 drawStats();document.getElementById('v64RewardOverlay').hidden=true;
 v54Resume();
});
// V6_7 GitHub Pages edition: load the battle from a local, separate HTML file.
const V67_BATTLE_URL = new URL("./assets/battle.html", document.baseURI).href;

// V6_8_1: The finisher is inside an iframe, but the grammar input can retain
// keyboard focus. Forward Space key transitions whenever the *main page*
// receives them. When focus is already inside the iframe, its own listeners
// handle Space directly, so events never need forwarding twice.
function v681ForwardBattleKeyboard(event, action){
 if(!V64Combat.active || event.code!=='Space')return;
 const frame=V64Combat.iframe;
 if(!frame || document.getElementById('v64BattleOverlay').hidden)return;
 event.preventDefault();
 event.stopImmediatePropagation();
 frame.contentWindow?.postMessage({
  source:'WF_DOJO_V64_HOST',kind:'keyboard',action,code:'Space',repeat:!!event.repeat
 },'*');
}
window.addEventListener('keydown',event=>v681ForwardBattleKeyboard(event,'down'),true);
window.addEventListener('keyup',event=>v681ForwardBattleKeyboard(event,'up'),true);
function v681FocusBattleFrame(frame){
 // Keep the keyboard usable immediately after the cinematic opens.
 frame.tabIndex=0;
 try{frame.focus({preventScroll:true});frame.contentWindow?.focus()}catch(_error){}
}

function v64OpenBattle(reason='goal'){
 if(V64Combat.active)return;
 V64Combat.reason=reason;
 if(V65Strike.active){setTimeout(()=>v64OpenBattle(reason),600);return;}V64Combat.active=true;
 const frame=document.getElementById('v64BattleFrame');V64Combat.iframe=frame;
 const layer=document.getElementById('v64BattleOverlay');layer.hidden=false;
 const hadShield=game.shields>0;
 const hp=(V54_DIFFICULTY[V54.difficulty]??3)+1;
 const hpRemaining=Math.max(0,hp-V54.failures);
 const session=game.cycle;
 const onLoaded=()=>{
  if(!V64Combat.active||game.cycle!==session)return;
  frame.contentWindow.postMessage({source:'WF_DOJO_V64_HOST',kind:'start',hasShield:hadShield,hp,hpRemaining,reason},'*');
  v681FocusBattleFrame(frame);
 };
 frame.addEventListener('load',onLoaded,{once:true});
 frame.src=V67_BATTLE_URL;
}
function v64CloseBattle(){
 V64Combat.active=false;const layer=document.getElementById('v64BattleOverlay');layer.hidden=true;
 const frame=document.getElementById('v64BattleFrame');V64Combat.iframe=null;setTimeout(()=>{if(!V64Combat.active)frame.src='about:blank';},300);
}
// V6_9: victory is earned by reaching the target. Mizoryo remains the last-HP punishment.
const V69Victory={shown:false};
const V69_RANKS={
 wannabe:{icon:'🥷',title:'Wannabe Ninja Training',message:'You have mastered the Wannabe Ninja Training!',next:'ninja',nextLabel:'🌙 Advance to Ninja Development',color:'emerald'},
 ninja:{icon:'🌙',title:'Ninja Development Course',message:'You have completed the Ninja Development Course!',next:'master',nextLabel:'⚔️ Advance to Master Training',color:'sapphire'},
 master:{icon:'⚔️',title:'Master Training Regimen',message:'You have mastered the Master Training Regimen!',next:'hell',nextLabel:'🔥 Enter Hell Mode',color:'violet'},
 hell:{icon:'🔥',title:'Hell Mode',message:'You have survived Hell Mode!',next:null,nextLabel:null,color:'inferno'}
};
function v69SelectDifficulty(level){V54.difficulty=level;document.querySelectorAll('[data-difficulty]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.difficulty===level)));}
function v69SelectCount(count){saved.count=String(count);document.querySelectorAll('[data-count]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.count===String(count))));if(saved.mode!=='mix'&&['each','members','allforms'].includes(saved.count)){saved.mode='mix';selectedButton('[data-mode]','mode',saved.mode);}updatePlan();}
function v69VictoryAction(action){
 const o=document.getElementById('v69VictoryOverlay');o.classList.add('hidden');
 const rank=V69_RANKS[V54.difficulty];
 if(action==='next'&&rank.next)v69SelectDifficulty(rank.next);
 if(action.startsWith('count:'))v69SelectCount(Number(action.slice(6)));
 if(action==='again'||action==='next'||action.startsWith('count:')){show('setup');enterDojo();return;}
 show('endView');
}
function v69Celebrate(){
 const rank=V69_RANKS[V54.difficulty]||V69_RANKS.wannabe;
 const ov=document.getElementById('v69VictoryOverlay');
 ov.dataset.rank=rank.color;
 document.getElementById('v69VictoryGlyph').textContent=rank.icon;
 document.getElementById('v69VictoryCourse').textContent=rank.title;
 document.getElementById('v69VictoryMessage').textContent=rank.message;
 document.getElementById('v69VictoryScore').textContent=`${V54.wins} / ${V54.winTarget} successful challenges`;
 document.getElementById('v69VictorySub').textContent=rank.next?'You may advance to the next level!':
  (V54.winTarget<20?'Outstanding! Your next challenge: 20 or 30 correct answers.':V54.winTarget<30?'Outstanding! Could you survive 30 correct answers?':'Ultimate challenge complete! Repeat 30 or choose a different set of word families.');
 const actions=document.getElementById('v69VictoryActions');actions.replaceChildren();
 const add=(label,action,variant)=>{const b=document.createElement('button');b.type='button';b.className='v69-victory-btn '+variant;b.textContent=label;b.onclick=()=>v69VictoryAction(action);actions.append(b);return b;};
 let first;
 if(rank.next)first=add(rank.nextLabel,'next','primary');
 else if(V54.winTarget<20){first=add('🔥 Try 20 correct answers','count:20','primary');add('🔥 Try 30 correct answers','count:30','primary');}
 else if(V54.winTarget<30)first=add('🔥 Try 30 correct answers','count:30','primary');
 else first=add('🔥 Repeat the 30-answer challenge','again','primary');
 add('🔁 Train again at this level','again','secondary');
 add('📜 View results','results','text');
 ov.classList.remove('hidden');
 (first||actions.querySelector('button'))?.focus({preventScroll:true});
}
function finish(){
 if(V64Combat.active)return;
 if(V54.wins>=V54.winTarget && V54.winTarget>0){
  if(V69Victory.shown)return;
  V69Victory.shown=true;
  v64FinishBase();
  document.getElementById('endTitle').textContent=(V69_RANKS[V54.difficulty]||V69_RANKS.wannabe).message;
  v69Celebrate();
 }else v64FinishBase();
}
window.addEventListener('message',event=>{
 if(!V64Combat.active||event.source!==V64Combat.iframe?.contentWindow||event.data?.source!=='WF_DOJO_V64')return;
 if(event.data.kind==='advance'){
  const battleReason=V64Combat.reason;
  if(game.shields>0){game.shields--;game.shieldUses++;}
  v64CloseBattle();
  if(battleReason==='hp'){
    // The last-resort shield saves the run. The student must still correct the same word.
    V54.failures=Math.max(0,(V54_DIFFICULTY[V54.difficulty]??3));
    V64Combat.shown=false;V64Combat.damagePending=0;
    game.phase='active';
    el('typed').disabled=false;el('checkTyped').disabled=false;
    if(saved.style==='choose')drawChoices();
    giveFeedback('warn','🛡️ MIZORYO REPELLED!','Your Magic Shield saved you! You have one HP remaining. Now correct the same word before continuing.');
    drawStats();v54UpdateMastery();
    if(saved.style==='type')el('typed').focus();
    else el('mcChoices').querySelector('button:not(:disabled)')?.focus();
  }else{
    drawStats();v64FinishBase();
    document.getElementById('endTitle').textContent='🏆 Mizoryo defeated!';
  }
 }
 if(event.data.kind==='restart'){
  v64CloseBattle();V64Combat.shown=false;V64Combat.damagePending=0;
  if(typeof window.reenterDojoAfterBattle==='function')window.reenterDojoAfterBattle();
  else newRound();
 }
 if(event.data.kind==='give-up'){
  v64CloseBattle();V64Combat.shown=false;V64Combat.damagePending=0;
  game.phase='setup';show('setup');
 }
});

