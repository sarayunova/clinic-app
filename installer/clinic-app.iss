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
; Windows 10 / Server 2016 or newer only (per the deployment plan's support matrix).
MinVersion=0,10.0
; {app}\clinic.exe does not exist for a client-mode install, so this points at the uninstaller
; itself rather than a file that might be missing.
UninstallDisplayIcon={uninstallexe}
CloseApplications=force
RestartApplications=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional icons:"
Name: "autostart"; Description: "Start the clinic app automatically when Windows starts (recommended)"; GroupDescription: "Startup:"; Check: IsServerMode

[Code]
var
  ModePage: TInputOptionWizardPage;
  ClientAddressPage: TInputQueryWizardPage;

{ True for a full server install; False for a client-only (shortcut) install. Defaults to True
  (server) before the wizard page exists yet, e.g. during early Pascal evaluation. }
function IsServerMode: Boolean;
begin
  Result := (ModePage = nil) or (ModePage.SelectedValueIndex = 0);
end;

function IsClientMode: Boolean;
begin
  Result := not IsServerMode;
end;

// Used as {code:GetClientUrl} in [Icons]/[Run] for client-mode shortcuts.
function GetClientUrl(Param: String): String;
var
  Addr: String;
begin
  if ClientAddressPage = nil then
  begin
    Result := 'https://';
    Exit;
  end;
  Addr := Trim(ClientAddressPage.Values[0]);
  if Addr = '' then
    Result := 'https://'
  else if Pos('://', Addr) > 0 then
    Result := Addr
  else
    Result := 'https://' + Addr;
end;

procedure InitializeWizard;
begin
  ModePage := CreateInputOptionPage(wpWelcome,
    'Setup type', 'How is this computer being used?',
    'Choose one. Running the full server install on more than one computer does not share patients ' +
    'between them automatically - each server install is its own separate database.',
    True, False);
  ModePage.Add('Install the clinic server on this computer (the main clinic PC)');
  ModePage.Add('Connect this device to an existing clinic server (no database is installed here)');
  ModePage.SelectedValueIndex := 0;

  ClientAddressPage := CreateInputQueryPage(ModePage.ID,
    'Clinic server address', 'Where is the clinic server?',
    'Enter the clinic server''s address exactly as given by whoever set it up, for example ' +
    '192.168.1.20 or clinicpc:3080. You can change this later from the shortcut''s properties.');
  ClientAddressPage.Add('Server address:', False);
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := (ClientAddressPage <> nil) and (PageID = ClientAddressPage.ID) and IsServerMode;
end;

{ 500 MB is a conservative floor for the app itself plus headroom for an early database and logs;
  it is not a sizing recommendation for actual patient-record storage. }
function CheckDiskSpace: Boolean;
var
  AppDrive, DataDrive: String;
  FreeBytes, TotalBytes, FreeAppMB, FreeDataMB, MinMB: Int64;
begin
  Result := True;
  MinMB := 500;
  AppDrive := ExtractFileDrive(ExpandConstant('{app}'));
  DataDrive := ExtractFileDrive(ExpandConstant('{commonappdata}'));

  // GetSpaceOnDisk64 returns success via its Boolean result and the actual figures via its var
  // parameters; a failed check (FreeAppMB/FreeDataMB left at -1) does not block the install, since
  // the check itself not working is not evidence the disk is actually full.
  FreeAppMB := -1;
  if GetSpaceOnDisk64(AppDrive, FreeBytes, TotalBytes) then
    FreeAppMB := FreeBytes div (1024 * 1024);
  if (FreeAppMB >= 0) and (FreeAppMB < MinMB) then
  begin
    MsgBox(Format('Not enough free space on %s (%d MB free, %d MB needed). Free up space or choose a different install folder.', [AppDrive, FreeAppMB, MinMB]), mbError, MB_OK);
    Result := False;
    Exit;
  end;

  FreeDataMB := -1;
  if GetSpaceOnDisk64(DataDrive, FreeBytes, TotalBytes) then
    FreeDataMB := FreeBytes div (1024 * 1024);
  if (FreeDataMB >= 0) and (FreeDataMB < MinMB) then
  begin
    MsgBox(Format('Not enough free space on %s, which holds patient data (%d MB free, %d MB needed).', [DataDrive, FreeDataMB, MinMB]), mbError, MB_OK);
    Result := False;
  end;
end;

{ Shells out to PowerShell because Pascal Script has no socket API of its own. A previous install
  of this same app is already stopped earlier in PrepareToInstall (the upgrade path), so a port
  still answering here means something else on the machine is using it. }
function IsPortInUse(Port: Integer): Boolean;
var
  ResultCode: Integer;
  TmpFile: String;
  Output: AnsiString;
begin
  Result := False;
  TmpFile := ExpandConstant('{tmp}\port-check.txt');
  Exec('powershell.exe', '-NoProfile -ExecutionPolicy Bypass -Command "' +
    '$c = New-Object System.Net.Sockets.TcpClient; try { $c.Connect(''127.0.0.1'',' + IntToStr(Port) + '); ''IN_USE'' } catch { ''FREE'' } finally { $c.Close() } ' +
    '| Out-File -Encoding ascii ''' + TmpFile + '''"',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  if LoadStringFromFile(TmpFile, Output) then
    Result := (Pos('IN_USE', Output) > 0);
  DeleteFile(TmpFile);
end;

function CheckPortFree: Boolean;
begin
  Result := True;
  if IsPortInUse(3080) then
  begin
    Result := (MsgBox('Port 3080 is already being used by something else on this computer. ' + 'The clinic server will not be able to start until that is resolved, or you change its port after installing (see docs/HTTPS-SETUP.md). Continue anyway?', mbConfirmation, MB_YESNO) = IDYES);
  end;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if (ClientAddressPage <> nil) and (CurPageID = ClientAddressPage.ID) then
  begin
    if Trim(ClientAddressPage.Values[0]) = '' then
    begin
      MsgBox('Enter the clinic server''s address.', mbError, MB_OK);
      Result := False;
    end;
  end
  else if (CurPageID = wpSelectDir) and IsServerMode then
  begin
    Result := CheckDiskSpace;
    if Result then
      Result := CheckPortFree;
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
  ExePath: String;
  StoppedGracefully: Boolean;
begin
  // Runs regardless of the mode selected for THIS run, so switching an existing server install to
  // client mode still stops the previously-running server. (It then leaves the old clinic.exe and
  // its files in {app} untouched, since [Files]/[UninstallDelete] are now Check: IsServerMode -
  // switching modes on an existing install is an unusual path and not fully cleaned up here.)
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
; Client mode installs no app binary, migrations or database - just a shortcut - per the
; deployment plan ("Client mode ... never installs a DB").
Source: "..\dist-exe\clinic.exe"; DestDir: "{app}"; Flags: ignoreversion; Check: IsServerMode
Source: "..\dist\web\*"; DestDir: "{app}\dist\web"; Flags: ignoreversion recursesubdirs createallsubdirs; Check: IsServerMode
Source: "..\server\migrations\*.sql"; DestDir: "{app}\migrations"; Flags: ignoreversion; Check: IsServerMode
Source: "..\scripts\run-clinic.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion; Check: IsServerMode
Source: "..\scripts\install-autostart.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion; Check: IsServerMode
Source: "..\scripts\uninstall-autostart.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion; Check: IsServerMode
Source: "..\docs\AUTO-START.md"; DestDir: "{app}\docs"; Flags: ignoreversion; Check: IsServerMode
Source: "..\docs\HTTPS-SETUP.md"; DestDir: "{app}\docs"; Flags: ignoreversion
Source: "..\docs\BACKUP-AND-RESTORE.md"; DestDir: "{app}\docs"; Flags: ignoreversion; Check: IsServerMode
Source: "..\docs\CLINIC-OPERATIONS-MANUAL.md"; DestDir: "{app}\docs"; Flags: ignoreversion

[Icons]
Name: "{group}\Open Clinic App"; Filename: "http://127.0.0.1:3080"; Check: IsServerMode
Name: "{autodesktop}\Clinic App"; Filename: "http://127.0.0.1:3080"; Tasks: desktopicon; Check: IsServerMode
Name: "{group}\Clinic App folder (logs, backups)"; Filename: "{app}"; Check: IsServerMode
Name: "{group}\Open Clinic App"; Filename: "{code:GetClientUrl}"; Check: IsClientMode
Name: "{autodesktop}\Clinic App"; Filename: "{code:GetClientUrl}"; Tasks: desktopicon; Check: IsClientMode
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"

[Run]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\install-autostart.ps1"" -AppDir ""{app}"" -StartNow"; \
  WorkingDir: "{app}"; Tasks: autostart; Flags: runhidden waituntilterminated; StatusMsg: "Registering automatic startup..."; Check: IsServerMode
Filename: "http://127.0.0.1:3080"; Flags: postinstall shellexec skipifsilent; Description: "Open the clinic app in your browser now"; Tasks: autostart; Check: IsServerMode
Filename: "{code:GetClientUrl}"; Flags: postinstall shellexec skipifsilent; Description: "Open the clinic server in your browser now"; Check: IsClientMode

[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\uninstall-autostart.ps1"""; \
  Flags: runhidden waituntilterminated; RunOnceId: "RemoveAutostart"; Check: IsServerMode

[UninstallDelete]
; The exe, web build, and migrations are reinstalled on upgrade; nothing patient-related lives
; under {app} (CLINIC_DATA_DIR defaults to %LOCALAPPDATA%\ClinicApp, well outside this folder),
; so a full removal of {app} on uninstall never touches patient data.
Type: filesandordirs; Name: "{app}\dist"; Check: IsServerMode
Type: filesandordirs; Name: "{app}\migrations"; Check: IsServerMode
Type: filesandordirs; Name: "{app}\scripts"; Check: IsServerMode
Type: filesandordirs; Name: "{app}\docs"
