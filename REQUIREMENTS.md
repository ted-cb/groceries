# Grocery List Manager — Requirements Document

**Version:** 1.2  
**Date:** June 17, 2026  
**Status:** Draft

---

## 1. Overview

### 1.1 Purpose

This document defines the functional and non-functional requirements for a grocery list management application. The app allows authenticated users to create and maintain multiple grocery lists, organize items by category, add and edit items, mark items as purchased (crossed off), and access their data from any device via cloud sync.

### 1.2 Problem Statement

People often shop from more than one list at a time (e.g., weekly staples, a dinner party, a pharmacy run). Paper lists and generic note apps make it hard to manage multiple lists, update items quickly, organize items by store aisle, and track what has already been picked up while shopping — especially when switching between a phone in-store and a laptop at home.

### 1.3 Goals

- Let users manage **multiple independent grocery lists** tied to their account
- Organize items by **categories** (aisles) for faster in-store shopping
- Make it fast to **add**, **edit**, and **check off** items while shopping
- Keep list and item changes simple and reversible
- **Sync data across devices** so lists are always up to date
- Deliver as a **responsive web app** usable on phone and desktop

### 1.4 Platform (v1)

| Decision | Choice |
|----------|--------|
| Platform | Responsive **web application** |
| Native mobile apps | Post-MVP |
| Authentication | **Required** — users must log in to access lists |
| Data storage | Cloud-backed, synced per user account |
| Sync strategy (v1) | **Refresh on load** — fetch latest data on login, page load, and navigation; no live polling or WebSockets |

### 1.5 Out of Scope (v1)

The following are explicitly **not** required for the initial release:

- Shared lists / multi-user collaboration on the same list
- Store price lookup or budgeting
- Barcode scanning
- Recipe integration
- Automatic reorder suggestions based on purchase history
- Native iOS / Android apps
- Social login only (email/password is sufficient for v1; OAuth is Could)
- **Password reset** (planned for v1.1)
- **Real-time sync** (WebSockets, polling while app is open — planned post-v1)

---

## 2. Users & Use Cases

### 2.1 Primary User

A household shopper who creates lists before shopping, organizes items by aisle, and uses the app in-store on their phone to check items off. They may also manage lists from a desktop browser at home.

### 2.2 Core Use Cases

| ID | Use Case | Description |
|----|----------|-------------|
| UC-01 | Register an account | New user creates an account with email and password |
| UC-02 | Log in | Returning user authenticates and accesses their lists |
| UC-03 | Log out | User ends their session on the current device |
| UC-04 | Create a list | User creates a new grocery list with a name |
| UC-05 | View all lists | User sees all their lists and basic status (item count, checked count) |
| UC-06 | Open a list | User opens a list to view and manage its items |
| UC-07 | Add an item | User adds one or more items to a list, optionally assigning a category |
| UC-08 | Edit an item | User changes an item’s name, quantity, category, or notes |
| UC-09 | Check off an item | User marks an item as purchased (crossed off) |
| UC-10 | Uncheck an item | User reverses a checked-off item |
| UC-11 | Edit a list | User renames a list or changes list-level settings |
| UC-12 | Delete an item | User removes an item from a list |
| UC-13 | Delete a list | User permanently removes a list and all its items |
| UC-14 | Reorder items | User drag-and-drops items to change order within a category |
| UC-15 | Assign category | User assigns or changes the category on an item |
| UC-16 | Manage categories | User views, creates, renames, drag-and-drop reorders, or deletes custom categories |
| UC-17 | Sync across devices | User opens the app on a second device and sees the same lists and items |

---

## 3. Functional Requirements

### 3.1 Authentication & Accounts

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-A-01 | Users shall **register** with email and password | Must |
| FR-A-02 | Users shall **log in** with email and password | Must |
| FR-A-03 | Users shall **log out** from the current device | Must |
| FR-A-04 | Passwords shall be stored securely (hashed; never plaintext) | Must |
| FR-A-05 | Unauthenticated users shall not access list data (redirect to login) | Must |
| FR-A-06 | Each list and item shall belong to exactly one user account | Must |
| FR-A-07 | Users shall only see and modify their own data | Must |
| FR-A-08 | Sessions shall persist across browser restarts (remember me / refresh token) | Must |
| FR-A-09 | Registration shall validate email format and minimum password strength | Must |
| FR-A-10 | Duplicate email registration shall be rejected with a clear error | Must |

