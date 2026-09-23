# verification/r2/holdkey.ps1 — real OS-level key hold via SendInput (user32).
# Usage: powershell -File holdkey.ps1 -Keys 57 -Ms 800        (VK 0x57 = W)
#        powershell -File holdkey.ps1 -Keys "26,27" -Ms 1200  (hold Up+Right)
# Keys are held (down) for -Ms milliseconds, then released. Focus must be on
# the target window (the ZCode in-app browser pane).
param(
  [Parameter(Mandatory=$true)][string]$Keys,
  [int]$Ms = 500
)
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class KBHold {
  [DllImport("user32.dll", SetLastError=true)] public static extern uint SendInput(uint n, INPUT[] pInputs, int cb);
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public KEYBDINPUT U; public uint pad; }
  public static void Key(ushort vk, bool up) {
    INPUT[] i = new INPUT[1];
    i[0].type = 1; i[0].U.wVk = vk; i[0].U.dwFlags = up ? 2u : 0u;
    SendInput(1, i, Marshal.SizeOf(typeof(INPUT)));
  }
}
"@
$codes = $Keys.Split(',') | ForEach-Object { [Convert]::ToUInt16($_, 16) }
foreach ($vk in $codes) { [KBHold]::Key($vk, $false) }
Start-Sleep -Milliseconds $Ms
foreach ($vk in $codes) { [KBHold]::Key($vk, $true) }
Write-Output "held $($Keys) for $($Ms)ms"
