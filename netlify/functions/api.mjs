import data from './data.mjs';
import { createHash } from 'node:crypto';

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const ids = text => [...new Set((String(text || '').match(/SRC-[A-Z0-9-]+/g) || []))];
const imgFor = (p) => {
  const pid=p.product_id||'';
  const img=p.image_url || '';
  if(img.startsWith('/static/')) return img;
  if(pid.includes('ENVY')) return '/static/images/vichi_envy_bag.jpg';
  if(pid.includes('ZESPRI')) return '/static/images/vichi_zespri_gold_4.jpg';
  return img;
};
const findProduct = id => data.san_pham.find(p => p.product_id === id || p.slug === id);
const sourceList = answer => ids(answer).map(id=>data.nguon_tham_khao.find(s=>s.source_id===id)).filter(Boolean);
const isSim = p => p?.profile_type === 'SIMULATED_IMPORT_EXPANSION';
const clean = v => String(v ?? '').trim();
const escapeHTML = s => String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const redact = s => String(s||'').replace(/[\w.+-]+@[\w.-]+\.[\w.-]+/g,'[email ẩn]').replace(/\+?\d[\d\s.\-]{7,}\d/g,'[SĐT ẩn]');
const sha256 = s => createHash('sha256').update(s,'utf8').digest('hex');
const hasAny = (q, a) => a.some(w=>q.includes(w));
const productHints=[
 ['P-GRAPE-SIM-03',['nho sữa','shine muscat','nho hàn','nho']],
 ['P-BLUBERRY-SIM-04',['blueberry','việt quất','bluberry']],
 ['P-CHERRY-SIM-05',['cherry','anh đào']],
 ['P-ORANGE-SIM-06',['cam navel','cam ai cập','navel','quả cam','trái cam']],
 ['P-PEAR-SIM-07',['lê nâu','lê hàn quốc','k-pear','eloasis','quả lê','trái lê']],
 ['P-MANDARIN-SIM-08',['quýt úc','quýt nhập khẩu','mandarin','quýt']],
 ['P-KUMQUAT-SIM-09',['kim quất','kumquat','tắc đài loan']],
 ['P-ENVY-VICHI-01',['envy','táo envy','t&g','táo']],
 ['P-ZESPRI-VICHI-01',['zespri','kiwi','sungold']]
];
function ask(req){
  const q=clean(req.question||req.user_q), ql=q.toLocaleLowerCase('vi'), qaid=clean(req.qa_id);
  const detected=productHints.find(([id, words])=>ql.includes(id.toLowerCase())||words.some(w=>new RegExp(`(^|[^\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?=$|[^\\p{L}])`,'u').test(ql)));
  const pid=clean(req.product_id)||(detected?.[0]||'');
  const candidate=data.ai_hoi_dap.filter(row => !pid || row.product_id===pid);
  let matched=qaid?data.ai_hoi_dap.find(row=>row.qa_id===qaid):null;
  if(!matched && q) matched=candidate.find(row=>clean(row.user_question).toLocaleLowerCase('vi')===ql);
  if(!matched && q){
    const stop=new Set('có không là gì ở tại cho của và này được như thế về trong với hay phải từ khi đã sẽ cần một các những sản phẩm'.split(' '));
    const words=ql.match(/[\p{L}\p{N}_]+/gu)?.filter(w=>w.length>1&&!stop.has(w))||[];
    const terms=['giá','bao nhiêu','xuất xứ','nước nào','quy cách','đóng gói','hành trình','tờ khai','hải quan','kiểm dịch','organic','bền vững','blockchain','hiểu nhầm','nguồn thông tin','chụp tại vichi','mã lô','tẩy xanh'];
    const scored=candidate.map(row=>{
      const qt=clean(row.user_question).toLocaleLowerCase('vi'), ans=clean(row.recommended_answer||row.official_answer).toLocaleLowerCase('vi');
      let score=terms.reduce((s,t)=>s+(ql.includes(t)&&qt.includes(t)?10:0),0);
      score+=words.reduce((s,w)=>s+(qt.includes(w)?4:ans.includes(w)?1:0),0);
      if(qt && (qt.includes(ql)||ql.includes(qt)))score+=8;
      return {row,score};
    }).sort((a,b)=>b.score-a.score)[0];
    if(scored?.score>=4) matched=scored.row;
  }
  if(matched){
    const product=findProduct(matched.product_id),answer=matched.recommended_answer||matched.official_answer||'';
    const sourceIDs=ids(answer);
    return {success:true, answer,qa_id:matched.qa_id,product_id:matched.product_id,profile_type:product?.profile_type||'',question:matched.user_question,source_ids:sourceIDs.join(', ')||matched.source_policy||(isSim(product)?'SRC-SIM-POLICY':'Kho tri thức XuatXu'),sources:sourceList(answer),source_nature:isSim(product)?'SIMULATION_ONLY':'Kho tri thức chuẩn hóa XuatXu',matched:true};
  }
  if(q&&pid){
    const stop=new Set('có không là gì ở đâu tại cho của và này được như thế nào bao nhiêu về trong với hay phải từ khi đã sẽ cần một các những câu hỏi danh mục ngoài hoàn toàn'.split(' '));
    const words=ql.match(/[\p{L}\p{N}_]+/gu)?.filter(w=>w.length>1&&!stop.has(w))||[];
    const choice=data.ai_kien_thuc.filter(row=>row.product_id===pid).map(row=>{const t=`${row.topic||''} ${row.fact||''} ${row.allowed_answer||''}`.toLocaleLowerCase('vi');return {row,score:words.reduce((sum,w)=>sum+(t.includes(w)?2:0),0)};}).sort((a,b)=>b.score-a.score)[0];
    if(choice?.score>=6){
      const ans=choice.row.allowed_answer||choice.row.fact||'',product=findProduct(pid),sourceIDs=ids(ans);
      return {success:true,answer:ans,kb_id:choice.row.kb_id,product_id:pid,profile_type:product?.profile_type||'',source_ids:sourceIDs.join(', ')||(isSim(product)?'SRC-SIM-POLICY':'Kho tri thức XuatXu'),sources:sourceList(ans),source_nature:isSim(product)?'SIMULATION_ONLY':'Kho tri thức chuẩn hóa XuatXu',matched:true};
    }
    const p=findProduct(pid);
    if(p){
      const answer=isSim(p)?`${p.display_name} thuộc nhóm Hồ sơ mô phỏng mở rộng (SIMULATED_IMPORT_EXPANSION): ảnh là minh họa, xuất xứ (${p.assumed_country_of_origin}), giá (${p.price_display}) và hành trình là giả định phục vụ trình diễn. KHÔNG thuộc 02 mẫu khảo sát thực địa tại VICHI MARKET và không xác minh được lô hàng thực tế. [Nguồn: SRC-SIM-POLICY]`:`Đối với ${p.display_name} (Hồ sơ thử nghiệm tại VICHI MARKET): hệ thống chỉ hiển thị thông tin quan sát từ ảnh nhãn và công bố cấp thương hiệu. Chưa có chứng từ cấp lô hàng để xác minh. XuatXu không suy đoán ngoài bằng chứng.`;
      return {success:true,answer,product_id:pid,profile_type:p.profile_type,source_nature:isSim(p)?'SIMULATION_ONLY':'LIMITED_RETAIL_EVIDENCE',source_ids:isSim(p)?'SRC-SIM-POLICY':'Kho tri thức nguồn XuatXu',matched:false};
    }
  }
  if(!q)return {success:false,message:'Vui lòng nhập câu hỏi cần giải đáp.'};
  let answer='Câu hỏi chưa khớp kho tri thức. Hãy chọn câu hỏi gợi ý hoặc nêu rõ sản phẩm để trả lời đúng phạm vi bằng chứng.';
  if(hasAny(ql,['xuatxu','hệ thống','làm sao','cách dùng','chức năng','lợi ích'])) answer='XuatXu cung cấp 02 hồ sơ thử nghiệm thực tế tại VICHI MARKET, 07 hồ sơ mô phỏng, tra cứu QR, hỏi đáp có nguồn và mô phỏng kiểm tra SHA-256.';
  else if(hasAny(ql,['3 không','nguyên tắc','tẩy xanh','greenwashing','minh bạch']))answer='Nguyên tắc minh bạch XuatXu: Không bịa chứng từ; không đánh đồng công bố thương hiệu với chứng từ lô; không tự cáo buộc tẩy xanh khi thiếu dữ liệu.';
  else if(hasAny(ql,['sha256','sha-256','hash','mã băm','mật mã','blockchain']))answer='Mô phỏng SHA-256 có 05 sự kiện giả định: sửa đổi dữ liệu sẽ khiến kiểm tra FAIL. Không phải giao dịch blockchain on-chain thực tế.';
  return {success:true,answer,source_ids:'Kho tri thức XuatXu',source_nature:'Trợ lý giải thích thông tin có nguồn',matched:false};
}
function detail(id,base){
  const product=findProduct(id);if(!product)return null;
  const pid=product.product_id;
  const cards=data.display_cards.filter(r=>r.product_id===pid).sort((a,b)=>(parseInt(a.sort_order)||999)-(parseInt(b.sort_order)||999));
  const evidences=data.bang_chung.filter(r=>r.product_id===pid),claims=data.claims.filter(r=>r.product_id===pid);
  const certs=data.chung_nhan.filter(r=>r.product_id===pid);
  const used=new Set([
    ...ids(product.source_ids),...cards.flatMap(r=>ids(r.source_ids)),...evidences.flatMap(r=>ids(r.source_id)),...claims.flatMap(r=>ids(r.source_id)),
    ...data.product_source_links.filter(r=>r.product_id===pid).map(r=>r.source_id).filter(Boolean)
  ]);
  return {success:true,product:{...product,image_url:imgFor(product)},lot:data.lo_hang.find(r=>r.product_id===pid)||{},display_cards:cards,evidences,claims,
    sources:data.nguon_tham_khao.filter(r=>used.has(r.source_id)),certifications:certs,
    faqs:data.ai_hoi_dap.filter(r=>r.product_id===pid),knowledge_items:data.ai_kien_thuc.filter(r=>r.product_id===pid),journeys:[],ledger:[],
    simulated_journey:isSim(product)?data.simulated_journeys.filter(r=>r.product_id===pid):[],simulated_documents:isSim(product)?data.simulated_documents.filter(r=>r.product_id===pid):[],
    is_simulated:isSim(product),qr_target_url:`${base}/#detail/${encodeURIComponent(pid)}`};
}
function verify(chain){
  let prior='GENESIS_SHA256_SIM_ONLY',is_valid=true,broken_step=null;
  const records=chain.map((r,i)=>{
    const prev_hash=r.previous_hash||'',payload=r.canonical_payload||'',calc=sha256(`${prior}|${payload}`),valid=prev_hash===prior&&r.sha256===calc;
    if(!valid&&broken_step===null){is_valid=false;broken_step=i+1;}
    const result={step:i+1,record_id:r.record_id||`SIM-H${String(i+1).padStart(2,'0')}`,event_id:r.event_id||`SIM-E${String(i+1).padStart(2,'0')}`,previous_hash:prev_hash,expected_previous_hash:prior,canonical_payload:payload,sha256:r.sha256||'',calculated_hash:calc,is_valid:valid,local_hash_verified:valid,onchain_verified:false};
    prior=r.sha256||calc;return result;
  });
  return {success:true,is_valid,chain_valid:is_valid,broken_step,message:is_valid?'PASS: Toàn bộ sự kiện giả định khớp SHA-256. Chuỗi nhất quán cục bộ.':`FAIL: Phát hiện sai lệch tại bước #${broken_step}!`,records};
}
async function feedback(request){
  const {getStore}=await import('@netlify/blobs');
  const store=getStore({name:'xuatxu-feedback',consistency:'strong'});
  if(request.method==='GET'){
    const {blobs}=await store.list({prefix:'item-'});
    const records=[];
    for(const item of blobs.slice(0,100)){
      const value=await store.get(item.key,{type:'json'});
      if(value)records.push({...value,participant_label:'Người dùng ẩn danh',comment:redact(value.comment)});
    }
    records.sort((a,b)=>b.id-a.id);
    return json({success:true,privacy_mode:'ANONYMIZED_PUBLIC_VIEW',total_count:records.length,feedbacks:records});
  }
  const contentType=request.headers.get('content-type')||'';
  if(!contentType.includes('application/json'))return json({success:false,message:'Cần gửi JSON'},415);
  const req=await request.json();
  const comment=escapeHTML(redact(clean(req.comment).slice(0,500)));
  if(!comment)return json({success:false,message:'Vui lòng nhập nội dung góp ý'},400);
  const id=Date.now(),entry={id,participant_label:'Người dùng ẩn danh',product_id:escapeHTML(clean(req.product_id).slice(0,50)),amount:escapeHTML(clean(req.amount||'Vừa đủ').slice(0,50)),comment,created_at:new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Ho_Chi_Minh'}).format(new Date())};
  await store.setJSON(`item-${id}-${crypto.randomUUID()}`,entry);
  return json({success:true,message:'Cảm ơn bạn đã đóng góp phản hồi (thông tin cá nhân được tự động ẩn danh)!',feedback:entry});
}
export default async function handler(request){
  const url=new URL(request.url);let path=url.pathname.replace(/^\/\.netlify\/functions\/api\/?/,'').replace(/^\/api\/?/,'');
  // Redirects can forward :splat as the function path.
  if(!path&&url.searchParams.has('path'))path=url.searchParams.get('path');
  const method=request.method,base=`${url.protocol}//${url.host}`;
  try{
    if(method==='GET'&&path==='init'){
      return json({success:true,positioning:'XuatXu – Biết nguồn, hiểu bằng chứng',products:data.san_pham.map(p=>({product_id:p.product_id,slug:p.slug,display_name:p.display_name,brand:p.brand,category:p.category,assumed_country_of_origin:p.assumed_country_of_origin,origin_iso2:p.origin_iso2,variety:p.variety,description:p.description,characteristics:p.characteristics,packaging_demo:p.packaging_demo,manufacturer_display:p.manufacturer_display,retailer_display:p.retailer_display||'Ghi nhận tại VICHI MARKET',image_url:imgFor(p),image_alt:p.image_alt,qr_target:p.qr_target,consumer_banner:p.consumer_banner,profile_type:p.profile_type,simulation_notice:p.simulation_notice,price_display:p.price_display,price_nature:p.price_nature,photo_nature:p.photo_nature,country_nature:p.country_nature})),qa_list:data.ai_hoi_dap,knowledge_list:data.ai_kien_thuc,sources:data.nguon_tham_khao,display_cards:data.display_cards,base_url:base});
    }
    if(method==='GET'&&path.startsWith('product-detail/')){
      const result=detail(decodeURIComponent(path.slice('product-detail/'.length)),base);
      return result?json(result):json({success:false,message:'Không tìm thấy hồ sơ sản phẩm'},404);
    }
    if(method==='GET'&&path==='generate-qr'){
      const QRCode=(await import('qrcode')).default;
      const id=clean(url.searchParams.get('product_id')), target=clean(url.searchParams.get('url'));
      let pid=id?findProduct(id)?.product_id:undefined;
      if(id&&!pid)return json({success:false,message:'Mã sản phẩm không nằm trong SAN_PHAM.csv'},400);
      if(!pid&&target.includes('#detail/'))pid=findProduct(target.split('#detail/').pop())?.product_id;
      pid=pid||'P-ENVY-VICHI-01';
      const urlText=`${base}/#detail/${encodeURIComponent(pid)}`;
      const png=await QRCode.toBuffer(urlText,{type:'png',errorCorrectionLevel:'M',margin:2,width:256});
      return new Response(new Uint8Array(png),{headers:{'content-type':'image/png','cache-control':'public, max-age=3600'}});
    }
    if(method==='POST'&&(path==='ai-ask'||path==='ai/ask')){
      const requestData=await request.json();const result=ask(requestData);
      return json(result,result.success?200:400);
    }
    if(method==='GET'&&(path==='tech-demo'||path==='tech/demo-chain'))return json({success:true,is_simulated:true,onchain_verified:false,banner:'DỮ LIỆU GIẢ LẬP – KHÔNG PHẢI CHỨNG TỪ CỦA VICHI',description:'Mô phỏng SHA-256 phục vụ nghiên cứu học thuật – Không phải giao dịch on-chain',events:data.tech_events,hash_chain:data.tech_hash_chain,chain:data.tech_hash_chain});
    if(method==='POST'&&(path==='tech-demo/verify'||path==='tech/verify')){
      const payload=await request.json();const chain=payload.chain??data.tech_hash_chain;
      if(!Array.isArray(chain)||chain.length>100)return json({success:false,message:'Chuỗi không hợp lệ'},400);
      return json(verify(chain));
    }
    if(path==='feedback'&&(method==='GET'||method==='POST')){
      try{return await feedback(request);}catch(e){console.error('Feedback storage error',e);return json({success:false,message:'Chưa kết nối được lưu trữ góp ý Netlify Blobs. Kiểm tra site, quyền và hạn mức.'},503);}
    }
    return json({success:false,message:'API không tồn tại'},404);
  }catch(e){console.error(e);return json({success:false,message:'Lỗi xử lý API'},500);}
}

export const config = { path: "/api/*" };
