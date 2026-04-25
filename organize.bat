@echo off
echo Organizando o projeto Waveian...

mkdir Website
mkdir OpenSource
mkdir release

move landing\* Website\
move main.js OpenSource\
move index.html OpenSource\
move style.css OpenSource\
move preload-yt.js OpenSource\
move renderer.js OpenSource\
move popup.html OpenSource\
move popup.js OpenSource\
move popup.css OpenSource\
move check-media.ps1 OpenSource\
move package.json OpenSource\
move package-lock.json OpenSource\
move icon.png OpenSource\

if exist dist (
    move dist\* release\
    rmdir /s /q dist
)

rmdir /s /q landing

echo Organizacao concluida! Agora tudo esta em Website, OpenSource e release.
pause
