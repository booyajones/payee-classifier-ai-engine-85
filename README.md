# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/aa593c27-4290-4aba-a8b2-135ff8cd3602

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/aa593c27-4290-4aba-a8b2-135ff8cd3602) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/aa593c27-4290-4aba-a8b2-135ff8cd3602) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

## Classification configuration

The payee classifier exposes several options through the `ClassificationConfig`
interface defined in `src/lib/types.ts`. Default values are provided in
`src/lib/classification/config.ts`.

| Option | Description |
| ------ | ----------- |
| `aiThreshold` | Minimum confidence required for rule‑based or NLP results before AI processing is triggered. |
| `bypassRuleNLP` | Skip rule‑based and NLP checks and go straight to AI. |
| `useEnhanced` | Enable advanced classification logic. |
| `offlineMode` | Disable API calls and rely solely on local heuristics. |
| `useFuzzyMatching` | Apply fuzzy name matching when deduplicating batch input. |
| `useCacheForDuplicates` | Cache results for repeated names in a batch. |
| `similarityThreshold` | Threshold used by fuzzy matching utilities. |
| `retryFailedClassifications` | Attempt retries for failed AI calls. |
| `maxRetries` | Maximum number of retry attempts. |

Additional constants in `config.ts` include `MAX_CONCURRENCY` for controlling
the number of concurrent classification requests and `MAX_BATCH_SIZE` for
limiting batch size. The OpenAI client settings in `openai/config.ts` expose
`DEFAULT_API_TIMEOUT` (20&nbsp;seconds by default) which defines how long the
system waits for each API response. You can override this timeout by setting the
`OPENAI_TIMEOUT_MS` environment variable or by passing a `timeout` parameter to
the classification functions.

## Running Tests

To run the unit tests locally:

```sh
npm install
npm test
```

The tests execute in offline mode, so no API keys or other environment
variables are required. If you later enable online mode, you can optionally set
`OPENAI_TIMEOUT_MS` to customize the API timeout.

Increasing `aiThreshold` means rule‑based and NLP results must be more confident
before the AI model is called. A higher threshold typically improves accuracy at
the cost of additional API usage and slower processing. Likewise, extending
`DEFAULT_API_TIMEOUT` allows more time for the API to respond, reducing timeout
errors but making each classification call take longer if the service is slow.
