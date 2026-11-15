[CmdletBinding()]
param(
    [switch]$NoBrowser,
    [switch]$Rebuild,
    [switch]$CheckOnly,
    [ValidateRange(0, 86400)][int]$RunForSeconds = 0
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$backendRoot = Join-Path $projectRoot 'backend'
$runtimeDirectory = Join-Path $projectRoot 'output/local-runtime'
$job = $null
$children = [Collections.Generic.List[Diagnostics.Process]]::new()
$previousLocation = Get-Location
$exitCode = 0

function Assert-FreePort([int]$Port) {
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
    try { $listener.Start() }
    catch { throw "Local port $Port is already in use. Close the application using it, then run Start-RationSaathi.cmd again. No existing process was stopped." }
    finally { $listener.Stop() }
}

function Quote-NativeArgument([string]$Value) {
    # Start-Process joins ArgumentList on Windows, including Windows PowerShell 5.1.
    return '"' + ([regex]::Replace([regex]::Replace($Value, '(\\*)"', '$1$1\"'), '(\\+)$', '$1$1')) + '"'
}

function Start-OwnedProcess([string]$Executable, [string[]]$Arguments, [string]$WorkingDirectory, [string]$Name) {
    $stdout = Join-Path $runtimeDirectory "$runId-$Name.out.log"
    $stderr = Join-Path $runtimeDirectory "$runId-$Name.err.log"
    $quoted = ($Arguments | ForEach-Object { Quote-NativeArgument $_ }) -join ' '
    $process = Start-Process -FilePath $Executable -ArgumentList $quoted -WorkingDirectory $WorkingDirectory -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
    $children.Add($process)
    try { $job.Add($process) }
    catch {
        if (-not $process.HasExited) { $process.Kill() }
        throw
    }
    return $process
}

function Wait-Ready([Diagnostics.Process]$Process, [string]$Uri, [string]$Name, [int]$Seconds = 90) {
    $until = [DateTime]::UtcNow.AddSeconds($Seconds)
    while ([DateTime]::UtcNow -lt $until) {
        $Process.Refresh()
        if ($Process.HasExited) { throw "$Name exited during startup. See logs in output/local-runtime (run $runId)." }
        try {
            $response = Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200) { return }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    throw "$Name did not become ready. See logs in output/local-runtime (run $runId)."
}

function Get-BuildFingerprint {
    $inputs = [Collections.Generic.List[string]]::new()
    foreach ($directory in @('app', 'components', 'data', 'hooks', 'lib', 'public', 'services')) {
        $sourceDirectory = Join-Path $projectRoot $directory
        if (Test-Path -LiteralPath $sourceDirectory) {
            foreach ($file in Get-ChildItem -LiteralPath $sourceDirectory -Recurse -File) { $inputs.Add($file.FullName) }
        }
    }
    foreach ($pattern in @('package.json', 'pnpm-lock.yaml', 'vite.config.*', 'next.config.*', 'tsconfig.json', '.env*', 'postcss.config.*', 'tailwind.config.*')) {
        foreach ($file in Get-ChildItem -Path (Join-Path $projectRoot $pattern) -File) { $inputs.Add($file.FullName) }
    }
    $records = foreach ($path in ($inputs | Sort-Object -Unique)) {
        $relative = $path.Substring($projectRoot.Length)
        $digest = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
        "$relative=$digest"
    }
    $publicEnvironment = Get-ChildItem Env: | Where-Object Name -Like 'NEXT_PUBLIC_*' | Sort-Object Name | ForEach-Object { "$($_.Name)=$($_.Value)" }
    $content = "$nodeVersion`n$($records -join "`n")`n$($publicEnvironment -join "`n")"
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($content))).Replace('-', '') }
    finally { $sha.Dispose() }
}