### 3.2 Sync & Multi-Device

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-S-01 | All list, item, and category changes shall be **persisted to the server** | Must |
| FR-S-02 | Changes made on one device shall appear on other devices **without manual export/import** | Must |
| FR-S-03 | After login on any device, the user shall see their full current data | Must |
| FR-S-04 | v1 shall use **refresh-on-load** sync: fetch latest server data on login, initial page load, and navigation between major views | Must |
| FR-S-05 | Real-time sync (WebSockets, background polling) shall **not** be required for v1 | Must |
| FR-S-06 | When the user opens or returns to the app, data shall refresh to the latest server state | Must |
| FR-S-07 | Concurrent edits from two devices shall not corrupt data (last-write-wins per field acceptable for v1) | Must |
| FR-S-08 | The UI shall indicate save/sync status for writes (saved, saving, error) | Should |
| FR-S-09 | Failed writes shall be retried and surfaced to the user if they cannot be saved | Should |

### 3.3 List Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-L-01 | The system shall allow users to create multiple grocery lists | Must |
| FR-L-02 | Each list shall have a **name** (required, 1–100 characters) | Must |
| FR-L-03 | Each list shall have an optional **description** or note (0–500 characters) | Should |
| FR-L-04 | Users shall be able to **rename** a list | Must |
| FR-L-05 | Users shall be able to **delete** a list | Must |
| FR-L-06 | Deleting a list shall require confirmation to prevent accidental loss | Must |
| FR-L-07 | The home/overview screen shall display all lists with: name, total item count, and count of unchecked items | Must |
| FR-L-08 | Lists shall be sortable by: name, date created, date last modified (default: last modified, newest first) | Should |
| FR-L-09 | Users shall be able to **duplicate** a list (copy name + all items, all unchecked) | Could |

### 3.4 Item Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-I-01 | Users shall be able to **add items** to any list | Must |
| FR-I-02 | Each item shall have a **name** (required, 1–200 characters) | Must |
| FR-I-03 | Each item may have an optional **quantity** (e.g., `2`, `1 lb`, `3 cans`) | Should |
| FR-I-04 | Each item may have an optional **note** (e.g., `organic`, `brand X`) | Could |
| FR-I-05 | Each item shall have a **category** (required; see §3.5) | Must |
| FR-I-06 | Users shall be able to **edit** any item field (name, quantity, note, category) | Must |
| FR-I-07 | Users shall be able to **delete** an item from a list | Must |
| FR-I-08 | Adding an item shall be possible from the list detail view via a quick-add input | Must |
| FR-I-09 | Pressing Enter after typing an item name shall add the item (keyboard-friendly) | Must |
| FR-I-10 | Duplicate item names within the same list shall be allowed | Must |
| FR-I-11 | Users shall be able to **reorder items within a category** via drag-and-drop | Must |
| FR-I-12 | Item drag-and-drop shall work on touch devices (phone/tablet) with visible drag handles | Must |
| FR-I-13 | Quick-add shall default to the user’s last-used category or a sensible default (e.g., Other) | Should |

### 3.5 Categories

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-CAT-01 | Every item shall belong to exactly one **category** | Must |
| FR-CAT-02 | New accounts shall be seeded with a **default set of categories** | Must |
| FR-CAT-03 | Default categories shall include at minimum: **Produce, Dairy, Meat & Seafood, Bakery, Frozen, Pantry, Beverages, Household, Personal Care, Other** | Must |
| FR-CAT-04 | Users shall be able to **create custom categories** | Must |
| FR-CAT-05 | Users shall be able to **rename** custom categories | Must |
| FR-CAT-06 | Users shall be able to **delete** custom categories | Must |
| FR-CAT-07 | Deleting a category shall require choosing a **replacement category** for affected items (or reassign all to Other) | Must |
| FR-CAT-08 | Users shall be able to **reorder categories** via drag-and-drop to match their store layout | Must |
| FR-CAT-15 | Category drag-and-drop shall work on touch devices with visible drag handles | Must |
| FR-CAT-09 | List detail view shall **group items by category** | Must |
| FR-CAT-10 | Category groups shall display in the user’s defined sort order | Must |
| FR-CAT-11 | Within a category group, unchecked items shall appear above checked items | Should |
| FR-CAT-12 | Category shall be selectable when adding or editing an item (dropdown or picker) | Must |
| FR-CAT-13 | Each category shall have a **name** (required, 1–50 characters) | Must |
| FR-CAT-14 | Duplicate category names within the same user account shall not be allowed | Must |

