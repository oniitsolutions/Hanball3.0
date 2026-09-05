const $=id=>document.getElementById(id);
let state=JSON.parse(localStorage.getItem("hb3match")||"null");
let settings=JSON.parse(localStorage.getItem("hb3settings")||'{"beginnerHelp":true}');
let timer=null,pendingShot=null,lineupTeam="home",selectedCourt=null,multiSwap=false,multiOut=[],multiIn=[],helpFlow=null,helpIndex=0;

const PHASES=[
 {id:"reg1",label:"1st half",kind:"regular"},
 {id:"reg2",label:"2nd half",kind:"regular"},
 {id:"et1a",label:"Extra time 1 - 1st half",kind:"extra"},
 {id:"et1b",label:"Extra time 1 - 2nd half",kind:"extra"},
 {id:"et2a",label:"Extra time 2 - 1st half",kind:"extra"},
 {id:"et2b",label:"Extra time 2 - 2nd half",kind:"extra"},
 {id:"shootout",label:"7 m shootout",kind:"shootout"}
];

let screenHistory=["home"];
function currentScreenId(){
 const a=document.querySelector(".screen.active");
 return a?a.id:"home";
}
function showScreen(id,opts={}){
 const current=currentScreenId();
 if(!opts.fromBack && current!==id){
   if(screenHistory[screenHistory.length-1]!==current)screenHistory.push(current);
 }
 document.querySelectorAll(".screen").forEach(x=>x.classList.remove("active"));
 const s=$(id); if(s) s.classList.add("active");
 if(id==="scoreboard")render();
 if(id==="quick")renderQuick();
 if(id==="analysis"){analysisTeamChanged();renderAnalysisSummary();setTimeout(()=>{enableShotMapPan();applyShotMapTransform()},0)}
 if(id==="lineup")renderLineup();
 if(id==="sevenm")renderShootout();
 if(id==="report")setTimeout(renderMatchReport,0);
 if(id==="controlHub")setTimeout(renderControlHub,0);
}
function goBack(){
 if(currentScreenId()==="analysis")returnToHubAfterAnalysis=false;
 let target=screenHistory.pop();
 while(target===currentScreenId() && screenHistory.length)target=screenHistory.pop();
 if(!target)target="home";
 showScreen(target,{fromBack:true});
}
function showSetup(){applySavedTeamsToNewMatch();const d=$("setupDate");if(d)d.value=new Date().toISOString().slice(0,10);showScreen("setup")}
function showModePicker(){showScreen("modePicker")}
function continueMatch(){state?showScreen("scoreboard"):showSetup()}
function getModes(){return {scoreboard:$("modeScoreboard")?.checked,quick:$("modeQuick")?.checked,analysis:$("modeAnalysis")?.checked,full:$("modeFull")?.checked,lineup:$("modeLineup")?.checked}}
function defaultPlayers(){return Array.from({length:14},(_,i)=>({
 number:i+1,name:"Player "+(i+1),goals:0,shots:0,savesAgainst:0,blocks:0,posts:0,misses:0,turnovers:0,lastActions:[],twoMinRemaining:0
}))}
function startMatch(){
 const reg=+$("setupMinutes").value,extra=+$("extraMinutes").value;
 ensureSavedTeams();let ph=savedTeams.home.players.map(p=>({...defaultPlayers()[0],number:p.number,name:p.name})),pa=savedTeams.away.players.map(p=>({...defaultPlayers()[0],number:p.number,name:p.name}));
 state={
  home:{name:$("setupHome").value||"HOME",score:0,players:ph,lineup:ph.slice(0,7).map(p=>p.number),gkOut:false},
  away:{name:$("setupAway").value||"AWAY",score:0,players:pa,lineup:pa.slice(0,7).map(p=>p.number),gkOut:false},
  competition:$("setupCompetition").value,date:$("setupDate").value,regularSeconds:reg*60,extraSeconds:extra*60,
  phaseIndex:0,seconds:reg*60,running:false,modes:getModes(),shots:[],quickEvents:[],events:[],
  substitutions:[],shootout:{home:0,away:0,attempts:[]},timeline:[],playerCourtSeconds:{home:{},away:{}},nextMatchShotNo:1,playerShotCounters:{home:{},away:{}},nextShotNo:1
 };
 logEvent("Match started");save();showScreen("scoreboard")
}
function phase(){return PHASES[state?.phaseIndex||0]}
function phaseSeconds(p){return p.kind==="regular"?state.regularSeconds:state.extraSeconds}
function nextPhase(){
 if(!state)return;
 if(state.seconds>0||state.running){toast("Current period must finish first");return;}
 if(state.phaseIndex===1&&state.home.score!==state.away.score)return finishMatch();
 if(state.phaseIndex===3&&state.home.score!==state.away.score)return finishMatch();
 if(state.phaseIndex===5&&state.home.score!==state.away.score)return finishMatch();
 state.phaseIndex++;
 if(state.phaseIndex>=PHASES.length)return finishMatch();
 let p=phase();state.running=false;clearInterval(timer);
 if(p.kind==="shootout"){state.seconds=0;save();showScreen("sevenm");return}
 state.seconds=phaseSeconds(p);logEvent("Phase: "+p.label);save();render()
}
function finishMatch(){state.running=false;clearInterval(timer);logEvent("Match finished");save();toast("Match finished")}
function buildNav(){
 if(!state)return;
 let items=[["Match","scoreboard"]];
 if(state.modes.quick)items.push(["Quick","quick"]);
 if(state.modes.analysis||state.modes.full)items.push(["Analysis","analysis"]);
 if(state.modes.lineup)items.push(["Line-up","lineup"]);
 items.push(["Hub","controlHub"]);items.push(["Report","report"]);items.push(["Stats","stats"]);
 const n=$("dynamicNav"); if(n)n.innerHTML=items.map(([t,id])=>`<button onclick="${id==="stats"?"showStats()":`showScreen('${id}')`}">${t}</button>`).join("")
}
function render(){
 if(!state)return;
 $("homeName").textContent=state.home.name;$("awayName").textContent=state.away.name;
 $("homeScore").textContent=state.home.score;$("awayScore").textContent=state.away.score;
 $("clock").textContent=fmt(state.seconds);$("clockBtn").textContent=state.running?"Pause":"Start";
 $("phaseLabel").textContent=phase().label;$("competitionLabel").textContent=state.competition||"";if($("nextPhaseBtn")){$("nextPhaseBtn").classList.toggle("hidden",state.seconds>0||state.running);$("nextPhaseBtn").textContent=phase().id==="reg1"?"Start 2nd half":"Next phase";}
 buildNav();updateContinue()
}
function renderQuick(){
 if(!state)return;
 $("quickHomeName").textContent=state.home.name;$("quickAwayName").textContent=state.away.name;
 $("quickHomeScore").textContent=state.home.score;$("quickAwayScore").textContent=state.away.score;
 $("quickClock").textContent=fmt(state.seconds);$("quickPhase").textContent=phase().label;if($("quickClockOverlay")){$("quickClockOverlay").textContent=state.running?"⏸":"▶";$("quickClockOverlay").classList.toggle("show",!state.running&&!state.quickStarted)}
}
function updateContinue(){const e=$("continueInfo");if(e)e.textContent=state?`${state.home.name} ${state.home.score}:${state.away.score} ${state.away.name} • ${phase().label}`:"No active match"}
function fmt(s){s=Math.max(0,s|0);return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0")}
function toggleClock(){
 if(!state||phase().kind==="shootout")return;
 state.quickStarted=true;
 state.running=!state.running;
 if(state.running){clearInterval(timer);timer=setInterval(tick,1000)}else clearInterval(timer);
 save();render();
 if($("quick")?.classList.contains("active")){
   renderQuick();
   const ov=$("quickClockOverlay");
   if(ov){
     ov.textContent=state.running?"▶":"⏸";
     ov.classList.add("flash");
     setTimeout(()=>ov.classList.remove("flash"),320);
   }
 }
}
function tick(){
 if(!state||!state.running)return;
 if(state.seconds>0)state.seconds--;
 if(!state.playerCourtSeconds)state.playerCourtSeconds={home:{},away:{}};
 ["home","away"].forEach(team=>{
   if(!state.playerCourtSeconds[team])state.playerCourtSeconds[team]={};
   (state[team].lineup||[]).forEach(num=>state.playerCourtSeconds[team][num]=(state.playerCourtSeconds[team][num]||0)+1);
   (state[team].players||[]).forEach(p=>{if((p.twoMinRemaining||0)>0)p.twoMinRemaining=Math.max(0,p.twoMinRemaining-1)});
 });
 if(state.seconds<=0){state.running=false;clearInterval(timer);logEvent("Phase ended: "+phase().label)}
 save();render();if($("quick")?.classList.contains("active"))renderQuick();if($("controlHub")?.classList.contains("active"))renderControlHub()
}
function score(team,d){if(!state)return;state[team].score=Math.max(0,state[team].score+d);logEvent(`${state[team].name} ${d>0?"+1":"-1"} score correction`);save();render();if($("quick")?.classList.contains("active"))renderQuick();if($("controlHub")?.classList.contains("active"))renderControlHub()}
function quickEvent(team,type){if(!state)return;state.quickEvents.push({team,type,phase:phase().label,time:fmt(state.seconds)});if(type==="goal")state[team].score++;logEvent(`${state[team].name} quick ${type}`);save();renderQuick();toast(type)}
function undo(){
 if(!state||!state.events.length){toast("Nothing to undo");return}
 const last=state.events.pop();
 if(last.snapshot){
   const previousEvents=state.events;
   state=JSON.parse(last.snapshot);
   state.events=previousEvents;
   save();render();
   if($("quick")?.classList.contains("active"))renderQuick();
   if($("controlHub")?.classList.contains("active"))renderControlHub();
   if($("analysis")?.classList.contains("active")){renderPlayerShotDots(analysisAllPlayers);renderErrorPending();renderAnalysisSummary()}
   toast("Last action undone");
 }
}
function logEvent(text){
 if(!state)return;
 let clone=JSON.parse(JSON.stringify(state));clone.events=[];
 const ev={text,phase:phase().label,time:fmt(state.seconds),phaseSecondsRemaining:state.seconds,phaseIndex:state.phaseIndex,homeScore:state.home.score,awayScore:state.away.score};
 state.events.push({...ev,snapshot:JSON.stringify(clone)});
 if(!state.timeline)state.timeline=[];
 state.timeline.push(ev);
 if(state.events.length>500)state.events.shift()
}
function save(){if(state)localStorage.setItem("hb3match",JSON.stringify(state));updateContinue()}
function toggleFullscreen(){document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()}
function toast(s){const t=$("toast");if(!t)return;t.textContent=s;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1200)}

