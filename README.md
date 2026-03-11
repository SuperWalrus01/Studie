# Study Planner

A lightweight React + TypeScript study planner with spaced repetition for managing exams, topics, and subtopics. Data is stored in Supabase.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up Supabase:**
   - Create a new Supabase project at https://supabase.com
   - Run the SQL from `SUPABASE_SETUP.sql` in your Supabase SQL Editor
   - This will create the database tables and seed with sample data

3. **Configure environment variables:**
   - Copy `.env.example` to `.env.local`
   - Add your Supabase URL and anon key:
     ```
     VITE_SUPABASE_URL=your_supabase_project_url
     VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
     ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

## Features

- **Exam Management**: Track multiple exams with dates and progress
- **Topic Organization**: Break down exams into topics with difficulty ratings
- **Subtopic Tracking**: Organize topics into subtopics with status tracking
- **Spaced Repetition**: Built-in algorithm schedules topic reviews based on performance
- **Today's Plan**: Smart recommendations for what to study based on due dates and priorities
- **Confidence Tracking**: Rate your confidence level for each topic

## Database Structure

The app uses 4 normalized tables:
- `exams` - Exam information (name, date)
- `topics` - Topics with spaced repetition fields (interval, ease, next review)
- `subtopics` - Subtopics with status (not_started, in_progress, understood)
- `review_entries` - History of review sessions

All tables use UUID primary keys and foreign key constraints with CASCADE deletes.

## Tech Stack

- React 18 + TypeScript
- Vite for build tooling
- React Router for navigation
- Supabase for database
- date-fns for date utilities
- Plain CSS for styling (lightweight, no frameworks)


Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
