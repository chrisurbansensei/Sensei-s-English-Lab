const el=id=>document.getElementById(id);
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const randomize=a=>{const r=[...a];for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]];}return r;};
const byId=new Map(QUESTIONS.map(q=>[q.id,q]));
const feedbackEngine=SenseiFeedback.createEngine(FEEDBACK_POLICIES.engines[GAME_CONFIG.defaultFeedbackEngine]);
const sessionEvents=SenseiEvents.createBus(); // in-memory only; no user data or account sync
const accountAdapter=SenseiAccounts.createGuestAdapter(); // reserved extension point, never claims saved progress
if(typeof window!=='undefined')window.senseiSessionEvents=sessionEvents;
const cheers=['Brilliant strike! ⚔️','Yes! You nailed it! 💜','Spot on! 🎯','Your skills are growing! ✨','Awesome work, word samurai! ⚡','Perfect! Keep going! 🙌','Clean hit! Another win! 🔥','That’s the one! 🏆','Sword-sharp thinking! 🗡️','A true dojo moment! ⛩️'];
const encouraging=['Nice try! Here is a clue.','Not yet—but you can work it out!','Almost! Take another look.','Good effort. Let’s think it through.','Close! Here is a helping hand.','One more look at the sentence!','You’re learning. Try this clue!','Keep going! Here is a hint.'];
const hintTwo=['Try this extra clue.','Let’s narrow it down.','Look closely at the meaning.','Here is a stronger hint.','You can still figure it out!'];
const saved={pool:'both',mode:'mix',count:'10',style:'type'};
const game={round:[],index:0,tries:0,streak:0,best:0,shields:0,shieldUses:0,xp:0,done:0,first:0,hearts:3,wrongItems:[],phase:'setup',badChoices:[],cycle:0,tickId:null,pauseId:null,reviewRemaining:0,reviewLast:0,reviewQ:null,reviewPaused:false,extraAddedFor:[],bonusCount:0};
let rosterSelected=null; // null means every family from the chosen pool
let rosterLetter='ALL';
const ladderMap=new Map();for(const [base,words] of Object.entries(LADDER_PATHS)){const path=words.map(answer=>QUESTIONS.find(q=>q.base===base&&q.answer.toLowerCase()===answer.toLowerCase()));if(path.length===5&&path.every(Boolean))ladderMap.set(base,path);}
const milestoneLevels=[{teacher:'Akari · Apprentice Sensei',message:'You are on a streak!'},{teacher:'Rin · Word Samurai',message:'OMG — you are crushing it!'},{teacher:'Takeshi · Master of Forms',message:'Your skills are growing!'},{teacher:'Master Kaito · Grand Sensei',message:'Keep that fire burning!'},{teacher:'Akari · Apprentice Sensei',message:'You are unstoppable!'},{teacher:'Rin · Word Samurai',message:'That is true word-samurai focus!'}];
const modeNames={mix:'🎯 Classic Mix',ladder:'🪜 Family Ladder',boss:'⚔️ Boss Battle'};
const poolNames={B1:'B1 only',B2:'B2 only',both:'B1 + B2'};
function getPool(){return SenseiPools.filterBySource(QUESTIONS,saved.pool,GAME_CONFIG);}
function entryKey(q){return `${q.source}:${q.base}`;}
function sourceRosterEntries(){const map=new Map();for(const q of getPool()){const key=entryKey(q);if(!map.has(key))map.set(key,{key,source:q.source,base:q.base});}return [...map.values()].sort((a,b)=>a.base.localeCompare(b.base)||a.source.localeCompare(b.source));}
function selectedEntryKeys(){const allowed=sourceRosterEntries().map(x=>x.key);return rosterSelected===null?allowed:allowed.filter(x=>rosterSelected.has(x));}
function allowedBases(){return [...new Set(sourceRosterEntries().map(x=>x.base))].sort((a,b)=>a.localeCompare(b));}
function selectedBases(){return [...new Set(selectedEntryKeys().map(key=>key.split(':').slice(1).join(':')))].sort((a,b)=>a.localeCompare(b));}
function familySourceLabel(base){const s=[...new Set(getPool().filter(q=>q.base===base).map(q=>q.source))];return `${s.join(' + ')} source bank · exam paper links in source archive (teacher additions marked separately)`;}
function renderRoster(){const all=sourceRosterEntries();const selected=new Set(selectedEntryKeys());const search=(el('rosterSearch').value||'').trim().toLowerCase();const filtered=all.filter(x=>x.base.includes(search)&&(rosterLetter==='ALL'||x.base[0].toUpperCase()===rosterLetter));
 el('rosterWords').innerHTML=filtered.length?filtered.map(x=>`<label class="roster-word"><input type="checkbox" data-roster="${safe(x.key)}" ${selected.has(x.key)?'checked':''} aria-label="Include ${safe(x.base)} (${x.source})"><span><strong>${safe(x.base.toUpperCase())}</strong> <small style="color:#b6cae5">${x.source} · ${SOURCE_ENTRY_META[x.key]?.attested?'exam-attested family':'teacher-added family'}</small>${ladderMap.has(x.base)?' <small title="Some five-step ladder practice exists for this base">🪜</small>':''}</span></label>`).join(''):'<p class="note">No matching families.</p>';
 el('rosterWords').querySelectorAll('[data-roster]').forEach(c=>c.addEventListener('change',()=>{if(rosterSelected===null)rosterSelected=new Set(all.map(x=>x.key));c.checked?rosterSelected.add(c.dataset.roster):rosterSelected.delete(c.dataset.roster);rosterCount();updatePlan();}));
 el('rosterAlphabet').innerHTML=['ALL',...new Set(all.map(x=>x.base[0].toUpperCase()))].map(c=>`<button type="button" data-letter="${safe(c)}" aria-pressed="${c===rosterLetter}">${safe(c)}</button>`).join('');el('rosterAlphabet').querySelectorAll('button').forEach(b=>b.onclick=()=>{rosterLetter=b.dataset.letter;renderRoster();});rosterCount();}
