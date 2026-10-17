$CacheRoot = "D:\synclyrc\worker\.cache"
$Dirs = @("pip", "tmp", "hf", "hf\hub", "torch", "nltk", "numba", "models", "models\whisper", "models\wav2vec2")
foreach ($d in $Dirs) {
    New-Item -ItemType Directory -Force -Path "$CacheRoot\$d" | Out-Null
}
New-Item -ItemType Directory -Force -Path "D:\synclyrc\.cache\npm" | Out-Null

$env:PIP_CACHE_DIR       = "$CacheRoot\pip"
$env:TMP                 = "$CacheRoot\tmp"
$env:TEMP                = "$CacheRoot\tmp"
$env:HF_HOME             = "$CacheRoot\hf"
$env:HF_HUB_CACHE        = "$CacheRoot\hf\hub"
$env:TORCH_HOME          = "$CacheRoot\torch"
$env:NLTK_DATA           = "$CacheRoot\nltk"
$env:NUMBA_CACHE_DIR     = "$CacheRoot\numba"
$env:SYNCLRC_MODELS_DIR  = "$CacheRoot\models"
$env:npm_config_cache    = "D:\synclyrc\.cache\npm"
$env:PYTHONPATH          = "D:\synclyrc\worker\src"
$env:VIRTUAL_ENV         = "D:\synclyrc\worker\.venv"
$env:HF_HUB_DISABLE_PROGRESS_BARS = "1"
