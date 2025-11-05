# Тестирование SSH подключения

Если Ansible не может подключиться, попробуйте вручную:

```bash
# Проверка подключения к серверам
ssh root@195.133.17.131
ssh root@195.133.17.179
ssh root@195.133.39.17
ssh root@195.133.39.33
ssh root@195.133.39.41
```

Если используются нестандартные SSH порты, верните их в inventory.ini:
```ini
server1 ansible_host=195.133.17.131 ansible_user=root ansible_port=16205 ansible_ssh_pass=iFG02M6Z
```

Если SSH порты закрыты или нестандартные, используйте sshpass:
```bash
# Установка sshpass
brew install hudochenkov/sshpass/sshpass  # macOS
sudo apt-get install sshpass             # Linux

# Тест подключения
sshpass -p 'iFG02M6Z' ssh -o StrictHostKeyChecking=no root@195.133.17.131
```

