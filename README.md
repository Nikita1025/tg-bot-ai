# Telegram bot + local Ollama LLM

Telegram-бот на Node.js (polling mode), который работает с локальной Ollama-моделью и поддерживает переключение моделей прямо в чате.

Архитектура:
`Telegram -> Transport (Telegram) -> Service Layer -> Modules (Users / Chat / History) -> Ollama LLM`

## Что умеет бот

- принимает текстовые сообщения и отправляет их в локальную LLM;
- поддерживает выбор модели через `/models` (кнопки) и `/model <name>`;
- показывает `/start` и `/models` в Telegram command selector;
- разбивает длинные ответы на части (с учетом лимита Telegram);
- обрабатывает таймауты и ошибки недоступности LLM;
- опционально хранит контекст диалога по чатам в YAML и автоматически сжимает историю.

## Поддерживаемые модели

Список моделей задается через `OLLAMA_AVAILABLE_MODELS`.

По умолчанию в примере:
- `gemma3:1b`
- `qwen3.5:0.8b`

Модель по умолчанию для новых чатов задается через `OLLAMA_MODEL`.

## Требования

- Node.js 18+
- локально запущенный Ollama
- скачанные модели из `OLLAMA_AVAILABLE_MODELS`

## Быстрый старт

1. Установить зависимости:
```bash
npm install
```

2. Создать `.env`:
```bash
cp .env.example .env
```

3. Указать токен бота в `.env`:
```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
```

4. Скачать модели и запустить Ollama:
```bash
ollama pull gemma3:1b
ollama pull qwen3.5:0.8b
ollama serve
```

5. Запустить бота:
```bash
npm start
```

## Команды в Telegram

- `/start` - показывает текущую модель и помощь;
- `/models` - открывает inline-кнопки с доступными моделями;
- `/model <model_name>` - ручное переключение модели (например, `/model qwen3.5:0.8b`).

Важно:
- выбранная модель хранится в `USERS_STORAGE_FILE` для каждого пользователя/сессии;
- после рестарта бота выбранная модель восстанавливается из хранилища.

## Контекст диалога и сжатие истории

Контекст включается через `DIALOG_CONTEXT_ENABLED=true`.

Когда контекст включен:
- история чата сохраняется в `DIALOG_HISTORY_DIR` (`data/history` по умолчанию);
- лимит сообщений задается `DIALOG_HISTORY_MAX_MESSAGES`;
- при достижении порога `DIALOG_SUMMARY_THRESHOLD` ранняя часть истории сжимается в краткое системное резюме;
- число последних несжатых сообщений задается `DIALOG_SUMMARY_KEEP_RECENT_MESSAGES`.

Если `DIALOG_CONTEXT_ENABLED=false`, каждое сообщение обрабатывается как отдельный запрос без истории.

## Основные переменные окружения

- `TELEGRAM_BOT_TOKEN` - токен Telegram-бота (обязательно);
- `OLLAMA_BASE_URL` - адрес Ollama API (по умолчанию `http://127.0.0.1:11434`);
- `OLLAMA_AVAILABLE_MODELS` - список доступных моделей через запятую;
- `OLLAMA_MODEL` - модель по умолчанию;
- `OLLAMA_SYSTEM_PROMPT` - кастомный system prompt;
- `LLM_TIMEOUT_MS` - таймаут запроса к LLM;
- `OLLAMA_NUM_PREDICT` - ограничение длины ответа модели (опционально);
- `DIALOG_CONTEXT_ENABLED` - включение/выключение контекста диалога;
- `DIALOG_HISTORY_DIR` - папка хранения истории;
- `USERS_STORAGE_FILE` - файл хранения пользователей и выбранных моделей;
- `DIALOG_HISTORY_MAX_MESSAGES` - лимит истории в контексте;
- `DIALOG_SUMMARY_THRESHOLD` - порог запуска сжатия истории;
- `DIALOG_SUMMARY_KEEP_RECENT_MESSAGES` - сколько последних сообщений не сжимать.

## Структура проекта

```text
src/
  app.js                         # Composition root
  config/
    env.js                       # Чтение и валидация env-конфига
  transport/
    telegram/
      createTelegramBot.js       # Инициализация Telegram polling bot
      registerHandlers.js        # Команды, сообщения, callback-кнопки
      telegramSender.js          # Отправка длинных сообщений чанками
  modules/
    users/
      userRepository.js          # Хранение пользователей (telegram id / session id / модель)
      usersService.js            # Идентификация пользователя и интерфейс работы с моделью
    chat/
      llmClient.js               # Низкоуровневый клиент Ollama
      chatService.js             # Генерация ответа и summary истории
    history/
      historyRepository.js       # Хранение истории сообщений
      historyService.js          # Интерфейс истории и получение последних N сообщений
  services/
    conversationService.js       # Сервисный слой: координация Users/Chat/History
  utils/
    text.js                      # Разбиение текста по лимиту символов
index.js                         # Точка входа
```
