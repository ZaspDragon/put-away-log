# Put Away Log - GitHub Pages + Firebase

This app is a mobile-friendly shared put away log for temporary workers and leads.

## Features
- Email/password sign-in with Firebase Authentication
- Worker dropdown
- Date field
- 8 put away lines per log
- Item Number / Quantity / Location / Notes
- Real-time shared logs with Firestore
- Admin area to add/remove worker names from dropdown
- CSV export

## Files
- `index.html`
- `style.css`
- `app.js`

## Firebase setup overview
1. Create a Firebase project.
2. Enable **Authentication > Email/Password**.
3. Create **Cloud Firestore** in production mode.
4. Add a **Web App** in Firebase and copy the config into `app.js`.
5. Create user accounts in **Authentication** for admins, leads, and temps.
6. In Firestore, create a `users` collection with one document per Firebase Auth UID:

Example `users/{uid}` document:
```json
{
  "email": "lead@example.com",
  "role": "admin",
  "active": true,
  "displayName": "Lead User"
}
```

## Firestore collections used
### `users`
Controls app access and role.
- `role`: `admin`, `lead`, or `worker`
- `active`: `true` or `false`

### `employees`
Controls the worker dropdown.
- `name`
- `active`
- `createdAt`

### `putAwayLogs`
Stores submitted logs.
- `workerName`
- `workDate`
- `lines` array
- `submittedByUid`
- `submittedByEmail`
- `createdAt`

## Suggested Firestore rules
Paste rules like these into Firestore Rules and adjust if needed:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() {
      return request.auth != null;
    }

    function userDoc() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid));
    }

    function isActive() {
      return signedIn() && userDoc().data.active == true;
    }

    function isLeadOrAdmin() {
      return isActive() && (userDoc().data.role == 'lead' || userDoc().data.role == 'admin');
    }

    match /users/{userId} {
      allow read: if isActive();
      allow write: if false;
    }

    match /employees/{employeeId} {
      allow read: if isActive();
      allow create, update: if isLeadOrAdmin();
      allow delete: if false;
    }

    match /putAwayLogs/{logId} {
      allow read: if isActive();
      allow create: if isActive();
      allow update, delete: if false;
    }
  }
}
```

## Authentication tip
To remove a temp completely:
- Disable or delete their Firebase Authentication user.
- Also set `users/{uid}.active = false`.

## GitHub Pages deployment
1. Create a GitHub repo.
2. Upload these files.
3. Go to **Settings > Pages**.
4. Set source to **Deploy from a branch**.
5. Choose **main** branch and **/root**.
6. Save.

Your page will publish in about a minute.
