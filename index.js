import http from 'node:http';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const dataFile = path.resolve(process.env.PDRIVE_DATA_FILE || path.join(root, 'data', 'pdrive.json'));
const port = Number(process.env.PORT || 4173);
const roles = ['Administrator', 'Business manager', 'Sales', 'Operations', 'Compliance'];
const sessions = new Map();
const users = roles.map((role, i) => ({
  id: `user-${i + 1}`, name: ['Avery Morgan', 'Jordan Lee', 'Sam Rivera', 'Taylor Chen', 'Casey Patel'][i],
  email: ['avery@northstar.example', 'jordan@northstar.example', 'sam@northstar.example', 'taylor@northstar.example', 'casey@northstar.example'][i],
  role, orgId: 'northstar', salt: 'P-drive-demo-salt-v1', hash: scryptSync('demo123', 'P-drive-demo-salt-v1', 32).toString('hex')
}));
const otherOrgUser = { id: 'user-6', name: 'Morgan Ellis', email: 'morgan@harbor.example', role: 'Business manager', orgId: 'harbor', salt: 'P-drive-demo-salt-v1', hash: scryptSync('demo123', 'P-drive-demo-salt-v1', 32).toString('hex') };
users.push(otherOrgUser);

function iso(daysAgo = 0) { const d = new Date(); d.setDate(d.getDate() - daysAgo); return d.toISOString().slice(0, 10); }
const seed = {
  version: 1,
  products: [
    { id: 'prd-101', orgId: 'northstar', name: 'Cardiwell 10', code: 'NS-CW-010', category: 'Cardiovascular', businessUnit: 'Primary care', type: 'Branded', market: 'West', packSize: '10 x 10', unit: 'packs', status: 'Active', owner: 'Taylor Chen', notes: 'Synthetic demo record.' },
    { id: 'prd-102', orgId: 'northstar', name: 'Gastroline 20', code: 'NS-GL-020', category: 'Gastroenterology', businessUnit: 'Specialty', type: 'Branded', market: 'North', packSize: '10 x 10', unit: 'packs', status: 'Active', owner: 'Taylor Chen', notes: 'Synthetic demo record.' },
    { id: 'prd-103', orgId: 'northstar', name: 'VitaCore D', code: 'NS-VC-001', category: 'Wellness', businessUnit: 'Consumer health', type: 'Supplement', market: 'South', packSize: '30 tablets', unit: 'bottles', status: 'Review', owner: 'Taylor Chen', notes: 'Synthetic demo record.' },
    { id: 'prd-201', orgId: 'harbor', name: 'Harbor Sample A', code: 'HB-SA-001', category: 'General', businessUnit: 'Demo', type: 'Generic', market: 'East', packSize: '10 units', unit: 'packs', status: 'Active', owner: 'Morgan Ellis', notes: 'Separate-organization fixture.' }
  ],
  customers: [
    { id: 'cus-101', orgId: 'northstar', name: 'Meridian Wholesale', type: 'Distributor', territory: 'West', owner: 'Sam Rivera', email: 'orders@meridian.example', phone: '+1 555 0101', status: 'Active', notes: 'Synthetic demo account.' },
    { id: 'cus-102', orgId: 'northstar', name: 'Cedar Grove Pharmacy Group', type: 'Pharmacy', territory: 'West', owner: 'Sam Rivera', email: 'buying@cedargrove.example', phone: '+1 555 0102', status: 'Active', notes: 'Synthetic demo account.' },
    { id: 'cus-103', orgId: 'northstar', name: 'Northwind Hospital Supply', type: 'Hospital', territory: 'North', owner: 'Avery Morgan', email: 'supply@northwind.example', phone: '+1 555 0103', status: 'Active', notes: 'Synthetic demo account.' },
    { id: 'cus-104', orgId: 'northstar', name: 'Sundale Distribution', type: 'Wholesaler', territory: 'South', owner: 'Sam Rivera', email: 'team@sundale.example', phone: '+1 555 0104', status: 'Active', notes: 'Synthetic demo account.' },
    { id: 'cus-201', orgId: 'harbor', name: 'Harbor Test Account', type: 'Distributor', territory: 'East', owner: 'Morgan Ellis', email: 'ops@harbor.example', phone: '+1 555 0201', status: 'Active', notes: 'Separate-organization fixture.' }
  ],
  orders: [
    ['ord-1001','cus-101','prd-101',5,1040,105], ['ord-1002','cus-102','prd-101',3,624,85], ['ord-1003','cus-101','prd-102',4,920,75],
    ['ord-1004','cus-103','prd-101',6,1248,60], ['ord-1005','cus-104','prd-103',8,480,48], ['ord-1006','cus-101','prd-101',7,1456,35],
    ['ord-1007','cus-102','prd-102',2,460,28], ['ord-1008','cus-103','prd-101',4,832,21], ['ord-1009','cus-104','prd-103',5,300,14],
    ['ord-1010','cus-101','prd-102',3,690,8], ['ord-1011','cus-102','prd-101',2,416,4]
  ].map(([id,customerId,productId,quantity,value,days], i) => ({ id, orgId: 'northstar', customerId, productId, orderDate: iso(days), quantity, unit: 'packs', value, currency: 'USD', status: i === 10 ? 'Processing' : 'Completed', reference: `DEMO-${id.slice(-4)}` })).concat([
    { id:'ord-1012',orgId:'northstar',customerId:'cus-103',productId:'prd-102',orderDate:iso(12),quantity:10,unit:'packs',value:2300,currency:'USD',status:'Cancelled',reference:'DEMO-1012' },
    { id:'ord-201',orgId:'harbor',customerId:'cus-201',productId:'prd-201',orderDate:iso(10),quantity:2,unit:'packs',value:100,currency:'USD',status:'Completed',reference:'HARBOR-0201' }
  ]),
  tasks: [
    { id:'tsk-101',orgId:'northstar',title:'Confirm West territory reorder outlook',description:'Review the last quarter and record account follow-ups.',status:'In progress',priority:'High',dueDate:iso(-2),owner:'Sam Rivera',relatedType:'customer',relatedId:'cus-101',createdBy:'Jordan Lee' },
    { id:'tsk-102',orgId:'northstar',title:'Review VitaCore D product record',description:'Check business fields for completeness.',status:'To do',priority:'Medium',dueDate:iso(3),owner:'Taylor Chen',relatedType:'product',relatedId:'prd-103',createdBy:'Jordan Lee' },
    { id:'tsk-103',orgId:'northstar',title:'Attach quarterly account summary',description:'Add the approved internal summary link.',status:'To do',priority:'Low',dueDate:iso(7),owner:'Avery Morgan',relatedType:'customer',relatedId:'cus-103',createdBy:'Jordan Lee' }
  ],
  documents: [
    { id:'doc-101',orgId:'northstar',title:'West territory account brief',type:'Account brief',owner:'Sam Rivera',uploadDate:iso(9),version:'1.0',relatedType:'customer',relatedId:'cus-101',url:'https://example.com/demo/west-brief' },
    { id:'doc-102',orgId:'northstar',title:'Cardiwell commercial overview',type:'Product overview',owner:'Taylor Chen',uploadDate:iso(18),version:'2.1',relatedType:'product',relatedId:'prd-101',url:'https://example.com/demo/cardiwell-overview' }
  ],
  automations: [
    { id:'aut-101',orgId:'northstar',name:'Upcoming task reminder',trigger:'Task due within 2 days',action:'Show an in-app reminder to the owner',owner:'Avery Morgan',enabled:false,history:[{ date:iso(1),status:'Paused',detail:'Demo configuration; no external messages are sent.' }] },
    { id:'aut-102',orgId:'northstar',name:'Customer reorder attention',trigger:'No completed order in 60 days',action:'Create a review task for the account owner',owner:'Jordan Lee',enabled:false,history:[] }
  ],
  audit: [
    { id:'evt-101',orgId:'northstar',actor:'Avery Morgan',action:'created',recordType:'product',recordId:'prd-101',detail:'Cardiwell 10 added to the product catalog.',at:new Date(Date.now()-86400000*2).toISOString() },
    { id:'evt-102',orgId:'northstar',actor:'Sam Rivera',action:'updated',recordType:'customer',recordId:'cus-101',detail:'Account follow-up reviewed.',at:new Date(Date.now()-86400000).toISOString() },
    { id:'evt-103',orgId:'northstar',actor:'Taylor Chen',action:'linked',recordType:'document',recordId:'doc-102',detail:'Commercial overview linked to Cardiwell 10.',at:new Date(Date.now()-86400000*.5).toISOString() }
  ]
};