function rosterCount(){const chosen=selectedEntryKeys().length;el('rosterChosen').textContent=`${chosen} of ${sourceRosterEntries().length} selected`;}
el('rosterSearch').addEventListener('input',renderRoster);el('rosterAll').onclick=()=>{rosterSelected=null;renderRoster();updatePlan();};el('rosterNone').onclick=()=>{rosterSelected=new Set();renderRoster();updatePlan();};
function eligible(){const chosenKeys=new Set(selectedEntryKeys());let items=getPool().filter(q=>chosenKeys.has(entryKey(q)));if(saved.mode==='boss')items=items.filter(q=>{const a=q.answer.toLowerCase(),c=q.category.toLowerCase();return /negative|plural|prefix|phrasal|collocation|adverb/.test(c)||/^(un|in|dis|over|under|pre|re)/.test(a)||a.endsWith('lessness');});if(saved.mode==='ladder'){const ids=new Set(items.map(q=>q.id));return [...ladderMap.entries()].filter(([base,path])=>path.every(q=>ids.has(q.id))).flatMap(([,path])=>path);}return items;}
function capacity(items){return items.length;}
function distinctFormKey(q){return q.source+":"+q.base+":"+q.answer.toLocaleLowerCase("en");}
function isExpandedRecord(q){return q.id.startsWith('V58-RECORD-')||q.id.startsWith('V59-RECORD-');}
function formStudyKey(q){return String(q.study_family_id||('sf-'+q.base))+':'+q.answer.toLocaleLowerCase('en');}
function selectOnePerMember(items){
 const groups=new Map();for(const q of randomize(items)){
  const key=formStudyKey(q);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(q);
 }
 return randomize([...groups.values()].map(g=>g.find(x=>!isExpandedRecord(x)&&!x.id.startsWith('FORM-'))||g.find(x=>x.content_origin==='authored_context_reused_for_form_record')||g[0]));
}
function interleaveFamilies(items){
 const groups=new Map();for(const q of randomize(items)){
  const family=q.study_family_id||('sf-'+q.base);
  if(!groups.has(family))groups.set(family,[]);groups.get(family).push(q);
 }
 const arranged=[];while([...groups.values()].some(g=>g.length)){
  for(const family of randomize([...groups.keys()])){
   const list=groups.get(family);if(list.length)arranged.push(list.pop());
  }
 }
 return arranged;
}
function pickRound(items,n){
 if(saved.mode==='mix'&&saved.count==='members')return interleaveFamilies(selectOnePerMember(items));
 if(saved.mode==='mix'&&saved.count==='allforms')return randomize(items.filter(q=>isExpandedRecord(q)));
 if(saved.mode==='mix'&&saved.count==='each'){
  const groups=new Map();for(const q of randomize(items)){const key=entryKey(q);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(q);}
  return randomize([...groups.values()].map(g=>g[0]));
 }
 if(saved.mode!=='ladder'){
  let candidates=interleaveFamilies(selectOnePerMember(items)); // alternate families whenever multiple are selected
  const last=(()=>{try{return sessionStorage.getItem('sensei-dojo-last-opening-form')||''}catch(_){return ''}})();
  if(candidates.length>1&&formStudyKey(candidates[0])===last){const next=candidates.findIndex(q=>formStudyKey(q)!==last);if(next>0)[candidates[0],candidates[next]]=[candidates[next],candidates[0]];}
  if(candidates[0])try{sessionStorage.setItem('sensei-dojo-last-opening-form',formStudyKey(candidates[0]));}catch(_){ }
  return candidates.slice(0,n);
 }
 const bases=randomize([...new Set(items.map(q=>q.base))]);const chosen=[];
 for(const base of bases){const path=ladderMap.get(base);if(!path)continue;chosen.push(...path);if(chosen.length>=n)break;}
 return chosen.slice(0,n).map((q,i)=>({...q,ladderStep:(i%5)+1}));
}
function selectedButton(selector,key,value){document.querySelectorAll(selector).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset[key]===value)));}
function updatePlan(){let items=eligible();let num=capacity(items);let eachCount=new Set(items.map(entryKey)).size;let count=saved.count==='all'?num:saved.count==='each'?eachCount:saved.count==='members'?new Set(items.filter(q=>isExpandedRecord(q)).map(distinctFormKey)).size:saved.count==='allforms'?items.filter(q=>isExpandedRecord(q)).length:Math.min(Number(saved.count),num);el('planDescription').textContent=`${modeNames[saved.mode]} · ${poolNames[saved.pool]} · ${saved.style==='type'?'Type the word':'Choose A–D'} · ${count} ${count===1?'question':'questions'}`;el('roundSummary').textContent=num?`${selectedEntryKeys().length} source entries selected · ${saved.mode==='ladder'?Math.floor(num/5)+' full five-step ladders (other families are in Classic Mix). ':saved.mode==='boss'?'Boss Battle focuses on tricky forms; use Classic Mix for full family coverage. ':''}${saved.count==='each'?'One contextual question per selected family. ':''}Up to ${num} available questions. A mistake leads to three different family forms.`:'No questions in this mode for this selection. Try Classic Mix or choose more families.';el('startBtn').disabled=!num;const eachBtn=document.querySelector('[data-count=each]');if(eachBtn)eachBtn.textContent=`One per family (${sourceRosterEntries().length})`;rosterCount();}
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{saved.mode=b.dataset.mode;if(saved.mode!=='mix'&&['each','members','allforms'].includes(saved.count)){saved.count='10';selectedButton('[data-count]','count',saved.count);}selectedButton('[data-mode]','mode',saved.mode);updatePlan();}));
document.querySelectorAll('[data-pool]').forEach(b=>b.addEventListener('click',()=>{saved.pool=b.dataset.pool;rosterSelected=null;rosterLetter='ALL';el('rosterSearch').value='';selectedButton('[data-pool]','pool',saved.pool);renderRoster();updatePlan();}));
document.querySelectorAll('[data-count]').forEach(b=>b.addEventListener('click',()=>{saved.count=b.dataset.count;if(['each','members','allforms'].includes(saved.count)&&saved.mode!=='mix'){saved.mode='mix';selectedButton('[data-mode]','mode',saved.mode);}selectedButton('[data-count]','count',saved.count);updatePlan();}));
document.querySelectorAll('[data-style]').forEach(b=>b.addEventListener('click',()=>{saved.style=b.dataset.style;selectedButton('[data-style]','style',saved.style);updatePlan();}));
function show(view){['setupPanel','hero','studyView','bankView','playArea','endView','v66LibraryView'].forEach(id=>el(id).classList.add('hidden'));if(view==='setup'){el('setupPanel').classList.remove('hidden');el('hero').classList.remove('hidden')}else el(view).classList.remove('hidden');game.phase=view;}
function clearTimers(){v61ClearMiniTimers();clearTimeout(game.pauseId);clearInterval(game.tickId);game.pauseId=null;game.tickId=null;el('familyOverlay').classList.add('hidden');el('entranceOverlay').classList.add('hidden');el('milestoneOverlay').classList.add('hidden');}
function playDojoEntrance(onComplete,{force=false}={}){
 if((!force&&el('startBtn').disabled)||game.phase==='entering')return false;
 clearTimers();
 game.phase='entering';
 el('entranceGif').removeAttribute('src');
 el('entranceGif').src=DOJO_ANIMATION;
 el('entranceOverlay').classList.remove('hidden');
 const generation=++game.cycle;
 game.pauseId=setTimeout(()=>{
  if(generation!==game.cycle)return;
  el('entranceOverlay').classList.add('hidden');
  if(typeof onComplete==='function')onComplete();
 },window.matchMedia('(prefers-reduced-motion: reduce)').matches?300:2200);
 return true;
}
function enterDojo(){playDojoEntrance(()=>newRound());}
function reenterDojoAfterBattle(){playDojoEntrance(()=>newRound(),{force:true});}
window.reenterDojoAfterBattle=reenterDojoAfterBattle;
function newRound(){clearTimers();let items=eligible();const cap=capacity(items);const n=saved.count==='all'?cap:saved.count==='each'?new Set(items.map(entryKey)).size:saved.count==='members'?new Set(items.filter(q=>isExpandedRecord(q)).map(distinctFormKey)).size:saved.count==='allforms'?items.filter(q=>isExpandedRecord(q)).length:Math.min(Number(saved.count),cap);game.round=pickRound(items,n).map(q=>({...q}));if(!game.round.length){show('setup');return;}game.index=0;game.tries=0;game.streak=0;game.best=0;game.shields=0;game.shieldUses=0;game.xp=0;game.done=0;game.first=0;game.hearts=3;game.wrongItems=[];game.bonusCount=0;game.extraAddedFor=[];game.cycle++;sessionEvents.emit('session.started',{gameId:GAME_CONFIG.gameId,mode:saved.mode,sourcePool:saved.pool,selectedQuestions:game.round.length});show('playArea');displayQuestion();window.scrollTo({top:0,behavior:'smooth'});}
function wordChip(word,current){const def=WORD_DEFS[word]||'A related word in this family.';return `<button type="button" class="word-chip ${current&&word.toLowerCase()===current.toLowerCase()?'current':''}" data-definition="${safe(def)}" title="${safe(def)}" aria-label="${safe(word)}: ${safe(def)}">${safe(word)}</button>`;}
function bindWordChips(root){root.querySelectorAll('.word-chip').forEach(b=>{b.addEventListener('click',e=>{e.stopPropagation();const open=b.classList.contains('tooltip-open');root.querySelectorAll('.word-chip').forEach(c=>c.classList.remove('tooltip-open'));if(!open)b.classList.add('tooltip-open');});});}
document.addEventListener('click',()=>document.querySelectorAll('.tooltip-open').forEach(c=>c.classList.remove('tooltip-open')));
function studyFamilies(onlyBases){clearTimers();const list=[...new Set((onlyBases||selectedBases()))].sort();el('studyCards').innerHTML=list.map(base=>{const f=FAMILIES[base]||{};const src=QUESTIONS.find(q=>q.base===base);return `<article class="study-card"><h3>${safe(base.toUpperCase())} ${ladderMap.has(base)?'<span class="tag" title="Full five-step ladder">🪜 Five steps</span>':''}</h3>${Object.entries(f).map(([group,forms])=>`<div class="family-inline"><span class="family-label">${safe(group)}</span><span class="family-forms">${forms.map(w=>wordChip(w)).join('')}</span></div>`).join('')}<small class="tiny">${safe(familySourceLabel(base))}</small></article>`}).join('');bindWordChips(el('studyCards'));show('studyView');window.scrollTo(0,0);}
el('startBtn').onclick=enterDojo;el('studyClose').onclick=()=>show('setup');el('againBtn').onclick=()=>{clearTimers();show('setup');window.scrollTo(0,0);};el('leaveBtn').onclick=()=>{clearTimers();game.cycle++;show('setup');window.scrollTo(0,0);};el('studyEndBtn').onclick=()=>studyFamilies([...new Set(game.wrongItems.map(q=>q.base))].length?[...new Set(game.wrongItems.map(q=>q.base))]:undefined);
function drawStats(){el('shieldStatus').textContent=`🛡️ Magic shields: ${game.shields}${game.shields?' · Reserved for Mizoryo only':''}`;el('shieldStatus').dataset.charges=String(game.shields);el('streakNum').textContent=game.streak;el('bestNum').textContent=game.best;el('xpNum').textContent=game.xp;el('solvedNum').textContent=game.done;el('firstNum').textContent=game.first;el('streakEmoji').textContent=game.streak>=8?'🚀':game.streak>=5?'🌟':'🔥';el('dojoRank').textContent=game.xp>=200?'👑 Dojo Master':game.xp>=100?'🗡️ Word Samurai':game.xp>=50?'⚔️ Apprentice Warrior':'🥋 Novice Wordsmith';el('bossHearts').classList.toggle('hidden',saved.mode!=='boss');el('bossHearts').textContent='Boss lives: '+('❤️ '.repeat(game.hearts))+('🖤 '.repeat(3-game.hearts));;v64RenderHp();}
function drawChoices(){const q=game.round[game.index];el('mcChoices').innerHTML=(q._optionsView||q.options).map((word,i)=>`<button class="choice" data-choice="${safe(word)}" ${game.badChoices.includes(word)||game.phase!=='active'?'disabled':''}><em>${'ABCD'[i]}</em>${safe(word)}</button>`).join('');el('mcChoices').querySelectorAll('[data-choice]').forEach(b=>b.addEventListener('click',()=>check(b.dataset.choice)));}
function displayQuestion(){if(game.index>=game.round.length){finish();return;}game.tries=0;game.badChoices=[];game.phase='active';const q=game.round[game.index];el('progressLabel').textContent=`Question ${game.index+1} / ${game.round.length}`;el('sourceBadge').textContent=q.id.startsWith('FORM-')?`${q.source} · word-form training`:q.source==='Extended'?'Curated practice':`${q.source} · ${SOURCE_ENTRY_META[entryKey(q)]?.attested?'source family attested in past exam':'teacher-added study family'} · original practice question`;el('progressBar').style.width=`${100*game.index/game.round.length}%`;el('questionCaption').innerHTML=q.isBonus?`🌱 Extra practice · ${safe(q.base.toUpperCase())} family`:(saved.mode==='ladder'?`🪜 ${safe(q.base.toUpperCase())} · Step ${q.ladderStep || ((game.index%5)+1)} of 5 ${q.ladderStep===5?'🏆':''}`:(q.id.startsWith('FORM-')?'🎯 Form practice · '+safe(q.category):'Complete the missing word · 3-sentence context'));el('sentences').innerHTML=`<p>${q.sentences.map(sentence=>safe(sentence).replace(/__________ \(([A-Z-]+)\)/,'<span class="gap">__________ ($1)</span>')).join(' ')}</p>`;el('feedback').className='feedback hidden';el('feedback').innerHTML='';el('correction').classList.add('hidden');el('correctionWord').value='';el('correctionFeedback').textContent='';el('mcChoices').classList.toggle('hidden',saved.style!=='choose');el('typeChoices').classList.toggle('hidden',saved.style!=='type');el('typed').value='';el('typed').disabled=false;el('checkTyped').disabled=false;if(saved.style==='choose')drawChoices();else el('typed').focus();drawStats();}
function giveFeedback(kind,title,message,footer){const f=el('feedback');f.className=`feedback ${kind==='ok'?'ok':''} feedback-anim`;f.innerHTML=`<strong>${safe(title)}</strong><p>${safe(message)}</p>${footer?`<p class="micro">${safe(footer)}</p>`:''}`;}
// V6_8: a first mistake costs HP immediately. The earned shield is reserved for the dragon ONLY.
function flagWrong(q){
 if(game.tries!==1)return false;
 game.streak=0;game.wrongItems.push(q);
 q._hpCharged=true;V54.failures++;
 const capacity=(V54_DIFFICULTY[V54.difficulty]??3)+1;
 drawStats();
 if(V54.failures>=capacity){
   game.phase='dragon-finisher';
   el('typed').disabled=true;el('checkTyped').disabled=true;
   giveFeedback('warn','🐉 MIZORYO — FINAL ATTACK!',
     'The last HP is gone. The Mage summons her ultimate water dragon. Your Magic Shield, if earned, is your only defence.');
   v64HitNotice('🐉 FINAL HP LOST — MIZORYO!');
   V64Combat.shown=true;
   v64OpenBattle('hp');
   return true;
 }
 v64OnFirstMistake();
 return false;
}
function isCorrect(word,q){return SenseiFeedback.matchesAccepted(word,q,GAME_CONFIG.acceptedAnswerPolicy);}
function check(word){if(game.phase!=='active')return;const q=game.round[game.index];const guess=String(word||'').trim();if(!guess)return;if(isCorrect(guess,q)){win(q);return;}game.tries++;if(flagWrong(q)){if(saved.style==='choose'&&!game.badChoices.includes(word))game.badChoices.push(word);return;}const copied=SenseiFeedback.normaliseAnswer(guess)===SenseiFeedback.normaliseAnswer((q.sentences.join(' ').match(/\(\s*([A-Za-z-]+)\s*\)/)||[])[1]||q.base);const advice=feedbackEngine.evaluateWrong({attempt:game.tries,baseCopied:copied,hints:{form:q.grammar,context:q.clue,explanation:q.explanation,baseCopied:`You wrote the word from the brackets. The answer must be a different form. ${q.grammar}`}});sessionEvents.emit('answer.incorrect',{questionId:q.id,attempt:game.tries,baseCopied:copied});if(saved.style==='choose'){game.badChoices.push(word);drawChoices();}else{el('typed').focus();el('typed').setSelectionRange(el('typed').value.length,el('typed').value.length);}if(advice.stage==='form'){giveFeedback('warn',copied?'Remember: you must change the word! ✍️':encouraging[(game.index*3+q.answer.length)%encouraging.length],advice.hint,'Hint 1 of 3 · Try again.');return;}if(advice.stage==='context'){giveFeedback('warn',hintTwo[(game.index*5+q.base.length)%hintTwo.length],advice.hint,'Hint 2 of 3 · Another try!');return;}game.phase='correction';giveFeedback('warn','Let’s make this one stick! 💪',`Correct word: ${q.answer}`,'Type the word yourself; your word-family chart comes next.');el('mcChoices').classList.add('hidden');el('typeChoices').classList.add('hidden');el('correction').classList.remove('hidden');el('correctionWord').focus();if(saved.mode==='boss'){game.hearts=Math.max(0,game.hearts-1);drawStats();}}
function notify(text){const box=el('toast');box.textContent=text;box.style.transform='translate(-50%,0)';clearTimeout(notify.t);notify.t=setTimeout(()=>box.style.transform='translate(-50%,-200px)',1600);}
function milestone(count){return count>0&&count%GAME_CONFIG.scoring.streakEvery===0;}
function showMilestone(count,callback){const level=(Math.floor(count/GAME_CONFIG.scoring.streakEvery)-1)%milestoneLevels.length;const rank=milestoneLevels[level];el('milestonePortrait').src=MENTOR_PORTRAITS[level%MENTOR_PORTRAITS.length];el('milestoneTeacher').textContent=rank.teacher;el('milestoneText').textContent=`${count} 🔥`;el('milestoneSub').textContent=rank.message;el('milestoneOverlay').classList.remove('hidden');el('milestoneOverlay').style.display='flex';game.phase='celebration';const generation=game.cycle;game.pauseId=setTimeout(()=>{if(generation!==game.cycle)return;el('milestoneOverlay').classList.add('hidden');el('milestoneOverlay').style.display='';callback();},GAME_CONFIG.timingMs.milestone);}
function lockInput(){if(saved.style==='choose')drawChoices();el('typed').disabled=true;el('checkTyped').disabled=true;}
function win(q){const first=game.tries===0;const advice=feedbackEngine.evaluateCorrect({firstTry:first});game.phase='feedback';sessionEvents.emit('answer.correct',{questionId:q.id,firstTry:first,attempts:game.tries+1});game.done++;if(first){game.first++;game.streak++;game.best=Math.max(game.best,game.streak);game.xp+=GAME_CONFIG.scoring.firstTryXP;giveFeedback('ok',cheers[(game.index+game.streak*2)%cheers.length],`🔥 Streak ${game.streak} · +10 XP`,'');}else{game.xp+=GAME_CONFIG.scoring.recoveredXP;giveFeedback('ok','Great recovery! 🌱',`+5 XP · Word-family review next`,'');}lockInput();drawStats();const generation=game.cycle;game.pauseId=setTimeout(()=>{if(generation!==game.cycle||game.phase!=='feedback')return;if(first){if(milestone(game.streak))showMilestone(game.streak,nextQuestion);else nextQuestion();}else showFamily(q);},first?GAME_CONFIG.timingMs.firstTryFeedback:GAME_CONFIG.timingMs.recoveryFeedback);}
function checkCorrection(){if(game.phase!=='correction')return;const q=game.round[game.index];if(!isCorrect(el('correctionWord').value,q)){el('correctionFeedback').textContent=`Check the spelling and try typing ${q.answer} again.`;el('correctionWord').focus();return;}el('correctionFeedback').textContent='Yes—you corrected it yourself! 🌱';game.xp+=GAME_CONFIG.scoring.correctedXP;sessionEvents.emit('answer.corrected',{questionId:q.id});game.done++;drawStats();game.phase='feedback';const generation=game.cycle;game.pauseId=setTimeout(()=>{if(generation===game.cycle&&game.phase==='feedback')showFamily(q);},GAME_CONFIG.timingMs.correctionFeedback);}
function reviewFormsFor(q){
 const same=WB_FORMS.filter(r=>r.study_family_id===(q.study_family_id||('sf-'+q.base))&&!r.exclude_from_study&&
     (saved.pool==='both'||r.level===saved.pool));
 const groups={};for(const r of same){const word=r.word.toLowerCase();let label=String(r.part_of_speech||'Other forms');
  if(label==='negative')label='Negative forms';else if(label==='noun')label='Nouns';
  else if(label==='adjective')label='Adjectives';else if(label==='verb')label='Verbs';
  else if(label==='adverb')label='Adverbs';else label='Other forms';
  (groups[label]||(groups[label]=[]));if(!groups[label].includes(word))groups[label].push(word);
 }return {groups,label:same[0]?.study_family||q.base};
}
function renderFamily(q){const approved=reviewFormsFor(q);const fam=Object.keys(approved.groups).length?approved.groups:{'Nouns':[q.base,q.answer]};el('familyTitle').textContent=`📜 ${approved.label.toUpperCase()} · Word family`;el('reviewCorrect').innerHTML=`<strong>Today's answer: <span class="focus-word">${safe(q.answer)}</span></strong>`;el('reviewGroups').innerHTML=Object.entries(fam).map(([name,forms])=>`<div class="family-group family-inline"><span class="family-label">${safe(name)}</span><span class="family-forms">${forms.map(w=>wordChip(w,q.answer)).join('')}</span></div>`).join('');bindWordChips(el('reviewGroups'));el('familyOverlay').querySelector('.overlay-hint').textContent=q.isBonus?'🔍 Hover over a word for its meaning. You are practising other forms from this family.':'🔍 Hover or tap a word for its meaning. Three different word forms will follow (or five if selected).';}
function showFamily(q){clearTimeout(game.pauseId);game.phase='review';game.reviewQ=q;renderFamily(q);el('familyOverlay').classList.remove('hidden');game.reviewRemaining=GAME_CONFIG.timingMs.familyStudy;game.reviewPaused=false;v66UpdateReviewState();sessionEvents.emit('family.review.started',{questionId:q.id,base:q.base,durationMs:GAME_CONFIG.timingMs.familyStudy});game.reviewLast=performance.now();el('reviewCountdown').textContent='10';el('reviewBar').style.width='100%';const generation=game.cycle;clearInterval(game.tickId);game.tickId=setInterval(()=>{if(generation!==game.cycle){clearInterval(game.tickId);return;}const now=performance.now();if(!game.reviewPaused&&document.visibilityState==='visible'&&!el('reviewGroups').querySelector('.word-chip:hover, .word-chip:focus-visible, .word-chip.tooltip-open'))game.reviewRemaining-=now-game.reviewLast;game.reviewLast=now;const ms=Math.max(0,game.reviewRemaining);el('reviewCountdown').textContent=String(Math.ceil(ms/1000));el('reviewBar').style.width=`${100*ms/GAME_CONFIG.timingMs.familyStudy}%`;if(ms<=0){v66ContinueFamilyReview();}},120);}
function addExtraPractice(q){if(q.isBonus)return;const sameFamily=getPool().filter(x=>x.base===q.base&&x.id!==q.id);const differentAnswers=randomize(sameFamily.filter(x=>x.answer.toLowerCase()!==q.answer.toLowerCase()));const choices=[];for(const x of differentAnswers){if(!choices.some(v=>v.answer.toLowerCase()===x.answer.toLowerCase()))choices.push(x);if(choices.length===feedbackEngine.policy.extraFamilyQuestions)break;}if(choices.length<feedbackEngine.policy.extraFamilyQuestions){for(const x of randomize(sameFamily)){if(!choices.some(v=>v.id===x.id))choices.push(x);if(choices.length===feedbackEngine.policy.extraFamilyQuestions)break;}}if(choices.length<feedbackEngine.policy.extraFamilyQuestions)return;game.round.splice(game.index+1,0,...choices.map((item,i)=>({...item,isBonus:true,bonusOf:q.id,id:`${item.id}-bonus-${game.index}-${i}`})));game.bonusCount+=choices.length;}
function nextQuestion(){if(game.phase==='setup'||game.phase==='endView')return;if(saved.mode==='boss'&&game.hearts===0){finish();return;}game.index++;displayQuestion();}
function v64FinishBase(){clearTimers();sessionEvents.emit('session.completed',{gameId:GAME_CONFIG.gameId,questionsCompleted:game.done,firstTry:game.first,xp:game.xp,bestStreak:game.best});game.phase='done';show('endView');el('progressBar').style.width='100%';const total=game.done;const pct=Math.round(100*game.first/Math.max(1,total));el('endTitle').textContent=saved.mode==='boss'&&game.hearts===0?'💜 You gave the boss a fight!':game.first===total?'🏆 Flawless round!':game.best>=4?'🔥 What a streak!':'🌟 Great practice!';el('endSummary').textContent=`${total} questions completed${game.bonusCount?` (${game.bonusCount} extra practice questions)`:''} · ${game.first} first-try wins (${pct}%) · ${game.xp} XP. Every corrected word counts as learning.`;el('endXP').textContent=game.xp;el('endBest').textContent=game.best;const mistakes=game.wrongItems.length;const categories={};game.wrongItems.forEach(q=>{let cat=q.category.toLowerCase();let label=/negative|prefix/.test(cat)?'Negative forms and prefixes':/adverb/.test(cat)?'Adverbs':/noun|plural|singular/.test(cat)?'Nouns and number':/gerund|ing|participle|passive/.test(cat)?'-ing forms and verb structures':/verb|tense/.test(cat)?'Verb forms':/adjective/.test(cat)?'Adjectives':/phrasal|collocation/.test(cat)?'Phrases and word partners':'Other word forms';categories[label]=(categories[label]||0)+1;});const ranked=Object.entries(categories).sort((a,b)=>b[1]-a[1]);el('learningSummary').innerHTML=mistakes?`<h3>🎯 What to practise next</h3><p class="subtext">You worked through ${mistakes} ${mistakes===1?'question':'questions'} with hints and word-family reviews. These areas are worth studying again:</p>${ranked.slice(0,4).map(([cat,count])=>`<span class="tag">${safe(cat)} · ${count}</span>`).join('')}<p class="subtext" style="margin-top:10px">No need to redo every mistake now. Take what you learned into the next round.</p>`:'<h3>🌟 First-try champion!</h3><p>You answered every challenge correctly on the first attempt.</p>';window.scrollTo(0,0);}
el('checkTyped').onclick=()=>check(el('typed').value);el('checkCorrection').onclick=checkCorrection;
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&game.phase==='active'&&saved.style==='type'){e.preventDefault();check(el('typed').value);return;}if(e.key==='Enter'&&game.phase==='correction'){e.preventDefault();checkCorrection();return;}if(game.phase==='active'&&saved.style==='choose'&&/^[a-d1-4]$/i.test(e.key)&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){let i=/^[1-4]$/.test(e.key)?Number(e.key)-1:e.key.toUpperCase().charCodeAt(0)-65;const q=game.round[game.index],w=(q._optionsView||q.options)[i];if(w&&!game.badChoices.includes(w)){e.preventDefault();check(w);}}},true);

