"use strict";
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/bootstrap.js'), 'utf8');
function harness({ online = false, missing = false, empty = false, dies = false, url = 'http://localhost:8890' } = {}) {
  let launches = [], opened = [], focused = 0, checks = 0, removed = 0;
  const prefs = {serverPython:'C:\\Conda\\envs\\pdf\\python.exe', serverScript:'C:\\Server\\server.py'};
  const nodes = [];
  const toolbar = {appendChild(node) { nodes.push(node); }};
  const win = {document:{getElementById:()=>toolbar,createXULElement:()=>({style:{},classList:{add(){}},setAttribute(){},addEventListener(){},removeEventListener(){},remove(){removed++;}})}};
  const context = {
    URL, PathUtils:path.win32, Date,
    Services:{prompt:{alert(){}}}, IOUtils:{exists:async()=>!missing},
    ChromeUtils:{importESModule:()=>({Subprocess:{getEnvironment:()=>({Path:'C:\\Windows',SystemRoot:'C:\\Windows'}),call:async(options)=>{
      launches.push(options); online = !dies;
      return {exitCode:dies?1:null,wait:()=>new Promise(()=>{}),stdout:{readString:async()=>''},stderr:{readString:async()=>''}};
    }}})},
    Zotero:{initializationPromise:Promise.resolve(),uiReadyPromise:Promise.resolve(),getMainWindows:()=>[win],
      Prefs:{get:key=>key.endsWith('new_serverip')?url:empty?'':prefs[key.split('.').at(-1)]},
      HTTP:{request:async(method,target)=>{checks++; assert.equal(method,'GET');assert.ok(target.endsWith('/health'));if(!online)throw Error('offline');return {response:{status:'ok',version:'4.1.7'}};}},
      Promise:{delay:async()=>{}},debug(){},logError(){},
      openInViewer:uri=>{opened.push(uri);return {closed:false,focus(){focused++;}}},
    },
  };
  vm.runInNewContext(source,context);
  return {context,win,nodes,launches,opened,get focused(){return focused;},get removed(){return removed;},get checks(){return checks;}};
}
(async()=>{
  const h=harness();
  await h.context.startup({rootURI:'jar:file:///test.xpi!/'});
  h.context.onMainWindowLoad({window:h.win});
  assert.equal(h.nodes.length,1);
  assert.equal(h.nodes[0].id,'pdf2zh-companion-server-button');
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
  h.context.shutdown();assert.equal(h.removed,1);assert.equal(h.context.Zotero.PDF2ZHCompanion,undefined);
  await assert.rejects(h.context.openServer(),/停用/);
  const live=harness({online:true,empty:true});await live.context.openServer();assert.equal(live.launches.length,0);
  for (const [options,pattern] of [[{empty:true},/配置编辑器/],[{missing:true},/找不到 Python/],[{dies:true},/启动后退出/],[{url:'https://example.com'},/本机地址/]]) {
    const failure=harness(options);await assert.rejects(failure.context.openServer(),pattern);assert.equal(failure.opened.length,0);
  }
  const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../src/manifest.json')));
  assert.equal(manifest.version,'2.0.0');assert.ok(manifest.applications.zotero.update_url);
  for (const forbidden of ['onDialogEvents','translateSelected','openComparison','getSelectedItems','Zotero.Reader','Server.Endpoints','setInterval']) assert.ok(!source.includes(forbidden),forbidden);
  console.log('single-button startup, reuse, built-in viewer, errors, lifecycle and no-translation tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