async function loadDb() {
  try { return JSON.parse(await readFile(dataFile, 'utf8')); }
  catch (e) {
    if (e.code !== 'ENOENT') throw e;
    await mkdir(path.dirname(dataFile), { recursive: true });
    await saveDb(seed); return structuredClone(seed);
  }
}
let db = await loadDb();
let saveChain = Promise.resolve();
function saveDb(next = db) {
  saveChain = saveChain.then(async () => {
    await mkdir(path.dirname(dataFile), { recursive: true });
    const temp = `${dataFile}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify(next, null, 2), { mode: 0o600 });
    await rename(temp, dataFile);
  });
  return saveChain;
}
function json(res, status, body, extra = {}) {
  res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'same-origin', 'Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'", ...extra });
  res.end(JSON.stringify(body));
}
function parseCookies(req) { return Object.fromEntries((req.headers.cookie || '').split(';').map(x => x.trim().split('=').map(decodeURIComponent)).filter(x => x.length === 2)); }
function getUser(req) {
  const token = parseCookies(req).pdrive_session;
  const entry = token && sessions.get(token);
  if (!entry || entry.expires < Date.now()) { if (token) sessions.delete(token); return null; }
  return users.find(u => u.id === entry.userId) || null;
}
const permissions = {
  read: new Set(roles),
  write: new Set(['Administrator','Business manager','Sales','Operations']),
  customers: new Set(['Administrator','Business manager','Sales','Compliance']),
  orders: new Set(['Administrator','Business manager','Sales','Operations','Compliance']),
  admin: new Set(['Administrator'])
};
function allowed(user, action) { return permissions[action]?.has(user.role) || false; }
function visible(collection, user) {
  const rows = db[collection].filter(r => r.orgId === user.orgId);
  if (user.role !== 'Sales') return rows;
  const assignedCustomers = new Set(db.customers.filter(c => c.orgId === user.orgId && c.owner === user.name).map(c => c.id));
  if (collection === 'customers') return rows.filter(c => c.owner === user.name);
  if (collection === 'orders') return rows.filter(o => assignedCustomers.has(o.customerId));
  if (collection === 'tasks') return rows.filter(t => t.owner === user.name || t.createdBy === user.name || (t.relatedType === 'customer' && assignedCustomers.has(t.relatedId)));
  if (collection === 'documents') return rows.filter(d => (d.relatedType === 'customer' && assignedCustomers.has(d.relatedId)) || (d.relatedType === 'product' && db.products.some(p=>p.id===d.relatedId&&p.orgId===user.orgId)));
  if (collection === 'audit') {
    const recordIds = new Set([...assignedCustomers, ...db.orders.filter(o=>o.orgId===user.orgId&&assignedCustomers.has(o.customerId)).map(o=>o.id), ...db.tasks.filter(t=>t.orgId===user.orgId&&(t.owner===user.name||t.createdBy===user.name)).map(t=>t.id), ...db.products.filter(p=>p.orgId===user.orgId).map(p=>p.id)]);
    return rows.filter(a => a.actor === user.name || recordIds.has(a.recordId));
  }
  return rows;
}
function safeUser(user) { return { id:user.id,name:user.name,email:user.email,role:user.role,orgId:user.orgId }; }
function audit(user, action, type, id, detail) {
  db.audit.unshift({ id:`evt-${randomBytes(5).toString('hex')}`, orgId:user.orgId, actor:user.name, action, recordType:type, recordId:id, detail, at:new Date().toISOString() });
  db.audit = db.audit.slice(0, 5000);
}
async function bodyJson(req) {
  let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 100_000) throw Object.assign(new Error('Request is too large.'), { status:413 }); }
  try { return raw ? JSON.parse(raw) : {}; } catch { throw Object.assign(new Error('Send valid JSON.'), { status:400 }); }
}
const text = (v, max=180) => typeof v === 'string' ? v.trim().slice(0,max) : '';
const pick = (v, options, fallback) => options.includes(v) ? v : fallback;
const date = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '';
function productStats(product, orders, customers, days) {
  const start = Date.now() - days * 86400000;
  const sales = orders.filter(o => o.productId === product.id && o.status === 'Completed' && new Date(`${o.orderDate}T00:00:00Z`).getTime() >= start);
  const customerCounts = new Map(); for (const o of sales) customerCounts.set(o.customerId, (customerCounts.get(o.customerId)||0)+1);
  const repeatCustomers = [...customerCounts.values()].filter(n => n >= 2).length;
  const buyers = customerCounts.size;
  const sorted = sales.slice().sort((a,b) => a.orderDate.localeCompare(b.orderDate));
  const intervals = [];
  for (const cid of new Set(sales.map(o=>o.customerId))) {
    const dates = sales.filter(o=>o.customerId===cid).map(o=>o.orderDate).sort();
    for (let i=1;i<dates.length;i++) intervals.push((new Date(`${dates[i]}T00:00:00Z`)-new Date(`${dates[i-1]}T00:00:00Z`))/86400000);
  }
  const activeBuyers = new Set(sales.map(o=>o.customerId));
  const territories = new Set(sales.map(o=>customers.find(c=>c.id===o.customerId)?.territory).filter(Boolean)).size;
  const completeness = ['name','code','category','businessUnit','market','unit','status'].filter(k=>text(product[k])).length;
  const recent = sales.some(o => new Date(`${o.orderDate}T00:00:00Z`).getTime() >= Date.now()-30*86400000);
  const repeatRate = buyers ? repeatCustomers / buyers : 0;
  const score = Math.round(100 * (0.35*Math.min(1, sales.reduce((a,o)=>a+o.quantity,0)/20) + 0.25*Math.min(1,buyers/5) + 0.25*repeatRate + 0.15*completeness/7));
  return { productId:product.id, product:product.name, windowDays:days, orderCount:sales.length, units:sales.reduce((a,o)=>a+o.quantity,0), customers:buyers, repeatCustomers, repeatRate:Math.round(repeatRate*100), avgReorderDays:intervals.length?Math.round(intervals.reduce((a,b)=>a+b,0)/intervals.length):null, coverage:territories, completeness, recent, score, orderIds:sorted.map(o=>o.id), caveat:'Estimate from entered, completed demo orders only. Small samples and incomplete records can change comparisons; this is not a forecast.' };
}
function filterForUser(collection, user) {
  return visible(collection, user).map(({ orgId, ...rest })=>{
    if (collection==='customers' && user.role==='Compliance') { delete rest.email; delete rest.phone; }
    return rest;
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'GET' && url.pathname === '/api/demo-users') return json(res,200,users.map(u=>({id:u.id,name:u.name,email:u.email,role:u.role,org:u.orgId==='northstar'?'Northstar Pharma':'Harbor Demo'})));
    if (url.pathname === '/api/login' && req.method === 'POST') {
      const data = await bodyJson(req); const user = users.find(u => u.id === data.userId);
      if (!user || typeof data.password !== 'string' || data.password.length > 128) return json(res,401,{error:'Choose a demo account and enter its password.'});
      const supplied = scryptSync(data.password, user.salt, 32); const expected = Buffer.from(user.hash,'hex');
      if (supplied.length !== expected.length || !timingSafeEqual(supplied,expected)) return json(res,401,{error:'That password did not match.'});
      const token = randomBytes(32).toString('hex'); sessions.set(token,{userId:user.id,expires:Date.now()+8*60*60*1000});
      return json(res,200,{user:safeUser(user)},{'Set-Cookie':`pdrive_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`});
    }
    if (url.pathname === '/api/logout' && req.method === 'POST') { const token=parseCookies(req).pdrive_session; if(token)sessions.delete(token); return json(res,200,{ok:true},{'Set-Cookie':'pdrive_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'}); }
    if (url.pathname.startsWith('/api/')) {
      const user = getUser(req); if (!user) return json(res,401,{error:'Sign in to continue.'});
      if (req.method === 'GET' && url.pathname === '/api/me') return json(res,200,{user:safeUser(user)});
      if (req.method !== 'GET' && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return json(res,403,{error:'Cross-origin changes are not allowed.'});
      if (req.method === 'GET' && url.pathname === '/api/dashboard') {
        const orders=visible('orders',user), products=visible('products',user), customers=visible('customers',user), tasks=visible('tasks',user);
        const days=Math.min(365,Math.max(30,Number(url.searchParams.get('days'))||90));
        const start=Date.now()-days*86400000; const complete=orders.filter(o=>o.status==='Completed'&&new Date(`${o.orderDate}T00:00:00Z`).getTime()>=start);
        const stats=products.filter(p=>p.orgId===user.orgId).map(p=>productStats(p,orders,customers,days)).sort((a,b)=>b.score-a.score);
        const buyerIds=new Set(complete.map(o=>o.customerId));
        const repeatCustomers=[...buyerIds].filter(cid=>complete.filter(o=>o.customerId===cid).length>=2).length;
        const repeat=buyerIds.size ? repeatCustomers/buyerIds.size : 0;
        return json(res,200,{days,completedOrders:complete.length,sales:complete.reduce((a,o)=>a+o.value,0),buyers:buyerIds.size,repeatCustomers,repeatRate:Math.round(repeat*100),overdue:tasks.filter(t=>t.status!=='Done'&&t.dueDate<iso()).length,products:stats.slice(0,4),activity:visible('audit',user).slice(0,5).map(({orgId,...a})=>a)});
      }
      if (req.method === 'GET' && url.pathname === '/api/analytics/products') {
        const days=Math.min(365,Math.max(30,Number(url.searchParams.get('days'))||90)); const cs=visible('customers',user), os=visible('orders',user);
        return json(res,200,visible('products',user).map(p=>productStats(p,os,cs,days)).sort((a,b)=>b.score-a.score));
      }
      if (req.method === 'GET' && url.pathname === '/api/activity') return json(res,200,filterForUser('audit',user));
      const collections={products:'products',customers:'customers',orders:'orders',tasks:'tasks',documents:'documents',automations:'automations'};
      const match=url.pathname.match(/^\/api\/(products|customers|orders|tasks|documents|automations)(?:\/([^/]+))?$/);
      if (match && req.method === 'GET') {
        const [,key,id]=match; const collection=collections[key];
        if ((['customers','orders'].includes(key)&&!allowed(user,key)) || (key==='automations'&&!allowed(user,'admin'))) return json(res,403,{error:'Your role cannot view this module.'});
        if (id) { const record=visible(collection,user).find(x=>x.id===id); if(!record)return json(res,404,{error:'Record not found.'});
          const publicRecord={...record}; if(collection==='customers'&&user.role==='Compliance'){delete publicRecord.email;delete publicRecord.phone;}
          const related=Object.fromEntries(Object.entries(collections).filter(([k])=>k!==key).map(([k,c])=>[k,visible(c,user).filter(r=>r.relatedId===id||r.productId===id||r.customerId===id||r.id===record.customerId||r.id===record.productId).map(({orgId,...r})=>r)]));
          return json(res,200,{record:Object.fromEntries(Object.entries(publicRecord).filter(([k])=>k!=='orgId')),related,history:visible('audit',user).filter(a=>a.recordId===id).map(({orgId,...a})=>a)});
        }
        if (['customers','orders'].includes(key)&&!allowed(user,key)) return json(res,403,{error:'Your role cannot view this module.'});
        let list=filterForUser(collection,user);
        if (key==='orders') { if(url.searchParams.has('status')) list=list.filter(x=>x.status===url.searchParams.get('status')); }
        if (url.searchParams.has('q')) { const q=url.searchParams.get('q').toLowerCase(); list=list.filter(x=>Object.values(x).some(v=>String(v).toLowerCase().includes(q))); }
        return json(res,200,list);
      }
      if (match && req.method === 'POST') {
        const [,key]=match; const collection=collections[key];
        if (!allowed(user,'write') || (['customers','orders'].includes(key)&&!allowed(user,key)) || (key==='automations'&&!allowed(user,'admin'))) return json(res,403,{error:'Your role cannot change this record.'});
        const input=await bodyJson(req); let record;
        if(key==='tasks') {
          const title=text(input.title,120); if(!title)return json(res,400,{error:'A task title is required.'});
          record={id:`tsk-${randomBytes(5).toString('hex')}`,orgId:user.orgId,title,description:text(input.description,1000),status:'To do',priority:pick(input.priority,['Low','Medium','High'],'Medium'),dueDate:date(input.dueDate)||iso(7),owner:user.role==='Sales'?user.name:(text(input.owner,80)||user.name),relatedType:pick(input.relatedType,['product','customer','order','document'],'product'),relatedId:text(input.relatedId,80),createdBy:user.name};
          const linkedCollection={product:'products',customer:'customers',order:'orders',document:'documents'}[record.relatedType];
          if(record.relatedId&&!visible(linkedCollection,user).some(r=>r.id===record.relatedId))return json(res,400,{error:'The related record is not available in this organization.'});
        } else if(key==='products') {
          const name=text(input.name,100), code=text(input.code,50); if(!name||!code)return json(res,400,{error:'Product name and identifier are required.'});
          record={id:`prd-${randomBytes(5).toString('hex')}`,orgId:user.orgId,name,code,category:text(input.category,80),businessUnit:text(input.businessUnit,80),type:text(input.type,50),market:text(input.market,50),packSize:text(input.packSize,50),unit:text(input.unit,30),status:pick(input.status,['Active','Review','Inactive'],'Review'),owner:text(input.owner,80)||user.name,notes:text(input.notes,1000)};
        } else if(key==='customers') {
          const name=text(input.name,120); if(!name)return json(res,400,{error:'Customer or account name is required.'});
          const email=text(input.email,160); if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json(res,400,{error:'Enter a valid business email address.'});
          record={id:`cus-${randomBytes(5).toString('hex')}`,orgId:user.orgId,name,type:pick(input.type,['Distributor','Wholesaler','Pharmacy','Hospital','Clinic','Other'],'Other'),territory:text(input.territory,60),owner:user.role==='Sales'?user.name:(text(input.owner,80)||user.name),email,phone:text(input.phone,40),status:'Active',notes:text(input.notes,1000)};
        } else if(key==='orders') {
          const customer=visible('customers',user).find(c=>c.id===text(input.customerId,80));
          const product=visible('products',user).find(p=>p.id===text(input.productId,80));
          const quantity=Number(input.quantity), value=Number(input.value||0);
          if(!customer||!product)return json(res,400,{error:'Choose a customer and product available in your organization.'});
          if(!Number.isFinite(quantity)||quantity<=0||quantity>1000000||!Number.isFinite(value)||value<0||value>1000000000)return json(res,400,{error:'Quantity must be positive and order value must be zero or more.'});
          record={id:`ord-${randomBytes(5).toString('hex')}`,orgId:user.orgId,customerId:customer.id,productId:product.id,orderDate:date(input.orderDate)||iso(),quantity,unit:text(input.unit,30)||product.unit||'units',value,currency:/^[A-Za-z]{3}$/.test(input.currency||'USD')?String(input.currency||'USD').toUpperCase():'USD',status:pick(input.status,['Processing','Completed','Cancelled','Returned'],'Processing'),reference:text(input.reference,60)||`DEMO-${randomBytes(3).toString('hex').toUpperCase()}`};
        } else return json(res,400,{error:'This record type is read-only in the prototype.'});
        db[collection].unshift(record); audit(user,'created',key==='customers'?'customer':key==='orders'?'order':key.slice(0,-1),record.id,`Created ${record.name||record.title||record.reference}.`); await saveDb();
        const {orgId,...publicRecord}=record; return json(res,201,publicRecord);
      }
      const taskMatch=url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
      if(taskMatch&&req.method==='PATCH') {
        if(!allowed(user,'write'))return json(res,403,{error:'Your role cannot change tasks.'});
        const task=visible('tasks',user).find(t=>t.id===taskMatch[1]); if(!task)return json(res,404,{error:'Task not found.'});
        const input=await bodyJson(req); if(input.status) task.status=pick(input.status,['To do','In progress','Done'],'To do'); if(input.priority) task.priority=pick(input.priority,['Low','Medium','High'],task.priority); if(input.owner)task.owner=text(input.owner,80); if(input.dueDate)task.dueDate=date(input.dueDate)||task.dueDate;
        audit(user,'updated','task',task.id,`Updated task status to ${task.status}.`); await saveDb(); const {orgId,...out}=task;return json(res,200,out);
      }
      return json(res,404,{error:'API route not found.'});
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res,405,{error:'Method not allowed.'});
    const rel=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1)); const target=path.resolve(publicDir,rel);
    if(!target.startsWith(publicDir+path.sep))return json(res,404,{error:'Not found.'});
    const content=await readFile(target); const type=target.endsWith('.css')?'text/css':target.endsWith('.js')?'text/javascript':target.endsWith('.svg')?'image/svg+xml':'text/html';
    res.writeHead(200,{'Content-Type':`${type}; charset=utf-8`,'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"});
    if(req.method==='HEAD')res.end();else res.end(content);
  } catch (e) { console.error('Request failed:',e.message); if(!res.headersSent)json(res,e.status||500,{error:e.status?e.message:'The request could not be completed.'});else res.destroy(); }
});
server.listen(port,()=>console.log(`P-drive prototype listening at http://localhost:${port} (data: ${dataFile})`));
