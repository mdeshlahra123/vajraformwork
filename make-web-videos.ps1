# Makes light, phone-friendly copies of the REAL site/godown videos for the /photos page:
# social\web\<name>.mp4 (720p, H.264 Main, ~1.5 Mbps, faststart) + social\web\<name>.jpg poster.
$ff  = "c:\Users\mehul\Desktop\New\social\studio\tools\node_modules\ffmpeg-static\ffmpeg.exe"
$src = "c:\Users\mehul\Desktop\New\social\studio\media"
$w   = "c:\Users\mehul\Desktop\New\website\social\web"
New-Item -ItemType Directory -Force $w | Out-Null
$clips = [ordered]@{ "real-v1" = @("v1", 4.0); "real-v2" = @("v2", 2.0); "real-v4" = @("v4", 1.0); "real-v5" = @("v5", 2.0); "real-v6" = @("v6", 6.0) }
foreach ($n in $clips.Keys) {
  $in = "$src\$($clips[$n][0]).mp4"
  & $ff -v error -y -i $in -vf "scale=720:-2" -c:v libx264 -profile:v main -level 3.1 -preset medium -crf 26 -maxrate 1500k -bufsize 3000k -pix_fmt yuv420p -c:a aac -b:a 96k -movflags +faststart "$w\$n.mp4"
  & $ff -v error -y -ss $clips[$n][1] -i $in -vf "scale=540:-2" -frames:v 1 -q:v 4 -update 1 "$w\$n.jpg"
  Add-Content "$env:TEMP\webvid.log" ("{0}: {1} KB" -f $n, [int]((Get-Item "$w\$n.mp4").Length / 1024))
}
Add-Content "$env:TEMP\webvid.log" "ALL DONE"
