# 📚 StudySpace

> A full-stack student productivity web app with real-time data sync, multi-user authentication, and a clean modern dashboard.

**Live Demo → [studyspace.vercel.app](https://studyspace.vercel.app)**

---

## ✨ Features

- **🔐 Authentication** — Secure sign up / sign in with email, powered by Supabase Auth
- **✅ Task Manager** — Add, complete, and delete tasks with urgency levels (urgent / warning / normal)
- **📅 Calendar** — Click any day to add events, delete with one tap
- **📖 Syllabus Tracker** — Track chapters completed per subject with progress bars
- **⏱️ Pomodoro Timer** — Focus timer with 25 / 45 / 60 min presets; study time synced to your profile
- **☁️ Real-time Cloud Sync** — All data stored in Supabase, accessible from any device
- **👥 Multi-user** — Each user gets their own private data, fully isolated

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML, CSS, JavaScript (ES Modules) |
| Auth & Database | [Supabase](https://supabase.com) (PostgreSQL + Auth) |
| Icons | [Phosphor Icons](https://phosphoricons.com) |
| Hosting | [Vercel](https://vercel.com) |

> **No framework. No build step. No Node server.** Just clean vanilla JS talking directly to Supabase.

---

## 🚀 Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/yourusername/studyspace.git
cd studyspace
```

### 2. Set up Supabase
1. Create a free project at [supabase.com](https://supabase.com)
2. Run the SQL schema below in the **SQL Editor**
3. Copy your **Project URL** and **anon key** from Project Settings → API

### 3. Add your keys
Open `script.js` and replace lines 3–4:
```js
const SUPABASE_URL  = 'https://your-project.supabase.co';
const SUPABASE_ANON = 'your-anon-key-here';
```

### 4. Run locally
Use VS Code with the **Live Server** extension, or any static file server:
```bash
npx serve .
```

---

## 🗄️ Database Schema

Run this in your Supabase SQL Editor:

```sql
-- Profiles
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  study_seconds integer default 0,
  created_at timestamp with time zone default now()
);

-- Tasks
create table tasks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  due text,
  urgency text default 'normal',
  completed boolean default false,
  created_at timestamp with time zone default now()
);

-- Subjects
create table subjects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  icon text default 'default',
  chapters_completed integer default 0,
  total_chapters integer default 1,
  topics_completed integer default 0,
  total_topics integer default 1,
  created_at timestamp with time zone default now()
);

-- Events
create table events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  date text not null,
  title text not null,
  created_at timestamp with time zone default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (new.id, new.raw_user_meta_data->>'name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Study time increment function
create or replace function increment_study_seconds(uid uuid, secs integer)
returns void as $$
  update profiles set study_seconds = study_seconds + secs where id = uid;
$$ language sql security definer;

-- Row Level Security
alter table profiles enable row level security;
alter table tasks    enable row level security;
alter table subjects enable row level security;
alter table events   enable row level security;

create policy "Own profile"  on profiles for all using (auth.uid() = id);
create policy "Own tasks"    on tasks    for all using (auth.uid() = user_id);
create policy "Own subjects" on subjects for all using (auth.uid() = user_id);
create policy "Own events"   on events   for all using (auth.uid() = user_id);
```

---

## 📁 Project Structure

```
studyspace/
├── index.html      # App shell + auth screen + all views
├── script.js       # All logic — auth, data fetching, UI rendering
└── styles.css      # Full design system — variables, layout, components
```

No build tools. No `node_modules`. No framework overhead.

---

## 🔭 Roadmap

- [ ] Notes editor with rich text
- [ ] Study streak tracking
- [ ] Dark / light mode toggle
- [ ] Mobile PWA support (installable)
- [ ] Shared study rooms

---

## 📄 License

MIT — free to use, modify, and distribute.

---

<p align="center">Built with ☕ and Supabase</p>