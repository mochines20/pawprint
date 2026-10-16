Add-Type -AssemblyName System.Drawing

$outDir = Join-Path (Get-Location) 'dist/mockups'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$ink = [System.Drawing.ColorTranslator]::FromHtml('#151515')
$paper = [System.Drawing.ColorTranslator]::FromHtml('#FAF8F4')
$stone = [System.Drawing.ColorTranslator]::FromHtml('#8C8A84')
$line = [System.Drawing.ColorTranslator]::FromHtml('#E4E1DA')
$amber = [System.Drawing.ColorTranslator]::FromHtml('#FFB400')
$care = [System.Drawing.ColorTranslator]::FromHtml('#D9402B')
$soft = [System.Drawing.ColorTranslator]::FromHtml('#F1F0ED')
$muted = [System.Drawing.ColorTranslator]::FromHtml('#6F6D68')
$white = [System.Drawing.Color]::White

function Brush($color) { New-Object System.Drawing.SolidBrush($color) }
function Pen($color, $width = 2) { New-Object System.Drawing.Pen($color, $width) }
function Font($name, $size, $style = [System.Drawing.FontStyle]::Regular) { New-Object System.Drawing.Font($name, $size, $style) }
function RoundedPath($x, $y, $w, $h, $r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}
function FillRound($g, $color, $x, $y, $w, $h, $r) {
  $p = RoundedPath $x $y $w $h $r
  $g.FillPath((Brush $color), $p)
  $p.Dispose()
}
function DrawRound($g, $color, $width, $x, $y, $w, $h, $r) {
  $p = RoundedPath $x $y $w $h $r
  $g.DrawPath((Pen $color $width), $p)
  $p.Dispose()
}
function Text($g, $value, $x, $y, $w, $h, $size, $color, $bold = $false, $align = 'Near') {
  $font = Font ($(if ($bold) { 'Arial Rounded MT Bold' } else { 'Segoe UI' })) $size ($(if ($bold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }))
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = switch ($align) { 'Center' { [System.Drawing.StringAlignment]::Center; break } 'Right' { [System.Drawing.StringAlignment]::Far; break } default { [System.Drawing.StringAlignment]::Near } }
  $format.LineAlignment = [System.Drawing.StringAlignment]::Near
  $format.Trimming = [System.Drawing.StringTrimming]::EllipsisWord
  $g.DrawString($value, $font, (Brush $color), [System.Drawing.RectangleF]::new($x, $y, $w, $h), $format)
  $format.Dispose(); $font.Dispose()
}
function Paw($g, $x, $y, $scale, $color) {
  $b = Brush $color
  $g.FillEllipse($b, $x, $y + 18 * $scale, 31 * $scale, 38 * $scale)
  $g.FillEllipse($b, $x - 19 * $scale, $y, 17 * $scale, 23 * $scale)
  $g.FillEllipse($b, $x + 3 * $scale, $y - 7 * $scale, 18 * $scale, 25 * $scale)
  $g.FillEllipse($b, $x + 27 * $scale, $y - 5 * $scale, 18 * $scale, 25 * $scale)
  $g.FillEllipse($b, $x + 46 * $scale, $y + 5 * $scale, 17 * $scale, 22 * $scale)
  $b.Dispose()
}
function DrawCat($g, $x, $y, $scale, $fill = $ink, $eye = $amber) {
  $b = Brush $fill
  $g.FillPolygon($b, @([System.Drawing.PointF]::new($x, $y + 30*$scale), [System.Drawing.PointF]::new($x + 14*$scale, $y), [System.Drawing.PointF]::new($x + 39*$scale, $y + 20*$scale), [System.Drawing.PointF]::new($x + 65*$scale, $y), [System.Drawing.PointF]::new($x + 79*$scale, $y + 30*$scale), [System.Drawing.PointF]::new($x + 78*$scale, $y + 78*$scale), [System.Drawing.PointF]::new($x + 2*$scale, $y + 78*$scale)))
  $g.FillEllipse($b, $x + 2*$scale, $y + 22*$scale, 76*$scale, 62*$scale)
  $b.Dispose()
  $e = Brush $eye
  $g.FillEllipse($e, $x + 21*$scale, $y + 48*$scale, 8*$scale, 8*$scale)
  $g.FillEllipse($e, $x + 51*$scale, $y + 48*$scale, 8*$scale, 8*$scale)
  $g.DrawArc((Pen $eye (3*$scale)), $x + 31*$scale, $y + 59*$scale, 18*$scale, 12*$scale, 10, 160)
  $e.Dispose()
}
function MapPin($g, $x, $y, $color) {
  $b = Brush $color
  $g.FillEllipse($b, $x, $y, 33, 33)
  $g.FillPolygon($b, @([System.Drawing.PointF]::new($x + 2, $y + 22), [System.Drawing.PointF]::new($x + 16, $y + 52), [System.Drawing.PointF]::new($x + 31, $y + 22)))
  $g.FillEllipse((Brush $ink), $x + 11, $y + 11, 11, 11)
  $b.Dispose()
}
function Header($g, $title, $subtitle) {
  Text $g 'PAWPRINT' 72 62 280 30 18 $ink $true
  Text $g 'GOTTA SPOT EM ALL.' 72 94 300 24 10 $amber $true
  Text $g $title 72 152 700 72 43 $ink $true
  Text $g $subtitle 72 230 830 46 18 $muted $false
}
function PhoneFooter($g, $active) {
  FillRound $g $ink 55 1215 970 76 28
  $items = @('Home', 'Journal', 'Care', 'Profile')
  for ($i = 0; $i -lt 4; $i++) {
    $x = 55 + ($i * 242)
    $c = if ($items[$i] -eq $active) { $white } else { [System.Drawing.Color]::FromArgb(170, 167, 160) }
    Text $g @('H', 'J', 'C', 'P')[$i] ($x + 86) 1222 70 26 19 $c $true 'Center'
    Text $g $items[$i] ($x + 25) 1250 190 22 12 $c $true 'Center'
  }
}
function NewCanvas {
  $bmp = New-Object System.Drawing.Bitmap 1080, 1350
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.Clear($soft)
  FillRound $g $paper 28 28 1024 1294 42
  return @($bmp, $g)
}
function SaveCanvas($bmp, $g, $name) {
  $path = Join-Path $outDir $name
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Output $path
}

