'use strict';
var mesh;
var busy=false;
var psStatus = [
  '$ErrorActionPreference="Stop"',
  '$sys=New-Object -ComObject Microsoft.Update.Session',
  '$search=$sys.CreateUpdateSearcher().Search("IsInstalled=0 and IsHidden=0")',
  '$titles=@($search.Updates | ForEach-Object { $_.Title })',
  '$reboot=$false',
  'try { $reboot=(Test-Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WindowsUpdate\\Auto Update\\RebootRequired") -or (Test-Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Component Based Servicing\\RebootPending") } catch {}',
  '$critical=@($search.Updates | Where-Object { $_.MsrcSeverity -eq "Critical" -or $_.MsrcSeverity -eq "Important" }).Count',
  '$status=if($reboot -or $critical -gt 0){"red"}elseif($search.Updates.Count -gt 0){"yellow"}else{"green"}',
  '[pscustomobject]@{status=$status;message=if($reboot){"Herstart vereist"}elseif($search.Updates.Count -gt 0){"Updates beschikbaar"}else{"Up-to-date"};pending=$search.Updates.Count;rebootRequired=$reboot;updates=$titles;checkedAt=(Get-Date).ToString("o")} | ConvertTo-Json -Compress -Depth 4'
].join('\r\n');
var psInstall = [
  '$ErrorActionPreference="Stop"',
  '$session=New-Object -ComObject Microsoft.Update.Session',
  '$found=$session.CreateUpdateSearcher().Search("IsInstalled=0 and IsHidden=0")',
  '$collection=New-Object -ComObject Microsoft.Update.UpdateColl',
  'foreach($u in $found.Updates){ if(-not $u.EulaAccepted){$u.AcceptEula()};[void]$collection.Add($u) }',
  'if($collection.Count -gt 0){',
  ' $down=$session.CreateUpdateDownloader();$down.Updates=$collection;[void]$down.Download()',
  ' $ready=New-Object -ComObject Microsoft.Update.UpdateColl',
  ' foreach($u in $collection){if($u.IsDownloaded){[void]$ready.Add($u)}}',
  ' if($ready.Count -gt 0){$installer=$session.CreateUpdateInstaller();$installer.Updates=$ready;$result=$installer.Install()}',
  '}',
  '$reboot=(Test-Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WindowsUpdate\\Auto Update\\RebootRequired")',
  '[pscustomobject]@{status="yellow";message="Installatieopdracht voltooid; controleer opnieuw";pending=$null;rebootRequired=$reboot;updates=@();checkedAt=(Get-Date).ToString("o")} | ConvertTo-Json -Compress'
].join('\r\n');
function send(id,result){ mesh.SendCommand({action:'plugin',plugin:'windowsupdate',pluginaction:'result',requestId:id,result:result}); }
function consoleaction(args,rights,sessionid,parent){
  mesh=parent;
  if(args.pluginaction!=='run') return;
  var id=args.requestId;
  if(process.platform!=='win32'){send(id,{status:'unknown',message:'Alleen Windows ondersteund',checkedAt:new Date().toISOString()});return;}
  if(busy){send(id,{status:'yellow',message:'Agent is al bezig',checkedAt:new Date().toISOString()});return;}
  busy=true;
  var script=args.operation==='install'?psInstall:psStatus;
  try {
    var child=require('child_process').execFile(process.env.windir+'\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-Command','-'],{type:1});
    var output='',error='';
    child.stdout.on('data',function(s){output+=s;});
    child.stderr.on('data',function(s){error+=s;});
    child.on('exit',function(code){
      busy=false;
      var result;
      try { var lines=output.trim().split(/\r?\n/);result=JSON.parse(lines[lines.length-1]); }
      catch(e){result={status:'red',message:'Windows Update controle mislukt',error:(error||output||'Exit code '+code).substring(0,1500),checkedAt:new Date().toISOString()};}
      send(id,result);
    });
    child.stdin.write(script+'\r\nexit\r\n');
  } catch(e){busy=false;send(id,{status:'red',message:'PowerShell niet gestart',error:String(e),checkedAt:new Date().toISOString()});}
}
module.exports={consoleaction:consoleaction};
