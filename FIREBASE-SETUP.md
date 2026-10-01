# Firebase setup (optional: login, cloud save, leaderboard)

1. https://console.firebase.google.com > Add project (free Spark plan is enough).
2. Build > Authentication > Get started > enable **Email/Password** and **Anonymous**.
   (Usernames are stored as `username@sooperranga.app` behind the scenes, so no real email is needed.)
3. Build > Firestore Database > Create database (production mode), then open **Rules** and paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == uid;
    }
    match /scores/{level}/entries/{uid} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```
4. Project settings > Your apps > Web (</>) > copy the config object into `firebase-config.js`.
5. Authentication > Settings > Authorized domains: add `YOURNAME.github.io`.

Leave `apiKey` empty to keep the game fully offline.
