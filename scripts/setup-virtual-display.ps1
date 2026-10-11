<#
.SYNOPSIS
    Automated Virtual Display Detector and Provisioner for Deskreen CE.
.DESCRIPTION
    Checks for the presence of secondary or virtual displays on Windows.
    If none is found, attempts to locate and activate an existing virtual display driver
    (e.g., IddSampleDriver, Amyuni, Parsec VDD, or Spacedesk), or prepares the system
    environment for virtual display streaming.
#>

param(
    [switch]$Force = $false,
    [int]$Width = 1920,
    [int]$Height = 1080,
    [int]$RefreshRate = 60
)

$ErrorActionPreference = "SilentlyContinue"

Write-Output "[VirtualDisplay] Checking active displays on Windows..."

Add-Type -AssemblyName System.Windows.Forms
$screens = [System.Windows.Forms.Screen]::AllScreens
$screenCount = $screens.Count

Write-Output "[VirtualDisplay] Current display count: $screenCount"

if ($screenCount -gt 1 -and -not $Force) {
    Write-Output "[VirtualDisplay] Secondary or virtual display is already active ($screenCount screens detected)."
    exit 0
}

Write-Output "[VirtualDisplay] Only 1 display found. Scanning for virtual display devices..."

# Check PNP display devices for virtual display adapters
$virtualDevices = Get-PnpDevice -Class "Display" | Where-Object {
    $_.FriendlyName -match "Virtual|Idd|Amyuni|Parsec|Spacedesk|USB Mobile Monitor"
}

if ($virtualDevices) {
    foreach ($dev in $virtualDevices) {
        Write-Output "[VirtualDisplay] Found virtual adapter: $($dev.FriendlyName) [Status: $($dev.Status)]"
        if ($dev.Status -ne "OK") {
            try {
                Write-Output "[VirtualDisplay] Attempting to enable $($dev.FriendlyName)..."
                Enable-PnpDevice -InstanceId $dev.InstanceId -Confirm:$false
            } catch {
                Write-Warning "[VirtualDisplay] Elevation needed to enable device: $($_.Exception.Message)"
            }
        }
    }
} else {
    Write-Output "[VirtualDisplay] No dedicated virtual display driver currently installed."
    Write-Output "[VirtualDisplay] Note: Deskreen supports Indirect Display Drivers (IddCx / Virtual-Display-Driver) or HDMI Dummy Plugs."
}

# Verify again after activation attempt
$screensAfter = [System.Windows.Forms.Screen]::AllScreens
Write-Output "[VirtualDisplay] Final screen count: $($screensAfter.Count)"

exit 0