let shotMapZoom=1,shotMapPanX=0,shotMapPanY=0,shotMapDragging=false,shotMapDragStart=null;

function applyShotMapTransform(){
 const court=$("perspectiveCourt");
 const img=court?.querySelector("img");
 const layers=court?.querySelectorAll(".map-layer");
 if(!court||!img)return;
 const transform=`translate(${shotMapPanX}px,${shotMapPanY}px) scale(${shotMapZoom})`;
 img.style.transform=transform;
 img.style.transformOrigin="center center";
 if(layers)layers.forEach(l=>{l.style.transform=transform;l.style.transformOrigin="center center"});
}
function zoomShotMap(delta){
 shotMapZoom=Math.min(2.6,Math.max(1,+(shotMapZoom+delta).toFixed(2)));
 if(shotMapZoom===1){shotMapPanX=0;shotMapPanY=0}
 applyShotMapTransform();
 toast(`${Math.round(shotMapZoom*100)}%`);
}
function resetShotMapZoom(){shotMapZoom=1;shotMapPanX=0;shotMapPanY=0;applyShotMapTransform()}
function enableShotMapPan(){
 const court=$("perspectiveCourt");if(!court||court.dataset.panReady)return;
 court.dataset.panReady="1";
 court.addEventListener("pointerdown",e=>{
   if(shotMapZoom<=1)return;
   shotMapDragging=true;shotMapDragStart={x:e.clientX-shotMapPanX,y:e.clientY-shotMapPanY};
   court.setPointerCapture?.(e.pointerId);
 });
 court.addEventListener("pointermove",e=>{
   if(!shotMapDragging)return;
   shotMapPanX=e.clientX-shotMapDragStart.x;shotMapPanY=e.clientY-shotMapDragStart.y;
   applyShotMapTransform();
 });
 court.addEventListener("pointerup",e=>{shotMapDragging=false;court.releasePointerCapture?.(e.pointerId)});
 court.addEventListener("pointercancel",()=>{shotMapDragging=false});
 court.addEventListener("wheel",e=>{
   e.preventDefault();
   zoomShotMap(e.deltaY<0?0.2:-0.2);
 },{passive:false});
}
let analysisAllPlayers=false;