### 3.6 Check-Off (Purchased State)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-C-01 | Users shall be able to **check off** (mark as purchased) any unchecked item | Must |
| FR-C-02 | Checked-off items shall display a clear visual state (strikethrough, muted color, or checkbox filled) | Must |
| FR-C-03 | Users shall be able to **uncheck** a previously checked item | Must |
| FR-C-04 | Checking/unchecking shall take effect immediately in the UI and sync to the server | Must |
| FR-C-05 | Checked items shall remain on the list (not auto-deleted) until the user clears them or deletes the list | Must |
| FR-C-06 | Users shall be able to **clear all checked items** from a list in one action (with confirmation) | Should |
| FR-C-07 | Users shall be able to **hide or show** checked items (toggle) while viewing a list | Should |
| FR-C-08 | Unchecked items shall appear above checked items within each category by default | Should |

### 3.7 Navigation & Views

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-N-01 | A **lists overview** page shall show all lists (post-login) | Must |
| FR-N-02 | A **list detail** page shall show all items for one list, grouped by category | Must |
| FR-N-03 | Users shall be able to navigate between overview and detail in one tap/click | Must |
| FR-N-04 | The app shall indicate which list is currently open (title, breadcrumb, or back navigation) | Must |
| FR-N-05 | Empty lists shall show helpful placeholder text and a prompt to add the first item | Should |
| FR-N-06 | A **category management** screen shall let users view and edit their categories | Must |
| FR-N-07 | Unauthenticated visitors shall see login/register screens, not list data | Must |

---

## 4. User Stories

### Authentication & Sync

- **US-01:** As a new user, I want to create an account so my grocery lists are saved securely.
- **US-02:** As a returning user, I want to log in so I can access my lists.
- **US-03:** As a shopper, I want my lists to sync across my phone and laptop so I can add items at home and shop from my phone.
- **US-04:** As a security-conscious user, I want to log out on a shared device so others cannot see my lists.

### Lists

- **US-05:** As a shopper, I want to create a new grocery list so I can plan a separate shopping trip.
- **US-06:** As a shopper, I want to see all my lists on one screen so I can choose which one to shop from.
- **US-07:** As a shopper, I want to rename a list so I can fix typos or update its purpose.
- **US-08:** As a shopper, I want to delete a list I no longer need so my overview stays uncluttered.

### Items

- **US-09:** As a shopper, I want to quickly add items to a list so I can capture groceries as I think of them.
- **US-10:** As a shopper, I want to edit an item’s name or quantity so I can correct mistakes before shopping.
- **US-11:** As a shopper, I want to delete an item I added by mistake.
- **US-12:** As a shopper, I want to add quantity info (e.g., `2 gallons`) so I buy the right amount.
- **US-13:** As a shopper, I want to drag items to reorder them within a category so I can shop in the order I prefer.

### Categories

- **US-14:** As a shopper, I want items grouped by category so I can move through the store aisle by aisle.
- **US-15:** As a shopper, I want to assign a category when adding an item so it appears in the right section.
- **US-16:** As a shopper, I want to drag categories to reorder them to match my usual store layout.
- **US-17:** As a shopper, I want to create custom categories (e.g., “Bulk / Costco”) for how I actually shop.

### Shopping (Check-Off)

- **US-18:** As a shopper, I want to tap an item to cross it off so I know what I’ve already put in my cart.
- **US-19:** As a shopper, I want to uncheck an item if I put it back on the shelf.
- **US-20:** As a shopper, I want checked items to stay visible (but visually distinct) so I don’t lose track mid-trip.
- **US-21:** As a shopper, I want to clear all checked items after a trip so the list is ready for next time.

---

## 5. Data Model (Conceptual)

### 5.1 User

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | UUID | Yes | System-generated |
| `email` | String | Yes | Unique, used for login |
| `password_hash` | String | Yes | Never exposed to client |
| `created_at` | Timestamp | Yes | Auto-set |
| `updated_at` | Timestamp | Yes | Auto-updated |

### 5.2 List

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | UUID | Yes | System-generated |
| `user_id` | Reference | Yes | Owner |
| `name` | String | Yes | 1–100 chars |
| `description` | String | No | 0–500 chars |
| `created_at` | Timestamp | Yes | Auto-set |
| `updated_at` | Timestamp | Yes | Auto-updated on any change |
| `sort_order` | Integer | No | Manual ordering on overview |

### 5.3 Category

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | UUID | Yes | System-generated |
| `user_id` | Reference | Yes | Owner; categories are per-user |
| `name` | String | Yes | 1–50 chars; unique per user |
| `sort_order` | Integer | Yes | Display order in list detail view |
| `is_default` | Boolean | Yes | `true` for seeded defaults; user may still rename/reorder |
| `created_at` | Timestamp | Yes | Auto-set |
| `updated_at` | Timestamp | Yes | Auto-updated |