// V5.4 configurable study modes. No accounts: only anonymous local-device family scores are stored, with opt-out.
const V54={difficulty:'wannabe', remediation:'fixed', fixedCount:3, streakTarget:3, failures:0, winTarget:10, wins:0, halfShown:false, midPending:false, familyStats:{}, recovery:null, recoverySeen:new Set(), poolKeys:new Set(), usedFormKeys:new Set(), randomPick:null, sessionStarts:0, pendingReset:false, stopAt:0};
const V54_DIFFICULTY={hell:0,master:1,ninja:2,wannabe:3};
const V54_STORAGE='sensei-dojo-family-mastery-v54';
try{V54.familyStats=JSON.parse(localStorage.getItem(V54_STORAGE)||'{}')}catch(_){V54.familyStats={}}
function v54Key(q){return `${q.source}:${q.base}`;}
function v54Mastered(k){const x=V54.familyStats[k];return x&&x.seen>=3&&x.first/x.seen>=.9;}
function v54Save(){if(!el('avoidMastered').checked)return;try{localStorage.setItem(V54_STORAGE,JSON.stringify(V54.familyStats))}catch(_){}}
function v54Record(q,first){if(q._recorded)return;q._recorded=true;const k=v54Key(q);const old=V54.familyStats[k]||{seen:0,first:0};old.seen++;if(first)old.first++;V54.familyStats[k]=old;v54Save();v54UpdateMastery();}
function v54UpdateMastery(){if(!el('masteryLabel'))return;const keys=selectedEntryKeys();const completed=keys.filter(v54Mastered).length;el('masteryLabel').textContent=`🥋 ${completed} / ${keys.length} selected families mastered (90% first-try accuracy, 3+ attempts)`;el('winCounter').textContent=`${V54.wins} / ${V54.winTarget} correct answers`;
 el('progressBar').style.width=`${Math.min(100,100*V54.wins/Math.max(1,V54.winTarget))}%`;
}
function v54SelectedKeys(){let keys=selectedEntryKeys();if(el('avoidMastered')?.checked){const live=keys.filter(k=>!v54Mastered(k));if(live.length)keys=live;}return new Set(keys);}
function v54Eligible(){const keys=v54SelectedKeys();let a=getPool().filter(q=>keys.has(entryKey(q))&&v66HasFocus(q));if(saved.mode==='boss')a=a.filter(q=>/negative|plural|prefix|phrasal|collocation|adverb/.test(q.category.toLowerCase())||/^(un|in|dis|over|under|pre|re)/.test(q.answer.toLowerCase()));if(saved.mode==='ladder'){const ids=new Set(a.map(q=>q.id));a=[...ladderMap.values()].filter(path=>path.every(q=>ids.has(q.id))).flat();}return a;}
function eligible(){return v54Eligible();}
function updatePlan(){const items=eligible();const entries=selectedEntryKeys().length;const count=['each','members','allforms'].includes(saved.count)?saved.count==='each'?new Set(items.map(entryKey)).size:saved.count==='members'?new Set(items.filter(q=>isExpandedRecord(q)).map(distinctFormKey)).size:items.filter(q=>isExpandedRecord(q)).length:Math.min(Number(saved.count)||10,30,items.length);el('planDescription').textContent=`${modeNames[saved.mode]} · ${poolNames[saved.pool]} · ${saved.style==='type'?'Typing':'Multiple choice'} · ${count} wins`;el('roundSummary').textContent=`${entries} word families selected`;el('startBtn').disabled=!items.length;rosterCount();}
function newRound(){V64Combat.shown=false;V64Combat.damagePending=0;V64Shield.pending=false;clearTimers();const items=eligible(),n=['each','members','allforms'].includes(saved.count)?items.length:Math.min(Number(saved.count)||10,30,items.length);game.round=pickRound(items,n).map(q=>({...q}));if(!game.round.length){show('setup');return;}game.index=0;game.tries=0;game.streak=0;game.best=0;game.shields=0;game.shieldUses=0;game.xp=0;game.done=0;game.first=0;game.hearts=3;game.wrongItems=[];game.bonusCount=0;game.extraAddedFor=[];game.cycle++;if(typeof V65Strike!=='undefined'){V65Strike.active=false;V65Strike.count=0;V65Strike.pending=null;V65Strike.frameToken++;}V54.failures=0;V54.wins=0;V54.winTarget=Number(saved.count)||10;V54.winTarget=['each','members','allforms'].includes(saved.count)?game.round.length:Math.min(V54.winTarget,30);V54.halfShown=false;V54.recovery=null;V54.recoverySeen=new Set();V54.pendingReset=false;V54.usedFormKeys=new Set();sessionEvents.emit('session.started',{gameId:GAME_CONFIG.gameId,mode:saved.mode,sourcePool:saved.pool,selectedQuestions:game.round.length});show('playArea');v54UpdateMastery();displayQuestion();window.scrollTo({top:0,behavior:'smooth'});}
function v54NextIndex(){let idx=game.index+1;while(idx<game.round.length&&(game.round[idx]._done||(!game.round[idx].isBonus&&el('avoidMastered').checked&&v54Mastered(v54Key(game.round[idx])))))idx++;return idx;}
// V5.9: Every recovery answer must be another form in the approved study family.
// Never use the same answer twice within one family recovery, or repeat its sentence.
function recoveryFormKey(q){return String(q.answer||'').trim().toLocaleLowerCase('en');}
function recoveryContextKey(q){return (q.sentences||[]).join(' ').replace(/\s+/g,' ').toLocaleLowerCase('en');}
function recoveryCategory(q){
 const c=String(q.category||q.source_part_of_speech||'').toLowerCase();
 if(/negative|prefix|unfavourable/.test(c)||/^(un|in|im|ir|dis|non)/.test(q.answer))return 'negative';
 if(/noun|plural|person/.test(c))return 'noun';
 if(/adjective|comparative|superlative/.test(c))return 'adjective';
 if(/verb|participle|tense|past|gerund|ing/.test(c))return 'verb';
 if(/adverb/.test(c))return 'adverb';return c||'other';
}
function recoveryCandidates(r){
 let available=getPool().filter(q=>v66HasFocus(q)&&
  (q.study_family_id||('sf-'+q.base))===r.studyFamily &&
  !r.seenForms.has(recoveryFormKey(q)) &&
  !(V54.usedFormKeys?.has(formStudyKey(q))) &&
  !r.seenContexts.has(recoveryContextKey(q)) &&
  q.sentences?.length>=3 && q.options?.length>=4
 );
 // Take one candidate per answer, preferring written/revised contextual exercises.
 const byAnswer=new Map();for(const q of randomize(available)){
  const key=recoveryFormKey(q),existing=byAnswer.get(key);
  const score=z=>!isExpandedRecord(z)&&!z.id.startsWith('FORM-')?0:z.content_origin==='authored_context_reused_for_form_record'?1:
    z.context_qa==='targeted_manual_rewrite'?2:3;
  if(!existing||score(q)<score(existing))byAnswer.set(key,q);
 }
 return [...byAnswer.values()];
}
function v54Extra(){const r=V54.recovery;if(!r)return null;
 const choices=randomize(recoveryCandidates(r)).sort((a,b)=>{
  const ca=recoveryCategory(a),cb=recoveryCategory(b),freq=(r.categories[ca]||0)-(r.categories[cb]||0);
  if(freq)return freq;
  const tier=q=>!isExpandedRecord(q)&&!q.id.startsWith('FORM-')?0:q.content_origin==='authored_context_reused_for_form_record'?1:2;
  return tier(a)-tier(b);
 });
 const chosen=choices[0];if(!chosen)return null;
 r.seenForms.add(recoveryFormKey(chosen));r.seenContexts.add(recoveryContextKey(chosen));
 const cat=recoveryCategory(chosen);r.categories[cat]=(r.categories[cat]||0)+1;
 return {...chosen,id:`${chosen.id}-recovery-${r.attempts}-${r.seenForms.size}`,isBonus:true,bonusOf:r.root,_originalId:chosen.id};
}
function v54QueueRecovery(){const r=V54.recovery;if(!r)return false;
 if(r.mode==='fixed'&&r.done>=V54.fixedCount){V54.recovery=null;return false;}
 if(r.mode==='once'&&r.wins>=1){V54.recovery=null;return false;}
 if(r.mode==='streak'&&r.consecutive>=V54.streakTarget){V54.recovery=null;return false;}
 if(r.attempts>=40){V54.recovery=null;notify('Recovery complete. Continue your mixed training!');return false;}
 const item=v54Extra();
 if(!item){V54.recovery=null;notify('All remaining different forms in this family have been practised. Moving on!');return false;}
 game.round.splice(game.index+1,0,item);game.bonusCount++;return true;
}
function addExtraPractice(q){if(q.isBonus||V54.recovery)return;
 V54.recovery={root:q.id,base:q.base,source:q.source,
  studyFamily:q.study_family_id||('sf-'+q.base),mode:V54.remediation,
  seenForms:new Set([recoveryFormKey(q)]),seenContexts:new Set([recoveryContextKey(q)]),
  categories:{},done:0,wins:0,consecutive:0,attempts:0};
 v54QueueRecovery();
}
function v54NextOrFinish(){
 if(V54.recovery&&game.round[game.index]?.isBonus)v54QueueRecovery();
 if(V54.pendingReset){V54.wins=0;V54.failures=0;game.streak=0;
  if(!V54.recovery){V54.pendingReset=false;const selected=eligible();game.round=pickRound(selected,Math.max(5,V54.winTarget)).map(q=>({...q}));game.index=-1;notify('Back to the beginning! Keep training ⚔️');}
  else if(game.round[game.index]?.isBonus===false)notify('Score reset — finish family training, then start again!');
 }
 if(V54.wins>=V54.winTarget){finish();return;}
 game.index=v54NextIndex();
 if(game.index>=game.round.length){
  const pool=eligible();const used=new Set(game.round.filter(q=>!q.isBonus).map(q=>q.id));let unused=randomize(pool.filter(q=>!used.has(q.id)&&!V54.usedFormKeys.has(formStudyKey(q))));
  if(!unused.length)unused=randomize(pool.filter(q=>!V54.usedFormKeys.has(formStudyKey(q))));
  if(unused.length)game.round.push(...unused.slice(0,Math.max(5,V54.winTarget-V54.wins)).map(q=>({...q})));else{finish();return;}
 }
 if(!V54.halfShown&&V54.wins>=Math.ceil(V54.winTarget/2)){V54.halfShown=true;v61StartMidway();return;}
 displayQuestion();}

