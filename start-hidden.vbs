Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

hubDir = "C:\Users\monis\Desktop\FULLSTACK\dev-hub"
serverJs = hubDir & "\server.js"

nodeExe = "node"
If fso.FileExists("C:\Program Files\nodejs\node.exe") Then
    nodeExe = "C:\Program Files\nodejs\node.exe"
ElseIf fso.FileExists("C:\Program Files (x86)\nodejs\node.exe") Then
    nodeExe = "C:\Program Files (x86)\nodejs\node.exe"
ElseIf fso.FileExists(WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Programs\node\node.exe") Then
    nodeExe = WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Programs\node\node.exe"
End If

WshShell.CurrentDirectory = hubDir
WshShell.Run """" & nodeExe & """ """ & serverJs & """", 0, False
