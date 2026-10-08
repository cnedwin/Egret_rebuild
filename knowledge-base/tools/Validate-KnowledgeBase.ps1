param([string]$Root = (Split-Path -Parent $PSScriptRoot), [switch]$CheckOnly)

$ErrorActionPreference = 'Stop'
$kbRoot = [IO.Path]::GetFullPath($Root)
$kbPrefix = $kbRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
$issues = New-Object 'System.Collections.Generic.List[string]'
$registryCounts = [ordered]@{}
$idMap = @{}
$allItems = @()
$localLinkCount = 0
$referenceCount = 0

function Read-Json([string]$Path) {
    Get-Content -LiteralPath $Path -Encoding UTF8 -Raw | ConvertFrom-Json
}

function Check-LocalPath([string]$Relative, [string]$Base, [string]$Origin) {
    if ([string]::IsNullOrWhiteSpace($Relative)) { return }
    if ($Relative -match '^[a-zA-Z][a-zA-Z0-9+.-]*:') {
        $issues.Add("External or absolute path in local reference: $Origin")
        return
    }
    $filePart = ($Relative -split '#', 2)[0]
    if ([string]::IsNullOrWhiteSpace($filePart)) { return }
    $target = [IO.Path]::GetFullPath((Join-Path $Base ([Uri]::UnescapeDataString($filePart))))
    if (-not $target.StartsWith($kbPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        $issues.Add("Local reference leaves knowledge base: $Origin -> $Relative")
    } elseif ($current -and $target -eq [IO.Path]::GetFullPath((Join-Path $kbRoot $current.validation))) {
        # The generated report may not exist during the first validation run.
        return
    } elseif (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
        $issues.Add("Missing local target: $Origin -> $Relative")
    }
}

$current = Read-Json (Join-Path $kbRoot '当前版本.json')
$prefixMap = @{ requirements='R'; decisions='D'; hypotheses='H'; deliverables='V'; sources='S' }
$statusMap = @{
    requirements=@('confirmed','proposed','superseded','withdrawn')
    decisions=@('proposed','accepted','rejected','superseded')
    hypotheses=@('untested','supported','refuted','inconclusive')
    deliverables=@('planned','in_progress','implemented','accepted','initial_documentation_delivered','superseded')
}
foreach ($field in @('entry','roadmap','maintenance','contribution','changelog','validation')) {
    if (-not $current.$field) { $issues.Add("Missing current-version field: $field"); continue }
    # The report is generated below; its path is checked after writing.
    if ($field -ne 'validation') { Check-LocalPath $current.$field $kbRoot "current.$field" }
}
foreach ($property in $current.registries.PSObject.Properties) {
    $kind = $property.Name
    if (-not $prefixMap.ContainsKey($kind)) { $issues.Add("Unknown registry: $kind"); continue }
    Check-LocalPath $property.Value $kbRoot "registry.$kind"
    $registry = Read-Json (Join-Path $kbRoot $property.Value)
    if ($registry.schemaVersion -ne 1 -or -not $registry.updatedAt -or -not $registry.authority) {
        $issues.Add("Missing registry metadata: $kind")
    }
    $items = @($registry.items)
    $registryCounts[$kind] = $items.Count
    if ($items.Count -eq 0) { $issues.Add("Empty registry: $kind") }
    foreach ($item in $items) {
        $expected = '^' + $prefixMap[$kind] + '[0-9]{3}$'
        if ($item.id -notmatch $expected -or -not $item.title) { $issues.Add("Invalid record: $kind / $($item.id)") }
        if ($idMap.ContainsKey($item.id)) { $issues.Add("Duplicate ID: $($item.id)") }
        else { $idMap[$item.id] = $item }
        if ($statusMap.ContainsKey($kind) -and $item.status -notin $statusMap[$kind]) {
            $issues.Add("Invalid status: $($item.id) / $($item.status)")
        }
        if (-not $item.doc) { $issues.Add("Missing document: $($item.id)") }
        Check-LocalPath $item.doc $kbRoot $item.id
        if ($kind -eq 'requirements' -and (-not $item.statement -or @($item.sourceIds).Count -eq 0 -or @($item.deliveryIds).Count -eq 0)) {
            $issues.Add("Requirement lacks statement, source or delivery: $($item.id)")
        }
        if ($kind -eq 'decisions' -and (-not $item.proposal -or -not $item.risk -or -not $item.gate)) {
            $issues.Add("Decision lacks proposal, risk or gate: $($item.id)")
        }
        if ($kind -eq 'decisions' -and $item.status -eq 'accepted' -and (-not $item.acceptedAt -or -not $item.reviewer -or @($item.evidence).Count -eq 0)) {
            $issues.Add("Accepted decision lacks review/evidence: $($item.id)")
        }
        if ($kind -eq 'hypotheses' -and (-not $item.claim -or -not $item.measure)) {
            $issues.Add("Hypothesis lacks claim or measurement: $($item.id)")
        }
        if ($kind -eq 'hypotheses' -and $item.status -ne 'untested' -and @($item.evidence).Count -eq 0) {
            $issues.Add("Tested hypothesis lacks evidence: $($item.id)")
        }
        if ($kind -eq 'deliverables') {
            if (-not $item.kind -or -not $item.implementation -or -not $item.acceptance -or @($item.acceptanceCriteria).Count -eq 0) {
                $issues.Add("Delivery lacks implementation/acceptance fields: $($item.id)")
            }
            foreach ($artifact in @($item.artifacts)) {
                if ($artifact -ne $current.validation) { Check-LocalPath $artifact $kbRoot $item.id }
            }
            if ($item.status -eq 'accepted' -and ($item.acceptance -ne 'passed' -or @($item.artifacts).Count -eq 0 -or @($item.evidence).Count -eq 0)) {
                $issues.Add("Accepted delivery lacks passing evidence: $($item.id)")
            }
            if ($item.kind -ne 'documentation' -and $item.status -eq 'initial_documentation_delivered') {
                $issues.Add("Product marked as documentation delivery: $($item.id)")
            }
        }
        if ($kind -eq 'sources' -and (-not $item.type -or -not $item.scope -or -not $item.limit -or -not $item.researchCheckedAt)) {
            $issues.Add("Source lacks type/date/scope/limit: $($item.id)")
        }
        $allItems += $item
    }
}
foreach ($kind in $prefixMap.Keys) {
    if (-not $registryCounts.Contains($kind)) { $issues.Add("Missing registry: $kind") }
}
$refMap = @{ requirementIds='R'; decisionIds='D'; hypothesisIds='H'; deliveryIds='V'; sourceIds='S'; dependsOn='V' }
foreach ($item in $allItems) {
    foreach ($field in $refMap.Keys) {
        foreach ($ref in @($item.$field)) {
            if (-not $ref) { continue }
            $referenceCount++
            if (-not $idMap.ContainsKey($ref) -or $ref -notmatch ('^' + $refMap[$field])) {
                $issues.Add("Invalid record reference: $($item.id).$field -> $ref")
            }
        }
    }
    if ($item.supersedes -and -not $idMap.ContainsKey($item.supersedes)) { $issues.Add("Unknown superseded ID: $($item.id)") }
}

# Dependencies describe final acceptance, not the order of every prototype.
$visiting = @{}
$visited = @{}
function Check-Dependency([string]$Id) {
    if ($visiting.ContainsKey($Id)) { $issues.Add("Delivery dependency cycle at $Id"); return }
    if ($visited.ContainsKey($Id) -or -not $idMap.ContainsKey($Id)) { return }
    $visiting[$Id] = $true
    foreach ($dep in @($idMap[$Id].dependsOn)) { if ($dep) { Check-Dependency $dep } }
    [void]$visiting.Remove($Id)
    $visited[$Id] = $true
}
foreach ($item in $allItems | Where-Object { $_.id -match '^V' }) { Check-Dependency $item.id }

$docs = @(Get-ChildItem -LiteralPath $kbRoot -Recurse -File -Filter '*.md')
foreach ($file in $docs) {
    $body = Get-Content -LiteralPath $file.FullName -Encoding UTF8 -Raw
    # Ignore examples and code fences for link/ID checks.
    $prose = [regex]::Replace($body, '(?ms)^```[^\r\n]*\r?\n.*?^```[ \t]*$', '')
    foreach ($match in [regex]::Matches($prose, '\[[^\]\r\n]*\]\(([^)\r\n]+)\)')) {
        $link = $match.Groups[1].Value.Trim().Trim('<','>')
        if ($link -match '^(https?://|mailto:)' -or $link.StartsWith('#')) { continue }
        $localLinkCount++
        Check-LocalPath $link $file.DirectoryName $file.Name
    }
    foreach ($match in [regex]::Matches($prose, '(?<![A-Za-z0-9])[RDHVS][0-9]{3}(?![A-Za-z0-9])')) {
        if (-not $idMap.ContainsKey($match.Value)) { $issues.Add("Unknown document ID: $($file.Name) / $($match.Value)") }
    }
}

$candidateFiles = @(Get-ChildItem -LiteralPath $kbRoot -Recurse -File | Where-Object {
    $_.Extension -in @('.md','.json') -and $_.FullName -ne (Join-Path $kbRoot $current.validation)
})
function Get-StringLeaves($Value) {
    if ($null -eq $Value) { return }
    if ($Value -is [string]) { Write-Output $Value; return }
    if ($Value -is [System.Management.Automation.PSCustomObject]) {
        foreach ($property in $Value.PSObject.Properties) { Get-StringLeaves $property.Value }
    } elseif ($Value -is [System.Collections.IEnumerable]) {
        foreach ($entry in $Value) { Get-StringLeaves $entry }
    }
}
foreach ($file in $candidateFiles) {
    $body = Get-Content -LiteralPath $file.FullName -Encoding UTF8 -Raw
    # Inspect decoded JSON strings; encoded JavaScript newlines are not UNC paths.
    $scanBodies = if ($file.Extension -eq '.json') { @(Get-StringLeaves (Read-Json $file.FullName)) } else { @($body) }
    $hasPath = $false
    $hasCredential = $false
    foreach ($scanBody in $scanBodies) {
        if ($scanBody -match '(?<![A-Za-z])[A-Za-z]:[\\/]' -or $scanBody -match '\\\\[^\s\\]+\\') { $hasPath = $true }
        if ($scanBody -match '-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----' -or $scanBody -match '(?i)(?:password|secret|token)\s*[=:]\s*["''][A-Za-z0-9_+/=-]{12,}') { $hasCredential = $true }
    }
    if ($hasPath) {
        $issues.Add("Private absolute path marker in public candidate: $($file.Name)")
    }
    if ($hasCredential) {
        $issues.Add("Possible credential marker in public candidate: $($file.Name)")
    }
}

$hashes = @()
foreach ($file in Get-ChildItem -LiteralPath $kbRoot -Recurse -File | Where-Object { $_.FullName -ne (Join-Path $kbRoot $current.validation) }) {
    $hashes += [ordered]@{ path=$file.FullName.Substring($kbPrefix.Length).Replace('\','/'); sha256=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash }
}
$report = [ordered]@{
    schemaVersion=1
    knowledgeBaseVersion=$current.version
    checkedAtUtc=[DateTime]::UtcNow.ToString('o')
    status=$(if ($issues.Count -eq 0) {'passed'} else {'failed'})
    scope='documentation_structure_only'
    registryCounts=$registryCounts
    markdownFiles=$docs.Count
    localLinksChecked=$localLinkCount
    registryReferencesChecked=$referenceCount
    publicCandidateFilesScanned=$candidateFiles.Count
    issues=@($issues.ToArray())
    fileHashes=$hashes
    limitations=@('External URLs and heading anchors not fetched or checked.','Marker scan is not a complete secrets or licensing audit.','Semantic consistency also requires human/domain review.','No engine, performance, creator, migration or production-host tests run.')
}
$reportPath = Join-Path $kbRoot $current.validation
if (-not ([IO.Path]::GetFullPath($reportPath)).StartsWith($kbPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Report path leaves knowledge base' }
# Hooks validate the current tree without rewriting tracked historical evidence.
if (-not $CheckOnly) {
    [IO.File]::WriteAllText($reportPath, ($report | ConvertTo-Json -Depth 12), (New-Object Text.UTF8Encoding($false)))
}
Write-Output ("KB {0}: {1}; records={2}; markdown={3}; links={4}; references={5}; issues={6}" -f $current.version,$report.status,$allItems.Count,$docs.Count,$localLinkCount,$referenceCount,$issues.Count)
if ($issues.Count -gt 0) { $issues | ForEach-Object { Write-Output $_ }; exit 1 }
