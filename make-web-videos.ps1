# Makes light, phone-friendly copies of the reels for the /photos page:
# social\web\<name>.mp4 (720p, H.264 Main, ~1.5 Mbps, faststart) + social\web\<name>.jpg poster.
$ff = "c:\Users\mehul\Desktop\New\social\studio\tools\node_modules\ffmpeg-static\ffmpeg.exe"
$w  = "c:\Users\mehul\Desktop\New\website\social"
New-Item -ItemType Directory -Force "$w\web" | Out-Null
$names = 'a1-kharcha','h1-hisaab','r1-oneman','r2-core','r3-column','r4-wash'
foreach ($n in $names) {
  & $ff -v error -y -i "$w\$n.mp4" -vf "scale=720:-2" -c:v libx264 -profile:v main -level 3.1 -preset medium -crf 26 -maxrate 1500k -bufsize 3000k -pix_fmt yuv420p -c:a aac -b:a 96k -movflags +faststart "$w\web\$n.mp4"
  & $ff -v error -y -ss 1.5 -i "$w\$n.mp4" -vf "scale=540:-2" -frames:v 1 -q:v 4 -update 1 "$w\web\$n.jpg"
  Add-Content "$env:TEMP\webvid.log" ("{0}: {1} KB" -f $n, [int]((Get-Item "$w\web\$n.mp4").Length / 1024))
}
Add-Content "$env:TEMP\webvid.log" "ALL DONE"
