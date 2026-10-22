<div align="center">
  <img src="frontend/public/saq-qurylys-mark.svg" alt="Знак SAQ QURYLYS" width="64" />
  <h1>SAQ QURYLYS</h1>
  <p><strong>Мониторинг рисков в долевом жилищном строительстве</strong></p>
  <p>🏆 <strong>1-е место · <a href="https://astanahub.com/ru/event/oskemen-hub-codemasters-hackathon-8-0/">Codemasters Hackathon 8.0</a></strong></p>
</div>

## 1. Краткое описание

SAQ QURYLYS помогает городским специалистам сопоставлять строящиеся жилые комплексы с публикациями, обращениями и документальными основаниями. Система сохраняет доказательства, объясняет факторы риска R1–R6 и помогает направить сигнал на проверку. Риск — это приоритет проверки, а не вывод о нарушении; окончательное решение остаётся за человеком.

## 2. Технологический стек

| Группа | Технологии |
|---|---|
| Core | React 19.3.0, TypeScript 6.0.3, Vite 8.3.4, Tailwind CSS 4.3.3, MapLibre GL 6.14.0; Python 3.12, FastAPI 0.143.0, Pydantic, SQLAlchemy 2.1.4, Alembic 1.20.0 |
| Data | PostgreSQL 16 с PostGIS 3.5; MinIO с S3 API и Object Lock |
| AI/ML | Отключаемый Tesseract OCR (включён по умолчанию), pymorphy3 и rapidfuzz; необязательный Ollama/Qwen для разбора текста и SAQ VISION с опциональным предобученным детектором |
| Infra | nginx, Celery 5.6.3, Redis 7, Playwright для снимков страниц, WeasyPrint для PDF, Docker Compose v2 |

Версии библиотек приведены по lock-файлам; версии PostgreSQL, PostGIS и Redis — по образам в `docker-compose.yml`.

## 3. Архитектура

### Сервисы и поток данных

```mermaid
flowchart LR
    Browser["Браузер<br/>React SPA"] <-->|SPA и запросы /api| Nginx["nginx<br/>статика и прокси"]
    Nginx -->|/api → :8000| API["FastAPI<br/>sync SQLAlchemy"]

    API -->|SQLAlchemy| DB[("PostgreSQL 16 + PostGIS<br/>БД: saq")]
    API <-->|S3 API| MinIO[("MinIO<br/>доказательства и файлы")]
    API -->|Celery tasks| Redis[("Redis<br/>broker")]
    Beat["Celery beat"] -->|расписание| Redis
    Redis --> Worker["Celery worker<br/>сбор, архив, OCR, NLP, скоринг"]
    Worker <-->|SQLAlchemy| DB
    Worker <-->|S3 API| MinIO
    Migrate["migrate<br/>Alembic как владелец БД"] --> DB

    Telegram["Telegram Bot API"] <-->|long polling| Bot["Опциональный bot<br/>python-telegram-bot"]
    Bot -->|app.bot.service + SQLAlchemy| DB
    Bot -->|фото и доказательства| MinIO
    Bot -->|лимиты и очередь публикаций| Redis
```

Браузер получает SPA от nginx; nginx проксирует API-запросы в FastAPI. API и worker работают с PostgreSQL через синхронный SQLAlchemy. Долгие операции — захват страницы, OCR и NLP — отправляются через Celery в Redis; worker сохраняет результаты и файлы в PostgreSQL и MinIO. Celery beat публикует задачи по расписанию.

Гражданский Telegram-бот запущен отдельным профилем Compose. Он получает обновления через long polling и вызывает Python-сервис бота; обработчики открывают SQLAlchemy-сессию в потоке и сохраняют публикацию или обращение напрямую в PostgreSQL. Фото и зафиксированные материалы сохраняются в MinIO, обработка публикации ставится в очередь. HTTP-вызова FastAPI и webhook у этого потока нет. Отдельный профиль `userbot` предназначен для чтения источников Telegram и не является ботом обращений.

### AI-анализ и проверка человеком

