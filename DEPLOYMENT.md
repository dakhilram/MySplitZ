# Deploy MySplitZ
MySplitZ is a static web app that can use Firebase Firestore for shared data.

1. Create a Firebase project and register a Firebase Web App.
2. Create a Firestore database, then deploy the included `firestore.rules`.
3. Copy `.env.example` to `.env.local` and add the Firebase Web App configuration values.
4. In the GitHub repository, add the same six values as **repository variables**: `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, and `NEXT_PUBLIC_FIREBASE_APP_ID`. Do not add real values to tracked files.
5. Enable GitHub Pages with GitHub Actions as the source.
6. Push to `main`; the **Deploy MySplitZ** workflow builds and publishes the static site.

Local development runs at `http://localhost:3000/`. After a successful deployment, the expected GitHub Pages address is `https://dakhilram.github.io/MySplitZ/`.

The GitHub workflow does not deploy Firestore rules. Deploy `firestore.rules` manually from the Firebase CLI or Firebase Console.

## Important: Open Access

MySplitZ has no Firebase Authentication. Any Firestore rules that allow public access mean that someone who can reach the Firebase endpoint may be able to read or change data. Firebase web configuration is not secret. Add Firebase Authentication and stricter rules before using the app for sensitive shared data.
