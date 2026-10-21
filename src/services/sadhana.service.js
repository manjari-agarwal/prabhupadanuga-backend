import SadhanaPractice from '../models/SadhanaPractice.js';
import SadhanaPreference from '../models/SadhanaPreference.js';
import SadhanaLog from '../models/SadhanaLog.js';
import {localDateParts,resolveTimezone} from './dashboard.service.js';

export function todayFor(user) {const timezone=resolveTimezone(user.timezone); return {timezone,date:localDateParts(new Date(),timezone).date};}
export function validDate(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;const parsed=new Date(`${date}T00:00:00Z`);return !isNaN(parsed)&&parsed.toISOString().slice(0,10)===date;}
export const DEFAULT_SADHANA_CODE = 'japa';
export function withDefaultJapa(practices=[], masters=[]) {
  const selections = [...practices];
  if (!selections.some(p => p.code === DEFAULT_SADHANA_CODE)) {
    const japa = masters.find(p => p.code === DEFAULT_SADHANA_CODE);
    if (japa) selections.unshift({code:DEFAULT_SADHANA_CODE,target:japa.target});
  }
  return selections;
}
export async function setupFor(user){const [pref,masters]=await Promise.all([SadhanaPreference.findOne({user:user._id}).lean(),SadhanaPractice.find({isActive:true}).sort({sortOrder:1,title:1}).lean()]);return {pref,masters};}
export function progress(entries){const total=entries.length,completed=entries.filter(x=>x.completed).length;return {completed,total,percentage:total?Math.round(completed/total*100):0};}
export async function getDay(user,date){const {timezone}=todayFor(user);const [pref,masters,log]=await Promise.all([SadhanaPreference.findOne({user:user._id}).lean(),SadhanaPractice.find({isActive:true}).lean(),SadhanaLog.findOne({user:user._id,date}).lean()]);
// Persisted entries win, so past logs remain unchanged after preference/master edits.
const active=new Map(masters.map(x=>[x.code,x]));const existing=new Map((log?.entries||[]).map(x=>[x.code,x]));
const selected=withDefaultJapa(pref?.practices||[],masters);const entries=log?log.entries:selected.filter(x=>active.has(x.code)).map(x=>({code:x.code,title:active.get(x.code).title,target:x.target,unit:active.get(x.code).unit,attendanceEnabled:active.get(x.code).attendanceEnabled,completed:false,value:0,comment:'',attendance:null}));
return {date,timezone,configured:Boolean(pref),entries:entries.map(x=>({...x,attendanceEnabled:active.get(x.code)?.attendanceEnabled??Boolean(x.attendance)})),progress:progress(entries)};
}
export async function homeSummary(user){const {date}=todayFor(user);const day=await getDay(user,date);return {enabled:true,configured:day.configured,date,completed:day.progress.completed,total:day.progress.total,percentage:day.progress.percentage,subtitle:`${day.progress.completed} of ${day.progress.total} practices complete`};}
export function dayShift(date,delta){const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+delta);return d.toISOString().slice(0,10);}
export async function monthly(user,year,month){const {date:today,timezone}=todayFor(user);const prefix=`${year}-${String(month).padStart(2,'0')}`;const [logs,pref]=await Promise.all([SadhanaLog.find({user:user._id,date:{$gte:prefix+'-01',$lte:prefix+'-31'}}).sort({date:1}).lean(),SadhanaPreference.findOne({user:user._id}).lean()]);const rows=logs.map(x=>({date:x.date,...progress(x.entries),entries:x.entries}));const recorded=rows.length;const totalOfferings=rows.reduce((n,x)=>n+x.completed,0);const completeDays=rows.filter(x=>x.total>0&&x.completed===x.total).length;const consistency=rows.reduce((n,x)=>n+x.percentage,0)/(recorded||1);
const byDate=new Map(rows.map(x=>[x.date,x]));const calendar=[];const days=new Date(Date.UTC(year,month,0)).getUTCDate();for(let i=1;i<=days;i++){const date=`${prefix}-${String(i).padStart(2,'0')}`;const item=byDate.get(date);calendar.push({date,recorded:Boolean(item),completed:item?.completed||0,total:item?.total||0,percentage:item?.percentage??null,status:!item?'not_logged':item.percentage===100&&item.total>0?'complete':'in_progress'});}
let streak=0;let cursor=today; if(!byDate.has(cursor)||byDate.get(cursor)?.completed===0)cursor=dayShift(cursor,-1);while(byDate.get(cursor)?.completed>0){streak++;cursor=dayShift(cursor,-1);}
return {year,month,timezone,configured:Boolean(pref),summary:{recordedDays:recorded,completeDays,totalOfferings,consistency:Math.round(consistency),currentStreak:streak},calendar,logs:rows};
}
