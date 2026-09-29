# Prova — AI-Powered Smart Interview Platform
منصة "بروفا" الذكية لإجراء مقابلات العمل بالذكاء الاصطناعي لكافة التخصصات والمهن

Designed & Developed by **Eng. Mohamed Saad**

---

## 🌟 Overview / نظرة عامة
**Prova** is a next-generation AI interview rehearsal platform. It adapts to candidates across all career fields (Medicine, Engineering, Law, Finance, Education, Sales, Tech, etc.) by analyzing their uploaded resume (CV), generating personalized questions, conducting real-time spoken voice interviews with realistic human-like persona responses, and providing comprehensive instant evaluation reports.

---

## 🚀 Key Features / المميزات الرئيسية
- 🎙️ **Live Voice Interviews**: Real-time spoken interviews powered by Google Gemini AI & Cartesia Sonic Voice (<150ms latency).
- 👔 **Realistic Personas**:
  - **Ahmed**: Senior Technical & Domain Lead (Hard skills & practical challenges).
  - **Sara**: HR & People Lead (Soft skills, culture fit, leadership & behavioral questions).
- 📄 **Universal CV Intelligence**: Automated PDF text parsing and AI CV generation/optimization.
- 📊 **Detailed Evaluation Reports**: Instant ATS pass score, strengths, constructive feedback, and sample ideal answers.
- 🛡️ **Super Admin Control Center**: Live analytics, interview monitoring, user management, and AI engine controls.
- 🌐 **Full Dual-Language Support**: Complete Arabic (RTL) & English (LTR) localization.
- ⚡ **Zero-Latency Client-Side Build**: Optimized Vite bundle with manual vendor chunking and fast asset delivery.

---

## 🛠️ Tech Stack / التقنيات المستخدمة
- **Frontend**: React 19, Vite 8, React Router v7, Framer Motion, Three.js / React Three Fiber, FontAwesome, TailwindCSS v4.
- **Backend & Database**: Supabase (PostgreSQL, Auth, Row-Level Security, Realtime, Storage).
- **Serverless API**: Node.js serverless functions (Vercel compatible in `/api`).
- **AI & Speech**: Google Gemini Generative AI, Cartesia Sonic API, Microsoft Edge Neural TTS.

---

## ⚙️ Environment Variables / إعداد متغيرات البيئة
Create a `.env` file in the root directory (refer to `.env.example`):

```bash
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key
VITE_GEMINI_API_KEY=your_gemini_api_key

# Cartesia Sonic AI Voice (Optional for ultra-fast voice)
CARTESIA_API_KEY=your_cartesia_api_key
VITE_CARTESIA_API_KEY=your_cartesia_api_key
```

---

## 💻 Local Development / التشغيل المحلي
```bash
# Install dependencies
npm install

# Run Vite development server
npm run dev

# Build production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## ☁️ Deployment on Vercel / الرفع على فيرسل
1. Push this repository to your **GitHub** account.
2. Sign in to [Vercel](https://vercel.com) and click **"Add New Project"**.
3. Import your GitHub repository (`prova`).
4. Select **Vite** as the Framework Preset (Vercel automatically detects `vercel.json`).
5. In **Environment Variables**, paste the variables from your `.env` (Supabase, Gemini, Cartesia).
6. Click **Deploy**. Your platform will be live with full SPA routing and serverless `/api` support!

---

## 📄 License
All rights reserved © 2026 **Prova**. Developed by **Eng. Mohamed Saad**.
