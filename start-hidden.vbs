Set WshShell = CreateObject("WScript.Shell")
hubDir = "C:\Users\monis\Desktop\FULLSTACK\dev-hub"
WshShell.CurrentDirectory = hubDir
WshShell.Run """" & hubDir & "\launch.vbs""", 0, False