### 5.4 Item

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | UUID | Yes | System-generated |
| `list_id` | Reference | Yes | Parent list |
| `category_id` | Reference | Yes | Parent category |
| `name` | String | Yes | 1–200 chars |
| `quantity` | String | No | Free-text (e.g., `3`, `1 bag`) |
| `note` | String | No | 0–200 chars |
| `is_checked` | Boolean | Yes | Default: `false` |
| `checked_at` | Timestamp | No | Set when checked; cleared when unchecked |
| `sort_order` | Integer | No | Position within category |
| `created_at` | Timestamp | Yes | Auto-set |
| `updated_at` | Timestamp | Yes | Auto-updated on edit |

### 5.5 Relationships

- One **User** has many **Lists**, **Categories**, and (indirectly) **Items**
- One **List** has many **Items**
- One **Category** has many **Items** (across lists, per user)
- Deleting a **List** deletes all its **Items** (cascade)
- Deleting a **Category** requires reassigning its **Items** to another category
- **Items** belong to exactly one **List** and one **Category**

---

## 6. User Interface Requirements

### 6.1 Authentication Screens

- **Login:** Email, password, Log in button, link to register (no forgot-password link in v1)
- **Register:** Email, password, confirm password, Create account button, link to login
- **Validation:** Inline errors for invalid email, weak password, or auth failures
- **Post-login:** Redirect to lists overview

### 6.2 Lists Overview Screen

- **Header:** App title, user menu (categories, log out), “New List” button
- **List cards/rows:** List name, unchecked/total item count, last modified date
- **Actions per list:** Open, rename, delete (delete behind confirmation)
- **Empty state:** “No lists yet — create your first grocery list”

### 6.3 List Detail Screen

- **Header:** List name (editable), back to overview
- **Quick-add bar:** Item name input, category picker, Add button (sticky on mobile)
- **Category sections:** Collapsible or fixed headers per category in user sort order
- **Item rows:** Drag handle, checkbox, item name, optional quantity, category badge (on edit), edit/delete actions
- **Checked items:** Strikethrough or muted styling within each category group
- **Footer actions:** “Clear checked items”, “Hide/show checked”

### 6.4 Category Management Screen

- **List of categories** in current sort order with drag handles (drag-and-drop required)
- **Actions:** Add category, rename, delete (with reassignment prompt)
- **Default categories** visually indicated but fully editable

### 6.5 Interaction Patterns

| Action | Expected Interaction |
|--------|-------------------|
| Check off item | Tap checkbox or tap entire row |
| Add item | Type name, pick category, press Enter or tap Add |
| Edit item | Tap edit icon → inline edit or modal (name, quantity, category) |
| Edit list name | Tap list name or edit icon on overview/detail |
| Delete | Trash icon → confirmation dialog |
| Reorder items | Drag-and-drop within category group on list detail screen |
| Reorder categories | Drag-and-drop on category management screen |

### 6.6 Responsive Design

- **Mobile-first:** Large tap targets (min 44×44 px), thumb-friendly controls
- **Desktop:** Same functionality; wider layout with side-by-side overview + detail optional (Could)
- **Web app v1:** Installable PWA is a Could; standard browser access is sufficient

---

## 7. Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-01 | Performance | Optimistic UI updates within 200 ms; server confirmation &lt; 1 s under normal conditions |
| NFR-02 | Availability | Data shall persist in the cloud; no loss on refresh, browser close, or device switch |
| NFR-03 | Usability | A new user shall register, create a list, and add 3 categorized items within 2 minutes |
| NFR-04 | Accessibility | Checkboxes and buttons shall be keyboard-operable; checked state shall not rely on color alone |
| NFR-05 | Data integrity | Concurrent edits from multiple devices shall not corrupt data (last-write-wins acceptable for v1) |
| NFR-06 | Privacy | Grocery data is personal; scoped to authenticated user; no sharing with third parties without consent |
| NFR-07 | Security | HTTPS everywhere; secure password hashing; session tokens httpOnly where applicable |
| NFR-08 | Sync | Changes on device A visible on device B after login, page load, or navigation refresh on device B (no background polling in v1) |
| NFR-09 | Offline (Could) | Read/check-off/add queue locally and sync when connectivity returns |

---

## 8. Acceptance Criteria (MVP)

The MVP is complete when all of the following pass:

### Authentication
1. User can register with email and password; duplicate emails are rejected.
2. User can log in and log out.
3. Unauthenticated users cannot access list screens.
4. Session persists across browser restart (user stays logged in).

