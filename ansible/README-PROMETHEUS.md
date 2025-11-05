# Prometheus + Grafana Setup

## Описание

Ansible playbook для установки и настройки Prometheus и Grafana для мониторинга всех серверов.

## Что устанавливается

### На всех серверах:
- **node_exporter** (порт 9100) - сбор метрик системы (CPU, память, диск, сеть)

### На master сервере (server1):
- **Prometheus** (порт 9090) - сбор и хранение метрик
- **Grafana** (порт 3000) - визуализация метрик

## Использование

### Запуск установки

```bash
cd ansible
ansible-playbook prometheus-grafana.yml
```

### Проверка статуса

```bash
# Проверка node_exporter на всех серверах
ansible all -m shell -a "systemctl status node_exporter"

# Проверка Prometheus на master
ansible master -m shell -a "systemctl status prometheus"

# Проверка Grafana на master
ansible master -m shell -a "systemctl status grafana-server"
```

### Проверка портов

```bash
# Проверка node_exporter (порт 9100)
ansible all -m shell -a "netstat -tuln | grep 9100"

# Проверка Prometheus (порт 9090)
ansible master -m shell -a "netstat -tuln | grep 9090"

# Проверка Grafana (порт 3000)
ansible master -m shell -a "netstat -tuln | grep 3000"
```

## Доступ

После установки:

- **Prometheus**: http://195.133.17.131:9090
- **Grafana**: http://195.133.17.131:3000
  - Логин: `admin`
  - Пароль: `admin` (измените при первом входе!)

## Настройка Grafana

### 1. Добавление Prometheus как источника данных

1. Войдите в Grafana (admin/admin)
2. Перейдите в **Configuration** → **Data Sources**
3. Нажмите **Add data source**
4. Выберите **Prometheus**
5. URL: `http://localhost:9090`
6. Нажмите **Save & Test**

### 2. Импорт готовых дашбордов

1. Перейдите в **Dashboards** → **Import**
2. Импортируйте дашборды:
   - **Node Exporter Full**: ID `1860`
   - **Node Exporter Server Metrics**: ID `11074`

### 3. Настройка через Nginx (опционально)

Для доступа через домен добавьте в конфигурацию Nginx:

```nginx
# Grafana
location /grafana/ {
    proxy_pass http://localhost:3000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Prometheus
location /prometheus/ {
    proxy_pass http://localhost:9090/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Мониторинг

### Метрики, которые собираются:

1. **Node Exporter** (на всех серверах):
   - CPU использование
   - Память (RAM)
   - Дисковое пространство
   - Сетевой трафик
   - Загрузка системы

2. **API серверы** (если настроены метрики):
   - Доступность API
   - Время ответа
   - Количество запросов

3. **LiveKit серверы** (если настроены метрики):
   - Доступность LiveKit
   - Количество активных подключений

## Идемпотентность

Playbook является идемпотентным:
- Пропускает установку, если компоненты уже установлены
- Проверяет наличие сервисов перед установкой
- Не переустанавливает, если уже установлено

## Обновление

Для обновления Prometheus или Grafana:

1. Остановите сервис
2. Удалите старую версию
3. Запустите playbook снова

## Логи

- Prometheus: `/var/log/prometheus/` (если настроено)
- Grafana: `/var/log/grafana/grafana.log`
- Node Exporter: `journalctl -u node_exporter`