function ensureShotCounters(){
 if(!state)return;
 if(!state.nextMatchShotNo) state.nextMatchShotNo=1;
 if(!state.playerShotCounters) state.playerShotCounters={home:{},away:{}};
}
function analysisTeamChanged(){
 if(!state)return;
 analysisAllPlayers=false;
 const team=$("analysisTeam").value,sel=$("analysisPlayer");
 sel.innerHTML="";
 state[team].players.forEach((p,i)=>sel.add(new Option(`#${p.number} ${p.name}`,i)));
 pendingShot=null;
 $("allPlayersBtn")?.classList.remove("active");
 updateShotInstruction();renderPlayerShotDots();renderErrorPending();renderAnalysisSummary();
}
function analysisPlayerChanged(){
 analysisAllPlayers=false;
 $("allPlayersBtn")?.classList.remove("active");
 pendingShot=null;updateShotInstruction();renderPlayerShotDots();renderErrorPending();renderAnalysisSummary();
}
function currentPlayer(){let team=$("analysisTeam").value;return state[team].players[+$("analysisPlayer").value]}
function mapPoint(evt){
 const court=$("perspectiveCourt");
 const r=court.getBoundingClientRect();
 // Convert screen click back into the unzoomed/unpanned image coordinate system.
 const cx=r.left+r.width/2, cy=r.top+r.height/2;
 const localX=(evt.clientX-cx-shotMapPanX)/shotMapZoom + r.width/2;
 const localY=(evt.clientY-cy-shotMapPanY)/shotMapZoom + r.height/2;
 return {
   x:+((localX/r.width)*100).toFixed(2),
   y:+((localY/r.height)*100).toFixed(2)
 };
}
/* Goal bounds mapped onto the approved 3D background image. */
function isGoalPoint(p){return p.x>=40 && p.x<=60 && p.y>=3 && p.y<=23}
function newPendingShot(player,penalty=false){
 ensureShotCounters();
 const team=$("analysisTeam").value;
 const current=state.playerShotCounters[team][player.number]||0;
 return {
   team,playerNumber:player.number,playerName:player.name,
   playerShotNo:current+1,matchShotNo:state.nextMatchShotNo,
   origin:null,target:null,penalty
 };
}
function distancePct(a,b){
 const dx=a.x-b.x,dy=a.y-b.y;
 return Math.sqrt(dx*dx+dy*dy);
}
function shotMapTap(evt){
 if(!state||analysisAllPlayers){toast("Select one player to record an action");return}
 const p=mapPoint(evt),player=currentPlayer();
 if(errorFlow){
   if(isGoalPoint(p)){toast("Choose a position on the court");return}
   errorFlow.point=p;
   renderErrorPending();
   $("errorResultPanel").classList.remove("hidden");
   $("analysisInstruction").textContent="Choose FAULT or BM";
   return;
 }

 if(!pendingShot){
   if(isGoalPoint(p)){toast("Tap shooting position first, or choose 7 m");return}
   pendingShot=newPendingShot(player,false);
   pendingShot.origin=p;
   updateShotInstruction();renderPending();$("shotResultPanel").classList.remove("hidden");
   return;
 }

 // Tap selected target again to clear/reselect goal position.
 if(pendingShot.target && distancePct(p,pendingShot.target)<=3.0){
   pendingShot.target=null;
   updateShotInstruction();renderPending();
   $("shotResultPanel").classList.remove("hidden");
   toast("Goal position cleared - choose a new point in the goal");
   return;
 }

 // Tap selected origin again to clear/reselect court position.
 if(pendingShot.origin && !pendingShot.target && distancePct(p,pendingShot.origin)<=3.8){
   pendingShot.origin=null;
   $("shotResultPanel").classList.add("hidden");
   updateShotInstruction();renderPending();
   toast("Shot position cleared - choose a new position");
   return;
 }

 // If origin was cleared, next non-goal tap becomes corrected origin.
 if(!pendingShot.origin && !pendingShot.penalty){
   if(isGoalPoint(p)){toast("Choose shot position first");return}
   pendingShot.origin=p;
   updateShotInstruction();renderPending();$("shotResultPanel").classList.remove("hidden");
   return;
 }

 // If target is not selected, accept only a click inside the goal.
 if(!pendingShot.target){
   if(!isGoalPoint(p)){toast("Now tap inside the goal");return}
   pendingShot.target=p;
   updateShotInstruction();renderPending();$("shotResultPanel").classList.remove("hidden");
   return;
 }
}

let editingShotIndex=null;

function getSelectedPlayerLastShotIndex(){
 if(!state)return -1;
 const team=$("analysisTeam").value,p=currentPlayer();
 for(let i=state.shots.length-1;i>=0;i--){
   const s=state.shots[i];
   if(s.team===team && s.playerNumber===p.number)return i;
 }
 return -1;
}
function toggleEditLastShot(){
 if(!state||analysisAllPlayers){toast("Select one player first");return}
 const idx=getSelectedPlayerLastShotIndex();
 if(idx<0){toast("No saved shot to edit");return}
 editingShotIndex=idx;
 const s=state.shots[idx];
 pendingShot={
   team:s.team,playerNumber:s.playerNumber,playerName:s.playerName,
   playerShotNo:s.playerShotNo,matchShotNo:s.matchShotNo,
   origin:s.origin?{...s.origin}:null,target:s.target?{...s.target}:null,
   penalty:!!s.penalty,result:s.result
 };
 // For editing origin, clear target too so pairing remains deliberate.
 pendingShot.target=null;
 updateShotInstruction();renderPending();
 $("shotResultPanel").classList.remove("hidden");
 toast("Edit mode: tap the origin to clear it, then choose a new place");
}