function nextQuestion(){if(game.phase==='setup'||game.phase==='endView')return;v54NextOrFinish();}
function v54ProcessCompletion(q,first){
 if(!q.isBonus)v54Record(q,first);
 // Only new-question, first-attempt successes count; never credit a typed correction.
 if(first)V54.wins++;
 // HP was already charged on the very first wrong attempt in flagWrong().
 // Never subtract another HP for a typed correction or a recovery answer.
 if(q.isBonus&&V54.recovery){V54.recovery.done++;V54.recovery.attempts++;if(first){V54.recovery.wins++;V54.recovery.consecutive++;}else V54.recovery.consecutive=0;}
 v54UpdateMastery();V64Combat.damagePending=0;v64RenderHp();
}
function win(q){const first=game.tries===0;
 if(!first&&saved.style==='choose'){
  game.phase='correction';giveFeedback('warn','Write it to remember it! ✍️',
   `You found the answer. Now type ${q.answer} once correctly before practising other forms from this family.`,
   'Your three different word-family questions will follow.');
  el('mcChoices').classList.add('hidden');el('typeChoices').classList.add('hidden');
  el('correction').classList.remove('hidden');el('correctionWord').value='';el('correctionWord').focus();return;
 }
 game.phase='feedback';sessionEvents.emit('answer.correct' ,{questionId:q.id,firstTry:first,attempts:game.tries+1});game.done++;v54ProcessCompletion(q,first);if(first){game.first++;game.streak++;game.best=Math.max(game.best,game.streak);game.xp+=GAME_CONFIG.scoring.firstTryXP;giveFeedback('ok',cheers[(game.index+game.streak*2)%cheers.length],`🔥 Streak ${game.streak} · +10 XP`,'');}else{game.xp+=GAME_CONFIG.scoring.recoveredXP;giveFeedback('ok','Great recovery! 🌱',`+5 XP · Word family study next`,'');}lockInput();drawStats();const generation=game.cycle;game.pauseId=setTimeout(()=>{if(generation!==game.cycle||game.phase!=='feedback')return;if(first){if(milestone(game.streak))showMilestone(game.streak,nextQuestion);else nextQuestion();}else showFamily(q);},first?GAME_CONFIG.timingMs.firstTryFeedback:GAME_CONFIG.timingMs.recoveryFeedback);}
