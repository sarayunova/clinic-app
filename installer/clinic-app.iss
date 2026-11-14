; Clinic App installer. Build with: npm run build && npm run build:exe, then compile this file
; with Inno Setup's ISCC.exe. See installer/README.md for the full build sequence.
#define MyAppName "Clinic App"
; scripts/build-installer.mjs passes /DMyAppVersion=<package.json version>; this default is only for
; compiling the .iss by hand.
#ifndef MyAppVersion
  #define MyAppVersion "0.1.0"
#endif
#define MyAppPublisher "LiVi Software"
#define MyAppIdGuid "{B6E2B6B0-6B9E-4C9F-9E6B-9B1B6B0A5C41}"

[Setup]
; "{{" is Inno's escape for a literal "{".
AppId={{#MyAppIdGuid}
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
  SecretsPage: TOutputMsgMemoWizardPage;
  g_BackupPassphrase, g_CaPassphrase: String;
  g_SecretsGenerated: Boolean;
  // Upgrade/repair detection: what is already installed here, if anything.
  g_PrevVersion: String;   // '' when not installed before
  g_PrevMode: String;      // 'server', 'client' or '' (unknown / not installed)
  g_HealthChecked: Boolean;

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

function SecretsDir: String;
begin
  Result := ExpandConstant('{commonappdata}\ClinicApp\secrets');
end;

function BackupPassphraseFile: String;
begin
  Result := SecretsDir + '\backup-passphrase.txt';
end;

function CaPassphraseFile: String;
begin
  Result := SecretsDir + '\ca-passphrase.txt';
end;

// Used as {code:BackupPassphraseFileConst} in [Run] to pass the path to install-autostart.ps1.
function BackupPassphraseFileConst(Param: String): String;
begin
  Result := BackupPassphraseFile;
end;

// Generates a passphrase and writes it straight to DestFile from inside the PowerShell process via
// a cryptographic RNG, so the plaintext is never passed as a process argument anywhere (including
// in this Exec call itself, which only ever receives the destination path).
function GenerateSecretFile(DestFile: String): Boolean;
var
  ResultCode: Integer;
begin
  // RNGCryptoServiceProvider, not the newer static RandomNumberGenerator.Fill, because this runs
  // under Windows PowerShell 5.1's .NET Framework, where .Fill does not exist - confirmed by
  // actually running this exact command standalone, not just reading it: .Fill failed with a
  // non-terminating "method not found" error and silently left $bytes all zero, producing the same
  // "random" passphrase every time. GetBytes on RNGCryptoServiceProvider is the correct API here.
  Result := Exec('powershell.exe', '-NoProfile -ExecutionPolicy Bypass -Command "' +
    '$rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::new(); ' +
    '$bytes = [byte[]]::new(32); ' +
    '$rng.GetBytes($bytes); ' +
    '$pw = [Convert]::ToBase64String($bytes) -replace ''[+/=]'',''''; ' +
    '[System.IO.File]::WriteAllText(''' + DestFile + ''', $pw)"',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0) and FileExists(DestFile);
end;

procedure RestrictSecretsAcl;
var
  ResultCode: Integer;
begin
  Exec('icacls.exe', '"' + SecretsDir + '" /inheritance:r /grant:r "SYSTEM:(OI)(CI)F" /grant:r "Administrators:(OI)(CI)F"',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

function ReadSecretFile(FileName: String): String;
var
  Raw: AnsiString;
begin
  Result := '';
  if LoadStringFromFile(FileName, Raw) then
    Result := String(Raw);
end;

// Only generates what does not already exist, so an upgrade/repair never rotates a passphrase
// still needed to decrypt backups taken under the old one - per the plan's "never remove, overwrite
// or reset ... keys" requirement. g_SecretsGenerated is only true when the BACKUP passphrase was
// newly created this run, which is what gates showing the one-time "write this down" page.
procedure EnsureSecrets;
begin
  g_SecretsGenerated := False;
  if not DirExists(SecretsDir) then
    ForceDirectories(SecretsDir);

  if not FileExists(BackupPassphraseFile) then
  begin
    if GenerateSecretFile(BackupPassphraseFile) then
      g_SecretsGenerated := True
    else
      MsgBox('Could not set up backup encryption automatically. Automatic backups will stay off until CLINIC_BACKUP_PASSPHRASE_FILE is configured manually - see docs/BACKUP-AND-RESTORE.md.', mbError, MB_OK);
  end;

  if not FileExists(CaPassphraseFile) then
    GenerateSecretFile(CaPassphraseFile);

  RestrictSecretsAcl;

  if g_SecretsGenerated then
  begin
    g_BackupPassphrase := ReadSecretFile(BackupPassphraseFile);
    g_CaPassphrase := ReadSecretFile(CaPassphraseFile);
  end;
end;

function BuildSecretsMessage: String;
begin
  Result := 'Backup encryption is now configured for this clinic server.' + #13#10 + #13#10 +
    'Recovery passphrase - write this down now and store it somewhere other than this computer ' +
    '(a password manager, a safe, or a sealed note). Without it, encrypted backups from this ' +
    'computer cannot be opened by anyone, including us:' + #13#10 + #13#10 +
    g_BackupPassphrase + #13#10 + #13#10 +
    'Certificate authority passphrase - only needed later if you set up LAN/HTTPS access for staff devices:' + #13#10 + #13#10 +
    g_CaPassphrase + #13#10 + #13#10 +
    'This is the only time these are shown on screen. A copy is also stored at ' + SecretsDir +
    ' on this computer, restricted to administrators.';
end;

// Runs Exe with Params, capturing everything it prints. Returns its exit code (-1 if it could not run).
function RunAndCapture(Exe, Params: String; var Output: String): Integer;
var
  LogFile: String;
  Raw: AnsiString;
  ResultCode: Integer;
begin
  LogFile := ExpandConstant('{tmp}\cmd-output.txt');
  DeleteFile(LogFile);
  // cmd strips the outermost pair of quotes from a /C string that starts with one, so the whole
  // command is wrapped in an extra pair to keep the quotes around the paths.
  if not Exec(ExpandConstant('{cmd}'), '/C ""' + Exe + '" ' + Params + ' > "' + LogFile + '" 2>&1"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
    ResultCode := -1;
  Output := '';
  if LoadStringFromFile(LogFile, Raw) then
    Output := Trim(String(Raw));
  DeleteFile(LogFile);
  Result := ResultCode;
end;

// Numeric comparison of dotted versions ("0.10.0" > "0.9.3"); anything after '-' is ignored.
// Returns <0, 0 or >0.
function CompareVersions(A, B: String): Integer;
var
  I, PA, PB, NA, NB: Integer;
begin
  Result := 0;
  if Pos('-', A) > 0 then A := Copy(A, 1, Pos('-', A) - 1);
  if Pos('-', B) > 0 then B := Copy(B, 1, Pos('-', B) - 1);
  for I := 1 to 4 do
  begin
    PA := Pos('.', A);
    PB := Pos('.', B);
    if PA > 0 then begin NA := StrToIntDef(Copy(A, 1, PA - 1), 0); A := Copy(A, PA + 1, Length(A)); end
    else begin NA := StrToIntDef(A, 0); A := ''; end;
    if PB > 0 then begin NB := StrToIntDef(Copy(B, 1, PB - 1), 0); B := Copy(B, PB + 1, Length(B)); end
    else begin NB := StrToIntDef(B, 0); B := ''; end;
    if NA <> NB then
    begin
      Result := NA - NB;
      Exit;
    end;
  end;
end;

const
  UninstallKey = 'Software\Microsoft\Windows\CurrentVersion\Uninstall\{#MyAppIdGuid}_is1';

// Which version is installed here already ('' if none). Read straight from the uninstall registry key,
// so it works in InitializeSetup, before the wizard exists.
procedure DetectPreviousVersion;
begin
  g_PrevVersion := '';
  if not RegQueryStringValue(HKLM, UninstallKey, 'DisplayVersion', g_PrevVersion) then
    g_PrevVersion := '';
end;

// Server or client. Comes from what this installer recorded last time (RegisterPreviousData below);
// installs from before that was recorded are inferred from whether the server program is present in
// the previous install folder. Called from InitializeWizard (GetPreviousData needs the wizard).
procedure DetectPreviousMode;
var
  PrevDir: String;
begin
  g_PrevMode := '';
  if g_PrevVersion = '' then
    Exit;
  g_PrevMode := GetPreviousData('Mode', '');
  if g_PrevMode = '' then
  begin
    if RegQueryStringValue(HKLM, UninstallKey, 'Inno Setup: App Path', PrevDir) and FileExists(AddBackslash(PrevDir) + 'clinic.exe') then
      g_PrevMode := 'server'
    else
      g_PrevMode := 'client';
  end;
end;

// Installing an older version over a newer one is refused by default: the newer version may already
// have upgraded the database to a layout the older one does not understand.
function InitializeSetup: Boolean;
begin
  Result := True;
  DetectPreviousVersion;
  if (g_PrevVersion <> '') and (CompareVersions(g_PrevVersion, '{#MyAppVersion}') > 0) then
    Result := SuppressibleMsgBox('A newer version of {#MyAppName} (' + g_PrevVersion + ') is already installed on this computer. ' +
      'Installing the older version {#MyAppVersion} over it is not supported: the newer version may have already ' +
      'upgraded the database, and the older one may fail to start.' + #13#10 + #13#10 +
      'Install the older version anyway?', mbError, MB_YESNO or MB_DEFBUTTON2, IDNO) = IDYES;
end;

procedure RegisterPreviousData(PreviousDataKey: Integer);
begin
  if IsServerMode then
    SetPreviousData(PreviousDataKey, 'Mode', 'server')
  else
  begin
    SetPreviousData(PreviousDataKey, 'Mode', 'client');
    SetPreviousData(PreviousDataKey, 'ClientAddress', Trim(ClientAddressPage.Values[0]));
  end;
end;

// Takes a verified copy of the database with the NEW program (extracted to a temp folder; nothing
// installed yet), which finds the database exactly as the upgraded server will and opens it read-only.
// It deliberately does not use the old program's `backup` command: older versions open the database
// read-write and would create an empty one if they looked in the wrong place.
// Returns '' to continue, or a message that stops the install before anything is changed.
// Encrypted with the backup passphrase when this computer has one (the file path is passed, never the
// passphrase); a plain copy, kept in the protected data folder, for older installs that have none.
function TakePreUpgradeSnapshot: String;
var
  Code: Integer;
  Output, Params: String;
begin
  Result := '';
  ExtractTemporaryFile('clinic.exe');
  Params := 'snapshot';
  if FileExists(BackupPassphraseFile) then
    Params := Params + ' --passphrase-file "' + BackupPassphraseFile + '"';
  Code := RunAndCapture(ExpandConstant('{tmp}\clinic.exe'), Params, Output);
  Log('Pre-upgrade safety copy (exit ' + IntToStr(Code) + '): ' + Output);
  if (Code = 0) or (Code = 2) then
    Exit; // 0: copied and verified; 2: no database yet, nothing to protect
  // (No line may start with #13#10: Inno's preprocessor would read it as a directive.)
  if SuppressibleMsgBox('Before changing anything, setup takes a verified safety copy of the clinic database. That did not work:' + #13#10 + #13#10 +
    Output + #13#10 + #13#10 + 'Continue WITHOUT a fresh safety copy? Choose No to stop now; nothing has been changed.',
    mbError, MB_YESNO or MB_DEFBUTTON2, IDNO) <> IDYES then
    Result := 'Setup stopped before changing anything, because a safety copy of the clinic database could not be taken: ' + Output;
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

  // Upgrade/repair: default to what this computer already is, so upgrading a staff device never
  // silently turns it into a second server (and vice versa).
  DetectPreviousMode;
  if g_PrevVersion <> '' then
  begin
    if g_PrevMode = 'client' then
    begin
      ModePage.SelectedValueIndex := 1;
      ClientAddressPage.Values[0] := GetPreviousData('ClientAddress', '');
    end;
    if CompareVersions(g_PrevVersion, '{#MyAppVersion}') = 0 then
      ModePage.SubCaptionLabel.Caption := '{#MyAppName} {#MyAppVersion} is already installed here as a ' + g_PrevMode +
        '. Continuing repairs it (reinstalls the program files). Patient data, backups and passphrases are not touched.'
    else
      ModePage.SubCaptionLabel.Caption := '{#MyAppName} ' + g_PrevVersion + ' is installed here as a ' + g_PrevMode +
        '. Continuing upgrades it to {#MyAppVersion}. A verified safety copy of the database is taken first; ' +
        'patient data, backups and passphrases are kept.';
  end;

  SecretsPage := CreateOutputMsgMemoPage(wpInstalling,
    'Backup encryption', 'Write down your recovery passphrase now',
    'This is shown only once.', '');
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := False;
  if (ClientAddressPage <> nil) and (PageID = ClientAddressPage.ID) and IsServerMode then
    Result := True;
  if (SecretsPage <> nil) and (PageID = SecretsPage.ID) and (IsClientMode or not g_SecretsGenerated) then
    Result := True;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if (CurStep = ssPostInstall) and IsServerMode then
  begin
    EnsureSecrets;
    if g_SecretsGenerated then
      SecretsPage.RichEditViewer.Lines.Text := BuildSecretsMessage;
  end;
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
  if (ModePage <> nil) and (CurPageID = ModePage.ID) and (g_PrevMode = 'server') and IsClientMode then
    Result := SuppressibleMsgBox('This computer is currently the clinic server. Switching it to a staff device stops the ' +
      'server here, so other devices will no longer reach it. Patient data is kept in place but will not be served.' + #13#10 + #13#10 +
      'Switch this computer to a staff device?', mbConfirmation, MB_YESNO or MB_DEFBUTTON2, IDNO) = IDYES
  else if (ModePage <> nil) and (CurPageID = ModePage.ID) and (g_PrevMode = 'client') and IsServerMode then
    Result := SuppressibleMsgBox('This computer is currently set up as a staff device connecting to another clinic server. ' +
      'Installing the server here creates a NEW, SEPARATE database: it will not contain the patients on the existing server.' + #13#10 + #13#10 +
      'Install a separate clinic server on this computer?', mbConfirmation, MB_YESNO or MB_DEFBUTTON2, IDNO) = IDYES
  else if (ClientAddressPage <> nil) and (CurPageID = ClientAddressPage.ID) then
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

  // With the server stopped and before any file is replaced: a verified copy of the database.
  Result := '';
  if IsServerMode then
    Result := TakePreUpgradeSnapshot;
end;

// Confirms the server actually came up after installing - and that it is the NEW version answering,
// not an old process that survived the upgrade - and says so on the last page. Only meaningful when
// automatic start was chosen; otherwise nothing has started the server yet.
procedure CurPageChanged(CurPageID: Integer);
var
  Code: Integer;
  Output, Msg: String;
begin
  if (CurPageID <> wpFinished) or g_HealthChecked or not IsServerMode or not WizardIsTaskSelected('autostart') then
    Exit;
  g_HealthChecked := True;
  WizardForm.FinishedLabel.Caption := 'Checking that the clinic server has started (this can take up to a minute and a half)...';
  WizardForm.Refresh;
  Code := RunAndCapture(ExpandConstant('{app}\clinic.exe'), 'health --timeout 90', Output);
  Log('Post-install health check (exit ' + IntToStr(Code) + '): ' + Output);
  if Code = 0 then
    Msg := 'The clinic server is running. ' + Output
  else if Code = 3 then
    Msg := 'WARNING: an older clinic server is still answering instead of the new one. Restart this computer, then open the app. ' + Output
  else
    Msg := 'WARNING: the clinic server did not start. ' + Output + ' Patient data has not been changed. ' +
      'Try restarting this computer; if it still does not start, the supervisor.log and server-*.log files in the logs folder ' +
      'under ' + ExpandConstant('{commonappdata}') + '\ClinicApp explain why.';
  WizardForm.FinishedLabel.Caption := Msg;
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
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\install-autostart.ps1"" -AppDir ""{app}"" -BackupPassphraseFile ""{code:BackupPassphraseFileConst}"" -StartNow"; \
  WorkingDir: "{app}"; Tasks: autostart; Flags: runhidden waituntilterminated; StatusMsg: "Registering automatic startup..."; Check: IsServerMode
Filename: "http://127.0.0.1:3080"; Flags: postinstall shellexec skipifsilent; Description: "Open the clinic app in your browser now"; Tasks: autostart; Check: IsServerMode
Filename: "{code:GetClientUrl}"; Flags: postinstall shellexec skipifsilent; Description: "Open the clinic server in your browser now"; Check: IsClientMode

[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\uninstall-autostart.ps1"""; \
  Flags: runhidden waituntilterminated; RunOnceId: "RemoveAutostart"; Check: IsServerMode

[UninstallDelete]
; The exe, web build, and migrations are reinstalled on upgrade; patient data lives under the
; machine-wide {commonappdata}\ClinicApp (see docs/DEPLOYMENT-ARCHITECTURE.md), well outside this
; folder, so a full removal of {app} on uninstall never touches patient data. The backup/CA
; passphrases live under {commonappdata}\ClinicApp\secrets for the same reason - uninstalling must
; never destroy the only copy of the key still needed to decrypt existing backups.
Type: filesandordirs; Name: "{app}\dist"; Check: IsServerMode
Type: filesandordirs; Name: "{app}\migrations"; Check: IsServerMode
Type: filesandordirs; Name: "{app}\scripts"; Check: IsServerMode
Type: filesandordirs; Name: "{app}\docs"
