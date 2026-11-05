Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

hubDir = "C:\Users\monis\Desktop\FULLSTACK\dev-hub"
serverJs = hubDir & "\server.js"
WshShell.CurrentDirectory = hubDir

nodeExe = "node"
If fso.FileExists("C:\Program Files\nodejs\node.exe") Then
    nodeExe = "C:\Program Files\nodejs\node.exe"
ElseIf fso.FileExists("C:\Program Files (x86)\nodejs\node.exe") Then
    nodeExe = "C:\Program Files (x86)\nodejs\node.exe"
End If

isListening = False
On Error Resume Next
Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
http.setTimeouts 400, 400, 400, 400
http.open "GET", "http://127.0.0.1:5555/api/projects", False
http.send
If Err.Number = 0 And http.Status = 200 Then
    isListening = True
End If
On Error GoTo 0

If Not isListening Then
    WshShell.Run """" & nodeExe & """ """ & serverJs & """", 0, False
    WScript.Sleep 800
End If

WshShell.Run "http://localhost:5555"
