# 提示词上传器 — 图形界面 (PowerShell + WinForms)
# 由 添加提示词.bat 调用，无需手动运行

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$ErrorActionPreference = "Stop"
$RepoDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Script  = Join-Path $RepoDir "add-prompt.mjs"
$File    = Join-Path $RepoDir "prompts.json"

# ── 配色 ────────────────────────────────────────────────────────────────
$Bg      = [System.Drawing.Color]::FromArgb(30, 30, 34)
$Fg      = [System.Drawing.Color]::FromArgb(228, 228, 231)
$Subtle  = [System.Drawing.Color]::FromArgb(150, 150, 158)
$Accent  = [System.Drawing.Color]::FromArgb(99, 102, 241)
$FieldBg = [System.Drawing.Color]::FromArgb(45, 45, 52)

# ── 主窗口 ──────────────────────────────────────────────────────────────
$form = New-Object System.Windows.Forms.Form
$form.Text = "提示词上传器 — TiShiCi"
$form.Size = New-Object System.Drawing.Size(760, 720)
$form.StartPosition = "CenterScreen"
$form.BackColor = $Bg
$form.ForeColor = $Fg
$form.Font = New-Object System.Drawing.Font("Microsoft YaHei UI", 10)
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false

function New-Label($text, $x, $y, $w, $h, $size, $color) {
  $l = New-Object System.Windows.Forms.Label
  $l.Text = $text; $l.Location = New-Object System.Drawing.Point($x, $y)
  $l.Size = New-Object System.Drawing.Size($w, $h)
  $l.Font = New-Object System.Drawing.Font("Microsoft YaHei UI", $size)
  $l.ForeColor = $color
  $l.BackColor = [System.Drawing.Color]::Transparent
  return $l
}

function New-Input($x, $y, $w, $h, $multiline) {
  $t = New-Object System.Windows.Forms.TextBox
  $t.Location = New-Object System.Drawing.Point($x, $y)
  $t.Size = New-Object System.Drawing.Size($w, $h)
  $t.BackColor = $FieldBg; $t.ForeColor = $Fg
  $t.BorderStyle = "FixedSingle"; $t.Multiline = $multiline
  if ($multiline) { $t.ScrollBars = "Vertical"; $t.AcceptsReturn = $true }
  return $t
}

$y = 18
$form.Controls.Add((New-Label "📝 标题" 24 $y 700 22 10 $Subtle))
$y += 26
$txtTitle = New-Input 24 $y 700 30 $false
$form.Controls.Add($txtTitle)
$y += 48

$form.Controls.Add((New-Label "💬 提示词正文（必填）" 24 $y 700 22 10 $Subtle))
$y += 26
$txtPrompt = New-Input 24 $y 700 240 $true
$form.Controls.Add($txtPrompt)
$y += 250

$form.Controls.Add((New-Label "🏷️ 标签（逗号分隔，可空）" 24 $y 340 22 10 $Subtle))
$form.Controls.Add((New-Label "📌 备注 / 用途（可空）" 384 $y 340 22 10 $Subtle))
$y += 26
$txtTags = New-Input 24 $y 340 30 $false
$txtNote = New-Input 384 $y 340 30 $false
$form.Controls.Add($txtTags)
$form.Controls.Add($txtNote)
$y += 46

# 模式选择
$form.Controls.Add((New-Label "模式：" 24 $y 60 24 10 $Subtle))
$rbGen = New-Object System.Windows.Forms.RadioButton
$rbGen.Text = "生成 (generate)"; $rbGen.Location = New-Object System.Drawing.Point(86, $y)
$rbGen.Size = New-Object System.Drawing.Size(170, 24); $rbGen.Checked = $true
$rbGen.ForeColor = $Fg; $rbGen.BackColor = [System.Drawing.Color]::Transparent
$rbEdit = New-Object System.Windows.Forms.RadioButton
$rbEdit.Text = "改图 (edit)"; $rbEdit.Location = New-Object System.Drawing.Point(266, $y)
$rbEdit.Size = New-Object System.Drawing.Size(140, 24)
$rbEdit.ForeColor = $Fg; $rbEdit.BackColor = [System.Drawing.Color]::Transparent
$form.Controls.Add($rbGen); $form.Controls.Add($rbEdit)
$y += 44

# 按钮
$btnUpload = New-Object System.Windows.Forms.Button
$btnUpload.Text = "⬆  上传到 GitHub"
$btnUpload.Location = New-Object System.Drawing.Point(24, $y)
$btnUpload.Size = New-Object System.Drawing.Size(220, 44)
$btnUpload.BackColor = $Accent; $btnUpload.ForeColor = [System.Drawing.Color]::White
$btnUpload.FlatStyle = "Flat"; $btnUpload.FlatAppearance.BorderSize = 0
$btnUpload.Font = New-Object System.Drawing.Font("Microsoft YaHei UI", 11, [System.Drawing.FontStyle]::Bold)
$form.Controls.Add($btnUpload)

$btnList = New-Object System.Windows.Forms.Button
$btnList.Text = "📋 查看已上传"
$btnList.Location = New-Object System.Drawing.Point(254, $y)
$btnList.Size = New-Object System.Drawing.Size(150, 44)
$btnList.BackColor = $FieldBg; $btnList.ForeColor = $Fg
$btnList.FlatStyle = "Flat"; $btnList.FlatAppearance.BorderSize = 0
$form.Controls.Add($btnList)

