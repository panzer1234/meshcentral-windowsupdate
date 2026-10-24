'use strict';
module.exports.windowsupdate = function (parent) {
    var obj = { parent: parent, exports: ['onDeviceRefreshEnd', 'updateResult', 'requestUpdate'] };
    var server = parent.parent;
    var states = Object.create(null);
    var pending = Object.create(null);

    // UI hook (executed in browser)
    obj.onDeviceRefreshEnd = function () {
        pluginHandler.registerPluginTab({ tabId: 'pluginWindowsUpdate', tabTitle: 'Windows Update' });
        var target = document.getElementById('pluginWindowsUpdate');
        if (!target || !currentNode || !currentNode._id) return;
        target.innerHTML = '';
        var wrapper = document.createElement('div');
        wrapper.style.cssText = 'padding:18px;font-family:Arial,sans-serif;max-width:800px';
        var h = document.createElement('h3'); h.textContent = 'Windows Update'; wrapper.appendChild(h);
        var state = document.createElement('div'); state.id = 'wuState'; state.textContent = 'Nog niet gecontroleerd'; state.style.cssText='padding:14px;border-radius:6px;background:#eee;margin:12px 0'; wrapper.appendChild(state);
        var details = document.createElement('pre'); details.id = 'wuDetails'; details.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere'; wrapper.appendChild(details);
        var check = document.createElement('button'); check.textContent='Status controleren'; check.onclick=function(){ pluginHandler.windowsupdate.requestUpdate('status'); }; wrapper.appendChild(check);
        var run = document.createElement('button'); run.textContent='Updates installeren'; run.style.marginLeft='10px'; run.onclick=function(){ if(confirm('Windows Updates installeren op '+currentNode.name+'? Er wordt NIET automatisch herstart.')) pluginHandler.windowsupdate.requestUpdate('install'); }; wrapper.appendChild(run);
        target.appendChild(wrapper);
        pluginHandler.windowsupdate.requestUpdate('status');
    };
    obj.requestUpdate = function (operation) {
        if (!currentNode || !currentNode._id) return;
        var box = document.getElementById('wuState');
        if (box) { box.textContent = operation === 'install' ? 'Installatie gestart…' : 'Controleren…'; box.style.background='#e0ebff'; }
        meshserver.send(JSON.stringify({action:'plugin',plugin:'windowsupdate',pluginaction:'request',nodeid:currentNode._id,operation:operation}));
    };
    obj.updateResult = function (message) {
        var data = message.event || message;
        if (!currentNode || data.nodeid !== currentNode._id) return;
        var box = document.getElementById('wuState'); var details = document.getElementById('wuDetails');
        if (!box || !details) return;
        var x = data.result || {};
        var colors={green:'#d8f3dc',yellow:'#fff3bf',red:'#ffd6d6',unknown:'#e9ecef'};
        box.style.background=colors[x.status] || colors.unknown;
        box.textContent=(x.status || 'unknown').toUpperCase()+' — '+(x.message || 'Onbekend');
        details.textContent='Laatste controle: '+(x.checkedAt||'-')+'\nOpenstaande updates: '+(x.pending===null||x.pending===undefined?'-':x.pending)+'\nHerstart nodig: '+(x.rebootRequired===true?'Ja':x.rebootRequired===false?'Nee':'Onbekend')+'\n'+(x.updates||[]).map(function(u){return '• '+u;}).join('\n')+'\n'+(x.error||'');
    };
    obj.sendResult = function (nodeid, result) {
        // Results are only distributed to server admins (never to server-users).
        server.DispatchEvent(['server-admins'], obj, {nolog:true,action:'plugin',plugin:'windowsupdate',pluginaction:'updateResult',nodeid:nodeid,result:result});
    };
    obj.serveraction = function (command, ws) {
        if (!command || !ws) return;
        if (command.pluginaction === 'result') {
            // Only the actual endpoint agent may submit results.
            if (!ws.dbNodeKey || !pending[ws.dbNodeKey] || pending[ws.dbNodeKey].id !== command.requestId) return;
            var nodeid=ws.dbNodeKey;
            delete pending[nodeid];
            var result=command.result || {};
            states[nodeid]=result;
            obj.sendResult(nodeid,result);
            return;
        }
        if (command.pluginaction !== 'request' || !ws.user || ((ws.user.siteadmin >>> 0)!==0xFFFFFFFF)) return;
        var nodeid=command.nodeid;
        if (typeof nodeid !== 'string' || !/^node\/[^/]+\/[^/]+$/.test(nodeid)) return;
        if (command.operation!=='status' && command.operation!=='install') return;
        var agent=server.webserver.wsagents[nodeid];
        if (!agent) { obj.sendResult(nodeid,{status:'unknown',message:'Endpoint offline',checkedAt:new Date().toISOString()}); return; }
        if (pending[nodeid]) { obj.sendResult(nodeid,{status:'yellow',message:'Er loopt al een taak',checkedAt:new Date().toISOString()}); return; }
        var id=require('crypto').randomBytes(12).toString('hex');
        pending[nodeid]={id:id,started:Date.now()};
        agent.send(JSON.stringify({action:'plugin',plugin:'windowsupdate',pluginaction:'run',operation:command.operation,requestId:id}));
    };
    obj.server_startup = function () {
        setInterval(function(){ Object.keys(pending).forEach(function(n){if(Date.now()-pending[n].started>45*60*1000){delete pending[n];obj.sendResult(n,{status:'red',message:'Taak time-out',checkedAt:new Date().toISOString()});}});},60000);
    };
    return obj;
};