function startErrorFlow(){
 if(!state||analysisAllPlayers){toast("Select one player first");return}
 const p=currentPlayer();
 pendingShot=null;
 errorFlow={team:$("analysisTeam").value,playerNumber:p.number,playerName:p.name,point:null};
 $("shotResultPanel").classList.add("hidden");
 $("errorResultPanel").classList.add("hidden");
 $("analysisInstruction").textContent="Tap where the turnover / error happened";
 renderPending();renderErrorPending();
}
function cancelErrorFlow(){
 errorFlow=null;$("errorResultPanel").classList.add("hidden");
 updateShotInstruction();renderErrorPending();
}
function renderErrorPending(){
 const layer=$("errorDots");if(!layer)return;
 const saved=(state?.timeline||[]).filter(e=>e.actionType==="error" && e.team===$("analysisTeam").value &&
   (analysisAllPlayers || e.playerNumber===currentPlayer()?.number));
 let h=saved.map(e=>`<span class="shot-number-dot error-dot ${e.errorType==="bm"?"bm":""}" style="left:${e.point.x}%;top:${e.point.y}%">${e.errorType==="bm"?"BM":"F"}</span>`).join("");
 if(errorFlow?.point)h+=`<span class="shot-number-dot shot-pending-dot" style="left:${errorFlow.point.x}%;top:${errorFlow.point.y}%">?</span>`;
 layer.innerHTML=h;
}
function completeError(type){
 if(!errorFlow?.point){toast("Choose the court position first");return}
 const p=state[errorFlow.team].players.find(x=>x.number===errorFlow.playerNumber);
 if(p){
   p.turnovers=(p.turnovers||0)+1;
   if(!p.lastActions)p.lastActions=[];
   p.lastActions.push("turnover");if(p.lastActions.length>5)p.lastActions.shift();
 }
 const ev={text:`${state[errorFlow.team].name} #${errorFlow.playerNumber}: ${type.toUpperCase()}`,
   phase:phase().label,time:fmt(state.seconds),phaseSecondsRemaining:state.seconds,phaseIndex:state.phaseIndex,
   homeScore:state.home.score,awayScore:state.away.score,actionType:"error",errorType:type,
   team:errorFlow.team,playerNumber:errorFlow.playerNumber,point:{...errorFlow.point}};
 if(!state.timeline)state.timeline=[];state.timeline.push(ev);
 let clone=JSON.parse(JSON.stringify(state));clone.events=[];
 state.events.push({...ev,snapshot:JSON.stringify(clone)});
 errorFlow=null;$("errorResultPanel").classList.add("hidden");
 save();renderErrorPending();updateShotInstruction();toast(type.toUpperCase()+" saved");
 if(returnToHubAfterAnalysis){returnToHubAfterAnalysis=false;setTimeout(()=>showScreen("controlHub"),120)}
}
function startPenaltyFlow(){
 if(!state||analysisAllPlayers){toast("Select one player first");return}
 let player=currentPlayer();
 pendingShot=newPendingShot(player,true);
 updateShotInstruction();renderPending();toast("7 m: tap directly inside the goal");
}
function updateShotInstruction(){
 const e=$("analysisInstruction"),r=$("shotResultPanel");if(!e)return;
 if(!pendingShot){
   e.textContent=analysisAllPlayers?"All players - match shot order":"1. Tap where the player shot from";
   if(r)r.classList.add("hidden");return;
 }
 if(pendingShot.penalty&&!pendingShot.target){
   e.textContent=`7 m - shot ${pendingShot.playerShotNo}: tap inside the goal`;return;
 }
 if(!pendingShot.origin&&!pendingShot.penalty){
   e.textContent=`Shot ${pendingShot.playerShotNo}: choose a new shooting position`;return;
 }
 if(pendingShot.origin&&!pendingShot.target){
   e.textContent=`Shot ${pendingShot.playerShotNo}: tap the same origin again to change it, or tap inside the goal`;return;
 }
 if(pendingShot.target)e.textContent=`Shot ${pendingShot.playerShotNo}: choose the result, or tap the goal point again to change it`;
}
function completeShot(result){
 if(!pendingShot){toast("Select a shot first");return}
 if(result==="block"){
   if(!pendingShot.origin){toast("Block needs a shooting position");return}
   pendingShot.target=null;
 } else if(!pendingShot.target){
   toast("Tap inside the goal first");return;
 }
 ensureShotCounters();
 const shot={...pendingShot,result,phase:phase().label,time:fmt(state.seconds)};
 if(editingShotIndex!==null){
   state.shots[editingShotIndex]=shot;
 } else {
   state.shots.push(shot);
   state.playerShotCounters[shot.team][shot.playerNumber]=shot.playerShotNo;
   state.nextMatchShotNo=shot.matchShotNo+1;
 }
 if(result==="goal")state[shot.team].score++;
 const player=state[shot.team].players.find(p=>p.number===shot.playerNumber);
 if(player){
   player.shots=(player.shots||0)+1;
   if(result==="goal")player.goals=(player.goals||0)+1;
   if(result==="save")player.savesAgainst=(player.savesAgainst||0)+1;
   if(result==="block")player.blocks=(player.blocks||0)+1;
   if(result==="post")player.posts=(player.posts||0)+1;
   if(result==="miss")player.misses=(player.misses||0)+1;
   if(!player.lastActions)player.lastActions=[];
   player.lastActions.push(result);if(player.lastActions.length>5)player.lastActions.shift();
 }
 logEvent(`${state[shot.team].name} #${shot.playerNumber} shot P${shot.playerShotNo}/M${shot.matchShotNo}: ${shot.penalty?"7m ":""}${result}`);
 pendingShot=null;editingShotIndex=null;save();renderPlayerShotDots(analysisAllPlayers);renderAnalysisSummary();render();updateShotInstruction();toast("Shot saved");
 if(returnToHubAfterAnalysis){returnToHubAfterAnalysis=false;setTimeout(()=>showScreen("controlHub"),120);}
}
function playerShots(){
 let team=$("analysisTeam").value,p=currentPlayer();
 return state.shots.filter(s=>s.team===team&&s.playerNumber===p.number);
}
function shotsForView(all=false){return all?state.shots.filter(s=>s.team===$("analysisTeam").value):playerShots()}
function displayNumber(s){return analysisAllPlayers?s.matchShotNo:s.playerShotNo}
function originDotClass(s){return s.result==="block"?"shot-block-dot":"shot-origin-dot"}
function targetDotClass(s){
 if(s.result==="goal")return "shot-goal-dot";
 if(s.result==="save")return "shot-save-dot";
 if(s.result==="post")return "shot-post-dot";
 if(s.result==="miss")return "shot-miss-dot";
 return "shot-origin-dot";
}
function dotHTML(s,point,cls){
 if(!point)return "";
 const no=displayNumber(s);
 return `<span class="shot-number-dot ${cls}" style="left:${point.x}%;top:${point.y}%"><span>${no}</span><title>#${s.playerNumber} • player shot ${s.playerShotNo} • match shot ${s.matchShotNo} • ${s.result}</title></span>`;
}
function renderPlayerShotDots(all=false){
 if(!state)return;
 analysisAllPlayers=all;
 const shots=shotsForView(all);
 $("originDots").innerHTML=shots.filter(s=>s.origin).map(s=>dotHTML(s,s.origin,originDotClass(s))).join("");
 $("goalDots").innerHTML=shots.filter(s=>s.target&&s.result!=="block").map(s=>dotHTML(s,s.target,targetDotClass(s))).join("");
 renderPending();
}
function renderPending(){
 const layer=$("pendingDotLayer");if(!layer)return;
 if(!pendingShot){layer.innerHTML="";return}
 const no=analysisAllPlayers?pendingShot.matchShotNo:pendingShot.playerShotNo;
 let h="";
 if(pendingShot.origin)h+=`<span class="shot-number-dot shot-pending-dot" style="left:${pendingShot.origin.x}%;top:${pendingShot.origin.y}%">${no}</span>`;
 if(pendingShot.target)h+=`<span class="shot-number-dot shot-pending-dot" style="left:${pendingShot.target.x}%;top:${pendingShot.target.y}%">${no}</span>`;
 layer.innerHTML=h;
}
function showAllShots(){
 if(!state)return;
 analysisAllPlayers=true;pendingShot=null;$("allPlayersBtn")?.classList.add("active");
 renderPlayerShotDots(true);renderErrorPending();renderAnalysisSummary();updateShotInstruction();toast("Showing all players in match shot order");
}
function renderAnalysisSummary(){
 if(!state)return;
 if(analysisAllPlayers){
   const shots=state.shots.filter(s=>s.team===$("analysisTeam").value),g=shots.filter(s=>s.result==="goal").length;
   $("analysisSummary").innerHTML=`<h3>All players</h3><p>Shots: ${shots.length} | Goals: ${g} | Shooting: ${shots.length?Math.round(g/shots.length*100):0}%</p><p>Numbers show match shot order.</p>`;
   return;
 }
 let p=currentPlayer(),shots=playerShots(),g=shots.filter(s=>s.result==="goal").length;
 $("analysisSummary").innerHTML=`<h3>#${p.number} ${p.name}</h3><p>Shots: ${shots.length} | Goals: ${g} | Shooting: ${shots.length?Math.round(g/shots.length*100):0}%</p><p>7 m attempts: ${shots.filter(s=>s.penalty).length}</p><p>Numbers show this player's personal shot order.</p>`;
}

