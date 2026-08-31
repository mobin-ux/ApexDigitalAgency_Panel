# Apex Digi Dashboard — Design System & Refactor Guide

Living document for the customer dashboard built on the **Tairo** (Nuxt 3 + Shuriken UI +
Tailwind v4) template. Keep this updated as pages are refactored.

## 1. Stack at a glance

| Layer | Tech |
|---|---|
| Framework | Nuxt 3 (compatibility v4), Vue 3 `<script setup>` |
| Active app | `.demo/` (workspace pkg `demo`). `.app/` is unused. |
| UI kit | Shuriken UI (`<Base*>` components), Tairo layout components (`<Tairo*>`) |
| Styling | Tailwind CSS v4, design tokens in `.demo/app/assets/main.css` |
| Backend | Nitro server routes (`.demo/server/api`), Prisma + SQLite (`prisma/`) |
| Auth | JWT in cookie (`auth_token`), `auth` middleware, `useUser()` composable |
| i18n | `@nuxtjs/i18n` (en/fr/es/de/ar/ja), `no_prefix` strategy |
| Money | GBP via `useCurrency()` |

The customer pages live in `.demo/app/pages/dashboards/`: `balance` (home, `/` redirects
here), `orders`, `services`, `wallet`, `support`, `settings`. All use `layout: 'sidenav'`
and `middleware: 'auth'`.

## 2. Brand & theme decisions

Source of truth: the **Apex design system** the client provided (Claude Design export).
Imported tokens/font live in the bundle; the values below are mirrored into `main.css`.

- **Default theme: dark** (`colorMode.preference: 'dark'`). The app/dashboard uses the
  Apex dark navy "ink" treatment; the marketing site is light. Toggle still works.
- **Palette (set once in `main.css`):**
  - `primary` → **electric violet `#7D53F2`** (brand accent: buttons, links, highlights).
  - `muted` → warm-cool grays (light end) down to deep navy **ink** (`#0B1517` page /
    `#16252A` card) on the dark end — the dashboard's surfaces.
  - Re-theme the whole app by editing those two ramps; never hardcode hex.
- **Fonts:** **Yellix** (display/headings + big numbers) via the `font-heading` utility;
  **Inter** for body/UI. Yellix `.woff` files in `/public/fonts/yellix`.
- **Currency: GBP (£)** via `useCurrency()` (design mocks show `$`; the brand is UK → £).
- **Brand assets:** `apex-icon.svg` / `apex-wordmark-dark.svg` in `/public/brand`.

## 3. Conventions ("rebuilt properly")

Earlier custom pages bypassed the design system (hardcoded `bg-[#0f111a]`, raw `<button>`,
native `alert()`, USD). When refactoring a page, bring it in line:

1. **Use design tokens, not hex.** `bg-muted-950`, `border-muted-800`, `text-muted-400`,
   `text-primary-500` — never `bg-[#161925]`. For surfaces that must work in both themes use
   light/dark pairs, e.g. `bg-white dark:bg-muted-950`, `border-muted-200 dark:border-muted-800`.
2. **Use components, not raw HTML.** `<BaseCard>`, `<BaseButton>`, `<BaseInput>`,
   `<BaseHeading>`, `<BaseParagraph>`, `<BaseAvatar>`, `<BaseTag>` instead of bespoke divs.
3. **No native dialogs.** Replace `alert()`/`prompt()` with `useNuiToasts().add(...)`;
   replace `confirm()` with a `<TairoModal>`/`<BaseDialog>` confirmation.
4. **Money** goes through `useCurrency()` (`formatCurrency`).
5. **Responsive first.** Mobile → tablet (`md:`) → desktop (`lg:`/`xl:`). Test all three.
6. **Keep the dark glassmorphism feel** (soft gradients, blur accents, rounded surfaces) but
   express it through tokens so it themes correctly.

## 4. Roadmap (page-by-page)

| # | Area | Status |
|---|---|---|
| 0 | **Foundation** — tokens, dark default, `sidenav` cleanup, `useCurrency`, app.config | ✅ Done |
| 0b | **Auth/infra fixes** — reload-logout, SWR cache, Prisma generate, duplicate code | ✅ Done |
| 1 | Balance (home dashboard) + fix `/api/dashboard/stats` | ✅ Done |
| 2 | My Orders (`orders.vue`) — Apex Design redesign (list + detail + payment plan) | ✅ Done |
| 3 | New Order / financing wizard (`services.vue`) — Apex Design redesign | ✅ Done |
| 4 | Wallet & Credit (`wallet.vue`) — Apex Design redesign (overview/transactions/installments/banking + top-up & credit modals) | ✅ Done |
| 5 | Support (`support.vue`) — Apex Design redesign (tickets inbox+thread / new request / FAQ) | ✅ Done |
| 6 | Settings | ☐ |
| 7 | Auth flow (login / signup / recover) | ☐ |

### V2 redesign (Claude Design, page-by-page)

The client is sending a second-generation design as numbered phases. Each phase
ships as a `.dc.html` mockup plus a `PHASE-N-*.md` implementation spec.

| Phase | Area | Status |
|---|---|---|
| 1 | **Shared shell** — sidebar, top bar, page-header pattern, radius/spacing scale | ✅ Done |
| 2 | **Dashboard** — honest figures, one promo chip, real credit line, reconciled expenses | ✅ Done |
| 3 | **New Order** — one price per plan, themed selects, real validation, honest kickoff copy | ✅ Done |
| 4 | **My Orders** — tiles that always carry a number, plan-derived payment state | ✅ Done |
| 5 | **Wallet & Credit** — real credit states, receipts not invoice numbers, honest labels | ✅ Done |
| 6 | **Support** — no discarded files, an unread dot that means something, tokenised shell offset | ✅ Done |
| 7 | **Settings** — the outlier brought onto the system, and fields that no longer vanish | ✅ Done |
| 8 | **Auth flow** — one branded shell, no demo pages, no dead controls | ✅ Done |
| 9 | Mobile & light theme | 🚧 Light conversion outstanding |
| 1M | **Shared shell at 393px** — 56px bar, drawer, sheets, full-screen search | ✅ Done |
| 2M | **Dashboard at 393px** — promo without its art, two-line rows, service rows | ✅ Done |
| 3M | **New Order at 393px** — a task not a page, segments, select sheets, footer strip | ✅ Done |
| 4M | **My Orders at 393px** — bar carries the level, one stat card, rows not tiles | ✅ Done |
| 5M | **Wallet & credit at 393px** — four tabs that fit, a plan is a screen, sheets not modals | ✅ Done |
| 6M | **Support at 393px** — one entry point, a thread is a screen, the composer takes the bottom edge | ✅ Done |
| 7M | **Settings at 393px** — the sub-nav becomes a hub, save is pinned and scoped | ✅ Done |
| 9A | **Admin — Team & platform** — six staff roles, one enforced matrix, invites, platform settings, audit log | ✅ Done |

#### Phase 1 — the shell standard (applies to every page from here on)

- **Brand:** Apex icon + live "Apex" wordmark in a 76px sidebar band. `TairoLogoText`
  is gone; the title template and favicon are Apex.
- **Nav rows:** 44px at every breakpoint, `rounded-xl`, 20px icon, 14.5px/500 label.
  Active row = `.apex-nav-active` (violet `color-mix` gradient) + 600 weight, no
  marker. Sub-nav hangs off a hairline `border-s`, 40px rows, no bullet dots.
  Exactly one row is active: longest-prefix match, so detail routes stay lit.
- **Account:** one row → one `BaseDropdown` (settings · language · panel switch ·
  sign out). Avatar falls back to initials, never a broken `?`.
- **Top bar:** 76px band, search (250×40, `rounded-xl`, platform-aware ⌘K/Ctrl K)
  and notifications only. No flag, no activity panel, no demo account dropdown.
- **Breadcrumb:** the toolbar owns location. Pages must not print their own.
- **Page header:** `<ApexPageHeader>` — 30px/800 Yellix two-tone H1, 15px muted
  sub-line, max one primary action at 44px pill. No eyebrow labels.
- **Section labels:** `<ApexSectionLabel>` — 3px violet bar + 12px/700 uppercase.
- **Radius scale:** surfaces `rounded-2xl` (16px), inner rows/inputs/icon buttons
  `rounded-xl` (12px), pills `rounded-full`. Tokens `--radius-surface` /
  `--radius-control` in `main.css`.
- **Spacing:** 32px between sections, 20px between cards, 24px card padding,
  page content `max-w-[1180px]`.
- **Focus:** `.apex-focus` on every shell control.

#### Phase 2 — Dashboard (the honesty standard)

Same sections, same order; the change is hierarchy and truthfulness. The rules
below apply to every page from here on:

- **A number on screen must come from the API, or not be on screen.** The
  credit-line card used to render a hardcoded £12,500 limit under a green
  "Approved" chip — a credit facility with terms, generated by a template. It
  now renders the real `CreditLine` record in four states (none / pending /
  active / frozen).
- **A total and its parts must come from one source.** Expenses showed the real
  ledger total beside a hardcoded £8,240 breakdown. The breakdown now renders
  only when the installment plans provably sum to the ledger total; otherwise
  the card shows the total alone. An empty half-card beats a wrong one.
- **Decorative figures must be labelled.** The promo's "+145%" carries an
  "Example result" caption so it cannot read as this account's own number.
