# SPDX-License-Identifier: Apache-2.0
# This authoring wrapper sends exact text, never Environment.NewLine or raw evidence.
param(
    [Parameter(Mandatory)][string]$RelativePath,
    [Parameter(Mandatory)][AllowEmptyString()][string]$Text,
    [string]$Node = 'node'
)
$ErrorActionPreference = 'Stop'
$repository = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$encoding = [Text.UTF8Encoding]::new($false, $true)
$payload = $encoding.GetBytes($Text)
$start = [Diagnostics.ProcessStartInfo]::new()
$start.FileName = $Node
$start.WorkingDirectory = $repository
$start.UseShellExecute = $false
$start.CreateNoWindow = $true
$start.RedirectStandardInput = $true
$start.RedirectStandardOutput = $true
$start.RedirectStandardError = $true
$start.ArgumentList.Add((Join-Path $repository 'tools/write-repository-text.mjs'))
$start.ArgumentList.Add('--path')
$start.ArgumentList.Add($RelativePath)
$process = [Diagnostics.Process]::new()
$process.StartInfo = $start
try {
    if (-not $process.Start()) { throw 'Text writer did not start' }
    $stdout = $process.StandardOutput.ReadToEndAsync()
    $stderr = $process.StandardError.ReadToEndAsync()
    $process.StandardInput.BaseStream.Write($payload, 0, $payload.Length)
    $process.StandardInput.Close()
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) { throw ('Canonical text writer failed: ' + $stderr.GetAwaiter().GetResult()) }
    $output = $stdout.GetAwaiter().GetResult()
    if ($output.Length -gt 0) { Write-Output $output }
} finally { $process.Dispose() }