```mermaid
flowchart LR
    Post["Исходный текст публикации"] --> Text["Текст для анализа"]
    Photo["Фото доказательств"] --> OCR["Локальный Tesseract OCR"]
    OCR --> Text
    Text --> Rules["Словарный NLP"]
    Text --> Prompt["Контракт prompt: только факты из текста,<br/>JSON по схеме и дословные цитаты"]
    Prompt -. если LLM_ENABLED=true .-> Ollama["Необязательный Ollama /api/chat"]
    Ollama --> Validate["JSON Schema + Pydantic<br/>проверка цитат по тексту"]
    Validate --> Hypothesis["Гипотезы модели<br/>без подтверждённых полей"]
    Hypothesis --> Review["Проверка аналитиком<br/>принять или отклонить"]
    Rules --> Facts["Факторы и сведения<br/>с учётом статуса проверки"]
    Review --> Facts
    Registry["Проверенные документы,<br/>обращения и осмотры"] --> Facts
    Facts --> Score["Детерминированный расчёт R1–R6<br/>сумма весов, максимум 100"]
    Score --> Zone["Зона риска<br/>для красной нужны R1 и R2"]

    Question["Вопрос сотрудника"] --> Assistant["Опциональный помощник<br/>ASSISTANT_ENABLED=true"]
    Assistant --> Context["BM25 по руководству<br/>+ доступные пользователю<br/>read-only инструменты"]
    Context --> Provider["OpenAI-compatible API<br/>локальный Ollama по умолчанию"]
    Provider --> Assistant
    Assistant -->|SSE| Answer["Ответ в интерфейсе"]
```

Изображения обрабатываются локальным OCR; модели передаётся подготовленный текст объявления с распознанным текстом, а не фото. Извлечение через Ollama отключено по умолчанию (`LLM_ENABLED=false`); пример модели — `qwen3.5:9b-q6k`, адрес — `http://host.docker.internal:11434`. Prompt ограничивает анализ фактами исходного текста и требует JSON с цитатами. Ответ проверяется по схеме и Pydantic, а цитаты должны находиться в тексте объявления. Находки остаются гипотезами: они попадают в подтверждённые сведения только после решения аналитика. Скоринг реализован отдельными детерминированными правилами; модель не назначает балл и не переводит объект в красную зону.

Помощник сотрудников — отдельная опция (`ASSISTANT_ENABLED=false` по умолчанию). При включении он обращается к OpenAI-compatible endpoint (`ASSISTANT_BASE_URL=http://host.docker.internal:11434/v1`, модель `qwen3.5:9b-q6k`; ключ в примере пустой), отвечает по руководству и результатам доступных только для чтения инструментов, применяя ролевую и территориальную область пользователя. Это помощник по работе с продуктом и его данными; генерации кода в продукте нет. Дополнительный модуль SAQ VISION отключён (`VISION_ENABLED=false`, `VISION_DETECTOR_BACKEND=disabled`); его предобученный, не дообученный на стройках детектор включается отдельно и выдаёт подсказки, которые проверяет специалист. Подробнее: [помощник](docs/ASSISTANT.md), [архитектура SAQ VISION](docs/SAQ_VISION_ARCHITECTURE.md), [спецификация факторов риска](docs/SPEC.md).

### Принятые архитектурные решения

- **FastAPI и Pydantic задают API-контракт.** OpenAPI описывает HTTP-интерфейс, а прикладные сервисы backend используются API, worker и Telegram-ботом.
- **Очередь изолирует долгую обработку от API-запросов.** Celery и Redis используются для захвата страниц, OCR, NLP, перерасчёта риска и расписаний.
- **PostGIS и MinIO разделяют реестр и доказательства.** Структурированные данные и геосвязи хранятся в PostgreSQL; фото и архивные файлы — в S3-хранилище MinIO с Object Lock.

## 4. Запуск и настройка

### Быстрый запуск демо

Нужны Docker Engine или Docker Desktop с работающим daemon, Docker Compose v2 с поддержкой `up --wait`, Bash и доступ к интернету для первой сборки образов и загрузки браузерных/OCR-зависимостей. Первая сборка может занять время. Команда должна иметь доступ к Docker daemon (`docker info`); для Bash в WSL включите интеграцию установленного Docker Desktop с используемым дистрибутивом.

Из корня репозитория:

```bash
./scripts/start-demo.sh
```

