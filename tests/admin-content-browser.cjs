const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  for(const width of [390,1366]){
   const page=await browser.newPage({viewport:{width,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://localhost:3011/admin-content-test');
   await page.getByRole('button',{name:'Gerenciar e excluir conteúdo'}).click();
   await page.getByText('PR-CGO · Power Check',{exact:true}).waitFor();
   await page.getByRole('checkbox').first().check();
   page.once('dialog',dialog=>dialog.dismiss());
   await page.getByRole('button',{name:'Excluir selecionados (1)'}).click();
   assert.equal(await page.getByRole('checkbox').count(),2);
   page.once('dialog',dialog=>dialog.accept());
   await page.getByRole('button',{name:'Excluir selecionados (1)'}).click();
   await page.getByText('Conteúdo excluído.',{exact:true}).waitFor();
   assert.equal(await page.getByRole('checkbox').count(),1);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:`tmp/admin-content-${width}.png`});assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS admin selection, cancel, delete, refresh, mobile and desktop');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
