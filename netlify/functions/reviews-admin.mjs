import { getStore } from '@netlify/blobs';
import { timingSafeEqual } from 'node:crypto';
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const safeEqual=(a,b)=>{const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length && timingSafeEqual(x,y)};
const api=async(path,token)=>{const r=await fetch('https://api.netlify.com/api/v1'+path,{headers:{Authorization:'Bearer '+token}});if(!r.ok)throw Error('Netlify API error '+r.status);return r.json()};
export default async(request)=>{
 if(!process.env.REVIEW_ADMIN_PASSWORD||!process.env.NETLIFY_ACCESS_TOKEN||!process.env.SMOKELUXE_SITE_ID) return reply({error:'Missing environment configuration'},503);
 if(!safeEqual(request.headers.get('x-admin-password'),process.env.REVIEW_ADMIN_PASSWORD))return reply({error:'Incorrect password'},401);
 const store=getStore('smokeluxe-approved-reviews');
 try {
  if(request.method==='GET'){
   const forms=await api('/sites/'+encodeURIComponent(process.env.SITE_ID)+'/forms',process.env.NETLIFY_ACCESS_TOKEN);
   const form=forms.find(f=>f.name==='customer-reviews');
   if(!form)return reply({error:'Customer reviews form not found'},404);
   const submissions=await api('/forms/'+encodeURIComponent(form.id)+'/submissions?per_page=100',process.env.NETLIFY_ACCESS_TOKEN);
   const approved=await store.get('published',{type:'json'})||[];
   const ids=await store.get('approved-ids',{type:'json'})||[];
   return reply({pending:submissions.filter(s=>!ids.includes(s.id)).map(s=>({id:s.id,name:s.data?.['Your name']||s.data?.name||'',rating:s.data?.['Your rating']||s.data?.rating||'',review:s.data?.['Your experience']||s.data?.experience||s.data?.review||'',created_at:s.created_at})),approved});
  }
  if(request.method==='POST'){
   const body=await request.json();if(!['approve','reject'].includes(body.action)||typeof body.id!=='string')return reply({error:'Invalid request'},400);
   const forms=await api('/sites/'+encodeURIComponent(process.env.SITE_ID)+'/forms',process.env.NETLIFY_ACCESS_TOKEN);const form=forms.find(f=>f.name==='customer-reviews');if(!form)return reply({error:'Form missing'},404);
   const submissions=await api('/forms/'+encodeURIComponent(form.id)+'/submissions?per_page=100',process.env.NETLIFY_ACCESS_TOKEN);const item=submissions.find(s=>s.id===body.id);if(!item)return reply({error:'Submission not found'},404);
   const ids=await store.get('approved-ids',{type:'json'})||[];if(ids.includes(body.id))return reply({ok:true});
   if(body.action==='approve'){
    const name=String(item.data?.['Your name']||item.data?.name||'Customer').slice(0,80);
    const rating=Math.max(1,Math.min(5,Number(item.data?.['Your rating']||item.data?.rating)||5));
    const review=String(item.data?.['Your experience']||item.data?.experience||item.data?.review||'').slice(0,1000);
    const approved=await store.get('published',{type:'json'})||[];
    await store.setJSON('published',[...approved,{name,rating,review,approved:true}]);
   }
   await store.setJSON('approved-ids',[...ids,body.id]);return reply({ok:true});
  }
  return reply({error:'Method not allowed'},405);
 }catch(e){console.error(e);return reply({error:'Unable to process reviews. Check token permissions and site settings.'},500)}
};