function setLineupTeam(team){lineupTeam=team;selectedCourt=null;multiOut=[];multiIn=[];renderLineup()}
function getPlayer(team,num){return state[team].players.find(p=>p.number===num)}
function renderLineup(){
 if(!state)return;
 let t=state[lineupTeam],court=t.lineup.map(n=>getPlayer(lineupTeam,n)).filter(Boolean),bench=t.players.filter(p=>!t.lineup.includes(p.number));
 $("lineupStatus").textContent=`${t.name} • on court: ${t.lineup.length} • GK ${t.gkOut?"OUT":"ON"}${multiSwap?" • MULTI SWAP":""}`;
 $("courtPlayers").innerHTML=court.map(p=>`<button class="player-chip ${multiOut.includes(p.number)||selectedCourt===p.number?"selected":""}" onclick="courtTap(${p.number})">#${p.number}<br>${p.name}</button>`).join("");
 $("benchPlayers").innerHTML=bench.map(p=>`<button class="player-chip ${multiIn.includes(p.number)?"selected":""}" onclick="benchTap(${p.number})">#${p.number}<br>${p.name}</button>`).join("");
 $("multiSwapBtn").textContent=multiSwap?(multiOut.length&&multiOut.length===multiIn.length?"Apply multi swap":"Cancel multi swap"):"Multi swap"
}
function courtTap(num){if(multiSwap){multiOut.includes(num)?multiOut=multiOut.filter(n=>n!==num):multiOut.push(num);renderLineup();return}selectedCourt=selectedCourt===num?null:num;renderLineup()}
function benchTap(num){
 if(multiSwap){multiIn.includes(num)?multiIn=multiIn.filter(n=>n!==num):multiIn.push(num);renderLineup();return}
 if(selectedCourt===null){toast("Select player OUT first");return}
 doSwap(selectedCourt,num);selectedCourt=null;renderLineup()
}
function doSwap(outNum,inNum){
 let t=state[lineupTeam],idx=t.lineup.indexOf(outNum);if(idx<0)return;
 t.lineup[idx]=inNum;state.substitutions.push({team:lineupTeam,out:outNum,in:inNum,phase:phase().label,time:fmt(state.seconds)});
 logEvent(`${t.name}: #${outNum} OUT → #${inNum} IN`);save();toast(`#${outNum} OUT → #${inNum} IN`)
}
function toggleMultiSwap(){
 if(multiSwap&&multiOut.length&&multiOut.length===multiIn.length){
  const pairs=multiOut.map((o,i)=>[o,multiIn[i]]);pairs.forEach(([o,n])=>doSwap(o,n));multiSwap=false;multiOut=[];multiIn=[];renderLineup();return
 }
 multiSwap=!multiSwap;multiOut=[];multiIn=[];renderLineup()
}
function toggleGoalkeeper(){state[lineupTeam].gkOut=!state[lineupTeam].gkOut;logEvent(`${state[lineupTeam].name} GK ${state[lineupTeam].gkOut?"OUT":"IN"}`);save();renderLineup()}
function undoSubstitution(){
 let last=state.substitutions.pop();if(!last){toast("No substitution");return}
 let t=state[last.team],idx=t.lineup.indexOf(last.in);if(idx>=0)t.lineup[idx]=last.out;logEvent(`${t.name}: substitution undone`);save();renderLineup()
}

function shootout(team,goal){state.shootout.attempts.push({team,goal:!!goal});if(goal)state.shootout[team]++;logEvent(`${state[team].name} 7m ${goal?"goal":"miss"}`);save();renderShootout()}
function renderShootout(){if(!state)return;$("soHomeName").textContent=state.home.name;$("soAwayName").textContent=state.away.name;$("soHomeScore").textContent=state.shootout.home;$("soAwayScore").textContent=state.shootout.away;$("shootoutHistory").innerHTML=state.shootout.attempts.map((a,i)=>`<div>${i+1}. ${state[a.team].name}: ${a.goal?"GOAL":"MISS"}</div>`).join("")}



