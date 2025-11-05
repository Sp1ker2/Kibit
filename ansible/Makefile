# Makefile для удобного управления Ansible playbooks

.PHONY: help deploy nginx check status start restart logs clean prometheus prometheus-status

help:
	@echo "Доступные команды:"
	@echo "  make deploy          - Развернуть на всех серверах"
	@echo "  make nginx           - Настроить Nginx Load Balancer"
	@echo "  make check           - Проверить статус всех серверов"
	@echo "  make start           - Запустить сервисы (если не запущены)"
	@echo "  make restart         - Перезапустить сервисы"
	@echo "  make logs            - Показать логи"
	@echo "  make clean           - Очистить временные файлы"
	@echo "  make prometheus      - Установить Prometheus + Grafana"
	@echo "  make prometheus-status - Проверить статус мониторинга"

deploy:
	ansible-playbook playbook.yml

nginx:
	ansible-playbook nginx-lb.yml

check:
	ansible-playbook check-all.yml

start:
	ansible-playbook start-all.yml

restart:
	ansible all -m shell -a "cd /www/wwwroot/LiveKit && pkill -f 'livekit-server' || true && pkill -f 'npm run api' || true && pkill -f 'npm run dev' || true && sleep 2"
	ansible-playbook start-all.yml

logs:
	@echo "=== API Logs ==="
	@ansible all -m shell -a "tail -n 20 /tmp/api.log" -o
	@echo ""
	@echo "=== Frontend Logs ==="
	@ansible all -m shell -a "tail -n 20 /tmp/frontend.log" -o
	@echo ""
	@echo "=== LiveKit Logs ==="
	@ansible all -m shell -a "tail -n 20 /tmp/livekit.log" -o

clean:
	rm -rf /tmp/ansible_facts

prometheus:
	ansible-playbook prometheus-grafana.yml

prometheus-status:
	@echo "=== Node Exporter (на всех серверах) ==="
	@ansible all -m shell -a "systemctl is-active node_exporter && netstat -tuln | grep 9100 || echo 'не запущен'" -o
	@echo ""
	@echo "=== Prometheus (на master) ==="
	@ansible master -m shell -a "systemctl is-active prometheus && netstat -tuln | grep 9090 || echo 'не запущен'" -o
	@echo ""
	@echo "=== Grafana (на master) ==="
	@ansible master -m shell -a "systemctl is-active grafana-server && netstat -tuln | grep 3000 || echo 'не запущен'" -o
	@echo ""
	@echo "Доступ:"
	@echo "  Prometheus: http://195.133.17.131:9090"
	@echo "  Grafana: http://195.133.17.131:3000 (admin/admin)"