function checkCorrection(){if(game.phase!=='correction')return;const q=game.round[game.index];if(!isCorrect(el('correctionWord').value,q)){el('correctionFeedback').textContent=`Check the spelling and try typing ${q.answer} again.`;el('correctionWord').focus();return;}el('correctionFeedback').textContent='Yes—you corrected it yourself! 🌱';game.xp+=GAME_CONFIG.scoring.correctedXP;game.done++;v54ProcessCompletion(q,false);drawStats();game.phase='feedback';const generation=game.cycle;game.pauseId=setTimeout(()=>{if(generation===game.cycle&&game.phase==='feedback')showFamily(q);},GAME_CONFIG.timingMs.correctionFeedback);}
function displayQuestion(){if(game.index>=game.round.length){finish();return;}game.tries=0;game.badChoices=[];game.phase='active';const q=game.round[game.index];q._optionsView=randomize(q.options);V54.usedFormKeys.add(formStudyKey(q));el('progressLabel').textContent=`Training · ${V54.wins} / ${V54.winTarget} correct`;el('sourceBadge').textContent=q.source+' vocabulary';el('questionCaption').textContent=q.isBonus?`🌱 ${q.base.toUpperCase()} · different word-family member`:(saved.mode==='ladder'?`🪜 ${q.base.toUpperCase()} · Family Ladder`:'Complete the missing word');el('sentences').innerHTML=`<p>${q.sentences.map(s=>safe(s).replace(/__________ \(([A-Z-]+)\)/,'<span class="gap">__________ ($1)</span>')).join(' ')}</p>`;el('feedback').className='feedback hidden';el('feedback').innerHTML='';el('correction').classList.add('hidden');el('correctionWord').value='';el('correctionFeedback').textContent='';el('mcChoices').classList.toggle('hidden',saved.style!=='choose');el('typeChoices').classList.toggle('hidden',saved.style!=='type');el('typed').value='';el('typed').disabled=false;el('checkTyped').disabled=false;if(saved.style==='choose')drawChoices();else el('typed').focus();drawStats();v54UpdateMastery();}

