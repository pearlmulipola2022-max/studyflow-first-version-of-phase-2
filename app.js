/* StudyFlow v1.0. Fictional sample data, in-memory only; no credentials or tracking. */
"use strict";
const $ = selector => document.querySelector(selector);
const courses = [
  {id:"HCS386", name:"Human–Computer Interaction"},
  {id:"HCS208", name:"Programming Fundamentals"},
  {id:"FND101", name:"Academic Skills"}
];
const labels = {dashboard:"Dashboard",tasks:"Task planner",learning:"Learning",progress:"Progress",reminders:"Reminders",help:"Help & data",editor:"Task details",review:"Review task"};
const localDay = (offset=0) => {
  const date = new Date();
  date.setDate(date.getDate()+offset);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
};
const displayDate = value => new Date(`${value}T12:00:00`).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const courseName = id => courses.find(course => course.id===id)?.name || id;
const options = (selected="",blank=false) => `${blank?'<option value="">Choose a course</option>':""}${courses.map(course=>`<option value="${course.id}" ${selected===course.id?"selected":""}>${course.id} · ${course.name}</option>`).join("")}`;
function sampleState() {
  return {
    version:1,
    tasks:[
      {id:"sample-1",title:"Prepare HCI prototype wireframes",course:"HCS386",due:localDay(2),priority:"High",done:false,notes:"Outline the dashboard and task-planning screens.",subtasks:[{text:"Sketch dashboard layout",done:false},{text:"Map the task flow",done:false}]},
      {id:"sample-2",title:"Practise JavaScript functions",course:"HCS208",due:localDay(),priority:"Medium",done:false,notes:"Revise parameters and return values.",subtasks:[]},
      {id:"sample-3",title:"Draft an essay introduction",course:"FND101",due:localDay(-1),priority:"High",done:false,notes:"Use the sample outline from class.",subtasks:[]},
      {id:"sample-4",title:"Read the HCI design principles",course:"HCS386",due:localDay(4),priority:"Low",done:true,notes:"Review consistency, feedback and user control.",subtasks:[]}
    ],
    quiz:null,
    reflection:"",
    preferences:{enabled:true,frequency:"Daily summary",leadDays:"2"}
  };
}
let state = sampleState();
let currentView = "dashboard";
let filters = {search:"",course:"all",status:"all"};
let draft = null;
let deleted = null;
let modalReturnFocus = null;
let practiceAnswer = "";
let quizAnswers = {};
document.documentElement.dataset.theme = matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light";
function updateThemeLabel() {
  const dark = document.documentElement.dataset.theme==="dark";
  $("#theme-button").textContent = dark?"Light theme":"Dark theme";
  $("#theme-button").setAttribute("aria-label",dark?"Switch to light theme":"Switch to dark theme");
}
updateThemeLabel();
$(".skip").addEventListener("click",event=>{
  event.preventDefault();
  $("#main").focus();
  $("#main").scrollTop=0;
});
$("#theme-button").addEventListener("click",()=>{
  document.documentElement.dataset.theme = document.documentElement.dataset.theme==="dark"?"light":"dark";
  updateThemeLabel();
});
function notify(message,isError=false,undo=false) {
  const notice = $("#notice");
  notice.innerHTML = `${escapeHTML(message)}${undo||deleted?'<button class="secondary" data-action="undo-delete">Undo delete</button>':""}`;
  notice.classList.toggle("error",isError);
  notice.hidden=false;
}
function navigate(view,focus=true) {
  if (!(view in labels)) view="dashboard";
  currentView=view;
  $("#breadcrumb").textContent=`Workspace / ${labels[view]}`;
  document.querySelectorAll("[data-view]").forEach(link=>{
    const selected=link.dataset.view===(["editor","review"].includes(view)?"tasks":view);
    if (selected) link.setAttribute("aria-current","page"); else link.removeAttribute("aria-current");
  });
  render();
  if (focus) {
    $("#main").scrollTop=0;
    $("#view h1")?.focus({preventScroll:true});
  }
}
function route() {
  const view=location.hash.slice(1)||"dashboard";
  if (["editor","review"].includes(view)&&!draft) {
    location.hash="tasks";
    return;
  }
  navigate(view);
}
window.addEventListener("hashchange",route);
function go(view) {
  if (location.hash===`#${view}`) navigate(view);
  else location.hash=view;
}
function heading(title,description,action="") {
  return `<div class="heading"><div><h1 tabindex="-1">${title}</h1><p>${description}</p></div>${action}</div>`;
}
function totals(course="all") {
  const tasks=state.tasks.filter(task=>course==="all"||task.course===course);
  const done=tasks.filter(task=>task.done).length;
  return {total:tasks.length,done,percent:tasks.length?Math.round(done/tasks.length*100):0};
}
function dueLabel(task) {
  if (task.done) return "Completed";
  if (task.due<localDay()) return "Overdue";
  if (task.due===localDay()) return "Due today";
  return "Upcoming";
}
function taskRow(task,compact=false) {
  return `<article class="task-row ${task.done?"done":""}">
    <label class="check-label"><input type="checkbox" data-task-check="${task.id}" ${task.done?"checked":""} aria-label="${escapeHTML(`Mark ${task.title} ${task.done?"incomplete":"complete"}`)}"></label>
    <div><button class="task-title" data-action="edit" data-id="${task.id}">${escapeHTML(task.title)}</button>
      <div class="task-meta"><span>${task.course}</span><span>${displayDate(task.due)}</span><span class="badge ${!task.done&&(task.due<=localDay()||task.priority==="High")?"urgent":""}">${dueLabel(task)}</span><span>${task.priority} priority</span></div>
      ${task.subtasks.length?`<p class="small muted">${task.subtasks.filter(sub=>sub.done).length}/${task.subtasks.length} subtasks complete</p>`:""}
      ${!compact&&task.subtasks.length?`<div class="subtasks">${task.subtasks.map((sub,i)=>`<label><input type="checkbox" data-subtask="${task.id}" data-index="${i}" ${sub.done?"checked":""}>${escapeHTML(sub.text)}</label>`).join("")}</div>`:""}
    </div>
    ${compact?"":`<div class="task-actions"><button class="quiet" data-action="edit" data-id="${task.id}">Edit</button><button class="quiet" data-action="delete" data-id="${task.id}" aria-label="Delete ${escapeHTML(task.title)}">Delete</button></div>`}
  </article>`;
}
function dashboard() {
  const tally=totals();
  const pending=state.tasks.filter(task=>!task.done).sort((a,b)=>a.due.localeCompare(b.due));
  const dueCount=pending.filter(task=>task.due<=localDay(7)).length;
  return `${heading("Make room for focused study.","Your deadlines, next steps, and learning in one place.",'<button class="primary" data-action="add">+ Add Task</button>')}
    <div class="metrics">
      <div class="metric"><p>Open tasks</p><div><strong>${pending.length}</strong><small>across your courses</small></div></div>
      <div class="metric"><p>Due soon or overdue</p><div><strong>${dueCount}</strong><small>through the next 7 days</small></div></div>
      <div class="metric"><p>Tasks completed</p><div><strong>${tally.percent}%</strong><small>${tally.done} of ${tally.total}</small></div></div>
    </div>
    <div class="dashboard-grid">
      <section class="panel"><div class="panel-title"><h2>Your next deadlines</h2><a href="#tasks">View all tasks</a></div>
        ${pending.length?pending.slice(0,4).map(task=>taskRow(task,true)).join(""):'<div class="empty"><h2>You’re all caught up.</h2><p>Add a new task when you are ready.</p><button class="primary" data-action="add">Add Task</button></div>'}
      </section>
      <div>
        <section class="panel focus-panel"><span class="module-index">LEARNING / ACADEMIC SKILLS</span><h2>A better plan starts small.</h2><p>Practise breaking a large assignment into clear, manageable actions.</p><p>One short module · 3-question quiz</p><a class="button" href="#learning">${state.quiz?"Revisit learning module":"Start learning module"}</a></section>
        <section class="panel course-summary"><div class="panel-title"><h2>Your courses</h2></div><ul class="plain">${courses.map(course=>`<li><span>${course.id}</span><span class="small muted">${totals(course.id).done}/${totals(course.id).total} tasks complete</span></li>`).join("")}</ul><div class="actions"><a href="#progress">See your progress</a></div></section>
      </div>
    </div>`;
}
function taskList() {
  const filtered=state.tasks.filter(task=>
    (filters.course==="all"||task.course===filters.course)&&
    (filters.status==="all"||(filters.status==="complete"?task.done:filters.status==="overdue"?!task.done&&task.due<localDay():!task.done))&&
    task.title.toLowerCase().includes(filters.search.toLowerCase())
  ).sort((a,b)=>Number(a.done)-Number(b.done)||a.due.localeCompare(b.due));
  return `${heading("Your study, one task at a time.","Create a plan. Break it down. Keep moving.",'<button class="primary" data-action="add">+ Add Task</button>')}
    <div class="toolbar">
      <label>Search tasks<input id="task-search" type="search" value="${escapeHTML(filters.search)}" placeholder="Search by task name"></label>
      <label>Course<select id="course-filter"><option value="all">All courses</option>${options(filters.course)}</select></label>
      <label>Status<select id="status-filter">${[["all","All tasks"],["open","Open"],["complete","Completed"],["overdue","Overdue"]].map(([value,label])=>`<option value="${value}" ${filters.status===value?"selected":""}>${label}</option>`).join("")}</select></label>
    </div>
    <p class="small muted" id="task-count">${filtered.length} matching task${filtered.length===1?"":"s"} · Due date order</p>
    <section class="panel" id="task-results" style="margin-top:var(--space-4)">${filtered.length?filtered.map(task=>taskRow(task)).join(""):'<div class="empty"><h2>No matching tasks.</h2><p>Clear your filters or add a new study task.</p><button class="secondary" data-action="clear-filters">Clear filters</button></div>'}</section>`;
}
function newTask() {
  draft={id:null,title:"",course:"",due:localDay(1),priority:"Medium",notes:"",subtasks:[],done:false};
  go("editor");
}
function editTask(id) {
  const task=state.tasks.find(item=>item.id===id);
  if (!task) return;
  draft=structuredClone(task);
  go("editor");
}
function editor() {
  if (!draft) return "";
  return `${heading(draft.id?"Edit your study task":"Add a study task","Keep the next action clear and achievable.")}
    <ol class="steps"><li aria-current="step">1. Task details</li><li>2. Review &amp; save</li></ol>
    <section class="panel form-panel"><form id="task-form" novalidate>
      <div id="form-summary" class="form-error" role="alert"></div>
      <div class="form-grid">
        <label class="span-all" for="task-title">Task name <span class="muted">(required)</span><input id="task-title" maxlength="100" value="${escapeHTML(draft.title)}" required aria-describedby="title-error" placeholder="e.g. Draft the HCI report introduction"><span id="title-error" class="form-error"></span></label>
        <label for="task-course">Course <span class="muted">(required)</span><select id="task-course" required aria-describedby="course-error">${options(draft.course,true)}</select><span id="course-error" class="form-error"></span></label>
        <label for="task-date">Due date <span class="muted">(required)</span><input id="task-date" type="date" value="${draft.due}" required aria-describedby="date-help date-error"><span id="date-help" class="form-help">New deadlines must be today or later.</span><span id="date-error" class="form-error"></span></label>
        <label for="task-priority">Priority<select id="task-priority">${["Low","Medium","High"].map(priority=>`<option ${draft.priority===priority?"selected":""}>${priority}</option>`).join("")}</select></label>
        <label class="span-all" for="task-subtasks">Subtasks <span class="muted">(optional)</span><textarea id="task-subtasks" rows="3" aria-describedby="subtask-help" placeholder="Find three sources&#10;Draft an outline">${escapeHTML(draft.subtasks.map(sub=>sub.text).join("\n"))}</textarea><span class="form-help" id="subtask-help">One action per line. Up to 10 subtasks, 120 characters each.</span></label>
        <label class="span-all" for="task-notes">Notes <span class="muted">(optional)</span><textarea id="task-notes" rows="2" maxlength="1000">${escapeHTML(draft.notes)}</textarea></label>
      </div>
      <div class="actions"><button class="primary" type="submit">Review Task</button><button class="secondary" type="button" data-action="cancel-edit">Cancel</button></div>
    </form></section>`;
}
function readDraft(form) {
  const title=$("#task-title").value.trim();
  const course=$("#task-course").value;
  const due=$("#task-date").value;
  const subtasks=$("#task-subtasks").value.split("\n").map(text=>text.trim()).filter(Boolean);
  const errors={};
  if (!title) errors["task-title"]="Enter a task name.";
  if (!courses.some(item=>item.id===course)) errors["task-course"]="Choose a course.";
  const original=state.tasks.find(task=>task.id===draft.id);
  if (!due) errors["task-date"]="Choose a due date.";
  else if (due<localDay()&&due!==original?.due) errors["task-date"]="Choose today or a future date.";
  if (subtasks.length>10||subtasks.some(text=>text.length>120)) errors["task-subtasks"]="Use up to 10 subtasks, each under 121 characters.";
  for (const id of ["task-title","task-course","task-date","task-subtasks"]) {
    document.getElementById(id).setAttribute("aria-invalid",errors[id]?"true":"false");
  }
  $("#title-error").textContent=errors["task-title"]||"";
  $("#course-error").textContent=errors["task-course"]||"";
  $("#date-error").textContent=errors["task-date"]||"";
  $("#form-summary").textContent=Object.values(errors).join(" ");
  if (Object.keys(errors).length) {document.getElementById(Object.keys(errors)[0]).focus(); return false;}
  const previous=draft.subtasks;
  draft={...draft,title,course,due,priority:$("#task-priority").value,notes:$("#task-notes").value.trim(),
    subtasks:subtasks.map(text=>({text,done:previous.find(sub=>sub.text===text)?.done||false}))};
  if (draft.subtasks.length) draft.done=draft.subtasks.every(sub=>sub.done);
  return true;
}
function review() {
  return `${heading("Check your study plan.","Review the details before saving.")}
    <ol class="steps"><li>1. Task details</li><li aria-current="step">2. Review &amp; save</li></ol>
    <section class="panel form-panel"><h2>${escapeHTML(draft.title)}</h2>
      <dl class="review"><dt>Course</dt><dd>${draft.course} · ${courseName(draft.course)}</dd><dt>Due date</dt><dd>${displayDate(draft.due)}</dd><dt>Priority</dt><dd>${draft.priority}</dd><dt>Subtasks</dt><dd>${draft.subtasks.length?draft.subtasks.map(sub=>escapeHTML(sub.text)).join("<br>"):"No subtasks"}</dd><dt>Notes</dt><dd>${escapeHTML(draft.notes)||"No notes"}</dd></dl>
      <div class="actions"><button class="primary" data-action="save-task">Save Task</button><button class="secondary" data-action="back-edit">Back to details</button><button class="quiet" data-action="cancel-edit">Cancel</button></div>
    </section>`;
}
const questions=[
  {text:"Which is the clearest study task?",answers:["Work on everything","Draft the introduction for the HCI report","Do university work"],correct:1,why:"A specific action names what you will do and what you are working on."},
  {text:"What is a useful first step for a large assignment?",answers:["Wait until the final day","Break it into smaller actions","Add more unrelated tasks"],correct:1,why:"Smaller actions make it easier to start and see what remains."},
  {text:"How should you check a study plan?",answers:["Keep deadlines only in memory","Hide completed work","Review deadlines and update completed actions"],correct:2,why:"Reviewing deadlines and recording completed actions keeps the plan current."}
];
function learning() {
  return `${heading("Small steps, steady progress.","Academic Skills · Sample learning module")}
    <section class="panel prose">
      <p class="eyebrow">MODULE 01 / STUDY PLANNING</p><h2>Turn an assignment into a plan</h2>
      <p><strong>Learning objective:</strong> Write a clear study task and break an assignment into manageable actions.</p>
      <p>Think about your next assignment. What is one action you could complete today?</p>
      <h2>Make the action specific</h2><p>Use an action word, name the work, and set a realistic due date. “Study more” is broad; “Draft the introduction for my HCI report” gives you a next step.</p>
      <div class="example"><strong>Example: Prepare an HCI report</strong><ol><li>Read the assessment requirements.</li><li>Find three relevant sources.</li><li>Draft the introduction.</li><li>Review the draft against the requirements.</li></ol></div>
      <h2>Try one practice question</h2>
      <form id="practice-form"><fieldset><legend>Which action is easier to start?</legend><label><input type="radio" name="practice" value="broad" ${practiceAnswer==="broad"?"checked":""}>Finish the whole project</label><label><input type="radio" name="practice" value="specific" ${practiceAnswer==="specific"?"checked":""}>Sketch the dashboard screen</label></fieldset><button class="secondary">Check practice answer</button><div id="practice-feedback" role="status"></div></form>
      <h2>Check your understanding</h2><p>Answer all three questions. Your score will appear on Progress.</p>
      <form id="quiz-form" novalidate>${questions.map((question,i)=>`<fieldset><legend>${i+1}. ${question.text}</legend>${question.answers.map((answer,j)=>`<label><input type="radio" name="q${i}" value="${j}" ${String(quizAnswers[i])===String(j)?"checked":""}>${answer}</label>`).join("")}</fieldset>`).join("")}
        <button class="primary">Submit Quiz</button><div id="quiz-feedback" role="status">${state.quiz?quizFeedback():""}</div>
      </form>
      <h2>Use this in your own study</h2><p>Create one specific task in Task planner, then divide it into two or three smaller actions.</p>
      <form id="reflection-form"><label for="reflection">Study reflection <span class="muted">(optional)</span><textarea id="reflection" rows="3" maxlength="1000" placeholder="What will you do differently in your next study session?">${escapeHTML(state.reflection)}</textarea></label><div class="actions"><button class="secondary">Save reflection</button><a class="button" href="#progress">View progress</a></div></form>
    </section>`;
}
function quizFeedback() {
  if (!state.quiz) return "";
  return `<div class="feedback"><h3>Quiz submitted · ${state.quiz.score}/3 correct</h3><p class="small">Latest attempt · ${state.quiz.score===3?"You identified all three planning strategies.":"Review the explanations, then try again."}</p><ol>${questions.map((question,i)=>`<li><strong>${state.quiz.answers[i]===question.correct?"Correct":"Review"}:</strong> ${question.answers[question.correct]}. ${question.why}</li>`).join("")}</ol><p class="small muted">This practice score is not a university grade.</p></div>`;
}
function progressView() {
  const count=totals();
  return `${heading("See how far you’ve come.","Task completion and your latest practice result, not academic grades.")}
    <div class="metrics"><div class="metric"><p>Completed tasks</p><strong>${count.done}/${count.total}</strong></div><div class="metric"><p>Task completion</p><strong>${count.percent}%</strong></div><div class="metric"><p>Latest quiz</p><strong>${state.quiz?`${state.quiz.score}/3`:"Not taken"}</strong></div></div>
    <div class="progress-grid">${courses.map(course=>{
      const tally=totals(course.id);
      return `<section class="panel"><p class="eyebrow">${course.id}</p><h2>${course.name}</h2><div class="progress-label"><span class="small">${tally.done} of ${tally.total} tasks complete</span><strong>${tally.percent}%</strong></div><progress value="${tally.done}" max="${tally.total||1}" aria-label="${course.id} task completion"></progress><p class="small muted">${tally.total?`${tally.total-tally.done} task${tally.total-tally.done===1?"":"s"} remaining`:"No tasks yet"}</p><button class="quiet" data-action="course-tasks" data-course="${course.id}">View course tasks</button></section>`;
    }).join("")}
    <section class="panel"><p class="eyebrow">ACADEMIC SKILLS / MODULE 01</p><h2>Study-planning quiz</h2><p class="small muted">${state.quiz?`Latest result: ${state.quiz.score} out of 3 correct. ${state.quiz.score===3?"Apply the strategies to your next assignment.":"Revisit the module and review the feedback."}`:"Complete the learning module to record a practice score."}</p><div class="actions"><a class="button" href="#learning">${state.quiz?"Review module":"Start module"}</a></div></section></div>
    <section class="panel" style="margin-top:var(--space-6)"><h2>Your study reflection</h2><p style="margin-top:var(--space-3)">${state.reflection?escapeHTML(state.reflection):"No reflection yet. Add a short reflection after the learning module."}</p></section>`;
}
function reminders() {
  const preferences=state.preferences;
  const candidates=state.tasks.filter(task=>!task.done&&task.due<=localDay(Number(preferences.leadDays)));
  return `${heading("Keep reminders useful.","Choose a calm reminder schedule, not constant interruptions.")}
    <section class="panel form-panel"><p class="small muted">Simulation only: preferences change the preview below. No emails, push notifications, or scheduled alerts are sent.</p>
      <form id="reminder-form"><div class="settings-row"><label class="check"><input id="reminders-enabled" type="checkbox" ${preferences.enabled?"checked":""}>Show reminders in the prototype</label></div>
        <div class="form-grid"><label for="reminder-frequency">Frequency<select id="reminder-frequency">${["Daily summary","Weekly summary"].map(frequency=>`<option ${preferences.frequency===frequency?"selected":""}>${frequency}</option>`).join("")}</select></label><label for="reminder-lead">Include deadlines within<select id="reminder-lead">${["1","2","7"].map(day=>`<option value="${day}" ${preferences.leadDays===day?"selected":""}>${day} day${day==="1"?"":"s"}</option>`).join("")}</select></label></div>
        <div class="actions"><button class="primary">Save preferences</button></div>
      </form>
      <div class="example"><h2>Reminder preview</h2><p class="small" style="margin-top:var(--space-3)">${preferences.enabled?`${preferences.frequency} · ${candidates.length} open task${candidates.length===1?"":"s"} due soon or overdue.`:"Reminders are off."}</p>${preferences.enabled?`<ul>${candidates.map(task=>`<li>${escapeHTML(task.title)} · ${dueLabel(task)} · ${displayDate(task.due)}</li>`).join("")}</ul>`:""}</div>
    </section>`;
}
function help() {
  return `${heading("A little guidance, when you need it.","How to use StudyFlow and manage your demonstration data.")}
    <section class="panel prose">
      <h2>Quick guides</h2>
      <details><summary>Add or edit a task</summary><p>Choose Add Task, enter a name, select a course and due date, and optionally add subtasks. Review the details, then choose Save Task. Use Edit to change a saved task. Cancel leaves saved data unchanged.</p></details>
      <details><summary>Complete tasks and subtasks</summary><p>Tick a task to complete it and all its subtasks. Untick it to reopen it. Individual subtasks can be checked in Task planner; completing all subtasks completes their parent task. Progress counts complete parent tasks, not individual subtasks.</p></details>
      <details><summary>Learn and check progress</summary><p>Open Learning, read the sample module, answer the practice question, and submit all three quiz answers. Progress shows the latest quiz attempt and task completion by course. These figures do not represent university marks.</p></details>
      <details><summary>Recover from a mistake</summary><p>Field errors explain what needs changing. Back to details preserves your draft. Delete asks for confirmation and provides Undo delete until another task is deleted or the data is reset or imported. You can always untick a completed task.</p></details>
      <details><summary>Keyboard and mobile use</summary><p>Use Tab and Shift+Tab to move between controls, Enter to activate buttons, and Space to select checkboxes. Press Escape to close a confirmation. All main functions use labelled controls rather than drag-only actions.</p></details>
      <h2>Session data</h2><p>This prototype stores changes only in memory. Reloading the page restores sample data. It does not collect participant identities, real credentials, or testing results.</p>
      <p>To keep your work, show the backup, select and copy its text, and save it in your own text file. Later, paste that JSON here and select Import backup. Import replaces the current session.</p>
      <label for="backup-text">Backup JSON<textarea class="backup" id="backup-text" spellcheck="false" placeholder="Select Show backup, or paste a previous backup here."></textarea></label>
      <div class="actions"><button class="secondary" data-action="show-backup">Show backup</button><button class="secondary" data-action="select-backup">Select backup text</button><button class="secondary" data-action="import-backup">Import backup</button></div>
      <h2>Start a fresh participant session</h2><p>Reset sample data before each test. This clears tasks you added, quiz attempts, reflections, reminder settings, and filters. Sample dates are relative to the device’s local date.</p><button class="secondary" data-action="reset">Reset sample data</button>
      <h2>Prototype boundaries</h2><p>The sample courses and tasks are fictional. StudyFlow is not connected to Moodle or university systems, does not authenticate users, and does not send live reminders. AI study advice and real academic analytics are outside this version.</p>
    </section>`;
}
function render() {
  const views={dashboard, tasks:taskList, editor, review, learning, progress:progressView, reminders, help};
  $("#view").innerHTML=views[currentView]();
}
function openModal(title,message,confirmAction,buttonText,extra="") {
  modalReturnFocus=document.activeElement;
  $("#modal-content").innerHTML=`<h2 id="modal-title">${escapeHTML(title)}</h2><p>${escapeHTML(message)}</p>${extra}<div class="actions"><button class="secondary" data-action="close-modal" autofocus>Cancel</button><button class="primary" data-action="${confirmAction}">${buttonText}</button></div>`;
  $("#modal").showModal();
}
function closeModal() {
  $("#modal").close();
  if (modalReturnFocus?.isConnected) modalReturnFocus.focus();
}
$("#modal").addEventListener("close",()=>{if(modalReturnFocus?.isConnected) modalReturnFocus.focus();});
let pendingDelete=null;
function validateBackup(data) {
  if (!data||data.version!==1||!Array.isArray(data.tasks)||data.tasks.length>100) throw Error("Use a StudyFlow v1 backup containing up to 100 tasks.");
  const ids=new Set();
  const text=(value,max)=>typeof value==="string"&&value.length<=max;
  for (const task of data.tasks) {
    const parsed=new Date(`${task.due}T12:00:00`);
    const validDate=typeof task.due==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(task.due)&&
      Number.isFinite(parsed.getTime())&&parsed.getFullYear()>1900&&
      `${parsed.getFullYear()}-${String(parsed.getMonth()+1).padStart(2,"0")}-${String(parsed.getDate()).padStart(2,"0")}`===task.due;
    if (!text(task.id,100)||!/^[A-Za-z0-9_-]+$/.test(task.id)||ids.has(task.id)||!text(task.title,100)||!task.title.trim()||
      !courses.some(course=>course.id===task.course)||!validDate||!["Low","Medium","High"].includes(task.priority)||
      typeof task.done!=="boolean"||!text(task.notes,1000)||!Array.isArray(task.subtasks)||task.subtasks.length>10||
      task.subtasks.some(sub=>!text(sub.text,120)||!sub.text.trim()||typeof sub.done!=="boolean")) {
      throw Error("The backup contains an invalid task. Current data has not been changed.");
    }
    if(task.subtasks.length&&task.done!==task.subtasks.every(sub=>sub.done)) throw Error("Backup task and subtask completion do not match.");
    ids.add(task.id);
  }
  if (data.quiz!==null&&(!data.quiz||!Array.isArray(data.quiz.answers)||data.quiz.answers.length!==3||
    data.quiz.answers.some(answer=>!Number.isInteger(answer)||answer<0||answer>2)||
    data.quiz.score!==data.quiz.answers.filter((answer,i)=>answer===questions[i].correct).length)) throw Error("Invalid quiz result in backup.");
  if (!text(data.reflection,1000)||!data.preferences||typeof data.preferences.enabled!=="boolean"||
    !["Daily summary","Weekly summary"].includes(data.preferences.frequency)||
    !["1","2","7"].includes(data.preferences.leadDays)) throw Error("Invalid reflection or reminder settings.");
  return structuredClone(data);
}
let pendingImport=null;
document.addEventListener("click",event=>{
  const button=event.target.closest("[data-action]");
  if(!button) return;
  const action=button.dataset.action;
  if(action==="add") newTask();
  if(action==="edit") editTask(button.dataset.id);
  if(action==="cancel-edit") {draft=null;go("tasks");notify("Changes cancelled. Saved tasks are unchanged.");}
  if(action==="back-edit") go("editor");
  if(action==="save-task") {
    const existing=state.tasks.findIndex(task=>task.id===draft.id);
    const saved={...structuredClone(draft),id:draft.id||`task-${Date.now()}-${Math.random().toString(36).slice(2,8)}`};
    if(existing>=0) state.tasks[existing]=saved; else state.tasks.push(saved);
    draft=null; filters={search:"",course:"all",status:"all"};
    go("tasks");notify(`Task saved successfully: ${saved.title}.`);
  }
  if(action==="delete") {
    pendingDelete=button.dataset.id;
    const task=state.tasks.find(task=>task.id===pendingDelete);
    openModal("Delete this task?",`“${task.title}” and its subtasks will be removed. You can undo the latest deletion in this session.`,"confirm-delete","Delete Task");
  }
  if(action==="confirm-delete") {
    deleted={task:state.tasks.find(task=>task.id===pendingDelete),index:state.tasks.findIndex(task=>task.id===pendingDelete)};
    state.tasks=state.tasks.filter(task=>task.id!==pendingDelete);
    closeModal();render();notify("Task deleted. You can undo this change.",false,true);$("#view h1").focus();
  }
  if(action==="undo-delete"&&deleted) {state.tasks.splice(deleted.index,0,deleted.task);deleted=null;render();notify("Task restored.");}
  if(action==="close-modal") closeModal();
  if(action==="clear-filters") {filters={search:"",course:"all",status:"all"};render();}
  if(action==="course-tasks") {filters={search:"",course:button.dataset.course,status:"all"};go("tasks");}
  if(action==="show-backup") {$("#backup-text").value=JSON.stringify(state,null,2);notify("Backup ready. Copy the text and save it outside the prototype.");}
  if(action==="select-backup") {$("#backup-text").focus();$("#backup-text").select();}
  if(action==="import-backup") {
    try {
      const raw=$("#backup-text").value;
      if(raw.length>150000) throw Error("Backup is too large.");
      pendingImport=validateBackup(JSON.parse(raw));
      openModal("Replace session data?","Your current tasks, quiz result, reflection and preferences will be replaced by this backup.","confirm-import","Import backup");
    } catch(error) {notify(`Import failed: ${error.message}`,true);}
  }
  if(action==="confirm-import") {
    state=pendingImport;pendingImport=null;draft=null;deleted=null;quizAnswers=state.quiz?{...state.quiz.answers}:{};practiceAnswer="";filters={search:"",course:"all",status:"all"};
    closeModal();render();notify("Backup imported. Session data restored.");
  }
  if(action==="reset") openModal("Reset sample data?","This clears all changes in this session and restores the fictional sample tasks. Copy a backup first if you need your work.","confirm-reset","Reset data");
  if(action==="confirm-reset") {
    state=sampleState();draft=null;deleted=null;practiceAnswer="";quizAnswers={};filters={search:"",course:"all",status:"all"};
    closeModal();render();notify("Sample data reset. Ready for a new participant session.");
  }
});
document.addEventListener("change",event=>{
  const target=event.target;
  if(target.dataset.taskCheck) {
    const task=state.tasks.find(item=>item.id===target.dataset.taskCheck);
    task.done=target.checked;
    task.subtasks.forEach(sub=>sub.done=target.checked);
    render();
    // Retain keyboard focus if the row still matches; otherwise use the heading.
    ($(`[data-task-check="${task.id}"]`)||$("#view h1")).focus({preventScroll:true});
    notify(`${task.title} marked ${task.done?"complete":"incomplete"}. Progress updated.`);
  }
  if(target.dataset.subtask) {
    const task=state.tasks.find(item=>item.id===target.dataset.subtask);
    task.subtasks[Number(target.dataset.index)].done=target.checked;task.done=task.subtasks.every(sub=>sub.done);
    render();
    ($(`[data-subtask="${task.id}"][data-index="${target.dataset.index}"]`)||$("#view h1")).focus({preventScroll:true});
    notify("Subtask updated. Progress recalculated.");
  }
  if(target.id==="course-filter"||target.id==="status-filter") {
    filters[target.id==="course-filter"?"course":"status"]=target.value;
    const id=target.id;render();document.getElementById(id).focus({preventScroll:true});
  }
  if(target.name==="practice") practiceAnswer=target.value;
  if(/^q[0-2]$/.test(target.name)) quizAnswers[Number(target.name.slice(1))]=Number(target.value);
});
document.addEventListener("input",event=>{
  if(event.target.id==="task-search") {
    filters.search=event.target.value;
    const start=event.target.selectionStart,end=event.target.selectionEnd;
    render();$("#task-search").focus({preventScroll:true});$("#task-search").setSelectionRange(start,end);
  }
});
document.addEventListener("submit",event=>{
  event.preventDefault();
  if(event.target.id==="task-form"&&readDraft(event.target)) go("review");
  if(event.target.id==="practice-form") {
    $("#practice-feedback").innerHTML=`<div class="feedback">${practiceAnswer==="specific"?"Correct. A small, specific action is easier to start.":practiceAnswer==="broad"?"Try again. Look for the smaller, more specific action.":"Choose an answer first."}</div>`;
  }
  if(event.target.id==="quiz-form") {
    const answers=questions.map((_,i)=>event.target.querySelector(`input[name="q${i}"]:checked`));
    if(answers.some(answer=>!answer)) {
      $("#quiz-feedback").innerHTML='<p class="form-error">Answer all three questions before submitting.</p>';
      const missing=answers.findIndex(answer=>!answer);
      event.target.querySelector(`input[name="q${missing}"]`).focus();return;
    }
    const selected=answers.map(answer=>Number(answer.value));
    state.quiz={answers:selected,score:selected.filter((answer,i)=>answer===questions[i].correct).length};
    $("#quiz-feedback").innerHTML=quizFeedback();notify("Quiz submitted. Your latest score is available on Progress.");
  }
  if(event.target.id==="reflection-form") {state.reflection=$("#reflection").value.trim();notify("Study reflection saved for this session.");}
  if(event.target.id==="reminder-form") {
    state.preferences={enabled:$("#reminders-enabled").checked,frequency:$("#reminder-frequency").value,leadDays:$("#reminder-lead").value};
    render();notify("Reminder preferences saved. Preview updated; no live alerts are sent.");
  }
});
route();
