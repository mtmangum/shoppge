'use strict';
const $ = (id) => document.getElementById(id);
const labels = {pending:'Pending',inprogress:'In Progress',completed:'Completed',cancelled:'Cancelled'};
const people = {admin:'Alex Morgan',machinist:'Sam Taylor',requestor:'Jordan Lee'};
const key = 'shoppge-demo-v1';
const date = (offset=0) => { const d=new Date(); d.setDate(d.getDate()+offset); return d.toLocaleDateString('en-CA'); };
const displayDate = (value) => new Date(value+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
const escape = (value) => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const descriptions = ['Core holder end caps — aluminum, set of four','Pressure transducer mounting bracket','Stainless steel sample vessel adapter','Flow loop instrument panel','Triaxial cell alignment fixture','Custom thermocouple probe housing','Acrylic reservoir viewing window','Rock sample preparation jig','Pump coupling replacement sleeve','High-pressure manifold support','Laboratory sensor calibration stand','Brass fittings for teaching apparatus'];
function seed(){return descriptions.map((description,i)=>({id:1065-i,description,requestor:i%3===0?'Jordan Lee':i%3===1?'Casey Rivera':'Riley Chen',machinist:i%4===0?'Unassigned':i%2===0?'Sam Taylor':'Morgan Brooks',status:['pending','inprogress','pending','completed','inprogress','pending','completed','cancelled'][i%8],priority:i%4===0?'urgent':'normal',created:date(-i-1),due:date(10-i),materials:i%2===0?'Aluminum 6061-T6':'Shop stock',notes:'',history:[{message:'Sample work order created',at:date(-i-1)}]}));}
let jobs=seed(),role='admin',view='overview',toastTimer;
try{const saved=JSON.parse(localStorage.getItem(key));if(Array.isArray(saved)&&saved.length&&saved.every(j=>Number.isInteger(j.id)&&Object.hasOwn(labels,j.status)&&['normal','urgent'].includes(j.priority)&&Array.isArray(j.history)))jobs=saved;}catch{}
function notify(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4000);}
function save(){try{localStorage.setItem(key,JSON.stringify(jobs));}catch{notify('Browser storage unavailable; changes last until you leave this page.');}}
function badge(value){return `<span class="badge ${escape(value)}">${escape(labels[value]||value[0].toUpperCase()+value.slice(1))}</span>`;}
function scoped(){return jobs.filter(j=>role!=='requestor'||j.requestor===people.requestor);}
function render(){
 const tabs=role==='admin'?[['overview','Dashboard'],['jobs','Open Jobs'],['assigned','Assigned to Me'],['activity','Activity']]:role==='machinist'?[['jobs','Open Jobs'],['assigned','Assigned to Me']]:[['jobs','My Jobs']];
 if(!tabs.some(t=>t[0]===view))view=tabs[0][0];
 $('tabs').innerHTML=tabs.map(([id,label])=>`<button class="tab ${view===id?'active':''}" data-view="${id}" ${view===id?'aria-current="page"':''}>${label}</button>`).join('');
 $('title').textContent=view==='overview'?'Shop overview':view==='activity'?'Shop activity':view==='assigned'?'Assigned to me':role==='requestor'?'My work orders':'Open work orders';
 $('subtitle').textContent=role==='requestor'?'Submit a work order and follow its progress.':'From the first drawing to the finished part.';
 $('new-job').hidden=role==='machinist'||view==='activity';
 const list=scoped(), open=list.filter(j=>['pending','inprogress'].includes(j.status));
 const stats=[['pending','Pending',open.filter(j=>j.status==='pending').length,'Awaiting shop review'],['inprogress','In progress',open.filter(j=>j.status==='inprogress').length,'On the shop floor'],['urgent','Urgent open',open.filter(j=>j.priority==='urgent').length,'Priority work orders'],['completed','Completed',list.filter(j=>j.status==='completed').length,'Finished sample jobs']];
 $('stats').innerHTML=stats.map(([filter,label,total,caption])=>`<button class="stat ${filter}" data-filter="${filter}"><span>${label}</span><strong>${total}</strong><small>${caption}</small></button>`).join('');
 $('jobs-panel').hidden=view==='activity';$('activity-panel').hidden=view!=='activity';
 const search=$('search').value.toLowerCase().trim(),status=$('status').value,priority=$('priority').value;
 const filtered=list.filter(j=>(view!=='assigned'||j.machinist===people[role])&&(status==='all'||(status==='open'?['pending','inprogress'].includes(j.status):j.status===status))&&(priority==='all'||j.priority===priority)&&`${j.id} ${j.description} ${j.requestor} ${j.machinist}`.toLowerCase().includes(search));
 filtered.sort((a,b)=>$('sort').value==='due'?a.due.localeCompare(b.due):$('sort').value==='oldest'?a.id-b.id:b.id-a.id);
 $('rows').innerHTML=filtered.length?filtered.map(j=>`<tr><td><button class="job-link" data-job="${j.id}" aria-label="Open job ${j.id}">#${j.id}</button></td><td class="description">${escape(j.description)}</td><td>${escape(j.requestor)}</td><td>${escape(j.machinist)}</td><td>${escape(displayDate(j.due))}</td><td>${badge(j.status)}</td><td>${badge(j.priority)}</td></tr>`).join(''):'<tr><td colspan="7">No jobs match these filters.</td></tr>';
 $('count').textContent=`${filtered.length} work order${filtered.length===1?'':'s'} · Click a job number to view details`;
 $('activity').innerHTML=jobs.flatMap(j=>j.history.map(h=>({...h,id:j.id}))).sort((a,b)=>b.at.localeCompare(a.at)).slice(0,20).map(h=>`<div class="activity-row"><button class="job-link" data-job="${h.id}">#${h.id}</button> · ${escape(h.message)}<small>${escape(displayDate(h.at))}</small></div>`).join('');
}
function openModal(title,content){$('dialog-title').textContent=title;$('dialog-body').innerHTML=content;$('modal').showModal();}
function detail(id){
 const j=scoped().find(j=>j.id===id);if(!j)return;
 const canEdit=role==='admin'||(role==='machinist'&&j.machinist===people.machinist);
 openModal(`Work order #${j.id}`,`<p>${escape(j.description)}</p><div class="fields"><div class="field">Requestor<span>${escape(j.requestor)}</span></div><div class="field">Required by<span>${escape(displayDate(j.due))}</span></div><div class="field">Status<span>${badge(j.status)}</span></div><div class="field">Priority<span>${badge(j.priority)}</span></div><div class="field full">Materials<span>${escape(j.materials)}</span></div></div>${canEdit?`<form id="edit-form"><div class="fields"><label class="field">Update status<select name="status">${Object.entries(labels).map(([s,l])=>`<option value="${s}" ${s===j.status?'selected':''}>${l}</option>`).join('')}</select></label><label class="field">Assign machinist<select name="machinist">${['Unassigned','Sam Taylor','Morgan Brooks'].map(n=>`<option ${j.machinist===n?'selected':''}>${n}</option>`).join('')}</select></label><label class="field">Priority<select name="priority"><option value="normal" ${j.priority==='normal'?'selected':''}>Normal</option><option value="urgent" ${j.priority==='urgent'?'selected':''}>Urgent</option></select></label><label class="field full">Machinist notes<textarea name="notes" maxlength="2000" rows="3">${escape(j.notes)}</textarea></label></div><button class="primary" type="submit">Save changes</button></form>`:`<p class="muted">Assigned to ${escape(j.machinist)}. ${escape(j.notes||'No machinist notes yet.')}</p>`}<h3>Status history</h3><ol class="history">${j.history.map(h=>`<li>${escape(displayDate(h.at))} · ${escape(h.message)}</li>`).join('')}</ol>`);
 if(canEdit)$('edit-form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);const previous=j.status;j.status=f.get('status');j.machinist=f.get('machinist');j.priority=f.get('priority');j.notes=f.get('notes').trim();j.history.push({at:date(),message:previous===j.status?`Work order updated by ${people[role]}`:`${labels[previous]} → ${labels[j.status]} by ${people[role]}`});save();$('modal').close();render();notify('Sample work order updated.');};
}
$('new-job').onclick=()=>{
 if(role==='machinist')return;
 openModal('New sample work order',`<p class="muted">Create a sample request as Jordan Lee. Nothing is submitted to the shop.</p><form id="create-form"><div class="fields"><label class="field full">Description<textarea name="description" required minlength="5" maxlength="2000" rows="3" placeholder="Describe the part or work you need"></textarea></label><label class="field">Required by<input type="date" name="due" required min="${date()}" value="${date(14)}"></label><label class="field">Priority<select name="priority"><option value="normal">Normal</option><option value="urgent">Urgent</option></select></label><label class="field full">Materials<input name="materials" maxlength="200" placeholder="e.g. Aluminum 6061-T6"></label></div><div class="dialog-actions"><button class="primary" type="submit">Create sample work order</button></div></form>`);
 $('create-form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),description=f.get('description').trim();if(description.length<5){e.target.elements.description.setCustomValidity('Enter at least five characters.');e.target.elements.description.reportValidity();return;}const id=Math.max(...jobs.map(j=>j.id))+1;jobs.unshift({id,description,due:f.get('due'),priority:f.get('priority'),materials:f.get('materials').trim()||'Shop stock',requestor:people.requestor,machinist:'Unassigned',status:'pending',created:date(),notes:'',history:[{at:date(),message:'Sample work order created by Jordan Lee'}]});save();$('modal').close();view='jobs';$('status').value='open';$('priority').value='all';$('search').value='';render();notify(`Sample work order #${id} created.`);};
 $('create-form').elements.description.oninput=e=>e.target.setCustomValidity('');
};
$('close').onclick=()=>$('modal').close();
$('role').onchange=()=>{role=$('role').value;view=role==='admin'?'overview':'jobs';$('search').value='';$('status').value='open';$('priority').value='all';render();};
$('tabs').onclick=e=>{const b=e.target.closest('[data-view]');if(b){view=b.dataset.view;render();}};
$('stats').onclick=e=>{const b=e.target.closest('[data-filter]');if(!b)return;view='jobs';$('status').value=b.dataset.filter==='urgent'?'open':b.dataset.filter;$('priority').value=b.dataset.filter==='urgent'?'urgent':'all';$('search').value='';render();};
for(const id of ['search','status','priority','sort'])$(id).addEventListener(id==='search'?'input':'change',render);
for(const id of ['rows','activity'])$(id).onclick=e=>{const b=e.target.closest('[data-job]');if(b)detail(Number(b.dataset.job));};
$('reset').onclick=()=>{if(!confirm('Reset all sample jobs and remove your demo changes?'))return;jobs=seed();save();$('search').value='';$('status').value='open';$('priority').value='all';render();notify('Demo restored to the original sample data.');};
render();