$btnClear = New-Object System.Windows.Forms.Button
$btnClear.Text = "🧹 清空"
$btnClear.Location = New-Object System.Drawing.Point(414, $y)
$btnClear.Size = New-Object System.Drawing.Size(100, 44)
$btnClear.BackColor = $FieldBg; $btnClear.ForeColor = $Fg
$btnClear.FlatStyle = "Flat"; $btnClear.FlatAppearance.BorderSize = 0
$form.Controls.Add($btnClear)
$y += 58

# 日志区
$form.Controls.Add((New-Label "📄 输出" 24 $y 700 22 10 $Subtle))
$y += 24
$txtLog = New-Object System.Windows.Forms.TextBox
$txtLog.Location = New-Object System.Drawing.Point(24, $y)
$txtLog.Size = New-Object System.Drawing.Size(700, 120)
$txtLog.Multiline = $true; $txtLog.ReadOnly = $true
$txtLog.ScrollBars = "Vertical"
$txtLog.BackColor = [System.Drawing.Color]::FromArgb(20, 20, 24)
$txtLog.ForeColor = [System.Drawing.Color]::FromArgb(140, 220, 140)
$txtLog.Font = New-Object System.Drawing.Font("Consolas", 9)
$form.Controls.Add($txtLog)

# ── 工具函数 ────────────────────────────────────────────────────────────
function Log($msg) {
  $txtLog.AppendText("$msg`r`n")
  $txtLog.SelectionStart = $txtLog.Text.Length
  $txtLog.ScrollToCaret()
  [System.Windows.Forms.Application]::DoEvents()
}

function RunNode($nodeArgs) {
  # 用 cmd 中转，避免 PowerShell 5.1 对 node 输出的编码/管道问题
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = "cmd.exe"
  $psi.Arguments = "/c node `"$Script`" $nodeArgs 2>&1"
  $psi.WorkingDirectory = $RepoDir
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.CreateNoWindow = $true
  $psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
  $p = [System.Diagnostics.Process]::Start($psi)
  $out = $p.StandardOutput.ReadToEnd()
  $p.WaitForExit()
  return @{ Output = $out; Code = $p.ExitCode }
}

function SetBusy($busy) {
  $btnUpload.Enabled = -not $busy
  $btnList.Enabled = -not $busy
  $btnClear.Enabled = -not $busy
  $btnUpload.Text = if ($busy) { "⏳ 上传中…" } else { "⬆  上传到 GitHub" }
  $form.Cursor = if ($busy) { [System.Windows.Forms.Cursors]::WaitCursor } else { [System.Windows.Forms.Cursors]::Default }
}

# ── 上传 ────────────────────────────────────────────────────────────────
$btnUpload.Add_Click({
  $title  = $txtTitle.Text.Trim()
  $prompt = $txtPrompt.Text.Trim()
  if (-not $title)  { Log "❌ 请填写标题"; return }
  if (-not $prompt) { Log "❌ 请填写提示词正文"; return }

  $mode = if ($rbEdit.Checked) { "edit" } else { "generate" }

  SetBusy $true
  $txtLog.Clear()
  Log "→ 正在生成并上传…"
  Log "   标题: $title"
  Log "   模式: $mode"
  Log "   正文: $($prompt.Length) 字符"
  Log ""

  # 正文写入临时文件（避免命令行长度/引号问题）
  $tmp = Join-Path $env:TEMP ("prompt_" + [guid]::NewGuid().ToString("N") + ".txt")
  [System.IO.File]::WriteAllText($tmp, $prompt, (New-Object System.Text.UTF8Encoding($false)))

  try {
    $a = @("--title", "`"$title`"", "--prompt-file", "`"$tmp`"", "--mode", $mode)
    if ($txtTags.Text.Trim()) { $a += @("--tags", "`"$($txtTags.Text.Trim())`"") }
    if ($txtNote.Text.Trim()) { $a += @("--note", "`"$($txtNote.Text.Trim())`"") }

    $r = RunNode ($a -join " ")
    Log $r.Output
    Log ""
    if ($r.Code -eq 0) {
      Log "✅ 完成！画布刷新即可看到（若仍是旧内容，等几分钟 CDN 缓存过期）"
      $txtTitle.Clear(); $txtPrompt.Clear(); $txtTags.Clear(); $txtNote.Clear()
    } else {
      Log "❌ 上传失败（退出码 $($r.Code)），请把上方输出发给管理员"
    }
  } finally {
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
    SetBusy $false
  }
})

# ── 查看已上传 ──────────────────────────────────────────────────────────
$btnList.Add_Click({
  SetBusy $true
  $txtLog.Clear()
  Log "→ 正在读取提示词库…`r`n"
  $r = RunNode "--list"
  # 去掉 ANSI 颜色码
  $clean = $r.Output -replace "`e\[[0-9;]*m", ""
  Log $clean
  SetBusy $false
})

$btnClear.Add_Click({
  $txtTitle.Clear(); $txtPrompt.Clear(); $txtTags.Clear(); $txtNote.Clear()
  $txtLog.Clear(); $txtTitle.Focus()
})

$form.AcceptButton = $btnUpload   # 回车即上传

# ── 启动检查 ────────────────────────────────────────────────────────────
if (-not (Test-Path $Script)) {
  [System.Windows.Forms.MessageBox]::Show("找不到 add-prompt.mjs`n`n请确认这个窗口和脚本在同一个目录：`n$RepoDir", "文件缺失", "OK", "Error") | Out-Null
  exit 1
}

$form.Add_Shown({
  Log "就绪。填写标题和正文后点「上传到 GitHub」。"
  Log "（提示词库: $File）"
  $txtTitle.Focus()
})

[void]$form.ShowDialog()
