$TargetDir = $PSScriptRoot
if (-not $TargetDir) { $TargetDir = Get-Location }

# Determine all valid desktop directories (Standard Desktop, OneDrive Desktop, etc.)
$DesktopDirs = [System.Collections.Generic.List[string]]::new()

$UserDesktop = [System.Environment]::GetFolderPath("Desktop")
if ($UserDesktop -and (Test-Path $UserDesktop)) {
    $DesktopDirs.Add($UserDesktop)
}

try {
    $RegDesktop = (Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders').Desktop
    if ($RegDesktop) {
        $ExpandedRegDesktop = [System.Environment]::ExpandEnvironmentVariables($RegDesktop)
        if ($ExpandedRegDesktop -and (Test-Path $ExpandedRegDesktop) -and (-not $DesktopDirs.Contains($ExpandedRegDesktop))) {
            $DesktopDirs.Add($ExpandedRegDesktop)
        }
    }
} catch {}

if ($DesktopDirs.Count -eq 0) {
    $FallbackDesktop = [System.IO.Path]::Combine($env:USERPROFILE, "Desktop")
    if (Test-Path $FallbackDesktop) {
        $DesktopDirs.Add($FallbackDesktop)
    }
}

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

foreach ($DesktopDir in $DesktopDirs) {
    # 1. Clean up legacy / redundant shortcuts
    $RedundantShortcuts = @(
        "$DesktopDir\Stop PDS Portal.lnk",
        "$DesktopDir\Start PDS Remote Access.lnk"
    )
    foreach ($oldPath in $RedundantShortcuts) {
        if (Test-Path $oldPath) {
            try {
                Remove-Item -Path $oldPath -Force -ErrorAction SilentlyContinue
                Write-Host "Removed redundant shortcut: $oldPath"
            } catch {}
        }
    }

    # 2. Create the Single Unified PDS Portal Shortcut
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
}

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

Write-Host "Single Desktop shortcut 'Start PDS Portal' created and verified successfully!"