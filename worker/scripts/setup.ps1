param(
    [ValidateSet("cpu", "cuda")]
    [string]$Device = "cpu"
)

$ErrorActionPreference = "Stop"
. "D:\synclyrc\worker\scripts\env.ps1"

$VenvDir = "D:\synclyrc\worker\.venv"
if (-not (Test-Path "$VenvDir\Scripts\python.exe")) {
    throw "Virtual environment wajib tersedia di $VenvDir. Setup tidak menjalankan Python global sesuai AGENTS.md."
}

$ActivatePs1 = "$VenvDir\Scripts\Activate.ps1"
$HookLine = '. "D:\synclyrc\worker\scripts\env.ps1"'
if ((Test-Path $ActivatePs1) -and -not (Select-String -Path $ActivatePs1 -SimpleMatch $HookLine -Quiet)) {
    Add-Content -Path $ActivatePs1 -Value "`n# SyncLRC Drive D: cache lock`n$HookLine"
}

$Py = "$VenvDir\Scripts\python.exe"
& $Py -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) { throw "Gagal memperbarui pip." }
$TorchIndex = if ($Device -eq "cuda") { "https://download.pytorch.org/whl/cu126" } else { "https://download.pytorch.org/whl/cpu" }
$TorchSuffix = if ($Device -eq "cuda") { "cu126" } else { "cpu" }
& $Py -m pip install "torch==2.8.0+$TorchSuffix" "torchaudio==2.8.0+$TorchSuffix" "torchvision==0.23.0+$TorchSuffix" --index-url $TorchIndex
if ($LASTEXITCODE -ne 0) { throw "Gagal memasang PyTorch $Device." }
& $Py -m pip install -r "D:\synclyrc\worker\requirements.txt"
if ($LASTEXITCODE -ne 0) { throw "Gagal memasang dependensi worker." }
& $Py -m pip install -e "D:\synclyrc\worker" --no-deps
if ($LASTEXITCODE -ne 0) { throw "Gagal memasang paket worker." }
& $Py -m pip check
if ($LASTEXITCODE -ne 0) { throw "Dependensi worker tidak kompatibel." }
Write-Host "[SyncLRC] Worker setup complete on Drive D:."
