# Carrega as classes do Windows Runtime (WinRT)
[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media, ContentType = WindowsRuntime] | Out-Null

$asyncOp = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()
$manager = $asyncOp.GetResults()

$sessions = $manager.GetSessions()
$isPlayingOtherMedia = $false

foreach ($session in $sessions) {
    $info = $session.GetPlaybackInfo()
    $status = $info.PlaybackStatus
    
    # Se está tocando...
    if ($status -eq "Playing") {
        # Ignora mplayer, Electron, Aura e o novo Waveian
        if ($appId -notmatch "mplayer" -and $appId -notmatch "Electron" -and $appId -notmatch "aura" -and $appId -notmatch "waveian") {
            $isPlayingOtherMedia = $true
        }
    }
}

if ($isPlayingOtherMedia) {
    Write-Output "True"
} else {
    Write-Output "False"
}
