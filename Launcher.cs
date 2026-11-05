using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Threading;

class Program {
    [STAThread]
    static void Main() {
        string hubDir = @"C:\Users\monis\Desktop\FULLSTACK\dev-hub";
        string serverJs = Path.Combine(hubDir, "server.js");
        
        bool isRunning = false;
        try {
            HttpWebRequest req = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:5555/api/projects");
            req.Timeout = 400;
            using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse()) {
                if (resp.StatusCode == HttpStatusCode.OK) {
                    isRunning = true;
                }
            }
        } catch {}

        if (!isRunning) {
            string nodeExe = "node.exe";
            if (File.Exists(@"C:\Program Files\nodejs\node.exe")) {
                nodeExe = @"C:\Program Files\nodejs\node.exe";
            } else if (File.Exists(@"C:\Program Files (x86)\nodejs\node.exe")) {
                nodeExe = @"C:\Program Files (x86)\nodejs\node.exe";
            }

            ProcessStartInfo psi = new ProcessStartInfo();
            psi.FileName = nodeExe;
            psi.Arguments = "\"" + serverJs + "\"";
            psi.WorkingDirectory = hubDir;
            psi.WindowStyle = ProcessWindowStyle.Hidden;
            psi.UseShellExecute = true;

            Process.Start(psi);
            Thread.Sleep(800);
        }

        Process.Start(new ProcessStartInfo("http://localhost:5555") { UseShellExecute = true });
    }
}
