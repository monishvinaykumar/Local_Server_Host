# 🚀 Local Dev Hub

A zero-terminal, zero-clutter local server manager and launcher.

- **Dashboard URL**: [http://localhost:5555](http://localhost:5555)
- **Port**: 5555

---

## 🌟 How It Works

1. **Auto-Starts on Boot**:
   - Local Dev Hub starts silently in the background when Windows boots up via the Windows Registry `Run` key (`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`) with a fallback in the Windows Startup folder.
   - It directly uses `C:\Program Files\nodejs\node.exe` with zero terminal popups.
   - If port 5555 is already running, secondary instances exit gracefully without conflicts.
   - Consumes negligible RAM (~20 MB).

2. **One-Click "Start & Open"**:
   - Click **▶ Start & Open** on any project.
   - For static HTML websites: served instantly by the built-in server (no npm or dependencies needed).
   - For fullstack/Node/Python apps: runs your configured command (e.g. `npm run dev` or `python app.py`) in the background.
   - Automatically opens your default browser directly to `http://localhost:<port>`.

3. **One-Click "Stop"**:
   - Stops the server and cleanly kills the background process tree so ports are freed immediately.

4. **Quick Tools on Each Project Card**:
   - **🌐 Open Browser**: Open the site anytime.
   - **📜 Logs**: View real-time terminal output and compile errors.
   - **📂 Folder**: Open the project folder in Windows File Explorer.
   - **💻 VS Code**: Open the project directly in VS Code (`code .`).

---

## 🛠️ Management Scripts

All files are located in `C:\Users\monis\Desktop\FULLSTACK\dev-hub`:

| Script | What it does |
| :--- | :--- |
| `setup-autostart.bat` | Enables starting Dev Hub silently on Windows boot (already enabled!). |
| `disable-autostart.bat` | Removes Dev Hub from Windows Startup if you ever want to turn it off. |
| `stop-hub.bat` | Stops the Dev Hub running on port 5555. |
| `start-visible.bat` | Starts Dev Hub in a visible terminal window (useful for debugging). |

---

## 📁 Projects Config

Your projects list is safely saved in:
`C:\Users\monis\Desktop\FULLSTACK\dev-hub\projects.json`
