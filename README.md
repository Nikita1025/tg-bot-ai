# Telegram bot + local LLM

Simple Telegram bot in polling mode.  
Each message is handled independently (no chat history is stored).

## Requirements

- Node.js 18+
- Ollama running locally
- model `gemma3:270m` available in Ollama

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from example:

```bash
cp .env.example .env
```

3. Put your Telegram bot token into `.env`:

```env
TELEGRAM_BOT_TOKEN=your_token_here
```

4. Ensure model is available:

```bash
ollama pull gemma3:270m
ollama pull qwen3.5:0.8b
ollama serve
```

## Run

```bash
npm start
```

Architecture:

`Telegram -> Bot -> LLM -> Bot -> Telegram`

## Model selection in chat

- when you type `/` in Telegram, command selector shows:
  - `/start`
  - `/models`
- `/models` opens inline buttons with available models
- model button titles are human-readable (for example: `qwen 3.5`)
- `/start` shows current model and help

Example:

```text
/models
```

Notes:
- selected model is stored only in memory per chat;
- after bot restart, model is reset to `OLLAMA_MODEL` from `.env`.

## Project structure

```text
src/
  app.js                      # Composition root (wires modules together)
  config/
    env.js                    # Reads and validates environment config
  bot/
    createTelegramBot.js      # Telegram polling bot initialization
    registerHandlers.js       # Message and polling handlers
  services/
    ollamaService.js          # Requests to local Ollama LLM
    telegramSender.js         # Safe sending of long Telegram messages
  utils/
    text.js                   # Text chunking helpers
index.js                      # Entry point
```
