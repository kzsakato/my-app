export async function collect(port){
  const tabs=await(await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(3000)})).json()
  const matching=tabs.filter(t=>t.type==='page'&&t.url==='http://localhost:4182/')
  if(matching.length!==1)throw Error('localhost:4182のChromeタブ1つを確認できません。候補タブ以外は読み取りません。')
  const endpoint=new URL(matching[0].webSocketDebuggerUrl)
  if(!['localhost','127.0.0.1'].includes(endpoint.hostname)||endpoint.port!==String(port))throw Error('CDP endpoint不一致')
  const expression=`(async()=>{
    if(location.origin!=='http://localhost:4182')throw Error('origin mismatch');
    const name='training-check-v12-local-man', list=await indexedDB.databases();
    if(!list.some(x=>x.name===name))throw Error('専用DB未作成');
    const db=await new Promise((ok,no)=>{const r=indexedDB.open(name);r.onupgradeneeded=()=>{r.transaction.abort();no(Error('existing DB required'))};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
    const tx=db.transaction(['canonical','cutover'],'readonly');
    const read=r=>new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
    const data=await read(tx.objectStore('canonical').get('app')),authority=await read(tx.objectStore('cutover').get('state'));db.close();
    const registrations=await navigator.serviceWorker.getRegistrations();
    return {origin:location.origin,secure:isSecureContext,userAgent:navigator.userAgent,displayMode:matchMedia('(display-mode: standalone)').matches?'standalone':'browser',buildText:document.body.innerText.match(/V1.2 MAN候補[^\\n]*/)?.[0]??null,db:{name,version:db.version,authoritative:authority?.authoritative===true,counts:{exercises:data?.exercises?.length,menus:data?.menus?.length,sessions:data?.sessions?.length}},sw:{controller:navigator.serviceWorker.controller?.scriptURL??null,scopes:registrations.map(r=>r.scope)},caches:await caches.keys()};
  })()`
  return await new Promise((ok,no)=>{
    const ws=new WebSocket(endpoint),timer=setTimeout(()=>{ws.close();no(Error('CDP read timeout'))},5000)
    ws.addEventListener('error',()=>{clearTimeout(timer);no(Error('CDP unavailable'))})
    ws.addEventListener('open',()=>ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}})))
    ws.addEventListener('message',event=>{const r=JSON.parse(event.data);if(r.id!==1)return;clearTimeout(timer);ws.close();if(r.error||r.result?.exceptionDetails)no(Error('候補SW/DB読み取り不成立'));else ok(r.result.result.value)})
  })
}
