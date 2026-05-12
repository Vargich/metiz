# Security Specification - Метиз Электрод

## Data Invariants
1. A user can only access their own profile and orders.
2. Products are public for reading, but restricted for writing (admin only).
3. Orders must have a valid `userId` matching the creator's ID.
4. Order structure must include items, total, and status.

## The Dirty Dozen Payloads
1. **P1 (Identity Spoofing)**: Attempt to create an order for `user_B` while authenticated as `user_A`.
2. **P2 (Privilege Escalation)**: Attempt to update `users/user_A` to add an `isAdmin: true` field.
3. **P3 (Malicious Price)**: Attempt to update a product price to `0` or negative value.
4. **P4 (Shadow Field)**: Attempt to create a user profile with hidden `role: 'admin'` field.
5. **P5 (PII Leak)**: Attempt to read all users in the `/users/` collection as an anonymous user.
6. **P6 (State Shortcutting)**: Attempt to update an order status directly to `completed` bypassing `processing`.
7. **P7 (Resource Poisoning)**: Attempt to create a product with a 1MB string in the `name` field.
8. **P8 (Orphaned Order)**: Attempt to create an order with a non-existent `userId`.
9. **P9 (Terminal State Hack)**: Attempt to update an order after its status is `completed`.
10. **P10 (ID Poisoning)**: Attempt to target a document with an ID like `../../secrets`.
11. **P11 (Query Scrape)**: Attempt to list all orders without a `where` filter on `userId`.
12. **P12 (Time Forgery)**: Attempt to set `createdAt` to a future date instead of `request.time`.

## Test Runner (Logic Check)
- `users`: `allow get: if isOwner(userId); allow list: if false;`
- `products`: `allow read: if true; allow write: if isAdmin();`
- `orders`: `allow create: if isOwner(incoming().userId); allow list: if isOwner(resource.data.userId);`