// V6.1 — a single midway challenge may earn one shield, regardless of current streak.
const V61_RIDDLES = [{"question":"I have a neck and hold water, but I have no mouth. What am I?","answers":["bottle","water bottle"],"hint":"You might find one in your school bag."},{"question":"I have hands but cannot clap. You often see me on a wall. What am I?","answers":["clock","wall clock"],"hint":"I tell you the time."},{"question":"I have many keys but cannot open a door. You use me to type. What am I?","answers":["keyboard"],"hint":"I am connected to a computer."},{"question":"The more I dry, the wetter I become. What am I?","answers":["towel","bath towel"],"hint":"You use me after a shower."},{"question":"I follow you in sunlight but disappear in the dark. What am I?","answers":["shadow","your shadow","my shadow"],"hint":"Look at the ground on a sunny day."},{"question":"I am full of holes but can still hold water. What am I?","answers":["sponge"],"hint":"You can wash dishes with me."},{"question":"I have teeth but never bite. You use me to tidy your hair. What am I?","answers":["comb","hair comb"],"hint":"I can fit in your pocket."},{"question":"I have pages, and reading me can take you on an adventure. What am I?","answers":["book","story book","storybook"],"hint":"You can borrow me from a library."},{"question":"I show roads, towns and mountains, but I have no cars or trees. What am I?","answers":["map","a map"],"hint":"You might use me to find a route."},{"question":"I have an eye but cannot see. You can use me to sew a button. What am I?","answers":["needle","sewing needle"],"hint":"Thread passes through my eye."},{"question":"I become shorter while giving you light. I have a wick. What am I?","answers":["candle"],"hint":"You might put me on a birthday cake."},{"question":"I open above your head to protect you from rain. What am I?","answers":["umbrella"],"hint":"You carry me on wet days."},{"question":"I travel around the world but stay in one corner of an envelope. What am I?","answers":["stamp","postage stamp"],"hint":"I help a letter travel by post."},{"question":"I have a bed but never sleep, and banks but no money. What am I?","answers":["river"],"hint":"Water flows through me."},{"question":"I have a shell, and you usually break me before making an omelette. What am I?","answers":["egg"],"hint":"A hen can lay me."},{"question":"The more steps you take, the more of me you leave in soft sand. What am I?","answers":["footprints","footprint","foot prints"],"hint":"You can see the shape of your shoes."},{"question":"I repeat what you say, but I never speak first. You may hear me in a cave. What am I?","answers":["echo","an echo"],"hint":"Your voice bounces back."},{"question":"I have black and white keys and make music when someone plays me. What am I?","answers":["piano"],"hint":"I am a large musical instrument."},{"question":"I need fuel and air to keep going. Water often puts me out. What am I?","answers":["fire","flame","a fire"],"hint":"I can keep you warm."},{"question":"I glow inside a lamp when electricity passes through me. What am I?","answers":["light bulb","lightbulb","bulb"],"hint":"You change me when I stop working."},{"question":"I have bristles but no hair. You use me to sweep the floor. What am I?","answers":["broom","a broom"],"hint":"I help with cleaning."}];
const v61RiddlesSeen=new Set();
let v61Mini={mode:'none',phase:'idle',id:0,attempts:0,done:false,rewarded:false,question:null,pattern:[],inputs:[]};
let v61MiniEpoch=0;
let v61MiniTimers=[];
let v61MiniInterval=null;
function v61ClearMiniTimers(){v61MiniEpoch++;for(const id of v61MiniTimers)clearTimeout(id);v61MiniTimers=[];if(v61MiniInterval!==null){clearInterval(v61MiniInterval);v61MiniInterval=null;}}
function v61Later(fn,ms){const epoch=v61MiniEpoch;const id=setTimeout(()=>{if(epoch===v61MiniEpoch&&game.phase==='midway')fn();},ms);v61MiniTimers.push(id);}
function v61PickRiddle(){let available=V61_RIDDLES.map((_,i)=>i).filter(i=>!v61RiddlesSeen.has(i));if(!available.length){v61RiddlesSeen.clear();available=V61_RIDDLES.map((_,i)=>i);}const i=available[Math.floor(Math.random()*available.length)];v61RiddlesSeen.add(i);return V61_RIDDLES[i];}
function v61Normalise(s){return String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9 ]/g,'').replace(/\b(a|an|the)\b/g,' ').replace(/\s+/g,' ').trim();}
function v61EditDistance(a,b){if(a===b)return 0;const p=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prev=p[0];p[0]=i;for(let j=1;j<=b.length;j++){const old=p[j];p[j]=Math.min(p[j]+1,p[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old;}}return p[b.length];}
function v61RiddleMatches(value,answers){const attempt=v61Normalise(value);if(!attempt)return false;return answers.some(answer=>{const expected=v61Normalise(answer);if(attempt===expected)return true;const maxDistance=expected.length>=10?2:expected.length>=5?1:0;return attempt.length>=4&&maxDistance>0&&Math.abs(attempt.length-expected.length)<=maxDistance&&v61EditDistance(attempt,expected)<=maxDistance;});}
function v61AwardShield(){
 if(v61Mini.rewarded)return;
 v61Mini.rewarded=true;
 V64Shield.pending=true;
}

function v61StartMidway(){v61ClearMiniTimers();game.phase='midway';v61Mini={mode:'riddle',phase:'question',id:v61MiniEpoch,attempts:0,done:false,rewarded:false,question:v61PickRiddle(),pattern:[],inputs:[]};el('midwayOverlay').classList.remove('hidden');el('midwayChoices').classList.remove('hidden');el('midRiddle').disabled=false;el('midArrows').disabled=false;v61RenderRiddle();}
function v61RenderRiddle(){if(game.phase!=='midway'||v61Mini.done||v61Mini.mode!=='riddle')return;const q=v61Mini.question;el('midwayGame').innerHTML=`<div class="eyebrow">🧩 Your midway riddle · type your answer</div><h3>${safe(q.question)}</h3><form id="miniRiddleForm" class="mini-entry"><input id="miniRiddleInput" aria-label="Your riddle answer" placeholder="Type your answer…" autocomplete="off" spellcheck="false" required><button type="submit" class="btn">Check answer</button></form><p id="miniRiddleFeedback" class="mini-feedback" role="status" aria-live="polite">One correct answer earns 🛡️ a streak shield.</p>`;el('miniRiddleForm').addEventListener('submit',e=>{e.preventDefault();v61CheckRiddle();});el('miniRiddleInput').focus();}
function v61CheckRiddle(){if(game.phase!=='midway'||v61Mini.mode!=='riddle'||v61Mini.done)return;const q=v61Mini.question;const attempt=el('miniRiddleInput').value;if(!attempt.trim())return;v61Mini.attempts++;const fb=el('miniRiddleFeedback');if(v61RiddleMatches(attempt,q.answers)){v61Mini.done=true;v61AwardShield();fb.className='mini-feedback good';fb.textContent='🎉 Correct! 🛡️ One Magic Shield unlocked. Tap Claim to receive your shield.';}else if(v61Mini.attempts<2){el('midArrows').disabled=true;fb.className='mini-feedback try';fb.textContent=`Not quite! One more try. Hint: ${q.hint}`;el('miniRiddleInput').value='';el('miniRiddleInput').focus();return;}else{v61Mini.done=true;fb.className='mini-feedback try';fb.textContent=`Good effort! The answer was ${q.answers[0]}. No shield this time.`;}
 el('midwayChoices').classList.add('hidden');el('miniRiddleInput').disabled=true;el('miniRiddleForm').querySelector('button').disabled=true;v61Mini.rewarded?v61Later(v64ShowShieldClaim,450):v61Later(v54Resume,2700);
}
function v61ArrowStart(){if(game.phase!=='midway'||v61Mini.done||v61Mini.mode==='arrows'||v61Mini.attempts>0)return;v61ClearMiniTimers();v61Mini.mode='arrows';v61Mini.phase='intro';v61Mini.pattern=Array.from({length:10},()=>['↑','↓','←','→'][Math.floor(Math.random()*4)]);v61Mini.inputs=[];el('midwayChoices').classList.add('hidden');el('midwayGame').innerHTML='<div class="eyebrow">🏹 Arrow memory challenge</div><p class="mini-help">Ready, set, go! Memorise the sequence for 15 seconds. Then repeat it with your keyboard arrows or the touch buttons.</p><div id="miniArrowCue" class="arrow-cue" aria-live="polite"></div><div id="miniArrowSequence" class="arrow-row"></div><div id="miniArrowTimer" class="mini-countdown"></div><div id="miniArrowPad" class="arrow-pad hidden"></div><p id="miniArrowFeedback" class="mini-feedback" role="status" aria-live="polite"></p>';for(const [i,cue] of ['READY','SET','GO!'].entries()){v61Later(()=>{const e=el('miniArrowCue');e.classList.remove('flash');void e.offsetWidth;e.classList.add('flash');e.textContent=cue;},i*850);}v61Later(v61ArrowMemorise,3*850);}
function v61ArrowMemorise(){if(game.phase!=='midway'||v61Mini.mode!=='arrows')return;v61Mini.phase='memorise';el('miniArrowCue').textContent='MEMORISE';el('miniArrowSequence').textContent=v61Mini.pattern.join(' ');let remaining=15000,last=performance.now();el('miniArrowTimer').textContent='15 seconds to memorise';v61MiniInterval=setInterval(()=>{if(game.phase!=='midway'||v61Mini.mode!=='arrows'){clearInterval(v61MiniInterval);v61MiniInterval=null;return;}const now=performance.now();if(document.visibilityState==='visible')remaining-=now-last;last=now;el('miniArrowTimer').textContent=`${Math.ceil(Math.max(0,remaining)/1000)} seconds to memorise`;if(remaining<=0){clearInterval(v61MiniInterval);v61MiniInterval=null;v61ArrowRecall();}},90);}
function v61ArrowRecall(){if(game.phase!=='midway'||v61Mini.mode!=='arrows')return;v61Mini.phase='recall';el('miniArrowCue').textContent='YOUR TURN!';el('miniArrowSequence').textContent='· · · · · · · · · ·';el('miniArrowTimer').textContent='0 of 10 arrows';el('miniArrowFeedback').textContent='Use ↑ ↓ ← → on the keyboard or tap the arrows below.';const pad=el('miniArrowPad');pad.classList.remove('hidden');pad.innerHTML=['↑','↓','←','→'].map((arrow,i)=>`<button type="button" data-mini-arrow="${arrow}" aria-label="${['Up','Down','Left','Right'][i]}">${arrow}</button>`).join('');pad.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>v61ArrowInput(b.dataset.miniArrow)));pad.querySelector('button')?.focus();}
function v61ArrowInput(arrow){if(game.phase!=='midway'||v61Mini.mode!=='arrows'||v61Mini.phase!=='recall')return;v61Mini.inputs.push(arrow);const n=v61Mini.inputs.length;el('miniArrowSequence').textContent=v61Mini.inputs.join(' ')+' '+Array(10-n).fill('·').join(' ');el('miniArrowTimer').textContent=`${n} of 10 arrows`;if(n<10)return;v61Mini.done=true;v61Mini.phase='done';el('miniArrowPad').classList.add('hidden');const correct=v61Mini.pattern.every((v,i)=>v===v61Mini.inputs[i]);const fb=el('miniArrowFeedback');fb.className='mini-feedback '+(correct?'good':'try');if(correct){v61AwardShield();fb.textContent='🏆 Perfect memory! 🛡️ One Magic Shield unlocked.';}else{fb.textContent=`Good try! Correct sequence: ${v61Mini.pattern.join(' ')}. No shield this time.`;}v61Mini.rewarded?v61Later(v64ShowShieldClaim,450):v61Later(v54Resume,2900);}
function v54Resume(){v61ClearMiniTimers();el('midwayOverlay').classList.add('hidden');game.phase='active';displayQuestion();}
el('midSkip').onclick=v54Resume;
el('midRiddle').onclick=()=>{if(v61Mini.mode==='riddle'&&v61Mini.attempts===0)v61RenderRiddle();};
el('midArrows').onclick=v61ArrowStart;
document.addEventListener('keydown',e=>{if(game.phase!=='midway'||v61Mini.mode!=='arrows'||v61Mini.phase!=='recall')return;const a={ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→'}[e.key];if(a){e.preventDefault();v61ArrowInput(a);}},true);

// Optional advanced modes are deliberately separate from the normal 5–30 challenge selector.
for(const b of document.querySelectorAll('[data-difficulty]'))b.addEventListener('click',()=>{V54.difficulty=b.dataset.difficulty;document.querySelectorAll('[data-difficulty]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));});
for(const b of document.querySelectorAll('[data-remediation]'))b.addEventListener('click',()=>{V54.remediation=b.dataset.remediation;document.querySelectorAll('[data-remediation]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));});
el('streakTarget').addEventListener('change',e=>V54.streakTarget=Number(e.target.value));
 el('fixedTarget').addEventListener('change',e=>V54.fixedCount=Number(e.target.value));
el('rosterRandom').onclick=()=>{const all=sourceRosterEntries();const n=Math.max(1,Math.min(all.length,Number(el('randomCount').value)||10));rosterSelected=new Set(randomize(all).slice(0,n).map(x=>x.key));renderRoster();updatePlan();};
el('rosterFresh').onclick=()=>{V54.familyStats={};try{localStorage.removeItem(V54_STORAGE)}catch(_){}renderRoster();updatePlan();notify('Family mastery reset on this device');};
if(el('avoidMastered'))el('avoidMastered').addEventListener('change',()=>{if(!el('avoidMastered').checked){try{localStorage.removeItem(V54_STORAGE)}catch(_){}}else v54Save();updatePlan();});
// The old global 2-question remediation must not append to the new dynamic queue.


// V6_6: pause and resume the timed word-family study screen.
function v66UpdateReviewState(){
 const b=el('v66ReviewPause');b.textContent=game.reviewPaused?'▶ Resume countdown':'⏸ Pause to study';
 b.setAttribute('aria-pressed',String(!!game.reviewPaused));
 el('v66ReviewHelp').textContent=game.reviewPaused?'Paused — study for as long as you like.':'The remaining time is running.';
}
function v66ContinueFamilyReview(){
 if(game.phase!=='review')return;
 clearInterval(game.tickId);game.tickId=null;game.reviewPaused=false;
 el('familyOverlay').classList.add('hidden');addExtraPractice(game.reviewQ);nextQuestion();
}
el('v66ReviewPause').addEventListener('click',()=>{if(game.phase!=='review')return;game.reviewPaused=!game.reviewPaused;game.reviewLast=performance.now();v66UpdateReviewState();});
el('v66ReviewContinue').addEventListener('click',v66ContinueFamilyReview);

// Study-only library: browse the same approved study-family records as the game.
const V66_POS=[['noun','Nouns'],['adjective','Adjectives'],['adverb','Adverbs'],['verb','Verbs / 3rd person'],['ing','Gerunds & -ing forms'],['past','Past tense'],['participle','Past participle / passive'],['other','Other forms']];
let v66PosSelected=new Set(V66_POS.map(x=>x[0]));
function v66AllPos(){return v66PosSelected.size===V66_POS.length}
function v66HasFocus(q){return (q.test_focus||['other']).some(k=>v66PosSelected.has(k))}
function v66FocusPool(items){return items.filter(v66HasFocus)}
function v66FilterLadder(){if(saved.mode!=='ladder'||v66AllPos())return; saved.mode='mix';selectedButton('[data-mode]','mode','mix');notify('Focused word forms use Classic Mix so no unwanted ladder steps appear.');}
function v66RenderPos(){
 const all=getPool();
 el('v66PosOptions').innerHTML=V66_POS.map(([key,title])=>{
   const count=all.filter(q=>(q.test_focus||[]).includes(key)).length;
   return `<label class="v66-pos-option"><input type="checkbox" data-v66pos="${key}" ${v66PosSelected.has(key)?'checked':''}/><span><b>${safe(title)}</b> <small>${count} source questions</small></span></label>`;
 }).join('');
 el('v66PosOptions').querySelectorAll('[data-v66pos]').forEach(input=>input.addEventListener('change',()=>{
   if(input.checked)v66PosSelected.add(input.dataset.v66pos);else v66PosSelected.delete(input.dataset.v66pos);
   v66FilterLadder();v66RenderPos();updatePlan();
 }));
 el('v66PosFeedback').textContent=v66PosSelected.size===V66_POS.length?'All types included':`${v66PosSelected.size} of ${V66_POS.length} types selected`;
}
el('v66PosAll').addEventListener('click',()=>{v66PosSelected=new Set(V66_POS.map(x=>x[0]));v66RenderPos();updatePlan();});
el('v66PosNone').addEventListener('click',()=>{v66PosSelected.clear();v66RenderPos();updatePlan();});
document.querySelectorAll('[data-pool]').forEach(b=>b.addEventListener('click',()=>v66RenderPos()));
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{v66FilterLadder();updatePlan();}));

let v66LibraryPool='both', v66LibraryLetter='ALL',v66LibraryBase=null;
function v66LibraryRows(){
 const d=new Map();
 for(const x of WB_FORMS){if(x.exclude_from_study||(v66LibraryPool!=='both'&&x.level!==v66LibraryPool))continue;
   const base=String(x.study_family||x.lemma).toLowerCase();if(!d.has(base))d.set(base,[]);d.get(base).push(x);}
 return [...d.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
}
function v66RenderLibrary(){
 const rows=v66LibraryRows(),search=el('v66LibrarySearch').value.trim().toLowerCase();
 const filtered=rows.filter(([base,forms])=>(v66LibraryLetter==='ALL'||base[0].toUpperCase()===v66LibraryLetter)&&(!search||base.includes(search)||forms.some(f=>f.word.toLowerCase().includes(search))));
 el('v66LibraryAlphabet').innerHTML=['ALL',...new Set(rows.map(([base])=>base[0].toUpperCase()))].map(k=>`<button type="button" data-v66letter="${safe(k)}" aria-pressed="${k===v66LibraryLetter}">${safe(k)}</button>`).join('');
 el('v66LibraryAlphabet').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{v66LibraryLetter=b.dataset.v66letter;v66RenderLibrary();}));
 el('v66LibraryCount').textContent=`${filtered.length} matching families (${rows.length} in source bank)`;
 if(!filtered.some(([base])=>base===v66LibraryBase))v66LibraryBase=filtered[0]?.[0]||null;
 el('v66LibraryList').innerHTML=filtered.length?filtered.map(([base])=>`<button type="button" data-v66base="${safe(base)}" class="v66-library-item ${base===v66LibraryBase?'selected':''}" aria-selected="${base===v66LibraryBase}"><b>${safe(base.toUpperCase())}</b><span>${[...new Set(rows.find(x=>x[0]===base)[1].map(x=>x.level))].join(' / ')}</span></button>`).join(''):'<p class="subtext">No matching family. Try another letter or level.</p>';
 el('v66LibraryList').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{v66LibraryBase=b.dataset.v66base;v66RenderLibrary();}));
 v66RenderLibraryDetail();
}
function v66RenderLibraryDetail(){
 const rows=v66LibraryRows();const data=rows.find(([base])=>base===v66LibraryBase);const target=el('v66LibraryDetails');
 if(!data){target.innerHTML='<h3>No family selected</h3><p>Try another filter.</p>';return;}
 const [base,forms]=data;const groups=new Map();const seen=new Set();
 for(const x of forms){const word=x.word.toLowerCase(),g=x.part_of_speech||'Other';const key=g+':'+word;if(seen.has(key))continue;seen.add(key);if(!groups.has(g))groups.set(g,[]);groups.get(g).push(word);}
 const displayGroup={noun:'Nouns',adjective:'Adjectives',adverb:'Adverbs',verb:'Verbs',negative:'Negative forms'};
 target.innerHTML=`<h3>${safe(base.toUpperCase())}</h3><p class="subtext">${[...new Set(forms.map(x=>x.level))].join(' + ')} source-bank family · ${seen.size} study forms</p>`+
 [...groups].map(([name,words])=>`<section class="v66-family-group"><h4>${safe(displayGroup[name]||name)}</h4><div class="v66-family-chips">${words.sort().map(w=>wordChip(w)).join('')}</div></section>`).join('')+
 (base==='university'?'<p class="tiny">Note: <em>universe</em> and <em>universal</em> share an older Latin root but have different modern meanings. <em>Universitarian</em> is very rare. These are study-only additions, not automatic exam answers.</p>':'')+
 '<p class="tiny">Tap or hover on a word to see its meaning where available.</p>';
 bindWordChips(target);
}
function v66OpenLibrary(){clearTimers();v66LibraryPool='both';v66LibraryLetter='ALL';v66LibraryBase=null;el('v66LibrarySearch').value='';show('v66LibraryView');v66RenderLibrary();window.scrollTo(0,0);location.hash='study-word-families';}
el('v66BrowseBtn').addEventListener('click',v66OpenLibrary);
el('v66LibraryBack').addEventListener('click',()=>{show('setup');try{history.replaceState(null,'',location.pathname+location.search);}catch(_){location.hash='';}window.scrollTo(0,0);});
el('v66LibrarySearch').addEventListener('input',()=>{v66LibraryLetter='ALL';v66RenderLibrary();});
el('v66LibraryPools').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
 v66LibraryPool=b.dataset.v66pool;v66LibraryLetter='ALL';v66LibraryBase=null;
 el('v66LibraryPools').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));v66RenderLibrary();
}));
v66RenderPos();
window.addEventListener('load',()=>{if(location.hash==='#study-word-families')v66OpenLibrary();});

renderRoster();updatePlan();show('setup');

