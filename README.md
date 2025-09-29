# Synergy ID Repository

A modern web application to manage and browse ID profiles for staff, students, and parents, powered by React, Vercel, and the Gemini API.

## Features

-   **Categorized Profiles**: Create and manage profiles for Staff, Students, and Parents.
-   **Dynamic Bio Generation**: Uses the Gemini API to automatically generate a professional bio for each new profile.
-   **Profile Associations**: Link students to their guardians (existing or newly created).
-   **Sibling Link**: Easily associate guardians from a known sibling to a new student.
-   **Persistent Storage**: Data is stored securely in a Vercel Postgres database.
-   **Modern UI**: A clean, responsive interface built with React and Tailwind CSS.

## Tech Stack

-   **Frontend**: React, Vite, Tailwind CSS
-   **Backend**: Hono on Vercel Serverless Functions
-   **Database**: Vercel Postgres
-   **AI**: Google Gemini API

---

## Local Development Setup

Follow these steps to get the project running on your local machine.

### 1. Prerequisites

-   Node.js (v18 or later)
-   `pnpm`, `npm`, or `yarn` for package management
-   A Vercel account with a Postgres database created.
-   A Google Gemini API Key.

### 2. Installation

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd synergy-id-repository
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

### 3. Environment Variables

1.  **Create an environment file:**
    Duplicate the `.env.example` file and rename it to `.env`.

    ```bash
    cp .env.example .env
    ```

2.  **Fill in the variables:**
    Open the `.env` file and add your credentials. You can find the Postgres connection strings in your Vercel project dashboard.

    ```ini
    # Vercel Postgres Connection String (get from Vercel dashboard)
    POSTGRES_URL="postgres://..."

    # Google Gemini API Key (get from Google AI Studio)
    API_KEY_ALIAS_FOR_GEMINI="your_gemini_api_key"
    ```

### 4. Database Setup

Run the setup script to create the necessary table in your Vercel Postgres database and seed it with initial data.

```bash
npm run db:setup
```

### 5. Running the Development Server

Start the Vite development server. This will also proxy any requests to `/api/*` to your serverless function running locally.

```bash
npm run dev
```

The application should now be running at `http://localhost:5173`.

---

## Deployment to Vercel

This project is configured for seamless deployment to Vercel.

1.  **Push to a Git Repository:**
    Ensure your project is pushed to a GitHub, GitLab, or Bitbucket repository.

2.  **Import Project on Vercel:**
    -   Log in to your Vercel dashboard.
    -   Click "Add New..." -> "Project".
    -   Import the Git repository you just pushed.

3.  **Configure Environment Variables:**
    -   During the import process, Vercel will prompt you to add Environment Variables.
    -   Copy the keys and values from your local `.env` file (`POSTGRES_URL` and `API_KEY_ALIAS_FOR_GEMINI`). Vercel will automatically link your Postgres database if you created it under the same account.
    -   Click "Deploy".

Vercel will automatically build your frontend, deploy your API functions, and provide you with a live URL.
