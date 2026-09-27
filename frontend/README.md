# CampusSage AI Frontend

CampusSage AI is a React + Vite frontend for a personal academic assistant built around student-owned documents, timetable data, reminders, and an AI chat experience.

## Scripts

- `npm run dev` - start the local development server
- `npm run build` - create a production build
- `npm run preview` - preview the production build

## Data Storage

The frontend stores student profile data, chat history, timetable entries, notices, study plans, settings, and document metadata in `localStorage` until a backend is connected.

Notes about imported documents:

- Document metadata (name, type, size, status, tags) is saved in browser `localStorage` under the key `campussage-documents`.
- The current implementation does NOT persist raw file contents to the backend or IndexedDB — only lightweight metadata is saved. Imported files are represented in the UI and can be processed later when a backend or file store is added.
- To persist full file contents across devices, connect the frontend to a backend file-storage API or extend the client to store files in `IndexedDB`.
