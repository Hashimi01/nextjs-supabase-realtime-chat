<div align="center">
  
# 💬 Real-Time Chat Workspace

**A highly-scalable, low-latency, self-hosted communication platform.**

[![Next.js version](https://img.shields.io/badge/Next.js-14.x-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database_&_Auth-43a047?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![React](https://img.shields.io/badge/React-18-61dafb?style=for-the-badge&logo=react)](https://react.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

[Features](#-features) •
[Architecture](#-architecture) •
[Getting Started](#-getting-started) •
[Documentation](#-documentation) •
[Deploy](#-deploy) •
[Contributing](#-contributing)

</div>

---

## 🚀 Overview

**Real-Time Chat Workspace** is a unified communication platform designed for speed, privacy, and seamless collaboration. Built on top of Next.js and Supabase, it provides an immediate out-of-the-box realtime chatting experience with powerful capabilities like multimedia sharing, offline support, email notifications, and instant direct messaging.

Whether you're building a community forum, an internal company collaboration tool, or integrating chat into your SaaS, this application offers the secure architecture and flexible UI you need.

## ✨ Features

- ⚡ **Lightning-Fast Realtime Sync:** Powered by Supabase Realtime via PostgreSQL, giving you broadcast capabilities and sub-second message delivery.
- 🔐 **Robust Authentication:** Secure email and password authentication out-of-the-box leveraging Supabase Auth.
- 🗣️ **Public Rooms & Direct Messaging:** Support for global public lounges and one-on-one encrypted direct communication channels.
- 📎 **Rich Media Support:** Secure, scalable file and image uploads using Cloudinary or native Supabase Storage buckets.
- 🎤 **Audio Voice Notes:** Built-in microphone recording, audio previews, and resilient cross-browser audio playback.
- 📧 **Automated Email Notifications:** Delivery of offline Direct Message alerts utilizing an SMTP integration (Nodemailer).
- 🌍 **Internationalization (i18n):** Full support for English (LTR) and Arabic (RTL) locales out of the box with zero stuttering.
- 🎨 **Modern Glass-morphism UI:** Built with Framer Motion and custom CSS design tokens for a beautiful, responsive dark-mode forward interface.

## 🏗 Architecture

We adhere to a decoupled, high-performance web architecture focused on scalability:

| Component | Technology | Purpose |
| --- | --- | --- |
| **Frontend Framework** | [Next.js](https://nextjs.org) | Pages Router, SSR capabilities, and serverless API endpoints |
| **UI Library** | [React](https://reactjs.org/) | Declarative component management |
| **Animations** | [Framer Motion](https://www.framer.com/motion/) | Smooth UI transitions and micro-interactions |
| **Database & Realtime** | [Supabase Postgres](https://supabase.com) | Centralized state, RLS security policies, real-time web socket broadcasting |
| **Storage** | [Cloudinary](https://cloudinary.com) / Supabase | Optimized media delivery pipeline |
| **Mail Services** | [Nodemailer](https://nodemailer.com) | Transactional email orchestration over SMTP |

## 📦 Getting Started

### Prerequisites

Identify the underlying system requirements you need to install and configure:
- **Node.js** `>= 20.9.0`
- **npm** or **yarn**
- A **Supabase** Project (Create one [here](https://database.new) for free)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/realtime-chat-workspace.git
   cd realtime-chat-workspace
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Configure Environment Variables:**
   Copy the provided configuration template:
   ```bash
   cp .env.example .env.local
   ```
   *Populate the newly created `.env.local` file with your specific credentials. Refer to [ENV_EXAMPLE.md](ENV_EXAMPLE.md) for detailed instructions.*

4. **Initialize Database Schema:**
   You must structure your database. Navigate to the SQL Editor in your Supabase Dashboard and run the entire contents of [`database.sql`](database.sql).
   *For deep-dives on RLS and table definitions, refer to [DATABASE_SETUP.md](DATABASE_SETUP.md).*

5. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   The application will become available locally at [http://localhost:3000](http://localhost:3000).

## 📚 Documentation

Detailed guides are available to help you configure specific system domains:

- 🗄️ **[Database Setup](DATABASE_SETUP.md)** - Learn about PostgreSQL Schema, Row Level Security (RLS) policies, and triggers.
- 📡 **[Realtime Setup](REALTIME_SETUP.md)** - Instructions on turning on logical replication and database websockets.
- ☁️ **[Storage Config (Cloudinary)](CLOUDINARY_SETUP.md)** - Setup highly scalable media pipelines.
- 📦 **[Storage Config (Supabase)](STORAGE_SETUP.md)** - Alternative media storage utilizing Supabase Buckets.
- 🐛 **[Troubleshooting Guide](TROUBLESHOOTING.md)** - Solutions for common connectivity or permission bottlenecks.

## 🚢 Deploy

The easiest way to deploy your Real-Time Chat Workspace is through the [Vercel Platform](https://vercel.com/new).

1. Push your code to your GitHub/GitLab repository.
2. Import your project into Vercel.
3. Add your Environment Variables found in `.env.local` to the Vercel project settings.
4. Click **Deploy**.

## 🤝 Contributing

We welcome contributions of all forms, from bug reports to architectural enhancements. 

1. **Fork the Repository**
2. **Create a Feature Branch:** `git checkout -b feature/AmazingFeature`
3. **Commit your Changes:** `git commit -m 'Add some AmazingFeature'`
4. **Push to the Branch:** `git push origin feature/AmazingFeature`
5. **Open a Pull Request**

Please make sure to review our `.eslintrc.json` rules before committing.

## 📄 License

This project is distributed under the underlying MIT License. For further information, strictly consult the [LICENSE](LICENSE) file located centrally within the directory.

---
<div align="center">
  <b>Built with ❤️ by the open-source community.</b>
</div>
