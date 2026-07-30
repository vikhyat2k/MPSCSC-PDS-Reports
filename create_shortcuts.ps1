$TargetDir = $PSScriptRoot
if (-not $TargetDir) { $TargetDir = Get-Location }

$DesktopDir = [System.Environment]::GetFolderPath("Desktop")
$WshShell = New-Object -ComObject WScript.Shell

# Ensure proper logo.ico exists for Windows shortcuts (PNG is not natively supported for .lnk icons)
$PngPath = Join-Path $TargetDir "logo.png"
$IcoPath = Join-Path $TargetDir "logo.ico"

if (-not (Test-Path $IcoPath)) {
    if (Test-Path $PngPath) {
        try {
            Add-Type -AssemblyName System.Drawing
            $bmp = [System.Drawing.Bitmap]::FromFile($PngPath)
            $hIcon = $bmp.GetHicon()
            $icon = [System.Drawing.Icon]::FromHandle($hIcon)
            $fs = [System.IO.File]::Create($IcoPath)
            $icon.Save($fs)
            $fs.Close()
            $bmp.Dispose()
            Write-Host "Generated logo.ico from logo.png successfully."
        } catch {
            Write-Warning "Could not convert logo.png to logo.ico: $_"
        }
    }
}

# 1. Start PDS Portal Shortcut
$StartShortcut = $WshShell.CreateShortcut("$DesktopDir\Start PDS Portal.lnk")
$StartShortcut.TargetPath = "$TargetDir\START_PORTAL.bat"
$StartShortcut.WorkingDirectory = "$TargetDir"
$StartShortcut.Description = "Start PDS Lifting Intelligence Portal"
if (Test-Path $IcoPath) {
    $StartShortcut.IconLocation = "$IcoPath,0"
} else {
    $StartShortcut.IconLocation = "%SystemRoot%\System32\shell32.dll,25"
}
$StartShortcut.Save()

# 2. Stop PDS Portal Shortcut
$StopShortcut = $WshShell.CreateShortcut("$DesktopDir\Stop PDS Portal.lnk")
$StopShortcut.TargetPath = "$TargetDir\STOP_PORTAL.bat"
$StopShortcut.WorkingDirectory = "$TargetDir"
$StopShortcut.Description = "Stop PDS Lifting Intelligence Portal"
$StopShortcut.IconLocation = "%SystemRoot%\System32\shell32.dll,27"
$StopShortcut.Save()

# 3. Start PDS Remote Access Shortcut
$RemoteShortcut = $WshShell.CreateShortcut("$DesktopDir\Start PDS Remote Access.lnk")
$RemoteShortcut.TargetPath = "$TargetDir\START_REMOTE_ACCESS.bat"
$RemoteShortcut.WorkingDirectory = "$TargetDir"
$RemoteShortcut.Description = "Start PDS Portal Remote Access Tunnel"
if (Test-Path $IcoPath) {
    $RemoteShortcut.IconLocation = "$IcoPath,0"
} else {
    $RemoteShortcut.IconLocation = "%SystemRoot%\System32\shell32.dll,14"
}
$RemoteShortcut.Save()

# Notify Windows Explorer to refresh icon cache immediately
try {
    $code = @'
using System;
using System.Runtime.InteropServices;
public class ShellNotify {
    [DllImport("shell32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern void SHChangeNotify(int wEventId, uint uFlags, IntPtr dwItem1, IntPtr dwItem2);
}
'@
    Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
    [ShellNotify]::SHChangeNotify(0x08000000, 0x0000, [IntPtr]::Zero, [IntPtr]::Zero)
} catch {}

Write-Host "Desktop shortcuts created and verified successfully!"