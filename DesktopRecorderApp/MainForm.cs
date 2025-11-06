using System;
using System.Drawing;
using System.Windows.Forms;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace DesktopRecorderApp
{
    public partial class MainForm : Form
    {
        private ApiClient apiClient;
        private ScreenRecorder? screenRecorder;
        private NotifyIcon? trayIcon;
        
        private TextBox txtUsername;
        private TextBox txtPassword;
        private ComboBox cmbRoom;
        private Button btnLogin;
        private Panel loginPanel;
        
        private CheckedListBox screenList;
        private Button btnStartRecording;
        private Panel screenPanel;
        
        private Label lblStatus;
        private Label lblTime;
        private Label lblSaved;
        private Button btnStopRecording;
        private Button btnMinimizeToTray;
        private Panel recordingPanel;
        
        private System.Windows.Forms.Timer recordingTimer;
        private DateTime recordingStartTime;

        public MainForm()
        {
            InitializeComponent();
            apiClient = new ApiClient("https://kibitkostreamappv.pp.ua");
            LoadRooms();
        }

        private void InitializeComponent()
        {
            this.Text = "🎬 LiveKit Desktop Recorder";
            this.Size = new Size(500, 600);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedSingle;
            this.MaximizeBox = false;
            this.BackColor = Color.FromArgb(30, 30, 30);

            // Создаём трей иконку
            CreateTrayIcon();

            // Панель входа
            CreateLoginPanel();

            // Панель выбора экранов (скрыта)
            CreateScreenPanel();

            // Панель записи (скрыта)
            CreateRecordingPanel();

            // Таймер для обновления времени записи
            recordingTimer = new System.Windows.Forms.Timer();
            recordingTimer.Interval = 1000;
            recordingTimer.Tick += RecordingTimer_Tick;
        }

        private void CreateTrayIcon()
        {
            trayIcon = new NotifyIcon();
            trayIcon.Icon = SystemIcons.Application;
            trayIcon.Text = "LiveKit Recorder";
            trayIcon.Visible = false;

            var trayMenu = new ContextMenuStrip();
            trayMenu.Items.Add("Показать окно", null, (s, e) => { this.Show(); this.WindowState = FormWindowState.Normal; });
            trayMenu.Items.Add("Скрыть окно", null, (s, e) => this.Hide());
            trayMenu.Items.Add("-");
            trayMenu.Items.Add("Выход", null, (s, e) => Application.Exit());

            trayIcon.ContextMenuStrip = trayMenu;
            trayIcon.DoubleClick += (s, e) => { this.Show(); this.WindowState = FormWindowState.Normal; };
        }

        private void CreateLoginPanel()
        {
            loginPanel = new Panel
            {
                Location = new Point(20, 20),
                Size = new Size(460, 500),
                BackColor = Color.FromArgb(40, 40, 40),
                Visible = true
            };

            var lblTitle = new Label
            {
                Text = "🎬 Авторизация",
                Location = new Point(20, 20),
                Size = new Size(420, 30),
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 14, FontStyle.Bold)
            };

            var lblRoom = new Label
            {
                Text = "Комната:",
                Location = new Point(20, 70),
                Size = new Size(420, 20),
                ForeColor = Color.LightGray
            };

            cmbRoom = new ComboBox
            {
                Location = new Point(20, 95),
                Size = new Size(420, 30),
                DropDownStyle = ComboBoxStyle.DropDownList,
                BackColor = Color.FromArgb(30, 30, 30),
                ForeColor = Color.White
            };

            var lblUsername = new Label
            {
                Text = "Логин:",
                Location = new Point(20, 140),
                Size = new Size(420, 20),
                ForeColor = Color.LightGray
            };

            txtUsername = new TextBox
            {
                Location = new Point(20, 165),
                Size = new Size(420, 30),
                BackColor = Color.FromArgb(30, 30, 30),
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 10)
            };

            var lblPassword = new Label
            {
                Text = "Пароль:",
                Location = new Point(20, 210),
                Size = new Size(420, 20),
                ForeColor = Color.LightGray
            };

            txtPassword = new TextBox
            {
                Location = new Point(20, 235),
                Size = new Size(420, 30),
                PasswordChar = '●',
                BackColor = Color.FromArgb(30, 30, 30),
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 10)
            };

            btnLogin = new Button
            {
                Text = "Войти",
                Location = new Point(20, 290),
                Size = new Size(420, 45),
                BackColor = Color.FromArgb(96, 165, 250),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 12, FontStyle.Bold)
            };
            btnLogin.FlatAppearance.BorderSize = 0;
            btnLogin.Click += BtnLogin_Click;

            loginPanel.Controls.AddRange(new Control[] { lblTitle, lblRoom, cmbRoom, lblUsername, txtUsername, lblPassword, txtPassword, btnLogin });
            this.Controls.Add(loginPanel);
        }

        private void CreateScreenPanel()
        {
            screenPanel = new Panel
            {
                Location = new Point(20, 20),
                Size = new Size(460, 500),
                BackColor = Color.FromArgb(40, 40, 40),
                Visible = false
            };

            var lblTitle = new Label
            {
                Text = "📺 Выбор экранов для записи",
                Location = new Point(20, 20),
                Size = new Size(420, 30),
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 14, FontStyle.Bold)
            };

            screenList = new CheckedListBox
            {
                Location = new Point(20, 70),
                Size = new Size(420, 350),
                BackColor = Color.FromArgb(30, 30, 30),
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 11),
                CheckOnClick = true
            };

            btnStartRecording = new Button
            {
                Text = "▶ Начать запись",
                Location = new Point(20, 440),
                Size = new Size(420, 45),
                BackColor = Color.FromArgb(96, 165, 250),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 12, FontStyle.Bold),
                Enabled = false
            };
            btnStartRecording.FlatAppearance.BorderSize = 0;
            btnStartRecording.Click += BtnStartRecording_Click;

            screenList.ItemCheck += (s, e) => 
            {
                // Обновляем кнопку после изменения выбора
                this.BeginInvoke(new Action(() => 
                {
                    btnStartRecording.Enabled = screenList.CheckedItems.Count > 0;
                }));
            };

            screenPanel.Controls.AddRange(new Control[] { lblTitle, screenList, btnStartRecording });
            this.Controls.Add(screenPanel);
        }

        private void CreateRecordingPanel()
        {
            recordingPanel = new Panel
            {
                Location = new Point(20, 20),
                Size = new Size(460, 500),
                BackColor = Color.FromArgb(40, 40, 40),
                Visible = false
            };

            lblStatus = new Label
            {
                Text = "🔴 Идёт запись",
                Location = new Point(20, 20),
                Size = new Size(420, 40),
                ForeColor = Color.FromArgb(239, 68, 68),
                Font = new Font("Segoe UI", 16, FontStyle.Bold),
                TextAlign = ContentAlignment.MiddleCenter,
                BackColor = Color.FromArgb(50, 20, 20)
            };

            var infoPanel = new Panel
            {
                Location = new Point(20, 80),
                Size = new Size(420, 120),
                BackColor = Color.FromArgb(30, 30, 30)
            };

            lblTime = new Label
            {
                Text = "Время: 00:00:00",
                Location = new Point(20, 20),
                Size = new Size(380, 30),
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 12)
            };

            lblSaved = new Label
            {
                Text = "Сохранено: 0 частей",
                Location = new Point(20, 60),
                Size = new Size(380, 30),
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 12)
            };

            infoPanel.Controls.AddRange(new Control[] { lblTime, lblSaved });

            btnStopRecording = new Button
            {
                Text = "⏹ Остановить запись",
                Location = new Point(20, 220),
                Size = new Size(420, 50),
                BackColor = Color.FromArgb(239, 68, 68),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 13, FontStyle.Bold)
            };
            btnStopRecording.FlatAppearance.BorderSize = 0;
            btnStopRecording.Click += BtnStopRecording_Click;

            btnMinimizeToTray = new Button
            {
                Text = "↓ Свернуть в трей",
                Location = new Point(20, 290),
                Size = new Size(420, 45),
                BackColor = Color.FromArgb(139, 92, 246),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 11, FontStyle.Bold)
            };
            btnMinimizeToTray.FlatAppearance.BorderSize = 0;
            btnMinimizeToTray.Click += (s, e) => 
            {
                this.Hide();
                trayIcon!.Visible = true;
                trayIcon.ShowBalloonTip(2000, "LiveKit Recorder", "Запись продолжается в фоне", ToolTipIcon.Info);
            };

            recordingPanel.Controls.AddRange(new Control[] { lblStatus, infoPanel, btnStopRecording, btnMinimizeToTray });
            this.Controls.Add(recordingPanel);
        }

        private async void LoadRooms()
        {
            try
            {
                var rooms = await apiClient.GetRooms();
                cmbRoom.Items.Clear();
                foreach (var room in rooms)
                {
                    cmbRoom.Items.Add(room);
                }
                if (cmbRoom.Items.Count > 0)
                    cmbRoom.SelectedIndex = 0;
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Ошибка загрузки комнат: {ex.Message}", "Ошибка", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private async void BtnLogin_Click(object? sender, EventArgs e)
        {
            if (string.IsNullOrWhiteSpace(txtUsername.Text) || 
                string.IsNullOrWhiteSpace(txtPassword.Text) ||
                cmbRoom.SelectedItem == null)
            {
                MessageBox.Show("Заполните все поля!", "Ошибка", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            btnLogin.Enabled = false;
            btnLogin.Text = "Вход...";

            try
            {
                var success = await apiClient.Login(txtUsername.Text, txtPassword.Text, cmbRoom.SelectedItem.ToString()!);
                
                if (success)
                {
                    LoadScreens();
                    loginPanel.Visible = false;
                    screenPanel.Visible = true;
                }
                else
                {
                    MessageBox.Show("Неверный логин или пароль!", "Ошибка", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Ошибка входа: {ex.Message}", "Ошибка", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally
            {
                btnLogin.Enabled = true;
                btnLogin.Text = "Войти";
            }
        }

        private void LoadScreens()
        {
            screenList.Items.Clear();
            var screens = Screen.AllScreens;
            for (int i = 0; i < screens.Length; i++)
            {
                screenList.Items.Add($"Экран {i + 1} ({screens[i].Bounds.Width}×{screens[i].Bounds.Height})");
            }
        }

        private void BtnStartRecording_Click(object? sender, EventArgs e)
        {
            var selectedScreens = new List<int>();
            for (int i = 0; i < screenList.CheckedIndices.Count; i++)
            {
                selectedScreens.Add(screenList.CheckedIndices[i]);
            }

            if (selectedScreens.Count == 0)
            {
                MessageBox.Show("Выберите хотя бы один экран!", "Ошибка", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            screenRecorder = new ScreenRecorder(
                apiClient,
                selectedScreens,
                txtUsername.Text,
                cmbRoom.SelectedItem?.ToString() ?? "unknown"
            );

            screenRecorder.PartSaved += (partNumber) =>
            {
                this.Invoke(new Action(() =>
                {
                    lblSaved.Text = $"Сохранено: {partNumber} частей";
                }));
            };

            screenRecorder.Start();

            screenPanel.Visible = false;
            recordingPanel.Visible = true;
            recordingStartTime = DateTime.Now;
            recordingTimer.Start();

            trayIcon!.Icon = SystemIcons.Exclamation; // Красная иконка при записи
            trayIcon.Text = "🔴 LiveKit - Идёт запись";
        }

        private void BtnStopRecording_Click(object? sender, EventArgs e)
        {
            StopRecording();
            screenPanel.Visible = true;
            recordingPanel.Visible = false;
        }

        private void StopRecording()
        {
            if (screenRecorder != null)
            {
                screenRecorder.Stop();
                screenRecorder = null;
            }

            recordingTimer.Stop();
            trayIcon!.Icon = SystemIcons.Application;
            trayIcon.Text = "⚪ LiveKit - Запись остановлена";
        }

        private void RecordingTimer_Tick(object? sender, EventArgs e)
        {
            var elapsed = DateTime.Now - recordingStartTime;
            lblTime.Text = $"Время: {elapsed:hh\\:mm\\:ss}";
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (screenRecorder != null && e.CloseReason == CloseReason.UserClosing)
            {
                e.Cancel = true;
                this.Hide();
                trayIcon!.Visible = true;
                trayIcon.ShowBalloonTip(2000, "LiveKit Recorder", "Приложение свёрнуто в трей. Запись продолжается.", ToolTipIcon.Info);
            }
            else
            {
                StopRecording();
                trayIcon?.Dispose();
                base.OnFormClosing(e);
            }
        }
    }
}

