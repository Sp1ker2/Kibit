using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace DesktopRecorderApp
{
    public class ApiClient
    {
        private readonly string baseUrl;
        private readonly HttpClient httpClient;
        public string? Username { get; private set; }
        public string? Room { get; private set; }

        public ApiClient(string baseUrl)
        {
            this.baseUrl = baseUrl;
            this.httpClient = new HttpClient();
            this.httpClient.Timeout = TimeSpan.FromMinutes(5); // Для загрузки больших файлов
        }

        public async Task<List<string>> GetRooms()
        {
            var response = await httpClient.GetStringAsync($"{baseUrl}/api/room-list");
            var rooms = JsonConvert.DeserializeObject<List<JObject>>(response);
            var roomNames = new List<string>();
            
            if (rooms != null)
            {
                foreach (var room in rooms)
                {
                    roomNames.Add(room["name"]?.ToString() ?? "");
                }
            }
            
            return roomNames;
        }

        public async Task<bool> Login(string username, string password, string room)
        {
            var data = new
            {
                username = username,
                password = password,
                room = room
            };

            var json = JsonConvert.SerializeObject(data);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await httpClient.PostAsync($"{baseUrl}/api/auth/login", content);
            
            if (response.IsSuccessStatusCode)
            {
                Username = username;
                Room = room;
                return true;
            }

            return false;
        }

        public async Task<bool> UploadRecording(string username, string roomName, byte[] videoData, int partNumber)
        {
            try
            {
                var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                var filename = $"{username}_{timestamp}_part{partNumber}.mp4";

                var formData = new MultipartFormDataContent();
                formData.Add(new StringContent(username), "username");
                formData.Add(new StringContent(roomName), "roomName");
                formData.Add(new StringContent(timestamp.ToString()), "timestamp");
                formData.Add(new ByteArrayContent(videoData), "video", filename);

                Console.WriteLine($"📤 Загружаем часть {partNumber}: {videoData.Length / 1024 / 1024} MB");

                var response = await httpClient.PostAsync($"{baseUrl}/api/recordings/upload", formData);

                if (response.IsSuccessStatusCode)
                {
                    Console.WriteLine($"✅ Часть {partNumber} загружена");
                    return true;
                }
                else
                {
                    Console.WriteLine($"❌ Ошибка загрузки: {response.StatusCode}");
                    return false;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Ошибка: {ex.Message}");
                return false;
            }
        }
    }
}