# 01 Home map
($bmp, $g) = NewCanvas
Header $g 'Welcome home' 'A calmer map for noticing cats in your neighborhood.'
Text $g 'PHILIPPINES - PRIVATE BY DEFAULT' 72 300 500 22 12 $stone $true
FillRound $g '#E9E8E4' 72 340 936 410 28
for ($i = 0; $i -lt 9; $i++) { $x = 80 + ($i * 120); $g.DrawLine((Pen '#D1D0CB' 2), $x, 340, $x + 210, 750) }
for ($i = 0; $i -lt 5; $i++) { $y = 390 + ($i * 78); $g.DrawLine((Pen '#D1D0CB' 2), 72, $y, 1008, $y - 90) }
FillRound $g $white 96 364 180 48 14; Text $g 'My map - today' 112 378 145 24 14 $ink $true
MapPin $g 337 490 $amber; MapPin $g 665 580 $white; MapPin $g 505 660 '#D8B25C'
FillRound $g $white 570 678 390 43 13; Text $g 'Approximate pins - delayed' 591 691 350 22 12 $stone $true
FillRound $g $amber 72 778 936 70 18; DrawRound $g $ink 4 72 778 936 70 18; Text $g '+  Spot a cat' 72 791 936 36 20 $ink $true 'Center'
FillRound $g $ink 72 884 445 185 24; Text $g 'CURRENT STREAK' 100 914 240 22 12 '#AAA7A1' $true; Text $g '04' 100 943 180 72 55 $white $true; Text $g 'days in a row' 100 1018 200 26 14 '#D6D3CD'
FillRound $g $white 548 884 460 185 24; Text $g 'TODAY''S SMALL GOAL' 580 914 300 22 12 $stone $true; Text $g 'Keep your pawprint going' 580 954 350 26 18 $ink $true; Text $g '1 / 1' 580 997 100 25 15 $ink $true; FillRound $g '#ECEAE5' 580 1032 370 10 5; FillRound $g $amber 580 1032 255 10 5
Text $g 'RECENT PAWPRINTS' 72 1100 300 28 15 $ink $true; Text $g 'Your next validated sighting will appear here.' 72 1140 700 30 15 $stone
PhoneFooter $g 'Home'; SaveCanvas $bmp $g 'pawprint-home-map.png'

# 02 Spot a cat
($bmp, $g) = NewCanvas
Header $g 'Spot a cat' 'Take a fresh photo from a respectful distance.'
Text $g 'PRIVATE CAPTURE' 72 300 300 22 12 $stone $true
FillRound $g '#ECEBE7' 72 340 936 430 30; DrawRound $g '#C7C3BA' 3 72 340 936 430 30
DrawCat $g 430 484 2.25 $ink $amber
Text $g 'Ready to check' 72 805 400 34 20 $ink $true; Text $g 'Camera stays on your device until you submit.' 72 842 780 28 14 $stone
FillRound $g '#FFF1C9' 72 900 936 105 20; Text $g 'SAFE LOCATION' 98 922 220 20 12 '#725600' $true; Text $g 'Your public pin is approximate and delayed. Exact capture coordinates stay private.' 98 951 850 40 15 $ink $true
FillRound $g $amber 72 1040 936 70 18; DrawRound $g $ink 4 72 1040 936 70 18; Text $g 'Capture and verify' 72 1053 936 36 20 $ink $true 'Center'
Text $g 'Cat check  >  duplicate check  >  safe pin  >  XP + streak' 72 1152 936 26 14 $stone $true 'Center'
PhoneFooter $g 'Home'; SaveCanvas $bmp $g 'pawprint-spot-cat.png'