function openTimeEditor(){
 if(!state)return;
 $("editMinutes").value=Math.floor(state.seconds/60);
 $("editSeconds").value=state.seconds%60;
 showScreen("timeEditor");
}
function applyTimeEdit(){
 if(!state)return;
 const m=Math.max(0,parseInt($("editMinutes").value||"0",10));
 const s=Math.max(0,Math.min(59,parseInt($("editSeconds").value||"0",10)));
 state.seconds=m*60+s;
 logEvent(`Time corrected to ${fmt(state.seconds)}`);
 save();goBack();render();if($("quick")?.classList.contains("active"))renderQuick();if($("controlHub")?.classList.contains("active"))renderControlHub();
}
function elapsedEventSeconds(ev){
 let total=0;
 for(let i=0;i<ev.phaseIndex;i++){
   const p=PHASES[i]; total+=p.kind==="regular"?state.regularSeconds:(p.kind==="extra"?state.extraSeconds:0);
 }
 const p=PHASES[ev.phaseIndex];
 const len=p.kind==="regular"?state.regularSeconds:(p.kind==="extra"?state.extraSeconds:0);
 return total+Math.max(0,len-(ev.phaseSecondsRemaining||0));
}
function reportTimeline(){return (state.timeline||[]).map(e=>({...e,elapsed:elapsedEventSeconds(e)}))}
function drawSeriesChart(canvas,series){
 if(!canvas)return;
 const ctx=canvas.getContext("2d"),w=canvas.width,h=canvas.height,pad=42;
 ctx.clearRect(0,0,w,h);ctx.strokeStyle="rgba(255,255,255,.22)";ctx.fillStyle="#fff";ctx.font="12px Arial";
 ctx.beginPath();ctx.moveTo(pad,12);ctx.lineTo(pad,h-pad);ctx.lineTo(w-12,h-pad);ctx.stroke();
 const all=series.flatMap(s=>s.data),maxX=Math.max(1,...all.map(p=>p.x)),maxY=Math.max(1,...all.map(p=>p.y));
 series.forEach((s,si)=>{
   ctx.save();ctx.strokeStyle=si===0?"#fff":"#9fc7ff";ctx.lineWidth=3;ctx.setLineDash(si===0?[]:[7,5]);
   ctx.beginPath();let first=true;
   s.data.forEach(p=>{const x=pad+(p.x/maxX)*(w-pad-18),y=(h-pad)-(p.y/maxY)*(h-pad-18);if(first){ctx.moveTo(x,y);first=false}else ctx.lineTo(x,y)});
   ctx.stroke();ctx.restore();ctx.fillStyle=si===0?"#fff":"#9fc7ff";ctx.fillText(s.label,pad+si*180,18);
 });
}
function drawEventChart(canvas,events){
 if(!canvas)return;
 const ctx=canvas.getContext("2d"),w=canvas.width,h=canvas.height,pad=42;
 ctx.clearRect(0,0,w,h);ctx.strokeStyle="rgba(255,255,255,.22)";ctx.fillStyle="#fff";ctx.font="12px Arial";
 ctx.beginPath();ctx.moveTo(pad,12);ctx.lineTo(pad,h-pad);ctx.lineTo(w-12,h-pad);ctx.stroke();
 const maxX=Math.max(1,...events.map(e=>e.elapsed));
 events.forEach(e=>{
   const x=pad+(e.elapsed/maxX)*(w-pad-18),goal=/goal|score/i.test(e.text),turn=/turnover/i.test(e.text);
   if(!goal&&!turn)return;
   ctx.fillStyle=goal?"#9fc7ff":"#ffb37b";
   ctx.fillRect(x-2,goal?70:170,4,goal?70:55);
 });
 ctx.fillStyle="#9fc7ff";ctx.fillText("Goals",pad,18);ctx.fillStyle="#ffb37b";ctx.fillText("Turnovers",pad+90,18);
}
function renderMatchReport(){
 if(!state)return;
 const pts=reportTimeline();
 $("reportSummary").innerHTML=`<h2>${state.home.name} ${state.home.score}:${state.away.score} ${state.away.name}</h2><p>${state.competition||""} ${state.date||""}</p><p>Events: ${pts.length} | Shots: ${state.shots.length} | Substitutions: ${state.substitutions.length}</p>`;
 const scores=pts.map(e=>({x:e.elapsed,h:e.homeScore,a:e.awayScore}));
 drawSeriesChart($("scoreChart"),[{label:state.home.name,data:scores.map(p=>({x:p.x,y:p.h}))},{label:state.away.name,data:scores.map(p=>({x:p.x,y:p.a}))}]);
 drawEventChart($("eventChart"),pts);
 let rows=[];
 ["home","away"].forEach(team=>state[team].players.forEach(p=>{
   const sec=state.playerCourtSeconds?.[team]?.[p.number]||0;
   rows.push(`<div class="player-minute-row"><span>${state[team].name} #${p.number} ${p.name}</span><b>${Math.floor(sec/60)}:${String(sec%60).padStart(2,"0")}</b></div>`)
 }));
 $("playerMinutes").innerHTML="<h3>Playing time</h3>"+rows.join("");
 $("reportEvents").innerHTML="<h3>Match timeline</h3>"+pts.slice().reverse().map(e=>`<div class="report-event-row"><span>${e.phase} ${e.time}</span><span>${e.text}</span></div>`).join("");
}
function reportShareText(){return `${state.home.name} ${state.home.score}:${state.away.score} ${state.away.name}\n${state.competition||""}\nShots: ${state.shots.length} | Substitutions: ${state.substitutions.length}\nHandball Scoreboard 3.0`}
async function shareMatchReport(){
 if(!state)return;
 const text=reportShareText();
 if(navigator.share){try{await navigator.share({title:"Handball Match Report",text});return}catch(e){}}
 try{await navigator.clipboard.writeText(text);toast("Report copied - paste into WhatsApp or another app")}catch(e){toast("Sharing unavailable")}
}
function downloadMatchReport(){
 if(!state)return;
 const blob=new Blob([JSON.stringify({match:state,summary:reportShareText()},null,2)],{type:"application/json"});
 const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`handball-report-${state.date||"match"}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)
}

function ensurePlayerRuntime(){
 if(!state)return;
 ["home","away"].forEach(team=>{
   state[team].players.forEach(p=>{
     if(p.goals==null)p.goals=0;if(p.shots==null)p.shots=0;if(p.blocks==null)p.blocks=0;
     if(p.savesAgainst==null)p.savesAgainst=0;if(p.posts==null)p.posts=0;if(p.misses==null)p.misses=0;
     if(p.turnovers==null)p.turnovers=0;if(!p.lastActions)p.lastActions=[];if(p.twoMinRemaining==null)p.twoMinRemaining=0;
   })
 });
}
function actionDot(a){
 const cls={goal:"goal",save:"save",block:"block",post:"post",miss:"miss",turnover:"turnover"}[a]||"turnover";
 return `<i class="action-dot action-${cls}" title="${a}"></i>`;
}
function formatCourtTime(sec){sec=sec||0;return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,"0")}`}
function activePenaltyCount(team){return state[team].players.filter(p=>(p.twoMinRemaining||0)>0).length}
function expectedCourtCount(team){return Math.max(0,7-activePenaltyCount(team))}
function renderHubTeam(team){
 ensurePlayerRuntime();
 const box=$(team==="home"?"hubHomePlayers":"hubAwayPlayers"),t=state[team];
 box.innerHTML=t.players.map(p=>{
   const on=(t.lineup||[]).includes(p.number),mins=formatCourtTime(state.playerCourtSeconds?.[team]?.[p.number]||0);
   const short=`${p.goals||0}/${p.shots||0}`;
   const acts=(p.lastActions||[]).slice(-5).map(actionDot).join("");
   const pen=(p.twoMinRemaining||0)>0;
   const fast=`<div class="hub-fast-actions">
      <button onclick="hubQuickShot('${team}',${p.number},'goal')">Goal</button>
      <button onclick="hubQuickShot('${team}',${p.number},'miss')">Miss</button>
      <button onclick="hubQuickShot('${team}',${p.number},'block')">Block</button>
      <button onclick="hubQuickShot('${team}',${p.number},'post')">Post</button>
      <button class="detail-shot-btn" title="Open Shot Analysis" onclick="hubOpenShotAnalysis('${team}',${p.number})">◎</button>
   </div>`;
   if(team==="home"){
     return `<div class="hub-player-row home-row">
       <div class="hub-player-id">#${p.number}</div>
       <div class="hub-player-name" onclick="hubOpenShotAnalysis('${team}',${p.number})">${p.name}<br><small>${mins} on court${pen?` • 2m ${fmt(p.twoMinRemaining)}`:""}</small></div>
       <div class="hub-player-stat">${short}</div>
       <div class="hub-actions">${acts||'<span style="opacity:.25">-</span>'}</div>
       ${fast}
       <div class="hub-switch-wrap">
         <button class="hub-switch ${on?"on":""}" onclick="hubTogglePlayer('${team}',${p.number})"><span></span></button>
       </div>
     </div>`;
   }
   return `<div class="hub-player-row away-row">
     <div class="hub-player-id">#${p.number}</div>
     <div class="hub-player-name" onclick="hubOpenShotAnalysis('${team}',${p.number})">${p.name}</div>
     <div class="hub-player-stat">${short}</div>
     <div class="hub-actions">${acts||'<span style="opacity:.25">-</span>'}</div>
     ${fast}
   </div>`;
 }).join("");
 const count=(t.lineup||[]).length,expected=expectedCourtCount(team);
 if(team==="home"){
   $("hubHomeCount").textContent=`${count}/${expected} active`;
 }else{
   $("hubAwayCount").textContent=`Quick opponent tracking`;
 }
}
function renderHubWarnings(){
 let warnings=[];
 const actual=(state.home.lineup||[]).length,expected=expectedCourtCount("home"),name=state.home.name;
 if(actual>expected)warnings.push(`${name}: too many active players (${actual}/${expected}).`);
 else if(actual<expected)warnings.push(`${name}: too few active players (${actual}/${expected}).`);
 $("hubWarnings").innerHTML=warnings.length?warnings.map(w=>`<div class="hub-warning">${w}</div>`).join(""):`<div class="hub-warning ok">${name}: player count is valid.</div>`;
}
function renderControlHub(){
 if(!state)return;ensurePlayerRuntime();
 $("hubHomeName").textContent=state.home.name;$("hubAwayName").textContent=state.away.name;
 $("hubHomeTitle").textContent=state.home.name;$("hubAwayTitle").textContent=state.away.name;
 $("hubHomeScore").textContent=state.home.score;$("hubAwayScore").textContent=state.away.score;
 $("hubClock").textContent=fmt(state.seconds);$("hubPhase").textContent=phase().label;
 renderHubTeam("home");renderHubTeam("away");renderHubWarnings();
}

let errorFlow=null;
let returnToHubAfterAnalysis=false;

