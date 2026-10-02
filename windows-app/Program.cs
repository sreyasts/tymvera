using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

namespace TYMVERA.Desktop
{
    static class Program
    {
        private const string AppName = "TYMVERA";
        private const string AppUrl = "https://tymvera.web.app/";
        private static NotifyIcon trayIcon;
        private static Process appProcess;

        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        private const int SW_RESTORE = 9;

        [STAThread]
        static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            // 1. Check for single instance
            bool createdNew;
            using (Mutex mutex = new Mutex(true, "TYMVERA_SINGLE_INSTANCE_MUTEX", out createdNew))
            {
                if (!createdNew)
                {
                    // If already running, focus existing window or relaunch app
                    LaunchAppWindow();
                    return;
                }

                // 2. Setup Desktop & Start Menu Shortcuts if missing
                CreateShortcuts();

                // 3. Launch the dedicated standalone window
                LaunchAppWindow();

                // 4. Create System Tray notification icon
                SetupTray();

                Application.Run();
            }
        }

        private static string GetBrowserPath()
        {
            string[] possiblePaths = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Google\Chrome\Application\chrome.exe"),
            };

            foreach (var path in possiblePaths)
            {
                if (File.Exists(path)) return path;
            }

            return null;
        }

        private static void LaunchAppWindow()
        {
            try
            {
                string browser = GetBrowserPath();
                string userDataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TYMVERA", "Profile");
                if (!Directory.Exists(userDataDir))
                {
                    Directory.CreateDirectory(userDataDir);
                }

                if (appProcess != null && !appProcess.HasExited)
                {
                    if (appProcess.MainWindowHandle != IntPtr.Zero)
                    {
                        ShowWindow(appProcess.MainWindowHandle, SW_RESTORE);
                        SetForegroundWindow(appProcess.MainWindowHandle);
                        return;
                    }
                }

                if (!string.IsNullOrEmpty(browser))
                {
                    ProcessStartInfo psi = new ProcessStartInfo
                    {
                        FileName = browser,
                        Arguments = string.Format("--app=\"{0}\" --window-size=440,860 --user-data-dir=\"{1}\" --enable-features=DocumentPictureInPictureAPI,PictureInPicture", AppUrl, userDataDir),
                        UseShellExecute = false
                    };
                    appProcess = Process.Start(psi);
                }
                else
                {
                    Process.Start(new ProcessStartInfo(AppUrl) { UseShellExecute = true });
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Could not launch TYMVERA: " + ex.Message, "TYMVERA", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private static void SetupTray()
        {
            trayIcon = new NotifyIcon();
            trayIcon.Text = "TYMVERA • Productivity OS";

            // Extract application icon
            try
            {
                trayIcon.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            }
            catch
            {
                trayIcon.Icon = SystemIcons.Application;
            }

            ContextMenuStrip menu = new ContextMenuStrip();
            ToolStripMenuItem openItem = new ToolStripMenuItem("Open TYMVERA", null, (s, e) => LaunchAppWindow());
            openItem.Font = new Font(openItem.Font, FontStyle.Bold);

            ToolStripMenuItem timerItem = new ToolStripMenuItem("Picture-in-Picture Focus", null, (s, e) => {
                LaunchAppWindow();
            });

            ToolStripMenuItem exitItem = new ToolStripMenuItem("Exit", null, (s, e) => {
                trayIcon.Visible = false;
                Application.Exit();
            });

            menu.Items.Add(openItem);
            menu.Items.Add(timerItem);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add(exitItem);

            trayIcon.ContextMenuStrip = menu;
            trayIcon.DoubleClick += (s, e) => LaunchAppWindow();
            trayIcon.Visible = true;
        }

        private static void CreateShortcuts()
        {
            try
            {
                string desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                string shortcutPath = Path.Combine(desktopPath, "TYMVERA.url");
                if (!File.Exists(shortcutPath))
                {
                    using (StreamWriter writer = new StreamWriter(shortcutPath))
                    {
                        writer.WriteLine("[InternetShortcut]");
                        writer.WriteLine("URL=" + AppUrl);
                        writer.WriteLine("IconFile=" + Application.ExecutablePath);
                        writer.WriteLine("IconIndex=0");
                    }
                }
            }
            catch {}
        }
    }
}
