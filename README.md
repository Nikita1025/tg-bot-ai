# Telegram bot + local Ollama LLM

Telegram-бот на Node.js (polling mode), который работает с локальной Ollama-моделью и поддерживает переключение моделей прямо в чате.

Архитектура:
`Telegram -> Bot -> Ollama LLM -> Bot -> Telegram`

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
- выбранная модель хранится в памяти отдельно для каждого чата;
- после рестарта бота модель сбрасывается на `OLLAMA_MODEL`.

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
- `OLLAMA_NUM_PREDICT` - ограничение длины ответа модели (опционально).

## Структура проекта

```text
src/
  app.js                         # Composition root
  config/
    env.js                       # Чтение и валидация env-конфига
  bot/
    createTelegramBot.js         # Инициализация Telegram polling bot
    registerHandlers.js          # Команды, сообщения, callback-кнопки
  services/
    ollamaService.js             # Запросы в Ollama /api/chat и /api/tokenize
    dialogHistoryService.js      # Хранение истории диалогов в YAML
    historyCompressionService.js # Сжатие старой истории в summary
    telegramSender.js            # Отправка длинных сообщений чанками
  utils/
    text.js                      # Разбиение текста по лимиту символов
index.js                         # Точка входа
```