### Sync
5. Lists created on device A appear on device B after login or page refresh.
6. Checking off an item on device A reflects on device B after device B loads or refreshes.
7. Each user sees only their own lists.
8. No background polling or WebSocket connection is required in v1.

### Lists
9. User can create at least 10 lists with unique names.
10. User can view all lists on an overview screen with item counts.
11. User can rename and delete lists (delete requires confirmation).

### Items
12. User can add an item with a name and category.
13. User can edit an item’s name, quantity, and category.
14. User can delete an individual item.
15. Empty item names are rejected with a clear validation message.
16. User can reorder items within a category via drag-and-drop; order persists after refresh.

### Categories
17. New accounts receive the default category set.
18. Items are grouped by category on the list detail screen.
19. User can create, rename, and delete custom categories.
20. User can reorder categories via drag-and-drop; order persists after refresh.
21. Deleting a category prompts for reassignment of affected items.

### Check-Off
22. User can check and uncheck any item; visual state updates immediately and syncs.
23. Checked items remain until explicitly cleared or the list is deleted.
24. Unchecked items are visually distinct from checked items within each category.

### UX
25. App is usable on a phone-sized viewport without horizontal scrolling.
26. All primary actions are reachable without a manual.
27. Drag-and-drop reorder works on a touch device (phone viewport).

---

## 9. Future Enhancements

### v1.1

| Feature | Rationale |
|---------|-----------|
| Password reset via email | Users who forget credentials can recover access |

### Post-MVP

| Feature | Rationale |
|---------|-----------|
| Real-time sync (WebSockets / polling) | See changes from other devices without manual refresh |
| Shared lists with family members | Collaborative household shopping |
| List templates (“Weekly staples”) | Speed up recurring shopping |
| Item autocomplete from history | Faster data entry |
| OAuth / social login (Google, Apple) | Faster sign-up |
| Dark mode | User preference |
| Export list as text/SMS | Share with someone not using the app |
| Native iOS / Android apps | Better offline and push notifications |
| PWA install + push notifications | Near-native experience on web |
| Per-store category order presets | Different layouts for different stores |

---

## 10. Assumptions & Dependencies

### Assumptions
- Single user per account for v1 (no shared-list collaboration)
- English UI for v1
- Quantity is free-text, not a structured unit system
- “Cross off” means a boolean checked state, not permanent deletion
- Categories are **per-user**, not global — each shopper customizes their own aisle order
- Web app delivered via modern browsers (Chrome, Safari, Firefox, Edge — last 2 major versions)

### Dependencies
- Backend API with authenticated endpoints
- Cloud database with user-scoped data
- Email delivery service (required for v1.1 password reset)
- HTTPS hosting for web app and API
- Modern web browser with JavaScript enabled

---

## 11. Resolved Decisions

| # | Question | Decision |
|---|----------|----------|
| RD-01 | User accounts for v1? | **Yes** — login required |
| RD-02 | Multi-device sync? | **Yes** — cloud-backed, synced per account |
| RD-03 | Platform for v1? | **Responsive web app** |
| RD-04 | Categories in v1? | **Yes** — required on every item, grouped in list view |
| RD-05 | Sync model for v1? | **Refresh on load** — no real-time polling or WebSockets |
| RD-06 | Password reset? | **v1.1** — not in initial release |
| RD-07 | Drag-and-drop reorder? | **Must have for v1** — items within categories and category order |

### Remaining Open Questions

| # | Question | Impact |
|---|----------|--------|
| OQ-01 | Should checked items auto-archive after N days? | Data model, UX |

---

## 12. Glossary

| Term | Definition |
|------|------------|
| **Account** | A registered user identity (email + credentials) owning lists and categories |
| **List** | A named collection of grocery items for one shopping context |
| **Item** | A single grocery entry on a list |
| **Category** | An aisle or grouping (e.g., Produce) used to organize items within a list |
| **Checked / Crossed off** | An item marked as purchased or picked up |
| **Unchecked** | An item still needed |
| **Sync** | Keeping data consistent across devices via a central server |
| **Refresh on load** | v1 sync model: fetch latest server data on login, page load, and navigation — not live push |
| **MVP** | Minimum Viable Product — the smallest release that satisfies core requirements |
| **Quick-add** | A fast input for adding items without opening a separate form |

---

## 13. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-17 | — | Initial draft |
| 1.1 | 2026-06-17 | — | Added accounts, multi-device sync, categories; confirmed web app for v1 |
| 1.2 | 2026-06-17 | — | Refresh-on-load sync; password reset deferred to v1.1; drag-and-drop reorder required |