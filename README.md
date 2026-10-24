# Windows Update Status - MeshCentral prototype 0.1.0

Proof-of-concept for Windows Update monitoring and installation in the per-device Plugins tab of MeshCentral.

## Security and operational limitations
- **UNTESTED** against a running MeshCentral deployment. Back up MeshCentral first and test against one disposable Windows VM.
- Installation from MeshCentral's URL installer requires publishing *this project* to your own GitHub repo and changing the four placeholder repository/download URLs in `config.json`. They currently refer to MeshCentral upstream and must NOT be used as installer metadata.
- Manual installation may be possible using MeshCentral `settings.plugins.list`, depending on the installed version; see MeshCentral documentation and your pluginHandler.js.
- Only MeshCentral server administrators may run checks/installations; all actions must pass the existing authentication layer. Admin event target `server-admins` and admin flag compatibility must be verified.
- Current version does not persist statuses or run periodic checks. Status is checked when visiting an endpoint tab, or manually via the button. Offline/unreachable devices show unknown.
- Green = no pending updates and no detected reboot flag; yellow = pending noncritical updates; red = pending important/critical updates, reboot flag, or error. This is NOT a security compliance score.
- Installation uses Windows Update Agent COM interfaces, including applicable third-party/driver updates offered to that Windows Update agent. Windows Update policies, WSUS, disabled services and permissions still apply.
- Update installation does not automatically reboot. Installation can take a long time, and end-of-task status can be uncertain until a new scan.
- Server action/agent routing and UI hook API compatibility can differ by MeshCentral version. In particular, agent plugin module availability and JavaScript execution need real-world testing.

## Files
- `config.json` - MeshCentral plugin metadata (URL placeholders require editing)
- `windowsupdate.js` - server/UI plugin
- `modules_meshcore/windowsupdate.js` - Windows endpoint agent code (PowerShell via Windows Update COM)

## Suggested test
1. Upload code to your own GitHub repository and correct homepage/changelogUrl/configUrl/downloadUrl/repository.url.
2. Enable `settings.plugins.enabled` and restart MeshCentral.
3. Install via the raw config.json URL, or your version's supported local plugin install method.
4. Test on one nonproduction Windows VM. Verify agent module loading, server permissions, result dispatch and PowerShell execution.
5. Only then consider production deployment.
