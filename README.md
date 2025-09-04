# Valerio Narcisi's Blog

Welcome to the repository for my personal blog! This project is built using the **Astro** framework, focusing on a modern, content-first approach to web development. It's designed to be fast, accessible, and easy to maintain.

---

### Features

* **Astro Framework**: A modern static site builder that provides excellent performance and a great developer experience.
* **Hygraph CMS**: All blog content is managed through a headless Hygraph CMS, providing a flexible and powerful GraphQL API.
* **Netlify Deployment**: Configured for continuous deployment on Netlify, automatically building and deploying new changes pushed to the `main` branch.
* **pnpm Package Manager**: The project uses `pnpm` for fast, space-efficient dependency management, as specified in the `netlify.toml` and `package.json` files.
* **ESLint and Prettier**: Maintain code quality and consistent formatting with pre-configured ESLint and Prettier.
* **TypeScript Support**: Enjoy type safety and autocompletion throughout the project with a robust TypeScript configuration.

---

### Hygraph as a CMS

This project uses **Hygraph** (formerly GraphCMS) as its content management system. As a headless CMS, Hygraph provides a low-code interface for managing content, which is then delivered to this Astro site via a **GraphQL API**.

The main benefit of this approach is the complete separation of content from presentation. This allows for a flexible and dynamic publishing workflow, where content can be created and updated independently of the website's codebase. During the build process, Astro fetches all the necessary content from Hygraph to generate the static pages.

---

### Getting Started

To get a local copy up and running, follow these simple steps.

#### Prerequisites

You'll need to have Node.js and `pnpm` installed on your machine.

* **Node.js**: Make sure you have a recent version (e.g., 18 or later).
* **pnpm**: If you don't have it, you can install it via npm:
    ```bash
    npm install -g pnpm
    ```

#### Installation

1.  Clone the repository:
    ```bash
    git clone [https://github.com/jey-y/portfolio_n.git](https://github.com/jey-y/portfolio_n.git)
    cd portfolio_n
    ```
2.  Install the project dependencies using pnpm:
    ```bash
    pnpm install
    ```

#### Development Server

Run the development server to see your changes in real-time. This command will start the server and open the project in your browser.
```bash
pnpm dev