- **One encoding per fact.** Project rows dropped the coloured left border —
  the chip already names the status and the bar already shows progress.
- **A badge on everything is a badge on nothing.** One service card carries
  "Most popular"; the other three carry none.
- **Buttons must do what they say.** "How it works" fired a toast reading "your
  account manager has been notified"; it now expands three steps in place.
  `comingSoon()` is only acceptable for a genuine request-a-callback.
- No emoji in product UI (marketing eyebrows only), and no gradient-clipped
  text — accent words are solid `text-primary-400`.

#### Phase 3 — New Order (form and pricing standards)

- **One price per plan, in every configuration.** Plan cards lead with total
  project value — the one figure no payment term can change — and quote the
  monthly as "from {cheapest term available}". The rail reads `FROM` with the
  same number until a term is chosen on step 3, then `YOUR MONTHLY`. Card,
  rail and contract must never disagree, in either 12- or 24-month setup.
- **No native `<select>` on a dark surface.** Its popup is an OS menu — white
  on black text — and CSS cannot reach it. Use `BaseSelect`/`BaseSelectItem`,
  whose portal is `bg-portal-*` (dark in dark mode).
- **A control must not answer for the customer.** A `<select>` with no empty
  option displays `options[0]` from the start; never treat that as an answer.
  Give every select a placeholder and omit unanswered fields from submitted
  data.
- **Dates are dd/mm/yyyy.** `<input type="date">` renders in the *browser's*
  locale (mm/dd/yyyy on a US machine) and no attribute overrides it. Use a
  text input with a `dd / mm / yyyy` placeholder and validate the format.
- **Required is red.** `required: true` on the field schema drives both the
  red `*` and validation; never bake an asterisk into the label string.
- **Validate on blur, clear on fix**, and block the step on submit.
- **One signature method at a time** (Draw / Type toggle), with a signing rule
  captioned "Sign above this line".
- **No inert controls**: don't render a primary button on a step where its
  handler is a no-op.

#### Phase 4 — My Orders (measure the right thing)

- **A summary tile must carry a number in every account state.** Four tiles
  that read 0 · 0 · £10,622 · 0 above three visible projects look broken. Count
  what exists (total projects, outstanding across open plans, soonest payment),
  and leave per-status counts to the filter tabs, where a zero is informative.
- **Project status and payment progress are different facts.** Deriving the
  payment chip from `project.status` made a PENDING project with two paid
  installments read "Not started" beside "£226 of £2,712". One helper
  (`payState`) answers "how far through the plan are we", and the card, the
  chip and the note all follow from it.
- **One term per state, everywhere.** The not-yet-started state is "Awaiting
  kickoff" on the card, the detail summary and the dashboard — never also
  "Not started".
- **A whole-card button needs its own `aria-label`.** Otherwise the accessible
  name is the entire card body.
- **Don't use tab roles without tabpanels.** Filters that swap rows in one grid
  are `aria-pressed` buttons.
- Decorative SVG beside a text value (progress rings) gets `aria-hidden`.
- No text link inside a control that already owns the click ("Details ›").


#### Phase 5 — Wallet & Credit (name things by what they are)

- **A document number is a promise.** The invoices card minted
  `INV-2026-${14 - i}` from the row's array index: two customers saw the same
  number, and the number changed when a new charge shifted the list. There is
  no `Invoice` model, so the card is now **Receipts** — a plain view of the
  ledger rows that already exist, with no number, no "Download" button and a
  footnote saying VAT invoices arrive by email. Ship the receipt you have
  rather than the invoice you don't.
- **Don't derive a label from an enum's spelling.** `type.charAt(0) + rest
  .toLowerCase()` turned `AD_CREDIT` into "Ad_credit" and `CREDIT_REPAY` into
  "Credit_repay". A `TX_LABEL` map names all eight transaction types; an
  unknown type falls back to the raw value, which is at least honest.
- **Every state of a feature needs a screen, including "you don't have it".**
  The credit section rendered its full active layout for accounts with no
  credit line, so £0 available read as a depleted facility rather than an
  absent one. It now branches on `hasCredit`, and the empty state explains what
  Apex credit is and offers a route to ask for it.
- **A disabled button must say why it is disabled.** At the limit, "Start a
  project" was greyed out with no explanation — a dead end the customer cannot
  diagnose. The button stays live and an amber note states the cause and the
  remedy: paying an installment frees the credit up.
- **A toast is not a feature.** `comingSoon()` is gone from this page: billing
  "Edit" links to Settings, which really does edit those fields.
- **Copy must point at something reachable.** The bank-transfer reference told
  customers to quote a project ID it never showed them; it now says where to
  find it.
- Collapsible plan headers are `<button aria-expanded>`, not
  `div[role=button]` with hand-rolled Enter/Space handlers.
- Tab semantics match Phase 4: `aria-pressed` buttons in a `role="group"`,
  because there is still no tabpanel to point at.
- Installment segments render per-installment only up to 12; beyond that they
  are visually indistinguishable and a single bar reads better.

**Phase 5 gotcha — `ensureCredit()` normalises the line on every load.**
`server/utils/credit.ts` recreates/normalises each customer's `CreditLine` from
Setting `credit.max-limit` (default £20,000) whenever the dashboard loads, and
derives `used` from outstanding principal. An admin "adjust limit to 0" will
therefore not stick. To test the no-credit state, set `credit.max-limit` to 0,
verify, then restore it.

#### Phase 6 — Support (don't accept what you can't deliver)

- **Never accept input you are going to discard.** The composer had a working
  file picker: files were chosen, rendered as chips, and then `sendReply()`
  posted `{ content }` and cleared the chips. Nothing uploaded, nothing warned,
  and the interaction was indistinguishable from success — a customer who
  attached the screenshot we asked for believed we had it, and neither side
  knew otherwise. `TicketMessage` has no attachment relation and there is no
  upload endpoint, so both composers now say how to send a file instead of
  pretending to take one. A disabled paperclip was not an option either; that
  is the dead end Phase 5 removed from the credit card.
- **Product copy is part of the product.** The FAQ answered "How do I share
  files?" with "Attach files directly to any support conversation" —
  describing the very capability that does not exist. Copy that documents a
  feature has to be changed in the same commit that changes the feature; the
  answer now points at the route that really works.
- **An indicator that is always on is not an indicator.** "Unread" was
  `messages[0].isAdmin === true` — "the newest message is from staff", which
  stays true forever once they answer. Every answered ticket was permanently
  dotted, which teaches customers to ignore the dot. It is now a real
  comparison against a per-ticket last-read timestamp, and it re-lights when a
  genuinely newer staff message arrives.
- **Mark things read when they are on screen, not when they are selected.**
  Below `lg` the detail pane is hidden until a row is tapped, so the
  auto-selected first ticket must not count as read there; from `lg` up both
  panes are visible and it does. Same rule, two layouts.
- **A skeleton beats a wrong value.** `firstReplyLabel()` reads the lazily
  fetched thread, so the header rendered "First reply —" and then corrected
  itself a beat later. It shows a skeleton while the thread loads, then the
  value — and "—" now only ever means "no reply yet".
- **One commitment, one source.** The header pill read `replyEta` from
  `/api/config` while the empty state hardcoded "within 15 minutes". Changing
  the setting made the empty state quietly false. Both read the config now.
- **A number that describes the shell belongs to the shell.** The Support
  inbox subtracts the top bar's height from `100dvh`. That figure lived in the
  page, so when Phase 1 took the bar from 56px to 76px the page kept
  subtracting the old one. It is now `--apex-shell-offset` in `main.css`
  (109px = 76px band + 32px margin + 1px divider) and the page never names it.
- Native `<select>` count in the five V2-rebuilt customer pages: zero. The
  category filter and the related-project picker were the last two.
- Tab strip matches Phases 4–5 (`aria-pressed`, not `role="tab"` without a
  tabpanel); FAQ accordions expose `aria-expanded`; the unread dot has an
  accessible name; the reply textarea has a label; Subject and Message got
  real `<label for>`, while the priority buttons — a group, not an input — got
  `role="group" aria-label="Priority"` instead of a label pointing nowhere.

#### Phase 7 — Settings (only render a field the API round-trips)

This page never went through the first redesign: it carried Tailwind indigo
`#6366f1` as its accent, its own surfaces (`#0f111a`, `#161925`), 32–40px
radii, `font-light` headings and four third-party image services. Opened next
to Wallet it read as a different product. It is now on the same system as the
other six, and three of its defects were losing customer data.

- **A form must not collect what it cannot store.** `userForm` declared a
  preferred name, family status, birthday, gender, a legal address, socials
  and a bio, but the load path read back only `city` and `country`. Fill in
  your birthday, save, reload — blank; and the next save posted `birthDay: ''`
  over whatever was stored. Every field on the page is now round-tripped by
  `/api/settings/get-all` and persisted by `/api/settings/update-all`.
  Anything else is absent, including things the design asked for: a company
  number, a trading name and a structured UK address have no columns, and
  rendering boxes for them would recreate the same bug.
- **Removing a field must not delete its data.** `update-all` writes every
  column with `?? undefined`, which Prisma skips, so the values this page no
  longer shows keep whatever they hold. Verified before relying on it.
- **A first save must keep as much as the second.** The company `upsert`'s
  `create` branch accepted only name/email/website/phone/type, so a customer
  with no company row yet lost their VAT number, address and notes on their
  very first save and had to enter them twice. The branch now mirrors `update`.