# 03 Journal
($bmp, $g) = NewCanvas
Header $g 'Cat Journal' 'Every cat has a story. Saved sightings are yours.'
Text $g 'YOUR PRIVATE COLLECTION' 72 300 400 22 12 $stone $true
FillRound $g $ink 72 346 112 48 18; Text $g 'All' 72 359 112 24 15 $white $true 'Center'
FillRound $g $white 196 346 160 48 18; DrawRound $g $line 2 196 346 160 48 18; Text $g 'Common' 196 359 160 24 15 $stone $true 'Center'
FillRound $g $white 366 346 125 48 18; DrawRound $g $line 2 366 346 125 48 18; Text $g 'Rare' 366 359 125 24 15 $stone $true 'Center'
$rows = @(@('Orange tabby', 'Oct 16 - approximate Manila area', 'common', $amber), @('Tuxedo', 'Oct 15 - private visibility', 'uncommon', $ink), @('Calico', 'Oct 13 - friends visibility', 'rare', $care))
$rowY = 425
foreach ($row in $rows) { FillRound $g $white 72 $rowY 936 92 18; DrawRound $g $line 2 72 $rowY 936 92 18; FillRound $g '#EEECE7' 94 ($rowY + 20) 52 52 15; DrawCat $g 103 ($rowY + 31) .5 $row[3] $amber; Text $g $row[0] 170 ($rowY + 20) 470 26 18 $ink $true; Text $g $row[1] 170 ($rowY + 52) 490 22 13 $stone; Text $g $row[2] 820 ($rowY + 35) 150 24 12 '#9B6900' $true 'Right'; $rowY += 108 }
FillRound $g $ink 72 780 936 124 22; FillRound $g $amber 100 808 64 64 20; DrawCat $g 112 823 .55 $ink $amber; Text $g 'Orange cat streak - 4 days' 190 806 650 27 19 $white $true; Text $g 'Validate one cat today to keep it glowing.' 190 844 680 24 14 '#BCB9B1'
Text $g 'COLLECTION PROGRESS' 72 956 300 25 15 $ink $true; Text $g '8 cats' 900 956 108 25 15 $stone $true 'Right'; FillRound $g '#ECEAE5' 72 1000 936 14 7; FillRound $g $amber 72 1000 422 14 7
Text $g 'More sightings unlock medals and gentle easter rewards.' 72 1050 900 27 14 $stone
PhoneFooter $g 'Journal'; SaveCanvas $bmp $g 'pawprint-cat-journal.png'

# 04 Profile
($bmp, $g) = NewCanvas
Header $g 'My profile' 'Your progress, privacy choices, and medals in one place.'
Text $g 'ACCOUNT DETAILS STAY PRIVATE' 72 300 430 22 12 $stone $true
FillRound $g $amber 463 348 154 154 44; DrawRound $g $ink 5 463 348 154 154 44; DrawCat $g 500 390 .98 $ink $amber
Text $g 'Mira''s Pawprint' 72 540 936 36 25 $ink $true 'Center'; Text $g 'Pawprint spotter - Manila' 72 581 936 25 15 $stone $false 'Center'
FillRound $g $ink 72 655 936 185 24; Text $g 'PROGRESS LEVEL 3' 100 685 300 22 12 '#AAA7A1' $true; Text $g '248 XP' 100 720 400 60 43 $amber $true; Text $g 'Alley Scout - keep exploring with care.' 100 785 600 24 15 '#D6D3CD'; FillRound $g '#454545' 730 716 210 12 6; FillRound $g $amber 730 716 151 12 6
Text $g 'MEDALS - 3 EARNED' 72 894 400 25 15 $ink $true
$medals = @(@('1', 'First Paw', $amber), @('2', 'Alley Scout', $amber), @('3', 'Night Watcher', '#E8E5DD'))
$mx = 72
foreach ($medal in $medals) { FillRound $g $white $mx 940 292 112 20; DrawRound $g $line 2 $mx 940 292 112 20; FillRound $g $medal[2] ($mx + 112) 955 68 68 34; Text $g $medal[0] ($mx + 112) 967 68 38 23 $ink $true 'Center'; Text $g $medal[1] $mx 1040 292 24 13 $stone $true 'Center'; $mx += 322 }
Text $g 'PRIVACY CONTROLS' 72 1090 300 25 15 $ink $true; Text $g 'Approximate map only' 72 1130 500 25 16 $muted; Text $g 'ON' 900 1130 108 25 14 $ink $true 'Right'
PhoneFooter $g 'Profile'; SaveCanvas $bmp $g 'pawprint-profile-progress.png'
