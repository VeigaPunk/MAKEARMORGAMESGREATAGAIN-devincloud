# verification/r2/osinput.ps1 — real OS-level input via SendInput (user32).
# Usage:
#   powershell -File osinput.ps1 -ClickX 1599 -ClickY 384            # one real click
#   powershell -File osinput.ps1 -Keys 57 -Ms 800                    # hold W 800ms
#   powershell -File osinput.ps1 -Keys "26,27" -Ms 1200              # hold Up+Right
#   powershell -File osinput.ps1 -Keys 20 -Tap 6 -Ms 260             # tap Space 6x
#   powershell -File osinput.ps1 -MoveTo 1599,384                    # move pointer
# Coordinates are physical screen pixels. Keys are hex virtual-key codes.
param(
  [int]$ClickX = -1, [int]$ClickY = -1,
  [string]$Keys = "",
  [int]$Ms = 500,
  [int]$Tap = 0,
  [string]$MoveTo = ""
)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class OSIn {
  [DllImport("user32.dll", SetLastError=true)] public static extern uint SendInput(uint n, INPUT[] pInputs, int cb);
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Explicit)] public struct INUNION { [FieldOffset(0)] public KEYBDINPUT k; [FieldOffset(0)] public MOUSEINPUT m; }
  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public INUNION U; }
  public static void Key(ushort vk, bool up) {
    INPUT[] i = new INPUT[1]; i[0].type = 1; i[0].U.k.wVk = vk; i[0].U.k.dwFlags = up ? 2u : 0u;
    SendInput(1, i, Marshal.SizeOf(typeof(INPUT)));
  }
  public static void Mouse(int ndx, int ndy, bool up) {
    INPUT[] i = new INPUT[1]; i[0].type = 0; i[0].U.m.dx = ndx; i[0].U.m.dy = ndy;
    i[0].U.m.dwFlags = 0x8001u | (up ? 0x0006u : 0x0002u); // ABSOLUTE|VIRTUALDESK, UP or DOWN
    SendInput(1, i, Marshal.SizeOf(typeof(INPUT)));
  }
}
"@
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$norm = { param($x, $y) @(([math]::Floor($x * 65535 / $screen.Width)), ([math]::Floor($y * 65535 / $screen.Height))) }
if ($MoveTo -ne "") {
  $xy = $MoveTo.Split(','); $n = & $norm ([int]$xy[0]) ([int]$xy[1])
  [OSIn]::Mouse($n[0], $n[1], $true) # move without press (flag 1 = MOVE only)
  Write-Output "pointer moved"
}
if ($ClickX -ge 0 -and $ClickY -ge 0) {
  $n = & $norm $ClickX $ClickY
  [OSIn]::Mouse($n[0], $n[1], $false)
  Start-Sleep -Milliseconds 60
  [OSIn]::Mouse($n[0], $n[1], $true)
  Write-Output "clicked $ClickX,$ClickY"
  Start-Sleep -Milliseconds 150
}
if ($Keys -ne "") {
  $codes = $Keys.Split(',') | ForEach-Object { [Convert]::ToUInt16($_, 16) }
  if ($Tap -gt 0) {
    for ($n2 = 0; $n2 -lt $Tap; $n2++) {
      foreach ($vk in $codes) { [OSIn]::Key($vk, $false) }
      Start-Sleep -Milliseconds 40
      foreach ($vk in $codes) { [OSIn]::Key($vk, $true) }
      Start-Sleep -Milliseconds $Ms
    }
    Write-Output "tapped $Keys x$Tap"
  } else {
    foreach ($vk in $codes) { [OSIn]::Key($vk, $false) }
    Start-Sleep -Milliseconds $Ms
    foreach ($vk in $codes) { [OSIn]::Key($vk, $true) }
    Write-Output "held $Keys for $($Ms)ms"
  }
}
