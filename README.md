# Saidhara NDC Visitor & Asset Management System

Next.js + Firebase portal for Main Admin Office and NDC locations: I, J, K, L, O, P, Q, R, S, T and H14 (MHE).

## Security model
Admin Office users can view/manage all locations. Security users are bound to one location in Firestore and can only create/view/update records for that location. Firestore rules enforce this boundary server-side.

## First Firebase bootstrap
1. Enable Email/Password Authentication.
2. Create the first admin account in Firebase Authentication.
3. In Firestore create users/{ADMIN_UID} with role "admin", locationId "ADMIN", name, email, active true.
4. Deploy firestore.rules and storage.rules.
5. Log in and use Settings > Security Desks to create location-bound security accounts.

## Vercel environment variables
Add the six NEXT_PUBLIC_FIREBASE_* variables from the same Firebase web app used by the Saidhara CRM. Do not commit .env.local.

## Collections
users, locations, settings, visitors, assets, gatePasses, auditLogs.

## Deployment
Connect this repository to Vercel. Vercel detects Next.js automatically; use the default build command next build.