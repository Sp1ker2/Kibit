using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using SharpAvi;
using SharpAvi.Output;

namespace DesktopRecorderApp
{
    public class ScreenRecorder
    {
        private readonly ApiClient apiClient;
        private readonly List<int> screenIndices;
        private readonly string username;
        private readonly string roomName;
        
        private System.Threading.Timer? captureTimer;
        private System.Threading.Timer? saveTimer;
        private AviWriter? aviWriter;
        private IAviVideoStream? videoStream;
        private string? currentVideoFile;
        private int partNumber = 1;
        private bool isRecording = false;
        private readonly object lockObject = new object();

        public event Action<int>? PartSaved;

        public ScreenRecorder(ApiClient apiClient, List<int> screenIndices, string username, string roomName)
        {
            this.apiClient = apiClient;
            this.screenIndices = screenIndices;
            this.username = username;
            this.roomName = roomName;
        }

        public void Start()
        {
            isRecording = true;
            CreateNewVideoFile();

            // Захватываем кадры каждые 33 мс (30 FPS)
            captureTimer = new System.Threading.Timer(CaptureFrame, null, 0, 33);

            // Сохраняем видео каждые 5 минут
            saveTimer = new System.Threading.Timer(async _ => await SaveCurrentVideo(), null, 
                TimeSpan.FromMinutes(5), TimeSpan.FromMinutes(5));

            Console.WriteLine("🎬 Запись началась");
        }

        public void Stop()
        {
            isRecording = false;
            
            captureTimer?.Dispose();
            saveTimer?.Dispose();

            // Сохраняем последнюю часть
            Task.Run(async () => await SaveCurrentVideo()).Wait();

            Console.WriteLine("⏹ Запись остановлена");
        }

        private void CreateNewVideoFile()
        {
            lock (lockObject)
            {
                CloseCurrentVideo();

                currentVideoFile = Path.Combine(Path.GetTempPath(), $"recording_{Guid.NewGuid()}.avi");
                
                var bounds = GetCombinedBounds();
                
                aviWriter = new AviWriter(currentVideoFile)
                {
                    FramesPerSecond = 30,
                    EmitIndex1 = true
                };

                videoStream = aviWriter.AddVideoStream();
                videoStream.Width = bounds.Width;
                videoStream.Height = bounds.Height;
                videoStream.Codec = KnownFourCCs.Codecs.MotionJpeg;
                videoStream.BitsPerPixel = BitsPerPixel.Bpp24;

                Console.WriteLine($"📹 Новый файл: {bounds.Width}×{bounds.Height} @ 30 FPS");
            }
        }

        private Rectangle GetCombinedBounds()
        {
            var screens = Screen.AllScreens;
            var selectedScreens = screenIndices.Select(i => screens[i]).ToList();

            if (selectedScreens.Count == 1)
            {
                return selectedScreens[0].Bounds;
            }

            // Объединяем экраны
            int minX = selectedScreens.Min(s => s.Bounds.X);
            int minY = selectedScreens.Min(s => s.Bounds.Y);
            int maxX = selectedScreens.Max(s => s.Bounds.Right);
            int maxY = selectedScreens.Max(s => s.Bounds.Bottom);

            return new Rectangle(minX, minY, maxX - minX, maxY - minY);
        }

        private void CaptureFrame(object? state)
        {
            if (!isRecording || videoStream == null) return;

            try
            {
                lock (lockObject)
                {
                    var bounds = GetCombinedBounds();
                    
                    using (var bitmap = new Bitmap(bounds.Width, bounds.Height))
                    using (var graphics = Graphics.FromImage(bitmap))
                    {
                        // Захватываем экран
                        graphics.CopyFromScreen(bounds.X, bounds.Y, 0, 0, bounds.Size);

                        // Конвертируем в формат для AVI
                        var bitmapData = bitmap.LockBits(
                            new Rectangle(0, 0, bitmap.Width, bitmap.Height),
                            ImageLockMode.ReadOnly,
                            PixelFormat.Format24bppRgb);

                        try
                        {
                            var buffer = new byte[bitmapData.Stride * bitmapData.Height];
                            System.Runtime.InteropServices.Marshal.Copy(
                                bitmapData.Scan0, buffer, 0, buffer.Length);

                            // Переворачиваем изображение (BMP хранится снизу вверх)
                            var flippedBuffer = new byte[buffer.Length];
                            for (int y = 0; y < bitmapData.Height; y++)
                            {
                                Array.Copy(buffer, 
                                    y * bitmapData.Stride, 
                                    flippedBuffer, 
                                    (bitmapData.Height - y - 1) * bitmapData.Stride, 
                                    bitmapData.Stride);
                            }

                            videoStream.WriteFrame(true, flippedBuffer, 0, flippedBuffer.Length);
                        }
                        finally
                        {
                            bitmap.UnlockBits(bitmapData);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Ошибка захвата кадра: {ex.Message}");
            }
        }

        private async Task SaveCurrentVideo()
        {
            try
            {
                Console.WriteLine("💾 Сохранение видео...");

                string? fileToUpload = null;

                lock (lockObject)
                {
                    if (currentVideoFile == null || !File.Exists(currentVideoFile))
                    {
                        Console.WriteLine("⚠️ Нет файла для сохранения");
                        return;
                    }

                    CloseCurrentVideo();
                    fileToUpload = currentVideoFile;
                    
                    // Создаём новый файл для продолжения записи
                    if (isRecording)
                    {
                        CreateNewVideoFile();
                    }
                }

                // Загружаем файл на сервер
                if (fileToUpload != null && File.Exists(fileToUpload))
                {
                    var videoData = await File.ReadAllBytesAsync(fileToUpload);
                    var sizeMB = videoData.Length / 1024.0 / 1024.0;
                    
                    Console.WriteLine($"📤 Загружаем {sizeMB:F2} MB на сервер...");

                    bool success = await apiClient.UploadRecording(username, roomName, videoData, partNumber);

                    if (success)
                    {
                        Console.WriteLine($"✅ Часть {partNumber} сохранена ({sizeMB:F2} MB)");
                        PartSaved?.Invoke(partNumber);
                        partNumber++;
                        
                        // Удаляем временный файл
                        File.Delete(fileToUpload);
                    }
                    else
                    {
                        Console.WriteLine($"❌ Ошибка загрузки части {partNumber}");
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Ошибка сохранения: {ex.Message}");
            }
        }

        private void CloseCurrentVideo()
        {
            try
            {
                videoStream?.Dispose();
                aviWriter?.Close();
                videoStream = null;
                aviWriter = null;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"⚠️ Ошибка закрытия видео: {ex.Message}");
            }
        }
    }
}

