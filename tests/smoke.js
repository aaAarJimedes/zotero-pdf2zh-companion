"use strict";
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/bootstrap.js'), 'utf8');
function harness({ online = false, missing = false, empty = false, dies = false, index = false, unsupported = false, url = 'http://localhost:8890' } = {}) {
  let launches = [], opened = [], focused = 0, checks = 0, removed = 0;
  let html = unsupported ? 'different page' : `      const STORAGE_KEY = "pdf2zh_history_v2";\n      function clearLocalHistory() {}\n      function mergeHistory(serverHistory) {}\n      function toggleHistoryItem(el) {}`, writes = 0;
  const prefs = {serverPython:'C:\\Conda\\envs\\pdf\\python.exe', serverScript:'C:\\Server\\server.py'};
  const nodes = [];
  const toolbar = {appendChild(node) { nodes.push(node); }};
  function element() {
    const listeners = new Map();
    return {style:{},classList:{add(){}},attributes:{},children:[],
      setAttribute(name,value){this.attributes[name]=value;},
      addEventListener(name,listener){listeners.set(name,listener);},
      removeEventListener(name){listeners.delete(name);},
      appendChild(child){child.parent=this;this.children.push(child);},
      openPopupAtScreen(){},remove(){removed++;},
      async dispatch(name,event={}) {
        if (!event.stopPropagation) event.stopPropagation=function(){this.stopped=true;};
        if (!event.preventDefault) event.preventDefault=function(){};
        await listeners.get(name)?.(event);
        if (!event.stopped && this.parent) await this.parent.dispatch(name,event);
      }};
  }
  const popupRoot=element();
  const win = {document:{documentElement:popupRoot,getElementById:()=>toolbar,createXULElement:element}};
  const context = {
    URL, PathUtils:path.win32, Date,
    Services:{prompt:{alert(){}},scriptloader:{loadSubScript(uri,scope){
      assert.ok(uri.endsWith('/history-patch.js'));
      vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/history-patch.js'),'utf8'),scope);
    }}}, IOUtils:{exists:async target=>{
      if (target.endsWith('index.html')) assert.equal(target,'C:\\Server\\index.html');
      return !missing && (index || !target.endsWith('index.html'));
    },makeDirectory:async()=>{},
      readUTF8:async()=>html,writeUTF8:async(target,text,options)=>{
        if (target.includes('companion-quality-package')) return;
        assert.ok(target.endsWith('index.html'));assert.equal(options.tmpPath,target+'.companion-history.tmp');html=text;writes++;
      }},
    ChromeUtils:{importESModule:()=>({Subprocess:{getEnvironment:()=>({Path:'C:\\Windows',SystemRoot:'C:\\Windows'}),call:async(options)=>{
      if (String(options.arguments[0]).endsWith('install_quality.py')) {
        let output=JSON.stringify({enabled:options.arguments.at(-1)==='true',hook_changed:false});
        return {wait:async()=>({exitCode:0}),stdout:{readString:async()=>{const chunk=output;output='';return chunk;}},stderr:{readString:async()=>''}};
      }
      if (options.arguments[0] === '-c') {
        let result=JSON.stringify({prefix:'C:\\Conda\\envs\\pdf',base_prefix:'C:\\Conda'});
        return {wait:async()=>({exitCode:0}),stdout:{readString:async()=>{const chunk=result;result='';return chunk;}},stderr:{readString:async()=>''}};
      }
      launches.push(options); online = !dies;
      return {exitCode:dies?1:null,wait:()=>new Promise(()=>{}),stdout:{readString:async()=>''},stderr:{readString:async()=>''}};
    }}})},
    Zotero:{initializationPromise:Promise.resolve(),uiReadyPromise:Promise.resolve(),getMainWindows:()=>[win],
      File:{getContentsAsync:async uri=>fs.readFileSync(path.join(__dirname,'../src/quality',uri.split('/').at(-1)),'utf8')},
      Prefs:{get:key=>key.endsWith('new_serverip')?url:empty?'':prefs[key.split('.').at(-1)],set:(key,value)=>{prefs[key.split('.').at(-1)]=value;}},
      HTTP:{request:async(method,target)=>{checks++; assert.equal(method,'GET');assert.ok(target.endsWith('/health'));if(!online)throw Error('offline');return {response:{status:'ok',version:'4.1.7'}};}},
      Promise:{delay:async()=>{}},debug(){},logError(){},
      openInViewer:uri=>{opened.push(uri);return {closed:false,focus(){focused++;}}},
    },
  };
  vm.runInNewContext(source,context);
  context.readPackagedText=async relative=>fs.readFileSync(path.join(__dirname,'../src',relative),'utf8');
  return {context,win,nodes,popupRoot,launches,opened,get focused(){return focused;},get removed(){return removed;},get checks(){return checks;},get writes(){return writes;},get html(){return html;}};
}
(async()=>{
  const h=harness();
  await h.context.startup({rootURI:'jar:file:///test.xpi!/'});
  h.context.onMainWindowLoad({window:h.win});
  assert.equal(h.nodes.length,1);
  assert.equal(h.nodes[0].id,'pdf2zh-companion-server-button');
  assert.equal(h.context.Zotero.PDF2ZHCompanion.qualityEnabled,true);
  const originalOpenServer=h.context.openServer;
  let opensFromMenu=0;
  h.context.openServer=async()=>{opensFromMenu++;};
  await h.nodes[0].dispatch('contextmenu',{screenX:10,screenY:10});
  const qualityPopup=h.popupRoot.children.at(-1);
  assert.equal(h.nodes[0].children.length,0,'context popup must be outside the toolbar button to avoid native button activation');
  const qualityItem=qualityPopup.children[0];
  assert.equal(qualityItem.attributes.checked,'true');
  await qualityItem.dispatch('command');
  assert.equal(h.context.Zotero.PDF2ZHCompanion.qualityEnabled,false);
  assert.equal(opensFromMenu,0,'the quality menu command must not activate its parent Server button');
  await qualityPopup.dispatch('popuphidden');
  assert.equal(h.removed,1,'closed context popup must be removed');
  h.context.openServer=originalOpenServer;
  await h.context.setQualityEnabled(false);
  assert.equal(h.context.Zotero.PDF2ZHCompanion.qualityEnabled,false,'an explicit false must not become the true default');
  const a=h.context.openServer(), b=h.context.openServer();
  assert.equal(a,b,'double click must share one launch');
  assert.equal(h.nodes[0].disabled,true);
  await a;
  assert.equal(h.nodes[0].disabled,false);
  assert.equal(h.launches.length,1);
  assert.equal(h.launches[0].environmentAppend,false);
  assert.deepEqual(Object.keys(h.launches[0].environment).filter(k=>k.toLowerCase()==='path'),['PATH']);
  assert.deepEqual(h.opened,['http://localhost:8890/']);
  await h.context.openServer(); assert.equal(h.focused,1);assert.equal(h.opened.length,1);
  await h.nodes[0].dispatch('contextmenu');
  h.context.shutdown();assert.equal(h.removed,3,'shutdown removes the button and any remaining context popup');assert.equal(h.context.Zotero.PDF2ZHCompanion,undefined);
  await assert.rejects(h.context.openServer(),/停用/);
  const live=harness({online:true,empty:true});await live.context.openServer();assert.equal(live.launches.length,0);
  const history=harness({online:true,index:true});await history.context.startup({rootURI:'jar:file:///test.xpi!/'});
  await history.context.openServer();assert.equal(history.launches.length,0);assert.equal(history.writes,1);assert.ok(history.html.includes('PDF2ZH_COMPANION_HISTORY_FIX 2.0.2'));
  await history.context.openServer();assert.equal(history.writes,1,'reopening must not rewrite the page');
  const changed=harness({online:true,index:true,unsupported:true});await changed.context.startup({rootURI:'jar:file:///test.xpi!/'});
  await changed.context.openServer();assert.equal(changed.writes,0);assert.equal(changed.opened.length,1,'unknown page must remain usable without being overwritten');
  for (const [options,pattern] of [[{empty:true},/配置编辑器/],[{missing:true},/找不到 Python/],[{dies:true},/启动后退出/],[{url:'https://example.com'},/本机地址/]]) {
    const failure=harness(options);await assert.rejects(failure.context.openServer(),pattern);assert.equal(failure.opened.length,0);
  }
  const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../src/manifest.json')));
  assert.equal(manifest.version,'2.1.0');assert.ok(manifest.applications.zotero.update_url);
  for (const forbidden of ['onDialogEvents','translateSelected','openComparison','getSelectedItems','Zotero.Reader','Server.Endpoints','setInterval']) assert.ok(!source.includes(forbidden),forbidden);
  console.log('single-button startup, reuse, built-in viewer, errors, lifecycle and no-translation tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
