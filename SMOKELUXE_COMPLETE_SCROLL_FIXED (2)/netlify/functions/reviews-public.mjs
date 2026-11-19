import { getStore } from '@netlify/blobs';
export default async () => {
 try { const data = await getStore('smokeluxe-approved-reviews').get('published', {type:'json'}); return new Response(JSON.stringify(Array.isArray(data)?data:[]),{headers:{'content-type':'application/json','cache-control':'no-store'}}); }
 catch(e) { console.error(e); return new Response(JSON.stringify([]),{headers:{'content-type':'application/json'}}); }
};