Скрипт создаёт `.env` из `.env.example`, если файла ещё нет, затем собирает и запускает Compose-стек, ждёт готовности сервисов и выполняет seed демо-данных только для пустой базы. Существующий `.env` не перезаписывается. Откройте [http://localhost:8080](http://localhost:8080); OpenAPI доступен на [http://localhost:8000/docs](http://localhost:8000/docs), health check — [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health).

Данные демонстрационных объектов и публикаций вымышлены. Seed создаёт учётную запись администратора и пользователей демо-ролей. Пароль администратора задаётся в `INITIAL_ADMIN_PASSWORD`; пароли новых demo-пользователей выводятся один раз в вывод команды seed (по умолчанию задаются `DEMO_USER_PASSWORD`).

### `.env` и ручной запуск Compose

Для ручного старта скопируйте публичный пример конфигурации и ограничьте доступ к файлу:

```bash
cp .env.example .env
chmod 600 .env
```

Значения `.env.example` предназначены только для локального демо. Ключевые примеры: `POSTGRES_USER=saq`, `POSTGRES_PASSWORD=saq_dev_password`, `POSTGRES_DB=saq`; роль приложения — `APP_DB_USER=saq_app` и `APP_DB_PASSWORD=saq_app_dev_password` (для этого значения используйте URL-safe символы). Compose требует `APP_DB_PASSWORD`. Host-URL `DATABASE_URL` в примере — `postgresql+psycopg://saq:saq_dev_password@localhost:5433/saq`; в контейнерах Compose переопределяет его на host `db`, порт `5432` и ту же базу `saq`. MinIO настроен на `S3_ACCESS_KEY=saq-minio-dev`, `S3_SECRET_KEY=saq-minio-dev-secret`, `S3_BUCKET_EVIDENCE=evidence`; пример использует `EVIDENCE_LOCK_MODE=GOVERNANCE` и `EVIDENCE_RETENTION_DAYS=1`.

Перед первым запуском задайте собственный `JWT_SECRET` длиной не менее 32 символов и `INITIAL_ADMIN_PASSWORD`. В примере стоят dev-only значения (`JWT_SECRET=dev-only-change-me-0123456789abcdef0123456789abcdef`, `INITIAL_ADMIN_PASSWORD=change-me-admin-password`); не используйте их за пределами локального демо. Первый seed создаёт глобального `admin` с именем из `INITIAL_ADMIN_USERNAME` (по умолчанию `admin`); повторный запуск существующую запись не пересоздаёт. В приложении администратор может открыть `Администрирование → Пользователи` (`/admin/users`), создать сотрудника и назначить роль и территорию. Роли: `mio_officer`, `gask`, `law_enforcement` и `admin`; назначенная территория ограничивает доступные данные.

Сервис `migrate` выполняет Alembic от владельца БД и настраивает права `APP_DB_USER`. У прикладной роли нет `UPDATE`, `DELETE` и `TRUNCATE` для таблиц с защитой append-only — в том числе записей доказательств и аудита. Подробнее о настройках и запуске backend отдельно — в [руководстве разработчика](docs/DEVELOPMENT.md).

Запустите стек и заполните пустую БД вручную:

```bash
docker compose up --build --detach --wait --wait-timeout 600
docker compose exec -T api python -m app.seed --demo --if-empty
```

Дополнительные сервисы включаются отдельно и не нужны для базового демо:

- **Telegram-бот обращений:** `TELEGRAM_BOT_TOKEN` пустой по умолчанию; укажите в `.env` токен бота, созданного через [@BotFather](https://t.me/BotFather), затем выполните `docker compose --profile bot up -d bot`. Бот работает через long polling; публичный URL и webhook не требуются.
- **LLM-разбор публикаций:** `LLM_ENABLED=false` по умолчанию; при включении используется Ollama с `OLLAMA_MODEL=qwen3.5:9b-q6k`. Ollama можно запустить на хосте либо в Compose-профиле `llm-gpu` с GPU. AI-помощник настраивается отдельно через `ASSISTANT_ENABLED`, `ASSISTANT_BASE_URL`, `ASSISTANT_MODEL` и при необходимости `ASSISTANT_API_KEY`; секреты провайдера храните только в локальном `.env`.

## 5. Материалы и результаты

- **Презентация проекта:** [SAQ QURYLYS — презентация для жюри (PDF, 15 страниц)](docs/saq-qurylys.pdf).
- **Хакатон:** [Codemasters Hackathon 8.0 — страница Oskemen Hub](https://astanahub.com/ru/event/oskemen-hub-codemasters-hackathon-8-0/).