- **Placeholder services are not placeholders in production.** The avatar fell
  back to `i.pravatar.cc` — a photograph of a real, random person shown as the
  customer's own account — the logo to `img.logoipsum.com`, the cover to an
  Unsplash hotlink and the page texture to a Vercel demo SVG. All four leaked
  the customer's IP to a third party on every view. Initials now, for both the
  person and the company.
- **A control that always fails is worse than no control.** The avatar picker
  read files into a base64 data URL and PUT it inside the settings JSON — and
  `avatar` is capped at 500 characters by the endpoint's own schema, so
  choosing any real photo 400'd the *entire* save. Removed, with a line saying
  when uploads arrive, rather than a disabled button.
- **Security data must never be invented.** The sessions list was one
  hardcoded MacBook in New York on `192.168.1.1`, identical for every
  customer, with `revokeSession(id) {}` — an empty function — behind the X. A
  customer checking for unauthorised access was told about a device that does
  not exist and given a control that silently did nothing. Now: this browser,
  and a plain statement that there is no device history yet.
- **Say what the system actually does.** The mockup's "changing your password
  signs you out of other devices" is not true here — sessions are stateless
  JWTs with a 7-day life, and changing the hash does not invalidate them. The
  copy says what happens instead of what would be reassuring.
- **A credential change is not a preference.** One "Save Changes" button
  posted profile, company and password together, and compared the two password
  fields *after* the profile PUT had already succeeded. Password now has its
  own form, its own button and validation that runs before any request.
- **A field with no feature is a lie in the payload.** `securityForm.twoFactor`
  was never rendered and posted on every save. It is a "Coming soon" statement
  now, not a switch that stores a boolean nothing reads.
- **Don't localise a UK product with US options.** Business type offered Solo /
  Small Company (LLC) / Medium Company (Corp) / Bigger Company — size bands,
  and "LLC" does not exist in UK law. It now lists UK legal forms, and the
  address heading follows the type: "Registered office address" for
  incorporated companies, "Business address" for sole traders and partnerships.
- **Income, employees, account manager and company status left the page.**
  They are internal CRM fields; a customer could set their own account to
  Inactive and choose who managed them.
- **One financial source.** The Billing tab's hardcoded `INV-001 · $29.00` —
  dollars on a GBP product, duplicating Wallet's receipts — is gone. The tab
  holds the VAT number, shows the receipt email and billing address *derived
  from the company record*, and links to Wallet & credit.
- **Never redefine a framework utility.** The page's scoped CSS redefined
  Tailwind's `.hidden` as a visually-hidden clip, so every `hidden md:block` on
  the page stopped hiding anything and became a 1px box still in the layout.
  Deleted, along with a duplicate scrollbar block and an indigo focus shadow
  that fought the shell's ring.
- VAT validates format live (`GB` + 9 digits, 12 for a branch, GD/HA + 3),
  uppercasing as you type and stripping spaces to test but not to display —
  and says "Valid format", never that the number is registered.
- Save is disabled until something is dirty; Discard resets to the last loaded
  values instead of being a button with no handler. `role` is no longer posted.
- Loading moved from `onMounted` + `$fetch` to `useFetch`, so the page SSRs
  with a skeleton instead of flashing empty inputs.
- Native `<select>` count in the customer panel: **zero**. These were the last
  ten.

#### Phase 8 — Auth (the pages a stranger sees first)

Three real pages — sign in, create account, reset — plus five Tairo demos that
were publicly reachable. Flows and endpoints unchanged.

- **A demo login was live at `/auth`,** the most guessable auth URL in the app.
  It told the visitor the password was `"password"`, faked a four-second
  submit, then pushed to `/dashboards` without authenticating, so the guard
  bounced them back. It advertised a 14-day trial Apex does not sell.
  `login-2`, `login-3`, `signup-1` and `signup-3` were the same. All five are
  gone, `/auth` redirects to the real form, and both layout nav trees stopped
  listing them (including `/auth/forgot`, a route that never existed).
- **One shell for three pages.** They had three: a split screen with a Tairo
  illustration, a centred card with `<TairoLogo>`, and a third variant wrapped
  in `<ClientOnly>`. `layouts/auth.vue` now owns the chrome — Apex brand panel
  left, 400px form column right — and each page holds only its form.
- **An error must not move the page.** login-1's alert was the template's
  first root node, a *sibling of the full-screen layout*, so a failed sign-in
  pushed everything down and put the message far from the field it described.
  It is inside the form column now, with `role="alert"`, and the duplicate
  toast that fired the same sentence is gone.
- **Don't render controls with nothing behind them.** Three social buttons —
  Google, X, LinkedIn — had no click handler, no OAuth provider and no route,
  while being the largest controls on the page, under a subhead promising
  "login with social media". Removed with the "OR" divider.
- **A checkbox that changes nothing is a lie.** "Trust for 60 days" was
  collected by the form and dropped from the request body. Removed rather than
  sent, because honouring it needs a server-side session length.
- **Ask for a name once, at the start.** Signup posted only identifier and
  password, which is why the dashboard greeted people by their email local
  part and Settings opened with empty name fields. One field fixes the
  greeting, the sidebar, the avatar initials and message authorship together —
  and the endpoint already accepted `name`.
- **Interactive content must not live inside a control.** The consent sentence
  was slotted *inside* `BaseCheckbox`, so clicking "Terms of Service" bubbled
  to the checkbox: the customer silently toggled consent and never reached the
  document — which was `href="#"` anyway. Box and sentence are siblings now,
  and both links resolve to real routes.
- **Never ship a developer instruction.** The reset success message read
  "Check your console/email." It now names the address, states the 60-minute
  expiry the API actually sets, mentions spam and offers a resend — while
  keeping the neutral "if an account exists" phrasing so it does not confirm
  whether the address is registered.
