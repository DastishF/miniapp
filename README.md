# 🎙️ Atrium Task — AI-Powered Voice Task Manager

> **An enterprise-grade, asynchronous voice-to-task management system for Telegram Mini Apps with real-time React dispatch dashboard, powered by Google Gemini API and Offline-First architecture.**

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Telegram](https://img.shields.io/badge/Telegram_Mini_App-229ED9?style=for-the-badge&logo=telegram&logoColor=white)](https://core.telegram.org/bots/webapps)
[![Gemini AI](https://img.shields.io/badge/Google_Gemini_API-8E75B2?style=for-the-badge&logo=googlecloud&logoColor=white)](https://ai.google.dev/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

---

## 🌟 Overview

**Atrium Task** solves the "busy hands" problem for field workers, engineers, and construction crews. Instead of filling out complex forms in Jira or Bitrix24, workers simply press record in a **Telegram Mini App** and describe an issue via voice.

The system streams raw audio to the Node.js backend, transcribes speech, extracts structured task metadata (priority, deadlines, assigned category, tags) using **Google Gemini LLM**, performs **semantic deduplication via cosine similarity**, and instantly pushes the new card to a real-time **React Kanban board** via WebSockets.

---

## ✨ Key Features

- **📱 Telegram Mini App Client:** Zero-install mobile UI built with React & HTML5 AudioRecorder API.
- **⚡ In-Memory Audio Processing:** Streaming `Ogg Opus` audio conversion to `PCM Mono 16kHz` via FFmpeg sub-processes without disk I/O bottlenecks.
- **🧠 Generative AI Pipeline:** Powered by Google Gemini API with strict JSON schema sanitization and Prompt Injection protection.
- **🎯 Semantic Deduplication (Cosine Similarity):** Calculates vector embeddings ($d=768 / 1536$) to detect duplicate incident reports ($\cos(\theta) \ge 0.82$) and attach audio to existing tasks.
- **🔄 Low-Latency React Dispatcher Dashboard:** Real-time Kanban board driven by Firebase Firestore WebSocket streams (`onSnapshot`).
- **📶 Offline-First Support:** IndexedDB hydration on the client side ensuring zero data loss in poor connectivity areas.
- **🐳 Enterprise Observability & Security:** Built-in distributed tracing (`correlationId`), Redis rate limiting, SHA-256 HMAC webhook verification, and Docker-compose setup.

---

## 🏗️ Architecture Overview
[ Field Worker (Telegram Mini App) ]
│
(Binary Audio Stream)
▼
[ Node.js Express Gateway (TypeScript) ]
├── Ingress Rate Limiter & Security (Redis / HMAC)
├── FFmpeg In-Memory Audio Transcoder
├── Speech-to-Text Pipeline
├── AI Engine Service (Google Gemini Vector Extraction)
└── Cosine Similarity Deduplicator
│
(WebSocket / OnSnapshot)
▼
[ Dispatcher React Web Dashboard ] <───> [ Firebase Firestore DB ]
---

## 🛠️ Tech Stack

### **Backend & AI Pipeline**
* **Runtime:** Node.js, Express.js (TypeScript)
* **AI & NLP:** Google Gemini API, Text Embeddings, Custom Regex Sanitizer
* **Audio Processing:** FFmpeg (In-memory streams)
* **Data & Cache:** Google Firebase / Cloud Firestore, Redis
* **Logging:** Winston, Custom Distributed Tracing Service

### **Frontend & Client**
* **Framework:** React.js, Vite, TypeScript
* **State & Sync:** Real-time Firestore SDK (`onSnapshot`), IndexedDB (Dexie.js / LocalForage)
* **Container:** Telegram WebApps SDK

---

## 🚀 Quick Start (Local Development)

### **Prerequisites**
- Node.js `v18+` or `v20+`
- Docker & Docker Compose
- FFmpeg installed locally (if running outside Docker)
- Telegram Bot Token & Google Gemini API Key

### **1. Clone the Repository**
```bash
git clone [https://github.com/YOUR_USERNAME/atrium-task.git](https://github.com/YOUR_USERNAME/atrium-task.git)
cd atrium-task

PORT=5000
NODE_ENV=development

# Telegram Credentials
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# AI Services
GEMINI_API_KEY=your_google_gemini_api_key

# Firebase / Database
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_PRIVATE_KEY="your_private_key"

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

docker-compose up --build
