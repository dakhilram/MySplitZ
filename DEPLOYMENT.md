# Deploy MySplitZ

MySplitZ is a static web app that can use Firebase Firestore for shared data.

1. Create a Firebase project and register a Firebase Web App.
2. Create a Firestore database, then deploy the included `firestore.rules`.
3. Copy `.env.example` to `.env.local` and add the Firebase Web App configuration values.
4. In the GitHub repository, add the same `NEXT_PUBLIC_FIREBASE_*` values as deployment secrets or variables.
5. Enable GitHub Pages with GitHub Actions as the source.
6. Push to `main`; the **Deploy MySplitZ** workflow builds and publishes the static site.

## Important: Open Access

MySplitZ has no Firebase Authentication. Any Firestore rules that allow public access mean that someone who can reach the Firebase endpoint may be able to read or change data. Firebase web configuration is not secret. Add Firebase Authentication and stricter rules before using the app for sensitive shared data.
