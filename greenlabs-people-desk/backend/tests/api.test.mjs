// 사용법: 백엔드를 DEMO_TODAY=2026-11-13 으로 띄우고 빈 DB에 시드한 뒤 node tests/api.test.mjs (데이터를 바꾸므로 시험 후 npm run seed:reset)
const B='http://localhost:4000';const tok={};
async function login(e){const r=await fetch(B+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:e,password:'demo1234'})});return (await r.json()).token;}
async function api(who,m,p,body,form){const h=who?{Authorization:'Bearer '+tok[who]}:{};if(body)h['Content-Type']='application/json';const r=await fetch(B+p,{method:m,headers:h,body:form||(body?JSON.stringify(body):undefined)});let j;try{j=await r.json()}catch{j=null}return {s:r.status,j};}
for (const [k,e] of Object.entries({seo:'seo@greenlabs.test',park:'park@greenlabs.test',lee:'lee@greenlabs.test',han:'han@greenlabs.test',song:'song@greenlabs.test',emp1:'emp1@greenlabs.test',emp2:'emp2@greenlabs.test'})) tok[k]=await login(e);
const out=[];const T=(id,ok,note='')=>out.push(`${ok?'PASS':'FAIL'}\t${id}\t${note}`);
let r;
// T01
r=await api('seo','GET','/positions');T('T01',r.j.reduce((s,p)=>s+p.cnt,0)===400&&r.j.length===6,`지원자 ${r.j.reduce((s,p)=>s+p.cnt,0)} 포지션 ${r.j.length}`);
// T09 서류->과제
r=await api('seo','GET','/board?positionId=P01');const doc=r.j.cards.find(c=>c.stage==='서류'&&c.badges.length===0);
r=await api('seo','POST',`/applicants/${doc.id}/transition`,{to:'다음 단계'});const d1=await api('seo','GET',`/applicants/${doc.id}`);
T('T09',r.j?.stage==='과제'&&d1.j.histories.length===1,`${doc.id} → ${r.j?.stage}, 과제 마감 ${d1.j.applicant.taskDueAt}`);
// T10 P05 서류->1차
r=await api('seo','GET','/board?positionId=P05');let p5=r.j.cards.find(c=>c.stage==='서류');
if(!p5){ // 서류 진행자가 없으면 입력 확인용으로 단계 누락자를 서류로
  const miss=r.j.cards.find(c=>!c.stage); await api('seo','PATCH',`/applicants/${miss.id}`,{stage:'서류'}); p5={id:miss.id};}
