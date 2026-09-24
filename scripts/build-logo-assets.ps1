Add-Type -AssemblyName System.Drawing

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$sourceDirectory = Join-Path $repositoryRoot 'public/brand/three-parts'
$outputDirectory = Join-Path $repositoryRoot 'public/brand/web'
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

$logos = @(
  @{ Source = 'sahaan-logo-symbol-4k.png'; Output = 'sahaan-symbol-web.png'; Width = 264 },
  @{ Source = 'sahaan-studios-wordmark-4k.png'; Output = 'sahaan-wordmark-web.png'; Width = 760 },
  @{ Source = 'sahaan-tagline-4k.png'; Output = 'sahaan-tagline-web.png'; Width = 1240 }
)

foreach ($logo in $logos) {
  $sourcePath = Join-Path $sourceDirectory $logo.Source
  $outputPath = Join-Path $outputDirectory $logo.Output
  $source = [System.Drawing.Image]::FromFile($sourcePath)
  try {
    $targetWidth = [int]$logo.Width
    $targetHeight = [int][Math]::Round($source.Height * $targetWidth / $source.Width)
    $target = New-Object System.Drawing.Bitmap($targetWidth, $targetHeight, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($target)
      try {
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.DrawImage($source, 0, 0, $targetWidth, $targetHeight)
      } finally {
        $graphics.Dispose()
      }
      $target.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $target.Dispose()
    }
    Write-Output "$($logo.Output): ${targetWidth}x${targetHeight}"
  } finally {
    $source.Dispose()
  }
}