try {
    Set-Location -LiteralPath $projectRoot
    $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $nodeCommand) { throw 'Node.js 22.13 or newer is required. Install Node.js, then reopen this launcher.' }
    $nodePath = $nodeCommand.Source
    $nodeVersion = (& $nodePath --version).Trim()
    if ($LASTEXITCODE -ne 0 -or [version]$nodeVersion.TrimStart('v') -lt [version]'22.13.0') { throw 'Node.js 22.13 or newer is required. Update Node.js, then reopen this launcher.' }
    if (-not (Get-Command pnpm.cmd -ErrorAction SilentlyContinue)) { throw 'pnpm is required. Run: npm install --global pnpm@10' }

    $pythonPath = $null
    $pythonCandidates = @((Join-Path $projectRoot '.venv/Scripts/python.exe'), (Join-Path $backendRoot '.venv/Scripts/python.exe'))
    foreach ($name in @('python.exe', 'py.exe')) {
        $command = Get-Command $name -ErrorAction SilentlyContinue
        if ($command) { $pythonCandidates += $command.Source }
    }
    foreach ($candidate in ($pythonCandidates | Select-Object -Unique)) {
        if (-not (Test-Path -LiteralPath $candidate)) { continue }
        try {
            & $candidate -c 'import sys; sys.exit(0 if sys.version_info >= (3, 12) else 1)' 2>$null
            if ($LASTEXITCODE -eq 0) { $pythonPath = $candidate; break }
        } catch { }
    }
    if (-not $pythonPath) { throw 'Python 3.12 or newer is required. Install Python (including the Python launcher), then reopen this launcher.' }

    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules/vinext/dist/cli.js'))) { throw 'Frontend dependencies are missing. From the project folder run: pnpm install --frozen-lockfile' }
    try { & $nodePath --input-type=module -e "for (const p of ['vinext', 'vite', 'react', 'react-dom', '@tailwindcss/postcss']) import.meta.resolve(p)" 2>$null }
    catch { throw 'Frontend dependencies are incomplete. From the project folder run: pnpm install --frozen-lockfile' }
    if ($LASTEXITCODE -ne 0) { throw 'Frontend dependencies are incomplete. From the project folder run: pnpm install --frozen-lockfile' }
    try { & $pythonPath -c 'import fastapi, uvicorn, pypdf, multipart, httpx, openpyxl' 2>$null }
    catch { throw "Backend dependencies are missing. Run: & '$pythonPath' -m pip install -r backend/requirements.lock" }
    if ($LASTEXITCODE -ne 0) { throw "Backend dependencies are missing. Run: & '$pythonPath' -m pip install -r backend/requirements.lock" }
    Assert-FreePort 8001
    Assert-FreePort 3001
    if ($CheckOnly) { Write-Host 'Prerequisites and localhost ports are ready. No services were started.'; return }

    # Process-local settings: never replace user databases or a caller-provided test DB.
    $env:NEXT_PUBLIC_SERVICE_MODE = 'api'
    $env:NEXT_PUBLIC_API_BASE_URL = '/api/backend'
    $env:NEXT_PUBLIC_SITE_URL = 'http://127.0.0.1:3001'
    $env:SOFTGRAPH_CORS_ORIGINS = 'http://127.0.0.1:3001,http://localhost:3001'
    $env:SOFTGRAPH_BACKEND_URL = 'http://127.0.0.1:8001'
    if (!(Test-Path Env:RATION_POLICY_OLLAMA_MODEL) -and (Get-Command ollama -ErrorAction SilentlyContinue)) {
        $env:RATION_POLICY_OLLAMA_MODEL = 'qwen3:8b'
    }
    [void](New-Item -ItemType Directory -Path $runtimeDirectory -Force)
    $runId = '{0}-{1}' -f (Get-Date -Format 'yyyyMMdd-HHmmss'), $PID

    # The job owns only our children. Closing this console also closes the job's
    # handle, terminating the frontend, backend and all of their worker processes.
    if (-not ('SoftGraphLocalJob' -as [type])) {
        Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
public sealed class SoftGraphLocalJob : IDisposable {
    [StructLayout(LayoutKind.Sequential)] struct BasicLimits {
        public long ProcessTime, JobTime; public uint Flags;
        public UIntPtr MinimumWorkingSet, MaximumWorkingSet;
        public uint ActiveProcesses; public UIntPtr Affinity;
        public uint Priority, Scheduling;
    }
    [StructLayout(LayoutKind.Sequential)] struct IoCounters {
        public ulong ReadOperations, WriteOperations, OtherOperations, ReadBytes, WriteBytes, OtherBytes;
    }
    [StructLayout(LayoutKind.Sequential)] struct ExtendedLimits {
        public BasicLimits Basic; public IoCounters Io;
        public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory;
    }
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int infoClass, IntPtr info, uint length);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    IntPtr handle;
    public SoftGraphLocalJob() {
        handle = CreateJobObject(IntPtr.Zero, null);
        if (handle == IntPtr.Zero) throw new Win32Exception();
        var limits = new ExtendedLimits(); limits.Basic.Flags = 0x2000;
        int size = Marshal.SizeOf(typeof(ExtendedLimits));
        IntPtr data = Marshal.AllocHGlobal(size);
        try {
            Marshal.StructureToPtr(limits, data, false);
            if (!SetInformationJobObject(handle, 9, data, (uint)size)) { int error = Marshal.GetLastWin32Error(); Dispose(); throw new Win32Exception(error); }
        } finally { Marshal.FreeHGlobal(data); }
    }
    public void Add(Process process) {
        if (!AssignProcessToJobObject(handle, process.Handle)) throw new Win32Exception(Marshal.GetLastWin32Error());
    }
    public void Dispose() { if (handle != IntPtr.Zero) { CloseHandle(handle); handle = IntPtr.Zero; } GC.SuppressFinalize(this); }
    ~SoftGraphLocalJob() { Dispose(); }
}
'@
    }
    $job = New-Object SoftGraphLocalJob
    $cliPath = Join-Path $projectRoot 'node_modules/vinext/dist/cli.js'
    $stampPath = Join-Path $runtimeDirectory 'build.sha256'
    $fingerprint = Get-BuildFingerprint
    $savedFingerprint = if (Test-Path -LiteralPath $stampPath) { (Get-Content -LiteralPath $stampPath -Raw).Trim() } else { '' }
    $buildPresent = (Test-Path -LiteralPath (Join-Path $projectRoot 'dist/server/index.js')) -and (Test-Path -LiteralPath (Join-Path $projectRoot 'dist/server/ssr/index.js')) -and (Test-Path -LiteralPath (Join-Path $projectRoot 'dist/client/vinext-client-entry-manifest.json'))
    if ($Rebuild -or -not $buildPresent -or $savedFingerprint -ne $fingerprint) {
        # Invalidate the old stamp before a build can replace any output files.
        if (Test-Path -LiteralPath $stampPath) { Remove-Item -LiteralPath $stampPath }
        Write-Host 'Building the local app. First launch or source changes can take a few minutes...'
        $builder = Start-OwnedProcess $nodePath @($cliPath, 'build') $projectRoot 'build'
        while (-not $builder.HasExited) { Start-Sleep -Milliseconds 500; $builder.Refresh() }
        if ($builder.ExitCode -ne 0) { throw "The frontend build failed. See output/local-runtime/$runId-build.err.log and .out.log." }
        if ((Get-BuildFingerprint) -ne $fingerprint) { throw 'Source files changed during the build. Run Start-RationSaathi.cmd again after saving your changes.' }
        Set-Content -LiteralPath $stampPath -Value $fingerprint -Encoding ASCII
    }

    Assert-FreePort 8001
    Assert-FreePort 3001
    Write-Host 'Starting the knowledge service on 127.0.0.1:8001...'
    $backend = Start-OwnedProcess $pythonPath @('-m', 'uvicorn', 'app.main:app', '--app-dir', '.', '--host', '127.0.0.1', '--port', '8001', '--no-access-log') $backendRoot 'backend'
    Wait-Ready $backend 'http://127.0.0.1:8001/ready' 'Knowledge service'
    Write-Host 'Starting the local website on 127.0.0.1:3001...'
    $frontend = Start-OwnedProcess $nodePath @($cliPath, 'start', '--hostname', '127.0.0.1', '--port', '3001') $projectRoot 'frontend'
    Wait-Ready $frontend 'http://127.0.0.1:3001/' 'Website'
    Wait-Ready $frontend 'http://127.0.0.1:3001/api/backend/ready' 'Website backend connection' 30
    Write-Host "Ration Saathi is ready: http://127.0.0.1:3001/`nKeep this window open. Press Ctrl+C to stop both services.`nLogs: output/local-runtime (run $runId)"
    if (-not $NoBrowser) { Start-Process 'http://127.0.0.1:3001/' }
    $runUntil = if ($RunForSeconds -gt 0) { [DateTime]::UtcNow.AddSeconds($RunForSeconds) } else { [DateTime]::MaxValue }
    while ([DateTime]::UtcNow -lt $runUntil) {
        Start-Sleep -Seconds 1
        foreach ($process in @($backend, $frontend)) {
            $process.Refresh()
            if ($process.HasExited) { throw "A local service stopped. See logs in output/local-runtime (run $runId)." }
        }
    }
} catch {
    Write-Host "SoftGraph: $($_.Exception.Message)" -ForegroundColor Red
    $exitCode = 1
} finally {
    if ($job) { $job.Dispose() }
    foreach ($child in $children) { $child.Dispose() }
    Set-Location -LiteralPath $previousLocation
}
exit $exitCode
