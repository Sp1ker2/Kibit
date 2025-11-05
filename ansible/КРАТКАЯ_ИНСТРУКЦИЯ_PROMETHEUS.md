# Prometheus + Grafana - Краткая инструкция

## Быстрый старт

### 1. Установка

```bash
cd ansible
make prometheus
```

Или напрямую:
```bash
ansible-playbook prometheus-grafana.yml
```

### 2. Проверка статуса

```bash
make prometheus-status
```

### 3. Доступ

- **Prometheus**: http://195.133.17.131:9090
- **Grafana**: http://195.133.17.131:3000
  - Логин: `admin`
  - Пароль: `admin` (измените при первом входе!)

## Что устанавливается

### На всех серверах (server1-server5):
- **node_exporter** (порт 9100) - метрики системы

### На master сервере (server1):
- **Prometheus** (порт 9090) - сбор метрик
- **Grafana** (порт 3000) - визуализация

## Настройка Grafana

### 1. Добавить Prometheus как источник данных

1. Войдите в Grafana (admin/admin)
2. Configuration → Data Sources → Add data source
3. Выберите Prometheus
4. URL: `http://localhost:9090`
5. Save & Test

### 2. Импорт дашбордов

1. Dashboards → Import
2. Импортируйте:
   - **Node Exporter Full**: ID `1860`
   - **Node Exporter Server Metrics**: ID `11074`

## Мониторинг

Собираются метрики:
- CPU, память, диск, сеть (с всех серверов)
- API серверы (порт 3001)
- LiveKit серверы (порт 7880)

## Идемпотентность

Playbook пропускает уже установленные компоненты - можно запускать многократно.