function hubQuickShot(team,num,result){
 ensurePlayerRuntime();
 const p=state[team].players.find(x=>x.number===num);if(!p)return;
 p.shots=(p.shots||0)+1;
 if(result==="goal"){p.goals=(p.goals||0)+1;state[team].score++}
 if(result==="block")p.blocks=(p.blocks||0)+1;
 if(result==="post")p.posts=(p.posts||0)+1;
 if(result==="miss")p.misses=(p.misses||0)+1;
 if(!p.lastActions)p.lastActions=[];
 p.lastActions.push(result);if(p.lastActions.length>5)p.lastActions.shift();
 logEvent(`${state[team].name} #${num}: ${result} (Hub quick action)`);
 save();renderControlHub();render();
}
function hubOpenShotAnalysis(team,num){
 returnToHubAfterAnalysis=true;
 analysisAllPlayers=false;
 showScreen("analysis");
 setTimeout(()=>{
   $("analysisTeam").value=team;
   analysisTeamChanged();
   const player=state[team].players.findIndex(p=>p.number===num);
   if(player>=0)$("analysisPlayer").value=String(player);
   analysisPlayerChanged();
   toast(`Shot Analysis: ${state[team].name} #${num}`);
 },0);
}
function hubTogglePlayer(team,num){
 let lineup=state[team].lineup||[],p=state[team].players.find(x=>x.number===num),idx=lineup.indexOf(num);
 if(idx>=0){lineup.splice(idx,1);state.substitutions.push({team,out:num,in:null,phase:phase().label,time:fmt(state.seconds)});logEvent(`${state[team].name}: #${num} OFF court`)}
 else{
   if((p.twoMinRemaining||0)>0){toast(`#${num} is serving 2 min`);return}
   lineup.push(num);state.substitutions.push({team,out:null,in:num,phase:phase().label,time:fmt(state.seconds)});logEvent(`${state[team].name}: #${num} ON court`)
 }
 state[team].lineup=lineup;save();renderControlHub();
}
function togglePlayerPenalty(team,num){
 const p=state[team].players.find(x=>x.number===num);if(!p)return;
 if((p.twoMinRemaining||0)>0){p.twoMinRemaining=0;logEvent(`${state[team].name} #${num}: 2 min cancelled`)}
 else{
   p.twoMinRemaining=120;
   const idx=(state[team].lineup||[]).indexOf(num);
   if(idx>=0)state[team].lineup.splice(idx,1);
   logEvent(`${state[team].name} #${num}: 2 min penalty`);
 }
 save();renderControlHub();
}
function playerStatRow(team,p){
 const sec=state.playerCourtSeconds?.[team]?.[p.number]||0,eff=p.shots?Math.round((p.goals||0)/p.shots*100):0;
 const acts=(p.lastActions||[]).slice(-5).map(actionDot).join("");
 return `<tr>
 <td>#${p.number}</td><td>${p.name}</td><td>${formatCourtTime(sec)}</td>
 <td>${p.goals||0}</td><td>${p.shots||0}</td><td>${eff}%</td>
 <td>${p.savesAgainst||0}</td><td>${p.blocks||0}</td><td>${p.posts||0}</td><td>${p.misses||0}</td>
 <td>${p.turnovers||0}</td><td><div class="mini-actions">${acts}</div></td>
 </tr>`;
}
function teamCompleteStats(team){
 ensurePlayerRuntime();const t=state[team],players=t.players;
 const goals=players.reduce((s,p)=>s+(p.goals||0),0),shots=players.reduce((s,p)=>s+(p.shots||0),0);
 const blocks=players.reduce((s,p)=>s+(p.blocks||0),0),saved=players.reduce((s,p)=>s+(p.savesAgainst||0),0);
 const teamTurnovers=(state.quickEvents||[]).filter(e=>e.team===team&&e.type==="turnover").length;
 return `<div class="complete-team-stats">
 <div class="stat-section-title"><h3>${t.name}</h3><b>${t.score}</b></div>
 <div class="stat-kpis">
   <div class="stat-kpi"><b>${goals}/${shots}</b>Shooting</div>
   <div class="stat-kpi"><b>${shots?Math.round(goals/shots*100):0}%</b>Efficiency</div>
   <div class="stat-kpi"><b>${teamTurnovers}</b>Turnovers</div>
   <div class="stat-kpi"><b>${blocks}</b>Blocks</div>
 </div>
 <table><thead><tr>
 <th>#</th><th>Player</th><th>Minutes</th><th>G</th><th>Shots</th><th>%</th><th>Saved</th><th>Blk</th><th>Post</th><th>Miss</th><th>TO</th><th>Last 5</th>
 </tr></thead><tbody>${players.map(p=>playerStatRow(team,p)).join("")}</tbody></table>
 </div>`;
}
function showStats(){
 if(!state){$("statsSummary").innerHTML='<p>No match data.</p>';showScreen("stats");return}
 ensurePlayerRuntime();
 const totalEvents=(state.timeline||[]).length,totalSubs=(state.substitutions||[]).length,totalShots=(state.shots||[]).length;
 $("statsSummary").innerHTML=`<h2>${state.home.name} ${state.home.score}:${state.away.score} ${state.away.name}</h2>
 <p>${state.competition||""} ${state.date||""}</p>
 <div class="stat-kpis">
 <div class="stat-kpi"><b>${totalShots}</b>Tracked shots</div>
 <div class="stat-kpi"><b>${totalEvents}</b>Events</div>
 <div class="stat-kpi"><b>${totalSubs}</b>Substitutions</div>
 <div class="stat-kpi"><b>${phase().label}</b>Phase</div>
 </div>`;
 $("statsTeams").innerHTML=teamCompleteStats("home")+teamCompleteStats("away");
 $("statsLineups").innerHTML=`<h3>Current line-ups</h3>
 <p><b>${state.home.name}:</b> ${(state.home.lineup||[]).map(n=>"#"+n).join(", ")}</p>
 <p><b>${state.away.name}:</b> ${(state.away.lineup||[]).map(n=>"#"+n).join(", ")}</p>`;
 $("statsSubstitutions").innerHTML=`<h3>Substitutions</h3>${(state.substitutions||[]).slice().reverse().map(s=>`<div class="report-event-row"><span>${s.phase} ${s.time}</span><span>${state[s.team].name}: ${s.out?"#"+s.out+" OUT":""} ${s.in?"#"+s.in+" IN":""}</span></div>`).join("")||"<p>No substitutions.</p>"}`;
 $("statsTimeline").innerHTML=`<h3>Match events</h3>${(state.timeline||[]).slice().reverse().map(e=>`<div class="report-event-row"><span>${e.phase} ${e.time}</span><span>${e.text}</span></div>`).join("")||"<p>No events.</p>"}`;
 showScreen("stats");
}


let teamSetupSide="home";
let savedTeams=JSON.parse(localStorage.getItem("hb3teams")||"null");

