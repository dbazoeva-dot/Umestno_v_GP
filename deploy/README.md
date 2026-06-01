# Deployment artifacts

Конфиги, которые лежат **на VPS**, но версионируются в репо для
повторяемости. Сами файлы в `/etc/...` копируются вручную при первой
установке (см. инструкции ниже), потом редактируются у нас в репо и
повторно копируются.

## `umestno-api.service` — systemd-unit для Node API

Делает три вещи:
1. **Автостарт при загрузке VPS.** Если хостер перезагрузит машину
   (kernel update, аварийный ребут), Node поднимается сам, без
   ручного `npm start`.
2. **Авторестарт при падении.** Если процесс упал из-за необработанной
   ошибки — systemd поднимет его через 5 секунд (до 5 попыток за
   минуту, потом сдаётся).
3. **Структурное логирование.** Логи попадают в `journalctl`, не
   в `/tmp/umestno-api.log`. Смотреть:
   ```bash
   journalctl -u umestno-api -f                  # follow
   journalctl -u umestno-api --since '1h ago'    # за последний час
   ```

### Первая установка (один раз на VPS)

```bash
# 0) убедиться что текущий ручной процесс убит (если запущен через nohup)
pkill -f "node.*dist/server"

# 1) скопировать unit в системное место
sudo cp /var/www/umestno/deploy/umestno-api.service /etc/systemd/system/

# 2) сказать systemd перечитать units
sudo systemctl daemon-reload

# 3) включить автостарт при загрузке
sudo systemctl enable umestno-api

# 4) запустить сейчас
sudo systemctl start umestno-api

# 5) проверить статус
sudo systemctl status umestno-api          # должно быть active (running)
curl -sS https://umestno-home.ru/api/healthz  # должен ответить {"ok":true,...}
```

### Обычный деплой (после первого раза)

```bash
cd /var/www/umestno
git pull origin main
npm run build                       # пересобрать dist/
sudo systemctl restart umestno-api  # подхватить новый код
sudo systemctl status umestno-api   # убедиться что поднялся
```

### Если правил сам `.service` файл

Если файл `deploy/umestno-api.service` в репо обновлялся (например,
поменяли Restart-политику или добавили Environment), после
`git pull` дополнительно нужно:

```bash
sudo cp /var/www/umestno/deploy/umestno-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl restart umestno-api
```

### Откат к ручному запуску (на случай если systemd ломает)

```bash
sudo systemctl stop umestno-api
sudo systemctl disable umestno-api
cd /var/www/umestno
nohup npm start > /tmp/umestno-api.log 2>&1 &
```
