import SadhanaPractice from '../models/SadhanaPractice.js';
import SadhanaPreference from '../models/SadhanaPreference.js';
import SadhanaLog from '../models/SadhanaLog.js';
import {success,failure} from '../utils/apiResponse.js';
import {getDay,todayFor,validDate,setupFor,monthly,progress,withDefaultJapa} from '../services/sadhana.service.js';
const plain = p => ({code:p.code,title:p.title,subtitle:p.subtitle,target:p.target,unit:p.unit,attendanceEnabled:p.attendanceEnabled,sortOrder:p.sortOrder});
export async function master(req,res){const {pref,masters}=await setupFor(req.user);const preferences=new Map(withDefaultJapa(pref?.practices||[],masters).map(x=>[x.code,x]));return success(res,{configured:Boolean(pref),practices:masters.map(x=>({...plain(x),selected:preferences.has(x.code),required:x.code==='japa',userTarget:preferences.get(x.code)?.target??x.target}))});}
export async function saveMaster(req,res){if(req.user.role!=='admin')return failure(res,'Admin access required',403);const row=await SadhanaPractice.findOneAndUpdate({code:req.body.code},{$set:req.body},{upsert:true,new:true,runValidators:true});return success(res,plain(row),'Practice saved');}
export async function savePreferences(req,res){const masters=await SadhanaPractice.find({code:{$in:req.body.practices.map(x=>x.code)},isActive:true}).lean();const map=new Map(masters.map(x=>[x.code,x]));if(map.size!==req.body.practices.length)return failure(res,'Unknown or inactive practice selected',422);const japa=await SadhanaPractice.findOne({code:'japa',isActive:true}).lean();if(!japa)return failure(res,'Japa master practice is missing or inactive; seed the Sadhana master first',409);const choices=withDefaultJapa(req.body.practices.map(x=>({code:x.code,target:x.target??map.get(x.code).target})),[japa]);await SadhanaPreference.findOneAndUpdate({user:req.user._id},{$set:{practices:choices,configuredAt:new Date()}},{upsert:true,new:true,runValidators:true});return success(res,{configured:true,practices:choices},'Preferences saved');}
export async function day(req,res){const date=req.query.date||todayFor(req.user).date;if(!validDate(date))return failure(res,'Invalid date; use YYYY-MM-DD',422);return success(res,await getDay(req.user,date));}
export async function updateDay(req,res){
  const {date:today,timezone}=todayFor(req.user);
  const date=req.params.date;
  if(!validDate(date)||date>today)return failure(res,'Date must be valid and not in the future',422);

  const day=await getDay(req.user,date);
  if(!day.entries.length)return failure(res,'No active Sadhana practices; seed the Sadhana master first',409);

  // Historical entries remain editable. Newly selected, active practices may be
  // appended to an existing date without overwriting its recorded entries.
  const {pref,masters}=await setupFor(req.user);
  const active=new Map(masters.map(x=>[x.code,x]));
  const currentSelections=new Map(withDefaultJapa(pref?.practices||[],masters).map(x=>[x.code,x]));
  const available=new Map(day.entries.map(x=>[x.code,x]));
  const updates=req.body.entries;
  const added=[];

  for(const update of updates){
    if(available.has(update.code))continue;
    const master=active.get(update.code);
    const selected=currentSelections.get(update.code);
    if(!master||!selected)return failure(res,'A practice is not selected for this date',422);

    const entry={code:master.code,title:master.title,target:selected.target??master.target,
      unit:master.unit,completed:false,value:0,comment:'',attendance:null};
    available.set(entry.code,entry);
    added.push(entry);
  }

  const changed=new Map(updates.map(x=>[x.code,x]));
  const entries=[...day.entries,...added].map(x=>{
    const u=changed.get(x.code);
    const entry={code:x.code,title:x.title,target:x.target,unit:x.unit,
      completed:u?.completed??x.completed,value:u?.value??x.value,
      comment:u?.comment??x.comment,
      attendance:u?.attendance===undefined?x.attendance:u.attendance,
      updatedAt:u?new Date():x.updatedAt};
    return entry;
  });

  const old=await SadhanaLog.findOne({user:req.user._id,date}).select('_id').lean();
  await SadhanaLog.findOneAndUpdate({user:req.user._id,date},
    {$set:{timezone,entries},$setOnInsert:{user:req.user._id,date}},
    {upsert:true,new:true,runValidators:true});
  return success(res,{date,timezone,entries,progress:progress(entries)},old?'Sadhana updated':'Sadhana recorded');
}
export async function month(req,res){const {year,month}=req.query;const now=todayFor(req.user).date;const y=Number(year??now.slice(0,4)),m=Number(month??now.slice(5,7));if(!Number.isInteger(y)||y<2000||y>2100||!Number.isInteger(m)||m<1||m>12)return failure(res,'Invalid year/month',422);return success(res,await monthly(req.user,y,m));}
const csvCell = v=>'"'+String(v??'').replace(/"/g,'""').replace(/\r|\n/g,' ')+'"';
export async function download(req,res){const {year,month}=req.query;const now=todayFor(req.user).date;const y=Number(year??now.slice(0,4)),m=Number(month??now.slice(5,7));if(!Number.isInteger(y)||y<2000||y>2100||!Number.isInteger(m)||m<1||m>12)return failure(res,'Invalid year/month',422);const data=await monthly(req.user,y,m);const lines=[['Date','Practice','Completed','Value','Target','Unit','Attendance','Comment'].map(csvCell).join(',')];for(const row of data.logs)for(const x of row.entries)lines.push([row.date,x.title,x.completed?'Yes':'No',x.value,x.target,x.unit,x.attendance,x.comment].map(csvCell).join(','));res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="sadhana-${y}-${String(m).padStart(2,'0')}.csv"`);return res.send('\uFEFF'+lines.join('\r\n'));}