function ensureSavedTeams(){
 if(savedTeams)return;
 savedTeams={
   home:{name:"HOME",players:Array.from({length:14},(_,i)=>({number:i+1,name:"Player "+(i+1)}))},
   away:{name:"AWAY",players:Array.from({length:14},(_,i)=>({number:i+1,name:"Player "+(i+1)}))}
 };
}
function syncSavedTeamsFromState(){
 ensureSavedTeams();
 if(!state)return;
 ["home","away"].forEach(team=>{
   savedTeams[team]={
     name:state[team].name,
     players:state[team].players.map(p=>({number:p.number,name:p.name}))
   };
 });
 localStorage.setItem("hb3teams",JSON.stringify(savedTeams));
}
function openTeamSetup(){
 ensureSavedTeams();
 if(state)syncSavedTeamsFromState();
 teamSetupSide="home";
 renderTeamSetup();
 showScreen("teamSetup");
}
function setTeamSetupSide(side){
 teamSetupSide=side;
 renderTeamSetup();
}
function renderTeamSetup(){
 ensureSavedTeams();
 const team=savedTeams[teamSetupSide];
 $("teamSetupName").value=team.name;
 $("teamSetupHomeBtn").classList.toggle("active",teamSetupSide==="home");
 $("teamSetupAwayBtn").classList.toggle("active",teamSetupSide==="away");
 $("teamSetupPlayers").innerHTML=team.players.map((p,i)=>`
   <div class="team-setup-row">
     <input type="number" min="0" max="99" value="${p.number}" onchange="updateTeamPlayer(${i},'number',this.value)">
     <input value="${p.name}" onchange="updateTeamPlayer(${i},'name',this.value)">
     <button onclick="removeTeamSetupPlayer(${i})">×</button>
   </div>`).join("");
}
function updateTeamSetupName(v){
 ensureSavedTeams();savedTeams[teamSetupSide].name=v;
}
function updateTeamPlayer(i,key,v){
 ensureSavedTeams();
 if(key==="number")savedTeams[teamSetupSide].players[i].number=parseInt(v||"0",10);
 else savedTeams[teamSetupSide].players[i].name=v;
}
function addTeamSetupPlayer(){
 ensureSavedTeams();
 const arr=savedTeams[teamSetupSide].players;
 const next=(arr.length?Math.max(...arr.map(p=>+p.number||0))+1:1);
 arr.push({number:next,name:"Player "+next});
 renderTeamSetup();
}
function removeTeamSetupPlayer(i){
 ensureSavedTeams();
 savedTeams[teamSetupSide].players.splice(i,1);
 renderTeamSetup();
}
function saveTeamSetup(){
 ensureSavedTeams();
 localStorage.setItem("hb3teams",JSON.stringify(savedTeams));
 if(state){
   ["home","away"].forEach(team=>{
     state[team].name=savedTeams[team].name;
     // preserve runtime stats where player number exists
     const oldByNum=Object.fromEntries(state[team].players.map(p=>[p.number,p]));
     state[team].players=savedTeams[team].players.map(p=>{
       const old=oldByNum[p.number]||{};
       return {...old,number:p.number,name:p.name};
     });
   });
   save();
 }
 toast("Team setup saved");
 renderTeamSetup();
}
function applySavedTeamsToNewMatch(){
 ensureSavedTeams();
 if($("setupHome"))$("setupHome").value=savedTeams.home.name;
 if($("setupAway"))$("setupAway").value=savedTeams.away.name;
}

const HELP={
 home:[{el:"#homeNew",title:"Create a match",text:"Start here when you want to create a match manually."},{el:"#homeContinue",title:"Continue",text:"Resume the currently stored match without losing its state."},{el:"#homeHelp",title:"Help & Guide",text:"Replay tutorials at any time."}],
 setup:[{el:"#helpSetupHome",title:"Teams",text:"Enter teams or later import them from competition data."},{el:"#helpModeButton",title:"Choose modules",text:"Enable only the modules you need."}],
 modes:[{el:"#modeCardScoreboard",title:"Scoreboard",text:"Clock and score."},{el:"#modeCardAnalysis",title:"Shot Analysis",text:"Track origin and target of every shot."},{el:"#modeCardLineup",title:"Line-up",text:"Track substitutions and who is on court."}],
 scoreboard:[{el:"#scoreHome",title:"Score correction",text:"Use + or - if you need to correct score."},{el:"#clock",title:"Match clock",text:"Every event is stored against match time."},{el:"#dynamicNav",title:"Modules",text:"Enabled modules appear here."}],
 quick:[{el:".quick-score-strip",title:"Live score",text:"Quick Stats keeps score, time and phase visible."},{el:"#quickGrid",title:"Fast events",text:"Large buttons for minimal taps."}],
 analysis:[{el:"#analysisPlayer",title:"Player filter",text:"Maps show only the selected player's shot pairs."},{el:"#perspectiveCourt",title:"Shot origin",text:"Tap from where the player shot. This view looks from midfield toward goal."},{el:"#goalTarget",title:"Shot target",text:"Tap where the ball went. The same shot number appears on court and goal."}],
 controlHub:[{el:".hub-scoreboard",title:"Live match overview",text:"Score and clock always stay visible."},{el:"#hubHomePlayers",title:"Player switches",text:"Green means on court, red means bench. The app warns when the active count is invalid."}],
 lineup:[{el:"#courtPlayers",title:"Court",text:"Tap player OUT."},{el:"#benchPlayers",title:"Bench",text:"Tap player IN."},{el:"#multiSwapBtn",title:"Multi swap",text:"Swap several players at the same match time."}]
};
function startHelp(name){if(!HELP[name])return;helpFlow=HELP[name];helpIndex=0;$("helpOverlay").classList.remove("hidden");showHelpStep()}
function showHelpStep(){
 let step=helpFlow[helpIndex],el=document.querySelector(step.el);if(!el){nextHelp();return}
 let r=el.getBoundingClientRect(),pad=8,sp=$("helpSpotlight"),bubble=$("helpBubble");
 sp.style.left=(r.left-pad)+"px";sp.style.top=(r.top-pad)+"px";sp.style.width=(r.width+pad*2)+"px";sp.style.height=(r.height+pad*2)+"px";
 $("helpStepTitle").textContent=step.title;$("helpStepText").textContent=step.text;$("helpCounter").textContent=`${helpIndex+1} / ${helpFlow.length}`;
 let bw=Math.min(390,window.innerWidth-20),left=Math.max(10,Math.min(window.innerWidth-bw-10,r.left)),top=r.bottom+18;if(top+190>window.innerHeight)top=Math.max(10,r.top-190);
 bubble.style.left=left+"px";bubble.style.top=top+"px";let tp=$("tapPulse");tp.style.display="block";tp.style.left=(r.left+r.width/2-13)+"px";tp.style.top=(r.top+r.height/2-13)+"px"
}
function nextHelp(){if(!helpFlow)return;if(helpIndex>=helpFlow.length-1)return closeHelp();helpIndex++;showHelpStep()}
function prevHelp(){if(!helpFlow)return;helpIndex=Math.max(0,helpIndex-1);showHelpStep()}
function closeHelp(){$("helpOverlay").classList.add("hidden");$("tapPulse").style.display="none";helpFlow=null}
function saveSettings(){settings.beginnerHelp=$("beginnerHelp").checked;localStorage.setItem("hb3settings",JSON.stringify(settings))}
window.addEventListener("resize",()=>{if(helpFlow)showHelpStep()});
window.addEventListener("beforeunload",save);

if($("setupDate"))$("setupDate").value=new Date().toISOString().slice(0,10);
if($("beginnerHelp"))$("beginnerHelp").checked=settings.beginnerHelp!==false;
updateContinue();


window.addEventListener("load",()=>{
 const img=document.querySelector('img[src="assets/shot_analysis_court.png"]');
 if(img){
   img.addEventListener("error",()=>console.error("Shot Analysis court image failed to load from assets/shot_analysis_court.png"));
 }
});
