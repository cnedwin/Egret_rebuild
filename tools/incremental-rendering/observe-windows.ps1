# SPDX-License-Identifier: Apache-2.0
param(
  [Parameter(Mandatory=$true)][ValidateRange(1,2147483647)][int]$BrowserProcessId,
  [Parameter(Mandatory=$true)][string]$Output,
  [ValidateRange(1,150)][int]$DurationSeconds = 30,
  [string]$StopPath = ''
)
$ErrorActionPreference = 'Stop'
if (-not $IsWindows -or $PSVersionTable.PSVersion.Major -lt 7) { throw 'Windows observation requires PowerShell 7 on Windows' }
if (-not [IO.Path]::IsPathFullyQualified($Output)) { throw 'Absolute fresh output path required' }
$target = [IO.Path]::GetFullPath($Output)
if (Test-Path -LiteralPath $target) { throw 'Observation output already exists' }
if (-not (Test-Path -LiteralPath ([IO.Path]::GetDirectoryName($target)) -PathType Container)) { throw 'Output parent missing' }
$formal = $StopPath.Length -gt 0
if ($formal) {
  if (-not [IO.Path]::IsPathFullyQualified($StopPath) -or $DurationSeconds -ne 150) { throw 'Formal observation requires a bounded absolute stop path' }
  $StopPath = [IO.Path]::GetFullPath($StopPath)
  if ([IO.Path]::GetDirectoryName($StopPath) -cne [IO.Path]::GetDirectoryName($target) -or
      [IO.Path]::GetFileName($StopPath) -cne 'observer-stop.json' -or (Test-Path -LiteralPath $StopPath)) { throw 'Stop path must be fresh and output-owned' }
}
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class EgretM1WindowsObservation {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
  [StructLayout(LayoutKind.Sequential)] public struct Power {
    public byte ACLineStatus, BatteryFlag, BatteryLifePercent, SystemStatusFlag;
    public uint BatteryLifeTime, BatteryFullLifeTime;
  }
  [DllImport("kernel32.dll", SetLastError=true)]
  [return: MarshalAs(UnmanagedType.Bool)] public static extern bool GetSystemPowerStatus(out Power status);
}
'@
function Read-Inventory {
  $os = @(Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,BuildNumber,OSArchitecture,CSName)
  $cpu = @(Get-CimInstance Win32_Processor | Sort-Object DeviceID | Select-Object DeviceID,Name,Manufacturer,NumberOfCores,NumberOfLogicalProcessors,MaxClockSpeed)
  $gpu = @(Get-CimInstance Win32_VideoController | Sort-Object DeviceID | Select-Object DeviceID,Name,PNPDeviceID,DriverVersion,DriverDate,AdapterCompatibility,VideoProcessor,AdapterRAM)
  $drivers = @(Get-CimInstance Win32_PnPSignedDriver -Filter "DeviceClass='DISPLAY'" | Sort-Object DeviceID | Select-Object DeviceID,DeviceName,Manufacturer,DriverVersion,DriverDate,InfName,IsSigned)
  if ($os.Count -ne 1 -or $cpu.Count -lt 1 -or $gpu.Count -lt 1 -or $drivers.Count -lt 1) { throw 'OS/CPU/display-driver inventory unavailable' }
  return [ordered]@{ os=$os; cpu=$cpu; gpu=$gpu; displayDrivers=$drivers; selectedAdapterAssociation='UNKNOWN' }
}
$processBefore = Get-CimInstance Win32_Process -Filter "ProcessId=$BrowserProcessId"
if ($null -eq $processBefore -or [string]::IsNullOrEmpty($processBefore.ExecutablePath)) { throw 'Actual browser executable unavailable' }
$binary = Get-Item -LiteralPath $processBefore.ExecutablePath
$binaryHash = (Get-FileHash -LiteralPath $binary.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
$initialScheme = & powercfg /getactivescheme
if ($LASTEXITCODE -ne 0) { throw 'Active power scheme unavailable' }
$inventory = if ($formal) { Read-Inventory } else { $null }
$stream = [IO.File]::Open($target, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)
$writer = [IO.StreamWriter]::new($stream, [Text.UTF8Encoding]::new($false))
$writer.NewLine = "`n"
$writer.AutoFlush = $true
function Write-Observation($value) { $writer.WriteLine(($value | ConvertTo-Json -Depth 12 -Compress)) }
$clock = [Diagnostics.Stopwatch]::StartNew()
$nextPower = 0
$stopped = $false
try {
  $start = [ordered]@{ kind='start'; utc=[DateTime]::UtcNow.ToString('o'); browserProcessId=$BrowserProcessId;
    creationDate=$processBefore.CreationDate.ToUniversalTime().ToString('o'); executable=$binary.FullName;
    executableBytes=$binary.Length; executableSha256=$binaryHash; fileVersion=$binary.VersionInfo.FileVersion;
    commandLine=$processBefore.CommandLine; activePowerScheme=@($initialScheme); durationSeconds=$DurationSeconds;
    scope='User-mode sampled foreground and power only; no claim about occlusion, temperature or continuous focus.' }
  if ($formal) { $start.formal=$true; $start.stopPath=$StopPath; $start.inventory=$inventory }
  Write-Observation $start
  while ($clock.Elapsed.TotalSeconds -lt $DurationSeconds) {
    [uint32]$foregroundProcessId = 0
    $window = [EgretM1WindowsObservation]::GetForegroundWindow()
    $threadId = [EgretM1WindowsObservation]::GetWindowThreadProcessId($window, [ref]$foregroundProcessId)
    $sample = [ordered]@{kind='sample'; utc=[DateTime]::UtcNow.ToString('o'); elapsedMs=$clock.Elapsed.TotalMilliseconds;
      foregroundProcessId=$foregroundProcessId; foregroundWindow=$window.ToInt64(); foregroundThreadId=$threadId;
      browserForeground=($window -ne [IntPtr]::Zero -and $foregroundProcessId -eq $BrowserProcessId) }
    if (-not $formal -or $clock.Elapsed.TotalMilliseconds -ge $nextPower) {
      $power = [EgretM1WindowsObservation+Power]::new()
      $powerAvailable = [EgretM1WindowsObservation]::GetSystemPowerStatus([ref]$power)
      $powerRow = [ordered]@{kind='power'; utc=[DateTime]::UtcNow.ToString('o'); elapsedMs=$clock.Elapsed.TotalMilliseconds;
        powerAvailable=$powerAvailable; acLineStatus=$(if($powerAvailable){[int]$power.ACLineStatus}else{$null});
        batteryFlag=$(if($powerAvailable){[int]$power.BatteryFlag}else{$null});
        batteryLifePercent=$(if($powerAvailable){[int]$power.BatteryLifePercent}else{$null}) }
      if ($formal) { Write-Observation $powerRow; $nextPower=$clock.Elapsed.TotalMilliseconds+5000 }
      else { foreach ($name in @('powerAvailable','acLineStatus','batteryFlag','batteryLifePercent')) { $sample[$name]=$powerRow[$name] } }
    }
    Write-Observation $sample
    if ($formal -and (Test-Path -LiteralPath $StopPath -PathType Leaf)) {
      $marker = Get-Item -LiteralPath $StopPath
      if ($marker.Length -gt 1024 -or ($marker.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Invalid observer stop marker' }
      $stopValue = [IO.File]::ReadAllText($StopPath) | ConvertFrom-Json
      if ($stopValue.schema -cne 'egret.observer-stop/1' -or $stopValue.browserProcessId -ne $BrowserProcessId) { throw 'Observer stop identity mismatch' }
      $stopped=$true; break
    }
    Start-Sleep -Milliseconds 1000
  }
  $processAfter = Get-CimInstance Win32_Process -Filter "ProcessId=$BrowserProcessId"
  $finalScheme = & powercfg /getactivescheme
  $schemeExit = $LASTEXITCODE
  $end = [ordered]@{kind='end'; utc=[DateTime]::UtcNow.ToString('o'); elapsedMs=$clock.Elapsed.TotalMilliseconds;
    processPresent=($null -ne $processAfter);
    creationUnchanged=($null -ne $processAfter -and $processAfter.CreationDate -eq $processBefore.CreationDate);
    executableUnchanged=($null -ne $processAfter -and $processAfter.ExecutablePath -ceq $processBefore.ExecutablePath -and
      (Get-FileHash -LiteralPath $binary.FullName -Algorithm SHA256).Hash.ToLowerInvariant() -ceq $binaryHash);
    activePowerScheme=@($finalScheme); schemeExit=$schemeExit;
    schemeUnchanged=($schemeExit -eq 0 -and [string]::Join("`n",@($initialScheme)) -ceq [string]::Join("`n",@($finalScheme))) }
  if ($formal) {
    $afterInventory=Read-Inventory
    $end.stopObserved=$stopped; $end.stopReason=$(if($stopped){'requested'}else{'maximum'});
    $end.inventory=$afterInventory
    $end.inventoryUnchanged=(($inventory | ConvertTo-Json -Depth 12 -Compress) -ceq ($afterInventory | ConvertTo-Json -Depth 12 -Compress))
  }
  Write-Observation $end
} catch {
  Write-Observation ([ordered]@{kind='failure'; utc=[DateTime]::UtcNow.ToString('o'); message=$_.Exception.Message})
  throw
} finally { $writer.Dispose(); $stream.Dispose() }
