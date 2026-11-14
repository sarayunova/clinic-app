; Clinic App installer. Build with: npm run build && npm run build:exe, then compile this file
; with Inno Setup's ISCC.exe. See installer/README.md for the full build sequence.
#define MyAppName "Clinic App"
#define MyAppVersion "0.1.0"
#define MyAppPublisher "LiVi Software"

[Setup]
AppId={{B6E2B6B0-6B9E-4C9F-9E6B-9B1B6B0A5C41}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName=C:\ClinicApp
DisableDirPage=no
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=admin
OutputDir=output
OutputBaseFilename=ClinicAppSetup-{#MyAppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
UninstallDisplayIcon={app}\clinic.exe
CloseApplications=force
RestartApplications=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional icons:"
Name: "autostart"; Description: "Start the clinic app automatically when Windows starts (recommended)"; GroupDescription: "Startup:"

[Code]
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
  ExePath: String;
  StoppedGracefully: Boolean;
begin
  // Stop the scheduled task first so its supervisor loop does not relaunch clinic.exe out from
  // under the graceful-stop attempt below. This does not reliably kill the already-launched child
  // process by itself (expected - Windows does not tie a Scheduled Task's lifetime to its child
  // processes); the graceful stop below is what actually stops that process.
  Exec('powershell.exe', '-NoProfile -ExecutionPolicy Bypass -Command "Stop-ScheduledTask -TaskName ClinicApp -ErrorAction SilentlyContinue"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

  // Ask the already-installed server to stop cleanly - finishing any in-flight request and closing
  // the database properly - rather than force-killing it immediately. On the one-time upgrade from
  // a version that predates the `request-stop` command, the old binary instead tries to start a
  // second server, which the existing second-instance guard safely rejects (non-zero exit), so this
  // falls through to the force-kill fallback below exactly as it always has for that one upgrade.
  StoppedGracefully := False;
  ExePath := ExpandConstant('{app}\clinic.exe');
  if FileExists(ExePath) then
  begin
    if Exec(ExePath, 'request-stop --timeout 30', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
      StoppedGracefully := (ResultCode = 0);
  end;

  if not StoppedGracefully then
  begin
    Exec('powershell.exe', '-NoProfile -ExecutionPolicy Bypass -Command "Stop-Process -Name clinic -Force -ErrorAction SilentlyContinue"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Exec('taskkill.exe', '/F /IM clinic.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Sleep(1500);
  end;
  Result := '';
end;

[Files]
Source: "..\dist-exe\clinic.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist\web\*"; DestDir: "{app}\dist\web"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\server\migrations\*.sql"; DestDir: "{app}\migrations"; Flags: ignoreversion
Source: "..\scripts\run-clinic.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "..\scripts\install-autostart.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "..\scripts\uninstall-autostart.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "..\docs\AUTO-START.md"; DestDir: "{app}\docs"; Flags: ignoreversion
Source: "..\docs\HTTPS-SETUP.md"; DestDir: "{app}\docs"; Flags: ignoreversion
Source: "..\docs\BACKUP-AND-RESTORE.md"; DestDir: "{app}\docs"; Flags: ignoreversion
Source: "..\docs\CLINIC-OPERATIONS-MANUAL.md"; DestDir: "{app}\docs"; Flags: ignoreversion

[Icons]
Name: "{group}\Open Clinic App"; Filename: "http://127.0.0.1:3080"
Name: "{autodesktop}\Clinic App"; Filename: "http://127.0.0.1:3080"; Tasks: desktopicon
Name: "{group}\Clinic App folder (logs, backups)"; Filename: "{app}"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"

[Run]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\install-autostart.ps1"" -AppDir ""{app}"" -StartNow"; \
  WorkingDir: "{app}"; Tasks: autostart; Flags: runhidden waituntilterminated; StatusMsg: "Registering automatic startup..."
Filename: "http://127.0.0.1:3080"; Flags: postinstall shellexec skipifsilent; Description: "Open the clinic app in your browser now"; Tasks: autostart

[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\uninstall-autostart.ps1"""; \
  Flags: runhidden waituntilterminated; RunOnceId: "RemoveAutostart"

[UninstallDelete]
; The exe, web build, and migrations are reinstalled on upgrade; nothing patient-related lives
; under {app} (CLINIC_DATA_DIR defaults to %LOCALAPPDATA%\ClinicApp, well outside this folder),
; so a full removal of {app} on uninstall never touches patient data.
Type: filesandordirs; Name: "{app}\dist"
Type: filesandordirs; Name: "{app}\migrations"
Type: filesandordirs; Name: "{app}\scripts"
Type: filesandordirs; Name: "{app}\docs"
