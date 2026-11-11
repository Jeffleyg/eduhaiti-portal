import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    // Page tests are slow under parallel coverage instrumentation.
    testTimeout: 15000,
    include: ['src/**/*.test.{js,jsx,ts,tsx}'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text', 'html'],
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: [
        'src/main.jsx',
        'src/test/**',
        'src/**/*.test.{js,jsx,ts,tsx}',
        'src/locales/**',
        'src/**/*.native.js',
        // Not imported anywhere in the app (kept in the repo, excluded from the
        // coverage target). Re-include a file here once it is wired in.
        'src/pages/admin/AdminClasses.jsx',
        'src/pages/student/StudentHomework.jsx',
        'src/pages/auth/Signup.jsx',
        'src/pages/EXAMPLE_StudentManagement.jsx',
        'src/pages/professor/TeacherAttendance.jsx',
        'src/pages/professor/TeacherGrades.jsx',
        'src/components/dialog/FormDialog.jsx',
        'src/hooks/useFormField.js',
        'src/context/useSafeApiFetch.js',
        'src/lib/fileUploadService.js',
        'src/lib/ptTranslations.js',
        'src/data/mockData.js',
        'src/offline/sync/**',
      ],
      thresholds: {
        lines: 100,
        statements: 100,
        functions: 100,
        branches: 90,
      },
    },
  },
})