- **Confirm before redirecting.** A completed reset pushed silently to
  sign-in, so the customer could not tell whether it had worked. It shows a
  confirmation first. The copy does *not* claim other devices were signed out:
  sessions are stateless JWTs and rewriting the hash does not invalidate them
  (same finding as Phase 7's password form).
- **`<ClientOnly>` for a query param is a flash for nothing.** Recover was
  wrapped because it reads `?token=`, which is available during SSR. Removed,
  along with the "Loading..." string every visitor saw.
- **The one escape route looped.** "Back to Home" pointed at `/dashboards`,
  behind the auth guard, so from sign-in it returned to sign-in. It points at
  the marketing site. (`/` is Tairo's demo landing, so it was not the answer.)
- **Auth pages must not be HTML-cached.** `/auth/**` carried `swr: 3600`, so
  Nitro served an hour-old render: it no longer matched the client bundle and
  every visit logged a hydration mismatch. It also meant a shipped fix to the
  login form stayed invisible for an hour, and `/auth/recover` varies by
  `?token=`. Now `swr: false`, the same rule `/dashboards/**` learned in
  ADR-008.
- One password minimum — **10** — across signup, reset and Settings, with a
  strength meter on both new-password fields and a show/hide toggle
  (`aria-pressed`) on every password input. The APIs still accept 8 and 6; a
  stricter client is always compatible and raising a server minimum would lock
  out existing accounts.
- Also: the identifier field autofocuses, reset's email input is `type="email"`
  with `autocomplete="email"`, a signed-in visitor to `/auth/login-1` is sent
  to the dashboard instead of seeing the form again, and a 429 from the rate
  limiter says so instead of "check your details".

#### Phase 1 (mobile) — the shared shell at 393px

Companion spec `PHASE-1-MOBILE.md`. A layout and hit-target pass over the shell
every page inherits: same components, same routes, same data, same endpoints.
Everything is scoped below `lg` (1024px) — the breakpoint where the sidebar
becomes a permanent rail — and desktop was re-measured after to confirm it did
not move.

- **The top bar is 56px, and it carries a title rather than a breadcrumb.**
  Desktop's 76px band exists to line up with the sidebar's brand block; with no
  sidebar there is nothing to line up with. It is sticky, full-bleed, 6px of
  padding either side, `bg` at 92% with a 10px backdrop blur, and it sits
  *outside* the layout's gutter wrapper so it can span the viewport while page
  content keeps its 16px gutter. `--apex-shell-offset` follows it: 77px below
  `lg` (56 + 20 margin + 1 divider), 109px above.
- **The search button opened Tairo's demo search.** It indexes the `docs`
  collection and every route carrying `meta.preview` — and no Apex page sets
  `preview`, so MiniSearch had nothing to index for them. A customer typing
  "orders" got Tairo demo layouts and links to Shuriken UI documentation; their
  own orders were the one thing it could not find, and in production the docs
  routes 404 so half the results led nowhere. `ApexSearch` replaces it on
  `/dashboards/**` and `/admin/**`: full screen below `lg`, a centred dialog
  above, over the panel's own destinations plus the customer's projects and
  tickets from `/api/orders` and `/api/support/tickets` — the same two endpoints
  Orders and Support already call, fetched lazily on first open. Recents persist.
  The demo dialog is gated by route rather than unmounted, because it has a
  top-level `await` and a `v-if` would remount an async setup inside the root
  Suspense boundary on every navigation in or out of the panel.
- **A search result has to land on the thing.** The rows link to
  `?project=<id>` and `?ticket=<id>`, which neither page read — so every result
  dropped the customer on a list to find the row themselves. Both pages now
  honour the query (watched, not read once, so searching again from the same
  page works), guarded on the record existing.
- **The sidebar is a drawer below `lg`**, `100% - 68px` wide: leaving a strip of
  page visible is what says "overlay you can tap away" and gives them a target
  to do it with. It is `invisible` when closed, not merely translated off-screen
  — a transform leaves every link in the tab order and the accessibility tree,
  so a screen-reader user could walk the whole menu while it was shut.
  `visibility` is deliberately **not** in the transition list: that would defer
  an accessibility property to a transition completing, and transitions do not
  always complete (in a background tab the document timeline is frozen at
  `currentTime: 0` and the drawer stays pinned invisible while open). The cost
  is the slide-*out*; the slide-in is intact.
- **Services flattens in the drawer.** An accordion there charges a tap to
  reveal two links when there is room for both. Done as a `lg:`-gated sibling
  pair, not a JS media query — both halves are visible on load, and choosing
  between them in JavaScript is a hydration mismatch. `display: none` keeps the
  hidden half out of the accessibility tree.
- **Drawer keyboard behaviour is now real**: focus moves in on open and returns
  to the hamburger on close, Tab wraps at both ends, Escape closes, and so does
  a route change. The scrim was `role="button" tabindex="0"` with no key handler
  — a focusable control that did nothing on Enter; it is `aria-hidden` now and
  Escape is the keyboard route. Its `xl:hidden` was also stale from the 1024px
  move, so it could cover the page between 1024 and 1279px.
- **Both dropdowns become bottom sheets** (account, notifications). A dropdown
  anchored to the edge of a 393px viewport either clips or covers the control
  that opened it. `ApexBottomSheet` is built on reka's Dialog for the focus
  trap, Escape, scroll lock and focus return, with an entry-only keyframe —
  a `<Transition>` leave is what left an invisible overlay eating clicks on
  Wallet. Notification rows **wrap** rather than truncate; the list is the
  message.
- **One list, two containers.** `ApexNotificationsList` renders in both the
  sheet and the dropdown, with `lg:` marking the dropdown's values — only one
  container is ever mounted, so a row cannot gain a field in one and not the
  other.
- **Sheets need a description, not just a title.** reka generates an
  `aria-describedby` for every `DialogContent`; with no `DialogDescription` it
  pointed at an element that did not exist. A dangling reference is worse than
  none.
- Page header: h1 23px, sub-line 14.5px, and the primary action moved below the
  copy at full width and 48px (two side by side share the row at `flex:1`, per
  §10). Section rhythm 28px below `md`, dashboard money 32px.
- **A hidden browser tab freezes the document timeline.** Verified with
  `document.hidden`, zero `requestAnimationFrame` ticks and
  `getAnimations()[0].currentTime === 0`. Nothing that depends on a CSS
  transition finishing can be verified in the preview pane — measure end states
  with transitions neutralised.

**Not done in this phase:** the §8 card-padding compression (24 → 20px) across
the other five pages. That is 31 `p-6` sites, many of them modals and empty
states rather than cards, and a blind sweep is exactly the improvised spacing
rule 7 forbids. The §10 form-control inventory (48px inputs at 16px type) is
likewise per-page and belongs with each page's own spec. `ApexSearch`'s index is
customer-oriented, so searching from `/admin` finds customer destinations and
the admin panel link, not the individual admin modules.

#### Phase 2 (mobile) — the dashboard at 393px

`Dashboard - Mobile.dc.html`. One file (`balance.vue`), no API change, no new
data. Every rule is scoped below `md` or `lg`; desktop was re-measured at
1280px afterwards and is pixel-identical (promo 36px padding, h2 40px, growth
card visible, four service tiles in one row with the badge at the corner and
the footer bottom-aligned, one-line project rows, credit legend on one row).

- **The promo keeps its argument and loses its art.** The 260px growth card is
  decorative and would push the CTA below the fold, so it stays `lg`-only.
  Padding 24 → 20px, headline 40 → 25px, body 15.5 → 14.5px, and the plan's
  three terms — 0% interest, 12 months, no credit check — appear as wrapping
  chips exactly where the card is hidden. They are commitments the product
  actually makes (REQUIREMENTS §2), which is the only reason they are allowed
  to sit in a promo: a chip that cannot be checked against the product is
  decoration, and Phase 2 removed the last of those.
- **The two CTAs stack.** At 393px, two pills on one row leave about 150px
  each and the secondary one wraps its own label. Primary is 50px full width,
  "How it works" 48px full width with a hairline border and a rotating
  chevron; from `sm` both revert to the desktop pair. It still expands in
  place — that behaviour was the point of the Phase 2 fix and is untouched.
- **The credit legend became two rows.** Used and Left sat side by side and
  collided at 393px: two labels and two currency values on one 12.5px line had
  nowhere to wrap. One labelled row each now, figure pushed right in tabular
  numerals — measured, both values land on the same pixel.
- **A phone could not see any progress on the progress section.** The bar was
  `hidden sm:flex` and the deadline `hidden md:inline-flex`, because five items
  will not fit one line at 393px. So Active work — the section whose entire job
  is progress — showed a name and a status chip and nothing else. Rows are two
  lines now: identity and status, then bar, percentage and deadline. Done with
  `sm:contents` on the two line wrappers, which dissolves them on wider screens
  so their children become direct flex items of the original row again; the
  chip takes `sm:order-last` to return to the end. The deadline keeps its
  640–767px gap, the one width with room for neither treatment.
- **Service tiles became 76px rows.** Four 20px-padded cards stacked is four
  screens of scrolling. Same link, same target, same accessible name — only the
  composition changes: icon, name, one line of description, the from price, and
  a chevron doing the work the "Order" link did. The badge sits beside the name
  on a row and is absolutely positioned at the corner from `md`, so the tile is
  reproduced without a second copy of the element.
- **Expenses reads top to bottom**: total, split bar, then one row per project
  with the amount and the share in a fixed column, so both align vertically.
  The two-column desktop split put the legend beside a 12px bar with nowhere to
  wrap. The reconciliation gate from Phase 2 is untouched — the breakdown still
  renders only when the plans provably sum to the ledger total.
- Card padding 24 → 20px on the cash, credit and expenses cards, as drawn. This
  is the §8 figure the Phase 1 mobile pass declined to apply blind across all
  six pages; here it is actually in the mockup.

#### Phase 3 (mobile) — New Order at 393px

`New Order - Mobile.dc.html` + `PHASE-3-MOBILE.md`. One page (`services.vue`),
one new component, one new composable, no endpoint or payload change. The five
steps, the pricing model, the contract and the signing evidence are all
untouched; what changes is that below `lg` the wizard stops being a page and
becomes a task.

- **A wizard is a task, so the shell stops offering ways to leave it.** The
  hamburger becomes a close button, search and notifications step out of the
  bar, the `Secured` chip moves into it from the page header, and the bottom tab
  bar stays suppressed (it already was). The route list behind all of this is
  `useApexTaskBar()`, shared by `DemoToolbar` and `ApexBottomNav` — the two
  halves of the shell were about to hold two copies of the same literal, which
  is how one of them goes stale. The close button *asks* the page rather than
  routing itself, because only the page knows whether there is a half-filled
  order to lose.
- **The exit guard says what actually happens.** The mockup offers to keep the
  order "as a draft for 30 days". Nothing here is persisted anywhere — the order
  does not exist until `/api/orders` has accepted it — so the sheet says the
  choices are cleared, and the secondary action is "Leave without saving". The
  spec's own checklist asks for exactly this ("draft language matches what the
  backend does"). It also only asks when there is something to lose; a
  confirmation on an untouched step 1 teaches people to dismiss confirmations.
- **The stepper becomes a name plus five segments.** Five labelled nodes with
  connecting rules need ~620px. Sticky directly under the 56px bar — the bar's
  own bottom margin is cancelled so nothing scrolls through the gap — and
  full-bleed via `apex-bleed`, so its divider spans the viewport like the bar's.
  The segment row is a `role="group"`, **not** the spec's `progressbar`: a
  progressbar announces a value and its five children here are buttons, so the
  two would talk over each other. The "Step 2 of 5" counter beside the step name
  already states the progress in words.
- **Selection grids become rows.** Service tiles are 72px rows below `sm` (the
  width at which that grid is one column anyway) with a 24px radio, because a
  border tint alone is not a reliable selected state on a phone. Plan cards
  become a header row (icon, name, Popular, radio) over the price and features
  below `md`. Both are done with `contents`/`block` wrappers that dissolve at the
  breakpoint, so the desktop composition is *reproduced* rather than re-specified
  — verified pixel-identical, down to the glyph positions inside the plan card.
- **Selects open sheets.** A listbox anchored near the bottom of a 393px viewport
  opens over the field it belongs to, so below `lg` the field is a 48px button
  and the options are a bottom sheet at 52px each. One sheet serves all four
  selects. Nothing is preselected and an unanswered field is still omitted from
  the brief (Phase 3 §3). Only one control is ever mounted, so the label's `for`
  always points at exactly one thing.
- **Inputs are 16px on a phone.** Not a size preference: iOS zooms the page in
  when a focused input is under 16px, and the customer then pinches back out to
  see the field they are filling. With the existing padding it is also the 48px
  control the spec asks for.
- **The 340px rail becomes a 52px footer strip.** It carries the one figure the
  customer is deciding about and opens the full summary as a sheet.
  `ApexOrderSummary` is one definition rendered in both containers — Phase 3 §2
  spent a fix on making the card, the rail and the contract agree, and two
  hand-maintained copies is how they would start disagreeing again. With no plan
  chosen the strip says so rather than quoting `£0/mo`.
- **A disabled button must say why.** On a phone "Sign & start" sits in a fixed
  footer, a screen away from the checkbox it is waiting on, so the reason is
  stated next to the controls that answer it. This is rendered at both sizes —
  the desktop button was equally mute.
- **The signature canvas scaled the wrong axis.** `sigPos()` scaled *both* axes
  by the width ratio, which is only correct while the element and its 640x130
  backing store share an aspect ratio — and the element's width is fluid. At
  150px tall on a phone a stroke drawn across the middle would have mapped to
  row ~139 of a 130-row canvas, i.e. off the canvas entirely. Per-axis now:
  verified a mid-height stroke lands at rows 63-66 against an expected 65.
- **Two dead ends in the contract, fixed.** The terms-of-service link was
  `href="#"`; it resolves to `/legal/terms` and opens in a new tab, because
  navigating away mid-wizard discards the order. And the mockup's "Open full
  agreement" button has no document behind it — this text *is* the agreement —
  so it expands the box in place instead.
- **The step details form does not offer to take a file.** The mockup says
  attachments can be added "after kickoff from the project page"; the customer's
  project view is read-only and there is no upload endpoint, so the note points
  at the route that really works (Support, for a secure upload link) — the same
  resolution Phase 6 reached.
- Success is a full screen below `lg` rather than a card behind a scrim, with
  the two actions pinned to the bottom. The second one is "Back to dashboard",
  not "New order": someone who has just committed to a project is not choosing
  between seeing it and starting another.

**The card removal moved the ink onto the page.** Below `lg` the step cards go,
as drawn — but those `bg-muted-800` cards were the only thing putting the
wizard's `text-white` on a dark surface, and the shell's page is near-white
(`#f7f8f9`) in light mode. Dropping them alone would have rendered the entire
form white-on-white for anyone whose OS prefers light. The page wrapper carries
the ink instead (`bg-muted-950`, full-bleed, `lg:bg-transparent`), which in dark
mode is exactly the page colour and therefore invisible — the mockup's look —
and in light mode keeps the surface the text was designed for. The progress bar,
the footer strip and the sheets (`surface="ink"`) follow the same rule, so the
wizard is one ink surface in both themes rather than three different answers.
Measured at 375px in light mode: worst contrast ratio went from **1.06**
(invisible) at HEAD to **2.23**. What remains is the pre-existing
`text-muted-500`-on-ink class that Phase 9 owns, not a new kind of defect.

**`.apex-bleed`** (main.css) cancels the shared page gutter and re-applies it as
padding, so a sticky bar inside the content column can span the viewport. Its
`lg` reset reinstates `margin-inline: auto`, not `0` — a bled element may also be
the page's `mx-auto` wrapper, and a hard zero silently un-centres it once the
viewport passes the max-width. Verified centred at 1800px.

**Deliberate deviation — no "Payment history" header action.** The mockup draws
one to demonstrate the full-width header-action pattern. Phase 2 removed the
dashboard's header action on purpose, because the cash card immediately below
already links to Wallet twice (Deposit funds, Transactions) — on a phone those
sit within one screen of the header, so a third would be the same destination
three times in one viewport. The pattern the badge demonstrates is implemented
and verified on the four pages that do have a header action.

**Known cost — five more elements on the Phase 9 light-theme backlog.**
Splitting text into responsive variants (the count chip, the "All" link, the
row-form price) adds elements that reuse this page's existing dark-only
classes. Measured in light mode: 27 low-contrast elements of 71 before, 32 of
80 after — the same proportion and the same single cause (`text-muted-500` on
`bg-muted-800`, and unpaired `text-white`), not a new kind of defect. Using a
light pair for only these five would leave the page with two conventions and
make the Phase 9 sweep harder.

#### Phase 4 (mobile) — My Orders at 393px

`My Orders - Mobile.dc.html` + `PHASE-4-MOBILE.md`. One page (`orders.vue`), one
new composable, one mode added to `DemoToolbar`. No endpoint, no payload, no
change to the Phase 4 data-truth rules — `payState()` still answers "how far
through the plan are we" and the card, the chip and the note still follow from
it. Desktop re-measured at 1280px against HEAD, element by element.

- **The open project moved into the URL.** It was a local `ref`, which meant
  the shell could not tell it was inside a record without the page telling it —
  and a page sets shared state in its own `setup()`, which runs *after* the
  toolbar has rendered, so the bar would show the hamburger for a frame and
  then swap. `?project=<id>` was already the deep link panel search used; making
  it the only representation buys the bar's back arrow, a browser back button
  that returns to the list rather than leaving the page, and one less pair of
  states to fall out of step. Scroll position is remembered on the way in and
  restored on the way out, because Nuxt does not restore across a query-only
  navigation.
- **The bar carries the level you are on** (§1). List: hamburger, "My orders",
  search. Detail: back arrow, the project's name, search. `useApexSubView()`
  derives membership from the route the same way `useApexTaskBar()` does; the
  record's *name* is data, so it travels through `useState` with the section
  title as the fallback both renders start from.
- **Three tiles became one card of three rows** (§2). Side by side they leave
  about 110px each — not enough for `£10,622` above a label naming what it
  counts. The row reads label-then-value on a phone and value-then-label on
  desktop, which is `flex-col-reverse` against one DOM order rather than a
  second copy of either line.
- **The filter strip clipped its last pill.** A single scrolling strip at 393px
  cut "Completed" against the right edge with nothing to say it had. The pills
  now wrap onto two lines as standalone 38px controls, and the last one reads
  "Done" below `sm` as drawn.
- **Sort is a 44px trigger that says what it is sorted by**, opening a sheet
  with 52px options. The desktop listbox stays; only one of the two is ever
  mounted.
- **The in-page search left the list.** The shell's search covers the whole
  panel, already indexes this customer's projects, and its results link to
  `?project=<id>` — which is now the detail's own address, so a hit lands on the
  project instead of back on the list. Keeping a second, narrower search inside
  the page would spend a row on the worse of the two.
- **The card is one button with two compositions** (§4). The chip, the chevron
  and the short id each move between rows between the two designs, so this is
  not a reflow of one arrangement — each body is written out and the other is
  `display:none`, which keeps it out of the accessible tree too. Both read the
  same project object, and the `aria-label`, the click target and the focus ring
  belong to the single `<button>` around them.
- **The detail's sections reorder below `lg`** (§7): identity, money, the work,
  its files, the facts, then the way to ask about any of it. Both column
  wrappers are `display: contents` there, which dissolves them so every section
  becomes a direct child of the grid and can take an `order`; from `lg` they
  become real containers again with exactly the classes they had. The desktop
  arrangement is reproduced rather than restated.
- **The 82px ring became a labelled bar** (§5). A ring beside a name at 393px
  costs a third of the column to say one number, and it cannot show how far
  along a mid-build project is the way a bar can.
- **The empty state replaces the page** (§8). "No projects at all" is a
  different screen from "nothing matches this filter" — the second keeps its
  filters because clearing them is the fix; the first has nothing to filter, so
  the stat card and the pills are hidden rather than rendered as a wall of
  zeros.

**Deliberate deviations, all for the same reason.** The mockup's detail bar
carries an options (⋯) button whose sheet the spec itself marks "not yet
built": of its three actions, rename has no customer endpoint, "download brief"
has no such document, and "contact team" duplicates the row already at the
bottom of the page. Shipping a menu with one item that repeats what is on
screen is the dead end Phases 3, 5 and 7 each removed, so the slot keeps the
search button that works. For the same reason the payment card keeps its "Pay"
button, which the mockup does not draw — its example project has nothing due —
and the summary keeps the project-manager chip, which is the only place that
fact appears. Filter pills are the design's 38px rather than the shell's 44px
floor; they are secondary controls in a wrapped group, and raising them would
push the two lines further apart than drawn.

**Three desktop changes, on purpose.** The header sub-line takes the mockup's
copy; the third stat tile's icon takes its green; and `useSegments` rises from
16 to 24, so a 24-month plan draws segments rather than collapsing to a bar. The
last is the only visible one: one fact should have one encoding, and the design
counts on the segments surviving a 361px card. Everything else measured
identical to HEAD.

**Phase 4 Mobile gotcha — `order` applies wherever the parent is a flex
container, including `lg`.** The rail is `lg:flex lg:flex-col`, so the
`order-*` classes that sequence the sections below `lg` also sequenced them at
`lg` — and the payment card jumped above the project summary on desktop. Caught
only by diffing computed geometry against HEAD; the fix is an explicit
`lg:order-none` on every ordered element. Setting `order` on a child of a
`lg:block` container is safe, because `order` is ignored outside flex and grid.

#### Phase 5 (mobile) — Wallet & credit at 393px

`Wallet - Mobile.dc.html` + `PHASE-5-MOBILE.md`. One page (`wallet.vue`), one
sub-view registration, and a container change to `WalletTopUp`. No endpoint, no
payload, and the three Phase 5 data-truth fixes are untouched — the credit
zero-state, the `TX_LABEL` map and Receipts-not-invoices all carry over as they
were. Desktop re-measured at 1280px against HEAD across all four tabs.

- **Four tabs that fit.** `Overview · Transactions · Installments · Banking`
  needs about 430px of pill at 13.5px against 361px of content, so the strip
  either truncated or became a sideways scroll nobody discovers. Below `sm` it
  is one four-up segmented control, full width, 40px, with two labels shortened
  to `Activity` and `Plans` (§1). The short label is a third entry in
  `TAB_DEFS`, not a second array.
- **A plan is a screen, not an accordion** (§6). Desktop expands a schedule in
  place because the rail has room; at 393px a 24-row schedule inside a collapsed
  card inside the page scroll cannot be scanned. The card becomes a link into
  its own view with the back arrow in the bar — the same move a project makes
  on My Orders, registered in the same `useApexSubView` list, and in the URL for
  the same reason: the shell's bar renders before the page's `setup()` runs, so
  it cannot be told, only read. The desktop accordion is untouched and stays
  mounted from `lg` up, expanding whichever plan the query names.
- **Balance figures drop to 38px and the cards stack** (§2) — still the largest
  thing on screen, and `£12,500` clears 361px with room. The auto-pay switch
  goes to 48 × 28 with a 22px knob; the desktop 44 × 25 is under the thumb.
- **Paying an installment asks first** (§7). Money leaves the wallet the moment
  the button is pressed, and on a phone that button sits in a card a screen away
  from the schedule it belongs to. The sheet restates the amount, where it comes
  from and what is left — and when the balance would go negative it says so in
  amber, because the server refuses that charge and the customer should see it
  coming rather than meet it as an error.
- **Top-up is a bottom sheet, not a centred modal** (§3). A dialog centred in a
  393px viewport is pushed off-screen the moment the keyboard opens; anchored to
  the bottom edge, with the viewport meta's `interactive-widget=resizes-content`
  shrinking the visual viewport, the panel stays above it. Presets become a 2 × 2
  grid of 56px targets and the custom field is 56px with a 22px value — 22px
  because iOS zooms the page in on a focused input under 16px.
- **Filters gained `aria-pressed`.** The five transaction filters had none —
  they were the only pressed-state control group in the customer panel still
  missing it, next to a tab strip and a My Orders filter row that both have it.
  Below `sm` they wrap onto two lines as standalone 38px pills (§5).
- **Banking stacks in the order a phone reads it** (§8): how you pay, how to pay
  by transfer, what you have paid, who it is billed to. Both column wrappers are
  `display: contents` below `lg` so all four sections become grid children that
  can take an `order`, with `lg:order-none` on each. A payment-method row
  becomes a small card — identity and remove on one line, the default state
  full-width beneath — because five controls do not fit one 361px line.
- Transaction rows are 72px with the date joining the sub-line, since there is
  no second column to put it in; the row title wraps to two lines rather than
  truncating away the project it names.

**Deliberate deviations.** The mockup drops the in-page transaction search in
favour of the top bar's. `ApexSearch` indexes the panel's destinations plus the
customer's projects and tickets — not ledger rows — so removing it would leave
no way to search transactions on a phone; it stays, at 16px. The plan detail
says `24-month plan` and not the mockup's `24-month plan · 0%`: 0% is true of a
12-month plan and false of a 24-month one (ADR-011 puts 1% a month on that
term), and this page has no rate to read. The credit card keeps its
config-driven term copy rather than the mockup's flattened wording — that copy
is the Phase 5 §6 fix, and it already withholds a term the wizard is not
offering. Receipts keep no download control, because there is still no receipt
endpoint and the spec's own rule is "real or absent". `WalletTopUp`'s per-screen
footers stay inside its scroll: pinning them is a restructure of a 1,300-line
PCI flow, and the sheet geometry already puts the confirm above the keyboard.

**Phase 5 Mobile gotcha — an unconditional `leading-*` outranks a breakpointed
`text-*`.** `text-[12.5px] leading-[1.4] sm:text-xs` looks like it hands desktop
back to `text-xs`, and it does for the size — but `leading-[1.4]` has no variant
and still won the line-height, making the auto-pay row 1px taller than HEAD.
Scope the leading (`max-sm:leading-[1.4]`) whenever the breakpoint's own class
carries one. This is the same family as the Phase 3 Mobile note about `text-sm`,
seen from the other side.

**Phase 5 Mobile gotcha — `sm:h-auto!` is not "undo the height".** `h-12!
sm:h-auto!` on a `BaseButton` does not restore the component's own 40px; it
computes the content height, which came out at 38. Use `max-sm:h-12!` so the
override never reaches the breakpoint you wanted to leave alone.

#### Phase 6 (mobile) — Support at 393px

`Support - Mobile.dc.html` + `PHASE-6-MOBILE.md`. One page (`support.vue`), one
sub-view registration, one new rule in `useApexTaskBar` and the two lines in
`ApexBottomNav` that read it. No endpoint, no payload; the four Phase 6
data-truth fixes — no picker that discards a file, an unread dot that means
something, one config-driven ETA, the tokenised shell offset — carry over
unchanged. Desktop re-measured at 1280px across all three sections.

- **Every screen moved into the URL** (§1, §4). Which section is showing was a
  local `ref` and the open request was another, so the shell could not tell
  where the customer was: the bar has to swap its hamburger for a back arrow
  and name the request, and the tab bar has to step aside for the composer —
  and both render *before* this page's `setup()` runs. `?ticket=<id>` was
  already the deep link panel search used; `?tab=new|faq` joins it. The
  browser's own back button now walks out of a request and back through the
  sections, and every screen is linkable. Opening pushes, the bar's back arrow
  replaces, so back never goes *forward* into the request again.
- **The desktop pane still auto-selects; the phone does not.** An empty
  right-hand column is half a screen of nothing, so from `lg` up the first
  request is chosen for you — but that choice stays a plain ref and never
  touches the address bar, because on a phone "a request is open" has to mean
  the customer opened it. That is also what keeps the Phase 6 read rule honest:
  an auto-selected request is not a read one.
- **One entry point per action** (§1). The header's `New request` button and the
  `New request` tab are the same action twice, and at 393px they land within a
  hundred pixels of each other, so the button is `sm`-and-up only and the tab
  strip becomes one three-up 40px segmented control with two labels shortened.
  The team-online pill becomes a full-width row under the copy.
- **The composer takes the bottom edge from the tab bar** (§4). Two bars
  stacked there is ~110px of chrome under the thumb and the one the customer
  needs is the lower. `useApexTaskBar` grew a second, narrower rule for this:
  `ownsBottomEdge` says a screen pins its own control to the bottom, which is
  *not* the same claim as task mode — the thread still wants the sub-view back
  arrow and the search button, not a close button and a `Secured` chip.
- **The new-request footer sticks rather than restructuring the form.** Below
  `lg` the form card dissolves, as drawn, and the submit row — the card's last
  child either way — becomes `sticky bottom-0` with the ETA above it via
  `flex-col-reverse` against one DOM order. The DOM is untouched, so the
  desktop row is provably the row it always was. Its one requirement is that
  the section stops being `overflow-y-auto` below `lg`: that property makes an
  element a scrollport even when it never scrolls, and a sticky child of one is
  pinned to a box that never moves.
- **The unread dot gained a word** (§3) — "New reply" plus a violet card
  border, with the state now carried by the card's `aria-label` so the dot
  itself is decorative. Verified by posting a real staff reply through the
  admin endpoint: the border lights, the label says `new reply`, opening clears
  both, and the browser back button returns to a cleared list.
- **The staff avatar belongs to a run, not a bubble** (§6). The mockup keeps a
  30px spacer for continuation replies, so the alignment it wants is exactly
  what `visibility: hidden` gives — which is why the repeats are hidden below
  `lg` rather than removed, and desktop still shows every face at the same
  coordinates it always did. Bubbles cap at 84% at 15px.
- **Two selects became sheets** (§2, §8): the category filter and the related
  project. Both keep the themed `BaseSelect` from `lg` up, and only one of the
  two controls is ever mounted, so there is one thing to label and one to test.
- **Enter no longer sends on a touch keyboard.** It was the only way to start a
  new line there, so a multi-line reply was impossible to write on a phone —
  in a composer whose textarea grows to several lines precisely because
  customers write them. Read from `(pointer: coarse)` at event time, so nothing
  is decided during SSR.
- Status filters gained `aria-pressed`, which they had never had, and wrap as
  38px pills with "Awaiting you" spelled out; the FAQ's category tag sits above
  its question below `sm` via a `sm:contents` wrapper, so the desktop row is
  reproduced rather than restated; search, subject, message and both sheet
  triggers are 16px (iOS zooms the page in below that) and 48–52px tall.

**Two deliberate desktop changes.** The still-stuck card now quotes the config
ETA — §9 asks for it, and "our team is online and ready to help" promised
nothing. And the reply placeholder loses its `(Enter to send, Shift+Enter for a
new line)` hint: a placeholder cannot be responsive, the long one truncates in a
393px field, and the hint is no longer true on the device that would see it.

**Deliberate deviations.** The mockup's thread bar carries an options (⋯)
button; rename has no customer endpoint, there is no brief to download and
"contact team" is what this screen already is, so the slot keeps the search
button that works — the same call Phase 4 Mobile made. The H1 stays "Support
center" rather than the mockup's "How can we help?": one page, one name, and the
spec only asks that the ETA row sit under the H1. The page sub-line stays, as it
does on the other five mobile pages. And the empty inbox keeps two bodies — the
mockup's dashed card below `lg`, the existing sentence in the desktop pane,
where the filters, the tabs and the header button are all still on screen beside
it.

**Phase 6 Mobile gotcha — a contrast probe must scale relative-colour output.**
Chrome answers `rgb(from <col> r g b / alpha)` with `color(srgb r g b / a)`,
whose channels are 0–1 floats rather than the 0–255 of `rgb()`. Reading one as
the other turns every colour near-black and reports a ratio of exactly 1 for
every element on the page — confidently, and for text that is genuinely fine.
This is the third trap in the same probe family, after oklab parsing and
gradient backgrounds (Phase 2 Mobile).

**Phase 6 Mobile note — the ETA row was a real light-theme regression.**
Making the team-online pill visible at 393px put `text-white` on a 10% green
tint over a near-white page: measured **1.17**. It is `text-muted-900
dark:text-white` now. With that fixed the page measures 12 low-contrast
elements of 36 against HEAD's 11 of 34 — the same proportion, and every one of
them the documented `text-muted-500`-on-`bg-muted-800` debt that Phase 9 owns.

#### Phase 7 (mobile) — Settings at 393px

`Settings - Mobile.dc.html` + `PHASE-7-MOBILE.md`. One page (`settings.vue`),
one sub-view registration, one bottom-edge rule, a title resolver in
`useApexSubView`, and two additive fixes in `update-all.put.ts`. Every Phase 7
data-truth rule carries over unchanged — and this is the page where they bite
hardest, because it is where customers type their company details.

- **The sub-nav becomes a hub** (§1). A 220px rail beside a form cannot exist
  at 393px, and a four-tab strip across the top is the width Wallet and Support
  already spend on theirs. Below `lg` the page is a hub — account row, four
  72px section rows, notifications, legal, sign out — and each section opens as
  its own screen with the back arrow in the bar. `?section=` carries it, for
  the reason My Orders, Wallet and Support all put theirs in the URL: the bar
  and the tab bar render before the page's `setup()`. With no query the desktop
  panel shows Profile, exactly as it did when this was a local ref.
- **Save is pinned and scoped** (§13). The footer posts *only* the section on
  screen — verified by intercepting the request: Company sends
  `{company:{…}}` with no `user` key, Profile sends `{user:{…}}` with no
  `company` key. Two things had to change server-side for that to be safe, both
  additive: `company` is `.optional()` rather than `.default({})`, so omitting
  it means "don't touch the company record" instead of running an upsert; and
  the update branch writes `name: company.name ?? undefined` rather than
  `company.name || ''`, so a payload without a name leaves it alone instead of
  blanking the registered company name. Confirmed by saving Profile alone and
  reading the company row back intact.
- **Only the fields that round-trip, again.** The mockup draws a trading name,
  a company number with live validation, a six-field structured UK address with
  a postcode check, a separate billing email, a "same as our registered office"
  switch over a second billing address, three notification switches, and a
  "Change photo" action sheet. `Company` has one free-text `address` column and
  no CRN; `User` has no notification columns; there is no upload endpoint. All
  of those are absent rather than rendered, because a box that cannot be stored
  is the write-then-lose defect Phase 7 existed to remove. What ships instead:
  one address field whose heading still switches to **Business address** for
  sole traders, the billing summary **derived** from the company record (which
  is what §11 actually asks for), a notifications card that says what we send
  and where to change it, and the standing statement about photo uploads.
- **Every select is a sheet** (§5). Business type is a 52px trigger that wraps
  rather than truncates, over a sheet of 56px options with the UK-legal-form
  hint in its header. Country has no column, so there is no country control to
  convert. Native `<select>` count in the customer panel: still zero.
- **The password form keeps its own button** (§7), and it matters more here
  because the section's Save footer is always visible beneath it. Verified that
  all three invalid cases — no current password, too short, mismatched confirm
  — fire **zero** API requests. Mismatch shows on the confirm field as you
  type, the strength meter is 6px, and a 44px show/hide eye sits in the
  current-password field.
- Fields are 52px at 16px (iOS zooms the page in below that), rows and switches
  are sized for thumbs, and the section screen is bounded to the viewport so
  the footer lands on the bottom edge — Billing is short enough that a `sticky`
  footer would have sat mid-screen.

**Two deliberate desktop changes**, both copy: company email and phone are
marked `(optional)`, which they are; and the notes field takes the mockup's
label and gains a line saying who sees it. The show/hide eye on the current
password renders at both sizes, matching the standard Phase 8 set for every
password input.

**Deliberate deviations.** The bottom tab bar stays on the Security screen. The
mockup gates it on "hub only", but its stated reason is that section screens
give that space to the save footer — and Security has no footer, so the rule
that already exists (`ownsBottomEdge`) answers it correctly and the tab bar is
not competing with anything. The hub's version line drops the mockup's
`v2.4.0`: there is no build version to read, and inventing one is the same
class of fabrication as the invented session. And the Billing row carries no
"Needed" chip — VAT is optional, and the page says so two lines above.

**Phase 7 Mobile gotcha — a route-derived bar title is a hydration mismatch
waiting to happen.** Publishing the section name through `useApexSubView`'s
shared `title` looked identical to what My Orders and Support do, and it
mismatched on every deep link: the toolbar renders *before* the page on the
server, so the server emitted the fallback while the SSR payload already
carried "Company". The other pages get away with it because their names come
from a lazily fetched record, so the payload is null too. Settings' name is a
pure function of `?section=`, so the composable now resolves it itself
(`label`), and `barTitle` prefers that over anything a page publishes.

**Phase 7 Mobile gotcha — dissolving the cards took the theme with it, again.**
`bg-muted-800` on the section cards was the only thing putting this page's
`text-white` field labels on a dark surface. The design removes those cards at
393px, and doing that alone measured **1.06** on six labels in light mode —
white on near-white, and this phase's doing rather than the backlog's. The
section-screen wrapper carries the ink instead (invisible in dark mode because
it *is* the page colour), exactly as the New Order wizard does. With that in
place the screen measures 9 low-contrast elements of 22, all of them the
documented `text-muted-500` debt — and at 2.33 against HEAD's 1.98 for the same
elements, so slightly better than before.

#### Phase 9 (admin) — Team & platform

`Admin - Team & Platform.dc.html` + `PHASE-9-ADMIN.md` (badges 24–31). Three
screens — **Team & access** (`/admin/team`, new), **Platform settings**
(`/admin/settings`, rebuilt) and **Audit log** (`/admin/audit`, lifted out of
Tools) — plus the shell regrouping every admin page inherits. The sidebar is now
the design's five groups (Work · People · Money · Service · System) and a
destination your role cannot open renders as a padlock, never a link that 403s.

- **The matrix is the enforcement, literally** (badge 26). `shared/permissions.ts`
  holds six roles × eleven permissions and is imported by *both* halves of the
  app: `requireStaffPermission()` throws the 403 from it, and `/admin/team`
  renders the table with a `v-for` over the same array. There is no second copy
  to drift. See ADR-016. The 403 even names the roles that do hold it, so an API
  client and a person get the same sentence.
- **Two changes are refused, in the API as well as the UI** (badge 25). You
  cannot change or suspend your own access; the last owner cannot be demoted or
  suspended. The reason replaces the buttons in the row rather than greying them
  out with nothing to explain it, and a crafted `PATCH` gets the identical
  wording.
- **Invites are not members** (badge 24). They sit in their own amber panel with
  the expiry, Resend and Cancel — never as "pending" rows in the staff table,
  where they would inflate the headcount and read as people who can already act.
- **An invite you cannot accept is a dead end**, so `/auth/accept-invite` ships
  with it, on the Phase 8 auth shell. The role and the address come from the
  invite row, never the request body, and the token is claimed inside the same
  transaction that creates the account.
- **One reply promise, one wording** (badge 27). `shared/support-eta.ts` turns
  the stored minutes into the sentence the client reads, and *both* the admin
  preview and `/api/config` call it. Verified end to end: setting the Normal
  target to 25 makes the customer Support page say "~25 min".
- **Absolute timestamps and the role held at the time** (badges 30, 31). The
  audit log gained `roleAtTime` and `reason` columns; entries written before this
  phase show "—" rather than being back-filled from the account's role today,
  which would state something the log never recorded. No edit, no delete, and no
  endpoint behind one.
- Suspension now ends a **live** session. `requireRole` checked the role fresh
  but never the status, and sessions are seven-day JWTs — so "Suspend" blocked
  the next sign-in while leaving the person working. Verified with two cookie
  jars: 200 → 403 on the same cookie, and back on restore.

**Deliberate deviations, all for the standing "real or absent" rule.**

- **No 3/6/36-month instalment terms.** The mockup offers five as a free
  selection; ADR-011 fixes pricing for exactly two, so the other three would let
  an owner switch on a term the wizard cannot quote. 12 months is shown as the
  base product and 24 as the one real toggle — which is the same setting
  `/api/orders` checks.
- **No "hold deliverables until fully paid" switch.** There is no deliverables
  feature in this codebase, so it would store a boolean nothing reads — the
  `twoFactor` field Phase 7 deleted. Stated as "Not built" instead.
- **"Last active" is "Last action".** Nothing here records a sign-in. The column
  reports the member's most recent *audited action*, which the database can
  answer, and the heading says so. Deriving "Active now" from `updatedAt` would
  be Phase 7's invented session list.
- **The audit log's Files filter is Work.** Deliverable release has no model and
  writes no entry, so a Files filter could only ever return zero rows — a dead
  control. Work (projects, milestones, tickets) is real. The five buckets were
  verified to *partition* the log: 45 entries, five filters, zero double-counted,
  zero unreachable.
- **Nothing is emailed on invite.** No mail provider exists, so the acceptance
  link is handed to the operator with a line saying to pass it on.
- **Sign-in limits state the code's numbers, not the mockup's.** The design says
  "5 attempts per 15 minutes"; `RateLimits.login` is 5 per *minute* with a
  15-minute block. On a page operators consult when someone cannot sign in, the
  mockup's figure would be worse than none.
- **Settings keeps everything the old page controlled.** The four design panels
  hold only values a client can see; payment-rail routing, maintenance mode and
  the rest sit below under "Other configuration", so the rebuild does not quietly
  remove admin control of the payment providers.

**Phase 9 Admin gotcha — `BaseSelect` does not forward `id`.**
`<BaseSelect :id="...">` puts nothing on the trigger, so a `<label for>` beside
it points at an element that does not exist — a dangling reference, which is
worse than no label (the same finding as Phase 1 Mobile's `aria-describedby` on
the sheets). Six of these shipped before the sweep caught them. Name the select
with `aria-label` and use a plain `<span>` for the visible text. Note also that
reka renders a 1px `aria-hidden` native `<select>` for form compatibility when
the component sits inside a `<form>` — that one is not the dark-popup defect and
should not be counted as a native select.

**Phase 9 Admin gotcha — a kind filter needs exclusions, and a catch-all.**
Classifying audit rows by action prefix has two traps. `admin.team.` belongs to
Team but `admin.team.suspend` is Access, so every *more specific* prefix owned by
another bucket must be excluded from the query or a row appears under two
filters. And the display fallback ("unknown action → Config") has to be mirrored
in the query, or an action nobody classified renders a Config chip while being
invisible under every filter — visible in "All", unfindable by clicking the kind
it says it is. Both were live until measured; the fix is one `kindFilter()` the
query and the chip share.

**Light theme: these four screens are clean.** Written with light/dark pairs from
the start rather than inheriting the panel's dark-only debt. Measured at 1440px
in light mode: 1 low-contrast element of 258 (team), 228 (settings), 311 (audit)
and 82 (tools) — the *same* element every time, the shared toolbar's decorative
`/` breadcrumb separator, which measures identically on the untouched
`/admin/users`. So they add nothing to the Phase 9 light backlog.

**Phase 8 gotcha — a comment before the root element is a second root.**
A template whose first node is an HTML comment is multi-root, so the client
hydrates a Fragment where the server rendered an element. Keep layout commentary
inside the root node.
## 5. Known issues

Fixed:
- [x] **Reload logged users out.** Refreshing/direct-loading any `/dashboards/*` page
      bounced to login. Two causes: (1) `swr: 3600` on `/dashboards/**` cached the first
      unauthenticated render and served it to everyone; (2) `fetchUser()` used plain
      `$fetch`, dropping the cookie during SSR. Fixed by `swr: false` on `/dashboards/**`
      and `useRequestFetch()` in `useUser`.
- [x] **App broke after a fresh `pnpm install`** (Prisma client not generated → "Named
      export 'PrismaClient' not found"). Added `postinstall: prisma generate`.
- [x] **Page content had no horizontal gutter below ~1200px** — sections/cards ran flush
      to the viewport edge on most laptop, tablet and mobile widths. Root cause:
      `sidenav.vue` wrapped only `<DemoToolbar>` in `px-4 md:px-6 xl:px-8`; `<slot />`
      (every page's actual content) rendered as an unpadded sibling, and the documented
      page-wrapper convention (`mx-auto max-w-[1180–1240px] …`) has no `px-*` of its own —
      so nothing provided a gutter below each page's max-width. Fixed once, in the shared
      layout, by nesting `<slot />` inside that same padded div — every page inherits it,
      no per-page changes needed. Same pass also fixed a couple of narrow-viewport spots
      that predated it: the Transactions-tab filter pills on Wallet could wrap into a
      two-row stadium shape instead of scrolling, and the New Order success modal's two
      footer buttons didn't stack on very narrow phones.
- [x] Duplicate `useUser.ts` (`.demo/composables/` vs `.demo/app/composables/`) and
      duplicate auth plugins (`auth.ts` + `auth-load.ts`) removed.
- [x] **Flagship-phone responsive pass** (`c3f7f2b`). Safe-area/`dvh`: `viewport-fit=cover`
      (nuxt.config) so `env(safe-area-inset-*)` resolves; shell gutters use
      `max(<gutter>, env(inset))`; support split-pane + wallet/services modals use
      `100dvh - env(top/bottom)` so height tracks the mobile URL bar and clears the
      notch/home-indicator (no-ops in normal tabs). Layout: wallet installment rows reflow
      to two lines under `sm` (no overflow at 393px); top-up presets `grid-cols-2 sm:grid-cols-4`;
      DemoToolbar gains a `md:hidden` search icon (search had no <768px entry point) and a
      `min-w-0`/`truncate` breadcrumb that drops the parent crumb under 400px. **Build-fix:**
      a literal `pt-[env(...)]` written as shorthand *inside a sidenav comment* was scanned
      by Tailwind v4, emitted invalid `padding-top: env(...)`, and lightningcss 500'd the
      whole dev server — Tailwind scans comments too; document classes in valid form or prose.
      Verified at 1440px + 393px, no horizontal overflow, restructured layouts revert to
      single-line/multi-column at ≥sm.

- [x] **Hydration mismatch warnings** — fixed in V2 Phase 1. Both offenders were
      client-only values rendered during SSR in `DemoToolbar`: the locale flag image
      (deleted; language moved into the account menu) and the `Ctrl`/`⌘` hint, which
      used the layer's `useIsMacLike()` — that resolves in `onBeforeMount`, i.e.
      *before* the hydration render, so server and client disagreed on the very first
      paint. The hint now resolves in `onMounted`. Console is clean on the dashboard.
- [x] **`.demo/app/public/` was never served.** Nuxt 4's public dir is `<rootDir>/public`
      (`.demo/public`), so `/brand/apex-icon.svg` and every `/fonts/yellix/*.woff`
      404'd — in dev *and* in the production bundle. Yellix had been silently falling
      back to Inter in production, and the brand assets were unreachable, which is why
      the sidebar still shipped Tairo's wordmark. Assets moved to `.demo/public/`.

To address:
- [ ] Stale seed scripts reference fields not in the schema: `server/api/seed-rich.get.ts`,
      `seed-wallet.get.ts`, and `prisma/seed.js` (uses `name`/`status`/`USER`). Dev-only.
- [ ] **Legal content is a launch blocker.** `/legal/terms` and `/legal/privacy`
      exist so signup's consent links resolve and open real pages instead of
      `href="#"`, but neither contains the actual document — they state where the
      binding terms currently live and how to request them. A consent checkbox
      pointing at a page that does not contain the terms is still not an
      enforceable click-wrap. Publish the real Terms and Privacy Policy into those
      two routes (each carries a `TODO(legal)`).
- [ ] No email or phone verification at signup: `/api/auth/signup` sets the session
      immediately, so an account can be created against an address the user does not
      control. Flagged by the Phase 8 spec, out of scope for a UI phase.
- [ ] Credit-line, expense-split (balance) and the service "from" prices / order plan
      catalogue (new order) are front-end placeholders — back them with real API/data models.
- [ ] `orders.vue` formats prices in USD and has a hardcoded "Sarah Connor" project manager.
- [ ] Settings cannot capture a company number, a trading name or a structured UK
      address (line 1/2, town, county, postcode) — `Company` has one free-text
      `address` column and no CRN field, so Phase 7 rendered one address box rather
      than inputs that could not be stored. Same for avatar / company-logo upload
      (no endpoint). Both need a migration; see the plan file's uploads phase.
- [ ] Mixed English / Persian inline comments across pages (cosmetic; standardise to English).
- [ ] `wallet.vue` is dark-only: ~46 literal `text-white` classes with no light
      pair, so 12 elements on the Overview and Banking tabs render white-on-white
      when the OS prefers light. Pre-existing (identical count at the pre-Phase-5
      commit) and deliberately left alone — the light treatment for this page is
      V2 Phase 9's scope, and improvising one would violate "the design export is
      the spec". The V2-rebuilt pages (balance/orders/services) are already clean.
- [ ] Native `<select>` remains only in the admin panel + AgencyCalculator (26).
      The whole customer panel is clean as of Phase 7.
- [ ] `/api/seed-support` (and the other dev seeds) verify the JWT with
      `process.env.JWT_SECRET || 'secret'` while `/api/auth/login` signs with
      `runtimeConfig.jwtSecret`, so a valid session gets "invalid signature" and
      a raw 500. Dev-only, pre-existing, and untouched by Phase 6 — but it means
      `seed-support` cannot be used to make test data.
- [ ] File attachments on support tickets: no `TicketMessage` attachment
      relation and no upload endpoint, so the UI offers no picker at all
      (Phase 6). Shipping `POST /api/support/:id/attachments` is what unblocks
      restoring it — see the plan file's uploads phase.
- [ ] Local dev uses an Iran mirror in `.npmrc` that 403s intermittently; `registry.npmmirror.com`
      worked (`pnpm install --registry=https://registry.npmmirror.com/`).