r=await api('seo','POST',`/applicants/${p5.id}/transition`,{to:'다음 단계'});T('T10',r.j?.stage==='1차 면접',`${p5.id} 서류 → ${r.j?.stage}`);
// T11 중도 이탈 사유 없이
r=await api('seo','POST',`/applicants/${doc.id}/transition`,{to:'중도 이탈'});T('T11',r.s===400,`${r.s} ${r.j?.message}`);
// 평가: P01 1차 면접 지원자 찾기
r=await api('seo','GET','/board?positionId=P01');const iv1=r.j.cards.find(c=>c.stage==='1차 면접');
const crit=(await api('lee','GET',`/applicants/${iv1.id}/criteria?stage=${encodeURIComponent('1차 면접')}`)).j;
const sc=(n)=>Object.fromEntries(crit.map(c=>[c.id,{score:n,note:'근거 메모'}]));
r=await api('lee','POST','/evaluations',{applicantId:iv1.id,stage:'1차 면접',scores:sc(6),verdict:'합격'});T('T12',r.s===400,`6점 → ${r.s} ${r.j?.message}`);
// T13 P06 4점 (P06 면접관 없음 → 범위 검증 함수 확인을 위해 criteria scale 확인)
const c6=await (await import('pg')).default; 
r=await api('han','POST','/evaluations',{applicantId:iv1.id,stage:'1차 면접',scores:sc(4),verdict:'합격'});T('T14a',r.s===201,`한지민 제출 ${r.s}`);
r=await api('lee','GET',`/applicants/${iv1.id}/evaluations`);T('T14',r.j.find(e=>e.interviewerName==='한지민')?.hidden===true,`이서준 제출 전: 한지민 평가 hidden=${r.j.find(e=>e.interviewerName==='한지민')?.hidden}`);
r=await api('lee','POST','/evaluations',{applicantId:iv1.id,stage:'1차 면접',scores:sc(3),verdict:'보류'});
r=await api('lee','GET',`/applicants/${iv1.id}/evaluations`);T('T15',r.j.every(e=>!e.hidden),`제출 후 모두 공개`);
r=await api('lee','POST','/evaluations',{applicantId:iv1.id,stage:'1차 면접',scores:sc(4),verdict:'합격'});
const ev=(await api('seo','GET',`/applicants/${iv1.id}/evaluations`)).j.find(e=>e.interviewerName==='이서준');
const rev=await api('seo','GET',`/evaluations/${ev.id}/revisions`);T('T16',r.j?.revised===true&&rev.j.length===1,`수정 이력 ${rev.j.length}건`);
r=await api('park','POST','/evaluations',{applicantId:iv1.id,stage:'1차 면접',scores:sc(3),verdict:'합격'});T('T12b',r.s===403,`2차 면접관이 1차 평가 → ${r.s}`);
// 일정 T17~T19
const iv1b=(await api('seo','GET','/board?positionId=P01')).j.cards.find(c=>c.stage==='2차 면접')||null;
r=await api('park','GET','/availabilities');T('T17',r.j.length>=4,`박도현 가능 시간 ${r.j.length}개`);
const target=(await api('seo','GET','/board?positionId=P01')).j.cards.find(c=>c.stage==='1차 면접'&&c.nextAction==='면접 일정 확정');
r=await api('seo','GET',`/interviews/slots?applicantId=${target.id}&stage=${encodeURIComponent('1차 면접')}`);
T('T18',r.j.slots.length>=1&&r.j.interviewers.length===2,`면접관 ${r.j.interviewers.map(i=>i.name)} 공통 ${r.j.slots.length}개`);
const leeA=(await api('lee','GET','/availabilities')).j; const onlyLee=leeA.find(a=>!r.j.slots.some(s=>s.startAt===new Date(a.start_at).toISOString()));
let r2=await api('seo','POST','/interviews',{applicantId:target.id,stage:'1차 면접',startAt:onlyLee.start_at});T('T19',r2.s===400,`한 명만 가능한 시간 → ${r2.s} ${r2.j?.message}`);
r2=await api('seo','POST','/interviews',{applicantId:target.id,stage:'1차 면접',startAt:r.j.slots[0].startAt});const det=(await api('seo','GET',`/applicants/${target.id}`)).j;
T('T18b',r2.s===201&&det.emails.some(e=>e.type==='면접 일정'),`확정 + 일정 메일 초안 생성`);
// 통계 T20~22
r=await api('seo','GET','/stats?positionId=P01');T('T20',r.j.funnel.length===6&&r.j.funnel[1].fromPrevRate>0,`P01 ${r.j.funnel.map(f=>f.stage+':'+f.reached+'('+f.fromPrevRate+'%)').join(' ')} 누락 ${r.j.missingStage}`);
r=await api('seo','GET','/stats?positionId=P05');T('T21',!r.j.funnel.some(f=>f.stage==='과제'),`P05 단계 ${r.j.funnel.map(f=>f.stage).join(',')}`);
T('T22',r.j.sources.length>0&&'docPassRate' in r.j.sources[0]&&r.j.dropped>=0,`사이트 ${r.j.sources.length}개, 불합격 ${r.j.rejected} 이탈 ${r.j.dropped}`);
r=await api('lee','GET','/stats');T('A10',r.s===403,`면접관 통계 → ${r.s}`);
// 질문 (AI 없는 대체 경로)
r=await api('emp1','POST','/qa/ask',{question:'아이가 아파서 병원에 가야 하는데 병가 쓰면 되나요?'});T('T30',r.j.status==='이관'&&r.j.escalationReason==='민감',`${r.j.status}/${r.j.escalationReason}`);
r=await api('emp1','POST','/qa/ask',{question:'제가 징계 대상인지 궁금해요'});T('T31',r.j.status==='이관',`${r.j.status}/${r.j.escalationReason}`);
r=await api('emp1','POST','/qa/ask',{question:'재택근무는 주 몇 일까지 돼요?'});T('T24-kw',r.j.citations?.some(c=>/제14조/.test(c.article)),`근거 ${r.j.citations?.map(c=>c.doc+' '+c.article+' '+c.page+'쪽').join(' / ')}`);
r=await api('emp2','GET','/qa/logs');T('A08',r.j.every(l=>l.user_id!==1&&l.user_name!=='김정규'),`직원 B가 보는 기록 ${r.j.length}건`);
r=await api('seo','GET','/qa/logs?status=이관');T('T33',r.j.length>=2,`피플팀 문의함 이관 ${r.j.length}건`);
// 문서 업로드 T25
const fs=await import('fs');const fd=new FormData();fd.append('file',new Blob([fs.readFileSync('seed-data/rules_2026-10-01_revised.pdf')],{type:'application/pdf'}),'rules.pdf');fd.append('docType','규정집');fd.append('revisedAt','2026-10-01');
r=await api('emp1','POST','/documents',null,fd);T('A07',r.s===403,`직원 업로드 → ${r.s}`);
const fd2=new FormData();fd2.append('file',new Blob([fs.readFileSync('seed-data/rules_2026-10-01_revised.pdf')],{type:'application/pdf'}),'rules.pdf');fd2.append('docType','규정집');
r=await api('seo','POST','/documents',null,fd2);T('T25b',r.s===400,`개정일 없이 → ${r.s} ${r.j?.message}`);
const fd3=new FormData();fd3.append('file',new Blob([fs.readFileSync('seed-data/rules_2026-10-01_revised.pdf')],{type:'application/pdf'}),'rules.pdf');fd3.append('docType','규정집');fd3.append('revisedAt','2026-10-01');
r=await api('seo','POST','/documents',null,fd3);const docs=(await api('seo','GET','/documents')).j.filter(d=>d.doc_type==='규정집');
T('T25',r.s===201&&docs.filter(d=>d.is_active).length===1&&docs.length===2,`v${r.j.version} 활성, 이전 버전 보관 (${docs.length}개)`);
r=await api('emp1','POST','/qa/ask',{question:'재택근무는 주 몇 일까지 돼요?'});T('T26-kw',r.j.citations?.some(c=>c.revisedAt==='2026-10-01'),`근거 ${r.j.citations?.map(c=>c.doc+'('+c.revisedAt+') '+c.article).join(' / ')}`);
// 지원서 자동 입력 T34~38
r=await api('seo','POST','/intake/extract',{rawText:`[원티드] 새로운 지원자가 있습니다\n포지션: 백엔드 개발자\n지원자: 정다온\n이메일: daon.jung@example.com\n연락처: 010-0000-7781\n지원일: 2026.11.13`});
const dr=r.j[0];T('T34',dr.status==='대기'&&dr.extracted.email==='daon.jung@example.com'&&dr.extracted.position_id==='P01'&&dr.extracted.source==='원티드',JSON.stringify(dr.extracted));
const before=(await api('seo','GET','/positions')).j.find(p=>p.id==='P01').cnt;
r=await api('seo','POST',`/intake/${dr.id}/approve`,{});const after=(await api('seo','GET','/positions')).j.find(p=>p.id==='P01').cnt;
T('T35',r.j.applicantId&&after===before+1,`${r.j.applicantId} 등록 (P01 ${before}→${after})`);
const a127=(await api('seo','GET','/applicants/A0127')).j.applicant;
r=await api('seo','POST','/intake/extract',{rawText:`잡코리아 지원 알림\n지원 포지션: 데이터 엔지니어\n이름: ${a127.name}\n이메일: ${a127.email}\n연락처: ${a127.phone}`});
T('T36',r.j[0].duplicate_ids.length>=1,`중복 지원 ${r.j[0].duplicate_ids}`);
const a237=(await api('seo','GET','/applicants/A0237')).j;T('T37',a237.suspects.length===1&&a237.sameEmail.length===0,`A0237 중복 의심 ${a237.suspects.map(s=>s.id)}`);
r=await api('seo','POST','/intake/extract',{rawText:`이름: 홍길순\n이메일: gil@example.com\n백엔드 개발자 지원`});
r=await api('seo','POST',`/intake/${r.j[0].id}/approve`,{});T('T38',r.s===400,`지원 경로 없이 승인 → ${r.s} ${r.j?.message}`);
// 메일 T07, T39
r=await api('seo','POST','/emails/draft',{applicantId:'A0082',type:'불합격'});const em=r.j;
T('T39',em.body.includes((await api('seo','GET','/applicants/A0082')).j.applicant.name)&&em.subject.includes('백엔드'),em.subject);
await api('seo','POST',`/emails/${em.id}/sent`,{});const c82=(await api('seo','GET','/applicants/A0082')).j;
T('T07',!c82.card.badges.some(b=>b.type==='notice_overdue')&&c82.applicant.resultNotifiedAt==='2026-11-13',`안내일 ${c82.applicant.resultNotifiedAt}, 배지 ${c82.card.badges.map(b=>b.label)}`);
r=await api('song','GET','/board');T('A01c',JSON.stringify(r.j.positions.map(p=>p.id))==='["P03"]',`송유나 ${r.j.positions.map(p=>p.id)}`);
console.log(out.join('\n'));
