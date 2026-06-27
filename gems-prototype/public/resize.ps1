Add-Type -AssemblyName System.Drawing
$source = "..\docs\logo.png"
$destFolder = ".\"

if (-not (Test-Path $destFolder)) {
  New-Item -ItemType Directory -Force -Path $destFolder | Out-Null
}

$img = [System.Drawing.Image]::FromFile($source)
$sizes = @(16, 24, 32, 48, 96, 128)

foreach ($size in $sizes) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $graph = [System.Drawing.Graphics]::FromImage($bmp)
  $graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graph.DrawImage($img, 0, 0, $size, $size)

  $dest = Join-Path $destFolder "icon-${size}.png"
  $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Host "Created $dest"

  $graph.Dispose()
  $bmp.Dispose()
}
$img.Dispose()
